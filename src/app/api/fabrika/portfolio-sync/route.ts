import { createHash } from 'node:crypto';
import { HuntingStatus, NotificationType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import prisma from '@/lib/prisma';

const requestSchema = z.object({
  listingId: z.string().trim().min(1),
  authorizationNote: z.string().trim().max(2000).optional().nullable(),
});

function numericListingValue(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function fingerprint(companyAccountId: string, listingId: string) {
  return createHash('sha256')
    .update(`${companyAccountId}:hunter:${listingId}`)
    .digest('hex');
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const listings = await prisma.huntedListing.findMany({
      where: {
        companyAccountId: principal.account.id,
        status: HuntingStatus.AUTHORIZED,
        syncedToSite: false,
      },
      include: {
        portfolioImport: {
          select: { id: true, status: true, reviewNote: true },
        },
      },
      orderBy: { authorizedAt: 'desc' },
    });
    return NextResponse.json(listings);
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { error: 'Fabrika oturumu gerekli.' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Onay bekleyen Avcı portföyleri yüklenemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Geçerli bir Avcı ilanı seçin.' },
        { status: 400 }
      );
    }
    const input = parsed.data;
    const listing = await prisma.huntedListing.findFirst({
      where: {
        id: input.listingId,
        companyAccountId: principal.account.id,
      },
    });
    if (!listing) {
      return NextResponse.json(
        { error: 'Avcı ilanı bulunamadı.' },
        { status: 404 }
      );
    }
    const item = await prisma.portfolioImportItem.upsert({
      where: {
        companyAccountId_fingerprint: {
          companyAccountId: principal.account.id,
          fingerprint: fingerprint(principal.account.id, listing.id),
        },
      },
      create: {
        companyAccountId: principal.account.id,
        huntedListingId: listing.id,
        fingerprint: fingerprint(principal.account.id, listing.id),
        externalId: listing.id,
        sourceUrl: listing.sourceUrl,
        title: listing.title,
        location: listing.location,
        price: numericListingValue(listing.price),
        roomCount: listing.roomCount,
        area: numericListingValue(listing.area),
        description: listing.notes,
        imageUrl: listing.imageUrl,
        rawPayload: listing.rawData,
      },
      update: {
        status: 'PENDING',
        reviewNote: null,
        reviewedAt: null,
        reviewedBy: null,
      },
    });
    await prisma.huntedListing.update({
      where: { id: listing.id },
      data: {
        status: HuntingStatus.AUTHORIZED,
        authorizationNote: input.authorizationNote?.trim() || null,
        authorizedAt: listing.authorizedAt || new Date(),
      },
    });
    await createCompanyNotification({
      companyAccountId: principal.account.id,
      type: NotificationType.GREEN_LISTING,
      title: 'Satış Yetkisi Alındı',
      message: `${listing.title} portföy onay kuyruğuna eklendi.`,
      link: '/fabrika/portfoyler?view=kaynaklar',
      important: true,
      dedupeKey: `portfolio-review:${item.id}`,
      metadata: { listingId: listing.id, importId: item.id },
    });
    return NextResponse.json({
      success: true,
      message:
        'İlan canlı yayınlanmadı; Portföyler onay kuyruğuna gönderildi.',
      importId: item.id,
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { error: 'Fabrika oturumu gerekli.' },
        { status: 401 }
      );
    }
    console.error('Portfolio review queue error:', error);
    return NextResponse.json(
      { error: 'İlan portföy onayına gönderilemedi.' },
      { status: 500 }
    );
  }
}
