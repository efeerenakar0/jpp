import 'server-only';

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PlaywrightCrawler } from '@crawlee/playwright';
import { Actor } from 'apify';
import {
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
import {
  BUSINESS_AI_CRAWLER_USER_AGENT,
  buildApifyProxyPolicy,
  buildCrawlerPolicy,
  buildSourceRequest,
  failedRequestDelta,
  getCrawlerListingLimit,
  initialSahibindenRequestKind,
  isSourceChallengeStatus,
  selectUniqueListingsWithinLimit,
} from './crawler-policy';
import type { SourceProvider } from './types';
import {
  buildStickySessionPoolOptions,
  prepareSourceNetworkPolicy,
} from './source-network-policy';
import { createRemoteHuntWorkerStore } from './worker-api-client';
import {
  huntWorkerInvocationSchema,
  type HuntWorkerJob,
  type HuntWorkerProgress,
} from './worker-protocol';
import type { HuntWorkerStore } from './worker-store';

const CONTROL_STOP_MARKER = 'AVCI_WORKER_CONTROL_STOP';

class WorkerControlStopError extends Error {
  constructor() {
    super(CONTROL_STOP_MARKER);
  }
}

function fixturePath(name: string) {
  return join(process.cwd(), 'src/lib/hunting-v2/__fixtures__', name);
}

function progressSnapshot(input: {
  discovered: number;
  completed: number;
  partial: number;
  failed: number;
}): HuntWorkerProgress {
  return {
    discovered: Math.min(11, Math.max(0, input.discovered)),
    completed: Math.min(11, Math.max(0, input.completed)),
    partial: Math.min(11, Math.max(0, input.partial)),
    failed: Math.min(11, Math.max(0, input.failed)),
  };
}

async function createWorkerStore(): Promise<HuntWorkerStore> {
  if (process.env.ACTOR_RUN_ID) {
    const input = huntWorkerInvocationSchema.parse(await Actor.getInput());
    return createRemoteHuntWorkerStore(input);
  }
  const { createLocalHuntWorkerStore } = await import('./worker-local-store');
  return createLocalHuntWorkerStore();
}

async function createWorkerProxyConfiguration() {
  const policy = buildApifyProxyPolicy();

  if (!process.env.ACTOR_RUN_ID) {
    throw new Error(
      'Turkiye proxy zorunlu ancak worker Apify Actor ortaminda calismiyor.'
    );
  }
  if (!policy.enabled) {
    throw new Error('Turkiye proxy zorunlu ancak Apify proxy kapali.');
  }

  const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: policy.groups,
    countryCode: policy.countryCode,
  });
  if (!proxyConfiguration) {
    throw new Error('Turkiye proxy yapilandirmasi olusturulamadi.');
  }
  return proxyConfiguration;
}

async function processFixtureJob(
  job: HuntWorkerJob,
  store: HuntWorkerStore
) {
  const [searchHtml, detailHtml] = await Promise.all([
    readFile(fixturePath('search-results.html'), 'utf8'),
    readFile(fixturePath('listing-detail.html'), 'utf8'),
  ]);
  const result = processFixtureDocuments({
    searchHtml,
    searchUrl: job.searchUrl,
    detailDocuments: new Map([['fixture-1001', detailHtml]]),
  });
  const listings = parseSearchResultsHtml(searchHtml, job.searchUrl).listings;
  const discovered = Math.min(11, listings.length);
  let completed = 0;

  if ((await store.control(job.id)) !== 'CONTINUE') return;
  if (listings.length) {
    await store.discover(
      job.id,
      listings.slice(0, 11),
      progressSnapshot({ discovered, completed, partial: 0, failed: 0 })
    );
  }
  for (const detail of result.details) {
    if ((await store.control(job.id)) !== 'CONTINUE') return;
    const nextCompleted = completed + 1;
    await store.detail(
      job.id,
      detail,
      progressSnapshot({
        discovered,
        completed: nextCompleted,
        partial: result.partial,
        failed: 0,
      })
    );
    completed = nextCompleted;
  }
  await store.finish(
    job.id,
    result.partial ? 'PARTIAL' : 'COMPLETED',
    progressSnapshot({
      discovered: result.discovered,
      completed: result.completed,
      partial: result.partial,
      failed: 0,
    })
  );
}

async function processLiveJob(
  job: HuntWorkerJob,
  store: HuntWorkerStore
) {
  if (process.env.AVCI_LIVE_PROVIDER_ENABLED !== 'true') {
    throw new Error('Canli kaynak worker yapilandirmasi kapali.');
  }
  if ((await store.control(job.id)) !== 'CONTINUE') return;
  await assertPublicSourceUrl(job.searchUrl, job.provider as SourceProvider);

  const initialRequestKind = initialSahibindenRequestKind(job.searchUrl);
  let discovered = initialRequestKind === 'DETAIL' ? 1 : 0;
  let completed = 0;
  let partial = 0;
  let failed = 0;
  let challengeSeen = false;
  let controlStopped = false;
  const discoveredListingIds = new Set<string>();
  const listingLimit = getCrawlerListingLimit();
  const proxyConfiguration = await createWorkerProxyConfiguration();
  const crawlerPolicy = buildCrawlerPolicy();
  const { sourceSessionId, robotsFile, requestStartGate } =
    await prepareSourceNetworkPolicy({
      jobId: job.id,
      sourceUrl: job.searchUrl,
      delaySeconds: crawlerPolicy.sameDomainDelaySecs,
      proxyConfiguration,
    });
  if (!robotsFile.isAllowed(job.searchUrl, BUSINESS_AI_CRAWLER_USER_AGENT)) {
    throw new Error('Kaynagin robots.txt politikasi bu aramaya izin vermiyor.');
  }

  const crawler = new PlaywrightCrawler({
    ...crawlerPolicy,
    // Crawlee 3.17 robots.txt dosyasini proxy disinda indirir. Dosya yukarida
    // ayni job oturumu ve Turkiye proxy baglantisi uzerinden kontrol edildi.
    respectRobotsTxtFile: false,
    headless: false,
    persistCookiesPerSession: true,
    proxyConfiguration,
    sessionPoolOptions: buildStickySessionPoolOptions(sourceSessionId),
    navigationTimeoutSecs: 75,
    requestHandlerTimeoutSecs: 120,
    browserPoolOptions: {
      operationTimeoutSecs: 90,
    },
    preNavigationHooks: [
      async ({ request }) => {
        const directive = await store.control(job.id);
        if (directive !== 'CONTINUE') {
          controlStopped = true;
          crawler.stop(
            directive === 'CANCEL'
              ? 'Av isi kullanici tarafindan durduruldu.'
              : 'Kaynak yetkisi artik gecerli degil.'
          );
          throw new WorkerControlStopError();
        }
        if (
          !robotsFile.isAllowed(
            request.url,
            BUSINESS_AI_CRAWLER_USER_AGENT
          )
        ) {
          throw new Error(
            'Kaynagin robots.txt politikasi bu sayfaya izin vermiyor.'
          );
        }
        await requestStartGate.waitForTurn();
      },
    ],
    async requestHandler({ request, page, response, addRequests }) {
      const statusCode = response?.status() || 0;
      if (isSourceChallengeStatus(statusCode)) {
        throw new SourceChallengeError(
          `Kaynak guvenlik dogrulamasi gosterdi (HTTP ${statusCode}).`
        );
      }
      const html = await page.content();
      assertNoSourceChallenge(html);
      const loadedUrl = request.loadedUrl || page.url() || request.url;
      validateRedirectTarget(loadedUrl, job.provider as SourceProvider);

      if (request.userData.kind === 'DETAIL') {
        const detail = parseListingDetailHtml(html, loadedUrl);
        const nextCompleted = completed + 1;
        await store.detail(
          job.id,
          detail,
          progressSnapshot({
            discovered,
            completed: nextCompleted,
            partial,
            failed,
          })
        );
        completed = nextCompleted;
      } else {
        const searchPage = parseSearchResultsHtml(html, loadedUrl);
        if (!searchPage.listings.length && searchPage.reportedTotal === null) {
          throw new SourceChallengeError(
            'Kaynak guvenlik dogrulamasi gosterdi veya arama sayfasi yuklenemedi.'
          );
        }
        if (
          !searchPage.listings.length &&
          searchPage.reportedTotal !== null &&
          searchPage.reportedTotal > 0
        ) {
          throw new Error(
            'Kaynak ilan bildirdi ancak sonuc tablosu okunamadi.'
          );
        }
        const remainingListingCount = Math.max(
          0,
          listingLimit - discoveredListingIds.size
        );
        const selectedListings = selectUniqueListingsWithinLimit({
          listings: searchPage.listings,
          discoveredListingIds,
          limit: discoveredListingIds.size + remainingListingCount,
        });
        for (const item of selectedListings) {
          discoveredListingIds.add(item.sourceListingId);
        }
        discovered = discoveredListingIds.size;
        if (selectedListings.length) {
          await store.discover(
            job.id,
            selectedListings,
            progressSnapshot({ discovered, completed, partial, failed })
          );
        }
        await addRequests(
          selectedListings.map((item) =>
            buildSourceRequest({
              kind: 'DETAIL',
              sourceListingId: item.sourceListingId,
              url: item.sourceUrl,
            })
          )
        );
        if (
          searchPage.nextPageUrl &&
          discoveredListingIds.size < listingLimit
        ) {
          await addRequests([
            buildSourceRequest({
              kind: 'LIST',
              url: searchPage.nextPageUrl,
            }),
          ]);
        }
      }
    },
    async failedRequestHandler({ request }) {
      if (
        request.errorMessages.some((message) =>
          message.includes(CONTROL_STOP_MARKER)
        )
      ) {
        return;
      }
      if (
        request.errorMessages.some(
          (message) =>
            message.includes('Kaynak guvenlik dogrulamasi') ||
            /Request blocked - received (?:401|403|429) status code/i.test(
              message
            )
        )
      ) {
        challengeSeen = true;
        await store.finish(
          job.id,
          'SOURCE_CHALLENGE',
          progressSnapshot({ discovered, completed, partial, failed })
        );
        crawler.stop('Kaynak guvenlik dogrulamasi gosterdi.');
        return;
      }
      const delta = failedRequestDelta(request.userData.kind);
      failed += delta.failed;
      partial += delta.partial;
      await store.progress(
        job.id,
        progressSnapshot({ discovered, completed, partial, failed }),
        {
          code: 'REQUEST_FAILED',
          summary:
            request.errorMessages.at(-1)?.slice(0, 1000) ||
            'Kaynak istegi tamamlanamadi.',
        }
      );
    },
  });

  await crawler.run([
    buildSourceRequest({
      kind: initialRequestKind,
      url: job.searchUrl,
    }),
  ]);
  if (challengeSeen || controlStopped) return;
  await store.finish(
    job.id,
    failed || partial ? 'PARTIAL' : 'COMPLETED',
    progressSnapshot({ discovered, completed, partial, failed })
  );
}

async function runClaimedHuntJob(
  job: HuntWorkerJob,
  store: HuntWorkerStore
) {
  let progress = progressSnapshot({
    discovered: 0,
    completed: 0,
    partial: 0,
    failed: 0,
  });
  try {
    if (job.provider === 'FIXTURE') {
      await processFixtureJob(job, store);
    } else {
      await processLiveJob(job, store);
    }
  } catch (error) {
    if (error instanceof WorkerControlStopError) return job;
    if (error instanceof SourceChallengeError) {
      await store.finish(job.id, 'SOURCE_CHALLENGE', progress);
      return job;
    }
    progress = { ...progress, failed: 1 };
    try {
      await store.finish(
        job.id,
        'FAILED',
        progress,
        error instanceof Error
          ? error.message.slice(0, 1000)
          : 'Worker isi tamamlayamadi.'
      );
    } catch {
      // Asil hata korunur; callback hatasi hassas yanit govdesi sizdirmaz.
    }
    throw error;
  }
  return job;
}

export async function runHuntJob(jobId: string) {
  const { createLocalHuntWorkerStore } = await import('./worker-local-store');
  const store = createLocalHuntWorkerStore({ jobId });
  const job = await store.claim();
  if (!job) return null;
  return runClaimedHuntJob(job, store);
}

export async function runNextHuntJob() {
  const store = await createWorkerStore();
  const job = await store.claim();
  if (!job) return null;
  return runClaimedHuntJob(job, store);
}
