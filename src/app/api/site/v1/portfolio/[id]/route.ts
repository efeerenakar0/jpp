import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { portfolioUpdateSchema } from '@/lib/website-integration';
import {
  requireWebsiteApiPrincipal,
  websiteApiError,
  websiteApiPreflight,
  websiteApiResponse,
} from '@/lib/website-api-auth';
import {
  isPropertyPublishable,
  publicationEligibilityWhere,
} from '@/lib/property-publication';

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

async function ownedProperty(id: string, companyAccountId: string) {
  return prisma.crmProperty.findFirst({
    where: { id, companyAccountId },
    select: { id: true },
  });
}

export async function OPTIONS(request: Request) {
  return websiteApiPreflight(request);
}

export async function GET(
  request: Request,
  context: RouteContext<'/api/site/v1/portfolio/[id]'>
) {
  try {
    const principal = await requireWebsiteApiPrincipal(request);
    const { id } = await context.params;
    const property = await prisma.crmProperty.findFirst({
      where: {
        id,
        ...publicationEligibilityWhere(principal.account.id, new Date()),
      },
      select: propertySelect,
    });
    if (!property) {
      return websiteApiResponse(
        request,
        principal,
        { success: false, error: 'Portföy bulunamadı.' },
        { status: 404 }
      );
    }
    return websiteApiResponse(request, principal, {
      success: true,
      data: property,
    });
  } catch (error) {
    return websiteApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/site/v1/portfolio/[id]'>
) {
  try {
    const principal = await requireWebsiteApiPrincipal(request);
    const { id } = await context.params;
    const parsed = portfolioUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return websiteApiResponse(
        request,
        principal,
        {
          success: false,
          error: 'Güncellenecek portföy bilgilerini kontrol edin.',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }
    if (!(await ownedProperty(id, principal.account.id))) {
      return websiteApiResponse(
        request,
        principal,
        { success: false, error: 'Portföy bulunamadı.' },
        { status: 404 }
      );
    }

    const input = parsed.data;
    if (input.status === 'ACTIVE' || input.status === 'RESERVED') {
      const current = await prisma.crmProperty.findFirst({
        where: { id, companyAccountId: principal.account.id },
        select: {
          companyAccountId: true,
          status: true,
          publicationApprovedAt: true,
          authorityDocumentVerifiedAt: true,
          authorityExpiresAt: true,
          eidsRequired: true,
          eidsVerifiedAt: true,
          eidsVerificationReference: true,
          eidsExemptionReason: true,
          publicationBlockedAt: true,
        },
      });
      if (
        !current ||
        !isPropertyPublishable(
          { ...current, status: input.status },
          { companyAccountId: principal.account.id, now: new Date() }
        )
      ) {
        return websiteApiResponse(
          request,
          principal,
          {
            success: false,
            error: 'Portföy insan, yetki belgesi ve EİDS yayın onayları tamamlanmadan aktifleştirilemez.',
          },
          { status: 409 }
        );
      }
    }
    const property = await prisma.$transaction(async (tx) => {
      const saved = await tx.crmProperty.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.referenceCode !== undefined
            ? { referenceCode: nullable(input.referenceCode) }
            : {}),
          ...(input.location !== undefined
            ? { location: nullable(input.location) }
            : {}),
          ...(input.price !== undefined ? { price: input.price } : {}),
          ...(input.roomCount !== undefined
            ? { roomCount: nullable(input.roomCount) }
            : {}),
          ...(input.area !== undefined ? { area: input.area } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.description !== undefined
            ? { description: nullable(input.description) }
            : {}),
          ...(input.imageUrl !== undefined
            ? { imageUrl: nullable(input.imageUrl) }
            : {}),
        },
        select: propertySelect,
      });
      await tx.crmActivity.create({
        data: {
          companyAccountId: principal.account.id,
          propertyId: saved.id,
          type: 'WEBSITE_API_PROPERTY_UPDATED',
          title: 'Web sitesi portföyü güncelledi',
          description: saved.title,
          metadata: JSON.stringify({
            integrationId: principal.integration.id,
          }),
        },
      });
      return saved;
    });

    return websiteApiResponse(request, principal, {
      success: true,
      data: property,
    });
  } catch (error) {
    return websiteApiError(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext<'/api/site/v1/portfolio/[id]'>
) {
  try {
    const principal = await requireWebsiteApiPrincipal(request);
    const { id } = await context.params;
    if (!(await ownedProperty(id, principal.account.id))) {
      return websiteApiResponse(
        request,
        principal,
        { success: false, error: 'Portföy bulunamadı.' },
        { status: 404 }
      );
    }

    const property = await prisma.$transaction(async (tx) => {
      const archived = await tx.crmProperty.update({
        where: { id },
        data: { status: 'ARCHIVED' },
        select: propertySelect,
      });
      await tx.crmActivity.create({
        data: {
          companyAccountId: principal.account.id,
          propertyId: archived.id,
          type: 'WEBSITE_API_PROPERTY_ARCHIVED',
          title: 'Web sitesi portföyü arşivledi',
          description: archived.title,
          metadata: JSON.stringify({
            integrationId: principal.integration.id,
          }),
        },
      });
      return archived;
    });

    return websiteApiResponse(request, principal, {
      success: true,
      data: property,
      message: 'Portföy arşivlendi.',
    });
  } catch (error) {
    return websiteApiError(error);
  }
}
