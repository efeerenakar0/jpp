import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  requireFabrikaOwner,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { getPartner, partnerStageSchema, updatePartnerStage } from '@/lib/partner-outreach/service';

const patchSchema = z.object({ stage: partnerStageSchema, reason: z.string().trim().max(1000).optional() });

export async function GET(_request: Request, context: { params: Promise<{ partnerId: string }> }) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { partnerId } = await context.params;
    return NextResponse.json({
      success: true,
      partner: await getPartner(principal.account.id, partnerId, {
        includeCommercialDetails: principal.type === 'OWNER',
      }),
    });
  } catch (error) { return partnerApiError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ partnerId: string }> }) {
  try {
    const principal = await requireFabrikaOwner();
    const { partnerId } = await context.params;
    const parsed = patchSchema.parse(await request.json());
    const partner = await updatePartnerStage({
      companyAccountId: principal.account.id,
      partnerId,
      ...parsed,
      actorType: principal.type,
      actorId: principal.account.id,
    });
    return NextResponse.json({ success: true, partner });
  } catch (error) { return partnerApiError(error); }
}
