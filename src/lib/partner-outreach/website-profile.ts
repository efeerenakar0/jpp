import 'server-only';

import { load } from 'cheerio';

import type { ProviderOrganization } from './provider';
import { assertSafePartnerSourceUrl } from './ssrf';

const MAX_HTML_BYTES = 600_000;
const MAX_ABOUT_LENGTH = 420;

function cleanText(value: unknown, maxLength = MAX_ABOUT_LENGTH) {
  if (typeof value !== 'string') return undefined;
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact ? compact.slice(0, maxLength) : undefined;
}

function absoluteHttpsUrl(value: unknown, baseUrl: string) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim(), baseUrl);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function addressText(value: unknown) {
  if (typeof value === 'string') return cleanText(value, 1_000);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const address = value as Record<string, unknown>;
  return [
    address.streetAddress,
    address.addressLocality,
    address.addressRegion,
    address.postalCode,
    address.addressCountry,
  ]
    .map((part) => cleanText(part, 180))
    .filter(Boolean)
    .join(', ') || undefined;
}

function organizationNodes(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(organizationNodes);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const nested = organizationNodes(record['@graph']);
  const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
  const isOrganization = types.some((type) =>
    ['Organization', 'RealEstateAgent', 'LocalBusiness', 'Corporation'].includes(String(type)),
  );
  return isOrganization ? [record, ...nested] : nested;
}

function jsonLdProfile(html: string) {
  const $ = load(html);
  const nodes: Array<Record<string, unknown>> = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    const value = $(element).text().trim();
    if (!value || value.length > 200_000) return;
    try {
      nodes.push(...organizationNodes(JSON.parse(value)));
    } catch {
      // Invalid third-party JSON-LD is ignored; meta tags remain available.
    }
  });
  return nodes[0];
}

export function extractWebsiteProfile(html: string, pageUrl: string) {
  const $ = load(html);
  const organization = jsonLdProfile(html);
  const jsonLogo = typeof organization?.logo === 'object' && organization.logo
    ? (organization.logo as Record<string, unknown>).url
    : organization?.logo;
  const about =
    cleanText(organization?.description) ||
    cleanText($('meta[property="og:description"]').attr('content')) ||
    cleanText($('meta[name="description"]').attr('content'));
  const logoUrl =
    absoluteHttpsUrl(jsonLogo, pageUrl) ||
    absoluteHttpsUrl($('link[rel="apple-touch-icon"]').first().attr('href'), pageUrl) ||
    absoluteHttpsUrl($('link[rel~="icon"]').first().attr('href'), pageUrl) ||
    absoluteHttpsUrl($('meta[property="og:logo"]').attr('content'), pageUrl) ||
    absoluteHttpsUrl($('meta[property="og:image"]').attr('content'), pageUrl);

  return {
    about,
    logoUrl,
    address: addressText(organization?.address),
  };
}

async function limitedText(response: Response) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_HTML_BYTES) return null;
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_HTML_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return new TextDecoder().decode(merged);
}

async function fetchWebsiteHtml(value: string) {
  let current = await assertSafePartnerSourceUrl(value);
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(6_000),
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'BusinessCEOAI-PartnerFinder/1.0 (+https://jpp-ufeb.vercel.app)',
      },
      cache: 'no-store',
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects === 2) return null;
      current = await assertSafePartnerSourceUrl(new URL(location, current).toString());
      continue;
    }
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('text/html')) return null;
    const html = await limitedText(response);
    return html ? { html, pageUrl: current } : null;
  }
  return null;
}

export async function enrichPartnerWebsiteProfile(candidate: ProviderOrganization) {
  if (!candidate.websiteUrl?.startsWith('https://')) return candidate;
  try {
    const result = await fetchWebsiteHtml(candidate.websiteUrl);
    if (!result) return candidate;
    const profile = extractWebsiteProfile(result.html, result.pageUrl);
    return {
      ...candidate,
      about: candidate.about || profile.about,
      logoUrl: candidate.logoUrl || profile.logoUrl,
      address: candidate.address || profile.address,
    };
  } catch {
    return candidate;
  }
}
