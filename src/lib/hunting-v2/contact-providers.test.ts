import { describe, expect, it } from 'vitest';
import {
  CONTACT_PROVIDER_NAMES,
  ContactProviderError,
  ManualVerifiedContactProvider,
  PartnerFeedContactProvider,
  contactProviderImportSchema,
  getContactProvider,
} from './contact-providers';

const validPayload = {
  listingId: 'listing_1',
  phone: '+90 500 000 00 00',
  subjectRole: 'OWNER',
  purpose: 'SALES_AUTHORITY_DISCUSSION',
  sourceReference: 'contract-row-42',
  sourcePurposeAllowed: true,
  legalBasisStatus: 'CONFIRMED',
  retentionUntil: '2027-01-01T00:00:00.000Z',
  verificationEvidence: 'signed-form-42',
};

describe('contact providers', () => {
  it('rejects an import without purpose evidence', () => {
    const result = contactProviderImportSchema.safeParse({
      ...validPayload,
      sourcePurposeAllowed: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('keeps configured provider names explicit', () => {
    expect(CONTACT_PROVIDER_NAMES).toEqual([
      'PARTNER_FEED',
      'BANA_EMLAKCI_BUL',
      'FIRST_PARTY_FORM',
      'MANUAL_VERIFIED',
      'EXISTING_CRM',
    ]);
  });

  it('fails closed when a live provider has no credential', async () => {
    const provider = new PartnerFeedContactProvider(undefined);
    await expect(provider.resolve(validPayload)).rejects.toMatchObject({
      code: 'PROVIDER_DISABLED',
    });
  });

  it('requires manual verification evidence', async () => {
    const provider = new ManualVerifiedContactProvider();
    await expect(
      provider.resolve({ ...validPayload, verificationEvidence: '' })
    ).rejects.toBeInstanceOf(ContactProviderError);
  });

  it('returns only known provider adapters', () => {
    expect(getContactProvider('MANUAL_VERIFIED')).toBeInstanceOf(
      ManualVerifiedContactProvider
    );
    expect(() => getContactProvider('LEGACY_UNVERIFIED' as never)).toThrow(
      'ContactProvider desteklenmiyor.'
    );
  });
});
