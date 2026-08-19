import 'server-only';

import sharp from 'sharp';
import {
  findBannerbearPreset,
  findBannerbearTemplate,
  type BannerbearPosterFormat,
} from '@/lib/bannerbear-poster-catalog';

const BANNERBEAR_API = 'https://api.bannerbear.com/v5';
const BANNERBEAR_TIMEOUT_MS = 60_000;
const MAX_RENDER_BYTES = 15 * 1024 * 1024;

type BannerbearTemplateObject = {
  id?: string;
  name?: string;
  type?: string;
  color?: string;
};

type BannerbearTemplateResponse = {
  uid?: string;
  name?: string;
  width?: number;
  height?: number;
  objects?: BannerbearTemplateObject[];
  config?: {
    objects?: BannerbearTemplateObject[];
  };
};

type BannerbearImageResponse = {
  uid?: string;
  status?: 'pending' | 'completed' | 'failed';
  files?: {
    jpg?: string | null;
    png?: string | null;
    webp?: string | null;
  };
  error?: unknown;
};

export type BannerbearPosterFacts = {
  companyName: string;
  headline: string;
  summary: string;
  callToAction: string;
  location: string;
  roomCount: string;
  area: string;
  price: string;
  propertyType: string;
  highlights: string[];
  contactPhone: string;
};

export type BannerbearPosterOutputSize = 'square' | 'portrait' | 'wide';

export type BannerbearObjectModification = {
  name: string;
  text?: string;
  hidden?: boolean;
  'background-image'?: string;
  'background-color'?: string;
  'background-size'?: 'cover' | 'contain';
  'background-position'?: string;
  color?: string;
  'text-fit'?: 'off' | 'auto_fit' | 'resize_overflow';
  'text-ellipsis'?: boolean;
  'word-break'?: 'normal' | 'break-all' | 'keep-all' | 'break-word';
  'white-space'?: 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line';
  'text-shadow'?: string;
};

export class BannerbearPosterError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_CONFIGURED'
      | 'INVALID_TEMPLATE'
      | 'PROVIDER_ERROR'
      | 'PROVIDER_TIMEOUT'
      | 'INVALID_PROVIDER_RESPONSE',
    public readonly status = 502
  ) {
    super(message);
    this.name = 'BannerbearPosterError';
  }
}

function cleanText(value: string, maximum: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maximum);
}

function normalizedLayerName(value: string) {
  return value.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '_');
}

function layerNumber(value: string) {
  const match = value.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function textValueForLayer(name: string, facts: BannerbearPosterFacts) {
  const roomAndArea = [
    facts.roomCount ? `${facts.roomCount} Oda` : '',
    facts.area ? `${facts.area} m²` : '',
  ].filter(Boolean).join(' · ');
  const featureItems = [
    ...facts.highlights,
    facts.propertyType,
    roomAndArea,
  ].map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 5);
  const featureHtml = featureItems.length
    ? `Öne Çıkanlar\n${featureItems.map((item) => `• ${item}`).join('\n')}`
    : '';
  const contact = facts.contactPhone
    ? `Bilgi ve randevu: ${facts.contactPhone}`
    : facts.callToAction;

  if (name.includes('bathroom')) return '';
  if (name === 'area' || name.endsWith('_area') || name.includes('square_meter')) return facts.area ? `${facts.area} m²` : '';
  if (name.includes('bedroom')) return facts.roomCount ? `${facts.roomCount} Oda` : '';
  if (name.includes('price_text')) {
    return [facts.price, roomAndArea].filter(Boolean).join('\n');
  }
  if (name === 'price' || name.includes('price_label')) return facts.price;
  if (
    name === 'location' ||
    name === 'address' ||
    name === 'subtitle' ||
    name.includes('property_location')
  ) return facts.location;
  if (name.includes('marketeraddress')) return contact;
  if (name === 'marketedby') return facts.companyName ? 'Pazarlayan' : '';
  if (
    name === 'marketer' ||
    name === 'brand_name' ||
    name === 'brandname'
  ) return facts.companyName;
  if (
    name === 'contact' ||
    name === 'phone' ||
    name === 'telephone' ||
    name.includes('contact_phone') ||
    name.includes('contact_details') ||
    name === 'cta' ||
    name === 'website'
  ) return contact;
  if (name.includes('propertyfeatures_title')) return featureItems.length ? 'Öne Çıkan Özellikler' : '';
  if (name.includes('description_title')) return facts.summary ? 'Portföy Hakkında' : '';
  if (
    name.includes('features_list') ||
    name === 'features' ||
    name.includes('propertyfeatures_list')
  ) return featureHtml;
  if (
    name === 'description' ||
    name === 'details' ||
    name.includes('description_text') ||
    name === 'overview' ||
    name === 'event_description'
  ) return facts.summary;
  if (
    name === 'title' ||
    name === 'headline' ||
    name === 'heading' ||
    name === 'property_title' ||
    name === 'property_name' ||
    name === 'event_name' ||
    name.includes('propertyfeatures_title')
  ) return facts.headline;
  return null;
}

function safeTextForLayer(name: string, value: string) {
  if (!value) return '';
  if (name.includes('description') || name === 'details' || name === 'overview') {
    return cleanText(value, 105);
  }
  if (name.includes('features_list') || name === 'features') {
    return value.slice(0, 190);
  }
  if (name.includes('contact') || name === 'phone' || name === 'telephone') {
    return cleanText(value, 54);
  }
  if (name === 'title' || name === 'headline' || name === 'heading' || name.includes('property_title')) {
    return cleanText(value, 46);
  }
  if (name.includes('location') || name === 'address' || name === 'subtitle') {
    return cleanText(value, 42);
  }
  return cleanText(value, 80);
}

function isImageLayer(object: BannerbearTemplateObject) {
  const type = normalizedLayerName(object.type || '');
  return type.includes('image');
}

function isPropertyImageLayer(object: BannerbearTemplateObject, name: string) {
  return (
    isImageLayer(object) &&
    (name.startsWith('image_container') ||
      name.startsWith('photo_container') ||
      name === 'photo')
  );
}

function readabilityModificationForLayer(name: string) {
  const overPhoto =
    name === 'title' ||
    name === 'headline' ||
    name === 'heading' ||
    name.includes('price') ||
    name.includes('location') ||
    name === 'subtitle';
  return {
    'text-fit': 'auto_fit' as const,
    'text-ellipsis': true,
    'word-break': 'break-word' as const,
    'white-space': 'pre-line' as const,
    ...(overPhoto
      ? { 'text-shadow': '0px 2px 5px rgba(0,0,0,0.72)' }
      : {}),
  };
}

export function buildBannerbearModifications(input: {
  objects: BannerbearTemplateObject[];
  facts: BannerbearPosterFacts;
  imageUrls: string[];
  logoUrl?: string | null;
}) {
  const modifications: BannerbearObjectModification[] = [];
  const imageObjects = input.objects
    .map((object) => ({
      object,
      name: normalizedLayerName(object.name || ''),
    }))
    .filter(({ object, name }) => name && isPropertyImageLayer(object, name));
  const propertyImageObjects = imageObjects
    .filter(({ name }) => !name.includes('logo') && name !== 'avatar')
    .sort((left, right) => layerNumber(left.name) - layerNumber(right.name));
  const propertyImageNames = new Set(propertyImageObjects.map(({ name }) => name));
  let propertyImageIndex = 0;

  for (const object of input.objects) {
    const rawName = object.name?.trim();
    if (!rawName) continue;
    const name = normalizedLayerName(rawName);
    if (isImageLayer(object)) {
      if (name.includes('logo') || name === 'avatar') {
        modifications.push(
          input.logoUrl
            ? {
                name: rawName,
                'background-image': input.logoUrl,
                'background-size': 'contain',
                'background-position': 'center',
              }
            : { name: rawName, hidden: true }
        );
        continue;
      }
      if (propertyImageNames.has(name)) {
        const imageUrl = input.imageUrls[propertyImageIndex] || '';
        propertyImageIndex += 1;
        modifications.push(
          imageUrl
            ? {
                name: rawName,
                'background-image': imageUrl,
                'background-size': 'cover',
                'background-position': 'center',
              }
            : { name: rawName, hidden: true }
        );
      }
      continue;
    }

    const text = textValueForLayer(name, input.facts);
    if (text === null) continue;
    const safeText = safeTextForLayer(name, text);
    modifications.push({
      name: rawName,
      ...(safeText
        ? {
            text: safeText,
            ...readabilityModificationForLayer(name),
          }
        : { hidden: true }),
    });
  }
  return modifications;
}

async function normalizeBannerbearPoster(
  rendered: Buffer,
  outputSize: BannerbearPosterOutputSize
) {
  const source = sharp(rendered, { failOn: 'error' }).rotate();
  const metadata = await source.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < 500 ||
    metadata.height < 500
  ) {
    throw new BannerbearPosterError(
      'Bannerbear beklenen poster boyutunu döndürmedi.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  const stats = await source.clone().stats();
  const visibleChannels = stats.channels.slice(0, 3);
  if (
    visibleChannels.length < 3 ||
    visibleChannels.every((channel) => channel.stdev < 4)
  ) {
    throw new BannerbearPosterError(
      'Bannerbear boş veya okunamayan bir poster döndürdü.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }

  const target = outputSize === 'wide'
    ? { width: 1500, height: 500 }
    : outputSize === 'portrait'
      ? { width: 1080, height: 1350 }
      : { width: 1080, height: 1080 };
  const sourceRatio = metadata.width / metadata.height;
  const targetRatio = target.width / target.height;
  if (Math.abs(sourceRatio - targetRatio) / targetRatio < 0.025) {
    return source
      .resize(target.width, target.height, { fit: 'fill' })
      .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
      .toBuffer();
  }

  const background = await source
    .clone()
    .resize(target.width, target.height, { fit: 'cover' })
    .blur(26)
    .modulate({ brightness: 0.48, saturation: 0.78 })
    .jpeg({ quality: 88 })
    .toBuffer();
  const foreground = await source
    .clone()
    .resize(target.width, target.height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp(background)
    .composite([{ input: foreground, gravity: 'center' }])
    .jpeg({ quality: 94, chromaSubsampling: '4:4:4' })
    .toBuffer();
}

async function bannerbearRequest<T>(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${BANNERBEAR_API}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !payload) {
    throw new BannerbearPosterError(
      response.status === 401
        ? 'Bannerbear API anahtarı geçersiz veya yetkisiz.'
        : response.status === 402
          ? 'Bannerbear görsel kotası doldu.'
          : `Bannerbear isteği tamamlanamadı (${response.status}).`,
      'PROVIDER_ERROR',
      response.status || 502
    );
  }
  return payload;
}

async function waitForBannerbearImage(uid: string, apiKey: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < BANNERBEAR_TIMEOUT_MS) {
    const image = await bannerbearRequest<BannerbearImageResponse>(
      `/images/${encodeURIComponent(uid)}`,
      apiKey
    );
    if (image.status === 'completed') return image;
    if (image.status === 'failed') {
      throw new BannerbearPosterError(
        'Bannerbear şablonu oluşturamadı.',
        'PROVIDER_ERROR'
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  throw new BannerbearPosterError(
    'Bannerbear poster hazırlama süresi aşıldı.',
    'PROVIDER_TIMEOUT',
    504
  );
}

async function downloadBannerbearImage(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    (url.hostname !== 'images.bannerbear.com' &&
      !url.hostname.endsWith('.bannerbear.com'))
  ) {
    throw new BannerbearPosterError(
      'Bannerbear geçersiz bir görsel adresi döndürdü.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new BannerbearPosterError(
      'Bannerbear posteri indirilemedi.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_RENDER_BYTES) {
    throw new BannerbearPosterError(
      'Bannerbear poster dosyası boyut sınırını aşıyor.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_RENDER_BYTES) {
    throw new BannerbearPosterError(
      'Bannerbear geçerli bir poster dosyası döndürmedi.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  return bytes;
}

export async function generateBannerbearPoster(input: {
  apiKey?: string | null;
  templateUid: string;
  presetId?: string | null;
  format: BannerbearPosterFormat;
  outputSize?: BannerbearPosterOutputSize;
  imageUrls: string[];
  logoUrl?: string | null;
  facts: BannerbearPosterFacts;
  metadata: string;
}) {
  const apiKey = input.apiKey?.trim();
  if (!apiKey) {
    throw new BannerbearPosterError(
      'Bannerbear sunucu bağlantısı yapılandırılmamış.',
      'NOT_CONFIGURED',
      503
    );
  }
  const preset = input.presetId ? findBannerbearPreset(input.presetId) : null;
  if (input.presetId && (!preset || preset.format !== input.format)) {
    throw new BannerbearPosterError(
      'Seçilen Bannerbear görünümü bu poster boyutuyla uyumlu değil.',
      'INVALID_TEMPLATE',
      400
    );
  }
  const effectiveTemplateUid = preset?.templateUid || input.templateUid;
  const catalogTemplate = findBannerbearTemplate(effectiveTemplateUid);
  if (!catalogTemplate || catalogTemplate.format !== input.format) {
    throw new BannerbearPosterError(
      'Seçilen Bannerbear şablonu bu poster boyutuyla uyumlu değil.',
      'INVALID_TEMPLATE',
      400
    );
  }
  if (!input.imageUrls.length) {
    throw new BannerbearPosterError(
      'Bannerbear için en az bir portföy fotoğrafı gereklidir.',
      'INVALID_PROVIDER_RESPONSE',
      400
    );
  }

  const template = await bannerbearRequest<BannerbearTemplateResponse>(
    `/image_templates/${encodeURIComponent(catalogTemplate.uid)}`,
    apiKey
  );
  const templateObjects = template.objects ?? template.config?.objects;
  if (template.uid !== catalogTemplate.uid || !Array.isArray(templateObjects)) {
    throw new BannerbearPosterError(
      'Bannerbear şablon katmanları okunamadı.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  const modifications = buildBannerbearModifications({
    objects: templateObjects,
    facts: input.facts,
    imageUrls: input.imageUrls,
    logoUrl: input.logoUrl,
  });
  if (!modifications.some((item) => item['background-image'])) {
    throw new BannerbearPosterError(
      'Bannerbear şablonunda portföy fotoğraf alanı bulunamadı.',
      'INVALID_TEMPLATE',
      422
    );
  }
  const created = await bannerbearRequest<BannerbearImageResponse>(
    '/images',
    apiKey,
    {
      method: 'POST',
      body: JSON.stringify({
        template: catalogTemplate.uid,
        formats: ['jpg'],
        scale: 1,
        quality: 94,
        proxy: true,
        metadata: cleanText(input.metadata, 500),
        modifications: { objects: modifications },
      }),
    }
  );
  if (!created.uid) {
    throw new BannerbearPosterError(
      'Bannerbear üretim kimliği döndürmedi.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  const completed = await waitForBannerbearImage(created.uid, apiKey);
  const fileUrl = completed.files?.jpg || completed.files?.png || completed.files?.webp;
  if (!fileUrl) {
    throw new BannerbearPosterError(
      'Bannerbear tamamlanan poster adresini döndürmedi.',
      'INVALID_PROVIDER_RESPONSE'
    );
  }
  const rendered = await downloadBannerbearImage(fileUrl);
  const buffer = await normalizeBannerbearPoster(
    rendered,
    input.outputSize ?? (input.format === 'story' ? 'portrait' : 'square')
  );
  return {
    buffer,
    providerRequestId: created.uid,
    templateUid: catalogTemplate.uid,
    templateName: catalogTemplate.name,
    presetId: preset?.id || null,
    presetName: preset?.name || catalogTemplate.name,
  };
}
