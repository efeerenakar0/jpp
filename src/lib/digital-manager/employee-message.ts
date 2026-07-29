import type { OperationEventType } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { proposeManagerAction } from './executor';
import { appendManagerAudit, recordOperationEvent } from './events';
import {
  interpretVerifiedEmployeeMessage,
  toTaskCandidate,
} from './planner';
import { applyVerifiedEmployeeTaskCorrection } from './task-correction';

function eventTypeForStatus(
  status: string | null
): OperationEventType {
  switch (status) {
    case 'ACCEPTED':
      return 'TASK_ACCEPTED';
    case 'REJECTED':
    case 'REASSIGNMENT_REQUIRED':
      return 'TASK_REJECTED';
    case 'WAITING_CUSTOMER':
      return 'CUSTOMER_UNREACHABLE';
    case 'APPOINTMENT_PROPOSED':
      return 'APPOINTMENT_PROPOSED';
    case 'APPOINTMENT_CONFIRMED':
      return 'APPOINTMENT_CONFIRMED';
    default:
      return 'CUSTOMER_CONTACTED';
  }
}

export async function processVerifiedEmployeeWhatsAppMessage(input: {
  companyAccountId: string;
  employeeId: string;
  text: string;
  provider: string;
  providerMessageId: string;
  quotedProviderMessageId?: string | null;
  conversationId?: string | null;
  receivedAt?: Date;
}) {
  const employee = await prisma.companyMember.findFirst({
    where: {
      id: input.employeeId,
      companyAccountId: input.companyAccountId,
      active: true,
      phoneVerificationStatus: 'VERIFIED',
    },
    select: {
      id: true,
      name: true,
      canReceiveWhatsAppTasks: true,
    },
  });
  if (!employee) {
    throw new Error('Doğrulanmış aktif çalışan bulunamadı.');
  }

  const tasks = await prisma.crmTask.findMany({
    where: {
      companyAccountId: input.companyAccountId,
      assignedMemberId: employee.id,
      status: 'OPEN',
      workflowStatus: {
        notIn: ['COMPLETED', 'CANCELLED', 'FAILED'],
      },
    },
    include: {
      contact: { select: { name: true } },
      property: { select: { title: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 25,
  });
  const outboxMessages = await prisma.whatsAppOutboxMessage.findMany({
    where: {
      companyAccountId: input.companyAccountId,
      recipientType: 'EMPLOYEE',
      recipientId: employee.id,
      relatedTaskId: { in: tasks.map((task) => task.id) },
      providerMessageId: { not: null },
    },
    select: {
      relatedTaskId: true,
      providerMessageId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const latestProviderIdByTask = new Map<string, string>();
  outboxMessages.forEach((message) => {
    if (
      message.relatedTaskId &&
      message.providerMessageId &&
      !latestProviderIdByTask.has(message.relatedTaskId)
    ) {
      latestProviderIdByTask.set(
        message.relatedTaskId,
        message.providerMessageId
      );
    }
  });
  const candidates = tasks.map((task) => ({
    ...toTaskCandidate(task),
    outboundProviderMessageId:
      latestProviderIdByTask.get(task.id) || null,
  }));
  const interpretation = await interpretVerifiedEmployeeMessage({
    employeeId: employee.id,
    message: input.text,
    messageTime: input.receivedAt || new Date(),
    sourceMessageId: input.providerMessageId,
    quotedProviderMessageId: input.quotedProviderMessageId,
    conversationId: input.conversationId,
    candidates,
  });

  if (interpretation.intent === 'TASK_CORRECTION') {
    const correctionEvent = await recordOperationEvent({
      companyAccountId: input.companyAccountId,
      eventType: 'CORRECTION_RECEIVED',
      entityType: interpretation.taskId ? 'CRM_TASK' : 'COMPANY_MEMBER',
      entityId: interpretation.taskId || employee.id,
      actorType: 'EMPLOYEE',
      actorId: employee.id,
      taskId: interpretation.taskId,
      sourceProvider: input.provider,
      sourceMessageId: input.providerMessageId,
      metadata: {
        interpretation,
        untrustedText: input.text.slice(0, 2000),
      },
      idempotencyKey: `employee-message:${input.provider}:${input.providerMessageId}:correction`,
    });
    const existingAudit = await prisma.managerAuditLog.findFirst({
      where: {
        companyAccountId: input.companyAccountId,
        operationEventId: correctionEvent.id,
        operation: 'CORRECTION_RECEIVED',
      },
      select: { id: true, result: true },
    });
    const correctionApplication =
      existingAudit?.result !== 'RECORDED_PENDING_CLARIFICATION' &&
      !interpretation.requiresClarification &&
      interpretation.taskId &&
      interpretation.statusProposal
        ? await applyVerifiedEmployeeTaskCorrection({
            companyAccountId: input.companyAccountId,
            employeeId: employee.id,
            correctTaskId: interpretation.taskId,
            correctedStatus: interpretation.statusProposal,
            evidenceText: input.text,
            correctionEventId: correctionEvent.id,
            sourceProvider: input.provider,
            sourceMessageId: input.providerMessageId,
            receivedAt: input.receivedAt,
          })
        : null;
    const correctionApplied =
      correctionApplication?.status === 'APPLIED' ||
      existingAudit?.result === 'RECORDED_AND_APPLIED';
    if (!existingAudit) {
      await appendManagerAudit({
        companyAccountId: input.companyAccountId,
        operationEventId: correctionEvent.id,
        actorType: 'EMPLOYEE',
        actorId: employee.id,
        operation: 'CORRECTION_RECEIVED',
        entityType: interpretation.taskId
          ? 'CRM_TASK'
          : 'COMPANY_MEMBER',
        entityId: interpretation.taskId || employee.id,
        evidence: {
          sourceMessageId: input.providerMessageId,
          text: input.text.slice(0, 2000),
        },
        structuredAi: interpretation,
        confidence: interpretation.confidence,
        result: correctionApplied
          ? 'RECORDED_AND_APPLIED'
          : 'RECORDED_PENDING_CLARIFICATION',
        completedAt: new Date(),
      });
    }
    if (correctionApplied) {
      return {
        routedAs: 'EMPLOYEE' as const,
        interpretation,
        event: correctionEvent,
        correction: correctionApplication,
      };
    }
    const action = await proposeManagerAction({
      companyAccountId: input.companyAccountId,
      operationEventId: correctionEvent.id,
      triggerMessageId: input.providerMessageId,
      action: {
        actionType: 'ASK_CLARIFICATION',
        question:
          (correctionApplication?.status === 'NEEDS_CLARIFICATION'
            ? correctionApplication.clarificationQuestion
            : interpretation.clarificationQuestion) ||
          'Doğru durumu açık ve somut biçimde yazar mısın?',
        recipientType: 'EMPLOYEE',
        recipientId: employee.id,
      },
      reason:
        'Çalışan önceki bildirimin düzeltilmesini istedi; güvenli ve tekil eşleşme olmadığı için değişiklik yapılmadı.',
      evidence: {
        sourceMessageId: input.providerMessageId,
        candidateTaskIds: candidates.map(({ id }) => id),
        correctionSafety:
          correctionApplication?.status === 'NEEDS_CLARIFICATION'
            ? correctionApplication.code
            : null,
      },
      confidence: interpretation.confidence,
      riskLevel: 'LOW',
      requestedByType: 'EMPLOYEE',
      requestedById: employee.id,
      idempotencyKey: `employee-message:${input.providerMessageId}:correction-clarification`,
    });
    return {
      routedAs: 'EMPLOYEE' as const,
      interpretation,
      event: correctionEvent,
      action,
    };
  }

  if (
    interpretation.requiresClarification ||
    !interpretation.taskId ||
    !interpretation.statusProposal
  ) {
    const question =
      interpretation.clarificationQuestion ||
      'Hangi görevle ilgili olduğunu ve somut sonucu biraz daha açıklar mısın?';
    const action = await proposeManagerAction({
      companyAccountId: input.companyAccountId,
      triggerMessageId: input.providerMessageId,
      action: {
        actionType: 'ASK_CLARIFICATION',
        question,
        recipientType: 'EMPLOYEE',
        recipientId: employee.id,
      },
      reason: 'Çalışan mesajı güvenle tek bir göreve bağlanamadı.',
      evidence: {
        sourceMessageId: input.providerMessageId,
        candidateTaskIds: candidates.map(({ id }) => id),
      },
      confidence: interpretation.confidence,
      riskLevel: 'LOW',
      requestedByType: 'EMPLOYEE',
      requestedById: employee.id,
      idempotencyKey: `employee-message:${input.providerMessageId}:clarification`,
    });
    return {
      routedAs: 'EMPLOYEE' as const,
      interpretation,
      action,
    };
  }

  const event = await recordOperationEvent({
    companyAccountId: input.companyAccountId,
    eventType: eventTypeForStatus(interpretation.statusProposal),
    entityType: 'CRM_TASK',
    entityId: interpretation.taskId,
    actorType: 'EMPLOYEE',
    actorId: employee.id,
    taskId: interpretation.taskId,
    sourceProvider: input.provider,
    sourceMessageId: input.providerMessageId,
    metadata: {
      interpretation,
      untrustedText: input.text.slice(0, 2000),
    },
    idempotencyKey: `employee-message:${input.provider}:${input.providerMessageId}:event`,
  });
  const statusAction = await proposeManagerAction({
    companyAccountId: input.companyAccountId,
    operationEventId: event.id,
    triggerMessageId: input.providerMessageId,
    action: {
      actionType: 'UPDATE_TASK_STATUS',
      taskId: interpretation.taskId,
      status: interpretation.statusProposal,
      evidenceText: input.text,
      sourceMessageId: input.providerMessageId,
    },
    reason: `${employee.name} tarafından gönderilen doğrulanmış görev durum mesajı.`,
    evidence: {
      sourceMessageId: input.providerMessageId,
      interpretation,
    },
    confidence: interpretation.confidence,
    riskLevel:
      interpretation.statusProposal === 'APPOINTMENT_CONFIRMED' ||
      interpretation.statusProposal === 'COMPLETED'
        ? 'MEDIUM'
        : 'LOW',
    containsBindingCommitment:
      interpretation.statusProposal === 'APPOINTMENT_CONFIRMED',
    requestedByType: 'EMPLOYEE',
    requestedById: employee.id,
    idempotencyKey: `employee-message:${input.providerMessageId}:status`,
  });

  const commitmentAction = interpretation.commitment
    ? await proposeManagerAction({
        companyAccountId: input.companyAccountId,
        operationEventId: event.id,
        triggerMessageId: input.providerMessageId,
        action: {
          actionType: 'CREATE_COMMITMENT',
          taskId: interpretation.taskId,
          employeeId: employee.id,
          description: interpretation.commitment.description,
          dueAt: interpretation.commitment.dueAt,
          relativeTimeText:
            interpretation.commitment.relativeTimeText,
          sourceMessageId: input.providerMessageId,
          certainty: interpretation.confidence,
        },
        reason: 'Çalışanın mesajındaki zaman taahhüdü kaydedildi.',
        evidence: {
          sourceMessageId: input.providerMessageId,
          commitment: interpretation.commitment,
        },
        confidence: interpretation.confidence,
        riskLevel: 'LOW',
        requestedByType: 'EMPLOYEE',
        requestedById: employee.id,
        idempotencyKey: `employee-message:${input.providerMessageId}:commitment`,
      })
    : null;

  return {
    routedAs: 'EMPLOYEE' as const,
    interpretation,
    event,
    statusAction,
    commitmentAction,
  };
}
