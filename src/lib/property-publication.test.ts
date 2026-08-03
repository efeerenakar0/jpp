import { describe, expect, it } from 'vitest';

import {
  isPropertyPublishable,
  publicationEligibility,
} from './property-publication';

const now = new Date('2026-08-02T12:00:00.000Z');
const eligible = {
  companyAccountId: 'company-a',
  status: 'ACTIVE' as const,
  publicationApprovedAt: new Date('2026-08-01T12:00:00.000Z'),
  authorityDocumentVerifiedAt: new Date('2026-08-01T12:00:00.000Z'),
  authorityExpiresAt: new Date('2026-09-01T12:00:00.000Z'),
  eidsRequired: true,
  eidsVerifiedAt: new Date('2026-08-01T12:00:00.000Z'),
  eidsVerificationReference: 'EIDS-42',
  eidsExemptionReason: null,
  publicationBlockedAt: null,
};

describe('central property publication gate', () => {
  it('publishes only tenant-matched ACTIVE or RESERVED records with approvals', () => {
    expect(
      isPropertyPublishable(eligible, {
        companyAccountId: 'company-a',
        now,
      })
    ).toBe(true);
    expect(
      isPropertyPublishable(
        { ...eligible, companyAccountId: 'company-b' },
        { companyAccountId: 'company-a', now }
      )
    ).toBe(false);
    expect(
      isPropertyPublishable(
        { ...eligible, status: 'SOLD' },
        { companyAccountId: 'company-a', now }
      )
    ).toBe(false);
  });

  it('fails closed for missing/expired authority and incomplete EIDS evidence', () => {
    expect(
      publicationEligibility(
        { ...eligible, authorityDocumentVerifiedAt: null },
        { companyAccountId: 'company-a', now }
      ).reasons
    ).toContain('AUTHORITY_NOT_VERIFIED');
    expect(
      publicationEligibility(
        { ...eligible, authorityExpiresAt: new Date('2026-08-01T00:00:00Z') },
        { companyAccountId: 'company-a', now }
      ).reasons
    ).toContain('AUTHORITY_EXPIRED');
    expect(
      publicationEligibility(
        { ...eligible, eidsVerificationReference: null },
        { companyAccountId: 'company-a', now }
      ).reasons
    ).toContain('EIDS_NOT_VERIFIED');
  });

  it('requires an auditable reason when EIDS is exempt', () => {
    expect(
      isPropertyPublishable(
        {
          ...eligible,
          eidsRequired: false,
          eidsVerifiedAt: null,
          eidsVerificationReference: null,
          eidsExemptionReason: 'Bu işletme/kanal için EİDS uygulanmıyor.',
        },
        { companyAccountId: 'company-a', now }
      )
    ).toBe(true);
    expect(
      isPropertyPublishable(
        {
          ...eligible,
          eidsRequired: false,
          eidsVerifiedAt: null,
          eidsVerificationReference: null,
          eidsExemptionReason: null,
        },
        { companyAccountId: 'company-a', now }
      )
    ).toBe(false);
  });
});
