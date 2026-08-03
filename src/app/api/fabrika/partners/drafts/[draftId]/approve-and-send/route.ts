import { NextResponse } from 'next/server';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { approveAndQueuePartnerEmail } from '@/lib/partner-outreach/service';

export async function POST(_request: Request, context: { params: Promise<{ draftId: string }> }) {
  try {
    const principal = await requireFabrikaOwner();
    const { draftId } = await context.params;
    const message = await approveAndQueuePartnerEmail({ companyAccountId: principal.account.id, draftId, principal });
    return NextResponse.json({ success: true, message: { id: message.id, status: message.status, recipient: message.recipientEmailMasked } }, { status: 202 });
  } catch (error) { return partnerApiError(error); }
}
