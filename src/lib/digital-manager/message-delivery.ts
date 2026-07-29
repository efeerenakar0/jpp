import 'server-only';

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  isMonotonicDeliveryTransition,
  projectionPatchForDelivery,
  type DeliveryRuntimeStatus,
  type DeliveryTransitionStatus,
} from './message-delivery-policy';
import { recordOperationEvent } from './events';
import { shouldNotifyOwnerNow } from './policy';
import { transitionTaskInTransaction } from './tasks';

export type DeliveryAuditState =
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'RECEIVED'
  | 'FAILED';

type AuditMetadata = Record<string, unknown>;

type DeliveryAuditInput = {
  companyAccountId: string;
  outboxMessageId: string;
  status: DeliveryAuditState;
  idempotencyKey: string;
  providerMessageId?: string | null;
  rawStatus?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: AuditMetadata;
  occurredAt?: Date;
};

export type DeliveryTransitionInput = {
  companyAccountId: string;
  outboxMessageId?: string;
  providerMessageId?: string;
  status: DeliveryTransitionStatus;
  idempotencyKey: string;
  rawStatus?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: AuditMetadata;
  occurredAt?: Date;
};

export type ProviderDeliveryReceiptInput = Omit<
  DeliveryTransitionInput,
  'providerMessageId'
> & {
  provider: string;
  providerMessageId: string;
};

function inputJson(value: AuditMetadata): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function outboxSelector(input: DeliveryTransitionInput) {
  if (input.outboxMessageId) {
    return {
      companyAccountId: input.companyAccountId,
      id: input.outboxMessageId,
    };
  }
  if (input.providerMessageId) {
    return {
      companyAccountId: input.companyAccountId,
      providerMessageId: input.providerMessageId,
    };
  }
  throw new Error(
    'Teslimat geçişi için outboxMessageId veya providerMessageId gerekli.'
  );
}

async function lockOutboxForTransition(
  tx: Prisma.TransactionClient,
  input: DeliveryTransitionInput
) {
  const candidate = await tx.whatsAppOutboxMessage.findFirst({
    where: outboxSelector(input),
    select: { id: true },
  });
  if (!candidate) return null;

  await tx.$queryRaw(
    Prisma.sql`
      SELECT "id"
      FROM "WhatsAppOutboxMessage"
      WHERE "id" = ${candidate.id}
        AND "companyAccountId" = ${input.companyAccountId}
      FOR UPDATE
    `
  );

  return tx.whatsAppOutboxMessage.findFirst({
    where: {
      id: candidate.id,
      companyAccountId: input.companyAccountId,
    },
  });
}

async function appendAudit(
  tx: Prisma.TransactionClient,
  input: DeliveryAuditInput,
  metadata: AuditMetadata = {}
) {
  const occurredAt = input.occurredAt || new Date();
  return tx.messageDeliveryAudit.createMany({
    data: [
      {
        companyAccountId: input.companyAccountId,
        outboxMessageId: input.outboxMessageId,
        status: input.status,
        providerMessageId: input.providerMessageId,
        rawStatus: input.rawStatus,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage?.slice(0, 500),
        metadata: inputJson({ ...input.metadata, ...metadata }),
        idempotencyKey: input.idempotencyKey,
        occurredAt,
      },
    ],
    skipDuplicates: true,
  });
}

export async function appendMessageDeliveryAudit(input: DeliveryAuditInput) {
  return prisma.$transaction(async (tx) => {
    const outbox = await tx.whatsAppOutboxMessage.findFirst({
      where: {
        id: input.outboxMessageId,
        companyAccountId: input.companyAccountId,
      },
      select: { id: true, status: true },
    });
    if (!outbox) {
      return { found: false, appended: false };
    }
    const result = await appendAudit(tx, input, {
      observedOutboxStatus: outbox.status,
    });
    return { found: true, appended: result.count === 1 };
  });
}

export async function applyMessageDeliveryTransition(
  input: DeliveryTransitionInput
) {
  const occurredAt = input.occurredAt || new Date();
  return prisma.$transaction(async (tx) => {
    const outbox = await lockOutboxForTransition(tx, input);
    if (!outbox) {
      return {
        found: false,
        duplicate: false,
        transitioned: false,
        ignored: true,
        status: null,
      };
    }

    const current = outbox.status as DeliveryRuntimeStatus;
    const allowed = isMonotonicDeliveryTransition(current, input.status);
    const audit = await appendAudit(
      tx,
      {
        ...input,
        outboxMessageId: outbox.id,
        providerMessageId:
          input.providerMessageId || outbox.providerMessageId,
        occurredAt,
      },
      {
        previousStatus: current,
        transitionAllowed: allowed,
      }
    );
    const duplicateAudit = audit.count === 0;
    if (!allowed || current === input.status) {
      return {
        found: true,
        duplicate: duplicateAudit,
        transitioned: false,
        ignored: !allowed,
        status: current,
      };
    }

    const patch = projectionPatchForDelivery(
      input.status,
      occurredAt,
      input.errorMessage
    );
    const actualProviderMessageId =
      input.providerMessageId || outbox.providerMessageId;
    const outboxPatch: Prisma.WhatsAppOutboxMessageUpdateManyMutationInput = {
      ...patch.outbox,
      ...(actualProviderMessageId
        ? { providerMessageId: actualProviderMessageId }
        : {}),
      ...(input.status === 'DELIVERED' || input.status === 'READ'
        ? { sentAt: outbox.sentAt || occurredAt }
        : {}),
      ...(input.status === 'READ'
        ? { deliveredAt: outbox.deliveredAt || occurredAt }
        : {}),
    };
    const changed = await tx.whatsAppOutboxMessage.updateMany({
      where: {
        id: outbox.id,
        companyAccountId: input.companyAccountId,
        status: outbox.status,
      },
      data: outboxPatch,
    });
    if (changed.count === 0) {
      const latest = await tx.whatsAppOutboxMessage.findFirst({
        where: {
          id: outbox.id,
          companyAccountId: input.companyAccountId,
        },
        select: { status: true },
      });
      return {
        found: true,
        duplicate: false,
        transitioned: false,
        ignored: true,
        status: latest?.status || current,
      };
    }

    const projectionMessageIds = Array.from(
      new Set(
        [
          outbox.providerMessageId,
          input.providerMessageId,
          `queue:${outbox.id}`,
        ].filter((value): value is string => Boolean(value))
      )
    );
    if (projectionMessageIds.length > 0) {
      const conversationPatch = {
        ...patch.conversation,
        ...(actualProviderMessageId
          ? { providerMessageId: actualProviderMessageId }
          : {}),
      };
      const whatsAppPatch = {
        ...patch.whatsapp,
        ...(actualProviderMessageId
          ? { providerMessageId: actualProviderMessageId }
          : {}),
      };
      if (input.status === 'READ') {
        await tx.conversationMessage.updateMany({
          where: {
            providerMessageId: { in: projectionMessageIds },
            deliveredAt: null,
            conversation: {
              companyAccountId: input.companyAccountId,
            },
          },
          data: { deliveredAt: occurredAt },
        });
      }
      await tx.conversationMessage.updateMany({
        where: {
          providerMessageId: { in: projectionMessageIds },
          conversation: {
            companyAccountId: input.companyAccountId,
          },
        },
        data: conversationPatch,
      });
      await tx.whatsAppMessage.updateMany({
        where: {
          companyAccountId: input.companyAccountId,
          providerMessageId: { in: projectionMessageIds },
        },
        data: whatsAppPatch,
      });
    }

    if (
      outbox.relatedTaskId &&
      outbox.purpose === 'EMPLOYEE_TASK' &&
      (input.status === 'DELIVERED' ||
        input.status === 'READ' ||
        input.status === 'FAILED')
    ) {
      const task = await tx.crmTask.findFirst({
        where: {
          id: outbox.relatedTaskId,
          companyAccountId: input.companyAccountId,
        },
        select: { workflowStatus: true },
      });
      const deliveryCanAdvanceTask =
        task?.workflowStatus === 'ASSIGNED' ||
        task?.workflowStatus === 'MESSAGE_QUEUED';
      if (
        deliveryCanAdvanceTask &&
        (input.status === 'DELIVERED' || input.status === 'READ')
      ) {
        await transitionTaskInTransaction(tx, {
          companyAccountId: input.companyAccountId,
          taskId: outbox.relatedTaskId,
          toStatus: 'DELIVERED',
          evidenceText: 'Çalışan görev mesajı sağlayıcı tarafından teslim edildi.',
          operationEventId: outbox.operationEventId,
          managerActionId: outbox.managerActionId,
          sourceMessageId: actualProviderMessageId
            ? `provider:${actualProviderMessageId}`
            : `outbox:${outbox.id}`,
          actorType: 'WHATSAPP_PROVIDER',
          actorId: outbox.provider,
          idempotencyKey: `delivery:${outbox.id}:task-delivered`,
        });
      }
      if (deliveryCanAdvanceTask && input.status === 'FAILED') {
        const failureEvent = await recordOperationEvent(
          {
            companyAccountId: input.companyAccountId,
            eventType: 'MESSAGE_DELIVERY_FAILED',
            entityType: 'CRM_TASK',
            entityId: outbox.relatedTaskId,
            actorType: 'WHATSAPP_PROVIDER',
            actorId: outbox.provider,
            taskId: outbox.relatedTaskId,
            sourceProvider: outbox.provider,
            sourceMessageId: actualProviderMessageId,
            metadata: inputJson({
              outboxMessageId: outbox.id,
              errorCode: input.errorCode || null,
              errorMessage: input.errorMessage || null,
            }),
            occurredAt,
            idempotencyKey: `delivery:${outbox.id}:failure-event`,
          },
          tx
        );
        await transitionTaskInTransaction(tx, {
          companyAccountId: input.companyAccountId,
          taskId: outbox.relatedTaskId,
          toStatus: 'FAILED',
          evidenceText:
            input.errorMessage ||
            'Çalışan görev mesajı WhatsApp sağlayıcısında başarısız oldu.',
          operationEventId: failureEvent.id,
          managerActionId: outbox.managerActionId,
          sourceMessageId: actualProviderMessageId
            ? `provider:${actualProviderMessageId}`
            : `outbox:${outbox.id}`,
          actorType: 'WHATSAPP_PROVIDER',
          actorId: outbox.provider,
          reason:
            input.errorMessage ||
            'WhatsApp görev mesajı teslim edilemedi.',
          idempotencyKey: `delivery:${outbox.id}:task-failed`,
        });
        const [preference, account, config] = await Promise.all([
          tx.managerNotificationPreference.upsert({
            where: { companyAccountId: input.companyAccountId },
            update: {},
            create: { companyAccountId: input.companyAccountId },
          }),
          tx.companyAccount.findUnique({
            where: { id: input.companyAccountId },
            select: {
              ownerPhoneNormalized: true,
              ownerPhoneVerificationStatus: true,
            },
          }),
          tx.whatsAppConfig.findUnique({
            where: { companyAccountId: input.companyAccountId },
            select: { connectedPhone: true },
          }),
        ]);
        const failureMessage = `Çalışan görev mesajı teslim edilemedi: ${
          input.errorMessage || 'sağlayıcı kesin bir hata döndürdü'
        }`;
        await tx.notification.upsert({
          where: {
            companyAccountId_recipientKey_dedupeKey: {
              companyAccountId: input.companyAccountId,
              recipientKey: 'OWNER',
              dedupeKey: `delivery:${outbox.id}:owner-failure`,
            },
          },
          update: {},
          create: {
            companyAccountId: input.companyAccountId,
            recipientKey: 'OWNER',
            type: 'SYSTEM',
            title: 'WhatsApp teslimat hatası',
            message: failureMessage,
            link: '/fabrika',
            important: true,
            dedupeKey: `delivery:${outbox.id}:owner-failure`,
            metadata: JSON.stringify({
              eventType: 'MESSAGE_DELIVERY_FAILED',
              outboxMessageId: outbox.id,
              taskId: outbox.relatedTaskId,
            }),
          },
        });
        const shouldSendWhatsApp = shouldNotifyOwnerNow(
          {
            importance: 'CRITICAL',
            eventType: 'MESSAGE_DELIVERY_FAILED',
          },
          {
            autonomyMode: preference.autonomyMode,
            allowAutomaticEmployeeAssignment:
              preference.allowAutomaticEmployeeAssignment,
            allowAutomaticEmployeeWhatsApp:
              preference.allowAutomaticEmployeeWhatsApp,
            notifyCriticalImmediately:
              preference.notifyCriticalImmediately,
            notifyTaskAccepted: preference.notifyTaskAccepted,
            notifyOnlyProblemsAndDelays:
              preference.notifyOnlyProblemsAndDelays,
            alwaysNotifyHotLeads: preference.alwaysNotifyHotLeads,
            quietHoursEnabled: preference.quietHoursEnabled,
            quietHoursStart: preference.quietHoursStart,
            quietHoursEnd: preference.quietHoursEnd,
            timezone: preference.timezone,
          },
          occurredAt
        );
        const ownerPhone =
          preference.ownerPhoneVerificationStatus === 'VERIFIED'
            ? preference.ownerPhoneNormalized?.replace(/\D/g, '')
            : account?.ownerPhoneVerificationStatus === 'VERIFIED'
            ? account.ownerPhoneNormalized?.replace(/\D/g, '')
            : null;
        const connectedPhone = config?.connectedPhone?.replace(/\D/g, '');
        if (
          shouldSendWhatsApp &&
          ownerPhone &&
          ownerPhone !== connectedPhone
        ) {
          const ownerOutbox = await tx.whatsAppOutboxMessage.upsert({
            where: {
              companyAccountId_idempotencyKey: {
                companyAccountId: input.companyAccountId,
                idempotencyKey: `delivery:${outbox.id}:owner-whatsapp`,
              },
            },
            update: {},
            create: {
              companyAccountId: input.companyAccountId,
              toPhone: ownerPhone,
              content: failureMessage,
              provider: 'WAHA',
              status: 'QUEUED',
              idempotencyKey: `delivery:${outbox.id}:owner-whatsapp`,
              recipientType: 'OWNER',
              recipientId: input.companyAccountId,
              purpose: 'OWNER_NOTIFICATION',
              relatedTaskId: outbox.relatedTaskId,
              operationEventId: failureEvent.id,
              correlationId: failureEvent.id,
              createdByType: 'DELIVERY_MONITOR',
            },
          });
          await tx.messageDeliveryAudit.createMany({
            data: [
              {
                companyAccountId: input.companyAccountId,
                outboxMessageId: ownerOutbox.id,
                status: 'QUEUED',
                rawStatus: 'OUTBOX_CREATED',
                metadata: {
                  purpose: 'OWNER_NOTIFICATION',
                  sourceOutboxMessageId: outbox.id,
                },
                idempotencyKey: `outbox:${ownerOutbox.id}:queued`,
              },
            ],
            skipDuplicates: true,
          });
        }
      }
    }

    return {
      found: true,
      duplicate: duplicateAudit,
      transitioned: true,
      ignored: false,
      status: input.status,
    };
  });
}

export async function recordProviderDeliveryReceipt(
  input: ProviderDeliveryReceiptInput
) {
  await prisma.whatsAppDeliveryReceipt.createMany({
    data: [
      {
        companyAccountId: input.companyAccountId,
        provider: input.provider,
        providerMessageId: input.providerMessageId,
        status: input.status,
        rawStatus: input.rawStatus,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage?.slice(0, 500),
        metadata: inputJson(input.metadata || {}),
        idempotencyKey: input.idempotencyKey,
        occurredAt: input.occurredAt,
      },
    ],
    skipDuplicates: true,
  });

  const result = await applyMessageDeliveryTransition(input);
  if (result.found) {
    await prisma.whatsAppDeliveryReceipt.updateMany({
      where: {
        companyAccountId: input.companyAccountId,
        idempotencyKey: input.idempotencyKey,
        processedAt: null,
      },
      data: { processedAt: new Date() },
    });
  }
  return result;
}

export async function reconcileProviderDeliveryReceipts(input: {
  companyAccountId: string;
  provider: string;
  providerMessageId: string;
}) {
  const pending = await prisma.whatsAppDeliveryReceipt.findMany({
    where: {
      companyAccountId: input.companyAccountId,
      provider: input.provider,
      providerMessageId: input.providerMessageId,
      processedAt: null,
    },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    take: 50,
  });

  let processed = 0;
  for (const receipt of pending) {
    if (
      receipt.status !== 'SENT' &&
      receipt.status !== 'DELIVERED' &&
      receipt.status !== 'READ' &&
      receipt.status !== 'FAILED'
    ) {
      continue;
    }
    const result = await applyMessageDeliveryTransition({
      companyAccountId: receipt.companyAccountId,
      providerMessageId: receipt.providerMessageId,
      status: receipt.status,
      rawStatus: receipt.rawStatus,
      errorCode: receipt.errorCode,
      errorMessage: receipt.errorMessage,
      metadata:
        receipt.metadata && typeof receipt.metadata === 'object'
          ? (receipt.metadata as AuditMetadata)
          : undefined,
      idempotencyKey: receipt.idempotencyKey,
      occurredAt: receipt.occurredAt,
    });
    if (!result.found) continue;
    const changed = await prisma.whatsAppDeliveryReceipt.updateMany({
      where: {
        id: receipt.id,
        companyAccountId: input.companyAccountId,
        processedAt: null,
      },
      data: { processedAt: new Date() },
    });
    processed += changed.count;
  }
  return { found: pending.length, processed };
}
