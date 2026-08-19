import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI } from '@/lib/ai';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import {
  deleteStudioPosterReferences,
  fetchOwnedMediaBytes,
  publishStudioPosterReference,
  persistStudioPosterOutput,
} from '@/lib/media-storage';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import {
  BannerbearPosterError,
  generateBannerbearPoster,
  type BannerbearPosterOutputSize,
} from '@/lib/bannerbear-poster';
import {
  defaultBannerbearPreset,
  findBannerbearPreset,
  findFirstPresetForTemplate,
  findBannerbearTemplate,
  nextBannerbearPreset,
} from '@/lib/bannerbear-poster-catalog';
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
export const maxDuration = 300;

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 9 * 1024 * 1024;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const POSTER_RENDER_CONTRACT = 'bannerbear-v5-real-layouts-contrast-v2';
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
  publicUrl?: string;
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

function posterLocation(value: string) {
  const parts = value
    .split(/\s*[/,]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts.slice(0, 2).join(' / ') : value.trim();
}

function posterPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const local = digits.startsWith('90') && digits.length === 12
    ? digits.slice(2)
    : digits.startsWith('0') && digits.length === 11
      ? digits.slice(1)
      : digits;
  if (local.length === 10) {
    return `+90 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 8)} ${local.slice(8, 10)}`;
  }
  return value.trim();
}

function posterLogoReference(value: string | null) {
  if (!value) return null;
  const match = value.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i
  );
  if (!match) return null;
  const image = Buffer.from(match[2], 'base64');
  if (!image.length || image.length > MAX_LOGO_BYTES) return null;
  return { image, mimeType: match[1].toLowerCase() };
}

type PosterCopy = {
  headline: string;
  summary: string;
  callToAction: string;
};

function fallbackPosterCopy(input: {
  companyName: string;
  posterName: string;
  location: string;
  roomCount: string;
  propertyType: string;
  area: string;
  price: string;
  details: string;
  highlights: string[];
  contactPhone: string;
}): PosterCopy {
  const summary = textValue(
    input.details || input.highlights.filter(Boolean).join(' · '),
    150
  );
  return {
    headline: textValue(input.posterName || 'Yeni portföyümüz', 52),
    summary,
    callToAction: input.contactPhone
      ? 'Bilgi ve randevu için iletişime geçin'
      : 'Detaylı bilgi için bize ulaşın',
  };
}

function parsePosterCopy(content: string, fallback: PosterCopy): PosterCopy {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]) as Partial<PosterCopy>;
    return {
      headline: textValue(parsed.headline, 52) || fallback.headline,
      summary: textValue(parsed.summary, 150) || fallback.summary,
      callToAction:
        textValue(parsed.callToAction, 52) || fallback.callToAction,
    };
  } catch {
    return fallback;
  }
}

async function generatePosterCopy(input: Parameters<typeof fallbackPosterCopy>[0]) {
  const fallback = fallbackPosterCopy(input);
  try {
    const response = await callAI(
      [
        {
          role: 'system',
          content:
            'Sen emlak sosyal medya metin uzmanısın. Yalnız verilen doğrulanmış alanları kullan. Yeni özellik, yatırım vaadi, vatandaşlık vaadi, fiyat, konum veya sayı uydurma. Kısa, doğal Türkçe yaz. Yalnız geçerli JSON döndür.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task:
              'Poster için en fazla 52 karakter başlık, en fazla 150 karakter kısa özet ve en fazla 52 karakter iletişim çağrısı yaz.',
            output: {
              headline: 'string',
              summary: 'string',
              callToAction: 'string',
            },
            verifiedProperty: {
              title: input.posterName || null,
              location: input.location || null,
              roomCount: input.roomCount || null,
              propertyType: input.propertyType || null,
              areaM2: input.area || null,
              description: input.details || null,
              highlights: input.highlights.filter(Boolean),
              companyName: input.companyName || null,
            },
          }),
        },
      ],
      'poster-marketing-copy'
    );
    return parsePosterCopy(response.content, fallback);
  } catch {
    return fallback;
  }
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
        propertyType: true,
        area: true,
        listingType: true,
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
    const mode = 'creative' as const;
    const files = form
      .getAll('photos')
      .filter((value): value is File => value instanceof File && value.size > 0)
      .slice(0, MAX_PHOTOS);
    const propertyId = stringValue(form.get('propertyId'), 120);
    const mediaIds = stringArray(form.get('mediaIdsJson'), MAX_PHOTOS);
    const selectedProperty = propertyId
      ? await prisma.crmProperty.findFirst({
          where: {
            id: propertyId,
            companyAccountId: principal.account.id,
          },
          select: {
            id: true,
            title: true,
            location: true,
            price: true,
            roomCount: true,
            propertyType: true,
            area: true,
            listingType: true,
            description: true,
          },
        })
      : null;

    if (propertyId && !selectedProperty) {
      return NextResponse.json(
        { error: 'Seçilen portföy bulunamadı veya başka şirkete ait.' },
        { status: 404 }
      );
    }

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
            variantType: { not: 'CREATIVE' as const },
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
        publicUrl: item.url,
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

    const includePrice = form.get('includePrice') !== 'false';
    const includeLocation = form.get('includeLocation') !== 'false';
    const includePropertyFacts = form.get('includePropertyFacts') !== 'false';
    const includeDescription = form.get('includeDescription') !== 'false';
    const databasePrice = selectedProperty?.price != null
      ? `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(selectedProperty.price)} TL`
      : '';
    const databaseArea = selectedProperty?.area != null
      ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(selectedProperty.area)
      : '';
    const posterName = selectedProperty
      ? selectedProperty.title || ''
      : stringValue(form.get('posterName'), 160);
    const format: 'story' | 'post' =
      form.get('format') === 'story' ? 'story' : 'post';
    const requestedOutputSize = stringValue(form.get('outputSize'), 20);
    const outputSize: BannerbearPosterOutputSize =
      requestedOutputSize === 'wide' ||
      requestedOutputSize === 'portrait' ||
      requestedOutputSize === 'square'
        ? requestedOutputSize
        : format === 'story'
          ? 'portrait'
          : 'square';
    const requestedPresetId = stringValue(form.get('presetId'), 80);
    const requestedTemplateUid = stringValue(form.get('templateUid'), 40);
    const automaticStyle = form.get('automaticStyle') === 'true';
    let selectedPreset = requestedPresetId
      ? findBannerbearPreset(requestedPresetId)
      : requestedTemplateUid
        ? findFirstPresetForTemplate(requestedTemplateUid, format)
        : defaultBannerbearPreset(format);
    let selectedTemplate = selectedPreset
      ? findBannerbearTemplate(selectedPreset.templateUid)
      : null;
    if (
      !selectedPreset ||
      selectedPreset.format !== format ||
      !selectedTemplate ||
      selectedTemplate.format !== format
    ) {
      return NextResponse.json(
        { error: 'Seçilen poster görünümü bu boyutla uyumlu değil.' },
        { status: 400 }
      );
    }
    const showLogo = form.get('showLogo') !== 'false';
    const showContact = form.get('showContact') !== 'false';
    const companySettings = showContact
      ? await prisma.companySettings.findUnique({
          where: { companyAccountId: principal.account.id },
          select: { contactPhone: true },
        })
      : null;
    const contactPhone = showContact
      ? posterPhone(
          companySettings?.contactPhone || principal.account.ownerPhone || ''
        )
      : '';
    const logoReference = showLogo ? posterLogoReference(logoDataUrl) : null;
    const input = {
      companyName: showLogo ? companyName : '',
      posterName,
      location: includeLocation
        ? selectedProperty
          ? selectedProperty.location || ''
          : stringValue(form.get('location'), 160)
        : '',
      roomCount: includePropertyFacts
        ? selectedProperty
          ? selectedProperty.roomCount || ''
          : stringValue(form.get('roomCount'), 50)
        : '',
      propertyType: includePropertyFacts
        ? selectedProperty
          ? selectedProperty.propertyType || ''
          : stringValue(form.get('propertyType'), 80)
        : '',
      area: includePropertyFacts
        ? selectedProperty
          ? databaseArea
          : stringValue(form.get('area'), 60)
        : '',
      price: includePrice
        ? selectedProperty
          ? databasePrice
          : stringValue(form.get('price'), 80)
        : '',
      details: includeDescription
        ? selectedProperty
          ? selectedProperty.description || ''
          : stringValue(form.get('details'), 1200)
        : '',
      highlights: [
        stringValue(form.get('highlight1'), 120),
        stringValue(form.get('highlight2'), 120),
        stringValue(form.get('highlight3'), 120),
      ],
      contactPhone,
      hasLogoReference: Boolean(logoReference),
      format,
    };

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
        outputSize,
        posterName,
        heroKey: selectedHero.key,
        sources: sourceFingerprints,
        input,
        logoDigest: logoReference ? sha256(logoReference.image) : null,
        renderer: 'bannerbear-v5',
        renderContract: POSTER_RENDER_CONTRACT,
        templateUid: selectedTemplate.uid,
        presetId: selectedPreset.id,
        paletteId: selectedPreset.palette.id,
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
        if (!reservation.attempt.outputUrl) {
          throw new StudioPosterGenerationError(
            'Önceki ücretli üretim tamamlandı ancak eski sürüm sonucu saklamadı. Düğmeye yeniden basarak yeni güvenli kayıt akışını başlatın.',
            409,
            'COMPLETED_OUTPUT_UNAVAILABLE'
          );
        }
        return NextResponse.json({
          success: true,
          idempotent: true,
          alreadyCompleted: true,
          posterUrl: reservation.attempt.outputUrl,
          posterDataUrl: reservation.attempt.outputUrl,
          requiresTextReview: false,
          providerCostUsd: reservation.attempt.providerCostUsd,
          providerRequestId: reservation.attempt.providerRequestId,
          generation: posterGenerationPayload(reservation.generation),
        }, {
          headers: { 'Cache-Control': 'no-store' },
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

    let result: Buffer;
    const providerCostUsd: number | null = 0;
    let providerRequestId: string | null = null;
    const temporaryReferenceKeys: string[] = [];
    try {
      const imageUrls: string[] = [];
      for (const [index, source] of orderedSources.entries()) {
        if (source.publicUrl) {
          imageUrls.push(source.publicUrl);
          continue;
        }
        const published = await publishStudioPosterReference({
          companyAccountId: principal.account.id,
          attemptId: reservation.attempt.id,
          role: `photo-${index + 1}`,
          bytes: source.buffer,
          mimeType: source.mimeType,
        });
        imageUrls.push(published.url);
        temporaryReferenceKeys.push(published.storageKey);
      }
      let logoUrl: string | null = null;
      if (logoReference) {
        const publishedLogo = await publishStudioPosterReference({
          companyAccountId: principal.account.id,
          attemptId: reservation.attempt.id,
          role: 'company-logo',
          bytes: logoReference.image,
          mimeType: logoReference.mimeType,
        });
        logoUrl = publishedLogo.url;
        temporaryReferenceKeys.push(publishedLogo.storageKey);
      }
      const copy = await generatePosterCopy(input);
      let renderPreset = selectedPreset;
      let renderTemplate = selectedTemplate;
      let generated: Awaited<ReturnType<typeof generateBannerbearPoster>> | null = null;
      const maximumRenderAttempts = automaticStyle ? 3 : 1;
      for (let renderAttempt = 0; renderAttempt < maximumRenderAttempts; renderAttempt += 1) {
        try {
          generated = await generateBannerbearPoster({
            apiKey: process.env.BANNERBEAR_API_KEY,
            templateUid: renderTemplate.uid,
            presetId: renderPreset.id,
            format,
            outputSize,
            imageUrls,
            logoUrl,
            facts: {
              companyName: input.companyName,
              headline: copy.headline,
              summary: copy.summary,
              callToAction: copy.callToAction,
              location: posterLocation(input.location),
              roomCount: input.roomCount,
              area: input.area,
              price: input.price,
              propertyType: input.propertyType,
              highlights: input.highlights,
              contactPhone: input.contactPhone,
            },
            metadata: JSON.stringify({
              companyAccountId: principal.account.id,
              generationId: reservation.generation.id,
              attemptId: reservation.attempt.id,
              renderAttempt,
            }),
          });
          break;
        } catch (error) {
          const providerError = error instanceof BannerbearPosterError ? error : null;
          const mayTryAnotherTemplate =
            renderAttempt + 1 < maximumRenderAttempts &&
            providerError !== null &&
            (providerError.code === 'INVALID_PROVIDER_RESPONSE' ||
              providerError.code === 'INVALID_TEMPLATE' ||
              (providerError.code === 'PROVIDER_ERROR' && providerError.status >= 500));
          if (!mayTryAnotherTemplate) throw error;
          renderPreset = nextBannerbearPreset(format, renderPreset.id);
          const nextTemplate = findBannerbearTemplate(renderPreset.templateUid);
          if (!nextTemplate) throw error;
          renderTemplate = nextTemplate;
        }
      }
      if (!generated) {
        throw new BannerbearPosterError(
          'Bannerbear geçerli bir poster sonucu döndürmedi.',
          'INVALID_PROVIDER_RESPONSE'
        );
      }
      result = generated.buffer;
      providerRequestId = generated.providerRequestId;
      selectedPreset = renderPreset;
      selectedTemplate = renderTemplate;
    } catch (error) {
      const providerError =
        error instanceof BannerbearPosterError ? error : null;
      const invalidOutput =
        providerError?.code === 'INVALID_PROVIDER_RESPONSE' ||
        providerError?.code === 'INVALID_TEMPLATE';
      await failStudioPosterGenerationAttempt({
        companyAccountId: principal.account.id,
        attemptId: reservation.attempt.id,
        failureCode: invalidOutput
          ? 'AI_POSTER_INVALID_OUTPUT'
          : 'POSTER_RENDER_FAILED',
      });
      activeAttempt = null;
      return NextResponse.json(
        {
          error:
            invalidOutput
              ? 'Seçilen Bannerbear şablonu portföy bilgileriyle hazırlanamadı. Başka bir görünüm seçip yeniden deneyin.'
              : providerError?.code === 'NOT_CONFIGURED'
                ? 'Bannerbear bağlantısı henüz yapılandırılmamış.'
                : 'Bannerbear posteri şu anda hazırlayamadı. Lütfen birkaç saniye sonra yeniden deneyin.',
        },
        { status: invalidOutput ? 422 : 503 }
      );
    } finally {
      await deleteStudioPosterReferences(temporaryReferenceKeys).catch((error) => {
        console.warn('[studio-poster] temporary reference cleanup failed', {
          attemptId: reservation.attempt.id,
          error: error instanceof Error ? error.name : 'UnknownError',
        });
      });
    }

    let storedPoster: Awaited<ReturnType<typeof persistStudioPosterOutput>>;
    try {
      storedPoster = await persistStudioPosterOutput({
        companyAccountId: principal.account.id,
        generationId: reservation.generation.id,
        attemptId: reservation.attempt.id,
        bytes: result,
        format,
      });
    } catch (error) {
      await failStudioPosterGenerationAttempt({
        companyAccountId: principal.account.id,
        attemptId: reservation.attempt.id,
        failureCode: 'POSTER_STORAGE_FAILED',
      });
      activeAttempt = null;
      console.error('[studio-poster] output storage failed', {
        attemptId: reservation.attempt.id,
        generationId: reservation.generation.id,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      return NextResponse.json(
        {
          error:
            'Poster üretildi ancak güvenli dosya alanına kaydedilemedi. Ücretli isteği tekrarlamadan önce lütfen destek ekibine bildirin.',
          code: 'POSTER_STORAGE_FAILED',
        },
        { status: 503 }
      );
    }

    const generation = await completeStudioPosterGenerationAttempt({
      companyAccountId: principal.account.id,
      attemptId: reservation.attempt.id,
      resultDigest: storedPoster.checksum,
      outputUrl: storedPoster.url,
      outputStorageKey: storedPoster.storageKey,
      outputMimeType: storedPoster.mimeType,
      outputByteSize: storedPoster.byteSize,
      providerCostUsd,
      providerRequestId,
    });
    activeAttempt = null;
    console.info('[studio-poster] generation stored', {
      attemptId: reservation.attempt.id,
      generationId: reservation.generation.id,
      byteSize: storedPoster.byteSize,
      providerCostUsd,
      providerRequestId,
    });
    return NextResponse.json(
      {
        success: true,
        mode,
        posterUrl: storedPoster.url,
        posterDataUrl: storedPoster.url,
        logoDataUrl,
        requiresTextReview: false,
        providerCostUsd,
        providerRequestId,
        templateUid: selectedTemplate.uid,
        templateName: selectedTemplate.name,
        presetId: selectedPreset.id,
        presetName: selectedPreset.name,
        usedMediaIds: mediaIds,
        heroKey: selectedHero.key,
        generation: posterGenerationPayload(generation),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
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
