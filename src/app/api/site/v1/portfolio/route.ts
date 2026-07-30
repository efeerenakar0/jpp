import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  portfolioCreateSchema,
  websiteIntegrationStatuses,
} from '@/lib/website-integration';
import {
  requireWebsiteApiPrincipal,
  websiteApiError,
  websiteApiPreflight,
  websiteApiResponse,
} from '@/lib/website-api-auth';

export const dynamic = 'force-dynamic';

const propertySelect = {
  id: true,
  title: true,
  referenceCode: true,
  location: true,
  price: true,
  roomCount: true,
  area: true,
  status: true,
  description: true,
  imageUrl: true,
  sourceListingId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CrmPropertySelect;

function nullable(value: string | null | undefined) {
  return value?.trim() || null;
}

export async function OPTIONS(request: Request) {
  return websiteApiPreflight(request);
}

export async function GET(request: Request) {
  try {
    const principal = await requireWebsiteApiPrincipal(request);
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    const requestedLimit = Number(url.searchParams.get('limit') || '50');
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 100)
      : 50;

    const properties = await prisma.crmProperty.findMany({
      where: {
        companyAccountId: principal.account.id,
        status:
          scope === 'all'
            ? { not: 'ARCHIVED' }
            : { in: ['ACTIVE', 'RESERVED'] },
      },
      select: propertySelect,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    return websiteApiResponse(request, principal, {
      success: true,
      data: properties,
      meta: { count: properties.length, limit, scope: scope || 'public' },
    });
  } catch (error) {
    return websiteApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireWebsiteApiPrincipal(request);
    const parsed = portfolioCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return websiteApiResponse(
        request,
        principal,
        {
          success: false,
          error: 'Portföy bilgilerini kontrol edin.',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const sourceListingId = `site:${principal.integration.id}:${
      nullable(input.externalId) || randomUUID()
    }`;
    const propertyData = {
      title: input.title,
      referenceCode: nullable(input.referenceCode),
      location: nullable(input.location),
      price: input.price ?? null,
      roomCount: nullable(input.roomCount),
      area: input.area ?? null,
      status: input.status,
      description: nullable(input.description),
      imageUrl: nullable(input.imageUrl),
    };

    const property = await prisma.$transaction(async (tx) => {
      const saved = input.externalId
        ? await tx.crmProperty.upsert({
            where: {
              companyAccountId_sourceListingId: {
                companyAccountId: principal.account.id,
                sourceListingId,
              },
            },
            create: {
              companyAccountId: principal.account.id,
              sourceListingId,
              ...propertyData,
            },
            update: propertyData,
            select: propertySelect,
          })
        : await tx.crmProperty.create({
            data: {
              companyAccountId: principal.account.id,
              sourceListingId,
              ...propertyData,
            },
            select: propertySelect,
          });

      await tx.crmActivity.create({
        data: {
          companyAccountId: principal.account.id,
          propertyId: saved.id,
          type: 'WEBSITE_API_PROPERTY_UPSERTED',
          title: 'Web sitesi portföyü kaydetti',
          description: saved.title,
          metadata: JSON.stringify({
            integrationId: principal.integration.id,
            integrationStatus: websiteIntegrationStatuses.includes(
              principal.integration
                .status as (typeof websiteIntegrationStatuses)[number]
            )
              ? principal.integration.status
              : 'UNKNOWN',
          }),
        },
      });
      return saved;
    });

    return websiteApiResponse(
      request,
      principal,
      { success: true, data: property },
      { status: 201 }
    );
  } catch (error) {
    return websiteApiError(error);
  }
}
