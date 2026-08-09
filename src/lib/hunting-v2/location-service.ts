import { z } from 'zod';

const LOCATION_API_BASE_URL = 'https://api.turkiyeapi.dev/v2';

const locationResponseSchema = z
  .object({
    data: z.array(
      z
        .object({
          id: z.number().int().positive(),
          name: z.string().trim().min(1).max(100),
        })
        .passthrough()
    ),
  })
  .passthrough();

type LocationFetcher = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

async function fetchLocationOptions(url: URL, fetcher: LocationFetcher) {
  const response = await fetcher(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'force-cache',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error('Konum seçenekleri alınamadı.');

  const parsed = locationResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('Konum seçenekleri alınamadı.');
  return parsed.data.data
    .map(({ id, name }) => ({ id, name }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, 'tr-TR', { sensitivity: 'base' })
    );
}

export function fetchProvinceOptions(fetcher: LocationFetcher = fetch) {
  const url = new URL(`${LOCATION_API_BASE_URL}/provinces`);
  url.searchParams.set('fields', 'id,name');
  url.searchParams.set('limit', '100');
  return fetchLocationOptions(url, fetcher);
}

export async function fetchDistrictOptions(
  provinceId: number,
  fetcher: LocationFetcher = fetch
) {
  if (!Number.isInteger(provinceId) || provinceId < 1 || provinceId > 81) {
    throw new Error('Geçerli bir il seçin.');
  }
  const url = new URL(
    `${LOCATION_API_BASE_URL}/provinces/${provinceId}/districts`
  );
  url.searchParams.set('fields', 'id,name');
  url.searchParams.set('limit', '1000');
  return fetchLocationOptions(url, fetcher);
}
