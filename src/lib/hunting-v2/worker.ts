import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CheerioCrawler } from '@crawlee/cheerio';
import prisma from '@/lib/prisma';
import {
  assertAllowedMediaUrl,
  assertPublicSourceUrl,
  validateRedirectTarget,
} from './security';
import {
  assertNoSourceChallenge,
  processFixtureDocuments,
  SourceChallengeError,
} from './worker-core';
import {
  parseListingDetailHtml,
  parseSearchResultsHtml,
} from './parsers';
import { copyHuntingImage } from './media';
import {
  buildCrawlerPolicy,
  buildSourceRequest,
  failedRequestDelta,
} from './crawler-policy';
import type {
  ParsedListingDetail,
  ParsedSearchListing,
  SourceProvider,
} from './types';
import { buildAuthorizedSourceContact } from './authorized-source-contact';
import { buildWorkerLease } from './worker-lease';

type JobWithAuthorization = Awaited<
  ReturnType<typeof loadJobWithAuthorization>
>;

function fixturePath(name: string) {
  return join(process.cwd(), 'src/lib/hunting-v2/__fixtures__', name);
}

async function loadJobWithAuthorization(jobId: string) {
  return prisma.huntJob.findUnique({
    where: { id: jobId },
    include: { sourceAuthorization: true },
  });
}

async function isJobCancelled(jobId: string) {
  const job = await prisma.huntJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  return job?.status === 'CANCELLED';
}

function ensureAuthorization(
  job: NonNullable<JobWithAuthorization>,
  requiredScopes: string[]
) {
  const now = new Date();
  const authorization = job.sourceAuthorization;
  if (
    authorization.companyAccountId !== job.companyAccountId ||
    authorization.provider !== job.provider ||
    authorization.status !== 'ACTIVE' ||
    authorization.startsAt > now ||
    (authorization.expiresAt && authorization.expiresAt <= now)
  ) {
    throw new Error('Worker için aktif kaynak yetkisi bulunamadı.');
  }
  const missing = requiredScopes.filter(
    (scope) =>
      !authorization.allowedScopes.includes(
        scope as (typeof authorization.allowedScopes)[number]
      )
  );
  if (missing.length) {
    throw new Error(`Worker kaynak yetkisi kapsamı eksik: ${missing.join(', ')}`);
  }
}

async function ensureCurrentAuthorization(
  jobId: string,
  requiredScopes: string[]
) {
  const current = await loadJobWithAuthorization(jobId);
  if (!current) throw new Error('Av işi bulunamadı.');
  ensureAuthorization(current, requiredScopes);
  return current;
}

async function upsertDiscoveredListing(
  job: NonNullable<JobWithAuthorization>,
  item: ParsedSearchListing
) {
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

async function upsertListingDetail(
  job: NonNullable<JobWithAuthorization>,
  detail: ParsedListingDetail
) {
  for (const image of detail.images) {
    assertAllowedMediaUrl(image.sourceUrl, job.provider as SourceProvider);
  }
  const shouldCopy = job.sourceAuthorization.allowedScopes.includes('MEDIA_COPY');
  const canReadContacts =
    job.sourceAuthorization.allowedScopes.includes('CONTACT_READ');
  const copiedImages = await Promise.all(
    detail.images.map(async (image) => {
      if (!shouldCopy) return { ...image, storageKey: null, checksum: null, byteSize: null };
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
  return prisma.$transaction(async (tx) => {
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
        sanitizedDescriptionHtml: detail.sanitizedDescriptionHtml,
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
        sanitizedDescriptionHtml: detail.sanitizedDescriptionHtml,
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
    return listing;
  });
}

async function markChallenge(jobId: string) {
  await prisma.huntJob.update({
    where: { id: jobId },
    data: {
      status: 'SOURCE_CHALLENGE',
      pausedAt: new Date(),
      errorSummary:
        'Kaynak güvenlik doğrulaması gösterdi; otomatik aşma denenmedi.',
    },
  });
}

async function processFixtureJob(job: NonNullable<JobWithAuthorization>) {
  const [searchHtml, detailHtml] = await Promise.all([
    readFile(fixturePath('search-results.html'), 'utf8'),
    readFile(fixturePath('listing-detail.html'), 'utf8'),
  ]);
  const result = processFixtureDocuments({
    searchHtml,
    searchUrl: job.searchUrl,
    detailDocuments: new Map([['fixture-1001', detailHtml]]),
  });
  for (const item of parseSearchResultsHtml(searchHtml, job.searchUrl)
    .listings) {
    if (await isJobCancelled(job.id)) return;
    await upsertDiscoveredListing(job, item);
  }
  for (const detail of result.details) {
    if (await isJobCancelled(job.id)) return;
    await upsertListingDetail(job, detail);
  }
  if (await isJobCancelled(job.id)) return;
  await prisma.huntJob.update({
    where: { id: job.id },
    data: {
      status: result.partial ? 'PARTIAL' : 'COMPLETED',
      totalDiscovered: result.discovered,
      totalCompleted: result.completed,
      totalPartial: result.partial,
      totalFailed: 0,
      completedAt: new Date(),
      lastHeartbeatAt: new Date(),
    },
  });
}

async function processLiveJob(job: NonNullable<JobWithAuthorization>) {
  if (process.env.AVCI_LIVE_PROVIDER_ENABLED !== 'true') {
    throw new Error('Canlı kaynak worker yapılandırması kapalı.');
  }
  ensureAuthorization(job, [
    'SEARCH_READ',
    'DETAIL_READ',
    'MEDIA_READ',
    'CONTACT_READ',
  ]);
  await assertPublicSourceUrl(job.searchUrl, job.provider as SourceProvider);

  let discovered = 0;
  let completed = 0;
  let partial = 0;
  let failed = 0;
  let challengeSeen = false;
  let authorizationInvalidated = false;
  const discoveredListingIds = new Set<string>();
  const crawler = new CheerioCrawler({
    ...buildCrawlerPolicy(),
    async requestHandler({ request, body, addRequests }) {
      if (await isJobCancelled(job.id)) {
        crawler.stop('Av işi kullanıcı tarafından durduruldu.');
        return;
      }
      try {
        await ensureCurrentAuthorization(job.id, [
          'SEARCH_READ',
          'DETAIL_READ',
          'MEDIA_READ',
          'CONTACT_READ',
        ]);
      } catch {
        authorizationInvalidated = true;
        await prisma.huntJob.update({
          where: { id: job.id },
          data: {
            status: 'PAUSED',
            pausedAt: new Date(),
            errorSummary:
              'Kaynak yetkisi artık geçerli değil; iş güvenli biçimde duraklatıldı.',
          },
        });
        crawler.stop('Kaynak yetkisi artık geçerli değil.');
        return;
      }
      const html = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
      assertNoSourceChallenge(html);
      const loadedUrl = request.loadedUrl || request.url;
      validateRedirectTarget(loadedUrl, job.provider as SourceProvider);

      if (request.userData.kind === 'DETAIL') {
        const detail = parseListingDetailHtml(html, loadedUrl);
        await upsertListingDetail(job, detail);
        completed += 1;
      } else {
        const page = parseSearchResultsHtml(html, loadedUrl);
        for (const item of page.listings) {
          await upsertDiscoveredListing(job, item);
          discoveredListingIds.add(item.sourceListingId);
        }
        discovered = discoveredListingIds.size;
        await addRequests(
          page.listings.map((item) =>
            buildSourceRequest({
              kind: 'DETAIL',
              sourceListingId: item.sourceListingId,
              url: item.sourceUrl,
            })
          )
        );
        if (page.nextPageUrl) {
          await addRequests([
            buildSourceRequest({
              kind: 'LIST',
              url: page.nextPageUrl,
            }),
          ]);
        }
      }
      await prisma.huntJob.update({
        where: { id: job.id },
        data: {
          totalDiscovered: discovered,
          totalCompleted: completed,
          totalPartial: partial,
          totalFailed: failed,
          lastHeartbeatAt: new Date(),
        },
      });
    },
    async failedRequestHandler({ request }) {
      if (
        request.errorMessages.some((message) =>
          message.includes('Kaynak güvenlik doğrulaması')
        )
      ) {
        challengeSeen = true;
        await markChallenge(job.id);
        crawler.stop('Kaynak güvenlik doğrulaması gösterdi.');
        return;
      }
      const delta = failedRequestDelta(request.userData.kind);
      failed += delta.failed;
      partial += delta.partial;
    },
  });

  await crawler.run([
    buildSourceRequest({
      kind: 'LIST',
      url: job.searchUrl,
    }),
  ]);
  if (
    challengeSeen ||
    authorizationInvalidated ||
    (await isJobCancelled(job.id))
  ) {
    return;
  }
  await prisma.huntJob.update({
    where: { id: job.id },
    data: {
      status: failed || partial ? 'PARTIAL' : 'COMPLETED',
      totalDiscovered: discovered,
      totalCompleted: completed,
      totalPartial: partial,
      totalFailed: failed,
      completedAt: new Date(),
      lastHeartbeatAt: new Date(),
    },
  });
}

export async function runHuntJob(jobId: string) {
  const job = await loadJobWithAuthorization(jobId);
  if (!job) throw new Error('Av işi bulunamadı.');
  if (!['QUEUED', 'RUNNING'].includes(job.status)) return job;
  ensureAuthorization(job, [
    'SEARCH_READ',
    'DETAIL_READ',
    'MEDIA_READ',
    'CONTACT_READ',
  ]);
  await prisma.huntJob.update({
    where: { id: job.id },
    data: {
      status: 'RUNNING',
      startedAt: job.startedAt || new Date(),
      lastHeartbeatAt: new Date(),
    },
  });
  try {
    if (job.provider === 'FIXTURE') await processFixtureJob(job);
    else await processLiveJob(job);
  } catch (error) {
    if (error instanceof SourceChallengeError) {
      await markChallenge(job.id);
      return loadJobWithAuthorization(job.id);
    }
    await prisma.huntJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        totalFailed: { increment: 1 },
        completedAt: new Date(),
        errorSummary:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : 'Worker işi tamamlayamadı.',
      },
    });
    throw error;
  }
  return loadJobWithAuthorization(job.id);
}

export async function runNextHuntJob() {
  const lease = buildWorkerLease();
  const candidate = await prisma.huntJob.findFirst({
    where: lease.candidateWhere,
    orderBy: { createdAt: 'asc' },
    select: { id: true, status: true },
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
    data: { status: 'RUNNING', lastHeartbeatAt: lease.now },
  });
  if (!claimed.count) return null;
  return runHuntJob(candidate.id);
}
