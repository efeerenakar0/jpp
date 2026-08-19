import 'server-only';

import path from 'node:path';
import sharp from 'sharp';

const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';
const OPENROUTER_POSTER_MODEL = 'google/gemini-3.1-flash-image';
const PROVIDER_TIMEOUT_MS = 270_000;
const MAX_REFERENCE_IMAGES = 4;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_GENERATED_BYTES = 24 * 1024 * 1024;
const POSTER_FONT_PATH = path.join(
  process.cwd(),
  'node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf'
);

export type OpenRouterPosterFormat = 'post' | 'story';

export type AccuratePosterText = {
  companyName: string;
  posterName: string;
  location: string;
  roomCount: string;
  propertyType: string;
  area: string;
  price: string;
  details: string;
  highlights: string[];
  showContact: boolean;
  showLogo: boolean;
};

export class OpenRouterPosterImageError extends Error {
  constructor(
    public readonly code:
      | 'NOT_CONFIGURED'
      | 'INVALID_SOURCE'
      | 'PROVIDER_ERROR'
      | 'INVALID_PROVIDER_RESPONSE',
    message: string,
    public readonly status = 502
  ) {
    super(message);
    this.name = 'OpenRouterPosterImageError';
  }
}

type PosterReference = {
  image: Buffer;
  mimeType: string;
};

type OpenRouterImagePayload = {
  data?: Array<{
    b64_json?: unknown;
    url?: unknown;
  }>;
  images?: Array<{
    b64_json?: unknown;
    image_url?: { url?: unknown };
    url?: unknown;
  }>;
  usage?: {
    cost?: unknown;
  };
  id?: unknown;
  error?: {
    message?: unknown;
  };
};

function providerErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '';
  const message = (payload as OpenRouterImagePayload).error?.message;
  return typeof message === 'string' ? message.trim() : '';
}

function imageValue(payload: OpenRouterImagePayload) {
  const dataCandidate = payload.data?.[0];
  const imageCandidate = payload.images?.[0];
  for (const value of [
    dataCandidate?.b64_json,
    dataCandidate?.url,
    imageCandidate?.b64_json,
    imageCandidate?.image_url?.url,
    imageCandidate?.url,
  ]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function decodeGeneratedImage(payload: OpenRouterImagePayload) {
  const value = imageValue(payload);
  if (!value) return null;
  const base64 = value.startsWith('data:')
    ? value.slice(value.indexOf(',') + 1)
    : value;
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) return null;
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > MAX_GENERATED_BYTES) return null;
  return buffer;
}

function numericCost(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

async function prepareReference(reference: PosterReference) {
  try {
    const image = sharp(reference.image, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) throw new Error('missing dimensions');
    return await image
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
      .toBuffer();
  } catch {
    throw new OpenRouterPosterImageError(
      'INVALID_SOURCE',
      'Poster için seçilen görsellerden biri okunamadı.',
      400
    );
  }
}

async function normalizePosterOutput(image: Buffer, format: OpenRouterPosterFormat) {
  const width = 1080;
  const height = format === 'story' ? 1920 : 1350;
  try {
    const pipeline = sharp(image, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).rotate();
    const metadata = await pipeline.metadata();
    if (!metadata.width || !metadata.height) throw new Error('missing dimensions');
    const ratio = metadata.width / metadata.height;
    const expectedRatio = format === 'story' ? 9 / 16 : 4 / 5;
    if (Math.abs(ratio - expectedRatio) / expectedRatio > 0.08) {
      throw new Error('unexpected aspect ratio');
    }
    return await pipeline
      .resize(width, height, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
      .toBuffer();
  } catch {
    throw new OpenRouterPosterImageError(
      'INVALID_PROVIDER_RESPONSE',
      'AI posteri beklenen boyutta veya okunabilir biçimde dönmedi.'
    );
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function cleanText(value: string, maximum: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function wrapWords(value: string, maximumCharacters: number, maximumLines: number) {
  const words = cleanText(value, 220).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maximumCharacters || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
    if (lines.length === maximumLines - 1) break;
  }
  if (current && lines.length < maximumLines) lines.push(current);
  const consumed = lines.join(' ').split(' ').length;
  if (consumed < words.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.…]+$/u, '')}…`;
  }
  return lines.length ? lines : ['Özel Portföy'];
}

function dataUrlBuffer(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  const buffer = Buffer.from(match[1], 'base64');
  return buffer.length && buffer.length <= 2 * 1024 * 1024 ? buffer : null;
}

function posterLayout(input: {
  format: OpenRouterPosterFormat;
  content: AccuratePosterText;
}) {
  const width = 1080;
  const height = input.format === 'story' ? 1920 : 1350;
  const story = input.format === 'story';
  const padding = story ? 68 : 54;
  const panelHeight = story ? 650 : 470;
  const panelY = height - panelHeight - padding;
  const title = cleanText(input.content.posterName, 180) ||
    cleanText(input.content.propertyType, 80) ||
    'Özel Portföy';
  const titleLines = wrapWords(title, story ? 24 : 28, 2);
  const titleFont = title.length > 72
    ? story ? 48 : 43
    : title.length > 42
      ? story ? 56 : 49
      : story ? 66 : 58;
  const titleStartY = panelY + (story ? 118 : 105);
  const lineHeight = titleFont * 1.08;
  const price = cleanText(input.content.price, 80);
  const location = cleanText(input.content.location, 120);
  const facts = [
    cleanText(input.content.roomCount, 40)
      ? `${cleanText(input.content.roomCount, 40)} ODA`
      : '',
    cleanText(input.content.area, 40)
      ? `${cleanText(input.content.area, 40)} m²`
      : '',
    cleanText(input.content.propertyType, 70),
  ].filter(Boolean).slice(0, 3);
  const highlights = input.content.highlights
    .map((item) => cleanText(item, 70))
    .filter(Boolean);
  const detail = highlights[0] || cleanText(input.content.details, 92);
  const factY = panelY + (story ? 360 : 282);
  const factGap = 14;
  const factWidth = facts.length
    ? (width - padding * 2 - factGap * (facts.length - 1)) / facts.length
    : 0;
  const brandName = cleanText(input.content.companyName, 90);
  const priceFont = price.length > 18 ? 33 : story ? 43 : 38;
  const footerY = panelY + panelHeight - (story ? 66 : 48);

  return {
    width,
    height,
    story,
    padding,
    panelHeight,
    panelY,
    titleLines,
    titleFont,
    titleStartY,
    lineHeight,
    price,
    location,
    facts,
    detail,
    factY,
    factGap,
    factWidth,
    brandName,
    priceFont,
    footerY,
  };
}

function posterShapeSvg(input: {
  format: OpenRouterPosterFormat;
  content: AccuratePosterText;
  hasLogo: boolean;
}) {
  const layout = posterLayout(input);
  const {
    width,
    height,
    padding,
    panelHeight,
    panelY,
    facts,
    factY,
    factGap,
    factWidth,
    brandName,
  } = layout;
  const showBrandText = input.content.showLogo && brandName && !input.hasLogo;
  const brandPlate = input.content.showLogo && input.hasLogo
    ? `<rect x="${padding}" y="${padding}" width="246" height="94" rx="20" fill="rgba(255,255,255,.94)" stroke="rgba(255,255,255,.5)"/>`
    : '';
  const factsMarkup = facts
    .map((fact, index) => {
      const x = padding + index * (factWidth + factGap);
      return `<rect x="${x}" y="${factY}" width="${factWidth}" height="62" rx="15" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.18)"/>`;
    })
    .join('');

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#020b18" stop-opacity=".12"/>
          <stop offset=".55" stop-color="#020b18" stop-opacity=".04"/>
          <stop offset="1" stop-color="#020b18" stop-opacity=".78"/>
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#071b33" stop-opacity=".96"/>
          <stop offset="1" stop-color="#0b3152" stop-opacity=".91"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      ${brandPlate}
      ${showBrandText ? `<rect x="${padding}" y="${padding}" width="${Math.min(440, 76 + brandName.length * 15)}" height="74" rx="18" fill="rgba(4,20,40,.72)" stroke="rgba(255,255,255,.22)"/>` : ''}
      <rect x="${padding}" y="${panelY}" width="${width - padding * 2}" height="${panelHeight}" rx="34" fill="url(#panel)" stroke="rgba(125,211,252,.42)" stroke-width="2"/>
      <rect x="${padding + 1}" y="${panelY + 1}" width="8" height="${panelHeight - 2}" rx="4" fill="#38bdf8"/>
      ${factsMarkup}
    </svg>
  `);
}

async function posterTextImage(input: {
  text: string;
  fontSize: number;
  color: string;
  maximumWidth: number;
  weight?: 'normal' | 'bold';
  align?: 'left' | 'centre' | 'right';
}) {
  const text = escapeXml(input.text);
  const markup = input.weight === 'bold'
    ? `<span foreground="${input.color}"><b>${text}</b></span>`
    : `<span foreground="${input.color}">${text}</span>`;
  try {
    const buffer = await sharp({
      text: {
        text: markup,
        font: `Geist ${input.fontSize}`,
        fontfile: POSTER_FONT_PATH,
        width: Math.max(1, Math.floor(input.maximumWidth)),
        align: input.align ?? 'left',
        rgba: true,
      },
    }).png().toBuffer();
    const metadata = await sharp(buffer).metadata();
    return {
      buffer,
      width: metadata.width ?? 1,
      height: metadata.height ?? 1,
    };
  } catch {
    throw new OpenRouterPosterImageError(
      'INVALID_PROVIDER_RESPONSE',
      'Poster yazı tipi sunucuda yüklenemedi.'
    );
  }
}

export async function composeAccuratePosterTextLayer(input: {
  background: Buffer;
  logoDataUrl?: string | null;
  format: OpenRouterPosterFormat;
  content: AccuratePosterText;
}) {
  const width = 1080;
  const height = input.format === 'story' ? 1920 : 1350;
  const layout = posterLayout(input);
  const logoSource = input.content.showLogo
    ? dataUrlBuffer(input.logoDataUrl)
    : null;
  const logo = logoSource
    ? await sharp(logoSource, {
        failOn: 'error',
        limitInputPixels: MAX_IMAGE_PIXELS,
      })
        .rotate()
        .resize({ width: 210, height: 68, fit: 'contain' })
        .png()
        .toBuffer()
        .catch(() => null)
    : null;
  const { padding } = layout;
  const composites: sharp.OverlayOptions[] = [
    {
      input: posterShapeSvg({
        format: input.format,
        content: input.content,
        hasLogo: Boolean(logo),
      }),
      top: 0,
      left: 0,
    },
  ];

  const addText = async (options: {
    text: string;
    left: number;
    top: number;
    fontSize: number;
    color: string;
    maximumWidth: number;
    weight?: 'normal' | 'bold';
    horizontal?: 'left' | 'center' | 'right';
    boxWidth?: number;
  }) => {
    if (!options.text.trim()) return;
    const rendered = await posterTextImage({
      text: options.text,
      fontSize: options.fontSize,
      color: options.color,
      maximumWidth: options.maximumWidth,
      weight: options.weight,
    });
    const boxWidth = options.boxWidth ?? options.maximumWidth;
    const alignedLeft = options.horizontal === 'center'
      ? options.left + Math.max(0, (boxWidth - rendered.width) / 2)
      : options.horizontal === 'right'
        ? options.left + Math.max(0, boxWidth - rendered.width)
        : options.left;
    composites.push({
      input: rendered.buffer,
      top: Math.max(0, Math.round(options.top)),
      left: Math.max(0, Math.round(alignedLeft)),
    });
  };

  if (input.content.showLogo && layout.brandName && !logo) {
    await addText({
      text: layout.brandName,
      left: padding + 25,
      top: padding + 20,
      fontSize: layout.story ? 28 : 24,
      color: '#ffffff',
      maximumWidth: Math.min(380, width - padding * 2 - 50),
      weight: 'bold',
    });
  }

  await addText({
    text: layout.location || 'SEÇKİN PORTFÖY',
    left: padding + 34,
    top: layout.panelY + 30,
    fontSize: layout.location
      ? layout.story ? 24 : 20
      : layout.story ? 21 : 18,
    color: layout.location ? '#dbeafe' : '#7dd3fc',
    maximumWidth: width - padding * 2 - 68,
    weight: 'bold',
  });

  for (const [index, line] of layout.titleLines.entries()) {
    await addText({
      text: line,
      left: padding + 34,
      top: layout.titleStartY - layout.titleFont + index * layout.lineHeight,
      fontSize: layout.titleFont,
      color: '#ffffff',
      maximumWidth: width - padding * 2 - 68,
      weight: 'bold',
    });
  }

  if (layout.detail) {
    await addText({
      text: wrapWords(layout.detail, layout.story ? 58 : 70, 2).join('\n'),
      left: padding + 34,
      top:
        layout.titleStartY +
        (layout.titleLines.length - 1) * layout.lineHeight +
        22,
      fontSize: layout.story ? 22 : 18,
      color: '#d5e5f7',
      maximumWidth: width - padding * 2 - 68,
    });
  }

  for (const [index, fact] of layout.facts.entries()) {
    const factLeft = padding + index * (layout.factWidth + layout.factGap);
    await addText({
      text: fact,
      left: factLeft + 8,
      top: layout.factY + (layout.story ? 17 : 18),
      fontSize: layout.story ? 21 : 18,
      color: '#ffffff',
      maximumWidth: layout.factWidth - 16,
      boxWidth: layout.factWidth - 16,
      horizontal: 'center',
      weight: 'bold',
    });
  }

  if (layout.price) {
    await addText({
      text: 'FİYAT',
      left: padding + 34,
      top: layout.footerY - 76,
      fontSize: layout.story ? 19 : 16,
      color: '#7dd3fc',
      maximumWidth: 300,
      weight: 'bold',
    });
    await addText({
      text: layout.price,
      left: padding + 34,
      top: layout.footerY - 44,
      fontSize: layout.priceFont,
      color: '#ffffff',
      maximumWidth: 440,
      weight: 'bold',
    });
  }

  if (input.content.showContact) {
    await addText({
      text: 'Detay ve randevu için iletişime geçin',
      left: width - padding - 494,
      top: layout.footerY - 34,
      fontSize: layout.story ? 21 : 18,
      color: '#ffffff',
      maximumWidth: 460,
      boxWidth: 460,
      horizontal: 'right',
      weight: 'bold',
    });
  }

  if (logo) {
    composites.push({
      input: logo,
      top: padding + 13,
      left: padding + 18,
    });
  }
  return sharp(input.background, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .composite(composites)
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

export async function generateOpenRouterPoster(input: {
  references: PosterReference[];
  prompt: string;
  format: OpenRouterPosterFormat;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}) {
  const apiKey = input.apiKey?.trim() || process.env.OPENROUTER_POSTER_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenRouterPosterImageError(
      'NOT_CONFIGURED',
      'OpenRouter poster anahtarı sunucuda yapılandırılmamış.',
      503
    );
  }
  if (!input.references.length) {
    throw new OpenRouterPosterImageError(
      'INVALID_SOURCE',
      'Poster için en az bir portföy görseli seçilmelidir.',
      400
    );
  }

  const preparedReferences = await Promise.all(
    input.references.slice(0, MAX_REFERENCE_IMAGES).map(prepareReference)
  );
  const inputReferences = preparedReferences.map((buffer) => ({
    type: 'image_url' as const,
    image_url: {
      url: `data:image/jpeg;base64,${buffer.toString('base64')}`,
    },
  }));

  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(OPENROUTER_IMAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer':
          process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://jpp-ufeb.vercel.app',
        'X-OpenRouter-Title': 'Business CEO AI Real Estate Poster',
      },
      body: JSON.stringify({
        model: OPENROUTER_POSTER_MODEL,
        prompt: input.prompt,
        n: 1,
        resolution: '1K',
        aspect_ratio: input.format === 'story' ? '9:16' : '4:5',
        input_references: inputReferences,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError');
    throw new OpenRouterPosterImageError(
      'PROVIDER_ERROR',
      timedOut
        ? 'AI poster üretimi zaman aşımına uğradı.'
        : 'OpenRouter poster servisine ulaşılamadı.'
    );
  }

  const payload = (await response.json().catch(() => null)) as OpenRouterImagePayload | null;
  if (!response.ok || !payload) {
    const detail = providerErrorMessage(payload);
    throw new OpenRouterPosterImageError(
      'PROVIDER_ERROR',
      detail
        ? `OpenRouter poster hatası: ${detail.slice(0, 500)}`
        : `OpenRouter poster isteği başarısız oldu (${response.status}).`
    );
  }
  const generated = decodeGeneratedImage(payload);
  if (!generated) {
    throw new OpenRouterPosterImageError(
      'INVALID_PROVIDER_RESPONSE',
      'OpenRouter geçerli bir poster görseli döndürmedi.'
    );
  }
  const buffer = await normalizePosterOutput(generated, input.format);
  return {
    buffer,
    mimeType: 'image/jpeg' as const,
    extension: 'jpg' as const,
    width: 1080,
    height: input.format === 'story' ? 1920 : 1350,
    model: OPENROUTER_POSTER_MODEL,
    costUsd: numericCost(payload.usage?.cost),
    providerRequestId: typeof payload.id === 'string' ? payload.id : null,
  };
}
