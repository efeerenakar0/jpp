import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { suppressPartnerContact } from '@/lib/partner-outreach/service';

const schema = z.object({ contactId: z.string().trim().min(1).optional(), reason: z.string().trim().min(3).max(1000) });

export async function POST(request: Request, context: { params: Promise<{ partnerId: string }> }) {
  try {
    const principal = await requireFabrikaOwner();
    const { partnerId } = await context.params;
    const input = schema.parse(await request.json());
    await suppressPartnerContact({ companyAccountId: principal.account.id, partnerId, ...input, actorType: principal.type, actorId: principal.account.id });
    return NextResponse.json({ success: true });
  } catch (error) { return partnerApiError(error); }
}
