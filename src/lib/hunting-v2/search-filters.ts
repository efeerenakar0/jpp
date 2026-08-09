import { z } from 'zod';

export const LISTING_TYPES = ['SALE', 'RENT'] as const;
export const PROPERTY_TYPES = [
  'APARTMENT',
  'RESIDENCE',
  'VILLA',
  'DETACHED_HOUSE',
] as const;
export const FURNISHED_OPTIONS = ['ANY', 'YES', 'NO'] as const;

const locationNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[\p{L}\p{M}\s.'-]+$/u, 'Geçerli bir konum seçin.');

const priceSchema = z.number().int().min(0).max(1_000_000_000_000).nullable();

export const sahibindenSearchFiltersSchema = z
  .object({
    listingType: z.enum(LISTING_TYPES),
    propertyType: z.enum(PROPERTY_TYPES),
    province: locationNameSchema,
    district: locationNameSchema,
    furnished: z.enum(FURNISHED_OPTIONS).default('ANY'),
    minPrice: priceSchema.optional().default(null),
    maxPrice: priceSchema.optional().default(null),
  })
  .strict()
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === null || maxPrice === null || minPrice <= maxPrice,
    {
      message: 'Minimum fiyat maksimum fiyattan büyük olamaz.',
      path: ['maxPrice'],
    }
  );

export type SahibindenSearchFilters = z.infer<
  typeof sahibindenSearchFiltersSchema
>;

const CATEGORY_PATHS: Record<
  SahibindenSearchFilters['listingType'],
  Record<SahibindenSearchFilters['propertyType'], string>
> = {
  SALE: {
    APARTMENT: 'satilik-daire',
    RESIDENCE: 'satilik-rezidans',
    VILLA: 'satilik-villa',
    DETACHED_HOUSE: 'satilik-mustakil-ev',
  },
  RENT: {
    APARTMENT: 'kiralik-daire',
    RESIDENCE: 'kiralik-rezidans',
    VILLA: 'kiralik-villa',
    DETACHED_HOUSE: 'kiralik-mustakil-ev',
  },
};

export function sahibindenLocationSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildSahibindenSearchUrl(input: SahibindenSearchFilters) {
  const filters = sahibindenSearchFiltersSchema.parse(input);
  const category = CATEGORY_PATHS[filters.listingType][filters.propertyType];
  const location = `${sahibindenLocationSlug(filters.province)}-${sahibindenLocationSlug(filters.district)}`;
  const url = new URL(
    `https://www.sahibinden.com/${category}/${location}/sahibinden`
  );

  if (filters.furnished !== 'ANY') {
    url.searchParams.set('a103713', filters.furnished === 'YES' ? 'true' : 'false');
  }
  if (filters.minPrice !== null) {
    url.searchParams.set('price_min', String(filters.minPrice));
  }
  if (filters.maxPrice !== null) {
    url.searchParams.set('price_max', String(filters.maxPrice));
  }
  url.searchParams.set('sorting', 'date_desc');
  return url.toString();
}
