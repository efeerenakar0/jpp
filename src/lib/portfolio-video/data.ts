import 'server-only';
import type { PrismaClient } from '@prisma/client';
import prisma from '../prisma';
import { portfolioVideoCatalogSchema, type PortfolioVideoCatalog } from './types';

type VideoCatalogPrincipal = {
  account: {
    id: string;
    companyName: string;
    brandLogoData: string | null;
    ownerName: string;
    ownerPhone: string | null;
    ownerEmail: string | null;
  };
  member: { name: string; phone: string | null; email: string | null } | null;
  displayName: string;
};

type VideoCatalogClient = Pick<PrismaClient, 'crmProperty'>;

function cleanFeature(value: string) {
  return value.replace(/\s+/g, ' ').replace(/^[-•\s]+/, '').trim().slice(0, 120);
}

export function extractPortfolioVideoFeatures(input: {
  description: string | null;
  roomCount: string | null;
  area: number | null;
}) {
  const structured = [
    input.roomCount ? `${input.roomCount} oda` : null,
    input.area ? `${new Intl.NumberFormat('tr-TR').format(input.area)} m²` : null,
  ].filter(Boolean) as string[];
  const descriptionFeatures = (input.description ?? '')
    .split(/[\n,;.!?]+/)
    .map(cleanFeature)
    .filter((value) => value.length >= 3);
  return [...new Set([...structured, ...descriptionFeatures])].slice(0, 5);
}

export async function loadPortfolioVideoCatalog(
  principal: VideoCatalogPrincipal,
  client: VideoCatalogClient = prisma
): Promise<PortfolioVideoCatalog> {
  const properties = await client.crmProperty.findMany({
    where: {
      companyAccountId: principal.account.id,
      status: { in: ['DRAFT', 'ACTIVE', 'RESERVED'] },
    },
    include: {
      assignedMember: {
        select: { name: true, phone: true, email: true },
      },
      media: {
        where: {
          companyAccountId: principal.account.id,
          archivedAt: null,
          mediaType: 'PHOTO',
          usageRightsStatus: { not: 'RESTRICTED' },
        },
        select: {
          id: true,
          url: true,
          fileName: true,
          width: true,
          height: true,
          isCover: true,
          usageRightsStatus: true,
        },
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  return portfolioVideoCatalogSchema.parse({
    portfolios: properties.map((property) => {
      const advisor = property.assignedMember ?? principal.member ?? {
        name: principal.account.ownerName || principal.displayName,
        phone: principal.account.ownerPhone,
        email: principal.account.ownerEmail,
      };
      return {
        id: property.id,
        title: property.title,
        referenceCode: property.referenceCode,
        location: property.location,
        price: property.price,
        roomCount: property.roomCount,
        area: property.area,
        description: property.description,
        features: extractPortfolioVideoFeatures(property),
        status: property.status,
        photos: property.media
          .filter((media) => media.usageRightsStatus !== 'RESTRICTED')
          .map((media) => ({
            id: media.id,
            url: media.url,
            fileName: media.fileName,
            width: media.width,
            height: media.height,
            isCover: media.isCover,
          })),
        company: {
          name: principal.account.companyName,
          logoUrl: principal.account.brandLogoData,
        },
        advisor: {
          name: advisor.name,
          phone: advisor.phone,
          email: advisor.email,
        },
      };
    }),
  });
}
