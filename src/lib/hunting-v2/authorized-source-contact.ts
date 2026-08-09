import 'server-only';

import {
  encryptContactPhone,
  maskContactPhone,
  phoneHmac,
} from './contact-crypto';

function contactRetentionDays() {
  const parsed = Number(process.env.AVCI_CONTACT_RETENTION_DAYS || 90);
  if (!Number.isFinite(parsed)) return 90;
  return Math.min(3650, Math.max(1, Math.trunc(parsed)));
}

export function buildAuthorizedSourceContact(input: {
  phone: string;
  sourceUrl: string;
  now?: Date;
  authorizationExpiresAt: Date | null;
}) {
  const now = input.now || new Date();
  const configuredRetentionUntil = new Date(
    now.getTime() + contactRetentionDays() * 24 * 60 * 60 * 1000
  );
  const retentionUntil =
    input.authorizationExpiresAt &&
    input.authorizationExpiresAt < configuredRetentionUntil
      ? input.authorizationExpiresAt
      : configuredRetentionUntil;

  return {
    phoneCiphertext: encryptContactPhone(input.phone),
    phoneHmac: phoneHmac(input.phone),
    maskedPhone: maskContactPhone(input.phone),
    subjectRole: 'OWNER' as const,
    sourceType: 'AUTHORIZED_SOURCE' as const,
    sourceReference: input.sourceUrl,
    purpose: 'PORTFOLIO_DISCOVERY',
    sourcePurposeAllowed: false,
    verificationStatus: 'UNVERIFIED' as const,
    verificationMethod: 'authorized-visible-source-page',
    legalBasisStatus: 'CONFIRMED' as const,
    retentionUntil,
    quarantinedAt: null,
    quarantineReason: null,
  };
}
