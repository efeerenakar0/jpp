import { z } from 'zod';
import {
  HUNT_PROPERTY_TYPE_PATHS,
  HUNT_PROPERTY_TYPE_VALUES,
} from './property-types';

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
    neighborhood: locationNameSchema,
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

export function buildSahibindenSearchUrl(input: SahibindenSearchFilters) {
  const filters = sahibindenSearchFiltersSchema.parse(input);
  const location = [filters.province, filters.district, filters.neighborhood]
    .map(sahibindenLocationSlug)
    .join('-');
  const categoryPath = HUNT_PROPERTY_TYPE_PATHS[filters.propertyType];
  const url = new URL(
    `https://www.sahibinden.com/${categoryPath}/${location}`
  );

  if (filters.propertyType !== 'KONUT_PROJELERI') {
    url.searchParams.set(
      SAHIBINDEN_OWNER_FILTER_KEY,
      SAHIBINDEN_OWNER_FILTER_VALUE
    );
  }
  url.searchParams.set('sorting', 'date_desc');
  return url.toString();
}
