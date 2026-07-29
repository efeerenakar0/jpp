import type {
  OperationalTaskStatus,
  Prisma,
  CrmTaskStatus,
} from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { canTransitionTask, createOperationIdempotencyKey } from './workflow';

const terminalCompatibility: Partial<
  Record<OperationalTaskStatus, CrmTaskStatus>
> = {
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

function transitionTimestamp(status: OperationalTaskStatus, at: Date) {
  switch (status) {
    case 'ASSIGNED':
      return { assignedAt: at };
    case 'MESSAGE_QUEUED':
      return { messageQueuedAt: at };
    case 'DELIVERED':
      return { deliveredAt: at };
    case 'ACCEPTED':
      return { acceptedAt: at };
    case 'IN_PROGRESS':
      return { startedAt: at };
    case 'COMPLETED':
      return { completedAt: at };
    case 'FAILED':
      return { failedAt: at };
    default:
      return {};
  }
}

export async function transitionTaskInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    companyAccountId: string;
    taskId: string;
    toStatus: OperationalTaskStatus;
    evidenceText: string;
    operationEventId?: string | null;
    managerActionId?: string | null;
    sourceMessageId?: string | null;
    actorType: string;
    actorId?: string | null;
    reason?: string | null;
    idempotencyKey?: string;
    expectedFromStatus?: OperationalTaskStatus;
    expectedWorkflowVersion?: number;
  }
) {
  const idempotencyKey =
    input.idempotencyKey ||
    createOperationIdempotencyKey({
      companyAccountId: input.companyAccountId,
      eventType: `TASK_TRANSITION_${input.toStatus}`,
      sourceMessageId: input.sourceMessageId,
      entityId: input.taskId,
    });
  const existing = await tx.taskStatusTransition.findUnique({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: input.companyAccountId,
        idempotencyKey,
      },
    },
    include: { task: true },
  });
  if (existing) return existing.task;

  const task = await tx.crmTask.findFirst({
    where: {
      id: input.taskId,
      companyAccountId: input.companyAccountId,
    },
  });
  if (!task) throw new Error('Görev bu şirkette bulunamadı.');
  if (
    (input.expectedFromStatus &&
      task.workflowStatus !== input.expectedFromStatus) ||
    (input.expectedWorkflowVersion !== undefined &&
      task.workflowVersion !== input.expectedWorkflowVersion)
  ) {
    throw new Error(
      'Görev durumu eşzamanlı başka bir işlemle değişti; düzeltme otomatik uygulanmadı.'
    );
  }

  const transition = canTransitionTask(
    task.workflowStatus,
    input.toStatus,
    input.evidenceText
  );
  if (!transition.allowed) {
    throw new Error(
      transition.clarificationQuestion || 'Görev durumu değiştirilemedi.'
    );
  }

  const now = new Date();
  const changed = await tx.crmTask.updateMany({
    where: {
      id: task.id,
      companyAccountId: input.companyAccountId,
      workflowStatus: task.workflowStatus,
      workflowVersion: task.workflowVersion,
    },
    data: {
      workflowStatus: input.toStatus,
      status: terminalCompatibility[input.toStatus] || 'OPEN',
      workflowVersion: { increment: 1 },
      lastStatusAt: now,
      ...transitionTimestamp(input.toStatus, now),
      ...(input.toStatus === 'FAILED'
        ? { failureReason: input.reason || input.evidenceText }
        : {}),
    },
  });
  if (changed.count !== 1) {
    throw new Error(
      'Görev durumu eşzamanlı başka bir işlemle değişti; güncel kayıt yeniden okunmalı.'
    );
  }
  await tx.taskStatusTransition.create({
    data: {
      companyAccountId: input.companyAccountId,
      taskId: task.id,
      fromStatus: task.workflowStatus,
      toStatus: input.toStatus,
      operationEventId: input.operationEventId,
      managerActionId: input.managerActionId,
      sourceMessageId: input.sourceMessageId,
      actorType: input.actorType,
      actorId: input.actorId,
      evidence: { text: input.evidenceText },
      reason: input.reason,
      idempotencyKey,
    },
  });
  if (input.toStatus === 'COMPLETED') {
    await tx.operationalCommitment.updateMany({
      where: {
        companyAccountId: input.companyAccountId,
        taskId: task.id,
        status: { in: ['OPEN', 'OVERDUE'] },
      },
      data: {
        status: 'COMPLETED',
        completedAt: now,
      },
    });
  } else if (
    ['CANCELLED', 'FAILED', 'REJECTED'].includes(input.toStatus)
  ) {
    await tx.operationalCommitment.updateMany({
      where: {
        companyAccountId: input.companyAccountId,
        taskId: task.id,
        status: { in: ['OPEN', 'OVERDUE'] },
      },
      data: { status: 'CANCELLED' },
    });
  }
  return tx.crmTask.findFirstOrThrow({
    where: {
      id: task.id,
      companyAccountId: input.companyAccountId,
    },
  });
}

export async function transitionTask(input: Parameters<
  typeof transitionTaskInTransaction
>[1]) {
  return prisma.$transaction((tx) => transitionTaskInTransaction(tx, input));
}
