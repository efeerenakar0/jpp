import 'server-only';

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { appendManagerAudit } from '@/lib/digital-manager/events';
import { prisma } from '@/lib/prisma';

import {
  authorizedPoolEligibility,
  sanitizeAuthorizedPoolListing,
} from './authorized-portfolio-pool';

type PrincipalRef = { type: 'OWNER' | 'EMPLOYEE'; id: string };

export class AuthorizedPoolError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'NOT_ELIGIBLE'
      | 'INVALID_STATE'
  ) {
    super(message);
    this.name = 'AuthorizedPoolError';
  }
}

export const authorizedPoolFiltersSchema = z
  .object({
    query: z.string().trim().max(120).optional(),
    location: z.string().trim().max(120).optional(),
    roomCount: z.string().trim().max(30).optional(),
    propertyType: z.string().trim().max(80).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().positive().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { message: 'En düşük fiyat, en yüksek fiyattan büyük olamaz.' }
  );

export const publishPoolShareSchema = z
  .object({
    action: z.literal('publish'),
    propertyId: z.string().min(1),
    sharePermissionConfirmed: z.literal(true, {
      error: 'Paylaşım izni açıkça onaylanmalıdır.',
    }),
    permissionReference: z.string().trim().max(240).optional(),
  })
  .strict();

export const updatePoolShareSchema = z
  .object({
    action: z.literal('update-share'),
    shareId: z.string().min(1),
    status: z.enum(['ACTIVE', 'PAUSED', 'REVOKED']),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

export const requestPoolContactSchema = z
  .object({
    action: z.literal('request-contact'),
    shareId: z.string().min(1),
    message: z.string().trim().max(1200).optional(),
    idempotencyKey: z.string().trim().min(8).max(200),
  })
  .strict();

export const decidePoolContactSchema = z
  .object({
    action: z.literal('decide-contact'),
    requestId: z.string().min(1),
    decision: z.enum(['APPROVED', 'REJECTED']),
    note: z.string().trim().max(1200).optional(),
  })
  .strict();

function actor(principal: PrincipalRef) {
  return {
    actorType: principal.type,
    actorId: principal.id,
  };
}

function retryableTransactionError(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  return code === 'P2002' || code === 'P2034';
}

async function serializablePoolTransaction<T>(
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

export async function listAuthorizedPortfolioPool(
  requesterCompanyAccountId: string,
  filters: z.infer<typeof authorizedPoolFiltersSchema>,
  now: Date
) {
  const shares = await prisma.portfolioPoolShare.findMany({
    where: {
      status: 'ACTIVE',
      authorityExpiresAt: { gt: now },
      property: {
        is: {
          status: { in: ['ACTIVE', 'RESERVED'] },
          authorityDocumentVerifiedAt: { not: null },
          authorityExpiresAt: { gt: now },
          ...(filters.query
            ? {
                OR: [
                  { title: { contains: filters.query, mode: 'insensitive' } },
                  { location: { contains: filters.query, mode: 'insensitive' } },
                  { referenceCode: { contains: filters.query, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(filters.location
            ? { location: { contains: filters.location, mode: 'insensitive' } }
            : {}),
          ...(filters.roomCount ? { roomCount: filters.roomCount } : {}),
          ...(filters.propertyType
            ? { propertyType: { contains: filters.propertyType, mode: 'insensitive' } }
            : {}),
          ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
            ? {
                price: {
                  ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
                  ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
                },
              }
            : {}),
        },
      },
    },
    select: {
      id: true,
      ownerCompanyAccountId: true,
      authorityExpiresAt: true,
      status: true,
      sharePermissionGrantedAt: true,
      ownerCompanyAccount: { select: { companyName: true } },
      property: {
        select: {
          id: true,
          companyAccountId: true,
          title: true,
          location: true,
          price: true,
          roomCount: true,
          area: true,
          propertyType: true,
          imageUrl: true,
          status: true,
          authorityDocumentVerifiedAt: true,
          authorityExpiresAt: true,
        },
      },
      contactRequests: {
        where: { requesterCompanyAccountId },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, createdAt: true },
      },
    },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  return shares.flatMap((share) => {
    if (share.property.companyAccountId !== share.ownerCompanyAccountId) return [];
    const eligibility = authorizedPoolEligibility(
      {
        shareStatus: share.status,
        sharePermissionGrantedAt: share.sharePermissionGrantedAt,
        authorityDocumentVerifiedAt: share.property.authorityDocumentVerifiedAt,
        authorityExpiresAt:
          share.property.authorityExpiresAt &&
          share.property.authorityExpiresAt < share.authorityExpiresAt
            ? share.property.authorityExpiresAt
            : share.authorityExpiresAt,
        propertyStatus: share.property.status,
      },
      now
    );
    if (!eligibility.eligible) return [];

    const request = share.contactRequests[0] ?? null;
    return [
      {
        ...sanitizeAuthorizedPoolListing({
          id: share.id,
          propertyId: share.property.id,
          ownerCompanyId: share.ownerCompanyAccountId,
          ownerCompanyName: share.ownerCompanyAccount.companyName,
          title: share.property.title,
          location: share.property.location,
          price: share.property.price,
          roomCount: share.property.roomCount,
          area: share.property.area,
          propertyType: share.property.propertyType,
          imageUrl: share.property.imageUrl,
          authorityExpiresAt: share.authorityExpiresAt,
        }),
        isOwn: share.ownerCompanyAccountId === requesterCompanyAccountId,
        request: request
          ? {
              id: request.id,
              status: request.status,
              createdAt: request.createdAt.toISOString(),
            }
          : null,
      },
    ];
  });
}

export async function listPoolManagement(companyAccountId: string, now: Date) {
  const [ownedShares, incomingRequests, availableProperties] = await Promise.all([
    prisma.portfolioPoolShare.findMany({
      where: { ownerCompanyAccountId: companyAccountId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            referenceCode: true,
            status: true,
            authorityExpiresAt: true,
          },
        },
        _count: { select: { contactRequests: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.portfolioPoolContactRequest.findMany({
      where: { ownerCompanyAccountId: companyAccountId },
      include: {
        share: { include: { property: { select: { id: true, title: true } } } },
        requesterCompanyAccount: { select: { companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.crmProperty.findMany({
      where: {
        companyAccountId,
        status: { in: ['ACTIVE', 'RESERVED'] },
        authorityDocumentVerifiedAt: { not: null },
        authorityExpiresAt: { gt: now },
      },
      select: {
        id: true,
        title: true,
        referenceCode: true,
        location: true,
        authorityExpiresAt: true,
        portfolioPoolShares: {
          where: { ownerCompanyAccountId: companyAccountId },
          select: { id: true, status: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    }),
  ]);

  return {
    ownedShares: ownedShares.map((share) => ({
      id: share.id,
      status:
        share.status === 'ACTIVE' && share.authorityExpiresAt <= now
          ? ('EXPIRED' as const)
          : share.status,
      authorityExpiresAt: share.authorityExpiresAt.toISOString(),
      property: share.property,
      requestCount: share._count.contactRequests,
    })),
    incomingRequests: incomingRequests.map((request) => ({
      id: request.id,
      status: request.status,
      message: request.message,
      decisionNote: request.decisionNote,
      createdAt: request.createdAt.toISOString(),
      requesterCompanyName: request.requesterCompanyAccount.companyName,
      property: request.share.property,
    })),
    availableProperties: availableProperties.map((property) => ({
      id: property.id,
      title: property.title,
      referenceCode: property.referenceCode,
      location: property.location,
      authorityExpiresAt: property.authorityExpiresAt?.toISOString() || null,
      share: property.portfolioPoolShares[0] || null,
    })),
  };
}

export async function publishAuthorizedPoolShare(input: {
  companyAccountId: string;
  propertyId: string;
  permissionReference?: string;
  principal: PrincipalRef;
  now: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const property = await tx.crmProperty.findFirst({
      where: { id: input.propertyId, companyAccountId: input.companyAccountId },
      select: {
        id: true,
        status: true,
        authorityDocumentVerifiedAt: true,
        authorityExpiresAt: true,
      },
    });
    if (!property) {
      throw new AuthorizedPoolError('Portföy bulunamadı.', 'NOT_FOUND');
    }
    const eligibility = authorizedPoolEligibility(
      {
        shareStatus: 'ACTIVE',
        sharePermissionGrantedAt: input.now,
        authorityDocumentVerifiedAt: property.authorityDocumentVerifiedAt,
        authorityExpiresAt: property.authorityExpiresAt,
        propertyStatus: property.status,
      },
      input.now
    );
    if (!eligibility.eligible) {
      throw new AuthorizedPoolError(
        'Portföy yalnız geçerli satış yetkisi ve yayınlanabilir durumla havuza alınabilir.',
        'NOT_ELIGIBLE'
      );
    }

    const share = await tx.portfolioPoolShare.upsert({
      where: {
        ownerCompanyAccountId_propertyId: {
          ownerCompanyAccountId: input.companyAccountId,
          propertyId: property.id,
        },
      },
      update: {
        status: 'ACTIVE',
        sharePermissionGrantedAt: input.now,
        permissionReference: input.permissionReference || null,
        authorityExpiresAt: property.authorityExpiresAt!,
        publishedAt: input.now,
        pausedAt: null,
        revokedAt: null,
        revokedReason: null,
      },
      create: {
        ownerCompanyAccountId: input.companyAccountId,
        propertyId: property.id,
        sharePermissionGrantedAt: input.now,
        permissionReference: input.permissionReference || null,
        authorityExpiresAt: property.authorityExpiresAt!,
        publishedAt: input.now,
        createdByPrincipalType: input.principal.type,
        createdByPrincipalId: input.principal.id,
      },
    });

    await appendManagerAudit(
      {
        companyAccountId: input.companyAccountId,
        ...actor(input.principal),
        operation: 'AUTHORIZED_POOL_SHARE_PUBLISHED',
        entityType: 'PORTFOLIO_POOL_SHARE',
        entityId: share.id,
        verifiedContext: { propertyId: property.id },
        policyDecision: 'ALLOW_EXPLICIT_SHARE_PERMISSION',
        result: 'SUCCESS',
        completedAt: input.now,
      },
      tx
    );
    return share;
  });
}

export async function updateAuthorizedPoolShare(input: {
  companyAccountId: string;
  shareId: string;
  status: 'ACTIVE' | 'PAUSED' | 'REVOKED';
  reason?: string;
  principal: PrincipalRef;
  now: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const share = await tx.portfolioPoolShare.findFirst({
      where: { id: input.shareId, ownerCompanyAccountId: input.companyAccountId },
      include: { property: true },
    });
    if (!share) throw new AuthorizedPoolError('Havuz kaydı bulunamadı.', 'NOT_FOUND');

    if (input.status === 'ACTIVE') {
      const eligibility = authorizedPoolEligibility(
        {
          shareStatus: 'ACTIVE',
          sharePermissionGrantedAt: share.sharePermissionGrantedAt,
          authorityDocumentVerifiedAt: share.property.authorityDocumentVerifiedAt,
          authorityExpiresAt: share.property.authorityExpiresAt,
          propertyStatus: share.property.status,
        },
        input.now
      );
      if (!eligibility.eligible) {
        throw new AuthorizedPoolError('Portföy yeniden paylaşılmaya uygun değil.', 'NOT_ELIGIBLE');
      }
    }

    const updated = await tx.portfolioPoolShare.update({
      where: { id: share.id },
      data: {
        status: input.status,
        pausedAt: input.status === 'PAUSED' ? input.now : null,
        revokedAt: input.status === 'REVOKED' ? input.now : null,
        revokedReason: input.status === 'REVOKED' ? input.reason || null : null,
      },
    });
    await appendManagerAudit(
      {
        companyAccountId: input.companyAccountId,
        ...actor(input.principal),
        operation: `AUTHORIZED_POOL_SHARE_${input.status}`,
        entityType: 'PORTFOLIO_POOL_SHARE',
        entityId: share.id,
        result: 'SUCCESS',
        completedAt: input.now,
      },
      tx
    );
    return updated;
  });
}

export async function requestAuthorizedPoolContact(input: {
  requesterCompanyAccountId: string;
  shareId: string;
  message?: string;
  idempotencyKey: string;
  principal: PrincipalRef;
  now: Date;
}) {
  return serializablePoolTransaction(async (tx) => {
    const duplicate = await tx.portfolioPoolContactRequest.findUnique({
      where: {
        requesterCompanyAccountId_idempotencyKey: {
          requesterCompanyAccountId: input.requesterCompanyAccountId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (duplicate) {
      if (
        duplicate.shareId !== input.shareId ||
        (duplicate.message || null) !== (input.message?.trim() || null)
      ) {
        throw new AuthorizedPoolError(
          'Bu istek anahtarı farklı bir iletişim talebinde kullanılmış.',
          'INVALID_STATE'
        );
      }
      return duplicate;
    }

    const share = await tx.portfolioPoolShare.findUnique({
      where: { id: input.shareId },
      include: { property: true },
    });
    if (!share || share.property.companyAccountId !== share.ownerCompanyAccountId) {
      throw new AuthorizedPoolError('Paylaşılabilir portföy bulunamadı.', 'NOT_FOUND');
    }
    if (share.ownerCompanyAccountId === input.requesterCompanyAccountId) {
      throw new AuthorizedPoolError('Kendi portföyünüz için talep oluşturamazsınız.', 'INVALID_STATE');
    }
    const eligibility = authorizedPoolEligibility(
      {
        shareStatus: share.status,
        sharePermissionGrantedAt: share.sharePermissionGrantedAt,
        authorityDocumentVerifiedAt: share.property.authorityDocumentVerifiedAt,
        authorityExpiresAt:
          share.property.authorityExpiresAt &&
          share.property.authorityExpiresAt < share.authorityExpiresAt
            ? share.property.authorityExpiresAt
            : share.authorityExpiresAt,
        propertyStatus: share.property.status,
      },
      input.now
    );
    if (!eligibility.eligible) {
      throw new AuthorizedPoolError('Portföy artık havuzda erişilebilir değil.', 'NOT_ELIGIBLE');
    }

    const pending = await tx.portfolioPoolContactRequest.findFirst({
      where: {
        shareId: share.id,
        requesterCompanyAccountId: input.requesterCompanyAccountId,
        status: 'PENDING',
      },
    });
    if (pending) return pending;

    const request = await tx.portfolioPoolContactRequest.create({
      data: {
        shareId: share.id,
        requesterCompanyAccountId: input.requesterCompanyAccountId,
        ownerCompanyAccountId: share.ownerCompanyAccountId,
        message: input.message || null,
        idempotencyKey: input.idempotencyKey,
        createdByPrincipalType: input.principal.type,
        createdByPrincipalId: input.principal.id,
      },
    });
    await appendManagerAudit(
      {
        companyAccountId: input.requesterCompanyAccountId,
        ...actor(input.principal),
        operation: 'AUTHORIZED_POOL_CONTACT_REQUESTED',
        entityType: 'PORTFOLIO_POOL_CONTACT_REQUEST',
        entityId: request.id,
        verifiedContext: { shareId: share.id },
        result: 'SUCCESS',
        completedAt: input.now,
      },
      tx
    );
    return request;
  });
}

export async function decideAuthorizedPoolContact(input: {
  ownerCompanyAccountId: string;
  requestId: string;
  decision: 'APPROVED' | 'REJECTED';
  note?: string;
  principal: PrincipalRef;
  now: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.portfolioPoolContactRequest.findFirst({
      where: {
        id: input.requestId,
        ownerCompanyAccountId: input.ownerCompanyAccountId,
      },
    });
    if (!request) throw new AuthorizedPoolError('İletişim talebi bulunamadı.', 'NOT_FOUND');
    if (request.status !== 'PENDING') return request;

    const transition = await tx.portfolioPoolContactRequest.updateMany({
      where: {
        id: request.id,
        ownerCompanyAccountId: input.ownerCompanyAccountId,
        status: 'PENDING',
      },
      data: {
        status: input.decision,
        decisionNote: input.note || null,
        decidedAt: input.now,
        decidedByPrincipalType: input.principal.type,
        decidedByPrincipalId: input.principal.id,
      },
    });
    if (transition.count === 0) {
      return tx.portfolioPoolContactRequest.findFirstOrThrow({
        where: {
          id: request.id,
          ownerCompanyAccountId: input.ownerCompanyAccountId,
        },
      });
    }
    const updated = await tx.portfolioPoolContactRequest.findFirstOrThrow({
      where: {
        id: request.id,
        ownerCompanyAccountId: input.ownerCompanyAccountId,
      },
    });
    await appendManagerAudit(
      {
        companyAccountId: input.ownerCompanyAccountId,
        ...actor(input.principal),
        operation: `AUTHORIZED_POOL_CONTACT_${input.decision}`,
        entityType: 'PORTFOLIO_POOL_CONTACT_REQUEST',
        entityId: request.id,
        policyDecision: input.decision,
        result: 'SUCCESS',
        completedAt: input.now,
      },
      tx
    );
    return updated;
  });
}

export async function expireAuthorizedPortfolioShares(now: Date) {
  return prisma.$transaction(async (tx) => {
    const dueShares = await tx.portfolioPoolShare.findMany({
      where: { status: 'ACTIVE', authorityExpiresAt: { lte: now } },
      select: {
        id: true,
        ownerCompanyAccountId: true,
        propertyId: true,
        authorityExpiresAt: true,
      },
      take: 500,
    });
    if (dueShares.length === 0) return { count: 0 };

    const updated = await tx.portfolioPoolShare.updateMany({
      where: {
        id: { in: dueShares.map((share) => share.id) },
        status: 'ACTIVE',
        authorityExpiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });
    await tx.operationEvent.createMany({
      data: dueShares.map((share) => ({
        companyAccountId: share.ownerCompanyAccountId,
        eventType: 'PROPERTY_UNPUBLISHED' as const,
        entityType: 'PortfolioPoolShare',
        entityId: share.id,
        propertyId: share.propertyId,
        actorType: 'SYSTEM',
        metadata: {
          reason: 'AUTHORITY_EXPIRED',
          authorityExpiresAt: share.authorityExpiresAt?.toISOString() || null,
          expiredAt: now.toISOString(),
        },
        idempotencyKey: `authorized-pool-expired:${share.id}`,
        occurredAt: now,
      })),
      skipDuplicates: true,
    });
    return updated;
  });
}

export type AuthorizedPoolTransaction = Prisma.TransactionClient;
