import type {
  PartnerCountryPolicyStatus,
  PartnerOutreachReasonCode,
} from './types';

export function verificationStatusForImportedSource(sourceType: string) {
  if (sourceType === 'MANUAL_CSV') return 'MANUALLY_VERIFIED' as const;
  if (sourceType === 'PARTNER_FEED' || sourceType === 'OFFICIAL_COMPANY_WEBSITE' || sourceType === 'OFFICIAL_REGISTRY') {
    return 'SOURCE_VERIFIED' as const;
  }
  return 'UNVERIFIED' as const;
}

type PolicyInput = {
  countryPolicyStatus: PartnerCountryPolicyStatus | null;
  corporateEmailVerified: boolean;
  humanApproved: boolean;
  mailboxConnected: boolean;
  draftHashMatchesApproval: boolean;
  suppressed: boolean;
  dailyCompanyQuotaAvailable: boolean;
  dailyDomainQuotaAvailable: boolean;
  dailyMailboxQuotaAvailable: boolean;
};

export function evaluatePartnerOutreachPolicy(input: PolicyInput) {
  const reasonCodes: PartnerOutreachReasonCode[] = [];
  if (
    !input.countryPolicyStatus ||
    input.countryPolicyStatus === 'BLOCKED_PENDING_COUNTRY_REVIEW' ||
    input.countryPolicyStatus === 'MANUAL_REVIEW'
  ) {
    reasonCodes.push('COUNTRY_REVIEW_REQUIRED');
  } else if (input.countryPolicyStatus === 'BLOCKED') {
    reasonCodes.push('COUNTRY_BLOCKED');
  } else if (input.countryPolicyStatus === 'CONSENT_REQUIRED') {
    reasonCodes.push('COUNTRY_CONSENT_REQUIRED');
  }
  if (!input.corporateEmailVerified) {
    reasonCodes.push('CORPORATE_EMAIL_NOT_VERIFIED');
  }
  if (!input.humanApproved) reasonCodes.push('HUMAN_APPROVAL_REQUIRED');
  if (!input.mailboxConnected) reasonCodes.push('MAILBOX_NOT_CONNECTED');
  if (!input.draftHashMatchesApproval) reasonCodes.push('APPROVAL_STALE');
  if (input.suppressed) reasonCodes.push('SUPPRESSED');
  if (!input.dailyCompanyQuotaAvailable) {
    reasonCodes.push('COMPANY_DAILY_QUOTA_EXCEEDED');
  }
  if (!input.dailyDomainQuotaAvailable) {
    reasonCodes.push('DOMAIN_DAILY_QUOTA_EXCEEDED');
  }
  if (!input.dailyMailboxQuotaAvailable) {
    reasonCodes.push('MAILBOX_DAILY_QUOTA_EXCEEDED');
  }
  return { allowed: reasonCodes.length === 0, reasonCodes };
}
