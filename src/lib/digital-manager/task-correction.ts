import type {
  CrmTaskStatus,
  OperationalTaskStatus,
  Prisma,
} from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { appendManagerAudit } from './events';
import {
  assessEmployeeTaskCorrection,
  type CorrectionSafetyFailureCode,
} from './task-correction-policy';
import { transitionTaskInTransaction } from './tasks';

function compatibleTaskStatus(
  workflowStatus: OperationalTaskStatus
): CrmTaskStatus {
  if (workflowStatus === 'COMPLETED') return 'COMPLETED';
  if (workflowStatus === 'CANCELLED') return 'CANCELLED';
  return 'OPEN';
}

function clearRevertedMilestone(
  status: OperationalTaskStatus
): Prisma.CrmTaskUpdateManyMutationInput {
  switch (status) {
    case 'ASSIGNED':
      return { assignedAt: null };
    case 'MESSAGE_QUEUED':
      return { messageQueuedAt: null };
    case 'DELIVERED':
      return { deliveredAt: null };
    case 'ACCEPTED':
      return { acceptedAt: null };
    case 'IN_PROGRESS':
      return { startedAt: null };
    case 'COMPLETED':
      return { completedAt: null };
    case 'FAILED':
      return {
        failedAt: null,
        failureCode: null,
        failureReason: null,
      };
    default:
      return {};
  }
}

export type ApplyEmployeeTaskCorrectionResult =
  | {
      status: 'APPLIED';
      revertedTaskId: string;
      correctedTaskId: string;
      rollbackTransitionId: string;
      correctedTransitionId: string;
    }
  | {
      status: 'NEEDS_CLARIFICATION';
      code: CorrectionSafetyFailureCode;
      clarificationQuestion: string;
    };

export async function applyVerifiedEmployeeTaskCorrection(input: {
  companyAccountId: string;
  employeeId: string;
  correctTaskId: string;
  correctedStatus: OperationalTaskStatus;
  evidenceText: string;
  correctionEventId: string;
  sourceProvider: string;
  sourceMessageId: string;
  receivedAt?: Date;
}): Promise<ApplyEmployeeTaskCorrectionResult> {
  const rollbackIdempotencyKey =
    `employee-correction:${input.sourceProvider}:${input.sourceMessageId}:rollback`;
  const correctedIdempotencyKey =
    `employee-correction:${input.sourceProvider}:${input.sourceMessageId}:apply`;

  const applyInTransaction = async (
    tx: Prisma.TransactionClient
  ): Promise<ApplyEmployeeTaskCorrectionResult> => {
    const existingRollback = await tx.taskStatusTransition.findUnique({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey: rollbackIdempotencyKey,
        },
      },
      select: { id: true, taskId: true },
    });
    if (existingRollback) {
      const existingCorrected = await tx.taskStatusTransition.findUnique({
        where: {
          companyAccountId_idempotencyKey: {
            companyAccountId: input.companyAccountId,
            idempotencyKey: correctedIdempotencyKey,
          },
        },
        select: { id: true, taskId: true },
      });
      if (!existingCorrected) {
        throw new Error('Görev düzeltme kaydı eksik; otomatik işlem durduruldu.');
      }
      return {
        status: 'APPLIED',
        revertedTaskId: existingRollback.taskId,
        correctedTaskId: existingCorrected.taskId,
        rollbackTransitionId: existingRollback.id,
        correctedTransitionId: existingCorrected.id,
      };
    }

    const correctTask = await tx.crmTask.findFirst({
      where: {
        id: input.correctTaskId,
        companyAccountId: input.companyAccountId,
        assignedMemberId: input.employeeId,
        status: 'OPEN',
      },
    });
    const previousTransition = await tx.taskStatusTransition.findFirst({
      where: {
        companyAccountId: input.companyAccountId,
        actorType: 'DIGITAL_GENERAL_MANAGER',
        actorId: input.employeeId,
        taskId: { not: input.correctTaskId },
        createdAt: { lte: input.receivedAt || new Date() },
      },
      include: {
        task: true,
        managerAction: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const latestWrongTaskTransition = previousTransition
      ? await tx.taskStatusTransition.findFirst({
          where: {
            companyAccountId: input.companyAccountId,
            taskId: previousTransition.taskId,
          },
          select: { id: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      : null;
    const safety = assessEmployeeTaskCorrection({
      companyAccountId: input.companyAccountId,
      employeeId: input.employeeId,
      correctedStatus: input.correctedStatus,
      evidenceText: input.evidenceText,
      correctTask,
      previousTransition,
      latestWrongTaskTransitionId: latestWrongTaskTransition?.id || null,
    });
    if (!safety.safe) {
      return {
        status: 'NEEDS_CLARIFICATION',
        code: safety.code,
        clarificationQuestion: safety.clarificationQuestion,
      };
    }

    const changed = await tx.crmTask.updateMany({
      where: {
        id: previousTransition!.taskId,
        companyAccountId: input.companyAccountId,
        assignedMemberId: input.employeeId,
        workflowStatus: previousTransition!.toStatus,
        workflowVersion: previousTransition!.task.workflowVersion,
      },
      data: {
        workflowStatus: previousTransition!.fromStatus,
        status: compatibleTaskStatus(previousTransition!.fromStatus),
        workflowVersion: { increment: 1 },
        lastStatusAt: new Date(),
        ...clearRevertedMilestone(previousTransition!.toStatus),
      },
    });
    if (changed.count !== 1) {
      return {
        status: 'NEEDS_CLARIFICATION',
        code: 'WRONG_TASK_ADVANCED',
        clarificationQuestion:
          'Yanlış görev eşzamanlı olarak değişti. Güncel durumu bozmamak için düzeltmeyi yeniden açıklar mısın?',
      };
    }

    const rollbackTransition = await tx.taskStatusTransition.create({
      data: {
        companyAccountId: input.companyAccountId,
        taskId: previousTransition!.taskId,
        fromStatus: previousTransition!.toStatus,
        toStatus: previousTransition!.fromStatus,
        operationEventId: input.correctionEventId,
        sourceMessageId: input.sourceMessageId,
        actorType: 'EMPLOYEE_CORRECTION',
        actorId: input.employeeId,
        evidence: {
          text: input.evidenceText.slice(0, 2000),
          correctionOfTransitionId: previousTransition!.id,
        },
        reason:
          'Doğrulanmış çalışan, hemen önceki otomatik görev yorumunu düzeltti.',
        idempotencyKey: rollbackIdempotencyKey,
      },
    });
    await transitionTaskInTransaction(tx, {
      companyAccountId: input.companyAccountId,
      taskId: correctTask!.id,
      toStatus: input.correctedStatus,
      evidenceText: input.evidenceText,
      operationEventId: input.correctionEventId,
      sourceMessageId: input.sourceMessageId,
      actorType: 'EMPLOYEE_CORRECTION',
      actorId: input.employeeId,
      reason: 'Doğrulanmış çalışan düzeltmesiyle doğru göreve uygulandı.',
      idempotencyKey: correctedIdempotencyKey,
      expectedFromStatus: correctTask!.workflowStatus,
      expectedWorkflowVersion: correctTask!.workflowVersion,
    });
    const correctedTransition = await tx.taskStatusTransition.findUniqueOrThrow({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey: correctedIdempotencyKey,
        },
      },
      select: { id: true },
    });
    const originalAudit = previousTransition!.managerActionId
      ? await tx.managerAuditLog.findFirst({
          where: {
            companyAccountId: input.companyAccountId,
            managerActionId: previousTransition!.managerActionId,
            operation: 'EXECUTE_ACTION',
            result: 'EXECUTED',
          },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
        })
      : null;
    await appendManagerAudit(
      {
        companyAccountId: input.companyAccountId,
        operationEventId: input.correctionEventId,
        actorType: 'EMPLOYEE',
        actorId: input.employeeId,
        operation: 'TASK_CORRECTION_APPLIED',
        entityType: 'CRM_TASK',
        entityId: correctTask!.id,
        verifiedContext: {
          employeeId: input.employeeId,
          correctTaskId: correctTask!.id,
          revertedTaskId: previousTransition!.taskId,
        },
        evidence: {
          sourceProvider: input.sourceProvider,
          sourceMessageId: input.sourceMessageId,
          correctionOfTransitionId: previousTransition!.id,
          rollbackTransitionId: rollbackTransition.id,
          correctedTransitionId: correctedTransition.id,
          text: input.evidenceText.slice(0, 2000),
        },
        confidence: 1,
        policyDecision: 'VERIFIED_EMPLOYEE_SAFE_COMPENSATION',
        result: 'APPLIED',
        correctionOfId: originalAudit?.id,
        completedAt: new Date(),
      },
      tx
    );
    return {
      status: 'APPLIED',
      revertedTaskId: previousTransition!.taskId,
      correctedTaskId: correctTask!.id,
      rollbackTransitionId: rollbackTransition.id,
      correctedTransitionId: correctedTransition.id,
    };
  };

  try {
    return await prisma.$transaction(applyInTransaction);
  } catch (error) {
    const existingRollback = await prisma.taskStatusTransition.findUnique({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey: rollbackIdempotencyKey,
        },
      },
      select: { id: true, taskId: true },
    });
    const existingCorrected = await prisma.taskStatusTransition.findUnique({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey: correctedIdempotencyKey,
        },
      },
      select: { id: true, taskId: true },
    });
    if (existingRollback && existingCorrected) {
      return {
        status: 'APPLIED',
        revertedTaskId: existingRollback.taskId,
        correctedTaskId: existingCorrected.taskId,
        rollbackTransitionId: existingRollback.id,
        correctedTransitionId: existingCorrected.id,
      };
    }
    if (
      error instanceof Error &&
      /eşzamanlı başka bir işlemle değişti|düzeltme otomatik uygulanmadı/i.test(
        error.message
      )
    ) {
      return {
        status: 'NEEDS_CLARIFICATION',
        code: 'WRONG_TASK_ADVANCED',
        clarificationQuestion:
          'Görevlerden biri eşzamanlı olarak değişti. Güncel durumu bozmamak için düzeltmeyi yeniden açıklar mısın?',
      };
    }
    throw error;
  }
}
