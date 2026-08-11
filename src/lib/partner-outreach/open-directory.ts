import 'server-only';

import { z } from 'zod';

import { partnerCountry } from './countries';
import type { ProviderOrganization } from './provider';

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
] as const;
const USER_AGENT = 'BusinessCEOAI-PartnerFinder/1.0 (+https://jpp-ufeb.vercel.app)';

const overpassElementSchema = z.object({
  id: z.number(),
  type: z.enum(['node', 'way', 'relation']),
  tags: z.record(z.string(), z.string()).optional(),
});

const overpassResponseSchema = z.object({
  elements: z.array(overpassElementSchema).max(20_000),
});

function firstTag(tags: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = tags[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function httpUrl(value?: string) {
  if (!value) return undefined;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function corporateEmail(value?: string) {
  if (!value) return undefined;
  const email = value.split(/[;,\s]+/)[0]?.trim().toLowerCase();
  return z.string().email().safeParse(email).success ? email : undefined;
}

function completenessScore(tags: Record<string, string>) {
  const signals = [
    tags.name,
    firstTag(tags, ['website', 'contact:website', 'url']),
    firstTag(tags, ['email', 'contact:email']),
    firstTag(tags, ['phone', 'contact:phone']),
    tags.brand,
    tags.operator,
    tags.wikidata,
    tags.wikipedia,
    tags['addr:city'],
    tags['addr:street'],
    tags.opening_hours,
  ];
  return signals.filter(Boolean).length;
}

function toCandidate(
  element: z.infer<typeof overpassElementSchema>,
  country: NonNullable<ReturnType<typeof partnerCountry>>,
): ProviderOrganization | null {
  const tags = element.tags || {};
  const name = firstTag(tags, ['name', 'brand', 'operator']);
  if (!name) return null;

  const websiteUrl = httpUrl(firstTag(tags, ['website', 'contact:website', 'url']));
  const email = corporateEmail(firstTag(tags, ['email', 'contact:email']));
  const specialties = [
    tags.office === 'property_management' ? 'Mülk yönetimi' : 'Gayrimenkul danışmanlığı',
    tags.rental === 'yes' ? 'Kiralama' : null,
    tags.international === 'yes' ? 'Uluslararası portföy' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    externalId: `osm:${element.type}:${element.id}`,
    legalName: name,
    displayName: name,
    websiteUrl,
    countryCode: country.code,
    countryName: country.name,
    city: firstTag(tags, ['addr:city', 'addr:town', 'addr:municipality']),
    languages: [country.language],
    specialties,
    internationalExperience:
      tags.international === 'yes' || Boolean(tags['name:en']) || Boolean(tags['website:en']),
    corporateEmail: email,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    observedAt: new Date(),
  };
}

export async function discoverOpenDirectoryPartners(countryCode: string, limit = 30) {
  const country = partnerCountry(countryCode);
  if (!country) throw new Error('Seçilen ülke desteklenmiyor.');

  const safeLimit = Math.max(1, Math.min(30, Math.floor(limit)));
  const query = `[out:json][timeout:25];
area["ISO3166-1"="${country.code}"]->.country;
(
  nwr["office"="estate_agent"](area.country);
  nwr["office"="property_management"](area.country);
  nwr["shop"="estate_agent"](area.country);
);
out tags center 250;`;

  let payload: z.infer<typeof overpassResponseSchema> | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(32_000),
        cache: 'no-store',
      });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('json')) {
        continue;
      }
      payload = overpassResponseSchema.parse(await response.json());
      break;
    } catch {
      // Public endpoints can be temporarily busy. Try the next documented mirror.
    }
  }

  if (!payload) {
    throw new Error('Açık işletme dizini şu anda yoğun. Birkaç dakika sonra tekrar deneyin.');
  }

  return payload.elements
    .filter((element) => element.tags?.name || element.tags?.brand)
    .sort((left, right) =>
      completenessScore(right.tags || {}) - completenessScore(left.tags || {}),
    )
    .map((element) => toCandidate(element, country))
    .filter((candidate): candidate is ProviderOrganization => Boolean(candidate))
    .filter((candidate, index, all) =>
      all.findIndex((other) => other.displayName.toLocaleLowerCase('tr-TR') === candidate.displayName.toLocaleLowerCase('tr-TR')) === index,
    )
    .slice(0, safeLimit);
}
