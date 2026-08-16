import { z } from 'zod';
import {
  HUNT_PROPERTY_TYPE_PATHS,
  HUNT_PROPERTY_TYPE_VALUES,
} from './property-types';
import type { ClearpathSearchRotation } from './clearpath-contract';

const locationNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[\p{L}\p{M}\s.'-]+$/u, 'Geçerli bir konum seçin.');

export const sahibindenSearchFiltersSchema = z
  .object({
    province: locationNameSchema,
    district: locationNameSchema,
    propertyType: z.enum(HUNT_PROPERTY_TYPE_VALUES),
  })
  .strict();

export type SahibindenSearchFilters = z.infer<
  typeof sahibindenSearchFiltersSchema
>;

const SAHIBINDEN_OWNER_FILTER_KEY = 'a27';
const SAHIBINDEN_OWNER_FILTER_VALUE = '38460';

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

export function buildSahibindenSearchUrl(
  input: SahibindenSearchFilters,
  rotation: ClearpathSearchRotation = { id: 'NEWEST', sorting: 'date_desc' }
) {
  const filters = sahibindenSearchFiltersSchema.parse(input);
  if (filters.propertyType === 'KONUT_PROJELERI') {
    throw new Error(
      'Konut Projeleri kaynaginda bireysel sahibinden ilani dogrulanamadigi icin canli Avci taramasi kapali.'
    );
  }
  // Sahibinden inserts site-specific area segments (for example "beldeler")
  // before some neighbourhoods. A generic neighbourhood name cannot produce
  // that canonical path reliably. Search at the verified province + district
  // level and keep the returned listing's real neighbourhood for filtering.
  const location = [filters.province, filters.district]
    .map(sahibindenLocationSlug)
    .join('-');
  const categoryPath = HUNT_PROPERTY_TYPE_PATHS[filters.propertyType];
  const url = new URL(
    `https://www.sahibinden.com/${categoryPath}/${location}/sahibinden`
  );

  // The explicit owner tab is the primary ClearPath input boundary. Keep the
  // native owner attribute too as defense in depth; dataset rows are filtered
  // again after ingestion and business/store rows are always rejected.
  url.searchParams.set(
    SAHIBINDEN_OWNER_FILTER_KEY,
    SAHIBINDEN_OWNER_FILTER_VALUE
  );
  if (rotation.sorting) url.searchParams.set('sorting', rotation.sorting);
  return url.toString();
}
