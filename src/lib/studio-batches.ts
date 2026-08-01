import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { del } from '@vercel/blob';
import prisma from '@/lib/prisma';
import {
  fetchOwnedMediaBytes,
  persistGeneratedMedia,
  persistPropertyMediaFile,
  validatePropertyMediaFiles,
} from '@/lib/media-storage';
import {
  assertOwnedProperty,
  PropertyMediaError,
  type PropertyMediaActor,
} from '@/lib/property-media';
import { summarizeStudioBatch } from '@/lib/studio-batch-rules';
import {
  enhanceWithStableImageUltra,
  StabilityUltraError,
} from '@/lib/stability-ultra';

export const STUDIO_BATCH_MAX_ITEMS = 12;
const STUDIO_BATCH_RETENTION_DAYS = 7;

function expiresAt() {
  const value = new Date();
  value.setDate(value.getDate() + STUDIO_BATCH_RETENTION_DAYS);
  return value;
}

export async function createStudioBatch(input: {
  actor: PropertyMediaActor;
  propertyId?: string | null;
  mediaIds?: string[];
  files?: File[];
  prompt: string;
  preset?: string | null;
  idempotencyKey?: string | null;
}) {
  const prompt = input.prompt.trim();
  if (!prompt || prompt.length > 10_000) {
    throw new PropertyMediaError(
      'İyileştirme talimatı 1 ile 10.000 karakter arasında olmalıdır.'
    );
  }
  if (input.propertyId) {
    await assertOwnedProperty(input.actor, input.propertyId);
  }
  const files = input.files ?? [];
  const mediaIds = [...new Set(input.mediaIds ?? [])];
  if (files.length) validatePropertyMediaFiles(files);
  const totalItems = files.length + mediaIds.length;
  if (!totalItems) {
    throw new PropertyMediaError(
      'Bilgisayarınızdan veya portföyden en az bir görsel seçin.'
    );
  }
  if (totalItems > STUDIO_BATCH_MAX_ITEMS) {
    throw new PropertyMediaError(
      `Tek işlemde en fazla ${STUDIO_BATCH_MAX_ITEMS} görsel işleyebilirsiniz.`
    );
  }
  const ownedMedia = mediaIds.length
    ? await prisma.crmPropertyMedia.findMany({
        where: {
          id: { in: mediaIds },
          companyAccountId: input.actor.companyAccountId,
          ...(input.propertyId ? { propertyId: input.propertyId } : {}),
          archivedAt: null,
          mediaType: 'PHOTO',
          mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      })
    : [];
  if (ownedMedia.length !== mediaIds.length) {
    throw new PropertyMediaError(
      'Seçilen portföy görsellerinden biri kullanılamıyor veya başka şirkete ait.',
      403
    );
  }

  const idempotencyKey = input.idempotencyKey?.trim() || randomUUID();
  const existing = await prisma.studioBatch.findUnique({
    where: {
      companyAccountId_idempotencyKey: {
        companyAccountId: input.actor.companyAccountId,
        idempotencyKey,
      },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (existing) return existing;

  const batch = await prisma.studioBatch.create({
    data: {
      companyAccountId: input.actor.companyAccountId,
      propertyId: input.propertyId || null,
      prompt,
      preset: input.preset || null,
      provider: 'STABILITY',
      model: 'stable-image-ultra',
      status: 'UPLOADING',
      createdByMemberId: input.actor.memberId,
      idempotencyKey,
      startedAt: new Date(),
      expiresAt: expiresAt(),
    },
  });

  try {
    const itemData: Prisma.StudioBatchItemCreateManyInput[] = ownedMedia.map(
      (media, index) => ({
      batchId: batch.id,
      sourceMediaId: media.id,
      originalUrl: media.url,
      originalStorageKey: media.storageKey,
      originalFileName: media.fileName,
      originalMimeType: media.mimeType,
      originalWidth: media.width,
      originalHeight: media.height,
      originalByteSize: media.byteSize,
      sortOrder: index,
      fingerprint: `media:${media.id}`,
      status: 'PENDING' as const,
      })
    );
    for (const [fileIndex, file] of files.entries()) {
      const stored = await persistPropertyMediaFile({
        companyAccountId: input.actor.companyAccountId,
        propertyId: input.propertyId || `batch-${batch.id}`,
        file,
        folder: `studio-source/${batch.id}`,
      });
      itemData.push({
        batchId: batch.id,
        sourceMediaId: null,
        originalUrl: stored.url,
        originalStorageKey: stored.storageKey,
        originalFileName: stored.fileName,
        originalMimeType: stored.mimeType,
        originalWidth: null,
        originalHeight: null,
        originalByteSize: stored.byteSize,
        sortOrder: ownedMedia.length + fileIndex,
        fingerprint: `upload:${stored.checksum}`,
        status: 'PENDING',
      });
    }
    await prisma.studioBatchItem.createMany({
      data: itemData,
      skipDuplicates: true,
    });
    return prisma.studioBatch.update({
      where: { id: batch.id },
      data: { status: 'PENDING' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  } catch (error) {
    await prisma.studioBatch.update({
      where: { id: batch.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorSummary:
          error instanceof Error ? error.message : 'Görseller yüklenemedi.',
      },
    });
    throw error;
  }
}

export async function getOwnedStudioBatch(
  actor: PropertyMediaActor,
  batchId: string
) {
  const batch = await prisma.studioBatch.findFirst({
    where: { id: batchId, companyAccountId: actor.companyAccountId },
    include: {
      property: {
        select: { id: true, title: true, location: true, imageUrl: true },
      },
      items: {
        include: {
          sourceMedia: {
            select: {
              id: true,
              url: true,
              fileName: true,
              variantType: true,
            },
          },
          attachedMedia: {
            select: { id: true, url: true, fileName: true },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
  if (!batch) {
    throw new PropertyMediaError('Stüdyo işlemi bulunamadı.', 404);
  }
  return batch;
}

async function refreshBatchStatus(batchId: string) {
  const batch = await prisma.studioBatch.findUnique({
    where: { id: batchId },
    select: { companyAccountId: true, propertyId: true },
  });
  if (!batch) return;
  const items = await prisma.studioBatchItem.findMany({
    where: { batchId },
    select: { status: true, errorMessage: true },
  });
  const status = summarizeStudioBatch(items.map((item) => item.status));
  await prisma.studioBatch.update({
    where: { id: batchId },
    data: {
      status,
      completedAt:
        status === 'COMPLETED' ||
        status === 'FAILED' ||
        status === 'PARTIAL' ||
        status === 'ATTACHED'
          ? new Date()
          : null,
      errorSummary:
        status === 'FAILED' || status === 'PARTIAL'
          ? items
              .map((item) => item.errorMessage)
              .filter(Boolean)
              .slice(0, 5)
              .join(' · ')
          : null,
    },
  });
  if (
    status === 'COMPLETED' ||
    status === 'FAILED' ||
    status === 'PARTIAL' ||
    status === 'ATTACHED'
  ) {
    await prisma.operationEvent.upsert({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: batch.companyAccountId,
          idempotencyKey: `studio-batch-terminal:${batchId}:${status}`,
        },
      },
      create: {
        companyAccountId: batch.companyAccountId,
        eventType: 'STUDIO_JOB_COMPLETED',
        entityType: 'StudioBatch',
        entityId: batchId,
        propertyId: batch.propertyId,
        actorType: 'SYSTEM',
        metadata: { status, itemCount: items.length },
        idempotencyKey: `studio-batch-terminal:${batchId}:${status}`,
      },
      update: {},
    });
  }
}

export async function processStudioBatchItem(input: {
  actor: PropertyMediaActor;
  batchId: string;
  itemId: string;
}) {
  const item = await prisma.studioBatchItem.findFirst({
    where: {
      id: input.itemId,
      batchId: input.batchId,
      batch: { companyAccountId: input.actor.companyAccountId },
    },
    include: { batch: true },
  });
  if (!item) {
    throw new PropertyMediaError('Stüdyo görseli bulunamadı.', 404);
  }
  if (item.status === 'ATTACHED' || (item.status === 'COMPLETED' && item.outputUrl)) {
    return item;
  }
  await prisma.studioBatchItem.update({
    where: { id: item.id },
    data: { status: 'PROCESSING', errorMessage: null },
  });
  await prisma.studioBatch.update({
    where: { id: item.batchId },
    data: { status: 'PROCESSING', startedAt: item.batch.startedAt ?? new Date() },
  });
  try {
    const source = await fetchOwnedMediaBytes(item.originalUrl, {
      maxBytes: 9 * 1024 * 1024,
    });
    const processed = await enhanceWithStableImageUltra({
      image: source.bytes,
      mimeType: source.mimeType,
      prompt: item.batch.prompt,
    });
    const baseName =
      item.originalFileName.replace(/\.[^/.]+$/, '').slice(0, 100) || 'gorsel';
    const stored = await persistGeneratedMedia({
      companyAccountId: input.actor.companyAccountId,
      propertyId: item.batch.propertyId || `batch-${item.batch.id}`,
      bytes: processed.buffer,
      fileName: `${baseName}-AI-iyilestirilmis.${processed.extension}`,
      mimeType: processed.mimeType,
      folder: `studio-output/${item.batch.id}`,
    });
    const updated = await prisma.studioBatchItem.update({
      where: { id: item.id },
      data: {
        status: 'COMPLETED',
        outputUrl: stored.url,
        outputStorageKey: stored.storageKey,
        outputFileName: stored.fileName,
        outputMimeType: stored.mimeType,
        outputByteSize: stored.byteSize,
        errorMessage: null,
      },
    });
    await refreshBatchStatus(item.batchId);
    return updated;
  } catch (error) {
    const message =
      error instanceof StabilityUltraError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Görsel işlenemedi.';
    await prisma.studioBatchItem.update({
      where: { id: item.id },
      data: { status: 'FAILED', errorMessage: message.slice(0, 2_000) },
    });
    await refreshBatchStatus(item.batchId);
    throw error;
  }
}

export async function processNextStudioBatchItem() {
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
  const candidate = await prisma.studioBatchItem.findFirst({
    where: {
      batch: {
        expiresAt: { gt: new Date() },
        status: { in: ['PENDING', 'PROCESSING', 'PARTIAL'] },
      },
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING', updatedAt: { lt: staleBefore } },
      ],
    },
    include: {
      batch: { select: { id: true, companyAccountId: true, createdByMemberId: true } },
    },
    orderBy: [{ batch: { createdAt: 'asc' } }, { sortOrder: 'asc' }],
  });
  if (!candidate) return null;

  const claimed = await prisma.studioBatchItem.updateMany({
    where: {
      id: candidate.id,
      ...(candidate.status === 'PENDING'
        ? { status: 'PENDING' }
        : { status: 'PROCESSING', updatedAt: { lt: staleBefore } }),
    },
    data: { status: 'PROCESSING', errorMessage: null },
  });
  if (!claimed.count) return null;

  try {
    const item = await processStudioBatchItem({
      actor: {
        companyAccountId: candidate.batch.companyAccountId,
        memberId: candidate.batch.createdByMemberId,
      },
      batchId: candidate.batch.id,
      itemId: candidate.id,
    });
    return { ok: true as const, batchId: candidate.batch.id, itemId: item.id };
  } catch (error) {
    return {
      ok: false as const,
      batchId: candidate.batch.id,
      itemId: candidate.id,
      error: error instanceof Error ? error.message : 'Görsel işlenemedi.',
    };
  }
}

export async function cleanupExpiredStudioBatches(limit = 25) {
  const batches = await prisma.studioBatch.findMany({
    where: { expiresAt: { lte: new Date() } },
    include: {
      items: {
        select: {
          sourceMediaId: true,
          originalStorageKey: true,
          attachedMediaId: true,
          outputStorageKey: true,
        },
      },
    },
    orderBy: { expiresAt: 'asc' },
    take: Math.max(1, Math.min(limit, 100)),
  });
  for (const batch of batches) {
    const disposableKeys = batch.items.flatMap((item) => [
      !item.sourceMediaId ? item.originalStorageKey : null,
      !item.attachedMediaId ? item.outputStorageKey : null,
    ]).filter((value): value is string => Boolean(value));
    if (disposableKeys.length) {
      await del(disposableKeys);
    }
    await prisma.studioBatch.delete({ where: { id: batch.id } });
  }
  return batches.length;
}

export function studioBatchFingerprint(input: {
  propertyId?: string | null;
  mediaIds: string[];
  files: File[];
  prompt: string;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        propertyId: input.propertyId || null,
        mediaIds: [...input.mediaIds].sort(),
        files: input.files.map((file) => [
          file.name,
          file.size,
          file.lastModified,
        ]),
        prompt: input.prompt.trim(),
      })
    )
    .digest('hex');
}
