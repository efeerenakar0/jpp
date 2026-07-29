import { describe, expect, it } from 'vitest';
import { contactUiStatus } from './contact-status';
import type { HuntingContactSummary } from './types';

function contact(
  overrides: Partial<HuntingContactSummary> = {}
): HuntingContactSummary {
  return {
    id: 'contact-1',
    maskedPhone: '+90 *** *** ** 12',
    subjectRole: 'OWNER',
    sourceType: 'PARTNER_FEED',
    sourcePurposeAllowed: true,
    verificationStatus: 'PARTNER_VERIFIED',
    legalBasisStatus: 'CONFIRMED',
    retentionUntil: '2099-01-01T00:00:00.000Z',
    doNotContactAt: null,
    consents: [
      {
        status: 'GRANTED',
        iysStatus: 'APPROVED',
        updatedAt: new Date().toISOString(),
      },
    ],
    approvals: [
      {
        approvedAt: new Date().toISOString(),
        revokedAt: null,
      },
    ],
    policyDecisions: [],
    ...overrides,
  };
}

describe('Avcı iletişim durumlarının kullanıcı diline çevrilmesi', () => {
  it('telefon yok ve doğrulanmamış durumlarını ayırır', () => {
    expect(contactUiStatus()).toBe('NO_PHONE');
    expect(
      contactUiStatus(contact({ verificationStatus: 'UNVERIFIED' }))
    ).toBe('UNVERIFIED');
  });

  it('ret veya legacy karantinasını engelli gösterir', () => {
    expect(
      contactUiStatus(
        contact({
          sourceType: 'LEGACY_UNVERIFIED',
          quarantinedAt: new Date().toISOString(),
        })
      )
    ).toBe('BLOCKED');
    expect(
      contactUiStatus(
        contact({
          policyDecisions: [
            {
              allowed: false,
              reasonCodes: ['SUPPRESSED'],
              evaluatedAt: new Date().toISOString(),
            },
          ],
        })
      )
    ).toBe('BLOCKED');
  });

  it('yalnız izin kararı allowed olduğunda iletişime hazır gösterir', () => {
    expect(
      contactUiStatus(
        contact({
          policyDecisions: [
            {
              allowed: true,
              reasonCodes: [],
              evaluatedAt: new Date().toISOString(),
            },
          ],
        })
      )
    ).toBe('READY');
  });

  it('eski allowed kararı saklama süresi dolunca hazır saymaz', () => {
    expect(
      contactUiStatus(
        contact({
          retentionUntil: '2020-01-01T00:00:00.000Z',
          policyDecisions: [
            {
              allowed: true,
              reasonCodes: [],
              evaluatedAt: '2019-01-01T00:00:00.000Z',
            },
          ],
        })
      )
    ).toBe('BLOCKED');
  });
});
