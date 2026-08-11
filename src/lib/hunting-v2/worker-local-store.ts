import 'server-only';

import sanitizeHtml from 'sanitize-html';
import prisma from '@/lib/prisma';
import { buildAuthorizedSourceContact } from './authorized-source-contact';
import { copyHuntingImage } from './media';
import {
  assertAllowedMediaUrl,
  assertAllowedSourceUrl,
} from './security';
import type {
  ParsedListingDetail,
  ParsedSearchListing,
  SourceProvider,
} from './types';
import { buildWorkerLease } from './worker-lease';
import type {
  HuntWorkerJob,
  HuntWorkerProgress,
} from './worker-protocol';
import type {
  HuntWorkerDirective,
  HuntWorkerStore,
} from './worker-store';

const REQUIRED_SCOPES = [
  'SEARCH_READ',
  'DETAIL_READ',
  'MEDIA_READ',
  'CONTACT_READ',
] as const;

type LocalStoreOptions = {
  jobId?: string;
  allowMediaCopy?: boolean;
};

async function loadFullJob(jobId: string) {
  return prisma.huntJob.findUnique({
    where: { id: jobId },
    include: { sourceAuthorization: true },
  });
}

type FullJob = NonNullable<Awaited<ReturnType<typeof loadFullJob>>>;

function publicJob(job: FullJob): HuntWorkerJob {
  return {
    id: job.id,
    provider: job.provider,
    searchUrl: job.searchUrl,
    status: job.status,
    startedAt: job.startedAt?.toISOString() || null,
  };
}

function hasCurrentAuthorization(job: FullJob) {
  const authorization = job.sourceAuthorization;
  const now = new Date();
  return (
    authorization.companyAccountId === job.companyAccountId &&
    authorization.provider === job.provider &&
    authorization.status === 'ACTIVE' &&
    authorization.startsAt <= now &&
    (!authorization.expiresAt || authorization.expiresAt > now) &&
    REQUIRED_SCOPES.every((scope) =>
      authorization.allowedScopes.includes(scope)
    )
  );
}

async function requireRunnableJob(jobId: string) {
  const job = await loadFullJob(jobId);
  if (!job || job.status !== 'RUNNING') {
    throw new Error('Worker isi artik calistirilabilir durumda degil.');
  }
  if (!hasCurrentAuthorization(job)) {
    await prisma.huntJob.updateMany({
      where: { id: jobId, status: 'RUNNING' },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
        errorSummary:
          'Kaynak yetkisi artik gecerli degil; is guvenli bicimde duraklatildi.',
      },
    });
    throw new Error('Worker kaynak yetkisi artik gecerli degil.');
  }
  return job;
}

function progressData(progress: HuntWorkerProgress) {
  return {
    totalDiscovered: progress.discovered,
    totalCompleted: progress.completed,
    totalPartial: progress.partial,
    totalFailed: progress.failed,
    lastHeartbeatAt: new Date(),
  };
}

function locationText(detail: ParsedListingDetail) {
  return [
    detail.province,
    detail.district,
    detail.neighborhood,
    detail.street,
  ]
    .filter(Boolean)
    .join(' / ');
}

function sanitizeDescription(value: string | null) {
  if (!value) return null;
  return sanitizeHtml(value, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'ul',
      'ol',
      'li',
      'a',
    ],
    allowedAttributes: { a: ['href', 'title'] },
    allowedSchemes: ['https', 'http', 'mailto'],
  });
}

async function assertListingCapacity(
  job: FullJob,
  sourceListingIds: string[]
) {
  const uniqueIds = [...new Set(sourceListingIds)];
  const [currentCount, alreadyInJob] = await Promise.all([
    prisma.huntedListing.count({ where: { huntJobId: job.id } }),
    prisma.huntedListing.count({
      where: {
        huntJobId: job.id,
        sourceProvider: job.provider,
        sourceListingId: { in: uniqueIds },
      },
    }),
  ]);
  if (currentCount + uniqueIds.length - alreadyInJob > 11) {
    throw new Error('Bir av isine en fazla 11 ilan yazilabilir.');
  }
}

async function upsertDiscovered(
  job: FullJob,
  item: ParsedSearchListing
) {
  assertAllowedSourceUrl(item.sourceUrl, job.provider as SourceProvider);
  return prisma.huntedListing.upsert({
    where: {
      companyAccountId_sourceProvider_sourceListingId: {
        companyAccountId: job.companyAccountId,
        sourceProvider: job.provider,
        sourceListingId: item.sourceListingId,
      },
    },
    update: {
      huntJobId: job.id,
      sourceUrl: item.sourceUrl,
      title: item.title,
      price: item.priceText,
      location: item.locationText,
      lastSeenAt: new Date(),
      removedAt: null,
    },
    create: {
      companyAccountId: job.companyAccountId,
      huntJobId: job.id,
      sourceProvider: job.provider,
      sourceListingId: item.sourceListingId,
      sourceUrl: item.sourceUrl,
      title: item.title,
      price: item.priceText,
      location: item.locationText,
      acquisitionStatus: 'DISCOVERED',
    },
  });
}

async function upsertDetail(
  job: FullJob,
  detail: ParsedListingDetail,
  allowMediaCopy: boolean
) {
  assertAllowedSourceUrl(detail.sourceUrl, job.provider as SourceProvider);
  for (const image of detail.images) {
    assertAllowedMediaUrl(image.sourceUrl, job.provider as SourceProvider);
  }
  await assertListingCapacity(job, [detail.sourceListingId]);

  const shouldCopy =
    allowMediaCopy &&
    job.sourceAuthorization.allowedScopes.includes('MEDIA_COPY');
  const canReadContacts =
    job.sourceAuthorization.allowedScopes.includes('CONTACT_READ');
  const copiedImages = await Promise.all(
    detail.images.map(async (image) => {
      if (!shouldCopy) {
        return {
          ...image,
          storageKey: null,
          checksum: null,
          byteSize: null,
        };
      }
      const copied = await copyHuntingImage({
        companyAccountId: job.companyAccountId,
        listingId: detail.sourceListingId,
        order: image.order,
        sourceUrl: image.sourceUrl,
        provider: job.provider as SourceProvider,
      });
      return { ...image, ...copied };
    })
  );
  const safeDescriptionHtml = sanitizeDescription(
    detail.sanitizedDescriptionHtml
  );

  await prisma.$transaction(async (tx) => {
    const listing = await tx.huntedListing.upsert({
      where: {
        companyAccountId_sourceProvider_sourceListingId: {
          companyAccountId: job.companyAccountId,
          sourceProvider: job.provider,
          sourceListingId: detail.sourceListingId,
        },
      },
      update: {
        huntJobId: job.id,
        sourceUrl: detail.sourceUrl,
        title: detail.title,
        price: detail.priceText,
        priceAmount: detail.priceAmount,
        currency: detail.currency,
        listingPublishedAt: detail.listingPublishedAt,
        category: detail.category,
        subcategory: detail.subcategory,
        sellerType: detail.sellerType,
        ownerName: detail.sellerName,
        descriptionText: detail.descriptionText,
        sanitizedDescriptionHtml: safeDescriptionHtml,
        province: detail.province,
        district: detail.district,
        neighborhood: detail.neighborhood,
        street: detail.street,
        latitude: detail.latitude,
        longitude: detail.longitude,
        addressPrecision: detail.addressPrecision,
        acquisitionStatus: 'DETAIL_COMPLETE',
        completenessScore: detail.completenessScore,
        attributesJson: detail.attributes,
        location: locationText(detail) || null,
        roomCount: detail.attributes['Oda Sayısı'] || null,
        area:
          detail.attributes['m² (Brüt)'] ||
          detail.attributes['Brüt Metrekare'] ||
          null,
        imageUrl: detail.images[0]?.sourceUrl || null,
        sourceUpdatedAt: new Date(),
        lastSeenAt: new Date(),
        removedAt: null,
      },
      create: {
        companyAccountId: job.companyAccountId,
        huntJobId: job.id,
        sourceProvider: job.provider,
        sourceListingId: detail.sourceListingId,
        sourceUrl: detail.sourceUrl,
        title: detail.title,
        price: detail.priceText,
        priceAmount: detail.priceAmount,
        currency: detail.currency,
        listingPublishedAt: detail.listingPublishedAt,
        category: detail.category,
        subcategory: detail.subcategory,
        sellerType: detail.sellerType,
        ownerName: detail.sellerName,
        descriptionText: detail.descriptionText,
        sanitizedDescriptionHtml: safeDescriptionHtml,
        province: detail.province,
        district: detail.district,
        neighborhood: detail.neighborhood,
        street: detail.street,
        latitude: detail.latitude,
        longitude: detail.longitude,
        addressPrecision: detail.addressPrecision,
        acquisitionStatus: 'DETAIL_COMPLETE',
        completenessScore: detail.completenessScore,
        attributesJson: detail.attributes,
        location: locationText(detail) || null,
        roomCount: detail.attributes['Oda Sayısı'] || null,
        area:
          detail.attributes['m² (Brüt)'] ||
          detail.attributes['Brüt Metrekare'] ||
          null,
        imageUrl: detail.images[0]?.sourceUrl || null,
        sourceUpdatedAt: new Date(),
      },
    });

    if (canReadContacts) {
      for (const phone of detail.phones) {
        const contact = buildAuthorizedSourceContact({
          phone,
          sourceUrl: detail.sourceUrl,
          authorizationExpiresAt: job.sourceAuthorization.expiresAt,
        });
        await tx.huntedContact.upsert({
          where: {
            companyAccountId_phoneHmac_listingId: {
              companyAccountId: job.companyAccountId,
              phoneHmac: contact.phoneHmac,
              listingId: listing.id,
            },
          },
          update: contact,
          create: {
            ...contact,
            companyAccountId: job.companyAccountId,
            listingId: listing.id,
          },
        });
      }
    }

    for (const image of copiedImages) {
      await tx.huntedListingImage.upsert({
        where: {
          listingId_order: { listingId: listing.id, order: image.order },
        },
        update: {
          sourceUrl: image.sourceUrl,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          storageKey: image.storageKey,
          checksum: image.checksum,
          byteSize: image.byteSize,
        },
        create: {
          listingId: listing.id,
          order: image.order,
          sourceUrl: image.sourceUrl,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          storageKey: image.storageKey,
          checksum: image.checksum,
          byteSize: image.byteSize,
        },
      });
    }
    await tx.huntedListingImage.deleteMany({
      where: {
        listingId: listing.id,
        order: { notIn: detail.images.map((image) => image.order) },
      },
    });
  });
}

export function createLocalHuntWorkerStore(
  options: LocalStoreOptions = {}
): HuntWorkerStore {
  const allowMediaCopy = options.allowMediaCopy !== false;

  return {
    async claim() {
      if (options.jobId) {
        const now = new Date();
        const claimed = await prisma.huntJob.updateMany({
          where: { id: options.jobId, status: 'QUEUED' },
          data: {
            status: 'RUNNING',
            startedAt: now,
            lastHeartbeatAt: now,
          },
        });
        if (!claimed.count) return null;
        const job = await loadFullJob(options.jobId);
        if (!job) return null;
        if (!hasCurrentAuthorization(job)) {
          await prisma.huntJob.update({
            where: { id: job.id },
            data: {
              status: 'PAUSED',
              pausedAt: new Date(),
              errorSummary: 'Kaynak yetkisi gecerli degil.',
            },
          });
          return null;
        }
        return publicJob(job);
      }

      const lease = buildWorkerLease();
      const candidate = await prisma.huntJob.findFirst({
        where: lease.candidateWhere,
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (!candidate) return null;
      const claimed = await prisma.huntJob.updateMany({
        where: {
          id: candidate.id,
          OR: [
            { status: 'QUEUED' },
            {
              status: 'RUNNING',
              lastHeartbeatAt: { lt: lease.staleBefore },
            },
          ],
        },
        data: {
          status: 'RUNNING',
          startedAt: lease.now,
          lastHeartbeatAt: lease.now,
        },
      });
      if (!claimed.count) return null;
      const job = await loadFullJob(candidate.id);
      return job ? publicJob(job) : null;
    },

    async control(jobId): Promise<HuntWorkerDirective> {
      const job = await loadFullJob(jobId);
      if (!job || job.status === 'CANCELLED') return 'CANCEL';
      if (job.status !== 'RUNNING') return 'PAUSE';
      if (!hasCurrentAuthorization(job)) {
        await prisma.huntJob.updateMany({
          where: { id: jobId, status: 'RUNNING' },
          data: {
            status: 'PAUSED',
            pausedAt: new Date(),
            errorSummary:
              'Kaynak yetkisi artik gecerli degil; is guvenli bicimde duraklatildi.',
          },
        });
        return 'PAUSE';
      }
      return 'CONTINUE';
    },

    async discover(jobId, items, progress) {
      const job = await requireRunnableJob(jobId);
      if (items.length > 11) {
        throw new Error('Bir av isine en fazla 11 ilan yazilabilir.');
      }
      await assertListingCapacity(
        job,
        items.map((item) => item.sourceListingId)
      );
      for (const item of items) await upsertDiscovered(job, item);
      await prisma.huntJob.updateMany({
        where: { id: jobId, status: 'RUNNING' },
        data: progressData(progress),
      });
    },

    async detail(jobId, detail, progress) {
      const job = await requireRunnableJob(jobId);
      await upsertDetail(job, detail, allowMediaCopy);
      await prisma.huntJob.updateMany({
        where: { id: jobId, status: 'RUNNING' },
        data: progressData(progress),
      });
    },

    async progress(jobId, progress, error) {
      await requireRunnableJob(jobId);
      await prisma.huntJob.updateMany({
        where: { id: jobId, status: 'RUNNING' },
        data: {
          ...progressData(progress),
          ...(error?.summary
            ? { errorSummary: error.summary.slice(0, 1000) }
            : {}),
        },
      });
    },

    async finish(jobId, outcome, progress, errorSummary) {
      const data: Record<string, unknown> =
        outcome === 'FAILED'
          ? { lastHeartbeatAt: new Date() }
          : { ...progressData(progress) };
      if (outcome === 'SOURCE_CHALLENGE') {
        Object.assign(data, {
          status: 'SOURCE_CHALLENGE',
          pausedAt: new Date(),
          errorSummary:
            'Kaynak guvenlik dogrulamasi gosterdi; otomatik asma denenmedi.',
        });
      } else if (outcome === 'FAILED') {
        Object.assign(data, {
          status: 'FAILED',
          completedAt: new Date(),
          totalFailed: Math.max(1, progress.failed),
          errorSummary:
            errorSummary?.slice(0, 1000) ||
            'Worker isi tamamlayamadi.',
        });
      } else {
        Object.assign(data, {
          status: outcome,
          completedAt: new Date(),
          errorSummary: errorSummary?.slice(0, 1000) || null,
        });
      }
      await prisma.huntJob.updateMany({
        where: { id: jobId, status: 'RUNNING' },
        data,
      });
    },
  };
}
