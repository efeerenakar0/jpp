import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI } from '@/lib/ai';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { fetchOwnedMediaBytes } from '@/lib/media-storage';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import { generateStudioPosterBackground } from '@/lib/studio-image-provider';
import { STUDIO_IMAGE_TO_IMAGE_STRENGTH } from '@/lib/stability-ultra';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 9 * 1024 * 1024;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const POSTER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const POSTER_NEGATIVE_PROMPT =
  'text, letters, numbers, logo, watermark, people, redesigned property, changed architecture, new pool, altered facade, inaccurate building, low resolution';

function stringValue(value: FormDataEntryValue | null, maximum = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function textValue(value: unknown, maximum = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function dataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function imageMime(file: File) {
  if (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/jpeg') {
    return file.type;
  }
  return 'image/jpeg';
}

type PosterSource = {
  key: string;
  buffer: Buffer;
  mimeType: string;
  name: string;
};

function stringArray(value: FormDataEntryValue | null, maximum: number) {
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
    return [];
  }
}

function posterPrompt(input: {
  companyName: string;
  location: string;
  roomCount: string;
  propertyType: string;
  area: string;
  price: string;
  details: string;
  highlights: string[];
}) {
  const facts = [
    input.location ? `location: ${input.location}` : '',
    input.propertyType ? `property type: ${input.propertyType}` : '',
    input.roomCount ? `rooms: ${input.roomCount}` : '',
    input.area ? `${input.area} m²` : '',
    input.price ? `fiyat: ${input.price}` : '',
    input.details,
    ...input.highlights.filter(Boolean),
  ]
    .filter(Boolean)
    .join(', ');

  return [
    'Make a conservative, photorealistic real-estate photography enhancement from the supplied property photo.',
    'Preserve the exact architecture, facade, rooms, landscape, pool, materials, camera angle and realistic proportions. Do not invent, remove or redesign any part of the property.',
    'Only improve natural lighting, color balance, clarity and editorial presentation while keeping clean negative space for a marketing overlay.',
    'Do not add any text, letters, numbers, logos, watermarks, people, sale signs or brand marks.',
    `Brand: ${input.companyName || 'real-estate agency'}.`,
    facts ? `Property facts to guide the visual mood: ${facts}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function fallbackCampaign(input: {
  companyName: string;
  posterName: string;
  location: string;
  roomCount: string;
  propertyType: string;
  area: string;
  price: string;
  details: string;
  highlights: string[];
}) {
  const variant = Math.floor(Date.now() / 1000) % 3;
  const facts = [input.location, input.propertyType, input.roomCount, input.area ? `${input.area} m²` : '', input.price].filter(Boolean).join(' · ');
  const highlights = input.highlights.filter(Boolean).join(', ');
  const title = input.posterName || 'Yeni portföyümüz';
  const intros = [
    'Sizin için özenle hazırladığımız yeni portföyümüzü paylaşmak isteriz.',
    'Bölgenin dikkat çeken gayrimenkullerinden biriyle tanışın.',
    'Yeni portföyümüz, konfor ve yatırım değerini bir araya getiriyor.',
  ];
  const ctas = ['Detay ve randevu için bu mesaja yanıt verebilirsiniz.', 'Güncel bilgi için bizimle hemen iletişime geçin.', 'Yerinde incelemek için randevunuzu oluşturalım.'];
  const whatsapp = `Merhaba, ${title} için hazırladığımız özel ilanı sizinle paylaşmak isteriz.${facts ? ` ${facts}.` : ''}${highlights ? ` Öne çıkan özellikler: ${highlights}.` : ''} ${input.details ? `${input.details} ` : ''}${intros[variant]} ${ctas[variant]}`;
  const instagram = `${title}\n\n${facts || 'Özenle seçilmiş gayrimenkul fırsatı'}${highlights ? `\nÖne çıkanlar: ${highlights}` : ''}${input.details ? `\n${input.details}` : ''}\n\n${intros[(variant + 1) % 3]} ${ctas[(variant + 2) % 3]}\n\n#gayrimenkul #emlak #yatırım #satılık #${input.companyName.replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ]/g, '').toLowerCase() || 'emlak'}`;
  return { whatsapp, instagram };
}

function parseCampaign(content: string, fallback: ReturnType<typeof fallbackCampaign>) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]) as { whatsapp?: unknown; instagram?: unknown };
    const whatsapp = textValue(parsed.whatsapp, 1300);
    const instagram = textValue(parsed.instagram, 2200);
    return { whatsapp: whatsapp || fallback.whatsapp, instagram: instagram || fallback.instagram };
  } catch {
    return fallback;
  }
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const properties = await prisma.crmProperty.findMany({
      where: { companyAccountId: principal.account.id },
      select: {
        id: true,
        title: true,
        location: true,
        price: true,
        roomCount: true,
        area: true,
        description: true,
        status: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({
      companyName: principal.account.companyName,
      logoDataUrl: principal.account.brandLogoData || null,
      properties,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof FabrikaSessionError ? error.message : 'Stüdyo bilgileri alınamadı.' },
      { status: error instanceof FabrikaSessionError ? 401 : 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const form = await request.formData();
    const companyName = stringValue(form.get('companyName'), 120) || principal.account.companyName;
    const mode: 'faithful' | 'creative' = form.get('mode') === 'creative' ? 'creative' : 'faithful';
    const files = form
      .getAll('photos')
      .filter((value): value is File => value instanceof File && value.size > 0)
      .slice(0, MAX_PHOTOS);
    const propertyId = stringValue(form.get('propertyId'), 120);
    const mediaIds = stringArray(form.get('mediaIdsJson'), MAX_PHOTOS);

    if (!files.length && !mediaIds.length) {
      return NextResponse.json({ error: 'Poster için en az bir görsel yükleyin.' }, { status: 400 });
    }
    if (
      files.some(
        (file) =>
          !POSTER_IMAGE_TYPES.has(file.type) ||
          file.size > MAX_PHOTO_BYTES
      )
    ) {
      return NextResponse.json(
        { error: 'Görseller JPG, PNG veya WEBP olmalı ve her biri 9 MB altında kalmalıdır.' },
        { status: 400 }
      );
    }
    if (files.length + mediaIds.length > MAX_PHOTOS) {
      return NextResponse.json(
        { error: 'Poster düzeninde en fazla 6 görsel kullanılabilir.' },
        { status: 400 }
      );
    }
    const media = mediaIds.length
      ? await prisma.crmPropertyMedia.findMany({
          where: {
            id: { in: mediaIds },
            companyAccountId: principal.account.id,
            ...(propertyId ? { propertyId } : {}),
            archivedAt: null,
            mediaType: 'PHOTO',
            mimeType: { in: ['image/jpeg', 'image/png', 'image/webp'] },
            usageRightsStatus: { not: 'RESTRICTED' },
            ...(mode === 'faithful'
              ? { variantType: { not: 'CREATIVE' as const } }
              : {}),
          },
        })
      : [];
    if (media.length !== mediaIds.length) {
      return NextResponse.json(
        { error: 'Seçilen portföy görsellerinden biri kullanılamıyor veya başka şirkete ait.' },
        { status: 403 }
      );
    }
    const mediaById = new Map(media.map((item) => [item.id, item]));
    const mediaSources: PosterSource[] = [];
    for (const mediaId of mediaIds) {
      const item = mediaById.get(mediaId)!;
      const downloaded = await fetchOwnedMediaBytes(item.url, {
        maxBytes: MAX_PHOTO_BYTES,
      });
      mediaSources.push({
        key: `media:${item.id}`,
        buffer: downloaded.bytes,
        mimeType: downloaded.mimeType,
        name: item.fileName,
      });
    }
    const fileSources: PosterSource[] = await Promise.all(
      files.map(async (file, index) => ({
        key: `file:${index}`,
        buffer: Buffer.from(await file.arrayBuffer()),
        mimeType: imageMime(file),
        name: file.name || `manuel-${index + 1}.jpg`,
      }))
    );
    const allSources = [...mediaSources, ...fileSources];
    const sourceOrder = stringArray(form.get('sourceOrderJson'), MAX_PHOTOS);
    const sourceByKey = new Map(allSources.map((source) => [source.key, source]));
    const orderedSources = [
      ...sourceOrder
        .map((key) => sourceByKey.get(key))
        .filter((source): source is PosterSource => Boolean(source)),
      ...allSources.filter((source) => !sourceOrder.includes(source.key)),
    ].slice(0, MAX_PHOTOS);
    const heroKey = stringValue(form.get('heroKey'), 160);
    const selectedHero =
      orderedSources.find((source) => source.key === heroKey) ??
      orderedSources[0];
    if (!selectedHero) {
      return NextResponse.json(
        { error: 'Poster ana görseli bulunamadı.' },
        { status: 400 }
      );
    }

    const logo = form.get('logo');
    let logoDataUrl: string | null = principal.account.brandLogoData || null;
    if (logo instanceof File && logo.size > 0) {
      if (!POSTER_IMAGE_TYPES.has(logo.type) || logo.size > MAX_LOGO_BYTES) {
        return NextResponse.json({ error: 'Logo bir görsel olmalı ve 2 MB altında kalmalıdır.' }, { status: 400 });
      }
      logoDataUrl = dataUrl(Buffer.from(await logo.arrayBuffer()), imageMime(logo));
      if (form.get('rememberLogo') === 'true' && principal.permissions.canManageSecrets) {
        await prisma.companyAccount.update({
          where: { id: principal.account.id },
          data: { brandLogoData: logoDataUrl },
        });
      }
    }

    const input = {
      companyName,
      location: stringValue(form.get('location'), 160),
      roomCount: stringValue(form.get('roomCount'), 50),
      propertyType: stringValue(form.get('propertyType'), 80),
      area: stringValue(form.get('area'), 60),
      price: stringValue(form.get('price'), 80),
      details: stringValue(form.get('details'), 1200),
      highlights: [
        stringValue(form.get('highlight1'), 120),
        stringValue(form.get('highlight2'), 120),
        stringValue(form.get('highlight3'), 120),
      ],
    };

    if (mode === 'faithful') {
      return NextResponse.json({
        success: true,
        mode,
        backgroundDataUrl: dataUrl(selectedHero.buffer, selectedHero.mimeType),
        backgroundSource: 'canvas',
        fallbackUsed: false,
        logoDataUrl,
        usedMediaIds: mediaIds,
        heroKey: selectedHero.key,
      });
    }

    const background = await generateStudioPosterBackground({
      image: selectedHero.buffer,
      mimeType: selectedHero.mimeType,
      prompt: posterPrompt(input),
      negativePrompt: POSTER_NEGATIVE_PROMPT,
      strength: STUDIO_IMAGE_TO_IMAGE_STRENGTH,
      clientUserId: principal.account.id.slice(-18),
    });
    return NextResponse.json({
      success: true,
      mode,
      backgroundDataUrl: dataUrl(background.buffer, background.mimeType),
      backgroundSource: background.source,
      fallbackUsed: background.fallbackUsed,
      warning: background.fallbackUsed
        ? 'Stable Image Ultra bu isteği tamamlayamadı; poster mevcut fotoğrafla hazırlandı.'
        : null,
      provider: background.provider,
      model: background.model,
      fallbackCode: background.fallbackCode,
      logoDataUrl,
      usedMediaIds: mediaIds,
      heroKey: selectedHero.key,
    });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const body = (await request.json()) as Record<string, unknown>;
    const propertyId = textValue(body.propertyId, 120);
    const property = propertyId
      ? await prisma.crmProperty.findFirst({
          where: { id: propertyId, companyAccountId: principal.account.id },
          select: { title: true, location: true, roomCount: true, area: true, price: true, description: true },
        })
      : null;
    const input = {
      companyName: textValue(body.companyName, 120) || principal.account.companyName,
      posterName: textValue(body.posterName, 160) || property?.title || '',
      location: textValue(body.location, 160) || property?.location || '',
      roomCount: textValue(body.roomCount, 50) || property?.roomCount || '',
      propertyType: textValue(body.propertyType, 80),
      area: textValue(body.area, 60) || (property?.area ? String(property.area) : ''),
      price: textValue(body.price, 80) || (property?.price ? new Intl.NumberFormat('tr-TR').format(property.price) + ' TL' : ''),
      details: textValue(body.details, 1200) || property?.description || '',
      highlights: [textValue(body.highlight1, 120), textValue(body.highlight2, 120), textValue(body.highlight3, 120)],
    };
    const fallback = fallbackCampaign(input);
    try {
      const ai = await callAI([
        {
          role: 'system',
          content:
            'Sen Türkiye gayrimenkul pazarlama uzmanısın. Yalnızca geçerli JSON döndür: {"whatsapp":"...","instagram":"..."}. Türkçe yaz. Her ikisi ilan bilgilerine özel, doğal ve farklı olmalı. WhatsApp 700, Instagram 1300 karakteri geçmesin. Instagram metninde 4-7 alakalı hashtag kullan. Fiyat veya metrekare yoksa uydurma.',
        },
        {
          role: 'user',
          content: `Şirket: ${input.companyName}. İlan başlığı: ${input.posterName}. Konum: ${input.location || 'verilmedi'}. Tip: ${input.propertyType || 'verilmedi'}. Oda: ${input.roomCount || 'verilmedi'}. Metrekare: ${input.area || 'verilmedi'}. Fiyat: ${input.price || 'verilmedi'}. Öne çıkanlar: ${input.highlights.filter(Boolean).join(', ') || 'verilmedi'}. Ek bilgiler: ${input.details || 'verilmedi'}. Bu portföye özel iki paylaşım metni üret.`,
        },
      ]);
      return NextResponse.json({ ...parseCampaign(ai.content, fallback), source: 'ai' });
    } catch {
      return NextResponse.json({ ...fallback, source: 'template' });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof FabrikaSessionError ? error.message : 'Kampanya metni üretilemedi.' },
      { status: error instanceof FabrikaSessionError ? 401 : 500 }
    );
  }
}
