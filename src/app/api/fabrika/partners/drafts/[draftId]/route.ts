import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { editPartnerEmailDraft, partnerDraftEditSchema } from '@/lib/partner-outreach/service';

export async function PATCH(request: Request, context: { params: Promise<{ draftId: string }> }) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { draftId } = await context.params;
    const input = partnerDraftEditSchema.parse(await request.json());
    const draft = await editPartnerEmailDraft({ companyAccountId: principal.account.id, draftId, ...input, actorType: principal.type, actorId: principal.member?.id || principal.account.id });
    return NextResponse.json({ success: true, draft });
  } catch (error) { return partnerApiError(error); }
}
