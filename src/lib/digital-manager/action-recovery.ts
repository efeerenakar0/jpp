import { prisma } from '@/lib/prisma';

import { appendManagerAudit } from './events';
import { executeApprovedManagerAction } from './executor';

const STALE_EXECUTION_MS = 5 * 60 * 1000;
const MAX_EXECUTION_ATTEMPTS = 3;

export async function recoverStaleManagerActions(now = new Date()) {
  const staleBefore = new Date(now.getTime() - STALE_EXECUTION_MS);
  const stale = await prisma.generalManagerAction.findMany({
    where: {
      status: 'EXECUTING',
      OR: [
        { executionStartedAt: null },
        { executionStartedAt: { lte: staleBefore } },
      ],
    },
    orderBy: { executionStartedAt: 'asc' },
    take: 100,
  });
  const results: Array<{
    actionId: string;
    result: 'RETRIED' | 'FAILED' | 'SKIPPED';
  }> = [];

  for (const action of stale) {
    if (action.executionAttemptCount >= MAX_EXECUTION_ATTEMPTS) {
      const failed = await prisma.$transaction(async (tx) => {
        const update = await tx.generalManagerAction.updateMany({
          where: {
            id: action.id,
            companyAccountId: action.companyAccountId,
            status: 'EXECUTING',
            executionAttemptCount: action.executionAttemptCount,
          },
          data: {
            status: 'FAILED',
            failedAt: now,
            errorCode: 'EXECUTION_LEASE_EXHAUSTED',
            errorMessage:
              'Aksiyon yürütmesi üç kez yarım kaldı; insan incelemesi gerekiyor.',
          },
        });
        if (update.count !== 1) return false;
        await appendManagerAudit(
          {
            companyAccountId: action.companyAccountId,
            operationEventId: action.operationEventId,
            managerActionId: action.id,
            actorType: 'SCHEDULER',
            actorId: 'digital-manager-action-recovery',
            operation: 'RECOVER_STALE_ACTION',
            entityType: action.targetType,
            entityId: action.targetId,
            result: 'FAILED',
            errorCode: 'EXECUTION_LEASE_EXHAUSTED',
            errorMessage:
              'Azami otomatik kurtarma denemesi aşıldı.',
            completedAt: now,
          },
          tx
        );
        return true;
      });
      results.push({
        actionId: action.id,
        result: failed ? 'FAILED' : 'SKIPPED',
      });
      continue;
    }

    const released = await prisma.$transaction(async (tx) => {
      const update = await tx.generalManagerAction.updateMany({
        where: {
          id: action.id,
          companyAccountId: action.companyAccountId,
          status: 'EXECUTING',
          executionAttemptCount: action.executionAttemptCount,
        },
        data: {
          status: 'APPROVED',
          errorCode: 'STALE_EXECUTION_RECOVERED',
          errorMessage:
            'Yarım kalan yürütme kilidi zamanlanmış görev tarafından kurtarıldı.',
        },
      });
      if (update.count !== 1) return false;
      await appendManagerAudit(
        {
          companyAccountId: action.companyAccountId,
          operationEventId: action.operationEventId,
          managerActionId: action.id,
          actorType: 'SCHEDULER',
          actorId: 'digital-manager-action-recovery',
          operation: 'RECOVER_STALE_ACTION',
          entityType: action.targetType,
          entityId: action.targetId,
          result: 'RETRY_APPROVED',
          completedAt: now,
        },
        tx
      );
      return true;
    });
    if (!released) {
      results.push({ actionId: action.id, result: 'SKIPPED' });
      continue;
    }

    try {
      await executeApprovedManagerAction({
        companyAccountId: action.companyAccountId,
        actionId: action.id,
        actorType: 'SCHEDULER',
        actorId: 'digital-manager-action-recovery',
      });
      results.push({ actionId: action.id, result: 'RETRIED' });
    } catch {
      // Executor records the verified failure state and audit entry.
      results.push({ actionId: action.id, result: 'FAILED' });
    }
  }

  return results;
}
