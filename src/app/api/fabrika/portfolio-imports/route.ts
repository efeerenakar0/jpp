import {
  CrmPropertyStatus,
  HuntingStatus,
  NotificationType,
} from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import { importHuntedListingMedia } from '@/lib/property-media';
import prisma from '@/lib/prisma';

const reviewSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    id: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('reject'),
    id: z.string().trim().min(1),
    note: z.string().trim().min(3).max(1000),
  }),
]);

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Fabrika oturumu gerekli.' },
    { status: 401 }
  );
}

async function importData(companyAccountId: string) {
  const items = await prisma.portfolioImportItem.findMany({
    where: { companyAccountId },
    include: {
      source: { select: { id: true, name: true, type: true } },
      huntedListing: {
        select: {
          id: true,
          ownerName: true,
          authorizationNote: true,
        },
      },
      property: {
        select: { id: true, title: true, status: true, referenceCode: true },
      },
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 250,
  });
  return {
    items,
    metrics: {
      pending: items.filter((item) => item.status === 'PENDING').length,
      approved: items.filter((item) => item.status === 'APPROVED').length,
      rejected: items.filter((item) => item.status === 'REJECTED').length,
    },
  };
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    return NextResponse.json({
      success: true,
      data: await importData(principal.account.id),
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
    return NextResponse.json(
      { success: false, error: 'Portföy onay kuyruğu yüklenemedi.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = reviewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Geçersiz onay işlemi.',
        },
        { status: 400 }
      );
    }
    const input = parsed.data;
    const item = await prisma.portfolioImportItem.findFirst({
      where: { id: input.id, companyAccountId: principal.account.id },
      include: { huntedListing: true },
    });
    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Onay kaydı bulunamadı.' },
        { status: 404 }
      );
    }
    const reviewer = principal.member?.id || principal.account.id;

    if (input.action === 'reject') {
      await prisma.portfolioImportItem.update({
        where: { id: item.id },
        data: {
          status: 'REJECTED',
          reviewNote: input.note,
          reviewedBy: reviewer,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        message: 'Kayıt onay kuyruğundan reddedildi.',
        data: await importData(principal.account.id),
      });
    }

    const property = await prisma.$transaction(async (tx) => {
      const propertyData = {
        title: item.title,
        location: item.location,
        price: item.price,
        roomCount: item.roomCount,
        area: item.area,
        description: item.description,
        imageUrl: item.imageUrl,
        status: CrmPropertyStatus.ACTIVE,
        sourceListingId:
          item.huntedListingId ||
          item.externalId ||
          `import:${item.fingerprint.slice(0, 20)}`,
      };
      const saved = item.propertyId
        ? await tx.crmProperty.update({
            where: { id: item.propertyId },
            data: propertyData,
          })
        : await tx.crmProperty.create({
            data: {
              companyAccountId: principal.account.id,
              referenceCode: `PF-${item.fingerprint.slice(0, 6).toUpperCase()}`,
              ...propertyData,
            },
          });
      await tx.portfolioImportItem.update({
        where: { id: item.id },
        data: {
          propertyId: saved.id,
          status: 'APPROVED',
          reviewNote: null,
          reviewedBy: reviewer,
          reviewedAt: new Date(),
        },
      });
      if (item.huntedListingId) {
        await tx.huntedListing.updateMany({
          where: {
            id: item.huntedListingId,
            companyAccountId: principal.account.id,
          },
          data: {
            status: HuntingStatus.GREEN,
            syncedToSite: true,
          },
        });
        await importHuntedListingMedia({
          tx,
          actor: {
            companyAccountId: principal.account.id,
            memberId: principal.member?.id ?? null,
          },
          propertyId: saved.id,
          huntedListingId: item.huntedListingId,
          fallbackImageUrl: item.imageUrl,
        });
      }
      await tx.crmActivity.create({
        data: {
          companyAccountId: principal.account.id,
          propertyId: saved.id,
          actorMemberId: principal.member?.id || null,
          type: 'PORTFOLIO_IMPORT_APPROVED',
          title: 'Portföy kaynağı onaylandı',
          description: item.sourceUrl || item.title,
          metadata: JSON.stringify({
            importId: item.id,
            sourceId: item.sourceId,
            huntedListingId: item.huntedListingId,
          }),
        },
      });
      return saved;
    });

    await createCompanyNotification({
      companyAccountId: principal.account.id,
      type: NotificationType.GREEN_LISTING,
      title: 'Yeni Portföy Onaylandı',
      message: `${property.title} aktif şirket portföyüne eklendi.`,
      link: '/fabrika/portfoyler',
      important: true,
      dedupeKey: `portfolio-import-approved:${item.id}`,
      metadata: { importId: item.id, propertyId: property.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Kayıt aktif şirket portföyüne eklendi.',
      propertyId: property.id,
      data: await importData(principal.account.id),
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) return unauthorized();
    console.error('Portfolio import review error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Portföy onayı tamamlanamadı.',
      },
      { status: 500 }
    );
  }
}
