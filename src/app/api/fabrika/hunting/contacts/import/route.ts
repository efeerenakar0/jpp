import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import {
  CONTACT_PROVIDER_NAMES,
  contactProviderImportSchema,
} from '@/lib/hunting-v2/contact-providers';
import { importHuntedContact } from '@/lib/hunting-v2/contact-service';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    provider: z.enum(CONTACT_PROVIDER_NAMES),
    payload: contactProviderImportSchema,
    consent: z
      .object({
        channel: z.enum(['VOICE', 'WHATSAPP', 'SMS', 'EMAIL']),
        purpose: z.literal('SALES_AUTHORITY_DISCUSSION'),
        status: z.enum(['GRANTED', 'REJECTED', 'REVOKED', 'EXPIRED']),
        consentTextVersion: z.string().min(1).max(120),
        evidenceReference: z.string().min(3).max(1000),
        grantedAt: z.string().datetime().optional(),
        revokedAt: z.string().datetime().optional(),
        iysStatus: z.string().max(80).optional(),
        iysCheckedAt: z.string().datetime().optional(),
        iysTransactionReference: z.string().max(200).optional(),
        recipientType: z.string().max(80).optional(),
        recipientTypeEvidence: z.string().max(500).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const actor = principalActor(principal);
    enforceHuntingRateLimit(
      `contact-import:${principal.account.id}:${actor.key}`,
      { limit: 30, windowMs: 60_000 }
    );
    const body = bodySchema.parse(await request.json());
    const contact = await importHuntedContact({
      companyAccountId: principal.account.id,
      providerName: body.provider,
      payload: body.payload,
    });

    if (body.consent) {
      await prisma.contactConsent.upsert({
        where: {
          contactId_companyAccountId_channel_purpose: {
            contactId: contact.id,
            companyAccountId: principal.account.id,
            channel: body.consent.channel,
            purpose: body.consent.purpose,
          },
        },
        update: {
          status: body.consent.status,
          consentTextVersion: body.consent.consentTextVersion,
          evidenceReference: body.consent.evidenceReference,
          grantedAt: body.consent.grantedAt
            ? new Date(body.consent.grantedAt)
            : null,
          revokedAt: body.consent.revokedAt
            ? new Date(body.consent.revokedAt)
            : null,
          iysStatus: body.consent.iysStatus,
          iysCheckedAt: body.consent.iysCheckedAt
            ? new Date(body.consent.iysCheckedAt)
            : null,
          iysTransactionReference:
            body.consent.iysTransactionReference,
          recipientType: body.consent.recipientType,
          recipientTypeEvidence: body.consent.recipientTypeEvidence,
        },
        create: {
          contactId: contact.id,
          companyAccountId: principal.account.id,
          channel: body.consent.channel,
          purpose: body.consent.purpose,
          status: body.consent.status,
          consentTextVersion: body.consent.consentTextVersion,
          evidenceReference: body.consent.evidenceReference,
          grantedAt: body.consent.grantedAt
            ? new Date(body.consent.grantedAt)
            : null,
          revokedAt: body.consent.revokedAt
            ? new Date(body.consent.revokedAt)
            : null,
          iysStatus: body.consent.iysStatus,
          iysCheckedAt: body.consent.iysCheckedAt
            ? new Date(body.consent.iysCheckedAt)
            : null,
          iysTransactionReference:
            body.consent.iysTransactionReference,
          recipientType: body.consent.recipientType,
          recipientTypeEvidence: body.consent.recipientTypeEvidence,
        },
      });
    }

    return NextResponse.json(
      {
        id: contact.id,
        listingId: contact.listingId,
        maskedPhone: contact.maskedPhone,
        verificationStatus: contact.verificationStatus,
        contactReady: false,
        nextStep: 'CONTACT_POLICY_EVALUATION_AND_HUMAN_APPROVAL',
      },
      { status: 201 }
    );
  } catch (error) {
    return huntingApiError(error);
  }
}
