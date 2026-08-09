import 'server-only';

import type { ContactConsentChannel, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  decryptContactPhone,
  encryptContactPhone,
  maskContactPhone,
  phoneHmac,
} from './contact-crypto';
import {
  type ContactProviderName,
  getContactProvider,
} from './contact-providers';
import { evaluateContactPolicy } from './contact-policy';

export class ContactPolicyDeniedError extends Error {
  constructor(public readonly reasonCodes: string[]) {
    super(`İletişim politikası reddetti: ${reasonCodes.join(', ')}`);
    this.name = 'ContactPolicyDeniedError';
  }
}

export async function importHuntedContact(input: {
  companyAccountId: string;
  providerName: ContactProviderName;
  payload: unknown;
}) {
  const provider = getContactProvider(input.providerName);
  const resolved = await provider.resolve(input.payload);
  const listing = await prisma.huntedListing.findFirst({
    where: {
      id: resolved.listingId,
      companyAccountId: input.companyAccountId,
    },
    select: { id: true },
  });
  if (!listing) throw new Error('İlan bu şirkette bulunamadı.');

  const hmac = phoneHmac(resolved.phone);
  const ciphertext = encryptContactPhone(resolved.phone);
  const maskedPhone = maskContactPhone(resolved.phone);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.huntedContact.findFirst({
      where: {
        companyAccountId: input.companyAccountId,
        listingId: listing.id,
        OR: [
          { phoneHmac: hmac },
          { phoneCiphertext: null, sourceType: 'LEGACY_UNVERIFIED' },
        ],
      },
    });
    if (existing) {
      return tx.huntedContact.update({
        where: { id: existing.id },
        data: {
          phoneHmac: hmac,
          phoneCiphertext: ciphertext,
          maskedPhone,
          subjectRole: resolved.subjectRole,
          sourceType: resolved.sourceType,
          sourceReference: resolved.sourceReference,
          purpose: resolved.purpose,
          sourcePurposeAllowed: resolved.sourcePurposeAllowed,
          verificationStatus: resolved.verificationStatus,
          verifiedAt: resolved.verifiedAt,
          verificationMethod: resolved.verificationMethod,
          legalBasisStatus: resolved.legalBasisStatus,
          retentionUntil: new Date(resolved.retentionUntil),
          quarantinedAt: null,
          quarantineReason: null,
        },
      });
    }
    return tx.huntedContact.create({
      data: {
        companyAccountId: input.companyAccountId,
        listingId: listing.id,
        phoneCiphertext: ciphertext,
        phoneHmac: hmac,
        maskedPhone,
        subjectRole: resolved.subjectRole,
        sourceType: resolved.sourceType,
        sourceReference: resolved.sourceReference,
        purpose: resolved.purpose,
        sourcePurposeAllowed: resolved.sourcePurposeAllowed,
        verificationStatus: resolved.verificationStatus,
        verifiedAt: resolved.verifiedAt,
        verificationMethod: resolved.verificationMethod,
        legalBasisStatus: resolved.legalBasisStatus,
        retentionUntil: new Date(resolved.retentionUntil),
      },
    });
  });
}

export async function evaluateStoredContactPolicy(input: {
  companyAccountId: string;
  listingId: string;
  contactId: string;
  channel: ContactConsentChannel;
  purpose: string;
  evaluatedBy: string;
  iysRequired?: boolean;
  tx?: Prisma.TransactionClient;
}) {
  const db = input.tx || prisma;
  const now = new Date();
  const contact = await db.huntedContact.findFirst({
    where: {
      id: input.contactId,
      listingId: input.listingId,
      companyAccountId: input.companyAccountId,
    },
    include: {
      consents: {
        where: {
          companyAccountId: input.companyAccountId,
          channel: input.channel,
          purpose: input.purpose,
        },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      approvals: {
        where: {
          companyAccountId: input.companyAccountId,
          listingId: input.listingId,
          channel: input.channel,
          purpose: input.purpose,
          status: 'APPROVED',
          revokedAt: null,
        },
        orderBy: { approvedAt: 'desc' },
        take: 1,
      },
    },
  });
  if (!contact) throw new Error('İletişim kaydı bu şirkette bulunamadı.');

  const consent = contact.consents[0];
  const result = evaluateContactPolicy({
    contactId: contact.id,
    listingId: input.listingId,
    companyAccountId: input.companyAccountId,
    channel: input.channel,
    purpose: input.purpose,
    verificationStatus: contact.verificationStatus,
    subjectRole: contact.subjectRole,
    sourceType: contact.sourceType,
    sourcePurposeAllowed: contact.sourcePurposeAllowed,
    legalBasisStatus: contact.legalBasisStatus,
    consentStatus: consent?.status || 'UNKNOWN',
    iysRequired: input.iysRequired ?? input.channel !== 'VOICE',
    iysStatus: consent?.iysStatus || null,
    doNotContactAt: contact.doNotContactAt,
    retentionUntil: contact.retentionUntil,
    evaluatedAt: now,
    companyScopeMatches:
      contact.companyAccountId === input.companyAccountId,
    humanApprovedAt: contact.approvals[0]?.approvedAt || null,
  });

  await db.contactPolicyDecision.create({
    data: {
      companyAccountId: input.companyAccountId,
      listingId: input.listingId,
      contactId: contact.id,
      channel: input.channel,
      purpose: input.purpose,
      allowed: result.allowed,
      reasonCodes: result.reasonCodes,
      evaluatedAt: now,
      evaluatedBy: input.evaluatedBy,
    },
  });

  return {
    ...result,
    maskedPhone: contact.maskedPhone,
    phone:
      result.allowed && contact.phoneCiphertext
        ? decryptContactPhone(contact.phoneCiphertext)
        : null,
  };
}

export async function requireContactPolicyApproval(
  input: Parameters<typeof evaluateStoredContactPolicy>[0]
) {
  const decision = await evaluateStoredContactPolicy(input);
  if (!decision.allowed || !decision.phone) {
    throw new ContactPolicyDeniedError(decision.reasonCodes);
  }
  return decision;
}
