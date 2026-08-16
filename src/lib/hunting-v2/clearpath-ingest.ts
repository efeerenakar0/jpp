import 'server-only';

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import sanitizeHtml from 'sanitize-html';
import {
  buildPublicClearpathCachePayload,
  clearpathDatasetItemSchema,
  clearpathItemImages,
  clearpathItemPhones,
  deterministicListingRank,
  evaluateClearpathOwnerOnly,
  type ClearpathDatasetItem,
} from './clearpath-contract';
import { buildAuthorizedSourceContact } from './authorized-source-contact';
import {
  fetchApifyDatasetItems,
  fetchApifyRunState,
} from './worker-dispatch';
import {
  commitHuntJobQuota,
} from './job-service';

const SUCCESS_STATUSES = new Set(['SUCCEEDED']);
const FAILED_STATUSES = new Set([
  'FAILED',
  'ABORTED',
  'TIMED-OUT',
  'TIMED_OUT',
]);

function asText(value: unknown) {
  return value === undefined || value === null || value === ''
    ? null
    : String(value);
}

function asDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizedPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('90') ? `+${digits}` : value;
}

function addressPrecision(item: ClearpathDatasetItem) {
  if (item.latitude !== null && item.latitude !== undefined && item.longitude !== null && item.longitude !== undefined) {
    return 'EXACT' as const;
  }
  if (item.neighborhood || item.quarter) return 'NEIGHBORHOOD' as const;
  if (item.district) return 'DISTRICT' as const;
  if (item.city) return 'CITY' as const;
  return 'UNKNOWN' as const;
}

function priceAmount(item: ClearpathDatasetItem) {
  if (typeof item.price === 'number' && Number.isFinite(item.price)) return item.price;
  if (typeof item.price !== 'string') return null;
  const parsed = Number(item.price.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function completeness(item: ClearpathDatasetItem) {
  const filled = [
    item.title,
    item.formattedPrice || item.price,
    item.descriptionNormalized || item.description,
    item.city,
    item.district,
    item.neighborhood || item.quarter,
    item.images.length,
    Object.keys(item.attributes).length,
    item.sellerName,
    clearpathItemPhones(item).length,
  ].filter(Boolean).length;
  return Math.round((filled / 10) * 100);
}

function safeDescription(item: ClearpathDatasetItem) {
  const text = item.descriptionNormalized || item.description;
  if (!text) return null;
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }).trim() || null;
}

function tenantListingPayload(item: ClearpathDatasetItem) {
  return {
    publicListing: buildPublicClearpathCachePayload(item),
    sellerName: item.sellerName,
    attributes: item.attributes,
    searchAttributes: item.searchAttributes,
    description: safeDescription(item),
  } as Prisma.InputJsonValue;
}

export type ClearpathIngestSummary = {
  status: 'pending' | 'completed' | 'failed';
  raw: number;
  accepted: number;
  rejected: number;
  delivered: number;
};

/**
 * Idempotent status polling + ingestion. It is safe for the job GET route and
 * an authenticated Apify webhook to call this concurrently.
 */
export async function synchronizeClearpathJob(
  jobId: string
): Promise<ClearpathIngestSummary> {
  const job = await prisma.huntJob.findUnique({
    where: { id: jobId },
    include: {
      searchCache: true,
      sourceAuthorization: { select: { expiresAt: true } },
    },
  });
  if (!job || !job.searchCache) throw new Error('Av isi bulunamadi.');
  if (job.ingestedAt) {
    return {
      status: 'completed',
      raw: job.searchCache.totalRaw,
      accepted: job.searchCache.totalAccepted,
      rejected: job.searchCache.totalRejected,
      delivered: job.totalCompleted,
    };
  }

  let datasetId = job.apifyDatasetId || job.searchCache.apifyDatasetId;
  const effectiveRunId = job.apifyRunId || job.searchCache.apifyRunId;
  // A dataset id exists from the moment an Apify run starts and may still be
  // receiving rows. Never ingest it before the shared run is confirmed as
  // SUCCEEDED; otherwise a follower tenant could publish a partial dataset.
  if (!effectiveRunId) {
    return { status: 'pending', raw: 0, accepted: 0, rejected: 0, delivered: 0 };
  }
  if (effectiveRunId) {
    const run = await fetchApifyRunState(effectiveRunId);
    await prisma.huntJob.update({
      where: { id: job.id },
      data: {
        apifyRunId: effectiveRunId,
        apifyStatus: run.status,
        apifyDatasetId: run.defaultDatasetId || datasetId,
        lastHeartbeatAt: new Date(),
      },
    });
    datasetId ||= run.defaultDatasetId;
    if (FAILED_STATUSES.has(run.status)) {
      await prisma.huntingSearchCache.update({
        where: { id: job.searchCache.id },
        data: {
          status: 'FAILED',
          errorSummary: `Apify run ${run.status}`,
        },
      });
      // The provider run was dispatched and can be billable even on failure.
      // Consume conservatively so repeated start/fail cycles cannot bypass the
      // account cost limit.
      await commitHuntJobQuota(
        job.id,
        0,
        new Date(),
        'FAILED',
        job.quotaReserved
      );
      return { status: 'failed', raw: 0, accepted: 0, rejected: 0, delivered: 0 };
    }
    if (!SUCCESS_STATUSES.has(run.status)) {
      return { status: 'pending', raw: 0, accepted: 0, rejected: 0, delivered: 0 };
    }
  }
  if (!datasetId) return { status: 'pending', raw: 0, accepted: 0, rejected: 0, delivered: 0 };

  const rawItems = await fetchApifyDatasetItems(datasetId);
  const uniqueAccepted = new Map<string, ClearpathDatasetItem>();
  let rejected = 0;
  for (const raw of rawItems) {
    const parsed = clearpathDatasetItemSchema.safeParse(raw);
    if (!parsed.success) {
      rejected += 1;
      continue;
    }
    const decision = evaluateClearpathOwnerOnly(parsed.data, job.searchUrl);
    if (!decision.accepted) {
      rejected += 1;
      continue;
    }
    const sourceListingId = String(parsed.data.id);
    if (uniqueAccepted.has(sourceListingId)) continue;
    uniqueAccepted.set(sourceListingId, parsed.data);
  }

  const accepted = [...uniqueAccepted.entries()]
    .map(([sourceListingId, item]) => ({
      sourceListingId,
      item,
      rank: deterministicListingRank(job.searchCache!.cacheKey, sourceListingId),
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank));

  await prisma.$transaction(async (tx) => {
    for (const entry of accepted) {
      await tx.huntingSearchCacheItem.upsert({
        where: {
          searchCacheId_sourceListingId: {
            searchCacheId: job.searchCache!.id,
            sourceListingId: entry.sourceListingId,
          },
        },
        update: {
          sourceUrl: entry.item.url,
          deterministicRank: entry.rank,
          payloadJson: buildPublicClearpathCachePayload(entry.item) as Prisma.InputJsonValue,
        },
        create: {
          searchCacheId: job.searchCache!.id,
          sourceListingId: entry.sourceListingId,
          sourceUrl: entry.item.url,
          deterministicRank: entry.rank,
          payloadJson: buildPublicClearpathCachePayload(entry.item) as Prisma.InputJsonValue,
        },
      });
    }
    await tx.huntingSearchCache.update({
      where: { id: job.searchCache!.id },
      data: {
        status: 'READY',
        apifyDatasetId: datasetId,
        totalRaw: rawItems.length,
        totalAccepted: accepted.length,
        totalRejected: rejected,
        completedAt: new Date(),
      },
    });
  });

  // Never reveal the same source listing twice to the same tenant, even when
  // another query/cache contains it. A depleted pool completes with zero and
  // does not invent unsupported offsets or charge the quota.
  const previouslyDelivered = new Set(
    (
      await prisma.huntJobListing.findMany({
        where: {
          job: {
            companyAccountId: job.companyAccountId,
            id: { not: job.id },
          },
        },
        select: { listing: { select: { sourceListingId: true } } },
      })
    )
      .map(({ listing }) => listing.sourceListingId)
      .filter((value): value is string => Boolean(value))
  );
  const selected = accepted
    .filter(({ sourceListingId }) => !previouslyDelivered.has(sourceListingId))
    .slice(0, job.requestedResults);

  for (const [index, entry] of selected.entries()) {
    const item = entry.item;
    const images = clearpathItemImages(item);
    const phones = clearpathItemPhones(item).map(normalizedPhone);
    const listing = await prisma.$transaction(async (tx) => {
      const saved = await tx.huntedListing.upsert({
        where: {
          companyAccountId_sourceProvider_sourceListingId: {
            companyAccountId: job.companyAccountId,
            sourceProvider: 'SAHIBINDEN',
            sourceListingId: entry.sourceListingId,
          },
        },
        update: {
          sourceUrl: item.url,
          title: item.title,
          price: item.formattedPrice || asText(item.price),
          priceAmount: priceAmount(item),
          currency: item.currency,
          listingPublishedAt: asDate(item.listedAt),
          category: item.categoryPath[0] || null,
          subcategory: item.categoryTitle || item.categoryPath.at(-1) || null,
          sellerType: item.sellerType,
          ownerName: item.sellerName,
          descriptionText: safeDescription(item),
          sanitizedDescriptionHtml: null,
          province: item.city,
          district: item.district,
          neighborhood: item.neighborhood || item.quarter,
          latitude: item.latitude,
          longitude: item.longitude,
          addressPrecision: addressPrecision(item),
          acquisitionStatus: 'DETAIL_COMPLETE',
          completenessScore: completeness(item),
          attributesJson: item.attributes as Prisma.InputJsonValue,
          location: item.address || [item.city, item.district, item.neighborhood || item.quarter].filter(Boolean).join(' / '),
          imageUrl: images[0] || null,
          rawData: JSON.stringify(tenantListingPayload(item)),
          lastSeenAt: new Date(),
          sourceUpdatedAt: asDate(item.updatedAt) || new Date(),
          removedAt: null,
        },
        create: {
          companyAccountId: job.companyAccountId,
          huntJobId: job.id,
          sourceProvider: 'SAHIBINDEN',
          sourceListingId: entry.sourceListingId,
          sourceUrl: item.url,
          title: item.title,
          price: item.formattedPrice || asText(item.price),
          priceAmount: priceAmount(item),
          currency: item.currency,
          listingPublishedAt: asDate(item.listedAt),
          category: item.categoryPath[0] || null,
          subcategory: item.categoryTitle || item.categoryPath.at(-1) || null,
          sellerType: item.sellerType,
          ownerName: item.sellerName,
          descriptionText: safeDescription(item),
          province: item.city,
          district: item.district,
          neighborhood: item.neighborhood || item.quarter,
          latitude: item.latitude,
          longitude: item.longitude,
          addressPrecision: addressPrecision(item),
          acquisitionStatus: 'DETAIL_COMPLETE',
          completenessScore: completeness(item),
          attributesJson: item.attributes as Prisma.InputJsonValue,
          location: item.address || [item.city, item.district, item.neighborhood || item.quarter].filter(Boolean).join(' / '),
          imageUrl: images[0] || null,
          rawData: JSON.stringify(tenantListingPayload(item)),
          sourceUpdatedAt: asDate(item.updatedAt) || new Date(),
        },
      });
      await tx.huntJobListing.upsert({
        where: { jobId_listingId: { jobId: job.id, listingId: saved.id } },
        update: { position: index + 1 },
        create: { jobId: job.id, listingId: saved.id, position: index + 1 },
      });
      for (const [imageIndex, sourceUrl] of images.entries()) {
        await tx.huntedListingImage.upsert({
          where: { listingId_sourceUrl: { listingId: saved.id, sourceUrl } },
          update: { order: imageIndex + 1 },
          create: { listingId: saved.id, sourceUrl, order: imageIndex + 1 },
        });
      }
      for (const phone of phones) {
        const contact = buildAuthorizedSourceContact({
          phone,
          sourceUrl: item.url,
          authorizationExpiresAt: job.sourceAuthorization.expiresAt,
        });
        await tx.huntedContact.upsert({
          where: {
            companyAccountId_phoneHmac_listingId: {
              companyAccountId: job.companyAccountId,
              phoneHmac: contact.phoneHmac,
              listingId: saved.id,
            },
          },
          update: contact,
          create: {
            ...contact,
            companyAccountId: job.companyAccountId,
            listingId: saved.id,
          },
        });
      }
      return saved;
    });
    void listing;
  }

  await commitHuntJobQuota(
    job.id,
    selected.length,
    new Date(),
    'COMPLETED',
    job.cacheHit
      ? selected.length
      : Math.min(rawItems.length, job.quotaReserved)
  );
  return {
    status: 'completed',
    raw: rawItems.length,
    accepted: accepted.length,
    rejected,
    delivered: selected.length,
  };
}
