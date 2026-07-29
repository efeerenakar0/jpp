import 'server-only';

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { SOURCE_PROVIDERS, SOURCE_SCOPES } from './types';

const AUTHORIZATION_STATUSES = [
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'REVOKED',
  'EXPIRED',
] as const;

const REQUIRED_READ_SCOPES = [
  'SEARCH_READ',
  'DETAIL_READ',
  'MEDIA_READ',
] as const;

export const createSourceAuthorizationSchema = z
  .object({
    companyAccountId: z.string().trim().min(1).max(160),
    provider: z.enum(SOURCE_PROVIDERS),
    status: z.enum(AUTHORIZATION_STATUSES).default('PENDING'),
    allowedScopes: z.array(z.enum(SOURCE_SCOPES)).min(1).max(SOURCE_SCOPES.length),
    contractReference: z.string().trim().min(3).max(200),
    startsAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const startsAt = new Date(value.startsAt);
    const expiresAt = value.expiresAt ? new Date(value.expiresAt) : null;

    if (expiresAt && expiresAt <= startsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır.',
      });
    }

    if (value.status === 'ACTIVE') {
      const missingScopes = REQUIRED_READ_SCOPES.filter(
        (scope) => !value.allowedScopes.includes(scope)
      );
      if (missingScopes.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['allowedScopes'],
          message: `Aktif yetkide zorunlu kapsamlar eksik: ${missingScopes.join(', ')}`,
        });
      }
    }
  });

export const updateSourceAuthorizationSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    status: z.enum(AUTHORIZATION_STATUSES),
  })
  .strict();

export async function createSourceAuthorization(body: unknown) {
  const input = createSourceAuthorizationSchema.parse(body);

  if (input.provider === 'FIXTURE' && process.env.NODE_ENV === 'production') {
    throw new Error('Fixture kaynak yetkisi production ortamında oluşturulamaz.');
  }

  const account = await prisma.companyAccount.findUnique({
    where: { id: input.companyAccountId },
    select: { id: true },
  });
  if (!account) {
    throw new Error('Şirket hesabı bulunamadı.');
  }

  return prisma.sourceAuthorization.create({
    data: {
      companyAccountId: input.companyAccountId,
      provider: input.provider,
      status: input.status,
      allowedScopes: Array.from(new Set(input.allowedScopes)),
      contractReference: input.contractReference,
      startsAt: new Date(input.startsAt),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    },
  });
}

export async function updateSourceAuthorization(body: unknown) {
  const input = updateSourceAuthorizationSchema.parse(body);
  const current = await prisma.sourceAuthorization.findUnique({
    where: { id: input.id },
  });
  if (!current) {
    throw new Error('Kaynak yetkisi bulunamadı.');
  }

  if (
    input.status === 'ACTIVE' &&
    (current.startsAt > new Date() ||
      (current.expiresAt && current.expiresAt <= new Date()))
  ) {
    throw new Error('Geçerlilik tarihi dışındaki kaynak yetkisi aktifleştirilemez.');
  }

  if (input.status === 'ACTIVE') {
    const missingScopes = REQUIRED_READ_SCOPES.filter(
      (scope) => !current.allowedScopes.includes(scope)
    );
    if (missingScopes.length) {
      throw new Error(
        `Kaynak yetkisi kapsamı eksik: ${missingScopes.join(', ')}`
      );
    }
  }

  return prisma.sourceAuthorization.update({
    where: { id: input.id },
    data: { status: input.status },
  });
}
