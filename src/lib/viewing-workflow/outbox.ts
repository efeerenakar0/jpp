import type { Prisma } from '@prisma/client';

export type WorkflowOutboxInput = {
  companyAccountId: string;
  toPhone: string;
  content: string;
  recipientType: 'OWNER' | 'EMPLOYEE' | 'CRM_CONTACT';
  recipientId: string;
  purpose: string;
  idempotencyKey: string;
  conversationId?: string | null;
  contactId?: string | null;
  propertyId?: string | null;
  relatedTaskId?: string | null;
  correlationId?: string | null;
  replyToProviderMessageId?: string | null;
  createdByType: string;
  createdById?: string | null;
  nextAttemptAt?: Date;
  metadata?: Prisma.InputJsonValue;
};

function normalizedPhone(value: string) {
  const phone = value.replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) {
    throw new Error('WhatsApp alıcısının ülke kodlu telefonu geçersiz.');
  }
  return phone;
}

export async function createWorkflowOutboxInTransaction(
  tx: Prisma.TransactionClient,
  input: WorkflowOutboxInput
) {
  const phone = normalizedPhone(input.toPhone);
  const existing = await tx.whatsAppOutboxMessage.findUnique({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: input.companyAccountId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });
  if (existing) {
    if (
      existing.toPhone !== phone ||
      existing.content !== input.content ||
      existing.recipientType !== input.recipientType ||
      existing.recipientId !== input.recipientId ||
      existing.purpose !== input.purpose ||
      existing.relatedTaskId !== (input.relatedTaskId || null) ||
      existing.propertyId !== (input.propertyId || null) ||
      existing.contactId !== (input.contactId || null)
    ) {
      throw new Error(
        'Aynı idempotency anahtarı farklı bir WhatsApp işi için kullanılamaz.'
      );
    }
    return existing;
  }

  const outbox = await tx.whatsAppOutboxMessage.create({
    data: {
      companyAccountId: input.companyAccountId,
      toPhone: phone,
      content: input.content.slice(0, 4000),
      provider: 'WAHA',
      status: 'QUEUED',
      idempotencyKey: input.idempotencyKey,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      purpose: input.purpose,
      conversationId: input.conversationId,
      contactId: input.contactId,
      propertyId: input.propertyId,
      relatedTaskId: input.relatedTaskId,
      correlationId: input.correlationId,
      replyToProviderMessageId: input.replyToProviderMessageId,
      createdByType: input.createdByType,
      createdById: input.createdById,
      nextAttemptAt: input.nextAttemptAt,
      metadata: input.metadata,
    },
  });
  await tx.messageDeliveryAudit.createMany({
    data: [
      {
        companyAccountId: input.companyAccountId,
        outboxMessageId: outbox.id,
        status: 'QUEUED',
        rawStatus: 'OUTBOX_CREATED',
        metadata: {
          purpose: input.purpose,
          correlationId: input.correlationId || null,
        },
        idempotencyKey: `outbox:${outbox.id}:queued`,
      },
    ],
    skipDuplicates: true,
  });
  return outbox;
}
