import 'server-only';

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export const MAX_POSTER_REGENERATIONS = 2;
export const POSTER_PROCESSING_STALE_MS = 8 * 60 * 1000;

export type StudioPosterGenerationAction = 'INITIAL' | 'REGENERATE';

type GenerationSummary = {
  id: string;
  regenerationCount: number;
  maxRegenerations: number;
};

export class StudioPosterGenerationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = 'INVALID_REQUEST'
  ) {
    super(message);
    this.name = 'StudioPosterGenerationError';
  }
}

export function posterGenerationPayload(generation: GenerationSummary) {
  return {
    id: generation.id,
    regenerationCount: generation.regenerationCount,
    maxRegenerations: generation.maxRegenerations,
    remainingRegenerations: Math.max(
      0,
      generation.maxRegenerations - generation.regenerationCount
    ),
  };
}

function retryableTransactionError(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  return code === 'P2034' || code === 'P2002';
}

async function serializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      lastError = error;
      if (!retryableTransactionError(error) || attempt === 2) throw error;
    }
  }
  throw lastError;
}

export async function reserveStudioPosterGeneration(input: {
  companyAccountId: string;
  memberId: string | null;
  propertyId: string | null;
  action: StudioPosterGenerationAction;
  generationId?: string | null;
  logicalFingerprint: string;
  requestFingerprint: string;
  idempotencyKey: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return serializableTransaction(async (tx) => {
    const [property, member] = await Promise.all([
      input.propertyId
        ? tx.crmProperty.findFirst({
            where: {
              id: input.propertyId,
              companyAccountId: input.companyAccountId,
            },
            select: { id: true },
          })
        : null,
      input.memberId
        ? tx.companyMember.findFirst({
            where: {
              id: input.memberId,
              companyAccountId: input.companyAccountId,
              active: true,
            },
            select: { id: true },
          })
        : null,
    ]);
    if (input.propertyId && !property) {
      throw new StudioPosterGenerationError(
        'Seçilen portföy bu şirkete ait değil.',
        403,
        'PROPERTY_FORBIDDEN'
      );
    }
    if (input.memberId && !member) {
      throw new StudioPosterGenerationError(
        'Poster işlemini başlatan çalışan bu şirkette aktif değil.',
        403,
        'MEMBER_FORBIDDEN'
      );
    }

    const duplicate = await tx.studioPosterGenerationAttempt.findFirst({
      where: {
        companyAccountId: input.companyAccountId,
        idempotencyKey: input.idempotencyKey,
      },
      include: { generation: true },
    });
    if (duplicate) {
      if (duplicate.requestFingerprint !== input.requestFingerprint) {
        throw new StudioPosterGenerationError(
          'Bu istek anahtarı farklı bir poster isteğinde kullanılmış.',
          409,
          'IDEMPOTENCY_CONFLICT'
        );
      }
      return {
        duplicate: true as const,
        generation: duplicate.generation,
        attempt: duplicate,
      };
    }

    if (input.action === 'INITIAL') {
      const existingGeneration = await tx.studioPosterGeneration.findFirst({
        where: {
          companyAccountId: input.companyAccountId,
          logicalFingerprint: input.logicalFingerprint,
        },
      });
      if (existingGeneration) {
        const latestInitialAttempt =
          await tx.studioPosterGenerationAttempt.findFirst({
            where: {
              generationId: existingGeneration.id,
              kind: { in: ['INITIAL', 'INITIAL_RETRY', 'INITIAL_RECOVERY'] },
            },
            orderBy: { sequence: 'desc' },
          });
        if (latestInitialAttempt?.status === 'SUCCEEDED') {
          if (latestInitialAttempt.outputUrl) {
            return {
              duplicate: true as const,
              reusable: true as const,
              generation: existingGeneration,
              attempt: latestInitialAttempt,
            };
          }
        }
        if (latestInitialAttempt?.status === 'PROCESSING') {
          const processingSince = latestInitialAttempt.updatedAt.getTime();
          if (now.getTime() - processingSince < POSTER_PROCESSING_STALE_MS) {
            throw new StudioPosterGenerationError(
              'Bu poster isteği hâlâ işleniyor.',
              409,
              'GENERATION_IN_PROGRESS'
            );
          }
          await tx.studioPosterGenerationAttempt.updateMany({
            where: {
              id: latestInitialAttempt.id,
              status: 'PROCESSING',
            },
            data: {
              status: 'FAILED',
              failureCode: 'STALE_PROCESSING',
              completedAt: now,
            },
          });
        }

        const nextSequence =
          await tx.studioPosterGenerationAttempt.count({
            where: { generationId: existingGeneration.id },
          });
        const attempt = await tx.studioPosterGenerationAttempt.create({
          data: {
            companyAccountId: input.companyAccountId,
            generationId: existingGeneration.id,
            idempotencyKey: input.idempotencyKey,
            kind:
              latestInitialAttempt?.status === 'SUCCEEDED'
                ? 'INITIAL_RECOVERY'
                : 'INITIAL_RETRY',
            sequence: nextSequence,
            status: 'PROCESSING',
            requestFingerprint: input.requestFingerprint,
            createdAt: now,
          },
        });
        return {
          duplicate: false as const,
          generation: existingGeneration,
          attempt,
        };
      }
      const generation = await tx.studioPosterGeneration.create({
        data: {
          companyAccountId: input.companyAccountId,
          propertyId: input.propertyId || null,
          createdByMemberId: input.memberId || null,
          logicalFingerprint: input.logicalFingerprint,
          initialRequestKey: input.idempotencyKey,
          maxRegenerations: MAX_POSTER_REGENERATIONS,
        },
      });
      const attempt = await tx.studioPosterGenerationAttempt.create({
        data: {
          companyAccountId: input.companyAccountId,
          generationId: generation.id,
          idempotencyKey: input.idempotencyKey,
          kind: 'INITIAL',
          sequence: 0,
          status: 'PROCESSING',
          requestFingerprint: input.requestFingerprint,
          createdAt: now,
        },
      });
      return { duplicate: false as const, generation, attempt };
    }

    if (!input.generationId) {
      throw new StudioPosterGenerationError(
        'Yeniden üretilecek poster kaydı belirtilmedi.',
        400,
        'GENERATION_ID_REQUIRED'
      );
    }

    const generation = await tx.studioPosterGeneration.findFirst({
      where: {
        id: input.generationId,
        companyAccountId: input.companyAccountId,
      },
    });
    if (!generation) {
      throw new StudioPosterGenerationError(
        'Poster üretim kaydı bulunamadı.',
        404,
        'NOT_FOUND'
      );
    }
    if (
      generation.propertyId &&
      input.propertyId &&
      generation.propertyId !== input.propertyId
    ) {
      throw new StudioPosterGenerationError(
        'Poster başka bir portföye bağlı olduğu için yeniden üretilemedi.',
        409,
        'PROPERTY_MISMATCH'
      );
    }

    await tx.studioPosterGenerationAttempt.updateMany({
      where: {
        generationId: generation.id,
        kind: 'REGENERATION',
        status: 'PROCESSING',
        updatedAt: {
          lt: new Date(now.getTime() - POSTER_PROCESSING_STALE_MS),
        },
      },
      data: {
        status: 'FAILED',
        failureCode: 'STALE_PROCESSING',
        completedAt: now,
      },
    });

    const activeRegenerations =
      await tx.studioPosterGenerationAttempt.count({
        where: {
          generationId: generation.id,
          kind: 'REGENERATION',
          status: { in: ['PROCESSING', 'SUCCEEDED'] },
        },
      });
    if (activeRegenerations >= generation.maxRegenerations) {
      throw new StudioPosterGenerationError(
        `Bu poster için ${generation.maxRegenerations} yeniden üretim hakkı kullanıldı.`,
        409,
        'REGENERATION_LIMIT_REACHED'
      );
    }

    const nextSequence =
      await tx.studioPosterGenerationAttempt.count({
        where: { generationId: generation.id },
      });

    const attempt = await tx.studioPosterGenerationAttempt.create({
      data: {
        companyAccountId: input.companyAccountId,
        generationId: generation.id,
        idempotencyKey: input.idempotencyKey,
        kind: 'REGENERATION',
        sequence: nextSequence,
        status: 'PROCESSING',
        requestFingerprint: input.requestFingerprint,
        createdAt: now,
      },
    });
    return { duplicate: false as const, generation, attempt };
  });
}

export async function completeStudioPosterGenerationAttempt(input: {
  companyAccountId: string;
  attemptId: string;
  resultDigest: string;
  outputUrl: string;
  outputStorageKey: string;
  outputMimeType: string;
  outputByteSize: number;
  providerCostUsd?: number | null;
  providerRequestId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return serializableTransaction(async (tx) => {
    const attempt = await tx.studioPosterGenerationAttempt.findFirst({
      where: {
        id: input.attemptId,
        companyAccountId: input.companyAccountId,
      },
      include: { generation: true },
    });
    if (!attempt) {
      throw new StudioPosterGenerationError(
        'Poster üretim denemesi bulunamadı.',
        404,
        'ATTEMPT_NOT_FOUND'
      );
    }

    if (attempt.status === 'SUCCEEDED') return attempt.generation;
    if (attempt.status !== 'PROCESSING') {
      throw new StudioPosterGenerationError(
        'Tamamlanmış veya başarısız bir poster denemesi güncellenemez.',
        409,
        'ATTEMPT_CLOSED'
      );
    }

    const updatedAttempt =
      await tx.studioPosterGenerationAttempt.updateMany({
        where: {
          id: attempt.id,
          companyAccountId: input.companyAccountId,
          status: 'PROCESSING',
        },
        data: {
          status: 'SUCCEEDED',
          resultDigest: input.resultDigest,
          outputUrl: input.outputUrl,
          outputStorageKey: input.outputStorageKey,
          outputMimeType: input.outputMimeType,
          outputByteSize: input.outputByteSize,
          providerCostUsd: input.providerCostUsd ?? null,
          providerRequestId: input.providerRequestId ?? null,
          failureCode: null,
          completedAt: now,
        },
      });
    if (updatedAttempt.count === 0) return attempt.generation;

    const generation =
      attempt.kind === 'REGENERATION'
        ? await tx.studioPosterGeneration.update({
            where: { id: attempt.generationId },
            data: { regenerationCount: { increment: 1 } },
          })
        : attempt.generation;

    const event = await tx.operationEvent.upsert({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey: `studio-poster:completed:${attempt.id}`,
        },
      },
      update: {},
      create: {
        companyAccountId: input.companyAccountId,
        eventType: 'STUDIO_JOB_COMPLETED',
        entityType: 'StudioPosterGeneration',
        entityId: generation.id,
        propertyId: generation.propertyId,
        actorType: generation.createdByMemberId ? 'MEMBER' : 'OWNER',
        actorId: generation.createdByMemberId,
        metadata: {
          attemptId: attempt.id,
          kind: attempt.kind,
          sequence: attempt.sequence,
          resultDigest: input.resultDigest,
          outputByteSize: input.outputByteSize,
          providerCostUsd: input.providerCostUsd ?? null,
          providerRequestId: input.providerRequestId ?? null,
        },
        occurredAt: now,
        idempotencyKey: `studio-poster:completed:${attempt.id}`,
      },
    });
    await tx.managerAuditLog.create({
      data: {
        companyAccountId: input.companyAccountId,
        operationEventId: event.id,
        actorType: generation.createdByMemberId ? 'MEMBER' : 'OWNER',
        actorId: generation.createdByMemberId,
        operation:
          attempt.kind === 'REGENERATION'
            ? 'STUDIO_POSTER_REGENERATION_COMPLETED'
            : 'STUDIO_POSTER_GENERATION_COMPLETED',
        entityType: 'StudioPosterGeneration',
        entityId: generation.id,
        verifiedContext: {
          attemptId: attempt.id,
          sequence: attempt.sequence,
        },
        result: 'SUCCEEDED',
        completedAt: now,
      },
    });

    return generation;
  });
}

export async function failStudioPosterGenerationAttempt(input: {
  companyAccountId: string;
  attemptId: string;
  failureCode: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return serializableTransaction(async (tx) => {
    const attempt = await tx.studioPosterGenerationAttempt.findFirst({
      where: {
        id: input.attemptId,
        companyAccountId: input.companyAccountId,
      },
      include: { generation: true },
    });
    if (!attempt || attempt.status !== 'PROCESSING') return false;

    const updated = await tx.studioPosterGenerationAttempt.updateMany({
      where: {
        id: attempt.id,
        companyAccountId: input.companyAccountId,
        status: 'PROCESSING',
      },
      data: {
        status: 'FAILED',
        failureCode: input.failureCode.slice(0, 80),
        completedAt: now,
      },
    });
    if (updated.count === 0) return false;

    await tx.managerAuditLog.create({
      data: {
        companyAccountId: input.companyAccountId,
        actorType: attempt.generation.createdByMemberId ? 'MEMBER' : 'OWNER',
        actorId: attempt.generation.createdByMemberId,
        operation: 'STUDIO_POSTER_GENERATION_FAILED',
        entityType: 'StudioPosterGeneration',
        entityId: attempt.generationId,
        verifiedContext: {
          attemptId: attempt.id,
          kind: attempt.kind,
          sequence: attempt.sequence,
        },
        result: 'FAILED',
        errorCode: input.failureCode.slice(0, 80),
        completedAt: now,
      },
    });
    return true;
  });
}
