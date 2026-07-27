import { createHash } from 'node:crypto';
import { HuntingStatus, NotificationType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callAI } from '@/lib/ai';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import prisma from '@/lib/prisma';

const eliminationReasons = {
  OTHER_AGENT: 'İlan sahibi başka bir emlakçıyla anlaştı.',
  AUTHORITY_GIVEN: 'Satış yetkisi başka bir firmaya verildi.',
  OWNER_WITHDREW: 'İlan sahibi satıştan vazgeçti.',
  PRICE_DISAGREEMENT: 'Fiyat veya hizmet koşullarında anlaşma sağlanamadı.',
  UNREACHABLE: 'İlan sahibine tekrar ulaşılamadı.',
  DUPLICATE: 'Kayıt başka bir ilanla mükerrer.',
  OTHER: 'Diğer neden.',
} as const;

const patchSchema = z.object({
  id: z.string().trim().min(1),
  status: z.nativeEnum(HuntingStatus),
  authorizationNote: z.string().trim().max(2000).optional().nullable(),
  eliminationReason: z
    .enum([
      'OTHER_AGENT',
      'AUTHORITY_GIVEN',
      'OWNER_WITHDREW',
      'PRICE_DISAGREEMENT',
      'UNREACHABLE',
      'DUPLICATE',
      'OTHER',
    ])
    .optional()
    .nullable(),
  eliminationNote: z.string().trim().max(2000).optional().nullable(),
});

function numberFromListing(value: string | null) {
  if (!value) return null;
  const parsed = Number(value.replace(/[^\d]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function hunterFingerprint(companyAccountId: string, listingId: string) {
  return createHash('sha256')
    .update(`${companyAccountId}:hunter:${listingId}`)
    .digest('hex');
}

async function eliminationSummary(input: {
  title: string;
  reason: keyof typeof eliminationReasons;
  note?: string | null;
}) {
  const fallback = `${eliminationReasons[input.reason]}${
    input.note ? ` Danışman notu: ${input.note}` : ''
  }`;
  try {
    const response = await callAI(
      [
        {
          role: 'system',
          content:
            'Bir emlak operasyon kayıt uzmanısın. Yalnızca verilen nedeni ve danışman notunu kullanarak tek cümlelik, tarafsız Türkçe bir eleme özeti yaz. Bilgi uydurma.',
        },
        {
          role: 'user',
          content: `İlan: ${input.title}\nYapılandırılmış neden: ${eliminationReasons[input.reason]}\nDanışman notu: ${input.note || 'Yok'}`,
        },
      ],
      'hunting-elimination'
    );
    return response.content.trim().slice(0, 1000) || fallback;
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const listings = await prisma.huntedListing.findMany({
      where: { companyAccountId: principal.account.id },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        portfolioImport: {
          select: {
            id: true,
            status: true,
            propertyId: true,
            reviewNote: true,
          },
        },
      },
    });
    return NextResponse.json(listings);
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { error: 'Fabrika oturumu gerekli.' },
        { status: 401 }
      );
    }
    console.error('Hunting status GET error:', error);
    return NextResponse.json(
      { error: 'Avcı kayıtları yüklenemedi.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || 'Geçersiz Avcı durum işlemi.',
        },
        { status: 400 }
      );
    }
    const input = parsed.data;
    const listing = await prisma.huntedListing.findFirst({
      where: { id: input.id, companyAccountId: principal.account.id },
    });
    if (!listing) {
      return NextResponse.json(
        { error: 'Avcı ilanı bulunamadı.' },
        { status: 404 }
      );
    }
    if (input.status === HuntingStatus.RED && !input.eliminationReason) {
      return NextResponse.json(
        { error: 'Elendi durumuna alınırken yapılandırılmış neden seçin.' },
        { status: 400 }
      );
    }

    const summary =
      input.status === HuntingStatus.RED && input.eliminationReason
        ? await eliminationSummary({
            title: listing.title,
            reason: input.eliminationReason,
            note: input.eliminationNote,
          })
        : null;
    const updated = await prisma.huntedListing.update({
      where: { id: listing.id },
      data: {
        status: input.status,
        authorizationNote:
          input.status === HuntingStatus.AUTHORIZED
            ? input.authorizationNote?.trim() || null
            : listing.authorizationNote,
        authorizedAt:
          input.status === HuntingStatus.AUTHORIZED
            ? listing.authorizedAt || new Date()
            : listing.authorizedAt,
        eliminationReason:
          input.status === HuntingStatus.RED
            ? input.eliminationReason
            : null,
        eliminationNote:
          input.status === HuntingStatus.RED
            ? input.eliminationNote?.trim() || null
            : null,
        eliminationSummary: summary,
        eliminatedAt:
          input.status === HuntingStatus.RED ? new Date() : null,
      },
    });

    if (input.status === HuntingStatus.AUTHORIZED) {
      const fingerprint = hunterFingerprint(
        principal.account.id,
        listing.id
      );
      await prisma.portfolioImportItem.upsert({
        where: {
          companyAccountId_fingerprint: {
            companyAccountId: principal.account.id,
            fingerprint,
          },
        },
        create: {
          companyAccountId: principal.account.id,
          huntedListingId: listing.id,
          fingerprint,
          sourceUrl: listing.sourceUrl,
          externalId: listing.id,
          title: listing.title,
          location: listing.location,
          price: numberFromListing(listing.price),
          roomCount: listing.roomCount,
          area: numberFromListing(listing.area),
          description: listing.notes,
          imageUrl: listing.imageUrl,
          rawPayload: listing.rawData,
          status: 'PENDING',
        },
        update: {
          sourceUrl: listing.sourceUrl,
          title: listing.title,
          location: listing.location,
          price: numberFromListing(listing.price),
          roomCount: listing.roomCount,
          area: numberFromListing(listing.area),
          description: listing.notes,
          imageUrl: listing.imageUrl,
          rawPayload: listing.rawData,
          status: 'PENDING',
          reviewNote: null,
          reviewedAt: null,
          reviewedBy: null,
        },
      });
      await createCompanyNotification({
        companyAccountId: principal.account.id,
        type: NotificationType.GREEN_LISTING,
        title: 'Satış Yetkisi Alındı',
        message: `${listing.title} portföy onay kuyruğuna eklendi.`,
        link: '/fabrika/portfoyler?view=kaynaklar',
        important: true,
        dedupeKey: `hunting-authorized:${listing.id}`,
        metadata: { listingId: listing.id },
      });
    }

    return NextResponse.json({
      success: true,
      listing: updated,
      message:
        input.status === HuntingStatus.AUTHORIZED
          ? 'Satış yetkisi kaydedildi; portföy onayı bekleniyor.'
          : input.status === HuntingStatus.RED
            ? 'İlan eleme nedeni ve özetiyle arşivlendi.'
            : 'İlan durumu güncellendi.',
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { error: 'Fabrika oturumu gerekli.' },
        { status: 401 }
      );
    }
    console.error('Hunting status PATCH error:', error);
    return NextResponse.json(
      { error: 'İlan durumu güncellenemedi.' },
      { status: 500 }
    );
  }
}
