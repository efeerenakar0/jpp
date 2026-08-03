export type PublishablePropertyStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'RESERVED'
  | 'SOLD'
  | 'RENTED'
  | 'ARCHIVED';

export type PropertyPublicationRecord = {
  companyAccountId: string;
  status: PublishablePropertyStatus;
  publicationApprovedAt: Date | null;
  authorityDocumentVerifiedAt: Date | null;
  authorityExpiresAt: Date | null;
  eidsRequired: boolean;
  eidsVerifiedAt: Date | null;
  eidsVerificationReference: string | null;
  eidsExemptionReason: string | null;
  publicationBlockedAt: Date | null;
};

export type PublicationIneligibilityReason =
  | 'TENANT_MISMATCH'
  | 'STATUS_NOT_PUBLIC'
  | 'HUMAN_APPROVAL_MISSING'
  | 'AUTHORITY_NOT_VERIFIED'
  | 'AUTHORITY_EXPIRED'
  | 'EIDS_NOT_VERIFIED'
  | 'EIDS_EXEMPTION_MISSING'
  | 'PUBLICATION_BLOCKED';

export function publicationEligibility(
  property: PropertyPublicationRecord,
  context: { companyAccountId: string; now: Date }
) {
  const reasons: PublicationIneligibilityReason[] = [];
  if (property.companyAccountId !== context.companyAccountId) {
    reasons.push('TENANT_MISMATCH');
  }
  if (property.status !== 'ACTIVE' && property.status !== 'RESERVED') {
    reasons.push('STATUS_NOT_PUBLIC');
  }
  if (!property.publicationApprovedAt) {
    reasons.push('HUMAN_APPROVAL_MISSING');
  }
  if (!property.authorityDocumentVerifiedAt) {
    reasons.push('AUTHORITY_NOT_VERIFIED');
  }
  if (
    property.authorityExpiresAt &&
    property.authorityExpiresAt.getTime() <= context.now.getTime()
  ) {
    reasons.push('AUTHORITY_EXPIRED');
  }
  if (property.eidsRequired) {
    if (
      !property.eidsVerifiedAt ||
      !property.eidsVerificationReference?.trim()
    ) {
      reasons.push('EIDS_NOT_VERIFIED');
    }
  } else if (!property.eidsExemptionReason?.trim()) {
    reasons.push('EIDS_EXEMPTION_MISSING');
  }
  if (property.publicationBlockedAt) {
    reasons.push('PUBLICATION_BLOCKED');
  }
  return { eligible: reasons.length === 0, reasons };
}

export function isPropertyPublishable(
  property: PropertyPublicationRecord,
  context: { companyAccountId: string; now: Date }
) {
  return publicationEligibility(property, context).eligible;
}

export function publicationEligibilityWhere(
  companyAccountId: string,
  now: Date
): Prisma.CrmPropertyWhereInput {
  return {
    companyAccountId,
    status: { in: [CrmPropertyStatus.ACTIVE, CrmPropertyStatus.RESERVED] },
    publicationApprovedAt: { not: null },
    authorityDocumentVerifiedAt: { not: null },
    OR: [{ authorityExpiresAt: null }, { authorityExpiresAt: { gt: now } }],
    publicationBlockedAt: null,
    AND: [
      {
        OR: [
          {
            eidsRequired: true,
            eidsVerifiedAt: { not: null },
            eidsVerificationReference: { not: null },
          },
          {
            eidsRequired: false,
            eidsExemptionReason: { not: null },
          },
        ],
      },
    ],
  };
}
import { CrmPropertyStatus, Prisma } from '@prisma/client';
