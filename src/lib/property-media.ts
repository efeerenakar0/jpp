import type {
  MediaUsageRightsStatus,
  Prisma,
  PropertyMediaSource,
  PropertyMediaType,
  PropertyMediaVariant,
} from '@prisma/client';
import prisma from '@/lib/prisma';

export class PropertyMediaError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export type PropertyMediaActor = {
  companyAccountId: string;
  memberId: string | null;
};

export async function assertOwnedProperty(
  actor: PropertyMediaActor,
  propertyId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  const property = await client.crmProperty.findFirst({
    where: {
      id: propertyId,
      companyAccountId: actor.companyAccountId,
    },
    select: {
      id: true,
      title: true,
      imageUrl: true,
      companyAccountId: true,
    },
  });
  if (!property) {
    throw new PropertyMediaError('Portföy bulunamadı veya erişim izniniz yok.', 404);
  }
  return property;
}

export async function listPropertyMedia(
  actor: PropertyMediaActor,
  propertyId: string,
  options: { includeArchived?: boolean } = {}
) {
  const property = await assertOwnedProperty(actor, propertyId);
  const items = await prisma.crmPropertyMedia.findMany({
    where: {
      companyAccountId: actor.companyAccountId,
      propertyId,
      ...(options.includeArchived ? {} : { archivedAt: null }),
    },
    include: {
      variants: {
        where: options.includeArchived ? {} : { archivedAt: null },
        orderBy: [{ createdAt: 'desc' }],
      },
      parentMedia: {
        select: {
          id: true,
          url: true,
          fileName: true,
          variantType: true,
        },
      },
    },
    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return { property, items };
}

export type NewPropertyMedia = {
  url: string;
  storageKey?: string | null;
  fileName: string;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  byteSize?: number | null;
  mediaType?: PropertyMediaType;
  source?: PropertyMediaSource;
  variantType?: PropertyMediaVariant;
  parentMediaId?: string | null;
  prompt?: string | null;
  aiProvider?: string | null;
  aiModel?: string | null;
  usageRightsStatus?: MediaUsageRightsStatus;
  fingerprint?: string | null;
  provenance?: Prisma.InputJsonValue;
};

export async function addPropertyMedia(
  actor: PropertyMediaActor,
  propertyId: string,
  inputs: NewPropertyMedia[],
  options: { makeFirstCover?: boolean; activityTitle?: string } = {}
) {
  if (!inputs.length) {
    throw new PropertyMediaError('Kaydedilecek görsel bulunamadı.');
  }
  return prisma.$transaction(async (tx) => {
    const property = await assertOwnedProperty(actor, propertyId, tx);
    const existingCount = await tx.crmPropertyMedia.count({
      where: { propertyId, archivedAt: null },
    });
    const hasCover = await tx.crmPropertyMedia.findFirst({
      where: { propertyId, archivedAt: null, isCover: true },
      select: { id: true },
    });
    const created = [];
    const newlyCreated = [];
    let coverExists = Boolean(hasCover);
    let nextSortOrder = existingCount;
    const shouldMakeFirstCover =
      options.makeFirstCover ?? existingCount === 0;
    for (const input of inputs) {
      if (input.fingerprint) {
        const existing = await tx.crmPropertyMedia.findUnique({
          where: {
            companyAccountId_propertyId_fingerprint: {
              companyAccountId: actor.companyAccountId,
              propertyId,
              fingerprint: input.fingerprint,
            },
          },
        });
        if (existing) {
          if (existing.archivedAt) {
            const isCover =
              !coverExists &&
              shouldMakeFirstCover &&
              existing.mediaType === 'PHOTO' &&
              existing.variantType !== 'CREATIVE';
            const restored = await tx.crmPropertyMedia.update({
              where: { id: existing.id },
              data: {
                archivedAt: null,
                sortOrder: nextSortOrder++,
                isCover,
                usageRightsStatus:
                  input.usageRightsStatus ?? existing.usageRightsStatus,
              },
            });
            if (isCover) {
              coverExists = true;
              await tx.crmProperty.update({
                where: { id: propertyId },
                data: { imageUrl: restored.url },
              });
            }
            created.push(restored);
            newlyCreated.push(restored);
          } else {
            created.push(existing);
          }
          continue;
        }
      }
      if (input.parentMediaId) {
        const parent = await tx.crmPropertyMedia.findFirst({
          where: {
            id: input.parentMediaId,
            propertyId,
            companyAccountId: actor.companyAccountId,
            archivedAt: null,
          },
          select: { id: true },
        });
        if (!parent) {
          throw new PropertyMediaError(
            'Orijinal görsel bu portföye ait değil.',
            403
          );
        }
      }
      const isCover =
        !coverExists &&
        shouldMakeFirstCover &&
        (input.mediaType ?? 'PHOTO') === 'PHOTO' &&
        (input.variantType ?? 'ORIGINAL') !== 'CREATIVE';
      const item = await tx.crmPropertyMedia.create({
        data: {
          companyAccountId: actor.companyAccountId,
          propertyId,
          url: input.url,
          storageKey: input.storageKey,
          fileName: input.fileName,
          mimeType: input.mimeType,
          width: input.width,
          height: input.height,
          byteSize: input.byteSize,
          sortOrder: nextSortOrder++,
          isCover,
          mediaType: input.mediaType ?? 'PHOTO',
          source: input.source ?? 'MANUAL_UPLOAD',
          variantType: input.variantType ?? 'ORIGINAL',
          parentMediaId: input.parentMediaId,
          prompt: input.prompt,
          aiProvider: input.aiProvider,
          aiModel: input.aiModel,
          usageRightsStatus: input.usageRightsStatus ?? 'CONFIRMED',
          fingerprint: input.fingerprint,
          provenance: input.provenance,
          createdByMemberId: actor.memberId,
        },
      });
      created.push(item);
      newlyCreated.push(item);
      if (isCover) {
        coverExists = true;
        await tx.crmProperty.update({
          where: { id: propertyId },
          data: { imageUrl: item.url },
        });
      }
    }
    if (newlyCreated.length) {
      await tx.crmActivity.create({
        data: {
          companyAccountId: actor.companyAccountId,
          propertyId,
          actorMemberId: actor.memberId,
          type: 'PROPERTY_MEDIA_ADDED',
          title:
            options.activityTitle ??
            `${newlyCreated.length} görsel portföye eklendi`,
          description: `${property.title} medya kütüphanesi güncellendi.`,
          metadata: JSON.stringify({
            mediaIds: newlyCreated.map((item) => item.id),
          }),
        },
      });
    }
    return created;
  });
}

export async function updatePropertyMedia(
  actor: PropertyMediaActor,
  propertyId: string,
  mediaId: string,
  input: {
    isCover?: boolean;
    sortOrder?: number;
    usageRightsStatus?: MediaUsageRightsStatus;
    fileName?: string;
  }
) {
  return prisma.$transaction(async (tx) => {
    await assertOwnedProperty(actor, propertyId, tx);
    const media = await tx.crmPropertyMedia.findFirst({
      where: {
        id: mediaId,
        propertyId,
        companyAccountId: actor.companyAccountId,
        archivedAt: null,
      },
    });
    if (!media) {
      throw new PropertyMediaError('Görsel bulunamadı.', 404);
    }
    if (
      input.isCover &&
      (media.mediaType !== 'PHOTO' || media.variantType === 'CREATIVE')
    ) {
      throw new PropertyMediaError(
        'Kreatif veya pazarlama görseli portföy kapağı yapılamaz.'
      );
    }
    if (input.isCover) {
      await tx.crmPropertyMedia.updateMany({
        where: { propertyId, archivedAt: null, isCover: true },
        data: { isCover: false },
      });
    }
    const updated = await tx.crmPropertyMedia.update({
      where: { id: mediaId },
      data: {
        ...(typeof input.isCover === 'boolean'
          ? { isCover: input.isCover }
          : {}),
        ...(Number.isInteger(input.sortOrder) && input.sortOrder! >= 0
          ? { sortOrder: input.sortOrder }
          : {}),
        ...(input.usageRightsStatus
          ? { usageRightsStatus: input.usageRightsStatus }
          : {}),
        ...(input.fileName?.trim()
          ? { fileName: input.fileName.trim().slice(0, 160) }
          : {}),
      },
    });
    if (input.isCover) {
      await tx.crmProperty.update({
        where: { id: propertyId },
        data: { imageUrl: updated.url },
      });
    }
    return updated;
  });
}

export async function reorderPropertyMedia(
  actor: PropertyMediaActor,
  propertyId: string,
  orderedIds: string[]
) {
  if (!orderedIds.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new PropertyMediaError('Görsel sıralaması geçersiz.');
  }
  return prisma.$transaction(async (tx) => {
    await assertOwnedProperty(actor, propertyId, tx);
    const ownedCount = await tx.crmPropertyMedia.count({
      where: {
        id: { in: orderedIds },
        propertyId,
        companyAccountId: actor.companyAccountId,
        archivedAt: null,
      },
    });
    if (ownedCount !== orderedIds.length) {
      throw new PropertyMediaError(
        'Sıralamadaki görsellerden biri bu portföye ait değil.',
        403
      );
    }
    await Promise.all(
      orderedIds.map((id, sortOrder) =>
        tx.crmPropertyMedia.update({ where: { id }, data: { sortOrder } })
      )
    );
    return true;
  });
}

export async function archivePropertyMedia(
  actor: PropertyMediaActor,
  propertyId: string,
  mediaIds: string[]
) {
  const uniqueIds = [...new Set(mediaIds)];
  if (!uniqueIds.length) {
    throw new PropertyMediaError('Arşivlenecek görsel seçin.');
  }
  return prisma.$transaction(async (tx) => {
    await assertOwnedProperty(actor, propertyId, tx);
    const owned = await tx.crmPropertyMedia.findMany({
      where: {
        id: { in: uniqueIds },
        propertyId,
        companyAccountId: actor.companyAccountId,
        archivedAt: null,
      },
      select: { id: true, isCover: true },
    });
    if (owned.length !== uniqueIds.length) {
      throw new PropertyMediaError(
        'Seçilen görsellerden biri bu portföye ait değil.',
        403
      );
    }
    const archivedAt = new Date();
    await tx.crmPropertyMedia.updateMany({
      where: { id: { in: uniqueIds } },
      data: { archivedAt, isCover: false },
    });
    if (owned.some((item) => item.isCover)) {
      const replacement = await tx.crmPropertyMedia.findFirst({
        where: {
          propertyId,
          archivedAt: null,
          mediaType: 'PHOTO',
          variantType: { not: 'CREATIVE' },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      if (replacement) {
        await tx.crmPropertyMedia.update({
          where: { id: replacement.id },
          data: { isCover: true },
        });
      }
      await tx.crmProperty.update({
        where: { id: propertyId },
        data: { imageUrl: replacement?.url ?? null },
      });
    }
    return { archivedCount: owned.length };
  });
}

export async function attachStudioBatchItems(input: {
  actor: PropertyMediaActor;
  batchId: string;
  propertyId: string;
  itemIds?: string[];
}) {
  return prisma.$transaction(async (tx) => {
    await assertOwnedProperty(input.actor, input.propertyId, tx);
    const batch = await tx.studioBatch.findFirst({
      where: {
        id: input.batchId,
        companyAccountId: input.actor.companyAccountId,
      },
      include: {
        items: {
          where: {
            status: { in: ['COMPLETED', 'ATTACHED'] },
            ...(input.itemIds?.length
              ? { id: { in: [...new Set(input.itemIds)] } }
              : {}),
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!batch) {
      throw new PropertyMediaError('Stüdyo işlemi bulunamadı.', 404);
    }
    if (batch.propertyId && batch.propertyId !== input.propertyId) {
      throw new PropertyMediaError(
        'Bu Stüdyo işlemi farklı bir portföye bağlı.',
        403
      );
    }
    if (!batch.items.length) {
      throw new PropertyMediaError('Portföye eklenecek hazır sonuç yok.');
    }
    const attached = [];
    const newlyAttached = [];
    for (const item of batch.items) {
      if (item.attachedMediaId) {
        const existing = await tx.crmPropertyMedia.findFirst({
          where: {
            id: item.attachedMediaId,
            propertyId: input.propertyId,
            companyAccountId: input.actor.companyAccountId,
          },
        });
        if (existing) {
          attached.push(existing);
          continue;
        }
        throw new PropertyMediaError(
          'Seçilen Stüdyo sonucu daha önce başka bir portföye eklenmiş.',
          409
        );
      }
      if (!item.outputUrl || !item.outputFileName || !item.outputMimeType) {
        continue;
      }
      let sourceMediaId = item.sourceMediaId;
      if (!sourceMediaId) {
        const sourceFingerprint = `studio-source:${item.id}`;
        const existingSource = await tx.crmPropertyMedia.findFirst({
          where: {
            companyAccountId: input.actor.companyAccountId,
            propertyId: input.propertyId,
            fingerprint: sourceFingerprint,
          },
        });
        const sourceMedia =
          existingSource ??
          (await tx.crmPropertyMedia.create({
            data: {
              companyAccountId: input.actor.companyAccountId,
              propertyId: input.propertyId,
              url: item.originalUrl,
              storageKey: item.originalStorageKey,
              fileName: item.originalFileName,
              mimeType: item.originalMimeType,
              width: item.originalWidth,
              height: item.originalHeight,
              byteSize: item.originalByteSize,
              sortOrder: 9_000 + item.sortOrder,
              mediaType: 'PHOTO',
              source: 'MANUAL_UPLOAD',
              variantType: 'ORIGINAL',
              usageRightsStatus: 'CONFIRMED',
              fingerprint: sourceFingerprint,
              provenance: {
                studioBatchId: batch.id,
                studioBatchItemId: item.id,
                role: 'ORIGINAL_SOURCE',
              },
              createdByMemberId: input.actor.memberId,
            },
          }));
        sourceMediaId = sourceMedia.id;
      }
      const fingerprint = `studio-item:${item.id}`;
      const existing = await tx.crmPropertyMedia.findFirst({
        where: {
          companyAccountId: input.actor.companyAccountId,
          propertyId: input.propertyId,
          fingerprint,
        },
      });
      const media =
        existing ??
        (await tx.crmPropertyMedia.create({
          data: {
            companyAccountId: input.actor.companyAccountId,
            propertyId: input.propertyId,
            url: item.outputUrl,
            storageKey: item.outputStorageKey,
            fileName: item.outputFileName,
            mimeType: item.outputMimeType,
            width: item.outputWidth,
            height: item.outputHeight,
            byteSize: item.outputByteSize,
            sortOrder: 10_000 + item.sortOrder,
            mediaType: 'PHOTO',
            source: 'STUDIO_ENHANCED',
            variantType: 'ENHANCED',
            parentMediaId: sourceMediaId,
            prompt: batch.prompt,
            aiProvider: batch.provider,
            aiModel: batch.model,
            usageRightsStatus: 'CONFIRMED',
            fingerprint,
            provenance: {
              batchId: batch.id,
              batchItemId: item.id,
              preset: batch.preset,
            },
            createdByMemberId: input.actor.memberId,
          },
        }));
      await tx.studioBatchItem.update({
        where: { id: item.id },
        data: {
          sourceMediaId,
          attachedMediaId: media.id,
          status: 'ATTACHED',
        },
      });
      attached.push(media);
      newlyAttached.push(media);
    }
    const remaining = await tx.studioBatchItem.count({
      where: { batchId: batch.id, status: 'COMPLETED' },
    });
    await tx.studioBatch.update({
      where: { id: batch.id },
      data: { status: remaining ? 'PARTIAL' : 'ATTACHED' },
    });
    if (newlyAttached.length) {
      await tx.crmActivity.create({
        data: {
          companyAccountId: input.actor.companyAccountId,
          propertyId: input.propertyId,
          actorMemberId: input.actor.memberId,
          type: 'STUDIO_MEDIA_ATTACHED',
          title: `${newlyAttached.length} Stüdyo çıktısı portföye eklendi`,
          metadata: JSON.stringify({
            batchId: batch.id,
            mediaIds: newlyAttached.map((media) => media.id),
          }),
        },
      });
    }
    return attached;
  });
}

export async function importHuntedListingMedia(input: {
  tx: Prisma.TransactionClient;
  actor: PropertyMediaActor;
  propertyId: string;
  huntedListingId: string;
  fallbackImageUrl?: string | null;
}) {
  const images = await input.tx.huntedListingImage.findMany({
    where: { listingId: input.huntedListingId },
    orderBy: { order: 'asc' },
  });
  const candidates =
    images.length > 0
      ? images.map((image) => ({
          key: image.id,
          url: image.storageKey || image.sourceUrl,
          storageKey: image.storageKey,
          fileName: `hunter-${image.order + 1}.${image.mimeType === 'image/png' ? 'png' : image.mimeType === 'image/webp' ? 'webp' : 'jpg'}`,
          mimeType: image.mimeType || 'image/jpeg',
          width: image.width,
          height: image.height,
          byteSize: image.byteSize,
          sortOrder: image.order,
        }))
      : input.fallbackImageUrl
        ? [
            {
              key: `fallback:${input.fallbackImageUrl}`,
              url: input.fallbackImageUrl,
              storageKey: null,
              fileName: 'hunter-cover.jpg',
              mimeType: 'image/jpeg',
              width: null,
              height: null,
              byteSize: null,
              sortOrder: 0,
            },
          ]
        : [];
  if (!candidates.length) return [];
  const hasCover = await input.tx.crmPropertyMedia.findFirst({
    where: { propertyId: input.propertyId, archivedAt: null, isCover: true },
    select: { id: true },
  });
  const created = [];
  for (const [index, image] of candidates.entries()) {
    const fingerprint = `hunter:${image.key}`;
    const existing = await input.tx.crmPropertyMedia.findFirst({
      where: {
        companyAccountId: input.actor.companyAccountId,
        propertyId: input.propertyId,
        fingerprint,
      },
    });
    if (existing) {
      created.push(existing);
      continue;
    }
    const isCover = !hasCover && index === 0;
    const media = await input.tx.crmPropertyMedia.create({
      data: {
        companyAccountId: input.actor.companyAccountId,
        propertyId: input.propertyId,
        url: image.url,
        storageKey: image.storageKey,
        fileName: image.fileName,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        byteSize: image.byteSize,
        sortOrder: image.sortOrder,
        isCover,
        mediaType: 'PHOTO',
        source: 'HUNTER',
        variantType: 'ORIGINAL',
        usageRightsStatus: 'UNVERIFIED',
        fingerprint,
        provenance: {
          huntedListingId: input.huntedListingId,
          source: 'HUNTER',
        },
        createdByMemberId: input.actor.memberId,
      },
    });
    if (isCover) {
      await input.tx.crmProperty.update({
        where: { id: input.propertyId },
        data: { imageUrl: media.url },
      });
    }
    created.push(media);
  }
  return created;
}
