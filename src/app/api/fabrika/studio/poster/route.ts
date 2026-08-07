import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI } from '@/lib/ai';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { fetchOwnedMediaBytes } from '@/lib/media-storage';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import {
  readResponseBufferWithLimit,
  ResponseSizeLimitError,
} from '@/lib/http-response-limits';
import {
  completeStudioPosterGenerationAttempt,
  failStudioPosterGenerationAttempt,
  posterGenerationPayload,
  reserveStudioPosterGeneration,
  StudioPosterGenerationError,
} from '@/lib/studio-poster-generation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 9 * 1024 * 1024;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_GENERATED_IMAGE_BYTES = 15 * 1024 * 1024;
const STABILITY_TIMEOUT_MS = 90_000;
const POSTER_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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

function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}

function posterRequestKey(value: FormDataEntryValue | null, fallback: string) {
  const key = stringValue(value, 120);
  if (key && !/^[A-Za-z0-9:_-]{12,120}$/.test(key)) {
    throw new StudioPosterGenerationError(
      'Poster istek anahtarı geçersiz.',
      400,
      'INVALID_IDEMPOTENCY_KEY'
    );
  }
  return key || `legacy:${fallback}`;
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
  let activeAttempt: { companyAccountId: string; attemptId: string } | null =
    null;
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
    const posterName = stringValue(form.get('posterName'), 160);
    const format = form.get('format') === 'story' ? 'story' : 'post';

    const generationAction =
      form.get('generationAction') === 'REGENERATE'
        ? ('REGENERATE' as const)
        : ('INITIAL' as const);
    const generationId = stringValue(form.get('generationId'), 120) || null;
    const sourceFingerprints = orderedSources.map((source) => ({
      key: source.key,
      digest: sha256(source.buffer),
    }));
    const logicalFingerprint = sha256(
      JSON.stringify({
        companyAccountId: principal.account.id,
        propertyId: propertyId || null,
        mode,
        format,
        posterName,
        heroKey: selectedHero.key,
        sources: sourceFingerprints,
        input,
      })
    );
    const requestFingerprint = sha256(
      JSON.stringify({
        generationAction,
        generationId,
        logicalFingerprint,
      })
    );
    const idempotencyKey = posterRequestKey(
      form.get('idempotencyKey'),
      requestFingerprint
    );
    const reservation = await reserveStudioPosterGeneration({
      companyAccountId: principal.account.id,
      memberId: principal.member?.id ?? null,
      propertyId: propertyId || null,
      action: generationAction,
      generationId,
      logicalFingerprint,
      requestFingerprint,
      idempotencyKey,
    });

    if (reservation.duplicate) {
      if (reservation.attempt.status === 'SUCCEEDED') {
        return NextResponse.json({
          success: true,
          idempotent: true,
          alreadyCompleted: true,
          generation: posterGenerationPayload(reservation.generation),
        });
      }
      throw new StudioPosterGenerationError(
        reservation.attempt.status === 'PROCESSING'
          ? 'Bu poster isteği hâlâ işleniyor.'
          : 'Önceki deneme tamamlanamadı. Yeniden denemek için tekrar düğmeye basın.',
        409,
        reservation.attempt.status === 'PROCESSING'
          ? 'GENERATION_IN_PROGRESS'
          : 'PREVIOUS_ATTEMPT_FAILED'
      );
    }
    activeAttempt = {
      companyAccountId: principal.account.id,
      attemptId: reservation.attempt.id,
    };

    if (mode === 'faithful') {
      const generation = await completeStudioPosterGenerationAttempt({
        companyAccountId: principal.account.id,
        attemptId: reservation.attempt.id,
        resultDigest: sha256(selectedHero.buffer),
      });
      activeAttempt = null;
      return NextResponse.json({
        success: true,
        mode,
        backgroundDataUrl: dataUrl(selectedHero.buffer, selectedHero.mimeType),
        logoDataUrl,
        usedMediaIds: mediaIds,
        heroKey: selectedHero.key,
        generation: posterGenerationPayload(generation),
      });
    }

    const stabilityApiKey = process.env.STABILITY_API_KEY?.trim();
    if (!stabilityApiKey) {
      await failStudioPosterGenerationAttempt({
        companyAccountId: principal.account.id,
        attemptId: reservation.attempt.id,
        failureCode: 'STABILITY_NOT_CONFIGURED',
      });
      activeAttempt = null;
      return NextResponse.json(
        { error: 'Kreatif poster motoru geçici olarak kullanılamıyor. Lütfen platform yöneticinizle iletişime geçin.' },
        { status: 503 }
      );
    }

    const body = new FormData();
    body.append('prompt', posterPrompt(input));
    body.append(
      'image',
      new Blob([new Uint8Array(selectedHero.buffer)], {
        type: selectedHero.mimeType,
      }),
      selectedHero.name || 'property.jpg'
    );
    body.append('strength', '0.55');
    body.append('negative_prompt', 'text, letters, numbers, logo, watermark, people, redesigned property, changed architecture, new pool, altered facade, inaccurate building, low resolution');
    body.append('output_format', 'jpeg');

    let response: Response;
    try {
      response = await fetch(
        'https://api.stability.ai/v2beta/stable-image/generate/ultra',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stabilityApiKey}`,
            Accept: 'image/*',
            'stability-client-id': 'Business CEO AI Studio',
            'stability-client-user-id': principal.account.id.slice(-18),
            'stability-client-version': '1.0',
          },
          body,
          cache: 'no-store',
          signal: AbortSignal.timeout(STABILITY_TIMEOUT_MS),
        }
      );
    } catch {
      await failStudioPosterGenerationAttempt({
        companyAccountId: principal.account.id,
        attemptId: reservation.attempt.id,
        failureCode: 'PROVIDER_TIMEOUT',
      });
      activeAttempt = null;
      return NextResponse.json(
        {
          error:
            'Poster motoru zamanında yanıt vermedi. İsteğiniz kaydedildi; lütfen yeniden deneyin.',
        },
        { status: 503 }
      );
    }

    if (!response.ok) {
      const providerError = await response.text().catch(() => '');
      const retryable = response.status === 429 || response.status >= 500;
      await failStudioPosterGenerationAttempt({
        companyAccountId: principal.account.id,
        attemptId: reservation.attempt.id,
        failureCode: retryable ? 'PROVIDER_BUSY' : 'PROVIDER_REJECTED',
      });
      activeAttempt = null;
      return NextResponse.json(
        {
          error: retryable
            ? 'Poster motoru şu an yoğun. Birkaç saniye sonra yeniden deneyin.'
            : 'Poster üretilemedi. Stability API bakiyesini, anahtarı ve yüklenen görseli kontrol edin.',
          providerStatus: response.status,
          details: process.env.NODE_ENV === 'development' ? providerError.slice(0, 300) : undefined,
        },
        { status: retryable ? 503 : 422 }
      );
    }

    let result: Buffer;
    try {
      result = await readResponseBufferWithLimit(
        response,
        MAX_GENERATED_IMAGE_BYTES
      );
    } catch (error) {
      await failStudioPosterGenerationAttempt({
        companyAccountId: principal.account.id,
        attemptId: reservation.attempt.id,
        failureCode:
          error instanceof ResponseSizeLimitError
            ? 'PROVIDER_OUTPUT_TOO_LARGE'
            : 'PROVIDER_RESPONSE_FAILED',
      });
      activeAttempt = null;
      return NextResponse.json(
        {
          error:
            error instanceof ResponseSizeLimitError
              ? 'Poster çıktısı güvenli dosya boyutu sınırını aştı.'
              : 'Poster çıktısı okunamadı. Lütfen yeniden deneyin.',
        },
        { status: 502 }
      );
    }
    const generation = await completeStudioPosterGenerationAttempt({
      companyAccountId: principal.account.id,
      attemptId: reservation.attempt.id,
      resultDigest: sha256(result),
    });
    activeAttempt = null;
    return NextResponse.json({
      success: true,
      mode,
      backgroundDataUrl: dataUrl(result, response.headers.get('content-type') || 'image/jpeg'),
      logoDataUrl,
      usedMediaIds: mediaIds,
      heroKey: selectedHero.key,
      generation: posterGenerationPayload(generation),
    });
  } catch (error) {
    if (activeAttempt) {
      await failStudioPosterGenerationAttempt({
        companyAccountId: activeAttempt.companyAccountId,
        attemptId: activeAttempt.attemptId,
        failureCode: 'UNEXPECTED_ERROR',
      }).catch(() => undefined);
    }
    if (error instanceof StudioPosterGenerationError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
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
