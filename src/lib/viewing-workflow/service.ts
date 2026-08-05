import 'server-only';

import { createHash } from 'node:crypto';
import {
  Prisma,
  type AppointmentOutcomeType,
  type WhatsAppExpectedResponseType,
  type WhatsAppPromptRecipientType,
} from '@prisma/client';

import prisma from '@/lib/prisma';
import { getCompanyOperationalStatus } from '@/lib/digital-manager/company-guard';
import { recordOperationEvent } from '@/lib/digital-manager/events';
import { transitionTaskInTransaction } from '@/lib/digital-manager/tasks';
import { publicationEligibility } from '@/lib/property-publication';

import { createWorkflowOutboxInTransaction } from './outbox';
import {
  acknowledgementDeadline,
  appointmentOutcomeForAction,
  correlateInteractionPrompt,
  expectedResponseTypesForAction,
  parseAppointmentInstruction,
  parseFollowUpDate,
  parseInteractionReply,
  type InteractionReply,
  type PromptExpectedResponseType,
} from './rules';
import {
  loadViewingWorkflowTimings,
  type ViewingWorkflowTimings,
} from './timing-policy';

const DEFAULT_TIMEZONE = 'Europe/Istanbul';

type Tx = Prisma.TransactionClient;

function shortCode(prefix: 'V' | 'R' | 'S', seed: string) {
  return `${prefix}${createHash('sha256')
    .update(seed)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase()}`;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function phone(value: string | null | undefined) {
  const result = (value || '').replace(/\D/g, '');
  return result.length >= 10 && result.length <= 15 ? result : null;
}

export async function dispatchOutboxes(ids: string[]) {
  if (ids.length === 0) return;
  const { dispatchWhatsAppOutboxMessage } = await import(
    '@/lib/company-whatsapp'
  );
  for (const id of [...new Set(ids)]) {
    await dispatchWhatsAppOutboxMessage(id);
  }
}

export async function ownerRecipient(tx: Tx, companyAccountId: string) {
  const [account, preference, config] = await Promise.all([
    tx.companyAccount.findFirst({
      where: {
        id: companyAccountId,
        status: 'ACTIVE',
        workspaceEnabled: true,
      },
      select: {
        id: true,
        ownerName: true,
        ownerPhoneNormalized: true,
      },
    }),
    tx.managerNotificationPreference.findUnique({
      where: { companyAccountId },
      select: { ownerPhoneNormalized: true },
    }),
    tx.whatsAppConfig.findUnique({
      where: { companyAccountId },
      select: { connectedPhone: true },
    }),
  ]);
  if (!account) throw new Error('Aktif patron hesabı bulunamadı.');
  const ownerPhone =
    phone(preference?.ownerPhoneNormalized) ||
    phone(account.ownerPhoneNormalized);
  return {
    id: account.id,
    name: account.ownerName,
    phone:
      ownerPhone && ownerPhone !== phone(config?.connectedPhone)
        ? ownerPhone
        : null,
  };
}

export async function eligibleMembers(
  tx: Tx,
  companyAccountId: string,
  excludeIds: string[] = []
) {
  return tx.companyMember.findMany({
    where: {
      companyAccountId,
      id: excludeIds.length > 0 ? { notIn: excludeIds } : undefined,
      active: true,
      availability: 'AVAILABLE',
      role: { in: ['MANAGER', 'AGENT'] },
      canReceiveWhatsAppTasks: true,
      phoneNormalized: { not: null },
    },
    select: {
      id: true,
      name: true,
      phoneNormalized: true,
      role: true,
      availability: true,
      specialtyRegions: true,
      maxActiveTaskCapacity: true,
    },
    orderBy: [{ lastAssignedAt: 'asc' }, { createdAt: 'asc' }],
    take: 20,
  });
}

export function candidateSnapshot(
  candidates: Awaited<ReturnType<typeof eligibleMembers>>
) {
  return candidates.map((candidate, index) => ({
    index: index + 1,
    memberId: candidate.id,
    name: candidate.name,
    role: candidate.role,
    availability: candidate.availability,
  }));
}

function snapshotCandidates(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    const index = Number(row.index);
    const memberId = String(row.memberId || '');
    const name = String(row.name || '');
    return index > 0 && memberId && name ? [{ index, memberId, name }] : [];
  });
}

async function validateCoreRelations(
  tx: Tx,
  input: {
    companyAccountId: string;
    conversationId: string;
    contactId: string;
    propertyId: string;
    appointmentRequestId: string;
    memberId?: string | null;
    now: Date;
  }
) {
  const [conversation, contact, property, appointment, member] =
    await Promise.all([
      tx.customerConversation.findFirst({
        where: {
          id: input.conversationId,
          companyAccountId: input.companyAccountId,
        },
        select: { id: true, customerName: true, customerPhone: true },
      }),
      tx.crmContact.findFirst({
        where: { id: input.contactId, companyAccountId: input.companyAccountId },
        select: { id: true, name: true, phoneNormalized: true, phone: true },
      }),
      tx.crmProperty.findFirst({
        where: {
          id: input.propertyId,
          companyAccountId: input.companyAccountId,
          status: { in: ['ACTIVE', 'RESERVED'] },
        },
        select: {
          id: true,
          title: true,
          referenceCode: true,
          location: true,
          companyAccountId: true,
          status: true,
          publicationApprovedAt: true,
          authorityDocumentVerifiedAt: true,
          authorityExpiresAt: true,
          eidsRequired: true,
          eidsVerifiedAt: true,
          eidsVerificationReference: true,
          eidsExemptionReason: true,
          publicationBlockedAt: true,
          price: true,
        },
      }),
      tx.appointmentRequest.findFirst({
        where: {
          id: input.appointmentRequestId,
          companyAccountId: input.companyAccountId,
          conversationId: input.conversationId,
        },
        select: { id: true },
      }),
      input.memberId
        ? tx.companyMember.findFirst({
            where: {
              id: input.memberId,
              companyAccountId: input.companyAccountId,
              active: true,
              canReceiveWhatsAppTasks: true,
              availability: 'AVAILABLE',
              phoneNormalized: { not: null },
            },
            select: { id: true, name: true, phoneNormalized: true },
          })
        : null,
    ]);
  if (!conversation || !contact || !property || !appointment) {
    throw new Error(
      'Gösterim vakası ilişkilerinden biri bu şirkete ait değil veya yayınlanabilir değil.'
    );
  }
  if (input.memberId && !member) {
    throw new Error('Atanacak çalışan bu şirkette uygun değil.');
  }
  const publication = publicationEligibility(property, {
    companyAccountId: input.companyAccountId,
    now: input.now,
  });
  if (!publication.eligible) {
    throw new Error(
      `Gösterim yalnız yayın koşullarını geçen portföy için oluşturulabilir: ${publication.reasons.join(', ')}`
    );
  }
  return { conversation, contact, property, appointment, member };
}

export async function createViewingWorkflow(input: {
  companyAccountId: string;
  conversationId: string;
  contactId: string;
  propertyId: string;
  appointmentRequestId: string;
  provider: string;
  providerMessageId: string;
  customerMessage: string;
  assignedMemberId?: string | null;
  now?: Date;
}) {
  const now = input.now || new Date();
  const seed = `${input.companyAccountId}:${input.provider}:${input.providerMessageId}`;
  const idempotencyKey = `viewing:${input.provider}:${input.providerMessageId}`;
  const outboxIds: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.viewingWorkflow.findUnique({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey,
        },
      },
      include: { assignmentAttempts: true },
    });
    if (existing) {
      existing.assignmentAttempts.forEach((attempt) => {
        if (attempt.outboxMessageId) outboxIds.push(attempt.outboxMessageId);
      });
      return { workflow: existing, duplicate: true };
    }
    const timings = await loadViewingWorkflowTimings(
      input.companyAccountId,
      tx
    );

    let memberId = input.assignedMemberId || null;
    if (!memberId) {
      memberId = (await eligibleMembers(tx, input.companyAccountId))[0]?.id || null;
    }
    if (!memberId) {
      throw new Error('Gösterim talebi için uygun WhatsApp çalışanı bulunamadı.');
    }
    const relations = await validateCoreRelations(tx, {
      ...input,
      memberId,
      now,
    });
    if (!relations.member?.phoneNormalized) {
      throw new Error('Atanacak çalışanın doğrulanmış telefonu bulunamadı.');
    }
    const code = shortCode('V', seed);
    const deal =
      (await tx.crmDeal.findFirst({
        where: {
          companyAccountId: input.companyAccountId,
          contactId: input.contactId,
          propertyId: input.propertyId,
          stage: { notIn: ['WON', 'LOST'] },
        },
        orderBy: { updatedAt: 'desc' },
      })) ||
      (await tx.crmDeal.create({
        data: {
          companyAccountId: input.companyAccountId,
          contactId: input.contactId,
          propertyId: input.propertyId,
          assignedMemberId: memberId,
          title: `${relations.contact.name} · ${relations.property.referenceCode || relations.property.title}`,
          stage: 'VIEWING',
          estimatedValue: relations.property.price,
          probability: 60,
          nextAction: 'Gösterim randevusunu kesinleştir',
        },
      }));
    const task = await tx.crmTask.create({
      data: {
        companyAccountId: input.companyAccountId,
        contactId: input.contactId,
        propertyId: input.propertyId,
        dealId: deal.id,
        assignedMemberId: memberId,
        type: 'VIEWING',
        title: `Gösterim talebi: ${relations.contact.name}`,
        description: input.customerMessage.slice(0, 1500),
        priority: 5,
        status: 'OPEN',
        workflowStatus: 'CREATED',
        sourceConversationId: input.conversationId,
        idempotencyKey: `${idempotencyKey}:task`,
        assignmentReason: 'Müşterinin doğrulanmış gösterim talebi.',
      },
    });
    await transitionTaskInTransaction(tx, {
      companyAccountId: input.companyAccountId,
      taskId: task.id,
      toStatus: 'ASSIGNED',
      evidenceText: 'Uygun çalışan tenant ve görev kapasitesi kurallarıyla seçildi.',
      sourceMessageId: input.providerMessageId,
      actorType: 'RULE_ENGINE',
      actorId: 'viewing-workflow',
      idempotencyKey: `${idempotencyKey}:task-assigned`,
    });
    const workflow = await tx.viewingWorkflow.create({
      data: {
        companyAccountId: input.companyAccountId,
        contactId: input.contactId,
        propertyId: input.propertyId,
        conversationId: input.conversationId,
        crmTaskId: task.id,
        dealId: deal.id,
        initialAppointmentRequestId: input.appointmentRequestId,
        shortCode: code,
        status: 'AWAITING_ASSIGNMENT_SEND',
        idempotencyKey,
        startedAt: now,
      },
    });
    const attempt = await tx.viewingAssignmentAttempt.create({
      data: {
        companyAccountId: input.companyAccountId,
        workflowId: workflow.id,
        taskId: task.id,
        propertyId: input.propertyId,
        contactId: input.contactId,
        memberId,
        sequence: 1,
        status: 'AWAITING_SEND',
        idempotencyKey: `${idempotencyKey}:attempt:1`,
      },
    });
    const propertyLabel =
      relations.property.referenceCode || relations.property.title;
    const content = `[İş #${code}] ${relations.member.name}, ${relations.contact.name} ${propertyLabel} portföyünü görmek istiyor. ${timings.employeeAcknowledgementMinutes} dakika içinde “#${code} KABUL” veya “#${code} RED: neden” yaz.`;
    const outbox = await createWorkflowOutboxInTransaction(tx, {
      companyAccountId: input.companyAccountId,
      toPhone: relations.member.phoneNormalized,
      content,
      recipientType: 'EMPLOYEE',
      recipientId: relations.member.id,
      purpose: 'EMPLOYEE_TASK',
      idempotencyKey: `${idempotencyKey}:attempt:1:outbox`,
      conversationId: input.conversationId,
      contactId: input.contactId,
      propertyId: input.propertyId,
      relatedTaskId: task.id,
      correlationId: workflow.id,
      createdByType: 'VIEWING_WORKFLOW',
      createdById: workflow.id,
      metadata: json({ workflowId: workflow.id, assignmentAttemptId: attempt.id }),
    });
    const prompt = await tx.whatsAppInteractionPrompt.create({
      data: {
        companyAccountId: input.companyAccountId,
        workflowId: workflow.id,
        taskId: task.id,
        propertyId: input.propertyId,
        contactId: input.contactId,
        appointmentRequestId: input.appointmentRequestId,
        assignmentAttemptId: attempt.id,
        recipientType: 'EMPLOYEE',
        recipientId: relations.member.id,
        recipientMemberId: relations.member.id,
        promptType: 'EMPLOYEE_ASSIGNMENT',
        expectedResponseType: 'ASSIGNMENT_ACK',
        shortCode: code,
        outboxMessageId: outbox.id,
        status: 'OPEN',
        idempotencyKey: `${idempotencyKey}:attempt:1:prompt`,
      },
    });
    await tx.viewingAssignmentAttempt.update({
      where: { id: attempt.id },
      data: { outboxMessageId: outbox.id },
    });
    await transitionTaskInTransaction(tx, {
      companyAccountId: input.companyAccountId,
      taskId: task.id,
      toStatus: 'MESSAGE_QUEUED',
      evidenceText: `Çalışan cevap istemi #${code} outbox kuyruğuna yazıldı.`,
      sourceMessageId: `outbox:${outbox.id}`,
      actorType: 'VIEWING_WORKFLOW',
      actorId: workflow.id,
      idempotencyKey: `${idempotencyKey}:task-message-queued`,
    });
    await tx.appointmentRequest.update({
      where: { id: input.appointmentRequestId },
      data: {
        companyAccountId: input.companyAccountId,
        contactId: input.contactId,
        propertyId: input.propertyId,
        assignedMemberId: relations.member.id,
        taskId: task.id,
        dealId: deal.id,
        viewingWorkflowId: workflow.id,
      },
    });
    await tx.companyMember.update({
      where: { id: relations.member.id },
      data: { lastAssignedAt: now },
    });
    await recordOperationEvent(
      {
        companyAccountId: input.companyAccountId,
        eventType: 'TASK_ASSIGNED',
        entityType: 'VIEWING_WORKFLOW',
        entityId: workflow.id,
        actorType: 'RULE_ENGINE',
        actorId: 'viewing-workflow',
        contactId: input.contactId,
        propertyId: input.propertyId,
        taskId: task.id,
        conversationId: input.conversationId,
        sourceProvider: input.provider,
        sourceMessageId: input.providerMessageId,
        metadata: json({
          appointmentRequestId: input.appointmentRequestId,
          assignmentAttemptId: attempt.id,
          promptId: prompt.id,
          memberId: relations.member.id,
        }),
        occurredAt: now,
        idempotencyKey: `${idempotencyKey}:assigned-event`,
      },
      tx
    );
    outboxIds.push(outbox.id);
    return { workflow, duplicate: false };
  });
  await dispatchOutboxes(outboxIds);
  return result;
}

export async function applyViewingDeliveryTransitionInTransaction(
  tx: Tx,
  input: {
    companyAccountId: string;
    outboxMessageId: string;
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
    providerMessageId?: string | null;
    errorMessage?: string | null;
    occurredAt: Date;
  }
) {
  const attempt = await tx.viewingAssignmentAttempt.findFirst({
    where: {
      companyAccountId: input.companyAccountId,
      outboxMessageId: input.outboxMessageId,
    },
    include: { workflow: true },
  });
  const prompt = await tx.whatsAppInteractionPrompt.findFirst({
    where: {
      companyAccountId: input.companyAccountId,
      outboxMessageId: input.outboxMessageId,
    },
  });
  const providerMessageId = input.providerMessageId || null;
  if (input.status === 'FAILED') {
    if (attempt && attempt.status === 'AWAITING_SEND') {
      await tx.viewingAssignmentAttempt.updateMany({
        where: {
          id: attempt.id,
          companyAccountId: input.companyAccountId,
          status: 'AWAITING_SEND',
        },
        data: {
          status: 'DELIVERY_FAILED',
          failureReason: input.errorMessage?.slice(0, 500),
          providerMessageId,
        },
      });
      await tx.viewingWorkflow.updateMany({
        where: {
          id: attempt.workflowId,
          companyAccountId: input.companyAccountId,
          status: 'AWAITING_ASSIGNMENT_SEND',
        },
        data: {
          status: 'FAILED',
          version: { increment: 1 },
          lastError:
            input.errorMessage?.slice(0, 500) ||
            'Çalışan görev mesajı teslim edilemedi.',
        },
      });
    }
    if (prompt?.status === 'OPEN') {
      await tx.whatsAppInteractionPrompt.updateMany({
        where: { id: prompt.id, status: 'OPEN' },
        data: { status: 'CANCELLED', expiresAt: input.occurredAt },
      });
      if (prompt.appointmentRequestId) {
        await tx.notification.upsert({
          where: {
            companyAccountId_recipientKey_dedupeKey: {
              companyAccountId: input.companyAccountId,
              recipientKey: 'OWNER',
              dedupeKey: `appointment:${prompt.appointmentRequestId}:prompt-delivery-failed:${prompt.id}`,
            },
          },
          update: {},
          create: {
            companyAccountId: input.companyAccountId,
            recipientKey: 'OWNER',
            type: 'SYSTEM',
            title: 'Randevu WhatsApp mesajı gönderilemedi',
            message:
              input.errorMessage?.slice(0, 500) ||
              'Çalışan veya patron bu mesaj için cevapsız kabul edilmedi; bağlantıyı kontrol edin.',
            link: '/fabrika/whatsapp',
            important: true,
            dedupeKey: `appointment:${prompt.appointmentRequestId}:prompt-delivery-failed:${prompt.id}`,
            metadata: JSON.stringify({
              appointmentRequestId: prompt.appointmentRequestId,
              promptId: prompt.id,
            }),
          },
        });
      }
    }
    return;
  }

  const timings = await loadViewingWorkflowTimings(
    input.companyAccountId,
    tx
  );
  const deadline = acknowledgementDeadline(
    input.occurredAt,
    timings.employeeAcknowledgementMinutes
  );
  if (attempt?.status === 'AWAITING_SEND') {
    const changed = await tx.viewingAssignmentAttempt.updateMany({
      where: {
        id: attempt.id,
        companyAccountId: input.companyAccountId,
        status: 'AWAITING_SEND',
      },
      data: {
        status: 'AWAITING_ACK',
        sentAt: input.occurredAt,
        deliveredAt:
          input.status === 'DELIVERED' || input.status === 'READ'
            ? input.occurredAt
            : undefined,
        ackDeadlineAt: deadline,
        providerMessageId,
      },
    });
    if (changed.count === 1) {
      await tx.viewingWorkflow.updateMany({
        where: {
          id: attempt.workflowId,
          companyAccountId: input.companyAccountId,
          status: 'AWAITING_ASSIGNMENT_SEND',
        },
        data: {
          status: 'AWAITING_EMPLOYEE_ACK',
          version: { increment: 1 },
        },
      });
      await tx.crmTask.updateMany({
        where: {
          id: attempt.taskId,
          companyAccountId: input.companyAccountId,
          status: 'OPEN',
        },
        data: { dueAt: deadline },
      });
    }
  } else if (
    attempt?.status === 'AWAITING_ACK' &&
    (input.status === 'DELIVERED' || input.status === 'READ')
  ) {
    await tx.viewingAssignmentAttempt.updateMany({
      where: { id: attempt.id, status: 'AWAITING_ACK' },
      data: {
        deliveredAt: attempt.deliveredAt || input.occurredAt,
        providerMessageId,
      },
    });
  }
  if (prompt?.status === 'OPEN') {
    await tx.whatsAppInteractionPrompt.updateMany({
      where: { id: prompt.id, status: 'OPEN' },
      data: {
        sentProviderMessageId: providerMessageId,
        deadlineAt: prompt.deadlineAt || deadline,
        expiresAt: prompt.expiresAt || deadline,
      },
    });
    if (prompt.appointmentRequestId) {
      if (prompt.promptType === 'EMPLOYEE_APPOINTMENT_CONFIRMATION') {
        await tx.appointmentRequest.updateMany({
          where: {
            id: prompt.appointmentRequestId,
            companyAccountId: input.companyAccountId,
          },
          data: {
            employeeReminderSentAt:
              prompt.reminderCount === 0 ? input.occurredAt : undefined,
            employeeConfirmationDueAt: deadline,
          },
        });
      } else if (prompt.promptType === 'EMPLOYEE_APPOINTMENT_OUTCOME') {
        await tx.appointmentRequest.updateMany({
          where: {
            id: prompt.appointmentRequestId,
            companyAccountId: input.companyAccountId,
          },
          data: {
            outcomePromptSentAt:
              prompt.reminderCount === 0 ? input.occurredAt : undefined,
          },
        });
      }
    }
  }
}

export async function ownerDecisionPrompt(
  tx: Tx,
  input: {
    companyAccountId: string;
    workflowId: string;
    attemptId: string;
    now: Date;
    reason: string;
    idempotencySuffix: string;
    appointmentRequestId?: string | null;
    promptType?: 'OWNER_REASSIGNMENT' | 'OWNER_APPOINTMENT_ESCALATION';
    timings?: ViewingWorkflowTimings;
  }
) {
  const timings =
    input.timings ||
    (await loadViewingWorkflowTimings(input.companyAccountId, tx));
  const workflow = await tx.viewingWorkflow.findFirstOrThrow({
    where: { id: input.workflowId, companyAccountId: input.companyAccountId },
    include: {
      contact: { select: { name: true } },
      property: { select: { title: true, referenceCode: true } },
      crmTask: { select: { id: true, assignedMemberId: true } },
      assignmentAttempts: {
        select: { memberId: true },
      },
    },
  });
  const attemptedIds = workflow.assignmentAttempts.map(({ memberId }) => memberId);
  const candidates = await eligibleMembers(tx, input.companyAccountId, attemptedIds);
  const snapshot = candidateSnapshot(candidates);
  const owner = await ownerRecipient(tx, input.companyAccountId);
  const previous = await tx.viewingAssignmentAttempt.findFirstOrThrow({
    where: { id: input.attemptId, companyAccountId: input.companyAccountId },
    include: { member: { select: { name: true } } },
  });
  const candidateText =
    snapshot.length > 0
      ? snapshot.map((entry) => `${entry.index}) ${entry.name}`).join(', ')
      : 'uygun yedek çalışan yok';
  const propertyLabel = workflow.property.referenceCode || workflow.property.title;
  const content = `[İş #${workflow.shortCode}] ${previous.member.name} ${input.reason}. ${propertyLabel} portföyünü görmek isteyen ${workflow.contact.name} bekliyor. Uygun çalışanlar: ${candidateText}. “#${workflow.shortCode} 1'E ATA”, “#${workflow.shortCode} BEKLE” veya “#${workflow.shortCode} İPTAL” yaz.`;
  const prompt = await tx.whatsAppInteractionPrompt.upsert({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: input.companyAccountId,
        idempotencyKey: `viewing:${workflow.id}:owner:${input.idempotencySuffix}`,
      },
    },
    update: {},
    create: {
      companyAccountId: input.companyAccountId,
      workflowId: workflow.id,
      taskId: workflow.crmTaskId,
      propertyId: workflow.propertyId,
      contactId: workflow.contactId,
      appointmentRequestId: input.appointmentRequestId,
      assignmentAttemptId: previous.id,
      recipientType: 'OWNER',
      recipientId: owner.id,
      promptType: input.promptType || 'OWNER_REASSIGNMENT',
      expectedResponseType: 'OWNER_REASSIGNMENT_DECISION',
      shortCode: workflow.shortCode,
      candidateMemberSnapshot: json(snapshot),
      status: 'OPEN',
      deadlineAt: new Date(
        input.now.getTime() + timings.ownerEscalationMinutes * 60_000
      ),
      expiresAt: new Date(input.now.getTime() + 24 * 60 * 60_000),
      idempotencyKey: `viewing:${workflow.id}:owner:${input.idempotencySuffix}`,
    },
  });
  let outboxId: string | null = null;
  if (owner.phone) {
    const outbox = await createWorkflowOutboxInTransaction(tx, {
      companyAccountId: input.companyAccountId,
      toPhone: owner.phone,
      content,
      recipientType: 'OWNER',
      recipientId: owner.id,
      purpose: 'VIEWING_OWNER_DECISION',
      idempotencyKey: `viewing:${workflow.id}:owner:${input.idempotencySuffix}:outbox`,
      contactId: workflow.contactId,
      propertyId: workflow.propertyId,
      relatedTaskId: workflow.crmTaskId,
      correlationId: prompt.id,
      createdByType: 'VIEWING_WORKFLOW',
      createdById: workflow.id,
      metadata: json({ workflowId: workflow.id, promptId: prompt.id }),
    });
    outboxId = outbox.id;
    await tx.whatsAppInteractionPrompt.updateMany({
      where: { id: prompt.id, outboxMessageId: null },
      data: { outboxMessageId: outbox.id },
    });
  }
  await tx.notification.upsert({
    where: {
      companyAccountId_recipientKey_dedupeKey: {
        companyAccountId: input.companyAccountId,
        recipientKey: 'OWNER',
        dedupeKey: `viewing:${workflow.id}:owner:${input.idempotencySuffix}`,
      },
    },
    update: {},
    create: {
      companyAccountId: input.companyAccountId,
      recipientKey: 'OWNER',
      type: 'SYSTEM',
      title: 'Gösterim görevi yeniden atama bekliyor',
      message: content,
      link: '/fabrika',
      important: true,
      dedupeKey: `viewing:${workflow.id}:owner:${input.idempotencySuffix}`,
      metadata: JSON.stringify({ workflowId: workflow.id, promptId: prompt.id }),
    },
  });
  return { prompt, outboxId };
}

export async function processDueViewingAcknowledgements(now = new Date()) {
  const candidates = await prisma.viewingAssignmentAttempt.findMany({
    where: {
      status: 'AWAITING_ACK',
      ackDeadlineAt: { not: null, lte: now },
    },
    select: { id: true, companyAccountId: true },
    orderBy: { ackDeadlineAt: 'asc' },
    take: 200,
  });
  const outboxIds: string[] = [];
  const results: Array<{ attemptId: string; status: string }> = [];
  for (const candidate of candidates) {
    const result = await prisma.$transaction(async (tx) => {
      const operational = await getCompanyOperationalStatus(
        candidate.companyAccountId,
        tx,
        now
      );
      if (!operational.allowed) {
        return `SKIPPED_${operational.reason}`;
      }
      const timings = await loadViewingWorkflowTimings(
        candidate.companyAccountId,
        tx
      );
      const attempt = await tx.viewingAssignmentAttempt.findFirst({
        where: {
          id: candidate.id,
          companyAccountId: candidate.companyAccountId,
          status: 'AWAITING_ACK',
          ackDeadlineAt: { not: null, lte: now },
        },
      });
      if (!attempt) return 'SKIPPED';
      const claimed = await tx.viewingAssignmentAttempt.updateMany({
        where: {
          id: attempt.id,
          companyAccountId: attempt.companyAccountId,
          status: 'AWAITING_ACK',
          ackDeadlineAt: attempt.ackDeadlineAt,
        },
        data: { status: 'TIMED_OUT', answeredAt: now },
      });
      if (claimed.count !== 1) return 'SKIPPED';
      await tx.whatsAppInteractionPrompt.updateMany({
        where: {
          companyAccountId: attempt.companyAccountId,
          assignmentAttemptId: attempt.id,
          status: 'OPEN',
        },
        data: { status: 'EXPIRED', expiresAt: now },
      });
      await tx.viewingWorkflow.updateMany({
        where: {
          id: attempt.workflowId,
          companyAccountId: attempt.companyAccountId,
          status: 'AWAITING_EMPLOYEE_ACK',
        },
        data: {
          status: 'AWAITING_OWNER_DECISION',
          version: { increment: 1 },
        },
      });
      await transitionTaskInTransaction(tx, {
        companyAccountId: attempt.companyAccountId,
        taskId: attempt.taskId,
        toStatus: 'REASSIGNMENT_REQUIRED',
        evidenceText: `Çalışan gerçek teslimattan sonraki ${timings.employeeAcknowledgementMinutes} dakika içinde cevap vermedi.`,
        sourceMessageId: `timeout:${attempt.id}`,
        actorType: 'SCHEDULER',
        actorId: 'viewing-ack-monitor',
        idempotencyKey: `viewing:${attempt.workflowId}:attempt:${attempt.sequence}:timeout`,
      });
      const ownerPrompt = await ownerDecisionPrompt(tx, {
        companyAccountId: attempt.companyAccountId,
        workflowId: attempt.workflowId,
        attemptId: attempt.id,
        now,
        reason: `${timings.employeeAcknowledgementMinutes} dakika içinde cevap vermedi`,
        idempotencySuffix: `attempt-${attempt.sequence}-timeout`,
        timings,
      });
      if (ownerPrompt.outboxId) outboxIds.push(ownerPrompt.outboxId);
      return 'TIMED_OUT';
    });
    results.push({ attemptId: candidate.id, status: result });
  }
  await dispatchOutboxes(outboxIds);
  return results;
}

function promptCompatibility(
  prompts: Array<{
    id: string;
    shortCode: string;
    recipientId: string;
    expectedResponseType: WhatsAppExpectedResponseType;
    sentProviderMessageId: string | null;
    status: 'OPEN' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED';
  }>,
  input: {
    recipientId: string;
    action: InteractionReply['action'];
    text: string;
    quotedProviderMessageId?: string | null;
  }
) {
  const expected = expectedResponseTypesForAction(input.action);
  const results = expected.flatMap((expectedResponseType) => {
    const result = correlateInteractionPrompt({
      prompts,
      recipientId: input.recipientId,
      expectedResponseType,
      text: input.text,
      quotedProviderMessageId: input.quotedProviderMessageId,
    });
    return result.prompt ? [{ ...result, expectedResponseType }] : [];
  });
  const unique = new Map(results.map((result) => [result.prompt.id, result]));
  if (unique.size === 1) return [...unique.values()][0];
  return null;
}

export async function processViewingInteractionReply(input: {
  companyAccountId: string;
  recipientType: WhatsAppPromptRecipientType;
  recipientId: string;
  text: string;
  provider: string;
  providerMessageId: string;
  quotedProviderMessageId?: string | null;
  receivedAt?: Date;
}) {
  const now = input.receivedAt || new Date();
  const parsed = parseInteractionReply(input.text);
  const appointmentInstruction =
    input.recipientType === 'EMPLOYEE'
      ? parseAppointmentInstruction(input.text, DEFAULT_TIMEZONE)
      : null;
  const openPrompts = await prisma.whatsAppInteractionPrompt.findMany({
    where: {
      companyAccountId: input.companyAccountId,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      status: 'OPEN',
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      shortCode: true,
      recipientId: true,
      expectedResponseType: true,
      sentProviderMessageId: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  if (appointmentInstruction) {
    return createAppointmentFromEmployeeInstruction({
      ...input,
      instruction: appointmentInstruction,
      now,
    });
  }
  if (parsed.action === 'UNKNOWN') return { handled: false as const };
  const correlated = promptCompatibility(openPrompts, {
    recipientId: input.recipientId,
    action: parsed.action,
    text: input.text,
    quotedProviderMessageId: input.quotedProviderMessageId,
  });
  if (!correlated) {
    return {
      handled: true as const,
      mutated: false,
      clarificationRequired: true,
      openPrompts: openPrompts.map((prompt) => ({
        shortCode: prompt.shortCode,
        type: prompt.expectedResponseType,
      })),
    };
  }
  const promptId = correlated.prompt.id;
  const outboxIds: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    const prompt = await tx.whatsAppInteractionPrompt.findFirst({
      where: {
        id: promptId,
        companyAccountId: input.companyAccountId,
        recipientType: input.recipientType,
        recipientId: input.recipientId,
        status: 'OPEN',
      },
      include: {
        workflow: true,
        assignmentAttempt: true,
        appointmentRequest: true,
      },
    });
    if (!prompt) {
      return { handled: true as const, mutated: false, duplicate: true };
    }
    const duplicateReply = await tx.whatsAppInteractionPrompt.findFirst({
      where: {
        companyAccountId: input.companyAccountId,
        lastReplyProviderMessageId: input.providerMessageId,
      },
      select: { id: true },
    });
    if (duplicateReply) {
      return { handled: true as const, mutated: false, duplicate: true };
    }
    return applyLoadedPromptReply(tx, {
      prompt,
      parsed,
      providerMessageId: input.providerMessageId,
      now,
      outboxIds,
    });
  });
  await dispatchOutboxes(outboxIds);
  return result;
}

async function applyLoadedPromptReply(
  tx: Tx,
  input: {
    prompt: LoadedPrompt;
    parsed: InteractionReply;
    providerMessageId: string;
    now: Date;
    outboxIds: string[];
  }
) {
  if (input.prompt.expectedResponseType === 'ASSIGNMENT_ACK') {
    return applyAssignmentReply(tx, input);
  }
  if (input.prompt.expectedResponseType === 'OWNER_REASSIGNMENT_DECISION') {
    return applyOwnerReassignmentReply(tx, input);
  }
  if (input.prompt.expectedResponseType === 'APPOINTMENT_CONFIRMATION') {
    return applyAppointmentConfirmationReply(tx, input);
  }
  if (input.prompt.expectedResponseType === 'APPOINTMENT_OUTCOME') {
    return applyAppointmentOutcomeReply(tx, input);
  }
  return applySaleDecisionReply(tx, input);
}

export async function processViewingPanelDecision(input: {
  companyAccountId: string;
  ownerId: string;
  promptId: string;
  action: 'REASSIGN' | 'WAIT' | 'CANCEL' | 'REMOVE' | 'KEEP' | 'DETAIL';
  candidateIndex?: number | null;
  reason?: string | null;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now || new Date();
  const providerMessageId = `panel:${input.idempotencyKey}`;
  const parsed: InteractionReply = {
    shortCode: null,
    action:
      input.action === 'REMOVE'
        ? 'REMOVE_SOLD_PROPERTY'
        : input.action === 'KEEP'
          ? 'KEEP_PROPERTY'
          : input.action,
    candidateIndex:
      input.action === 'REASSIGN' ? input.candidateIndex || null : null,
    reason: input.reason?.trim().slice(0, 500) || null,
  };
  const compatible = expectedResponseTypesForAction(parsed.action);
  const outboxIds: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    const prompt = await tx.whatsAppInteractionPrompt.findFirst({
      where: {
        id: input.promptId,
        companyAccountId: input.companyAccountId,
        recipientType: 'OWNER',
        recipientId: input.ownerId,
        status: 'OPEN',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        workflow: true,
        assignmentAttempt: true,
        appointmentRequest: true,
      },
    });
    if (!prompt) {
      return { handled: true as const, mutated: false, stale: true };
    }
    if (!compatible.includes(prompt.expectedResponseType)) {
      return {
        handled: true as const,
        mutated: false,
        clarificationRequired: true,
      };
    }
    const duplicate = await tx.whatsAppInteractionPrompt.findFirst({
      where: {
        companyAccountId: input.companyAccountId,
        lastReplyProviderMessageId: providerMessageId,
      },
      select: { id: true },
    });
    if (duplicate) {
      return { handled: true as const, mutated: false, duplicate: true };
    }
    return applyLoadedPromptReply(tx, {
      prompt,
      parsed,
      providerMessageId,
      now,
      outboxIds,
    });
  });
  await dispatchOutboxes(outboxIds);
  return result;
}

type LoadedPrompt = Prisma.WhatsAppInteractionPromptGetPayload<{
  include: {
    workflow: true;
    assignmentAttempt: true;
    appointmentRequest: true;
  };
}>;

async function answerPrompt(
  tx: Tx,
  prompt: LoadedPrompt,
  providerMessageId: string,
  now: Date,
  status: 'ANSWERED' | 'CANCELLED' = 'ANSWERED'
) {
  const changed = await tx.whatsAppInteractionPrompt.updateMany({
    where: { id: prompt.id, status: 'OPEN' },
    data: {
      status,
      lastReplyProviderMessageId: providerMessageId,
      answeredAt: now,
    },
  });
  return changed.count === 1;
}

async function applyAssignmentReply(
  tx: Tx,
  input: {
    prompt: LoadedPrompt;
    parsed: InteractionReply;
    providerMessageId: string;
    now: Date;
    outboxIds: string[];
  }
) {
  const attempt = input.prompt.assignmentAttempt;
  const workflow = input.prompt.workflow;
  if (
    !attempt ||
    !workflow ||
    attempt.status !== 'AWAITING_ACK' ||
    attempt.companyAccountId !== workflow.companyAccountId ||
    attempt.memberId !== input.prompt.recipientId ||
    input.prompt.recipientMemberId !== attempt.memberId
  ) {
    await answerPrompt(tx, input.prompt, input.providerMessageId, input.now, 'CANCELLED');
    return { handled: true as const, mutated: false, stale: true };
  }
  if (!['ACCEPT', 'REJECT'].includes(input.parsed.action)) {
    return { handled: true as const, mutated: false, clarificationRequired: true };
  }
  const answered = await answerPrompt(
    tx,
    input.prompt,
    input.providerMessageId,
    input.now
  );
  if (!answered) return { handled: true as const, mutated: false, duplicate: true };

  if (input.parsed.action === 'ACCEPT') {
    const confirmedAppointment = input.prompt.appointmentRequest?.startAt
      ? input.prompt.appointmentRequest
      : null;
    await tx.viewingAssignmentAttempt.updateMany({
      where: { id: attempt.id, status: 'AWAITING_ACK' },
      data: {
        status: 'ACCEPTED',
        answeredAt: input.now,
        responseProviderMessageId: input.providerMessageId,
      },
    });
    await tx.viewingWorkflow.updateMany({
      where: {
        id: workflow.id,
        companyAccountId: workflow.companyAccountId,
        status: 'AWAITING_EMPLOYEE_ACK',
      },
      data: {
        status: confirmedAppointment
          ? 'APPOINTMENT_CONFIRMED'
          : 'ASSIGNMENT_ACCEPTED',
        version: { increment: 1 },
      },
    });
    await transitionTaskInTransaction(tx, {
      companyAccountId: workflow.companyAccountId,
      taskId: workflow.crmTaskId,
      toStatus: 'ACCEPTED',
      evidenceText: `Çalışan #${workflow.shortCode} işini kabul etti.`,
      sourceMessageId: input.providerMessageId,
      actorType: 'EMPLOYEE',
      actorId: input.prompt.recipientId,
      idempotencyKey: `viewing:${workflow.id}:accepted:${input.providerMessageId}`,
    });
    if (confirmedAppointment) {
      await transitionTaskInTransaction(tx, {
        companyAccountId: workflow.companyAccountId,
        taskId: workflow.crmTaskId,
        toStatus: 'APPOINTMENT_CONFIRMED',
        evidenceText: `#${confirmedAppointment.shortCode || workflow.shortCode} randevusu yeni çalışan tarafından devralındı.`,
        sourceMessageId: input.providerMessageId,
        actorType: 'EMPLOYEE',
        actorId: input.prompt.recipientId,
        idempotencyKey: `viewing:${workflow.id}:appointment-reaccepted:${input.providerMessageId}`,
      });
    }
    return { handled: true as const, mutated: true, action: 'ACCEPTED' };
  }

  await tx.viewingAssignmentAttempt.updateMany({
    where: { id: attempt.id, status: 'AWAITING_ACK' },
    data: {
      status: 'REJECTED',
      answeredAt: input.now,
      responseProviderMessageId: input.providerMessageId,
      failureReason: input.parsed.reason?.slice(0, 500) || 'Çalışan görevi reddetti.',
    },
  });
  await tx.viewingWorkflow.updateMany({
    where: { id: workflow.id, companyAccountId: workflow.companyAccountId },
    data: { status: 'AWAITING_OWNER_DECISION', version: { increment: 1 } },
  });
  await transitionTaskInTransaction(tx, {
    companyAccountId: workflow.companyAccountId,
    taskId: workflow.crmTaskId,
    toStatus: 'REJECTED',
    evidenceText: input.parsed.reason || 'Çalışan gösterim görevini reddetti.',
    sourceMessageId: input.providerMessageId,
    actorType: 'EMPLOYEE',
    actorId: input.prompt.recipientId,
    idempotencyKey: `viewing:${workflow.id}:rejected:${input.providerMessageId}`,
  });
  await transitionTaskInTransaction(tx, {
    companyAccountId: workflow.companyAccountId,
    taskId: workflow.crmTaskId,
    toStatus: 'REASSIGNMENT_REQUIRED',
    evidenceText: 'Reddedilen gösterim görevi patronun yeniden atamasını bekliyor.',
    sourceMessageId: input.providerMessageId,
    actorType: 'VIEWING_WORKFLOW',
    actorId: workflow.id,
    idempotencyKey: `viewing:${workflow.id}:reassignment-required:${input.providerMessageId}`,
  });
  const ownerPrompt = await ownerDecisionPrompt(tx, {
    companyAccountId: workflow.companyAccountId,
    workflowId: workflow.id,
    attemptId: attempt.id,
    now: input.now,
    reason: `görevi reddetti${input.parsed.reason ? `: ${input.parsed.reason}` : ''}`,
    idempotencySuffix: `attempt-${attempt.sequence}-rejected`,
  });
  if (ownerPrompt.outboxId) input.outboxIds.push(ownerPrompt.outboxId);
  return { handled: true as const, mutated: true, action: 'REJECTED' };
}

async function applyOwnerReassignmentReply(
  tx: Tx,
  input: {
    prompt: LoadedPrompt;
    parsed: InteractionReply;
    providerMessageId: string;
    now: Date;
    outboxIds: string[];
  }
) {
  const workflow = input.prompt.workflow;
  if (!workflow) return { handled: true as const, mutated: false, stale: true };
  if (input.parsed.action === 'WAIT') {
    const answered = await answerPrompt(tx, input.prompt, input.providerMessageId, input.now);
    if (!answered) return { handled: true as const, mutated: false, duplicate: true };
    const owner = await ownerRecipient(tx, workflow.companyAccountId);
    const timings = await loadViewingWorkflowTimings(
      workflow.companyAccountId,
      tx
    );
    const retryPrompt = await tx.whatsAppInteractionPrompt.create({
      data: {
        companyAccountId: workflow.companyAccountId,
        workflowId: workflow.id,
        taskId: workflow.crmTaskId,
        propertyId: workflow.propertyId,
        contactId: workflow.contactId,
        assignmentAttemptId: input.prompt.assignmentAttemptId,
        recipientType: 'OWNER',
        recipientId: owner.id,
        promptType: 'OWNER_REASSIGNMENT',
        expectedResponseType: 'OWNER_REASSIGNMENT_DECISION',
        shortCode: workflow.shortCode,
        candidateMemberSnapshot: input.prompt.candidateMemberSnapshot || undefined,
        status: 'OPEN',
        deadlineAt: new Date(
          input.now.getTime() + timings.ownerEscalationMinutes * 60_000
        ),
        expiresAt: new Date(input.now.getTime() + 24 * 60 * 60_000),
        idempotencyKey: `viewing:${workflow.id}:owner-wait:${input.providerMessageId}`,
      },
    });
    if (owner.phone) {
      const outbox = await createWorkflowOutboxInTransaction(tx, {
        companyAccountId: workflow.companyAccountId,
        toPhone: owner.phone,
        content: `[İş #${workflow.shortCode}] Yeniden atama kararı hâlâ bekliyor. Bir çalışan seçin veya “#${workflow.shortCode} İPTAL” yazın.`,
        recipientType: 'OWNER',
        recipientId: owner.id,
        purpose: 'VIEWING_OWNER_DECISION_REMINDER',
        idempotencyKey: `viewing:${workflow.id}:owner-wait:${input.providerMessageId}:outbox`,
        relatedTaskId: workflow.crmTaskId,
        propertyId: workflow.propertyId,
        contactId: workflow.contactId,
        correlationId: retryPrompt.id,
        createdByType: 'VIEWING_WORKFLOW',
        createdById: workflow.id,
        nextAttemptAt: new Date(
          input.now.getTime() + timings.ownerEscalationMinutes * 60_000
        ),
      });
      await tx.whatsAppInteractionPrompt.update({
        where: { id: retryPrompt.id },
        data: { outboxMessageId: outbox.id },
      });
      input.outboxIds.push(outbox.id);
    }
    return { handled: true as const, mutated: true, action: 'WAIT' };
  }
  if (input.parsed.action === 'CANCEL') {
    const answered = await answerPrompt(tx, input.prompt, input.providerMessageId, input.now);
    if (!answered) return { handled: true as const, mutated: false, duplicate: true };
    await tx.viewingWorkflow.updateMany({
      where: { id: workflow.id, companyAccountId: workflow.companyAccountId },
      data: { status: 'CANCELLED', cancelledAt: input.now, version: { increment: 1 } },
    });
    await tx.appointmentRequest.updateMany({
      where: { viewingWorkflowId: workflow.id, companyAccountId: workflow.companyAccountId },
      data: { status: 'CANCELLED', cancelledAt: input.now },
    });
    await transitionTaskInTransaction(tx, {
      companyAccountId: workflow.companyAccountId,
      taskId: workflow.crmTaskId,
      toStatus: 'CANCELLED',
      evidenceText: input.parsed.reason || 'Patron gösterim görevini iptal etti.',
      sourceMessageId: input.providerMessageId,
      actorType: 'OWNER',
      actorId: input.prompt.recipientId,
      idempotencyKey: `viewing:${workflow.id}:cancelled:${input.providerMessageId}`,
    });
    await tx.crmTask.create({
      data: {
        companyAccountId: workflow.companyAccountId,
        contactId: workflow.contactId,
        propertyId: workflow.propertyId,
        type: 'FOLLOW_UP',
        title: 'İptal edilen gösterim için müşteriye dönüş yap',
        description: input.parsed.reason || 'Yeni saat veya alternatif portföy önerin.',
        dueAt: new Date(input.now.getTime() + 60 * 60_000),
        priority: 4,
        idempotencyKey: `viewing:${workflow.id}:cancel-follow-up`,
      },
    });
    return { handled: true as const, mutated: true, action: 'CANCELLED' };
  }
  if (input.parsed.action !== 'REASSIGN' || !input.parsed.candidateIndex) {
    return { handled: true as const, mutated: false, clarificationRequired: true };
  }
  const snapshot = snapshotCandidates(input.prompt.candidateMemberSnapshot);
  const selected = snapshot.find(({ index }) => index === input.parsed.candidateIndex);
  if (!selected) {
    return { handled: true as const, mutated: false, clarificationRequired: true };
  }
  const member = await tx.companyMember.findFirst({
    where: {
      id: selected.memberId,
      companyAccountId: workflow.companyAccountId,
      active: true,
      availability: 'AVAILABLE',
      canReceiveWhatsAppTasks: true,
      phoneNormalized: { not: null },
    },
    select: { id: true, name: true, phoneNormalized: true },
  });
  if (!member?.phoneNormalized) {
    return { handled: true as const, mutated: false, clarificationRequired: true };
  }
  const answered = await answerPrompt(tx, input.prompt, input.providerMessageId, input.now);
  if (!answered) return { handled: true as const, mutated: false, duplicate: true };
  const attempts = await tx.viewingAssignmentAttempt.findMany({
    where: { workflowId: workflow.id, companyAccountId: workflow.companyAccountId },
    orderBy: { sequence: 'desc' },
    take: 1,
  });
  const previous = attempts[0];
  if (!previous) throw new Error('Önceki gösterim ataması bulunamadı.');
  await tx.viewingAssignmentAttempt.updateMany({
    where: {
      id: previous.id,
      status: { in: ['AWAITING_SEND', 'AWAITING_ACK'] },
    },
    data: { status: 'SUPERSEDED', answeredAt: input.now },
  });
  const sequence = previous.sequence + 1;
  const attempt = await tx.viewingAssignmentAttempt.create({
    data: {
      companyAccountId: workflow.companyAccountId,
      workflowId: workflow.id,
      taskId: workflow.crmTaskId,
      propertyId: workflow.propertyId,
      contactId: workflow.contactId,
      memberId: member.id,
      sequence,
      previousAttemptId: previous.id,
      status: 'AWAITING_SEND',
      idempotencyKey: `viewing:${workflow.id}:attempt:${sequence}`,
    },
  });
  const details = await tx.viewingWorkflow.findFirstOrThrow({
    where: { id: workflow.id, companyAccountId: workflow.companyAccountId },
    include: {
      contact: { select: { name: true } },
      property: { select: { title: true, referenceCode: true } },
    },
  });
  const timings = await loadViewingWorkflowTimings(
    workflow.companyAccountId,
    tx
  );
  const propertyLabel = details.property.referenceCode || details.property.title;
  const content = `[İş #${workflow.shortCode}] ${member.name}, ${details.contact.name} ${propertyLabel} portföyünü görmek istiyor. ${timings.employeeAcknowledgementMinutes} dakika içinde “#${workflow.shortCode} KABUL” veya “#${workflow.shortCode} RED: neden” yaz.`;
  const outbox = await createWorkflowOutboxInTransaction(tx, {
    companyAccountId: workflow.companyAccountId,
    toPhone: member.phoneNormalized,
    content,
    recipientType: 'EMPLOYEE',
    recipientId: member.id,
    purpose: 'EMPLOYEE_TASK',
    idempotencyKey: `viewing:${workflow.id}:attempt:${sequence}:outbox`,
    conversationId: details.conversationId,
    contactId: workflow.contactId,
    propertyId: workflow.propertyId,
    relatedTaskId: workflow.crmTaskId,
    correlationId: workflow.id,
    createdByType: 'VIEWING_WORKFLOW',
    createdById: workflow.id,
    metadata: json({ workflowId: workflow.id, assignmentAttemptId: attempt.id }),
  });
  await tx.whatsAppInteractionPrompt.create({
    data: {
      companyAccountId: workflow.companyAccountId,
      workflowId: workflow.id,
      taskId: workflow.crmTaskId,
      propertyId: workflow.propertyId,
      contactId: workflow.contactId,
      assignmentAttemptId: attempt.id,
      appointmentRequestId: input.prompt.appointmentRequestId,
      recipientType: 'EMPLOYEE',
      recipientId: member.id,
      recipientMemberId: member.id,
      promptType: 'EMPLOYEE_ASSIGNMENT',
      expectedResponseType: 'ASSIGNMENT_ACK',
      shortCode: workflow.shortCode,
      outboxMessageId: outbox.id,
      status: 'OPEN',
      idempotencyKey: `viewing:${workflow.id}:attempt:${sequence}:prompt`,
    },
  });
  await tx.viewingAssignmentAttempt.update({
    where: { id: attempt.id },
    data: { outboxMessageId: outbox.id },
  });
  const task = await tx.crmTask.findFirstOrThrow({
    where: { id: workflow.crmTaskId, companyAccountId: workflow.companyAccountId },
  });
  const taskUpdated = await tx.crmTask.updateMany({
    where: {
      id: task.id,
      companyAccountId: workflow.companyAccountId,
      workflowVersion: task.workflowVersion,
      workflowStatus: 'REASSIGNMENT_REQUIRED',
    },
    data: {
      assignedMemberId: member.id,
      workflowVersion: { increment: 1 },
      dueAt: null,
      failureReason: null,
      failedAt: null,
    },
  });
  if (taskUpdated.count !== 1) {
    throw new Error('Görev eşzamanlı başka bir işlemle değişti.');
  }
  await transitionTaskInTransaction(tx, {
    companyAccountId: workflow.companyAccountId,
    taskId: workflow.crmTaskId,
    toStatus: 'ASSIGNED',
    evidenceText: `#${workflow.shortCode} ${member.name} kişisine yeniden atandı.`,
    sourceMessageId: input.providerMessageId,
    actorType: 'OWNER',
    actorId: input.prompt.recipientId,
    idempotencyKey: `viewing:${workflow.id}:reassigned:${input.providerMessageId}:assigned`,
    expectedFromStatus: 'REASSIGNMENT_REQUIRED',
    expectedWorkflowVersion: task.workflowVersion + 1,
  });
  await transitionTaskInTransaction(tx, {
    companyAccountId: workflow.companyAccountId,
    taskId: workflow.crmTaskId,
    toStatus: 'MESSAGE_QUEUED',
    evidenceText: `#${workflow.shortCode} yeni çalışan mesajı outbox kuyruğuna alındı.`,
    sourceMessageId: input.providerMessageId,
    actorType: 'VIEWING_WORKFLOW',
    actorId: workflow.id,
    idempotencyKey: `viewing:${workflow.id}:reassigned:${input.providerMessageId}:queued`,
  });
  await tx.viewingWorkflow.updateMany({
    where: { id: workflow.id, companyAccountId: workflow.companyAccountId },
    data: { status: 'AWAITING_ASSIGNMENT_SEND', version: { increment: 1 } },
  });
  await tx.appointmentRequest.updateMany({
    where: { viewingWorkflowId: workflow.id, companyAccountId: workflow.companyAccountId },
    data: {
      assignedMemberId: member.id,
      employeeReminderSentAt: null,
      employeeReminderCount: 0,
      employeeConfirmationDueAt: null,
      employeeConfirmationEscalatedAt: null,
      employeeConfirmedAt: null,
      employeeDeclinedAt: null,
    },
  });
  await tx.companyMember.update({
    where: { id: member.id },
    data: { lastAssignedAt: input.now },
  });
  input.outboxIds.push(outbox.id);
  return { handled: true as const, mutated: true, action: 'REASSIGNED', memberId: member.id };
}

// Appointment and sale handlers are defined below so every reply mutation shares
// the same locked prompt and transaction boundary.
async function createAppointmentFromEmployeeInstruction(
  input: {
    companyAccountId: string;
    recipientType: WhatsAppPromptRecipientType;
    recipientId: string;
    text: string;
    provider: string;
    providerMessageId: string;
    quotedProviderMessageId?: string | null;
    instruction: NonNullable<ReturnType<typeof parseAppointmentInstruction>>;
    now: Date;
  }
) {
  const workflow = await prisma.viewingWorkflow.findFirst({
    where: {
      companyAccountId: input.companyAccountId,
      shortCode: input.instruction.shortCode || undefined,
      status: { in: ['ASSIGNMENT_ACCEPTED', 'APPOINTMENT_PENDING'] },
      assignmentAttempts: {
        some: { memberId: input.recipientId, status: 'ACCEPTED' },
      },
    },
    include: {
      contact: { select: { name: true, phoneNormalized: true, phone: true } },
      assignmentAttempts: { where: { status: 'ACCEPTED' }, take: 1 },
    },
  });
  if (!workflow || workflow.assignmentAttempts[0]?.memberId !== input.recipientId) {
    return {
      handled: true as const,
      mutated: false,
      clarificationRequired: true,
    };
  }
  const startAt = new Date(input.instruction.startAt);
  const endAt = new Date(input.instruction.endAt);
  if (startAt <= input.now || endAt <= startAt) {
    return { handled: true as const, mutated: false, invalidDate: true };
  }
  const outboxIds: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    const duplicate = await tx.appointmentRequest.findFirst({
      where: {
        companyAccountId: input.companyAccountId,
        viewingWorkflowId: workflow.id,
        startAt,
      },
    });
    if (duplicate) return { handled: true as const, mutated: false, duplicate: true };
    const existing = await tx.appointmentRequest.findFirst({
      where: {
        companyAccountId: input.companyAccountId,
        viewingWorkflowId: workflow.id,
      },
      orderBy: { createdAt: 'asc' },
    });
    const appointmentCode =
      existing?.shortCode || shortCode('R', `${workflow.id}:${startAt.toISOString()}`);
    const appointment = existing
      ? await tx.appointmentRequest.update({
          where: { id: existing.id },
          data: {
            contactId: workflow.contactId,
            propertyId: workflow.propertyId,
            assignedMemberId: input.recipientId,
            taskId: workflow.crmTaskId,
            dealId: workflow.dealId,
            shortCode: appointmentCode,
            startAt,
            endAt,
            timezone: input.instruction.timezone,
            proposedDate: startAt,
            proposedTime: new Intl.DateTimeFormat('tr-TR', {
              timeZone: input.instruction.timezone,
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
            }).format(startAt),
            status: 'APPROVED',
          },
        })
      : await tx.appointmentRequest.create({
          data: {
            companyAccountId: input.companyAccountId,
            conversationId: workflow.conversationId,
            contactId: workflow.contactId,
            propertyId: workflow.propertyId,
            assignedMemberId: input.recipientId,
            taskId: workflow.crmTaskId,
            dealId: workflow.dealId,
            viewingWorkflowId: workflow.id,
            shortCode: appointmentCode,
            customerName: workflow.contact.name,
            customerPhone:
              workflow.contact.phoneNormalized || workflow.contact.phone,
            startAt,
            endAt,
            timezone: input.instruction.timezone,
            proposedDate: startAt,
            status: 'APPROVED',
          },
        });
    await tx.viewingWorkflow.updateMany({
      where: {
        id: workflow.id,
        companyAccountId: input.companyAccountId,
        status: { in: ['ASSIGNMENT_ACCEPTED', 'APPOINTMENT_PENDING'] },
      },
      data: { status: 'APPOINTMENT_CONFIRMED', version: { increment: 1 } },
    });
    const task = await tx.crmTask.findFirstOrThrow({
      where: { id: workflow.crmTaskId, companyAccountId: input.companyAccountId },
    });
    if (task.workflowStatus === 'ACCEPTED') {
      await transitionTaskInTransaction(tx, {
        companyAccountId: input.companyAccountId,
        taskId: task.id,
        toStatus: 'APPOINTMENT_CONFIRMED',
        evidenceText: `#${appointmentCode} randevusu ${startAt.toISOString()} için kesinleşti.`,
        sourceMessageId: input.providerMessageId,
        actorType: 'EMPLOYEE',
        actorId: input.recipientId,
        idempotencyKey: `viewing:${workflow.id}:appointment:${input.providerMessageId}`,
      });
    }
    const [details, owner] = await Promise.all([
      tx.viewingWorkflow.findFirstOrThrow({
        where: { id: workflow.id, companyAccountId: input.companyAccountId },
        include: {
          contact: { select: { name: true } },
          property: { select: { title: true, referenceCode: true } },
          crmTask: { include: { assignedMember: { select: { name: true } } } },
        },
      }),
      ownerRecipient(tx, input.companyAccountId),
    ]);
    const label = details.property.referenceCode || details.property.title;
    const dateText = new Intl.DateTimeFormat('tr-TR', {
      timeZone: input.instruction.timezone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(startAt);
    if (owner.phone) {
      const outbox = await createWorkflowOutboxInTransaction(tx, {
        companyAccountId: input.companyAccountId,
        toPhone: owner.phone,
        content: `[Randevu #${appointmentCode}] ${details.contact.name}, ${label} için ${dateText} tarihinde ${details.crmTask.assignedMember?.name || 'atanan çalışan'} ile görüşecek.`,
        recipientType: 'OWNER',
        recipientId: owner.id,
        purpose: 'VIEWING_APPOINTMENT_CREATED',
        idempotencyKey: `appointment:${appointment.id}:owner-created`,
        relatedTaskId: workflow.crmTaskId,
        propertyId: workflow.propertyId,
        contactId: workflow.contactId,
        correlationId: appointment.id,
        createdByType: 'VIEWING_WORKFLOW',
        createdById: workflow.id,
      });
      outboxIds.push(outbox.id);
    }
    return { handled: true as const, mutated: true, appointmentId: appointment.id };
  });
  await dispatchOutboxes(outboxIds);
  return result;
}

async function applyAppointmentConfirmationReply(
  tx: Tx,
  input: {
    prompt: LoadedPrompt;
    parsed: InteractionReply;
    providerMessageId: string;
    now: Date;
    outboxIds: string[];
  }
): Promise<Record<string, unknown>> {
  const appointment = input.prompt.appointmentRequest;
  const workflow = input.prompt.workflow;
  if (
    !appointment ||
    !workflow ||
    appointment.companyAccountId !== workflow.companyAccountId ||
    appointment.assignedMemberId !== input.prompt.recipientMemberId
  ) {
    await answerPrompt(
      tx,
      input.prompt,
      input.providerMessageId,
      input.now,
      'CANCELLED'
    );
    return { handled: true, mutated: false, stale: true };
  }
  if (!['REMEMBER', 'CANNOT_ATTEND'].includes(input.parsed.action)) {
    return { handled: true, mutated: false, clarificationRequired: true };
  }
  const answered = await answerPrompt(
    tx,
    input.prompt,
    input.providerMessageId,
    input.now
  );
  if (!answered) return { handled: true, mutated: false, duplicate: true };

  if (input.parsed.action === 'REMEMBER') {
    await tx.appointmentRequest.updateMany({
      where: {
        id: appointment.id,
        companyAccountId: workflow.companyAccountId,
        assignedMemberId: input.prompt.recipientMemberId,
      },
      data: {
        employeeConfirmedAt: input.now,
        employeeDeclinedAt: null,
        employeeConfirmationDueAt: null,
      },
    });
    await tx.viewingWorkflow.updateMany({
      where: {
        id: workflow.id,
        companyAccountId: workflow.companyAccountId,
        status: {
          in: ['AWAITING_APPOINTMENT_CONFIRMATION', 'APPOINTMENT_CONFIRMED'],
        },
      },
      data: { status: 'APPOINTMENT_CONFIRMED', version: { increment: 1 } },
    });
    await tx.crmActivity.create({
      data: {
        companyAccountId: workflow.companyAccountId,
        contactId: workflow.contactId,
        propertyId: workflow.propertyId,
        dealId: workflow.dealId,
        actorMemberId: input.prompt.recipientMemberId,
        type: 'APPOINTMENT_EMPLOYEE_CONFIRMED',
        title: `#${appointment.shortCode || workflow.shortCode} randevusu çalışan tarafından teyit edildi`,
        description: 'Çalışan randevuyu hatırladığını WhatsApp üzerinden doğruladı.',
        metadata: JSON.stringify({
          appointmentRequestId: appointment.id,
          promptId: input.prompt.id,
          providerMessageId: input.providerMessageId,
        }),
      },
    });
    return { handled: true, mutated: true, action: 'CONFIRMED' };
  }

  await tx.appointmentRequest.updateMany({
    where: {
      id: appointment.id,
      companyAccountId: workflow.companyAccountId,
      assignedMemberId: input.prompt.recipientMemberId,
    },
    data: {
      employeeDeclinedAt: input.now,
      employeeConfirmationDueAt: null,
    },
  });
  await tx.viewingWorkflow.updateMany({
    where: {
      id: workflow.id,
      companyAccountId: workflow.companyAccountId,
      status: {
        in: ['AWAITING_APPOINTMENT_CONFIRMATION', 'APPOINTMENT_CONFIRMED'],
      },
    },
    data: {
      status: 'AWAITING_OWNER_DECISION',
      version: { increment: 1 },
    },
  });
  const task = await tx.crmTask.findFirst({
    where: { id: workflow.crmTaskId, companyAccountId: workflow.companyAccountId },
    select: { workflowStatus: true },
  });
  if (task && task.workflowStatus !== 'REASSIGNMENT_REQUIRED') {
    await transitionTaskInTransaction(tx, {
      companyAccountId: workflow.companyAccountId,
      taskId: workflow.crmTaskId,
      toStatus: 'REASSIGNMENT_REQUIRED',
      evidenceText:
        input.parsed.reason || 'Çalışan kesinleşmiş gösterime katılamayacağını bildirdi.',
      sourceMessageId: input.providerMessageId,
      actorType: 'EMPLOYEE',
      actorId: input.prompt.recipientMemberId,
      idempotencyKey: `appointment:${appointment.id}:cannot-attend:${input.providerMessageId}`,
    });
  }
  const latestAttempt = await tx.viewingAssignmentAttempt.findFirst({
    where: { workflowId: workflow.id, companyAccountId: workflow.companyAccountId },
    orderBy: { sequence: 'desc' },
  });
  if (latestAttempt) {
    const ownerPrompt = await ownerDecisionPrompt(tx, {
      companyAccountId: workflow.companyAccountId,
      workflowId: workflow.id,
      attemptId: latestAttempt.id,
      appointmentRequestId: appointment.id,
      promptType: 'OWNER_APPOINTMENT_ESCALATION',
      now: input.now,
      reason: `randevuya katılamayacağını bildirdi${input.parsed.reason ? `: ${input.parsed.reason}` : ''}`,
      idempotencySuffix: `appointment-${appointment.id}-declined`,
    });
    if (ownerPrompt.outboxId) input.outboxIds.push(ownerPrompt.outboxId);
  }
  return { handled: true, mutated: true, action: 'CANNOT_ATTEND' };
}

async function applyAppointmentOutcomeReply(
  tx: Tx,
  input: {
    prompt: LoadedPrompt;
    parsed: InteractionReply;
    providerMessageId: string;
    now: Date;
    outboxIds: string[];
  }
): Promise<Record<string, unknown>> {
  const appointment = input.prompt.appointmentRequest;
  const workflow = input.prompt.workflow;
  const outcomeType = appointmentOutcomeForAction(input.parsed.action);
  if (!appointment || !workflow || !outcomeType) {
    return { handled: true, mutated: false, clarificationRequired: true };
  }
  if (
    appointment.companyAccountId !== workflow.companyAccountId ||
    appointment.assignedMemberId !== input.prompt.recipientMemberId
  ) {
    await answerPrompt(
      tx,
      input.prompt,
      input.providerMessageId,
      input.now,
      'CANCELLED'
    );
    return { handled: true, mutated: false, stale: true };
  }
  const existingOutcome = await tx.appointmentOutcome.findUnique({
    where: { appointmentRequestId: appointment.id },
  });
  if (existingOutcome) {
    await answerPrompt(
      tx,
      input.prompt,
      input.providerMessageId,
      input.now,
      'CANCELLED'
    );
    return {
      handled: true,
      mutated: false,
      duplicate: true,
      outcomeId: existingOutcome.id,
    };
  }
  const answered = await answerPrompt(
    tx,
    input.prompt,
    input.providerMessageId,
    input.now
  );
  if (!answered) return { handled: true, mutated: false, duplicate: true };

  const nextActionAt =
    outcomeType === 'FOLLOW_UP'
      ? parseFollowUpDate(input.parsed.reason || '', appointment.timezone) ||
        new Date(input.now.getTime() + 24 * 60 * 60_000)
      : null;
  const reasonText = input.parsed.reason?.slice(0, 1500) || null;
  const noSaleReason =
    outcomeType === 'NOT_SOLD' ? inferNoSaleReason(reasonText) : null;
  const outcome = await tx.appointmentOutcome.upsert({
    where: { appointmentRequestId: appointment.id },
    update: {},
    create: {
      companyAccountId: workflow.companyAccountId,
      appointmentRequestId: appointment.id,
      viewingWorkflowId: workflow.id,
      reportedByMemberId: input.prompt.recipientMemberId,
      outcome: outcomeType,
      noSaleReason,
      reasonText,
      nextAction: outcomeType === 'FOLLOW_UP' ? reasonText || 'Müşteriyi takip et' : null,
      nextActionAt,
      evidenceProviderMessageId: input.providerMessageId,
      saleDecision: outcomeType === 'SOLD_REPORTED' ? 'PENDING' : null,
    },
  });
  await tx.crmActivity.create({
    data: {
      companyAccountId: workflow.companyAccountId,
      contactId: workflow.contactId,
      propertyId: workflow.propertyId,
      dealId: workflow.dealId,
      actorMemberId: input.prompt.recipientMemberId,
      type: 'APPOINTMENT_OUTCOME',
      title: `Gösterim sonucu: ${outcomeType}`,
      description: reasonText,
      metadata: JSON.stringify({
        appointmentRequestId: appointment.id,
        outcomeId: outcome.id,
        workflowId: workflow.id,
      }),
    },
  });

  if (outcomeType === 'SOLD_REPORTED') {
    const owner = await ownerRecipient(tx, workflow.companyAccountId);
    const timings = await loadViewingWorkflowTimings(
      workflow.companyAccountId,
      tx
    );
    const details = await tx.viewingWorkflow.findFirstOrThrow({
      where: { id: workflow.id, companyAccountId: workflow.companyAccountId },
      include: {
        contact: { select: { name: true } },
        property: { select: { title: true, referenceCode: true } },
        crmTask: { include: { assignedMember: { select: { name: true } } } },
      },
    });
    const saleCode = shortCode('S', `${appointment.id}:${outcome.id}`);
    const propertyLabel = details.property.referenceCode || details.property.title;
    const dateText = appointment.startAt
      ? new Intl.DateTimeFormat('tr-TR', {
          timeZone: appointment.timezone,
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(appointment.startAt)
      : 'tarihi belirtilmeyen randevu';
    const content = `[Satış #${saleCode}] ${details.crmTask.assignedMember?.name || 'Çalışan'}, ${propertyLabel} portföyünün satıldığını bildirdi. Müşteri: ${details.contact.name}, randevu: ${dateText}. Portföyü havuzdan kaldırmak için “#${saleCode} KALDIR”, bekletmek için “#${saleCode} TUT”, incelemek için “#${saleCode} DETAY” yaz.`;
    const salePrompt = await tx.whatsAppInteractionPrompt.create({
      data: {
        companyAccountId: workflow.companyAccountId,
        workflowId: workflow.id,
        taskId: workflow.crmTaskId,
        propertyId: workflow.propertyId,
        contactId: workflow.contactId,
        appointmentRequestId: appointment.id,
        actionId: outcome.id,
        recipientType: 'OWNER',
        recipientId: owner.id,
        promptType: 'OWNER_SALE_DECISION',
        expectedResponseType: 'SALE_DECISION',
        shortCode: saleCode,
        status: 'OPEN',
        deadlineAt: new Date(
          input.now.getTime() + timings.ownerEscalationMinutes * 60_000
        ),
        expiresAt: new Date(input.now.getTime() + 48 * 60 * 60_000),
        idempotencyKey: `appointment:${appointment.id}:sale-decision`,
      },
    });
    if (owner.phone) {
      const outbox = await createWorkflowOutboxInTransaction(tx, {
        companyAccountId: workflow.companyAccountId,
        toPhone: owner.phone,
        content,
        recipientType: 'OWNER',
        recipientId: owner.id,
        purpose: 'OWNER_SALE_DECISION',
        idempotencyKey: `appointment:${appointment.id}:sale-decision:outbox`,
        conversationId: workflow.conversationId,
        contactId: workflow.contactId,
        propertyId: workflow.propertyId,
        relatedTaskId: workflow.crmTaskId,
        correlationId: salePrompt.id,
        createdByType: 'VIEWING_WORKFLOW',
        createdById: workflow.id,
        metadata: json({ appointmentRequestId: appointment.id, outcomeId: outcome.id }),
      });
      await tx.whatsAppInteractionPrompt.update({
        where: { id: salePrompt.id },
        data: { outboxMessageId: outbox.id },
      });
      input.outboxIds.push(outbox.id);
    }
    await tx.viewingWorkflow.updateMany({
      where: { id: workflow.id, companyAccountId: workflow.companyAccountId },
      data: { status: 'AWAITING_SALE_DECISION', version: { increment: 1 } },
    });
    await tx.notification.upsert({
      where: {
        companyAccountId_recipientKey_dedupeKey: {
          companyAccountId: workflow.companyAccountId,
          recipientKey: 'OWNER',
          dedupeKey: `appointment:${appointment.id}:sale-decision`,
        },
      },
      update: {},
      create: {
        companyAccountId: workflow.companyAccountId,
        recipientKey: 'OWNER',
        type: 'SYSTEM',
        title: 'Satış bildirimi patron onayı bekliyor',
        message: content,
        link: '/fabrika',
        important: true,
        dedupeKey: `appointment:${appointment.id}:sale-decision`,
      },
    });
    return { handled: true, mutated: true, action: 'SALE_REPORTED' };
  }

  let followUpTaskId: string | null = null;
  if (outcomeType === 'FOLLOW_UP') {
    const followUp = await tx.crmTask.upsert({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: workflow.companyAccountId,
          idempotencyKey: `appointment:${appointment.id}:follow-up`,
        },
      },
      update: {},
      create: {
        companyAccountId: workflow.companyAccountId,
        contactId: workflow.contactId,
        propertyId: workflow.propertyId,
        dealId: workflow.dealId,
        assignedMemberId: appointment.assignedMemberId,
        type: 'FOLLOW_UP',
        title: `Gösterim sonrası takip: #${appointment.shortCode || workflow.shortCode}`,
        description: reasonText || 'Müşterinin sonraki adımını takip et.',
        dueAt: nextActionAt,
        priority: 4,
        idempotencyKey: `appointment:${appointment.id}:follow-up`,
      },
    });
    followUpTaskId = followUp.id;
    await tx.appointmentOutcome.update({
      where: { id: outcome.id },
      data: { followUpTaskId },
    });
  }
  await finalizeNonSaleOutcome(tx, {
    workflow,
    appointment,
    outcomeType,
    reasonText,
    providerMessageId: input.providerMessageId,
    now: input.now,
    outboxIds: input.outboxIds,
  });
  return {
    handled: true,
    mutated: true,
    action: outcomeType,
    followUpTaskId,
  };
}

async function applySaleDecisionReply(
  tx: Tx,
  input: {
    prompt: LoadedPrompt;
    parsed: InteractionReply;
    providerMessageId: string;
    now: Date;
    outboxIds: string[];
  }
): Promise<Record<string, unknown>> {
  const appointment = input.prompt.appointmentRequest;
  const workflow = input.prompt.workflow;
  if (!appointment || !workflow || !input.prompt.actionId) {
    return { handled: true, mutated: false, stale: true };
  }
  if (
    !['REMOVE_SOLD_PROPERTY', 'KEEP_PROPERTY', 'DETAIL'].includes(
      input.parsed.action
    )
  ) {
    return { handled: true, mutated: false, clarificationRequired: true };
  }
  const outcome = await tx.appointmentOutcome.findFirst({
    where: {
      id: input.prompt.actionId,
      companyAccountId: workflow.companyAccountId,
      appointmentRequestId: appointment.id,
      viewingWorkflowId: workflow.id,
      outcome: 'SOLD_REPORTED',
    },
  });
  if (
    !outcome ||
    (outcome.saleDecision &&
      !['PENDING', 'DETAIL_REQUESTED'].includes(outcome.saleDecision))
  ) {
    await answerPrompt(
      tx,
      input.prompt,
      input.providerMessageId,
      input.now,
      'CANCELLED'
    );
    return { handled: true, mutated: false, stale: true };
  }
  const answered = await answerPrompt(
    tx,
    input.prompt,
    input.providerMessageId,
    input.now
  );
  if (!answered) return { handled: true, mutated: false, duplicate: true };

  if (input.parsed.action === 'DETAIL') {
    const details = await tx.viewingWorkflow.findFirstOrThrow({
      where: { id: workflow.id, companyAccountId: workflow.companyAccountId },
      include: {
        contact: { select: { name: true, phone: true } },
        property: {
          select: { title: true, referenceCode: true, location: true, price: true },
        },
        crmTask: { include: { assignedMember: { select: { name: true } } } },
      },
    });
    const owner = await ownerRecipient(tx, workflow.companyAccountId);
    const nextPrompt = await tx.whatsAppInteractionPrompt.create({
      data: {
        companyAccountId: workflow.companyAccountId,
        workflowId: workflow.id,
        taskId: workflow.crmTaskId,
        propertyId: workflow.propertyId,
        contactId: workflow.contactId,
        appointmentRequestId: appointment.id,
        actionId: outcome.id,
        recipientType: 'OWNER',
        recipientId: owner.id,
        promptType: 'OWNER_SALE_DECISION',
        expectedResponseType: 'SALE_DECISION',
        shortCode: input.prompt.shortCode,
        status: 'OPEN',
        expiresAt: new Date(input.now.getTime() + 48 * 60 * 60_000),
        idempotencyKey: `appointment:${appointment.id}:sale-detail:${input.providerMessageId}`,
      },
    });
    if (owner.phone) {
      const propertyLabel = details.property.referenceCode || details.property.title;
      const outbox = await createWorkflowOutboxInTransaction(tx, {
        companyAccountId: workflow.companyAccountId,
        toPhone: owner.phone,
        content: `[Satış #${input.prompt.shortCode}] Portföy: ${propertyLabel}; konum: ${details.property.location || 'belirtilmedi'}; müşteri: ${details.contact.name}; çalışan: ${details.crmTask.assignedMember?.name || 'belirtilmedi'}; fiyat: ${details.property.price ?? 'belirtilmedi'}. Karar için “#${input.prompt.shortCode} KALDIR” veya “#${input.prompt.shortCode} TUT” yaz.`,
        recipientType: 'OWNER',
        recipientId: owner.id,
        purpose: 'OWNER_SALE_DETAIL',
        idempotencyKey: `appointment:${appointment.id}:sale-detail:${input.providerMessageId}:outbox`,
        contactId: workflow.contactId,
        propertyId: workflow.propertyId,
        relatedTaskId: workflow.crmTaskId,
        correlationId: nextPrompt.id,
        createdByType: 'VIEWING_WORKFLOW',
        createdById: workflow.id,
      });
      await tx.whatsAppInteractionPrompt.update({
        where: { id: nextPrompt.id },
        data: { outboxMessageId: outbox.id },
      });
      input.outboxIds.push(outbox.id);
    }
    await tx.appointmentOutcome.update({
      where: { id: outcome.id },
      data: { saleDecision: 'DETAIL_REQUESTED' },
    });
    return { handled: true, mutated: true, action: 'DETAIL' };
  }

  const remove = input.parsed.action === 'REMOVE_SOLD_PROPERTY';
  const propertyChanged = await tx.crmProperty.updateMany({
    where: {
      id: workflow.propertyId,
      companyAccountId: workflow.companyAccountId,
      status: { in: ['ACTIVE', 'RESERVED'] },
    },
    data: remove
      ? {
          status: 'SOLD',
          publicationBlockedAt: input.now,
          publicationBlockReason: 'Patron tarafından satış sonrası havuzdan kaldırıldı.',
        }
      : { status: 'RESERVED' },
  });
  if (propertyChanged.count !== 1) {
    throw new Error('Satış kararı uygulanacak portföy güncel veya bu şirkete ait değil.');
  }
  if (workflow.dealId) {
    await tx.crmDeal.updateMany({
      where: { id: workflow.dealId, companyAccountId: workflow.companyAccountId },
      data: remove
        ? { stage: 'WON', probability: 100, closedAt: input.now }
        : { stage: 'CONTRACT', probability: 90 },
    });
  }
  await tx.appointmentOutcome.update({
    where: { id: outcome.id },
    data: {
      saleDecision: remove ? 'REMOVE' : 'KEEP',
      saleDecisionById: input.prompt.recipientId,
      saleDecisionAt: input.now,
    },
  });
  await tx.viewingWorkflow.updateMany({
    where: { id: workflow.id, companyAccountId: workflow.companyAccountId },
    data: {
      status: 'COMPLETED',
      completedAt: input.now,
      version: { increment: 1 },
    },
  });
  const task = await tx.crmTask.findFirst({
    where: { id: workflow.crmTaskId, companyAccountId: workflow.companyAccountId },
    select: { workflowStatus: true },
  });
  if (task && task.workflowStatus !== 'COMPLETED') {
    await transitionTaskInTransaction(tx, {
      companyAccountId: workflow.companyAccountId,
      taskId: workflow.crmTaskId,
      toStatus: 'COMPLETED',
      evidenceText: remove
        ? 'Satış tamamlandı ve patron portföyün kaldırılmasını onayladı.'
        : 'Satış tamamlandı; patron portföyü rezerve tutma kararı verdi.',
      sourceMessageId: input.providerMessageId,
      actorType: 'OWNER',
      actorId: input.prompt.recipientId,
      idempotencyKey: `appointment:${appointment.id}:sale-final:${input.providerMessageId}`,
    });
  }
  await tx.crmActivity.create({
    data: {
      companyAccountId: workflow.companyAccountId,
      contactId: workflow.contactId,
      propertyId: workflow.propertyId,
      dealId: workflow.dealId,
      type: remove ? 'PROPERTY_SOLD' : 'PROPERTY_RESERVED_AFTER_SALE_REPORT',
      title: remove
        ? 'Satış patron tarafından onaylandı'
        : 'Satış bildirimi sonrası portföy rezerve tutuldu',
      description: input.parsed.reason,
      metadata: JSON.stringify({
        appointmentRequestId: appointment.id,
        outcomeId: outcome.id,
        promptId: input.prompt.id,
      }),
    },
  });
  await recordOperationEvent(
    {
      companyAccountId: workflow.companyAccountId,
      eventType: remove ? 'PROPERTY_UNPUBLISHED' : 'PROPERTY_UPDATED',
      entityType: 'CRM_PROPERTY',
      entityId: workflow.propertyId,
      actorType: 'OWNER',
      actorId: input.prompt.recipientId,
      contactId: workflow.contactId,
      propertyId: workflow.propertyId,
      taskId: workflow.crmTaskId,
      conversationId: workflow.conversationId,
      sourceProvider: 'WAHA',
      sourceMessageId: input.providerMessageId,
      occurredAt: input.now,
      metadata: json({ appointmentRequestId: appointment.id, outcomeId: outcome.id }),
      idempotencyKey: `appointment:${appointment.id}:sale-operation:${input.providerMessageId}`,
    },
    tx
  );
  const employee = appointment.assignedMemberId
    ? await tx.companyMember.findFirst({
        where: {
          id: appointment.assignedMemberId,
          companyAccountId: workflow.companyAccountId,
          active: true,
          phoneNormalized: { not: null },
        },
        select: { id: true, phoneNormalized: true },
      })
    : null;
  if (employee?.phoneNormalized) {
    const outbox = await createWorkflowOutboxInTransaction(tx, {
      companyAccountId: workflow.companyAccountId,
      toPhone: employee.phoneNormalized,
      content: `[Satış #${input.prompt.shortCode}] Patron kararı uygulandı: portföy ${remove ? 'SOLD durumuna alındı ve yayından kaldırıldı' : 'RESERVED durumunda tutuldu'}.`,
      recipientType: 'EMPLOYEE',
      recipientId: employee.id,
      purpose: 'SALE_DECISION_RESULT',
      idempotencyKey: `appointment:${appointment.id}:sale-result:${remove ? 'remove' : 'keep'}:employee`,
      contactId: workflow.contactId,
      propertyId: workflow.propertyId,
      relatedTaskId: workflow.crmTaskId,
      correlationId: outcome.id,
      createdByType: 'VIEWING_WORKFLOW',
      createdById: workflow.id,
    });
    input.outboxIds.push(outbox.id);
  }
  return {
    handled: true,
    mutated: true,
    action: remove ? 'PROPERTY_SOLD' : 'PROPERTY_RESERVED',
  };
}

function inferNoSaleReason(reason: string | null) {
  const text = (reason || '').toLocaleLowerCase('tr-TR');
  if (/fiyat|pahalı|bütçe/u.test(text)) return 'PRICE' as const;
  if (/kredi|finans|ödeme/u.test(text)) return 'FINANCING' as const;
  if (/zaman|sonra|erken/u.test(text)) return 'TIMING' as const;
  if (/oda|konum|bölge|uygun değil|beğenmedi/u.test(text)) {
    return 'PROPERTY_MISMATCH' as const;
  }
  if (/karar|düşünecek/u.test(text)) return 'CUSTOMER_DECISION' as const;
  return 'OTHER' as const;
}

async function finalizeNonSaleOutcome(
  tx: Tx,
  input: {
    workflow: NonNullable<LoadedPrompt['workflow']>;
    appointment: NonNullable<LoadedPrompt['appointmentRequest']>;
    outcomeType: Exclude<AppointmentOutcomeType, 'SOLD_REPORTED'>;
    reasonText: string | null;
    providerMessageId: string;
    now: Date;
    outboxIds: string[];
  }
) {
  await tx.viewingWorkflow.updateMany({
    where: {
      id: input.workflow.id,
      companyAccountId: input.workflow.companyAccountId,
    },
    data: {
      status: input.outcomeType === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
      completedAt: input.outcomeType === 'CANCELLED' ? null : input.now,
      cancelledAt: input.outcomeType === 'CANCELLED' ? input.now : null,
      version: { increment: 1 },
    },
  });
  if (input.outcomeType === 'CANCELLED') {
    await tx.appointmentRequest.update({
      where: { id: input.appointment.id },
      data: { status: 'CANCELLED', cancelledAt: input.now },
    });
  }
  const task = await tx.crmTask.findFirst({
    where: {
      id: input.workflow.crmTaskId,
      companyAccountId: input.workflow.companyAccountId,
    },
    select: { workflowStatus: true },
  });
  if (task && !['COMPLETED', 'CANCELLED'].includes(task.workflowStatus)) {
    await transitionTaskInTransaction(tx, {
      companyAccountId: input.workflow.companyAccountId,
      taskId: input.workflow.crmTaskId,
      toStatus: input.outcomeType === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
      evidenceText:
        input.outcomeType === 'CANCELLED'
          ? input.reasonText || 'Gösterim randevusu çalışan tarafından iptal edildi.'
          : `Gösterim tamamlandı; sonuç ${input.outcomeType}${input.reasonText ? `: ${input.reasonText}` : ''}.`,
      sourceMessageId: input.providerMessageId,
      actorType: 'EMPLOYEE',
      actorId: input.appointment.assignedMemberId,
      idempotencyKey: `appointment:${input.appointment.id}:outcome-task:${input.providerMessageId}`,
    });
  }
  const owner = await ownerRecipient(tx, input.workflow.companyAccountId);
  if (owner.phone) {
    const outbox = await createWorkflowOutboxInTransaction(tx, {
      companyAccountId: input.workflow.companyAccountId,
      toPhone: owner.phone,
      content: `[Randevu #${input.appointment.shortCode || input.workflow.shortCode}] Sonuç: ${input.outcomeType}${input.reasonText ? ` — ${input.reasonText}` : ''}.`,
      recipientType: 'OWNER',
      recipientId: owner.id,
      purpose: 'APPOINTMENT_OUTCOME_SUMMARY',
      idempotencyKey: `appointment:${input.appointment.id}:outcome-owner`,
      conversationId: input.workflow.conversationId,
      contactId: input.workflow.contactId,
      propertyId: input.workflow.propertyId,
      relatedTaskId: input.workflow.crmTaskId,
      correlationId: input.appointment.id,
      createdByType: 'VIEWING_WORKFLOW',
      createdById: input.workflow.id,
    });
    input.outboxIds.push(outbox.id);
  }
  await tx.notification.upsert({
    where: {
      companyAccountId_recipientKey_dedupeKey: {
        companyAccountId: input.workflow.companyAccountId,
        recipientKey: 'OWNER',
        dedupeKey: `appointment:${input.appointment.id}:outcome`,
      },
    },
    update: {},
    create: {
      companyAccountId: input.workflow.companyAccountId,
      recipientKey: 'OWNER',
      type: 'SYSTEM',
      title:
        input.outcomeType === 'EMPLOYEE_NO_SHOW'
          ? 'Kritik: çalışan gösterime katılmadı'
          : 'Gösterim sonucu kaydedildi',
      message: `${input.outcomeType}${input.reasonText ? `: ${input.reasonText}` : ''}`,
      link: '/fabrika/takvim',
      important: input.outcomeType === 'EMPLOYEE_NO_SHOW',
      dedupeKey: `appointment:${input.appointment.id}:outcome`,
      metadata: JSON.stringify({
        appointmentRequestId: input.appointment.id,
        viewingWorkflowId: input.workflow.id,
      }),
    },
  });
}

export type { AppointmentOutcomeType, PromptExpectedResponseType };
