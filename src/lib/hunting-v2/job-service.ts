import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { assertPublicSourceUrl } from './security';
import { SOURCE_PROVIDERS } from './types';
import {
  buildSahibindenSearchUrl,
  sahibindenSearchFiltersSchema,
} from './search-filters';
import {
  buildClearpathActorInput,
  clearpathActorInputSchema,
  CLEARPATH_ACTIVE_LOCK_MS,
  CLEARPATH_ACTOR_ID,
  CLEARPATH_CACHE_TTL_MS,
  CLEARPATH_SEARCH_ROTATIONS,
  CLEARPATH_STRATEGY_VERSION,
  clearpathSearchCacheKey,
  huntingQuotaPolicy,
  istanbulMonthWindow,
} from './clearpath-contract';
import { dispatchQueuedHuntWorker } from './worker-dispatch';

export const createHuntJobSchema = z
  .object({
    provider: z.enum(SOURCE_PROVIDERS),
    searchUrl: z.string().url().max(3000).optional(),
    filters: sahibindenSearchFiltersSchema.optional(),
    sourceAuthorizationId: z.string().min(1).max(160).optional(),
    idempotencyKey: z.string().min(8).max(160).optional(),
  })
  .strict()
  .superRefine((body, context) => {
    if (Boolean(body.searchUrl) === Boolean(body.filters)) {
      context.addIssue({
        code: 'custom',
        message: 'Bir filtre secimi veya gecerli kaynak URLsi gereklidir.',
      });
    }
    if (body.filters && body.provider !== 'SAHIBINDEN') {
      context.addIssue({
        code: 'custom',
        path: ['filters'],
        message: 'Filtre secimi yalniz Sahibinden kaynaginda kullanilabilir.',
      });
    }
  });

const REQUIRED_SOURCE_SCOPES = [
  'SEARCH_READ',
  'DETAIL_READ',
  'MEDIA_READ',
  'CONTACT_READ',
] as const;
const PLATFORM_AUTHORIZATION_PREFIX = 'platform:';
const ACTIVE_JOB_STATUSES = [
  'QUEUED',
  'RUNNING',
  'PAUSED',
] as const;

export class HuntingActiveJobError extends Error {
  constructor(public readonly jobId: string) {
    super('Bu sirket icin zaten devam eden bir Avci taramasi var.');
    this.name = 'HuntingActiveJobError';
  }
}

export class HuntingQuotaError extends Error {
  constructor() {
    super('Bu kategori icin aylik Avci hakki bitti.');
    this.name = 'HuntingQuotaError';
  }
}

function parsePlatformAuthorizationDate(
  value: string | undefined,
  fallback: Date,
  fieldName: string
) {
  if (!value?.trim()) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Platform kaynak yetkisi ${fieldName} gecersiz.`);
  }
  return parsed;
}

function sahibindenPlatformAuthorizationConfig() {
  if (process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_ENABLED !== 'true') {
    return null;
  }
  const reference =
    process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_REFERENCE?.trim();
  if (!reference) {
    throw new Error('Platform kaynak yetkisi sozlesme referansi eksik.');
  }
  const contractReference = `${PLATFORM_AUTHORIZATION_PREFIX}${reference}`;
  if (contractReference.length > 200) {
    throw new Error('Platform kaynak yetkisi sozlesme referansi cok uzun.');
  }
  const startsAt = parsePlatformAuthorizationDate(
    process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_STARTS_AT,
    new Date(0),
    'baslangic tarihi'
  );
  const expiresAt = process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_EXPIRES_AT
    ? parsePlatformAuthorizationDate(
        process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_EXPIRES_AT,
        new Date(0),
        'bitis tarihi'
      )
    : null;
  if (expiresAt && expiresAt <= startsAt) {
    throw new Error('Platform kaynak yetkisi bitis tarihi baslangictan sonra olmali.');
  }
  return { contractReference, startsAt, expiresAt };
}

async function materializeSahibindenPlatformAuthorization(
  companyAccountId: string
) {
  const config = sahibindenPlatformAuthorizationConfig();
  if (!config) return null;
  return prisma.sourceAuthorization.upsert({
    where: {
      companyAccountId_provider_contractReference: {
        companyAccountId,
        provider: 'SAHIBINDEN',
        contractReference: config.contractReference,
      },
    },
    update: {
      status: 'ACTIVE',
      allowedScopes: [...REQUIRED_SOURCE_SCOPES],
      startsAt: config.startsAt,
      expiresAt: config.expiresAt,
    },
    create: {
      companyAccountId,
      provider: 'SAHIBINDEN',
      status: 'ACTIVE',
      allowedScopes: [...REQUIRED_SOURCE_SCOPES],
      contractReference: config.contractReference,
      startsAt: config.startsAt,
      expiresAt: config.expiresAt,
    },
  });
}

function derivedIdempotencyKey(companyAccountId: string, value: string) {
  return createHash('sha256').update(`${companyAccountId}\0${value}`).digest('hex');
}

function retryableTransactionError(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  return code === 'P2002' || code === 'P2034';
}

async function serializable<T>(
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

async function resolveAuthorization(input: {
  companyAccountId: string;
  provider: 'SAHIBINDEN' | 'FIXTURE';
  sourceAuthorizationId?: string;
}) {
  const now = new Date();
  let authorization = input.sourceAuthorizationId
    ? await prisma.sourceAuthorization.findFirst({
        where: {
          id: input.sourceAuthorizationId,
          companyAccountId: input.companyAccountId,
          provider: input.provider,
        },
      })
    : null;

  if (authorization?.contractReference.startsWith(PLATFORM_AUTHORIZATION_PREFIX)) {
    const platformConfig =
      input.provider === 'SAHIBINDEN'
        ? sahibindenPlatformAuthorizationConfig()
        : null;
    if (
      !platformConfig ||
      authorization.contractReference !== platformConfig.contractReference
    ) {
      authorization = null;
    }
  }
  authorization ||= await prisma.sourceAuthorization.findFirst({
    where: {
      companyAccountId: input.companyAccountId,
      provider: input.provider,
      NOT: { contractReference: { startsWith: PLATFORM_AUTHORIZATION_PREFIX } },
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (!authorization && input.provider === 'SAHIBINDEN') {
    authorization = await materializeSahibindenPlatformAuthorization(
      input.companyAccountId
    );
  }
  if (input.provider === 'FIXTURE' && process.env.NODE_ENV !== 'production') {
    authorization ||= await prisma.sourceAuthorization.upsert({
      where: {
        companyAccountId_provider_contractReference: {
          companyAccountId: input.companyAccountId,
          provider: 'FIXTURE',
          contractReference: 'synthetic-fixture-v1',
        },
      },
      update: {
        status: 'ACTIVE',
        allowedScopes: [...REQUIRED_SOURCE_SCOPES],
        startsAt: new Date(0),
      },
      create: {
        companyAccountId: input.companyAccountId,
        provider: 'FIXTURE',
        status: 'ACTIVE',
        allowedScopes: [...REQUIRED_SOURCE_SCOPES],
        contractReference: 'synthetic-fixture-v1',
        startsAt: new Date(0),
      },
    });
  }
  if (
    !authorization ||
    authorization.status !== 'ACTIVE' ||
    authorization.startsAt > now ||
    (authorization.expiresAt && authorization.expiresAt <= now)
  ) {
    throw new Error('Aktif kaynak yetkisi bulunamadi.');
  }
  const missingScopes = REQUIRED_SOURCE_SCOPES.filter(
    (scope) => !authorization.allowedScopes.includes(scope)
  );
  if (missingScopes.length) {
    throw new Error(`Kaynak yetkisi kapsami eksik: ${missingScopes.join(', ')}`);
  }
  return authorization;
}

export type HuntingQuotaSnapshot = {
  propertyType: string;
  perRunLimit: number;
  monthlyLimit: number;
  used: number;
  reserved: number;
  remaining: number;
  periodStart: Date;
  periodEnd: Date;
};

export async function listHuntingQuotaSnapshots(
  companyAccountId: string,
  now = new Date()
): Promise<HuntingQuotaSnapshot[]> {
  const { allHuntingQuotaPolicies } = await import('./clearpath-contract');
  const window = istanbulMonthWindow(now);
  const rows = await prisma.huntingMonthlyQuota.findMany({
    where: { companyAccountId, periodStart: window.periodStart },
  });
  const byType = new Map(rows.map((row) => [row.propertyType, row]));
  return allHuntingQuotaPolicies().map((policy) => {
    const row = byType.get(policy.propertyType);
    const used = row?.used || 0;
    const reserved = row?.reserved || 0;
    return {
      ...policy,
      used,
      reserved,
      remaining: Math.max(0, policy.monthlyLimit - used - reserved),
      ...window,
    };
  });
}

export async function createHuntJob(input: {
  companyAccountId: string;
  createdBy: string;
  body: unknown;
  now?: Date;
}) {
  const body = createHuntJobSchema.parse(input.body);
  const now = input.now || new Date();
  const period = istanbulMonthWindow(now);
  if (
    body.provider !== 'FIXTURE' &&
    process.env.AVCI_LIVE_PROVIDER_ENABLED !== 'true'
  ) {
    throw new Error('Canlı kaynak bağlayıcısı varsayılan olarak kapalıdır.');
  }
  if (body.provider === 'SAHIBINDEN' && !body.filters) {
    throw new Error('Canli ClearPath taramasi yalniz dogrulanmis filtrelerle baslatilabilir.');
  }
  let searchUrl = body.searchUrl || '';
  let rotationId: string | null = null;
  if (body.filters) {
    const locationKey = createHash('sha256')
      .update(
        JSON.stringify({
          provider: body.provider,
          ...body.filters,
        })
      )
      .digest('hex');
    const existingSearches = await prisma.huntJob.count({
      where: {
        companyAccountId: input.companyAccountId,
        provider: body.provider,
        propertyType: body.filters.propertyType,
        dispatchStrategy: { startsWith: `CLEARPATH:${locationKey}:` },
        OR: [
          { status: { in: ['QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL'] } },
          { apifyRunId: { not: null } },
        ],
        createdAt: { gte: period.periodStart, lt: period.periodEnd },
      },
    });
    if (existingSearches >= CLEARPATH_SEARCH_ROTATIONS.length) {
      throw new Error(
        'Bu konum için desteklenen farklı sıralamalar tarandı. Aynı ilanlara yeniden para ödememek için yeni ücretli tarama başlatılmadı.'
      );
    }
    const rotation = CLEARPATH_SEARCH_ROTATIONS[existingSearches];
    rotationId = `CLEARPATH:${locationKey}:${rotation.id}`;
    searchUrl = buildSahibindenSearchUrl(body.filters, rotation);
  }
  await assertPublicSourceUrl(searchUrl, body.provider);
  const authorization = await resolveAuthorization({
    companyAccountId: input.companyAccountId,
    provider: body.provider,
    sourceAuthorizationId: body.sourceAuthorizationId,
  });

  if (!body.filters) {
    // Fixture compatibility path; production ClearPath never reaches this.
    const idempotencyKey =
      body.idempotencyKey ||
      derivedIdempotencyKey(input.companyAccountId, searchUrl);
    return prisma.huntJob.upsert({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey,
        },
      },
      update: {},
      create: {
        companyAccountId: input.companyAccountId,
        sourceAuthorizationId: authorization.id,
        provider: body.provider,
        searchUrl,
        idempotencyKey,
        createdBy: input.createdBy,
      },
    });
  }

  const propertyType = body.filters.propertyType;
  const policy = huntingQuotaPolicy(propertyType);
  const actorInput = buildClearpathActorInput({ searchUrl, propertyType });
  const cacheKey = clearpathSearchCacheKey({ searchUrl, propertyType, actorInput });
  const idempotencyKey =
    body.idempotencyKey ||
    derivedIdempotencyKey(
      input.companyAccountId,
      `${period.periodStart.toISOString()}\0${cacheKey}`
    );

  const reserved = await serializable(async (tx) => {
    const exact = await tx.huntJob.findUnique({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey,
        },
      },
    });
    if (exact) {
      if (
        ['FAILED', 'CANCELLED'].includes(exact.status) &&
        !exact.apifyRunId
      ) {
        await tx.huntJob.update({
          where: { id: exact.id },
          data: {
            idempotencyKey: `${exact.idempotencyKey}:closed:${exact.id}`.slice(
              0,
              160
            ),
          },
        });
      } else {
        return { job: exact, quota: null, cache: null, created: false };
      }
    }

    const existingLock = await tx.huntingActiveJobLock.findUnique({
      where: { companyAccountId: input.companyAccountId },
      include: { huntJob: { select: { id: true, status: true } } },
    });
    if (
      existingLock &&
      existingLock.expiresAt > now &&
      ACTIVE_JOB_STATUSES.includes(existingLock.huntJob.status as (typeof ACTIVE_JOB_STATUSES)[number])
    ) {
      throw new HuntingActiveJobError(existingLock.huntJob.id);
    }
    if (existingLock) {
      await tx.huntingActiveJobLock.delete({
        where: { companyAccountId: input.companyAccountId },
      });
    }

    const quota = await tx.huntingMonthlyQuota.upsert({
      where: {
        companyAccountId_propertyType_periodStart: {
          companyAccountId: input.companyAccountId,
          propertyType,
          periodStart: period.periodStart,
        },
      },
      update: { monthlyLimit: policy.monthlyLimit, periodEnd: period.periodEnd },
      create: {
        companyAccountId: input.companyAccountId,
        propertyType,
        ...period,
        monthlyLimit: policy.monthlyLimit,
      },
    });
    if (quota.used + quota.reserved + policy.perRunLimit > policy.monthlyLimit) {
      throw new HuntingQuotaError();
    }

    let cache = await tx.huntingSearchCache.findUnique({ where: { cacheKey } });
    if (cache && cache.expiresAt <= now) {
      const linkedActive = await tx.huntJob.count({
        where: { searchCacheId: cache.id, status: { in: [...ACTIVE_JOB_STATUSES] } },
      });
      if (!linkedActive) {
        await tx.huntingSearchCache.delete({ where: { id: cache.id } });
        cache = null;
      }
    }
    cache ||= await tx.huntingSearchCache.create({
      data: {
        cacheKey,
        provider: body.provider,
        propertyType,
        searchUrl,
        strategyVersion: CLEARPATH_STRATEGY_VERSION,
        status: 'FETCHING',
        actorId: process.env.APIFY_CLEARPATH_ACTOR_ID?.trim() || CLEARPATH_ACTOR_ID,
        actorInput,
        requestedResults: policy.perRunLimit,
        expiresAt: new Date(now.getTime() + CLEARPATH_CACHE_TTL_MS),
      },
    });
    const cacheReady = cache.status === 'READY';
    const job = await tx.huntJob.create({
      data: {
        companyAccountId: input.companyAccountId,
        sourceAuthorizationId: authorization.id,
        provider: body.provider,
        searchUrl,
        idempotencyKey,
        propertyType,
        requestedResults: policy.perRunLimit,
        quotaPeriodStart: period.periodStart,
        quotaReserved: policy.perRunLimit,
        searchCacheId: cache.id,
        actorInput,
        apifyActorId: cache.actorId,
        dispatchStrategy: rotationId || CLEARPATH_STRATEGY_VERSION,
        cacheHit: cacheReady,
        createdBy: input.createdBy,
      },
    });
    await tx.huntingMonthlyQuota.update({
      where: { id: quota.id },
      data: { reserved: { increment: policy.perRunLimit } },
    });
    await tx.huntingActiveJobLock.create({
      data: {
        companyAccountId: input.companyAccountId,
        huntJobId: job.id,
        expiresAt: new Date(now.getTime() + CLEARPATH_ACTIVE_LOCK_MS),
      },
    });
    return { job, quota, cache, created: true };
  });

  if (!reserved.created || !reserved.cache) return reserved.job;
  if (reserved.cache.status === 'READY') {
    await import('./clearpath-ingest')
      .then(({ synchronizeClearpathJob }) =>
        synchronizeClearpathJob(reserved.job.id)
      )
      .catch(() => undefined);
    return prisma.huntJob.findUniqueOrThrow({ where: { id: reserved.job.id } });
  }
  if (reserved.cache.apifyRunId) {
    await prisma.huntJob.update({
      where: { id: reserved.job.id },
      data: {
        apifyRunId: reserved.cache.apifyRunId,
        apifyDatasetId: reserved.cache.apifyDatasetId,
        status: 'RUNNING',
        startedAt: now,
      },
    });
    return prisma.huntJob.findUniqueOrThrow({ where: { id: reserved.job.id } });
  }

  const dispatchLeaseId = randomUUID();
  const dispatchClaim = await prisma.huntingSearchCache.updateMany({
    where: {
      id: reserved.cache.id,
      apifyRunId: null,
      OR: [
        { dispatchLeaseUntil: null },
        { dispatchLeaseUntil: { lt: now } },
      ],
    },
    data: {
      dispatchLeaseId,
      dispatchLeaseUntil: new Date(now.getTime() + 60_000),
      status: 'FETCHING',
      errorSummary: null,
    },
  });
    if (!dispatchClaim.count) {
    // Another request owns the short dispatch lease. The job remains safely
    // linked to that shared cache and will observe its run during polling.
    const shared = await prisma.huntingSearchCache.findUnique({
      where: { id: reserved.cache.id },
    });
    if (shared?.apifyRunId) {
      return prisma.huntJob.update({
        where: { id: reserved.job.id },
        data: {
          apifyRunId: shared.apifyRunId,
          apifyDatasetId: shared.apifyDatasetId,
          status: 'RUNNING',
          startedAt: now,
          lastHeartbeatAt: now,
        },
      });
    }
    return reserved.job;
  }

  try {
    const dispatched = await dispatchQueuedHuntWorker(actorInput);
    if (dispatched.status === 'disabled') {
      throw new Error('ClearPath Apify tetikleme modu yapilandirilmamis.');
    }
    await prisma.$transaction([
      prisma.huntingSearchCache.update({
        where: { id: reserved.cache.id },
        data: {
          apifyRunId: dispatched.runId,
          apifyDatasetId: dispatched.datasetId,
          status: 'RUNNING',
          dispatchLeaseId: null,
          dispatchLeaseUntil: null,
        },
      }),
      prisma.huntJob.update({
        where: { id: reserved.job.id },
        data: {
          apifyRunId: dispatched.runId,
          apifyDatasetId: dispatched.datasetId,
          apifyStatus: dispatched.apifyStatus,
          status: 'RUNNING',
          startedAt: now,
          lastHeartbeatAt: now,
        },
      }),
    ]);
  } catch (error) {
    // Dispatch did not start. Settle every tenant waiting on this shared cache;
    // otherwise follower jobs would retain quota and an active lock forever.
    const errorSummary =
      error instanceof Error ? error.message : 'Worker baslatilamadi.';
    await prisma.huntingSearchCache.update({
      where: { id: reserved.cache.id },
      data: {
        status: 'FAILED',
        errorSummary,
        dispatchLeaseId: null,
        dispatchLeaseUntil: null,
      },
    });
    const waitingJobs = await prisma.huntJob.findMany({
      where: {
        searchCacheId: reserved.cache.id,
        status: { in: [...ACTIVE_JOB_STATUSES] },
        apifyRunId: null,
      },
      select: { id: true },
    });
    for (const waiting of waitingJobs) {
      await releaseHuntJobReservation(waiting.id, {
        status: 'FAILED',
        errorSummary,
        now,
      });
    }
    throw error;
  }
  return prisma.huntJob.findUniqueOrThrow({ where: { id: reserved.job.id } });
}

export async function recoverQueuedClearpathDispatches(
  now = new Date(),
  limit = 10
) {
  const candidates = await prisma.huntingSearchCache.findMany({
    where: {
      status: 'FETCHING',
      apifyRunId: null,
      expiresAt: { gt: now },
      OR: [
        { dispatchLeaseUntil: null },
        { dispatchLeaseUntil: { lt: now } },
      ],
      jobs: {
        some: {
          status: { in: ['QUEUED', 'RUNNING'] },
          ingestedAt: null,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, actorInput: true },
    take: Math.min(Math.max(1, limit), 25),
  });

  let recovered = 0;
  let failed = 0;
  for (const cache of candidates) {
    const leaseId = randomUUID();
    const claimed = await prisma.huntingSearchCache.updateMany({
      where: {
        id: cache.id,
        status: 'FETCHING',
        apifyRunId: null,
        OR: [
          { dispatchLeaseUntil: null },
          { dispatchLeaseUntil: { lt: now } },
        ],
      },
      data: {
        dispatchLeaseId: leaseId,
        dispatchLeaseUntil: new Date(now.getTime() + 60_000),
      },
    });
    if (!claimed.count) continue;

    try {
      const actorInput = clearpathActorInputSchema.parse(cache.actorInput);
      const dispatched = await dispatchQueuedHuntWorker(actorInput);
      if (dispatched.status === 'disabled') {
        throw new Error('ClearPath Apify tetikleme modu yapilandirilmamis.');
      }
      const stored = await prisma.huntingSearchCache.updateMany({
        where: {
          id: cache.id,
          apifyRunId: null,
          dispatchLeaseId: leaseId,
        },
        data: {
          status: 'RUNNING',
          apifyRunId: dispatched.runId,
          apifyDatasetId: dispatched.datasetId,
          dispatchLeaseId: null,
          dispatchLeaseUntil: null,
          errorSummary: null,
        },
      });
      if (!stored.count) {
        const { abortApifyRun } = await import('./worker-dispatch');
        await abortApifyRun(dispatched.runId);
        continue;
      }
      await prisma.huntJob.updateMany({
        where: {
          searchCacheId: cache.id,
          status: { in: ['QUEUED', 'RUNNING'] },
          ingestedAt: null,
        },
        data: {
          status: 'RUNNING',
          apifyRunId: dispatched.runId,
          apifyDatasetId: dispatched.datasetId,
          apifyStatus: dispatched.apifyStatus,
          startedAt: now,
          lastHeartbeatAt: now,
        },
      });
      recovered += 1;
    } catch (error) {
      const errorSummary =
        error instanceof Error ? error.message : 'Worker baslatilamadi.';
      await prisma.huntingSearchCache.updateMany({
        where: { id: cache.id, apifyRunId: null, dispatchLeaseId: leaseId },
        data: {
          status: 'FAILED',
          errorSummary,
          dispatchLeaseId: null,
          dispatchLeaseUntil: null,
        },
      });
      const waiting = await prisma.huntJob.findMany({
        where: {
          searchCacheId: cache.id,
          status: { in: [...ACTIVE_JOB_STATUSES] },
          apifyRunId: null,
        },
        select: { id: true },
      });
      for (const job of waiting) {
        await releaseHuntJobReservation(job.id, {
          status: 'FAILED',
          errorSummary,
          now,
        });
      }
      failed += 1;
    }
  }

  return { checked: candidates.length, recovered, failed };
}

export async function releaseHuntJobReservation(
  jobId: string,
  input: { status: 'FAILED' | 'CANCELLED'; errorSummary?: string; now?: Date }
) {
  const now = input.now || new Date();
  return serializable(async (tx) => {
    const job = await tx.huntJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Av isi bulunamadi.');
    if (job.quotaReserved > 0 && job.propertyType && job.quotaPeriodStart) {
      await tx.huntingMonthlyQuota.updateMany({
        where: {
          companyAccountId: job.companyAccountId,
          propertyType: job.propertyType,
          periodStart: job.quotaPeriodStart,
          reserved: { gte: job.quotaReserved },
        },
        data: { reserved: { decrement: job.quotaReserved } },
      });
    }
    await tx.huntingActiveJobLock.deleteMany({ where: { huntJobId: jobId } });
    return tx.huntJob.update({
      where: { id: jobId },
      data: {
        status: input.status,
        quotaReserved: 0,
        completedAt: now,
        errorSummary: input.errorSummary ?? null,
      },
    });
  });
}

export async function cancelHuntJobReservation(
  jobId: string,
  now = new Date()
) {
  const job = await prisma.huntJob.findUnique({
    where: { id: jobId },
    include: { searchCache: { select: { apifyRunId: true } } },
  });
  if (!job) throw new Error('Av isi bulunamadi.');
  // A provider run is billable after dispatch. Reserve conservatively as used
  // even when the user cancels, preventing start/cancel cost-limit bypass.
  if (job.apifyRunId || job.searchCache?.apifyRunId) {
    return commitHuntJobQuota(jobId, job.quotaReserved, now, 'CANCELLED');
  }
  return releaseHuntJobReservation(jobId, { status: 'CANCELLED', now });
}

export async function commitHuntJobQuota(
  jobId: string,
  delivered: number,
  now = new Date(),
  finalStatus: 'COMPLETED' | 'CANCELLED' | 'FAILED' = 'COMPLETED',
  quotaCharge = delivered
) {
  return serializable(async (tx) => {
    const job = await tx.huntJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Av isi bulunamadi.');
    const charge = Math.min(Math.max(0, quotaCharge), job.quotaReserved);
    if (job.quotaReserved > 0 && job.propertyType && job.quotaPeriodStart) {
      await tx.huntingMonthlyQuota.update({
        where: {
          companyAccountId_propertyType_periodStart: {
            companyAccountId: job.companyAccountId,
            propertyType: job.propertyType,
            periodStart: job.quotaPeriodStart,
          },
        },
        data: {
          reserved: { decrement: job.quotaReserved },
          used: { increment: charge },
        },
      });
    }
    await tx.huntingActiveJobLock.deleteMany({ where: { huntJobId: jobId } });
    return tx.huntJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        quotaReserved: 0,
        totalDiscovered: delivered,
        totalCompleted: delivered,
        completedAt: now,
        lastHeartbeatAt: now,
        ingestedAt: now,
      },
    });
  });
}

export function freshHuntIdempotencyKey() {
  return randomUUID();
}
