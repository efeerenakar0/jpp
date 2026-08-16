import { createHash, randomUUID } from 'node:crypto';
import { NotificationType, type Prisma } from '@prisma/client';
import { del, head } from '@vercel/blob';
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
  enhanceStudioImage,
  resolveStudioImageEngine,
  resolveStudioImageModelTier,
  StudioImageError,
} from '@/lib/studio-image-engine';
import {
  OPENROUTER_STUDIO_FLUX_IMAGE_MODEL,
  OpenRouterStudioImageError,
} from '@/lib/openrouter-studio-image';
import {
  studioItemFailureTransition,
  studioItemLeaseExpiry,
} from '@/lib/studio-batch-lease';
import {
  isStudioImageType,
  STUDIO_MAX_FILE_BYTES,
  STUDIO_MAX_PHOTOS,
  STUDIO_MAX_TOTAL_BYTES,
  studioUploadAccountPrefix,
  studioUploadFileName,
  type StudioUploadedFile,
} from '@/lib/studio-upload';
import { createCompanyNotification } from '@/lib/fabrika-notifications';

export const STUDIO_BATCH_MAX_ITEMS = STUDIO_MAX_PHOTOS;
export const STUDIO_BATCH_MAX_CONCURRENT_ITEMS = 5;
const STUDIO_BATCH_RETENTION_DAYS = 7;

const LEGACY_STUDIO_SAFETY_ERROR_MARKERS = [
  'guvenlik icin bu sonuc kaydedilmedi',
  'güvenlik kontrolünde reddedildi',
  'guvenlik kontrolunde reddedildi',
  'yapay zeka gecersiz bir gorsel dondurdu',
] as const;

export function isLegacyStudioSafetyFailure(message?: string | null) {
  const normalized = message?.trim().toLocaleLowerCase('tr-TR') ?? '';
  return LEGACY_STUDIO_SAFETY_ERROR_MARKERS.some((marker) =>
    normalized.includes(marker)
  );
}

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
  uploadedFiles?: StudioUploadedFile[];
  prompt: string;
  preset?: string | null;
  title?: string | null;
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
  const uploadedFiles = input.uploadedFiles ?? [];
  const mediaIds = [...new Set(input.mediaIds ?? [])];
  if (files.length) validatePropertyMediaFiles(files);
  const totalItems = files.length + uploadedFiles.length + mediaIds.length;
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
  if (new Set(uploadedFiles.map((file) => file.pathname)).size !== uploadedFiles.length) {
    throw new PropertyMediaError('Aynı yüklenmiş fotoğraf birden fazla kez gönderilemez.');
  }

  const ownedUploadPrefix = `${studioUploadAccountPrefix(input.actor.companyAccountId)}/`;
  const verifiedUploads = await Promise.all(
    uploadedFiles.map(async (file) => {
      if (
        !file.url.startsWith('https://') ||
        !file.pathname.startsWith(ownedUploadPrefix) ||
        file.pathname.includes('..') ||
        !isStudioImageType(file.mimeType) ||
        file.byteSize <= 0 ||
        file.byteSize > STUDIO_MAX_FILE_BYTES
      ) {
        throw new PropertyMediaError('Yüklenen fotoğraflardan biri geçersiz.');
      }
      const blob = await head(file.url);
      if (
        blob.pathname !== file.pathname ||
        !blob.pathname.startsWith(ownedUploadPrefix) ||
        !isStudioImageType(blob.contentType) ||
        blob.size <= 0 ||
        blob.size > STUDIO_MAX_FILE_BYTES
      ) {
        throw new PropertyMediaError('Yüklenen fotoğraf doğrulanamadı.');
      }
      return {
        ...file,
        url: blob.url,
        pathname: blob.pathname,
        mimeType: blob.contentType,
        byteSize: blob.size,
        fileName: studioUploadFileName(file.fileName),
      };
    })
  );
  const totalUploadBytes =
    files.reduce((total, file) => total + file.size, 0) +
    verifiedUploads.reduce((total, file) => total + file.byteSize, 0);
  if (totalUploadBytes > STUDIO_MAX_TOTAL_BYTES) {
    throw new PropertyMediaError('Seçilen fotoğrafların toplam boyutu 120 MB sınırını aşıyor.');
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
      title: input.title?.trim().slice(0, 180) || null,
      prompt,
      preset: input.preset || null,
      provider: 'OPENROUTER',
      model: OPENROUTER_STUDIO_FLUX_IMAGE_MODEL,
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
    verifiedUploads.forEach((file, uploadIndex) => {
      itemData.push({
        batchId: batch.id,
        sourceMediaId: null,
        originalUrl: file.url,
        originalStorageKey: file.pathname,
        originalFileName: file.fileName,
        originalMimeType: file.mimeType,
        originalWidth: null,
        originalHeight: null,
        originalByteSize: file.byteSize,
        sortOrder: ownedMedia.length + uploadIndex,
        fingerprint: `blob:${file.pathname}`,
        status: 'PENDING',
      });
    });
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
        sortOrder: ownedMedia.length + verifiedUploads.length + fileIndex,
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

    // İş tamamlandığında kullanıcı sayfada olmasa da Bildirimler > Tümü
    // altında görünsün. Aynı batch yeniden senkron edilirse dedupeKey ikinci
    // bir bildirim oluşmasını engeller.
    try {
      const readyCount = items.filter((item) =>
        ['COMPLETED', 'ATTACHED'].includes(item.status),
      ).length;
      const failedCount = items.filter((item) => item.status === 'FAILED').length;
      const title =
        status === 'COMPLETED' || status === 'ATTACHED'
          ? 'Stüdyo görselleri hazır'
          : status === 'PARTIAL'
            ? 'Stüdyo işlemi kısmen tamamlandı'
            : 'Stüdyo İşleme Hatası';
      const message =
        status === 'COMPLETED' || status === 'ATTACHED'
          ? `${readyCount} fotoğraf iyileştirildi. Sonuçları görmek için çalışmayı açabilirsiniz.`
          : status === 'PARTIAL'
            ? `${readyCount} fotoğraf hazır, ${failedCount} fotoğraf tekrar denenebilir.`
            : 'Fotoğraflar işlenemedi. Stüdyo geçmişinden tekrar deneyebilirsiniz.';
      await createCompanyNotification({
        companyAccountId: batch.companyAccountId,
        type: NotificationType.STUDIO_READY,
        title,
        message,
        link: '/fabrika/studyo#studio-recent',
        important: status === 'FAILED' || status === 'PARTIAL',
        dedupeKey: `studio-ready:${batchId}:${status}`,
        metadata: { batchId, status, readyCount, failedCount, itemCount: items.length },
      });
    } catch (notificationError) {
      // Bildirim üretilememesi görsel işinin başarısını etkilememeli.
      console.warn('[Studio notification warning]', notificationError);
    }
  }
}

export async function processStudioBatchItem(input: {
  actor: PropertyMediaActor;
  batchId: string;
  itemId: string;
  leaseOwner?: string;
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
  let effectiveLeaseOwner = input.leaseOwner;
  if (input.leaseOwner) {
    if (item.status !== 'PROCESSING' || item.leaseOwner !== input.leaseOwner) {
      throw new PropertyMediaError('Bu fotograf baska bir islem tarafindan ele alinmis.', 409);
    }
  } else {
    effectiveLeaseOwner = `studio-browser:${randomUUID()}`;
    const now = new Date();
    const claimed = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`studio-batch:${item.batchId}`}))::text
      `;
      const activeInBatch = await tx.studioBatchItem.count({
        where: {
          batchId: item.batchId,
          status: 'PROCESSING',
          leaseExpiresAt: { gt: now },
        },
      });
      if (activeInBatch >= STUDIO_BATCH_MAX_CONCURRENT_ITEMS) {
        return { count: 0, capacityReached: true };
      }
      const result = await tx.studioBatchItem.updateMany({
        where: {
          id: item.id,
          batchId: item.batchId,
          OR: [
            { status: { in: ['PENDING', 'FAILED'] } },
            { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
          ],
        },
        data: {
          status: 'PROCESSING',
          errorMessage: null,
          leaseOwner: effectiveLeaseOwner,
          leaseExpiresAt: studioItemLeaseExpiry(now),
          nextAttemptAt: null,
          lastAttemptAt: now,
          attemptCount: { increment: 1 },
        },
      });
      return { count: result.count, capacityReached: false };
    });
    if (claimed.capacityReached) {
      throw new PropertyMediaError(
        `Ayni anda en fazla ${STUDIO_BATCH_MAX_CONCURRENT_ITEMS} fotograf islenebilir.`,
        429
      );
    }
    if (!claimed.count) {
      const latest = await prisma.studioBatchItem.findUnique({ where: { id: item.id } });
      if (
        latest &&
        (latest.status === 'ATTACHED' ||
          (latest.status === 'COMPLETED' && latest.outputUrl))
      ) {
        return latest;
      }
      throw new PropertyMediaError('Bu fotograf zaten isleniyor.', 409);
    }
  }
  if (!effectiveLeaseOwner) {
    throw new PropertyMediaError('Fotograf islem kilidi olusturulamadi.', 500);
  }
  await prisma.studioBatch.update({
    where: { id: item.batchId },
    data: { status: 'PROCESSING', startedAt: item.batch.startedAt ?? new Date() },
  });
  try {
    const source = await fetchOwnedMediaBytes(item.originalUrl, {
      maxBytes: 9 * 1024 * 1024,
    });
    const useSafeLocalRetry =
      item.status === 'FAILED' && isLegacyStudioSafetyFailure(item.errorMessage);
    const processed = await enhanceStudioImage({
      engine:
        item.batch.model === OPENROUTER_STUDIO_FLUX_IMAGE_MODEL
          ? 'REALISTIC'
          : resolveStudioImageEngine(item.batch.preset),
      modelTier: useSafeLocalRetry
        ? 'STANDARD'
        : resolveStudioImageModelTier(item.batch.model),
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
    const completed = await prisma.studioBatchItem.updateMany({
      where: {
        id: item.id,
        status: 'PROCESSING',
        leaseOwner: effectiveLeaseOwner,
      },
      data: {
        status: 'COMPLETED',
        outputUrl: stored.url,
        outputStorageKey: stored.storageKey,
        outputFileName: stored.fileName,
        outputMimeType: stored.mimeType,
        outputWidth: processed.width,
        outputHeight: processed.height,
        outputByteSize: stored.byteSize,
        errorMessage: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
      },
    });
    if (!completed.count) {
      throw new PropertyMediaError('Fotograf sonucu guvenli bicimde kaydedilemedi.', 409);
    }
    const updated = await prisma.studioBatchItem.findUniqueOrThrow({
      where: { id: item.id },
    });
    await refreshBatchStatus(item.batchId);
    return updated;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Görsel işlenemedi.';
    if (!input.leaseOwner) {
      await prisma.studioBatchItem.updateMany({
        where: {
          id: item.id,
          status: 'PROCESSING',
          leaseOwner: effectiveLeaseOwner,
        },
        data: {
          status: 'FAILED',
          errorMessage: message.slice(0, 2_000),
          leaseOwner: null,
          leaseExpiresAt: null,
          nextAttemptAt: null,
        },
      });
      await refreshBatchStatus(item.batchId);
    }
    throw error;
  }
}

type ProcessStudioItem = typeof processStudioBatchItem;

export async function processNextStudioBatchItem(input: {
  now?: Date;
  workerId?: string;
  processItem?: ProcessStudioItem;
} = {}) {
  const now = input.now ?? new Date();
  const workerId = input.workerId ?? `studio-worker:${randomUUID()}`;
  const processItem = input.processItem ?? processStudioBatchItem;
  const candidate = await prisma.studioBatchItem.findFirst({
    where: {
      batch: {
        expiresAt: { gt: now },
        status: { in: ['PENDING', 'PROCESSING', 'PARTIAL'] },
      },
      OR: [
        {
          status: 'PENDING',
          AND: [
            { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
            { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
          ],
        },
        { status: 'PROCESSING', leaseExpiresAt: { lte: now } },
      ],
    },
    include: {
      batch: { select: { id: true, companyAccountId: true, createdByMemberId: true } },
    },
    orderBy: [{ batch: { createdAt: 'asc' } }, { sortOrder: 'asc' }],
  });
  if (!candidate) return null;

  const activeInBatch = await prisma.studioBatchItem.count({
    where: {
      batchId: candidate.batch.id,
      status: 'PROCESSING',
      leaseExpiresAt: { gt: now },
    },
  });
  if (activeInBatch >= STUDIO_BATCH_MAX_CONCURRENT_ITEMS) return null;

  const claimed = await prisma.studioBatchItem.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
      ],
    },
    data: {
      status: 'PROCESSING',
      errorMessage: null,
      leaseOwner: workerId,
      leaseExpiresAt: studioItemLeaseExpiry(now),
      nextAttemptAt: null,
      lastAttemptAt: now,
      attemptCount: { increment: 1 },
    },
  });
  if (!claimed.count) return null;

  try {
    const item = await processItem({
      actor: {
        companyAccountId: candidate.batch.companyAccountId,
        memberId: candidate.batch.createdByMemberId,
      },
      batchId: candidate.batch.id,
      itemId: candidate.id,
      leaseOwner: workerId,
    });
    return { ok: true as const, batchId: candidate.batch.id, itemId: item.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Görsel işlenemedi.';
    const transition = studioItemFailureTransition({
      attemptCount: candidate.attemptCount + 1,
      now,
      message,
      retryable:
        error instanceof OpenRouterStudioImageError
          ? error.code === 'PROVIDER_ERROR'
          : !(error instanceof StudioImageError),
    });
    await prisma.studioBatchItem.updateMany({
      where: {
        id: candidate.id,
        status: 'PROCESSING',
        leaseOwner: workerId,
      },
      data: transition,
    });
    await refreshBatchStatus(candidate.batch.id);
    return {
      ok: false as const,
      batchId: candidate.batch.id,
      itemId: candidate.id,
      error: message,
      retryScheduled: transition.status === 'PENDING',
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
  uploadedFiles?: StudioUploadedFile[];
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
        uploadedFiles: (input.uploadedFiles ?? []).map((file) => file.pathname).sort(),
        prompt: input.prompt.trim(),
        model: OPENROUTER_STUDIO_FLUX_IMAGE_MODEL,
      })
    )
    .digest('hex');
}
