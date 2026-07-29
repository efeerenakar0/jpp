import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import { evaluateStoredContactPolicy } from '@/lib/hunting-v2/contact-service';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    contactId: z.string().min(1),
    channel: z.enum(['VOICE', 'WHATSAPP', 'SMS', 'EMAIL']),
    purpose: z.literal('SALES_AUTHORITY_DISCUSSION'),
  })
  .strict();

export async function POST(
  request: Request,
  context: RouteContext<'/api/fabrika/hunting/outreach/[listingId]/approve'>
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const actor = principalActor(principal);
    const { listingId } = await context.params;
    const body = bodySchema.parse(await request.json());
    enforceHuntingRateLimit(
      `outreach-approve:${principal.account.id}:${actor.key}`,
      { limit: 30, windowMs: 60_000 }
    );

    const contact = await prisma.huntedContact.findFirst({
      where: {
        id: body.contactId,
        listingId,
        companyAccountId: principal.account.id,
      },
      select: { id: true },
    });
    if (!contact) throw new Error('İletişim kaydı bulunamadı.');

    const approval = await prisma.huntedOutreachApproval.create({
      data: {
        companyAccountId: principal.account.id,
        listingId,
        contactId: contact.id,
        purpose: body.purpose,
        channel: body.channel,
        approvedByType: actor.type,
        approvedById: actor.id,
      },
    });
    const decision = await evaluateStoredContactPolicy({
      companyAccountId: principal.account.id,
      listingId,
      contactId: contact.id,
      channel: body.channel,
      purpose: body.purpose,
      evaluatedBy: actor.key,
    });
    return NextResponse.json({
      approvalId: approval.id,
      allowed: decision.allowed,
      reasonCodes: decision.reasonCodes,
      maskedPhone: decision.maskedPhone,
    });
  } catch (error) {
    return huntingApiError(error);
  }
}
