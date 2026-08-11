import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError } from '@/lib/hunting-v2/api';
import {
  fetchDistrictOptions,
  fetchNeighborhoodOptions,
  fetchProvinceOptions,
} from '@/lib/hunting-v2/location-service';

export const runtime = 'nodejs';

const querySchema = z.object({
  provinceId: z.coerce.number().int().min(1).max(81).optional(),
  districtId: z.coerce.number().int().positive().optional(),
});

export async function GET(request: Request) {
  try {
    await requireFabrikaPrincipal();
    const url = new URL(request.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams));
    const items = query.districtId
      ? await fetchNeighborhoodOptions(query.districtId)
      : query.provinceId
        ? await fetchDistrictOptions(query.provinceId)
        : await fetchProvinceOptions();
    return NextResponse.json(
      { items },
      {
        headers: {
          'Cache-Control': 'private, max-age=3600',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (error) {
    return huntingApiError(error);
  }
}
