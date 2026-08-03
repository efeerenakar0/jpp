import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { listPartners, partnerStageSchema } from '@/lib/partner-outreach/service';

const querySchema = z.object({
  countryCode: z.string().trim().length(2).transform((v) => v.toUpperCase()).optional(),
  stage: partnerStageSchema.optional(),
  search: z.string().trim().max(120).optional(),
});

export async function GET(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const url = new URL(request.url);
    const parsed = querySchema.parse(Object.fromEntries(url.searchParams));
    const partners = await listPartners(principal.account.id, parsed);
    return NextResponse.json({ success: true, partners });
  } catch (error) { return partnerApiError(error); }
}
