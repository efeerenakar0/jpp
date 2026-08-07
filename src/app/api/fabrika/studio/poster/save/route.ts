import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import {
  persistGeneratedMedia,
  validatePropertyMediaFiles,
} from '@/lib/media-storage';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import {
  addPropertyMedia,
  assertOwnedProperty,
  PropertyMediaError,
} from '@/lib/property-media';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function text(value: FormDataEntryValue | null, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function stringArray(value: FormDataEntryValue | null, maximum = 6) {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, maximum)
      : [];
  } catch {
    throw new PropertyMediaError('Poster kaynak listesi geçersiz.');
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const form = await request.formData();
    const propertyId = text(form.get('propertyId'), 120);
    if (!propertyId) {
      throw new PropertyMediaError(
        'Posteri kaydetmek için önce bir portföy seçin.'
      );
    }
    await assertOwnedProperty(
      {
        companyAccountId: principal.account.id,
        memberId: principal.member?.id ?? null,
      },
      propertyId
    );

    const poster = form.get('poster');
    if (!(poster instanceof File)) {
      throw new PropertyMediaError('Kaydedilecek poster dosyası bulunamadı.');
    }
    validatePropertyMediaFiles([poster]);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(poster.type)) {
      throw new PropertyMediaError(
        'Poster JPG, PNG veya WebP biçiminde olmalıdır.'
      );
    }

    const mode = form.get('mode') === 'creative' ? 'creative' : 'faithful';
    const format = form.get('format') === 'story' ? 'story' : 'post';
    const mediaIds = stringArray(form.get('mediaIdsJson'));
    let outputUsageRights: 'CONFIRMED' | 'UNVERIFIED' = 'CONFIRMED';
    if (mediaIds.length) {
      const sourceMedia = await prisma.crmPropertyMedia.findMany({
        where: {
          id: { in: mediaIds },
          companyAccountId: principal.account.id,
          propertyId,
          archivedAt: null,
        },
        select: { id: true, usageRightsStatus: true },
      });
      if (sourceMedia.length !== mediaIds.length) {
        throw new PropertyMediaError(
          'Poster kaynaklarından biri bu portföye ait değil.',
          403
        );
      }
      if (
        sourceMedia.some(
          (item) => item.usageRightsStatus === 'RESTRICTED'
        )
      ) {
        throw new PropertyMediaError(
          'Kullanımı kısıtlı bir görsel poster kaynağı olamaz.',
          403
        );
      }
      if (
        sourceMedia.some(
          (item) => item.usageRightsStatus === 'UNVERIFIED'
        )
      ) {
        outputUsageRights = 'UNVERIFIED';
      }
    }

    const clientFingerprint = text(form.get('fingerprint'), 20_000);
    const fingerprint = `poster:${createHash('sha256')
      .update(
        JSON.stringify({
          propertyId,
          mode,
          format,
          mediaIds,
          clientFingerprint,
        })
      )
      .digest('hex')}`;
    const existing = await prisma.crmPropertyMedia.findFirst({
      where: {
        companyAccountId: principal.account.id,
        propertyId,
        fingerprint,
        archivedAt: null,
      },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        media: existing,
        idempotent: true,
      });
    }

    const bytes = Buffer.from(await poster.arrayBuffer());
    const stored = await persistGeneratedMedia({
      companyAccountId: principal.account.id,
      propertyId,
      bytes,
      fileName:
        text(form.get('posterName'), 120) ||
        `business-ceo-ai-poster-${format}.${poster.type === 'image/png' ? 'png' : poster.type === 'image/webp' ? 'webp' : 'jpg'}`,
      mimeType: poster.type,
      folder: 'posters',
    });
    const [media] = await addPropertyMedia(
      {
        companyAccountId: principal.account.id,
        memberId: principal.member?.id ?? null,
      },
      propertyId,
      [
        {
          ...stored,
          mediaType: mode === 'creative' ? 'MARKETING_ASSET' : 'POSTER',
          source: 'POSTER',
          variantType: mode === 'creative' ? 'CREATIVE' : 'ORIGINAL',
          parentMediaId: mediaIds[0] || null,
          prompt:
            mode === 'creative'
              ? 'Stable Image Ultra ana görsel yeniden yorumlama ve Business CEO AI poster şablonu'
              : 'Business CEO AI gerçek fotoğraflı poster şablonu',
          aiProvider: mode === 'creative' ? 'STABILITY' : null,
          aiModel: mode === 'creative' ? 'stable-image-ultra' : null,
          usageRightsStatus: outputUsageRights,
          fingerprint,
          provenance: {
            template: 'luxury-editorial-v2',
            mode,
            format,
            mediaIds,
          },
        },
      ],
      {
        makeFirstCover: false,
        activityTitle:
          mode === 'creative'
            ? 'Kreatif poster pazarlama materyallerine kaydedildi'
            : 'Portföy posteri kaydedildi',
      }
    );
    return NextResponse.json({ success: true, media, idempotent: false });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
