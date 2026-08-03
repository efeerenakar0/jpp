export const PARTNER_SCORE_VERSION = 'partner-score-v1';

export type PartnerCandidateInput = {
  externalId?: string | null;
  registrationNumber?: string | null;
  licenseNumber?: string | null;
  name: string;
  city?: string | null;
  domain?: string | null;
  sourceIds: string[];
  completeness: number;
};

export type PartnerCountryPolicyStatus =
  | 'ALLOWED'
  | 'CONSENT_REQUIRED'
  | 'MANUAL_REVIEW'
  | 'BLOCKED'
  | 'BLOCKED_PENDING_COUNTRY_REVIEW';

export type PartnerOutreachReasonCode =
  | 'COUNTRY_REVIEW_REQUIRED'
  | 'COUNTRY_BLOCKED'
  | 'COUNTRY_CONSENT_REQUIRED'
  | 'CORPORATE_EMAIL_NOT_VERIFIED'
  | 'HUMAN_APPROVAL_REQUIRED'
  | 'MAILBOX_NOT_CONNECTED'
  | 'APPROVAL_STALE'
  | 'SUPPRESSED'
  | 'COMPANY_DAILY_QUOTA_EXCEEDED'
  | 'DOMAIN_DAILY_QUOTA_EXCEEDED'
  | 'MAILBOX_DAILY_QUOTA_EXCEEDED';

export type PartnerDraftPayload = {
  subject: string;
  body: string;
  language: string;
  turkishTranslation: string;
  personalizationEvidence: Array<{
    claim: string;
    sourceId: string;
    sourceUrl: string;
  }>;
  warnings: string[];
};
