import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { assertPublicSourceUrl } from './security';
import { SOURCE_PROVIDERS } from './types';
import {
  buildSahibindenSearchUrl,
  sahibindenSearchFiltersSchema,
} from './search-filters';
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
        message: 'Bir filtre seçimi veya geçerli kaynak URLsi gereklidir.',
      });
    }
    if (body.filters && body.provider !== 'SAHIBINDEN') {
      context.addIssue({
        code: 'custom',
        path: ['filters'],
        message: 'Filtre seçimi yalnız Sahibinden kaynağında kullanılabilir.',
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

function parsePlatformAuthorizationDate(
  value: string | undefined,
  fallback: Date,
  fieldName: string
) {
  if (!value?.trim()) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Platform kaynak yetkisi ${fieldName} geçersiz.`);
  }
  return parsed;
}

function sahibindenPlatformAuthorizationConfig() {
  if (
    process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_ENABLED !== 'true'
  ) {
    return null;
  }

  const reference =
    process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_REFERENCE?.trim();
  if (!reference) {
    throw new Error('Platform kaynak yetkisi sözleşme referansı eksik.');
  }

  const contractReference = `${PLATFORM_AUTHORIZATION_PREFIX}${reference}`;
  if (contractReference.length > 200) {
    throw new Error('Platform kaynak yetkisi sözleşme referansı çok uzun.');
  }

  const startsAt = parsePlatformAuthorizationDate(
    process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_STARTS_AT,
    new Date(0),
    'başlangıç tarihi'
  );
  const expiresAt = process.env
    .AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_EXPIRES_AT
    ? parsePlatformAuthorizationDate(
        process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_EXPIRES_AT,
        new Date(0),
        'bitiş tarihi'
      )
    : null;
  if (expiresAt && expiresAt <= startsAt) {
    throw new Error(
      'Platform kaynak yetkisi bitiş tarihi başlangıçtan sonra olmalıdır.'
    );
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
  return createHash('sha256')
    .update(`${companyAccountId}\0${value}`)
    .digest('hex');
}

export async function createHuntJob(input: {
  companyAccountId: string;
  createdBy: string;
  body: unknown;
}) {
  const body = createHuntJobSchema.parse(input.body);
  const searchUrl = body.filters
    ? buildSahibindenSearchUrl(body.filters)
    : body.searchUrl!;
  await assertPublicSourceUrl(searchUrl, body.provider);

  if (
    body.provider !== 'FIXTURE' &&
    process.env.AVCI_LIVE_PROVIDER_ENABLED !== 'true'
  ) {
    throw new Error(
      'Canlı kaynak bağlayıcısı varsayılan olarak kapalıdır.'
    );
  }

  const now = new Date();
  let authorization = body.sourceAuthorizationId
    ? await prisma.sourceAuthorization.findFirst({
        where: {
          id: body.sourceAuthorizationId,
          companyAccountId: input.companyAccountId,
          provider: body.provider,
        },
      })
    : null;

  if (
    authorization?.contractReference.startsWith(
      PLATFORM_AUTHORIZATION_PREFIX
    )
  ) {
    const platformConfig =
      body.provider === 'SAHIBINDEN'
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
      provider: body.provider,
      NOT: {
        contractReference: { startsWith: PLATFORM_AUTHORIZATION_PREFIX },
      },
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!authorization && body.provider === 'SAHIBINDEN') {
    authorization = await materializeSahibindenPlatformAuthorization(
      input.companyAccountId
    );
  }

  if (body.provider === 'FIXTURE' && process.env.NODE_ENV !== 'production') {
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
    throw new Error('Aktif kaynak yetkisi bulunamadı.');
  }
  const missingScopes = REQUIRED_SOURCE_SCOPES.filter(
    (scope) => !authorization.allowedScopes.includes(scope)
  );
  if (missingScopes.length) {
    throw new Error(`Kaynak yetkisi kapsamı eksik: ${missingScopes.join(', ')}`);
  }

  const idempotencyKey =
    body.idempotencyKey ||
    derivedIdempotencyKey(input.companyAccountId, searchUrl);
  const job = await prisma.huntJob.upsert({
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

  if (job.status === 'QUEUED') {
    await dispatchQueuedHuntWorker(job.id);
  }

  return job;
}
