import type {
  ContactChannel,
  ContactConsentStatus,
  ContactSourceType,
  ContactSubjectRole,
  ContactVerificationStatus,
} from './types';

export const CONTACT_POLICY_REASON_CODES = [
  'PHONE_NOT_VERIFIED',
  'PHONE_REJECTED',
  'SUBJECT_ROLE_NOT_CONTACTABLE',
  'SOURCE_PURPOSE_NOT_ALLOWED',
  'PURPOSE_NOT_ALLOWED',
  'LEGAL_BASIS_NOT_CONFIRMED',
  'CHANNEL_CONSENT_UNKNOWN',
  'CHANNEL_CONSENT_DENIED',
  'IYS_NOT_APPROVED',
  'SUPPRESSED',
  'RETENTION_EXPIRED',
  'COMPANY_SCOPE_MISMATCH',
  'HUMAN_APPROVAL_REQUIRED',
  'LEGACY_CONTACT_QUARANTINED',
] as const;

export type ContactPolicyReasonCode =
  (typeof CONTACT_POLICY_REASON_CODES)[number];

export type ContactPolicyInput = {
  contactId: string;
  listingId: string;
  companyAccountId: string;
  channel: ContactChannel;
  purpose: string;
  verificationStatus: ContactVerificationStatus;
  subjectRole: ContactSubjectRole;
  sourceType: ContactSourceType;
  sourcePurposeAllowed: boolean | null;
  legalBasisStatus: 'UNKNOWN' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
  consentStatus: ContactConsentStatus;
  iysRequired: boolean;
  iysStatus: string | null;
  doNotContactAt: Date | null;
  retentionUntil: Date | null;
  evaluatedAt: Date;
  companyScopeMatches: boolean;
  humanApprovedAt: Date | null;
};

export type ContactPolicyResult = {
  allowed: boolean;
  reasonCodes: ContactPolicyReasonCode[];
};

export function evaluateContactPolicy(
  input: ContactPolicyInput
): ContactPolicyResult {
  const reasonCodes: ContactPolicyReasonCode[] = [];

  if (input.sourceType === 'LEGACY_UNVERIFIED') {
    reasonCodes.push('LEGACY_CONTACT_QUARANTINED');
  }
  if (input.verificationStatus === 'REJECTED') {
    reasonCodes.push('PHONE_REJECTED');
  } else if (
    ![
      'OTP_VERIFIED',
      'PARTNER_VERIFIED',
      'MANUALLY_VERIFIED',
    ].includes(input.verificationStatus)
  ) {
    reasonCodes.push('PHONE_NOT_VERIFIED');
  }
  if (
    !['OWNER', 'AUTHORIZED_REPRESENTATIVE'].includes(input.subjectRole)
  ) {
    reasonCodes.push('SUBJECT_ROLE_NOT_CONTACTABLE');
  }
  if (input.sourcePurposeAllowed !== true) {
    reasonCodes.push('SOURCE_PURPOSE_NOT_ALLOWED');
  }
  if (input.purpose !== 'SALES_AUTHORITY_DISCUSSION') {
    reasonCodes.push('PURPOSE_NOT_ALLOWED');
  }
  if (input.legalBasisStatus !== 'CONFIRMED') {
    reasonCodes.push('LEGAL_BASIS_NOT_CONFIRMED');
  }
  if (input.consentStatus === 'UNKNOWN') {
    reasonCodes.push('CHANNEL_CONSENT_UNKNOWN');
  } else if (input.consentStatus !== 'GRANTED') {
    reasonCodes.push('CHANNEL_CONSENT_DENIED');
  }
  if (input.iysRequired && input.iysStatus !== 'APPROVED') {
    reasonCodes.push('IYS_NOT_APPROVED');
  }
  if (input.doNotContactAt) {
    reasonCodes.push('SUPPRESSED');
  }
  if (
    !input.retentionUntil ||
    input.retentionUntil.getTime() <= input.evaluatedAt.getTime()
  ) {
    reasonCodes.push('RETENTION_EXPIRED');
  }
  if (!input.companyScopeMatches) {
    reasonCodes.push('COMPANY_SCOPE_MISMATCH');
  }
  if (!input.humanApprovedAt) {
    reasonCodes.push('HUMAN_APPROVAL_REQUIRED');
  }

  return { allowed: reasonCodes.length === 0, reasonCodes };
}
