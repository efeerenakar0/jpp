import type { HuntingContactSummary } from './types';

export const CONTACT_REASON_LABELS: Record<string, string> = {
  PHONE_NOT_VERIFIED: 'Telefon henüz doğrulanmadı.',
  PHONE_REJECTED: 'Telefon doğrulaması reddedildi.',
  SUBJECT_ROLE_NOT_CONTACTABLE:
    'Kişinin malik veya yetkili temsilci olduğu doğrulanmadı.',
  SOURCE_PURPOSE_NOT_ALLOWED:
    'Telefon kaynağı satış yetkisi görüşmesine izin vermiyor.',
  PURPOSE_NOT_ALLOWED: 'Kayıtlı iletişim amacı bu işlemle uyumlu değil.',
  LEGAL_BASIS_NOT_CONFIRMED:
    'Kişisel veri işleme dayanağı doğrulanmadı.',
  CHANNEL_CONSENT_UNKNOWN: 'WhatsApp kanal izni henüz doğrulanmadı.',
  CHANNEL_CONSENT_DENIED: 'WhatsApp kanal izni geçerli değil.',
  IYS_NOT_APPROVED: 'Gerekli İYS kontrolü olumlu değil.',
  SUPPRESSED: 'Kişi iletişim yapılmamasını istedi.',
  RETENTION_EXPIRED: 'İletişim kaydının saklama süresi doldu.',
  COMPANY_SCOPE_MISMATCH: 'İzin bu şirket için geçerli değil.',
  HUMAN_APPROVAL_REQUIRED: 'Yetkili insan onayı bekleniyor.',
  LEGACY_CONTACT_QUARANTINED:
    'Eski telefon kaydı doğrulanmadığı için karantinada.',
};

export type ContactUiStatus =
  | 'NO_PHONE'
  | 'SOURCE_PENDING'
  | 'UNVERIFIED'
  | 'POLICY_REVIEW'
  | 'READY'
  | 'BLOCKED';

export function contactUiStatus(
  contact?: HuntingContactSummary
): ContactUiStatus {
  if (!contact) return 'NO_PHONE';
  const latest = contact.policyDecisions[0];
  const reasons = latest?.reasonCodes || [];
  const consent = contact.consents?.[0];
  const approval = contact.approvals?.[0];
  const retentionExpired =
    !contact.retentionUntil ||
    new Date(contact.retentionUntil).getTime() <= Date.now();
  if (
    contact.doNotContactAt ||
    contact.quarantinedAt ||
    contact.sourceType === 'LEGACY_UNVERIFIED' ||
    contact.verificationStatus === 'REJECTED' ||
    contact.legalBasisStatus === 'REJECTED' ||
    contact.legalBasisStatus === 'EXPIRED' ||
    retentionExpired ||
    (consent &&
      ['REJECTED', 'REVOKED', 'EXPIRED'].includes(consent.status)) ||
    reasons.some((reason) =>
      [
        'PHONE_REJECTED',
        'SUPPRESSED',
        'LEGACY_CONTACT_QUARANTINED',
        'CHANNEL_CONSENT_DENIED',
      ].includes(reason)
    )
  ) {
    return 'BLOCKED';
  }
  if (
    ![
      'OTP_VERIFIED',
      'PARTNER_VERIFIED',
      'MANUALLY_VERIFIED',
    ].includes(contact.verificationStatus)
  ) {
    return 'UNVERIFIED';
  }
  if (
    contact.sourcePurposeAllowed !== true ||
    contact.legalBasisStatus !== 'CONFIRMED' ||
    !consent ||
    consent.status === 'UNKNOWN'
  ) {
    return 'SOURCE_PENDING';
  }
  if (
    !['OWNER', 'AUTHORIZED_REPRESENTATIVE'].includes(
      contact.subjectRole || 'UNKNOWN'
    ) ||
    consent.status !== 'GRANTED' ||
    consent.iysStatus !== 'APPROVED' ||
    !approval ||
    approval.revokedAt
  ) {
    return 'POLICY_REVIEW';
  }
  if (latest?.allowed) return 'READY';
  if (!latest) return 'POLICY_REVIEW';
  return 'POLICY_REVIEW';
}

export const CONTACT_STATUS_META: Record<
  ContactUiStatus,
  { label: string; className: string }
> = {
  NO_PHONE: {
    label: 'Telefon yok',
    className: 'border-slate-700 bg-slate-800 text-slate-300',
  },
  SOURCE_PENDING: {
    label: 'Kaynak bekliyor',
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  },
  UNVERIFIED: {
    label: 'Doğrulanmamış',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  },
  POLICY_REVIEW: {
    label: 'İzin kontrolü gerekli',
    className: 'border-violet-500/30 bg-violet-500/10 text-violet-300',
  },
  READY: {
    label: 'İletişime hazır',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  },
  BLOCKED: {
    label: 'Ret / iletişim yasak',
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  },
};
