import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { createPartnerEmailDraft } from '@/lib/partner-outreach/service';

const schema = z.object({ contactId: z.string().trim().min(1).optional(), targetLanguage: z.string().trim().min(2).max(20).optional() });

export async function POST(request: Request, context: { params: Promise<{ partnerId: string }> }) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { partnerId } = await context.params;
    const input = schema.parse(await request.json().catch(() => ({})));
    const draft = await createPartnerEmailDraft({ companyAccountId: principal.account.id, partnerId, ...input });
    return NextResponse.json({ success: true, draft }, { status: 201 });
  } catch (error) { return partnerApiError(error); }
}
