import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError } from '@/lib/hunting-v2/api';

export const runtime = 'nodejs';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
  jobId: z.string().min(1).optional(),
  acquisitionStatus: z
    .enum([
      'DISCOVERED',
      'DETAIL_COMPLETE',
      'PARTIAL',
      'UNAVAILABLE',
      'REMOVED',
      'SOURCE_CHALLENGE',
    ])
    .optional(),
  contactReady: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export async function GET(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const now = new Date();
    const readyContactWhere: Prisma.HuntedContactWhereInput = {
      verificationStatus: {
        in: [
          'OTP_VERIFIED',
          'PARTNER_VERIFIED',
          'MANUALLY_VERIFIED',
        ],
      },
      subjectRole: { in: ['OWNER', 'AUTHORIZED_REPRESENTATIVE'] },
      sourceType: { not: 'LEGACY_UNVERIFIED' },
      sourcePurposeAllowed: true,
      legalBasisStatus: 'CONFIRMED',
      doNotContactAt: null,
      quarantinedAt: null,
      retentionUntil: { gt: now },
      consents: {
        some: {
          companyAccountId: principal.account.id,
          channel: 'WHATSAPP',
          purpose: 'SALES_AUTHORITY_DISCUSSION',
          status: 'GRANTED',
          iysStatus: 'APPROVED',
        },
      },
      approvals: {
        some: {
          companyAccountId: principal.account.id,
          channel: 'WHATSAPP',
          purpose: 'SALES_AUTHORITY_DISCUSSION',
          status: 'APPROVED',
          revokedAt: null,
        },
      },
      policyDecisions: {
        some: {
          companyAccountId: principal.account.id,
          channel: 'WHATSAPP',
          purpose: 'SALES_AUTHORITY_DISCUSSION',
          allowed: true,
        },
      },
    };
    const where = {
      companyAccountId: principal.account.id,
      ...(query.jobId
        ? { jobLinks: { some: { jobId: query.jobId } } }
        : {}),
      ...(query.acquisitionStatus
        ? { acquisitionStatus: query.acquisitionStatus }
        : {}),
      ...(query.contactReady === true
        ? { contacts: { some: readyContactWhere } }
        : {}),
      ...(query.contactReady === false
        ? { contacts: { none: readyContactWhere } }
        : {}),
    } as const;
    const [total, listings] = await prisma.$transaction([
      prisma.huntedListing.count({ where }),
      prisma.huntedListing.findMany({
        where,
        orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          huntJobId: true,
          sourceProvider: true,
          sourceListingId: true,
          title: true,
          price: true,
          priceAmount: true,
          currency: true,
          province: true,
          district: true,
          neighborhood: true,
          addressPrecision: true,
          acquisitionStatus: true,
          completenessScore: true,
          imageUrl: true,
          lastSeenAt: true,
          images: {
            orderBy: { order: 'asc' },
            take: 1,
            select: { sourceUrl: true, storageKey: true },
          },
          contacts: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              maskedPhone: true,
              verificationStatus: true,
              doNotContactAt: true,
              sourceType: true,
              sourcePurposeAllowed: true,
              legalBasisStatus: true,
              retentionUntil: true,
              quarantinedAt: true,
              consents: {
                where: {
                  companyAccountId: principal.account.id,
                  channel: 'WHATSAPP',
                  purpose: 'SALES_AUTHORITY_DISCUSSION',
                },
                orderBy: { updatedAt: 'desc' },
                take: 1,
                select: {
                  status: true,
                  iysStatus: true,
                  updatedAt: true,
                },
              },
              approvals: {
                where: {
                  companyAccountId: principal.account.id,
                  channel: 'WHATSAPP',
                  purpose: 'SALES_AUTHORITY_DISCUSSION',
                  status: 'APPROVED',
                  revokedAt: null,
                },
                orderBy: { approvedAt: 'desc' },
                take: 1,
                select: { approvedAt: true, revokedAt: true },
              },
              policyDecisions: {
                orderBy: { evaluatedAt: 'desc' },
                take: 1,
                select: {
                  allowed: true,
                  reasonCodes: true,
                  evaluatedAt: true,
                },
              },
            },
          },
        },
      }),
    ]);
    return NextResponse.json({
      items: listings,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    });
  } catch (error) {
    return huntingApiError(error);
  }
}
