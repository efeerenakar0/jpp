import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  HUNT_PROPERTY_TYPE_VALUES,
  type HuntPropertyType,
} from './property-types';

export const CLEARPATH_ACTOR_ID = 'clearpath~sahibinden-scraper-pro';
export const CLEARPATH_STRATEGY_VERSION = 'CLEARPATH_OWNER_ROTATION_V2';
export const CLEARPATH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const CLEARPATH_ACTIVE_LOCK_MS = 20 * 60 * 1000;

export const CLEARPATH_SEARCH_ROTATIONS = [
  { id: 'NEWEST', sorting: 'date_desc' },
  { id: 'OLDEST', sorting: 'date_asc' },
  { id: 'PRICE_ASC', sorting: 'price_asc' },
  { id: 'RECOMMENDED', sorting: null },
] as const;

export type ClearpathSearchRotation =
  (typeof CLEARPATH_SEARCH_ROTATIONS)[number];

const HOUSING_TYPE: HuntPropertyType = 'KONUT';

export type HuntingQuotaPolicy = Readonly<{
  propertyType: HuntPropertyType;
  perRunLimit: number;
  monthlyLimit: number;
}>;

export function huntingQuotaPolicy(
  propertyType: HuntPropertyType
): HuntingQuotaPolicy {
  return propertyType === HOUSING_TYPE
    ? { propertyType, perRunLimit: 50, monthlyLimit: 500 }
    : { propertyType, perRunLimit: 5, monthlyLimit: 15 };
}

export function allHuntingQuotaPolicies() {
  return HUNT_PROPERTY_TYPE_VALUES.map(huntingQuotaPolicy);
}

/** Turkey is permanently UTC+03:00. Values are stored in UTC in PostgreSQL. */
export function istanbulMonthWindow(now = new Date()) {
  const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const offset = 3 * 60 * 60 * 1000;
  return {
    periodStart: new Date(Date.UTC(year, month, 1) - offset),
    periodEnd: new Date(Date.UTC(year, month + 1, 1) - offset),
  };
}

export const clearpathActorInputSchema = z
  .object({
    startUrls: z.tuple([z.string().url()]),
    enrichment: z.literal(true),
    maxResults: z.number().int().positive().max(50),
  })
  .strict();

export type ClearpathActorInput = Readonly<
  z.infer<typeof clearpathActorInputSchema>
>;

export function buildClearpathActorInput(input: {
  searchUrl: string;
  propertyType: HuntPropertyType;
}): ClearpathActorInput {
  return {
    startUrls: [input.searchUrl],
    enrichment: true,
    maxResults: huntingQuotaPolicy(input.propertyType).perRunLimit,
  };
}

export function clearpathSearchCacheKey(input: {
  searchUrl: string;
  propertyType: HuntPropertyType;
  actorInput: ClearpathActorInput;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        strategy: CLEARPATH_STRATEGY_VERSION,
        propertyType: input.propertyType,
        searchUrl: input.searchUrl,
        enrichment: input.actorInput.enrichment,
        maxResults: input.actorInput.maxResults,
      })
    )
    .digest('hex');
}

const stringOrNumber = z.union([z.string(), z.number()]);
const optionalText = z.string().trim().optional().nullable();

export const clearpathDatasetItemSchema = z
  .object({
    id: stringOrNumber,
    url: z.string().url(),
    sourceUrl: optionalText,
    title: z.string().trim().min(1).max(1000),
    status: optionalText,
    price: stringOrNumber.optional().nullable(),
    currency: optionalText,
    formattedPrice: optionalText,
    city: optionalText,
    district: optionalText,
    neighborhood: optionalText,
    quarter: optionalText,
    address: optionalText,
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
    images: z
      .array(
        z.union([
          z.string().url(),
          z.object({ url: z.string().url() }).passthrough(),
        ])
      )
      .optional()
      .default([]),
    sellerName: optionalText,
    sellerType: optionalText,
    storeName: optionalText,
    storeId: stringOrNumber.optional().nullable(),
    phoneNumbers: z.array(z.string()).optional().default([]),
    phoneMobile: optionalText,
    phoneHome: optionalText,
    phoneWork: optionalText,
    attributes: z.record(z.string(), z.unknown()).optional().default({}),
    searchAttributes: z
      .record(z.string(), z.unknown())
      .optional()
      .default({}),
    listedAt: optionalText,
    updatedAt: optionalText,
    description: optionalText,
    descriptionNormalized: optionalText,
    categoryPath: z.array(z.string()).optional().default([]),
    categoryTitle: optionalText,
  })
  .strip();

export type ClearpathDatasetItem = z.infer<typeof clearpathDatasetItemSchema>;

function normalizedEvidence(value: unknown) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

const BUSINESS_EVIDENCE = [
  'emlak ofisinden',
  'emlakci',
  'magazadan',
  'projeden',
  'yetkili bayiden',
  'galeriden',
  'kurumsal',
  'agency',
  'agent',
  'dealer',
  'store',
];

const OWNER_EVIDENCE = [
  'sahibinden',
  'mulkiyet sahibinden',
  'owner',
  'individual',
  'bireysel',
  'standard',
];

export type OwnerFilterDecision =
  | { accepted: true; evidence: string }
  | { accepted: false; reason: string };

/**
 * Owner-only is fail closed. The `/sahibinden` source tab is necessary but not
 * sufficient: every dataset row also needs positive owner evidence and must
 * have no store identity or business marker.
 */
export function evaluateClearpathOwnerOnly(
  item: ClearpathDatasetItem,
  requestedSearchUrl: string
): OwnerFilterDecision {
  let pathname = '';
  try {
    pathname = new URL(requestedSearchUrl).pathname.toLocaleLowerCase('tr-TR');
  } catch {
    return { accepted: false, reason: 'INVALID_SEARCH_URL' };
  }
  if (!/(?:^|\/)sahibinden(?:\/|$)/.test(pathname)) {
    return { accepted: false, reason: 'OWNER_TAB_NOT_REQUESTED' };
  }
  if (item.storeId !== null && item.storeId !== undefined && item.storeId !== '') {
    return { accepted: false, reason: 'STORE_ID_PRESENT' };
  }
  if (item.storeName?.trim()) {
    return { accepted: false, reason: 'STORE_NAME_PRESENT' };
  }

  const evidence = [
    item.attributes.Kimden,
    item.attributes['Kimden?'],
    item.searchAttributes.Kimden,
    item.searchAttributes['Kimden?'],
    item.sellerType,
  ]
    .map(normalizedEvidence)
    .filter(Boolean);
  if (evidence.some((value) => BUSINESS_EVIDENCE.some((word) => value.includes(word)))) {
    return { accepted: false, reason: 'BUSINESS_SELLER_EVIDENCE' };
  }
  const ownerEvidence = evidence.find((value) =>
    OWNER_EVIDENCE.some((word) => value.includes(word))
  );
  if (!ownerEvidence) {
    return { accepted: false, reason: 'OWNER_EVIDENCE_MISSING' };
  }
  return { accepted: true, evidence: ownerEvidence };
}

export function deterministicListingRank(cacheKey: string, sourceListingId: string) {
  return createHash('sha256')
    .update(`${CLEARPATH_STRATEGY_VERSION}\0${cacheKey}\0${sourceListingId}`)
    .digest('hex');
}

export function clearpathItemImages(item: ClearpathDatasetItem) {
  return item.images.map((image) => (typeof image === 'string' ? image : image.url));
}

export function clearpathItemPhones(item: ClearpathDatasetItem) {
  return [...new Set([
    ...item.phoneNumbers,
    item.phoneMobile,
    item.phoneHome,
    item.phoneWork,
  ].filter((value): value is string => Boolean(value?.trim())))];
}

/**
 * Only fields that are safe to reuse between company accounts belong here.
 * Keep this as an explicit allowlist so new Actor fields (including nested
 * contact details) cannot silently enter the platform-wide search cache.
 */
export function buildPublicClearpathCachePayload(item: ClearpathDatasetItem) {
  return {
    id: String(item.id),
    url: item.url,
    title: item.title,
    status: item.status,
    price: item.price,
    currency: item.currency,
    formattedPrice: item.formattedPrice,
    city: item.city,
    district: item.district,
    neighborhood: item.neighborhood,
    quarter: item.quarter,
    address: item.address,
    latitude: item.latitude,
    longitude: item.longitude,
    images: clearpathItemImages(item),
    sellerType: item.sellerType,
    listedAt: item.listedAt,
    updatedAt: item.updatedAt,
    categoryPath: item.categoryPath,
    categoryTitle: item.categoryTitle,
  };
}
