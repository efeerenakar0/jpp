import 'server-only';

import type { Prisma } from '@prisma/client';

import prisma from '@/lib/prisma';
import { getCompanyOperationalStatus } from '@/lib/digital-manager/company-guard';

import { createWorkflowOutboxInTransaction } from './outbox';
import { appointmentLifecycleDecision } from './rules';
import { resolveViewingWorkflowTimings } from './timing-policy';
import {
  dispatchOutboxes,
  ownerDecisionPrompt,
  ownerRecipient,
} from './service';

type Tx = Prisma.TransactionClient;

const MAX_EMPLOYEE_REMINDERS = 1;

type LifecycleAppointment = Prisma.AppointmentRequestGetPayload<{
  include: {
    outcome: true;
    companyAccount: { select: { companyName: true; onboardingState: true } };
    assignedMember: { select: { id: true; name: true; phoneNormalized: true } };
    viewingWorkflow: {
      include: {
        contact: { select: { name: true } };
        property: { select: { title: true; referenceCode: true } };
      };
    };
  };
}>;

function dateLabel(appointment: LifecycleAppointment) {
  if (!appointment.startAt) return 'tarihi belirtilmeyen randevu';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: appointment.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(appointment.startAt);
}

async function queueEmployeeAppointmentPrompt(
  tx: Tx,
  input: {
    appointment: LifecycleAppointment;
    kind: 'CONFIRMATION' | 'OUTCOME';
    reminder: number;
    now: Date;
  }
) {
  const { appointment } = input;
  const workflow = appointment.viewingWorkflow;
  const member = appointment.assignedMember;
  if (!workflow || !member?.phoneNormalized || !appointment.shortCode) {
    await tx.notification.upsert({
      where: {
        companyAccountId_recipientKey_dedupeKey: {
          companyAccountId: appointment.companyAccountId,
          recipientKey: 'OWNER',
          dedupeKey: `appointment:${appointment.id}:${input.kind.toLowerCase()}:missing-relation`,
        },
      },
      update: {},
      create: {
        companyAccountId: appointment.companyAccountId,
        recipientKey: 'OWNER',
        type: 'SYSTEM',
        title: 'Randevu WhatsApp görevi hazırlanamadı',
        message:
          'Randevu, gösterim vakası, kısa iş kodu veya doğrulanmış çalışan telefonu eksik.',
        link: '/fabrika/takvim',
        important: true,
        dedupeKey: `appointment:${appointment.id}:${input.kind.toLowerCase()}:missing-relation`,
      },
    });
    return null;
  }
  const suffix = `${input.kind.toLowerCase()}:reminder:${input.reminder}`;
  const existing = await tx.whatsAppInteractionPrompt.findUnique({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: appointment.companyAccountId,
        idempotencyKey: `appointment:${appointment.id}:${suffix}`,
      },
    },
  });
  if (existing?.outboxMessageId) return existing.outboxMessageId;

  const propertyLabel =
    workflow.property.referenceCode || workflow.property.title;
  const isConfirmation = input.kind === 'CONFIRMATION';
  const prompt =
    existing ||
    (await tx.whatsAppInteractionPrompt.create({
      data: {
        companyAccountId: appointment.companyAccountId,
        workflowId: workflow.id,
        taskId: workflow.crmTaskId,
        propertyId: workflow.propertyId,
        contactId: workflow.contactId,
        appointmentRequestId: appointment.id,
        recipientType: 'EMPLOYEE',
        recipientId: member.id,
        recipientMemberId: member.id,
        promptType: isConfirmation
          ? 'EMPLOYEE_APPOINTMENT_CONFIRMATION'
          : 'EMPLOYEE_APPOINTMENT_OUTCOME',
        expectedResponseType: isConfirmation
          ? 'APPOINTMENT_CONFIRMATION'
          : 'APPOINTMENT_OUTCOME',
        shortCode: appointment.shortCode,
        status: 'OPEN',
        reminderCount: input.reminder,
        expiresAt: new Date(input.now.getTime() + 48 * 60 * 60_000),
        idempotencyKey: `appointment:${appointment.id}:${suffix}`,
      },
    }));
  const content = isConfirmation
    ? `[Randevu #${appointment.shortCode}] ${dateLabel(appointment)} tarihinde ${workflow.contact.name} ile ${propertyLabel} gösterimin var. “#${appointment.shortCode} HATIRLIYORUM” veya “#${appointment.shortCode} KATILAMIYORUM: neden” yaz.`
    : `[Randevu #${appointment.shortCode}] Görüşme nasıl geçti? “#${appointment.shortCode} SATILDI”, “#${appointment.shortCode} SATILMADI: neden”, “#${appointment.shortCode} TAKİPTE: sonraki adım/tarih”, “#${appointment.shortCode} MÜŞTERİ GELMEDİ” veya “#${appointment.shortCode} İPTAL” yaz.`;
  const outbox = await createWorkflowOutboxInTransaction(tx, {
    companyAccountId: appointment.companyAccountId,
    toPhone: member.phoneNormalized,
    content: input.reminder > 0 ? `Hatırlatma: ${content}` : content,
    recipientType: 'EMPLOYEE',
    recipientId: member.id,
    purpose: isConfirmation
      ? 'APPOINTMENT_EMPLOYEE_CONFIRMATION'
      : 'APPOINTMENT_EMPLOYEE_OUTCOME',
    idempotencyKey: `appointment:${appointment.id}:${suffix}:outbox`,
    conversationId: appointment.conversationId,
    contactId: workflow.contactId,
    propertyId: workflow.propertyId,
    relatedTaskId: workflow.crmTaskId,
    correlationId: prompt.id,
    createdByType: 'APPOINTMENT_LIFECYCLE',
    createdById: appointment.id,
    metadata: {
      appointmentRequestId: appointment.id,
      workflowId: workflow.id,
      promptId: prompt.id,
      reminder: input.reminder,
    },
  });
  await tx.whatsAppInteractionPrompt.update({
    where: { id: prompt.id },
    data: { outboxMessageId: outbox.id },
  });
  await tx.viewingWorkflow.updateMany({
    where: {
      id: workflow.id,
      companyAccountId: appointment.companyAccountId,
      status: isConfirmation
        ? { in: ['APPOINTMENT_CONFIRMED', 'AWAITING_APPOINTMENT_CONFIRMATION'] }
        : { notIn: ['COMPLETED', 'CANCELLED', 'FAILED'] },
    },
    data: {
      status: isConfirmation
        ? 'AWAITING_APPOINTMENT_CONFIRMATION'
        : 'AWAITING_OUTCOME',
      version: { increment: 1 },
    },
  });
  return outbox.id;
}

async function escalateMissingOutcome(
  tx: Tx,
  appointment: LifecycleAppointment,
  now: Date
) {
  const workflow = appointment.viewingWorkflow;
  if (!workflow) return null;
  const owner = await ownerRecipient(tx, appointment.companyAccountId);
  const propertyLabel =
    workflow.property.referenceCode || workflow.property.title;
  const content = `[Randevu #${appointment.shortCode || workflow.shortCode}] ${workflow.contact.name} ile ${propertyLabel} gösteriminin sonucu çalışan tarafından bildirilmedi. Sonucu panelden kontrol edin veya çalışanla iletişime geçin.`;
  let outboxId: string | null = null;
  if (owner.phone) {
    const outbox = await createWorkflowOutboxInTransaction(tx, {
      companyAccountId: appointment.companyAccountId,
      toPhone: owner.phone,
      content,
      recipientType: 'OWNER',
      recipientId: owner.id,
      purpose: 'APPOINTMENT_OUTCOME_ESCALATION',
      idempotencyKey: `appointment:${appointment.id}:outcome-escalation:outbox`,
      conversationId: appointment.conversationId,
      contactId: workflow.contactId,
      propertyId: workflow.propertyId,
      relatedTaskId: workflow.crmTaskId,
      correlationId: appointment.id,
      createdByType: 'APPOINTMENT_LIFECYCLE',
      createdById: appointment.id,
    });
    outboxId = outbox.id;
  }
  await tx.notification.upsert({
    where: {
      companyAccountId_recipientKey_dedupeKey: {
        companyAccountId: appointment.companyAccountId,
        recipientKey: 'OWNER',
        dedupeKey: `appointment:${appointment.id}:outcome-escalation`,
      },
    },
    update: {},
    create: {
      companyAccountId: appointment.companyAccountId,
      recipientKey: 'OWNER',
      type: 'SYSTEM',
      title: 'Kritik: gösterim sonucu bildirilmedi',
      message: content,
      link: '/fabrika/takvim',
      important: true,
      dedupeKey: `appointment:${appointment.id}:outcome-escalation`,
    },
  });
  await tx.appointmentRequest.updateMany({
    where: {
      id: appointment.id,
      companyAccountId: appointment.companyAccountId,
      outcomeEscalatedAt: null,
    },
    data: { outcomeEscalatedAt: now },
  });
  return outboxId;
}

export async function processAppointmentLifecycle(now = new Date()) {
  const appointments = await prisma.appointmentRequest.findMany({
    where: {
      status: 'APPROVED',
      startAt: { not: null },
      endAt: { not: null },
      assignedMemberId: { not: null },
      viewingWorkflowId: { not: null },
    },
    include: {
      outcome: true,
      companyAccount: {
        select: { companyName: true, onboardingState: true },
      },
      assignedMember: { select: { id: true, name: true, phoneNormalized: true } },
      viewingWorkflow: {
        include: {
          contact: { select: { name: true } },
          property: { select: { title: true, referenceCode: true } },
        },
      },
    },
    orderBy: { startAt: 'asc' },
    take: 250,
  });
  const outboxIds: string[] = [];
  const results: Array<{ appointmentId: string; action: string }> = [];

  for (const appointment of appointments) {
    const timings = resolveViewingWorkflowTimings(
      appointment.companyAccount.onboardingState,
      appointment.companyAccount.companyName
    );
    const decision = appointmentLifecycleDecision({
      now,
      startAt: appointment.startAt!,
      endAt: appointment.endAt!,
      employeeReminderSentAt: appointment.employeeReminderSentAt,
      outcomePromptSentAt: appointment.outcomePromptSentAt,
      hasOutcome: Boolean(appointment.outcome),
      appointmentReminderHours: timings.appointmentReminderHours,
      appointmentOutcomeDelayMinutes:
        timings.appointmentOutcomeDelayMinutes,
    });
    if (decision === 'NONE') continue;
    const queued = await prisma.$transaction(async (tx) => {
      const operational = await getCompanyOperationalStatus(
        appointment.companyAccountId,
        tx,
        now
      );
      if (!operational.allowed) {
        return {
          outboxId: null,
          action: `SKIPPED_${operational.reason}`,
        };
      }
      return {
        outboxId: await queueEmployeeAppointmentPrompt(tx, {
          appointment,
          kind: decision === 'SEND_CONFIRMATION' ? 'CONFIRMATION' : 'OUTCOME',
          reminder: 0,
          now,
        }),
        action: decision,
      };
    });
    if (queued.outboxId) outboxIds.push(queued.outboxId);
    results.push({ appointmentId: appointment.id, action: queued.action });
  }

  const duePrompts = await prisma.whatsAppInteractionPrompt.findMany({
    where: {
      status: 'OPEN',
      recipientType: 'EMPLOYEE',
      promptType: {
        in: [
          'EMPLOYEE_APPOINTMENT_CONFIRMATION',
          'EMPLOYEE_APPOINTMENT_OUTCOME',
        ],
      },
      deadlineAt: { not: null, lte: now },
    },
    select: { id: true, companyAccountId: true, appointmentRequestId: true },
    orderBy: { deadlineAt: 'asc' },
    take: 250,
  });
  for (const candidate of duePrompts) {
    const result = await prisma.$transaction(async (tx) => {
      const operational = await getCompanyOperationalStatus(
        candidate.companyAccountId,
        tx,
        now
      );
      if (!operational.allowed) {
        return {
          appointmentId: candidate.appointmentRequestId || candidate.id,
          outboxId: null,
          action: `SKIPPED_${operational.reason}`,
        };
      }
      const prompt = await tx.whatsAppInteractionPrompt.findFirst({
        where: {
          id: candidate.id,
          companyAccountId: candidate.companyAccountId,
          status: 'OPEN',
          deadlineAt: { not: null, lte: now },
        },
        include: {
          appointmentRequest: {
            include: {
              outcome: true,
              companyAccount: {
                select: { companyName: true, onboardingState: true },
              },
              assignedMember: {
                select: { id: true, name: true, phoneNormalized: true },
              },
              viewingWorkflow: {
                include: {
                  contact: { select: { name: true } },
                  property: { select: { title: true, referenceCode: true } },
                },
              },
            },
          },
        },
      });
      const appointment = prompt?.appointmentRequest;
      if (!prompt || !appointment || appointment.outcome) return null;
      const claimed = await tx.whatsAppInteractionPrompt.updateMany({
        where: { id: prompt.id, status: 'OPEN', deadlineAt: prompt.deadlineAt },
        data: { status: 'EXPIRED', expiresAt: now },
      });
      if (claimed.count !== 1) return null;
      const kind =
        prompt.promptType === 'EMPLOYEE_APPOINTMENT_CONFIRMATION'
          ? 'CONFIRMATION'
          : 'OUTCOME';
      if (prompt.reminderCount < MAX_EMPLOYEE_REMINDERS) {
        const outboxId = await queueEmployeeAppointmentPrompt(tx, {
          appointment,
          kind,
          reminder: prompt.reminderCount + 1,
          now,
        });
        await tx.appointmentRequest.update({
          where: { id: appointment.id },
          data:
            kind === 'CONFIRMATION'
              ? { employeeReminderCount: { increment: 1 } }
              : { outcomeReminderCount: { increment: 1 } },
        });
        return {
          appointmentId: appointment.id,
          outboxId,
          action: `${kind}_REMINDER`,
        };
      }
      if (kind === 'CONFIRMATION') {
        const workflow = appointment.viewingWorkflow;
        const latestAttempt = workflow
          ? await tx.viewingAssignmentAttempt.findFirst({
              where: {
                workflowId: workflow.id,
                companyAccountId: appointment.companyAccountId,
              },
              orderBy: { sequence: 'desc' },
            })
          : null;
        let outboxId: string | null = null;
        if (workflow && latestAttempt) {
          const escalation = await ownerDecisionPrompt(tx, {
            companyAccountId: appointment.companyAccountId,
            workflowId: workflow.id,
            attemptId: latestAttempt.id,
            appointmentRequestId: appointment.id,
            promptType: 'OWNER_APPOINTMENT_ESCALATION',
            now,
            reason: 'randevu teyit isteğine iki kez cevap vermedi',
            idempotencySuffix: `appointment-${appointment.id}-confirmation-timeout`,
          });
          outboxId = escalation.outboxId;
        }
        await tx.appointmentRequest.updateMany({
          where: {
            id: appointment.id,
            companyAccountId: appointment.companyAccountId,
            employeeConfirmationEscalatedAt: null,
          },
          data: { employeeConfirmationEscalatedAt: now },
        });
        return {
          appointmentId: appointment.id,
          outboxId,
          action: 'CONFIRMATION_ESCALATED',
        };
      }
      return {
        appointmentId: appointment.id,
        outboxId: await escalateMissingOutcome(tx, appointment, now),
        action: 'OUTCOME_ESCALATED',
      };
    });
    if (!result) continue;
    if (result.outboxId) outboxIds.push(result.outboxId);
    results.push({
      appointmentId: result.appointmentId,
      action: result.action,
    });
  }
  await dispatchOutboxes(outboxIds);
  return results;
}
