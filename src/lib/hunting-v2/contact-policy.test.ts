import { describe, expect, it } from 'vitest';
import { evaluateContactPolicy } from './contact-policy';

const readyInput = {
  contactId: 'contact-1',
  listingId: 'listing-1',
  companyAccountId: 'company-1',
  channel: 'WHATSAPP' as const,
  purpose: 'SALES_AUTHORITY_DISCUSSION',
  verificationStatus: 'PARTNER_VERIFIED' as const,
  subjectRole: 'OWNER' as const,
  sourceType: 'PARTNER_FEED' as const,
  sourcePurposeAllowed: true,
  legalBasisStatus: 'CONFIRMED' as const,
  consentStatus: 'GRANTED' as const,
  iysRequired: true,
  iysStatus: 'APPROVED',
  doNotContactAt: null,
  retentionUntil: new Date('2027-01-01T00:00:00.000Z'),
  evaluatedAt: new Date('2026-07-29T00:00:00.000Z'),
  companyScopeMatches: true,
  humanApprovedAt: new Date('2026-07-29T00:00:00.000Z'),
};

describe('merkezî ContactPolicy', () => {
  it('bütün koşullar sağlandığında iletişime izin verir', () => {
    expect(evaluateContactPolicy(readyInput)).toEqual({
      allowed: true,
      reasonCodes: [],
    });
  });

  it.each([
    ['UNVERIFIED', 'PHONE_NOT_VERIFIED'],
    ['REJECTED', 'PHONE_REJECTED'],
  ] as const)(
    'telefon doğrulama durumu %s ise kapalı davranır',
    (verificationStatus, reasonCode) => {
      const decision = evaluateContactPolicy({
        ...readyInput,
        verificationStatus,
      });
      expect(decision.allowed).toBe(false);
      expect(decision.reasonCodes).toContain(reasonCode);
    }
  );

  it('legacy kaydı hiçbir koşulda CONTACT_READY yapmaz', () => {
    const decision = evaluateContactPolicy({
      ...readyInput,
      sourceType: 'LEGACY_UNVERIFIED',
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain('LEGACY_CONTACT_QUARANTINED');
  });

  it('UNKNOWN izin, ret, süresi dolmuş saklama veya insan onayı eksikliğinde fail-closed çalışır', () => {
    const decision = evaluateContactPolicy({
      ...readyInput,
      consentStatus: 'UNKNOWN',
      doNotContactAt: new Date('2026-07-28T00:00:00.000Z'),
      retentionUntil: new Date('2026-07-28T00:00:00.000Z'),
      humanApprovedAt: null,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        'CHANNEL_CONSENT_UNKNOWN',
        'SUPPRESSED',
        'RETENTION_EXPIRED',
        'HUMAN_APPROVAL_REQUIRED',
      ])
    );
  });
});
