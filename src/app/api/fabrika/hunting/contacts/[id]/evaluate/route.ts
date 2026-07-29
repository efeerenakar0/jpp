import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import { evaluateStoredContactPolicy } from '@/lib/hunting-v2/contact-service';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    listingId: z.string().min(1),
    channel: z.enum(['VOICE', 'WHATSAPP', 'SMS', 'EMAIL']),
    purpose: z.literal('SALES_AUTHORITY_DISCUSSION'),
  })
  .strict();

export async function POST(
  request: Request,
  context: RouteContext<'/api/fabrika/hunting/contacts/[id]/evaluate'>
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const actor = principalActor(principal);
    const { id } = await context.params;
    enforceHuntingRateLimit(
      `contact-evaluate:${principal.account.id}:${actor.key}`,
      { limit: 60, windowMs: 60_000 }
    );
    const body = bodySchema.parse(await request.json());
    const decision = await evaluateStoredContactPolicy({
      companyAccountId: principal.account.id,
      listingId: body.listingId,
      contactId: id,
      channel: body.channel,
      purpose: body.purpose,
      evaluatedBy: actor.key,
    });
    return NextResponse.json({
      allowed: decision.allowed,
      reasonCodes: decision.reasonCodes,
      maskedPhone: decision.maskedPhone,
    });
  } catch (error) {
    return huntingApiError(error);
  }
}
