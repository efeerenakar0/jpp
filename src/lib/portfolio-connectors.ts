import 'server-only';

import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { decryptPortfolioCredential } from './portfolio-source-credentials';

export const PORTFOLIO_SOURCE_TYPES = [
  'JASMINE_API',
  'WORDPRESS',
  'SITEMAP',
  'HTML',
] as const;

export type PortfolioSourceType = (typeof PORTFOLIO_SOURCE_TYPES)[number];

export type PortfolioSourceRecord = {
  id: string;
  type: string;
  baseUrl: string | null;
  feedPath: string | null;
  encryptedCredential: string | null;
};

export type NormalizedPortfolioItem = {
  externalId: string | null;
  fingerprint: string;
  sourceUrl: string | null;
  title: string;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  description: string | null;
  imageUrl: string | null;
  rawPayload: string;
};

const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MAX_SITEMAP_PAGES = 16;

export function isPortfolioSourceType(
  value: unknown
): value is PortfolioSourceType {
  return PORTFOLIO_SOURCE_TYPES.includes(value as PortfolioSourceType);
}

export function isPrivateNetworkAddress(address: string) {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }
  if (normalized.startsWith('::ffff:')) {
    return isPrivateNetworkAddress(normalized.slice(7));
  }
  if (isIP(normalized) !== 4) return false;
  const [a, b] = normalized.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

async function assertPublicUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Kaynak adresi yalnızca HTTP veya HTTPS olabilir.');
  }
  if (url.username || url.password) {
    throw new Error('Kaynak adresinde kullanıcı adı veya parola kullanılamaz.');
  }
  if (
    url.hostname === 'localhost' ||
    url.hostname.endsWith('.localhost') ||
    url.hostname.endsWith('.local') ||
    url.hostname.endsWith('.internal')
  ) {
    throw new Error('Yerel ağ adresleri portföy kaynağı olarak kullanılamaz.');
  }
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new Error('Kaynak adresi yalnızca standart web portlarını kullanabilir.');
  }
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some((entry) => isPrivateNetworkAddress(entry.address))
  ) {
    throw new Error('Kaynak adresi güvenli bir genel internet adresi değil.');
  }
  return url;
}

async function safeFetchText(
  value: string,
  headers: Record<string, string> = {},
  redirectCount = 0,
  credentialOrigin?: string
): Promise<{ text: string; url: string; contentType: string }> {
  const url = await assertPublicUrl(value);
  const protectedOrigin =
    credentialOrigin || (headers.Authorization ? url.origin : undefined);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json, application/xml, text/xml, text/html',
        'User-Agent': 'Jasmine-Portfolio-Connector/1.0',
        ...headers,
      },
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });
    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get('location')
    ) {
      if (redirectCount >= 2) throw new Error('Kaynak çok fazla yönlendirme yaptı.');
      const redirected = new URL(
        response.headers.get('location')!,
        url
      ).toString();
      const redirectedHeaders =
        protectedOrigin && new URL(redirected).origin !== protectedOrigin
          ? Object.fromEntries(
              Object.entries(headers).filter(
                ([name]) => name.toLowerCase() !== 'authorization'
              )
            )
          : headers;
      return safeFetchText(
        redirected,
        redirectedHeaders,
        redirectCount + 1,
        protectedOrigin
      );
    }
    if (!response.ok) {
      throw new Error(`Kaynak ${response.status} yanıtı verdi.`);
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      throw new Error('Kaynak yanıtı izin verilen boyuttan büyük.');
    }
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new Error('Kaynak yanıtı izin verilen boyuttan büyük.');
    }
    return {
      text,
      url: response.url || url.toString(),
      contentType: response.headers.get('content-type') || '',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Portföy kaynağı 15 saniye içinde yanıt vermedi.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(value: unknown) {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || null;
}

function numericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return null;
}

function nestedValue(
  object: Record<string, unknown>,
  paths: Array<string[]>
) {
  for (const path of paths) {
    let current: unknown = object;
    for (const key of path) {
      if (!current || typeof current !== 'object') {
        current = null;
        break;
      }
      current = (current as Record<string, unknown>)[key];
    }
    if (current != null) return current;
  }
  return null;
}

function imageValue(object: Record<string, unknown>) {
  const raw = nestedValue(object, [
    ['imageUrl'],
    ['image'],
    ['image', 'url'],
    ['featuredImage'],
    ['acf', 'image'],
    ['acf', 'image', 'url'],
    ['_embedded', 'wp:featuredmedia', '0', 'source_url'],
  ]);
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first === 'string'
      ? first
      : stringValue((first as Record<string, unknown>)?.url);
  }
  return stringValue(raw);
}

function normalizeObject(
  object: Record<string, unknown>,
  fallbackUrl?: string
): Omit<NormalizedPortfolioItem, 'fingerprint' | 'rawPayload'> | null {
  const title = cleanText(
    nestedValue(object, [
      ['title', 'rendered'],
      ['title'],
      ['name'],
      ['headline'],
      ['acf', 'title'],
    ])
  );
  if (!title) return null;
  const externalId = stringValue(
    nestedValue(object, [['id'], ['externalId'], ['slug'], ['sku']])
  );
  const sourceUrl =
    stringValue(
      nestedValue(object, [['link'], ['url'], ['@id'], ['sourceUrl']])
    ) || fallbackUrl || null;
  const location = cleanText(
    nestedValue(object, [
      ['location'],
      ['address', 'addressLocality'],
      ['address', 'streetAddress'],
      ['acf', 'location'],
      ['acf', 'address'],
    ])
  );
  const price = numericValue(
    nestedValue(object, [
      ['price'],
      ['offers', 'price'],
      ['acf', 'price'],
      ['meta', 'price'],
    ])
  );
  const roomCount = stringValue(
    nestedValue(object, [
      ['roomCount'],
      ['numberOfRooms'],
      ['numberOfBedrooms'],
      ['acf', 'room_count'],
      ['acf', 'rooms'],
    ])
  );
  const area = numericValue(
    nestedValue(object, [
      ['area'],
      ['floorSize', 'value'],
      ['acf', 'area'],
      ['acf', 'square_meters'],
    ])
  );
  const description = cleanText(
    nestedValue(object, [
      ['description'],
      ['content', 'rendered'],
      ['shortDescription'],
      ['acf', 'description'],
    ])
  );
  return {
    externalId,
    sourceUrl,
    title,
    location,
    price,
    roomCount,
    area,
    description,
    imageUrl: imageValue(object),
  };
}

function fingerprintFor(
  sourceId: string,
  item: Omit<NormalizedPortfolioItem, 'fingerprint' | 'rawPayload'>
) {
  return createHash('sha256')
    .update(
      [
        sourceId,
        item.externalId || '',
        item.sourceUrl || '',
        item.title,
        item.location || '',
      ].join('|')
    )
    .digest('hex');
}

function finalizeItems(
  sourceId: string,
  objects: Array<{ object: Record<string, unknown>; fallbackUrl?: string }>
) {
  const seen = new Set<string>();
  const items: NormalizedPortfolioItem[] = [];
  for (const entry of objects) {
    const normalized = normalizeObject(entry.object, entry.fallbackUrl);
    if (!normalized) continue;
    const fingerprint = fingerprintFor(sourceId, normalized);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    items.push({
      ...normalized,
      fingerprint,
      rawPayload: JSON.stringify(entry.object).slice(0, 100_000),
    });
  }
  return items;
}

function jsonObjects(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === 'object'
    );
  }
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, unknown>;
  for (const key of ['portfolios', 'projects', 'listings', 'items', 'data']) {
    if (Array.isArray(object[key])) return jsonObjects(object[key]);
  }
  return [object];
}

function extractJsonLd(html: string) {
  const objects: Record<string, unknown>[] = [];
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]);
      const candidates = jsonObjects(
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)['@graph'] || parsed
          : parsed
      );
      for (const candidate of candidates) {
        const type = String(candidate['@type'] || '').toLowerCase();
        if (
          !type ||
          [
            'realestatelisting',
            'residence',
            'apartment',
            'house',
            'product',
            'accommodation',
          ].some((allowed) => type.includes(allowed))
        ) {
          objects.push(candidate);
        }
      }
    } catch {
      // Geçersiz JSON-LD blokları diğer blokların işlenmesini durdurmaz.
    }
  }
  return objects;
}

function metaContent(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const propertyFirst = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    'i'
  );
  const contentFirst = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    'i'
  );
  return cleanText(html.match(propertyFirst)?.[1] || html.match(contentFirst)?.[1]);
}

function htmlFallbackObject(html: string, url: string) {
  const title =
    metaContent(html, 'og:title') ||
    cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  if (!title) return null;
  return {
    '@type': 'RealEstateListing',
    title,
    description:
      metaContent(html, 'og:description') ||
      metaContent(html, 'description'),
    image: metaContent(html, 'og:image'),
    url: metaContent(html, 'og:url') || url,
  } satisfies Record<string, unknown>;
}

async function htmlPageObjects(url: string, headers: Record<string, string>) {
  const page = await safeFetchText(url, headers);
  const objects = extractJsonLd(page.text);
  if (objects.length === 0) {
    const fallback = htmlFallbackObject(page.text, page.url);
    if (fallback) objects.push(fallback);
  }
  return objects.map((object) => ({ object, fallbackUrl: page.url }));
}

async function sitemapObjects(
  sitemapUrl: string,
  headers: Record<string, string>
) {
  const sitemap = await safeFetchText(sitemapUrl, headers);
  const urls = Array.from(
    sitemap.text.matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi),
    (match) => cleanText(match[1])
  )
    .filter((value): value is string => Boolean(value))
    .filter((value) => !value.toLowerCase().endsWith('.xml'))
    .slice(0, MAX_SITEMAP_PAGES);
  const baseHost = new URL(sitemap.url).hostname;
  const safeUrls = urls.filter((value) => {
    try {
      const hostname = new URL(value).hostname;
      return hostname === baseHost || hostname.endsWith(`.${baseHost}`);
    } catch {
      return false;
    }
  });
  const objects: Array<{
    object: Record<string, unknown>;
    fallbackUrl?: string;
  }> = [];
  for (let index = 0; index < safeUrls.length; index += 4) {
    const results = await Promise.allSettled(
      safeUrls
        .slice(index, index + 4)
        .map((url) => htmlPageObjects(url, headers))
    );
    for (const result of results) {
      if (result.status === 'fulfilled') objects.push(...result.value);
    }
  }
  return objects;
}

export async function fetchPortfolioSource(source: PortfolioSourceRecord) {
  if (!isPortfolioSourceType(source.type)) {
    throw new Error('Desteklenmeyen portföy kaynağı türü.');
  }
  if (!source.baseUrl) throw new Error('Kaynak web adresi eksik.');
  const credential = source.encryptedCredential
    ? decryptPortfolioCredential(source.encryptedCredential)
    : null;
  const headers: Record<string, string> = credential
    ? { Authorization: `Bearer ${credential}` }
    : {};
  const baseUrl = new URL(source.baseUrl);
  let objects: Array<{
    object: Record<string, unknown>;
    fallbackUrl?: string;
  }> = [];

  if (source.type === 'JASMINE_API') {
    const endpoint = new URL(
      source.feedPath || '/api/jasmine/portfolios',
      baseUrl
    ).toString();
    const response = await safeFetchText(endpoint, headers);
    const parsed = JSON.parse(response.text) as unknown;
    objects = jsonObjects(parsed).map((object) => ({
      object,
      fallbackUrl: response.url,
    }));
  }

  if (source.type === 'WORDPRESS') {
    const paths = source.feedPath
      ? [source.feedPath]
      : [
          '/wp-json/wp/v2/property?per_page=50&_embed=1',
          '/wp-json/wp/v2/properties?per_page=50&_embed=1',
          '/wp-json/wp/v2/posts?per_page=50&_embed=1',
        ];
    let lastError: unknown = null;
    for (const path of paths) {
      try {
        const response = await safeFetchText(
          new URL(path, baseUrl).toString(),
          headers
        );
        objects = jsonObjects(JSON.parse(response.text)).map((object) => ({
          object,
          fallbackUrl: response.url,
        }));
        if (objects.length > 0) break;
      } catch (error) {
        lastError = error;
      }
    }
    if (objects.length === 0 && lastError) throw lastError;
  }

  if (source.type === 'SITEMAP') {
    const endpoint = new URL(
      source.feedPath || '/sitemap.xml',
      baseUrl
    ).toString();
    objects = await sitemapObjects(endpoint, headers);
  }

  if (source.type === 'HTML') {
    objects = await htmlPageObjects(
      new URL(source.feedPath || '/', baseUrl).toString(),
      headers
    );
  }

  const items = finalizeItems(source.id, objects).slice(0, 100);
  if (items.length === 0) {
    throw new Error(
      'Kaynak yanıt verdi ancak okunabilir portföy kaydı bulunamadı.'
    );
  }
  return items;
}
