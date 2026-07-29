import type { OperationEventType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import { createOperationIdempotencyKey } from './workflow';

type EventDb = Prisma.TransactionClient | typeof prisma;

export type RecordOperationEventInput = {
  companyAccountId: string;
  eventType: OperationEventType;
  entityType?: string | null;
  entityId?: string | null;
  actorType?: string | null;
  actorId?: string | null;
  contactId?: string | null;
  propertyId?: string | null;
  listingId?: string | null;
  taskId?: string | null;
  conversationId?: string | null;
  sourceProvider?: string | null;
  sourceMessageId?: string | null;
  metadata?: Prisma.InputJsonValue;
  occurredAt?: Date;
  idempotencyKey?: string;
};

export async function recordOperationEvent(
  input: RecordOperationEventInput,
  db: EventDb = prisma
) {
  const idempotencyKey =
    input.idempotencyKey ||
    createOperationIdempotencyKey({
      companyAccountId: input.companyAccountId,
      eventType: input.eventType,
      sourceMessageId: input.sourceMessageId,
      entityId: input.entityId,
    });

  return db.operationEvent.upsert({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: input.companyAccountId,
        idempotencyKey,
      },
    },
    update: {},
    create: {
      companyAccountId: input.companyAccountId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      actorType: input.actorType,
      actorId: input.actorId,
      contactId: input.contactId,
      propertyId: input.propertyId,
      listingId: input.listingId,
      taskId: input.taskId,
      conversationId: input.conversationId,
      sourceProvider: input.sourceProvider,
      sourceMessageId: input.sourceMessageId,
      metadata: input.metadata,
      occurredAt: input.occurredAt,
      idempotencyKey,
    },
  });
}

export async function appendManagerAudit(
  input: {
    companyAccountId: string;
    operationEventId?: string | null;
    managerActionId?: string | null;
    actorType: string;
    actorId?: string | null;
    operation: string;
    entityType?: string | null;
    entityId?: string | null;
    verifiedContext?: Prisma.InputJsonValue;
    evidence?: Prisma.InputJsonValue;
    structuredAi?: Prisma.InputJsonValue;
    confidence?: number | null;
    policyDecision?: string | null;
    result: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    correctionOfId?: string | null;
    completedAt?: Date | null;
  },
  db: EventDb = prisma
) {
  return db.managerAuditLog.create({
    data: input,
  });
}
