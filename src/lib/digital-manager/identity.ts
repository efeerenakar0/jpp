import { prisma } from '@/lib/prisma';

import {
  chooseIdentityRole,
  normalizeE164,
  type IdentityCandidate,
  type PartyRole,
} from './domain';

export type PhoneIdentityContext = {
  activeConversationRole?: PartyRole | null;
  preferredRole?: PartyRole | null;
  preferredEntityId?: string | null;
  messagePurpose?:
    | 'AUTHORIZATION'
    | 'CUSTOMER_SERVICE'
    | 'INTERNAL_TASK'
    | 'GENERAL'
    | null;
};

export async function resolveCompanyPhoneIdentity(
  companyAccountId: string,
  rawPhone: string,
  context: PhoneIdentityContext = {}
) {
  const phone = normalizeE164(rawPhone);
  if (!phone) {
    return {
      phone: null,
      connectedCompanyNumber: false,
      candidates: [] as IdentityCandidate[],
      resolution: chooseIdentityRole([], context),
    };
  }

  const [account, whatsAppConfig, members, contacts, listings] =
    await Promise.all([
      prisma.companyAccount.findUnique({
        where: { id: companyAccountId },
        select: {
          id: true,
          ownerPhoneNormalized: true,
          ownerPhoneVerificationStatus: true,
        },
      }),
      prisma.whatsAppConfig.findUnique({
        where: { companyAccountId },
        select: { connectedPhone: true },
      }),
      prisma.companyMember.findMany({
        where: {
          companyAccountId,
          active: true,
          phoneNormalized: phone,
          phoneVerificationStatus: 'VERIFIED',
        },
        select: { id: true },
      }),
      prisma.crmContact.findMany({
        where: { companyAccountId, phoneNormalized: phone },
        select: { id: true },
        take: 10,
      }),
      prisma.huntedListing.findMany({
        where: {
          companyAccountId,
          ownerPhoneNormalized: phone,
        },
        select: { id: true },
        take: 10,
      }),
    ]);

  const connectedCompanyNumber =
    normalizeE164(whatsAppConfig?.connectedPhone) === phone;
  const candidates: IdentityCandidate[] = [];

  if (
    account?.ownerPhoneVerificationStatus === 'VERIFIED' &&
    account.ownerPhoneNormalized === phone
  ) {
    candidates.push({ role: 'OWNER', entityId: account.id, phone });
  }
  members.forEach((member) => {
    candidates.push({ role: 'EMPLOYEE', entityId: member.id, phone });
  });
  contacts.forEach((contact) => {
    candidates.push({ role: 'CRM_CONTACT', entityId: contact.id, phone });
  });
  listings.forEach((listing) => {
    candidates.push({
      role: 'PROPERTY_OWNER',
      entityId: listing.id,
      phone,
    });
  });

  const uniqueCandidates = candidates.filter(
    (candidate, index, values) =>
      values.findIndex(
        (item) =>
          item.role === candidate.role && item.entityId === candidate.entityId
      ) === index
  );

  if (uniqueCandidates.length > 0) {
    const now = new Date();
    await Promise.all(
      uniqueCandidates.map((candidate) => {
        const verified =
          candidate.role === 'OWNER' || candidate.role === 'EMPLOYEE';
        const entityType =
          candidate.role === 'OWNER'
            ? 'CompanyAccount'
            : candidate.role === 'EMPLOYEE'
              ? 'CompanyMember'
              : candidate.role === 'CRM_CONTACT'
                ? 'CrmContact'
                : 'HuntedListing';
        const source =
          candidate.role === 'OWNER' || candidate.role === 'EMPLOYEE'
            ? 'VERIFIED_COMPANY_DIRECTORY'
            : candidate.role === 'CRM_CONTACT'
              ? 'CRM_CONTACT_PHONE'
              : 'HUNTED_LISTING_OWNER_PHONE';

        return prisma.identityLink.upsert({
          where: {
            companyAccountId_phoneNormalized_role_entityId: {
              companyAccountId,
              phoneNormalized: phone,
              role: candidate.role,
              entityId: candidate.entityId,
            },
          },
          create: {
            companyAccountId,
            phoneNormalized: phone,
            role: candidate.role,
            entityType,
            entityId: candidate.entityId,
            source,
            verified,
            confidence: verified ? 1 : 0.85,
            evidence: {
              matchedField: 'phoneNormalized',
              verificationRequired: verified,
            },
            firstSeenAt: now,
            lastSeenAt: now,
          },
          update: {
            entityType,
            source,
            verified,
            confidence: verified ? 1 : 0.85,
            active: true,
            evidence: {
              matchedField: 'phoneNormalized',
              verificationRequired: verified,
            },
            lastSeenAt: now,
          },
        });
      })
    );
  }

  const preferredCandidate =
    context.preferredRole && context.preferredEntityId
      ? uniqueCandidates.find(
          (candidate) =>
            candidate.role === context.preferredRole &&
            candidate.entityId === context.preferredEntityId
        )
      : null;

  return {
    phone,
    connectedCompanyNumber,
    candidates: uniqueCandidates,
    resolution: connectedCompanyNumber
      ? {
          status: 'UNKNOWN' as const,
          role: null,
          entityId: null,
          clarificationQuestion:
            'Şirketin bağlı WhatsApp numarası komut gönderen kişi kimliği olarak kullanılamaz.',
        }
      : preferredCandidate
        ? {
            status: 'RESOLVED' as const,
            role: preferredCandidate.role,
            entityId: preferredCandidate.entityId,
            clarificationQuestion: null,
          }
      : chooseIdentityRole(uniqueCandidates, context),
  };
}
