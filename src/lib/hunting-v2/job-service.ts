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

  authorization ||= await prisma.sourceAuthorization.findFirst({
    where: {
      companyAccountId: input.companyAccountId,
      provider: body.provider,
      status: 'ACTIVE',
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { updatedAt: 'desc' },
  });

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
