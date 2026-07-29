import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaOwner: vi.fn(),
  importContact: vi.fn(),
  consentUpsert: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaOwner: mocks.requireFabrikaOwner,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    contactConsent: {
      upsert: mocks.consentUpsert,
    },
  },
}));

vi.mock('@/lib/hunting-v2/contact-service', () => ({
  importHuntedContact: mocks.importContact,
}));

vi.mock('@/lib/hunting-v2/contact-providers', async () =>
  import('../../../../../../lib/hunting-v2/contact-providers')
);

vi.mock('@/lib/hunting-v2/rate-limit', () => ({
  enforceHuntingRateLimit: mocks.enforceRateLimit,
}));

vi.mock('@/lib/hunting-v2/api', () => ({
  principalActor: () => ({ key: 'OWNER:owner-a' }),
  huntingApiError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Bilinmeyen hata' },
      { status: 400 }
    ),
}));

import { POST } from './route';

const payload = {
  listingId: 'listing-a',
  phone: '+905000000000',
  subjectRole: 'OWNER',
  purpose: 'SALES_AUTHORITY_DISCUSSION',
  sourceReference: 'manual-evidence-1',
  sourcePurposeAllowed: true,
  legalBasisStatus: 'CONFIRMED',
  retentionUntil: '2027-01-01T00:00:00.000Z',
  verificationEvidence: 'signed-form-1',
};

describe('Avcı ContactProvider import route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaOwner.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.importContact.mockResolvedValue({
      id: 'contact-a',
      listingId: 'listing-a',
      maskedPhone: '+90 *** *** ** 00',
      verificationStatus: 'MANUALLY_VERIFIED',
    });
    mocks.consentUpsert.mockResolvedValue({ id: 'consent-a' });
  });

  it('tenant kimliğini oturumdan alır ve içe aktarılan telefonu açık dönmez', async () => {
    const response = await POST(
      new Request('https://app.test/api/fabrika/hunting/contacts/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'MANUAL_VERIFIED',
          payload,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.importContact).toHaveBeenCalledWith({
      companyAccountId: 'company-a',
      providerName: 'MANUAL_VERIFIED',
      payload,
    });
    await expect(response.json()).resolves.toEqual({
      id: 'contact-a',
      listingId: 'listing-a',
      maskedPhone: '+90 *** *** ** 00',
      verificationStatus: 'MANUALLY_VERIFIED',
      contactReady: false,
      nextStep: 'CONTACT_POLICY_EVALUATION_AND_HUMAN_APPROVAL',
    });
  });

  it('izin kanıtını aynı tenant ve amaçla idempotent upsert eder', async () => {
    const response = await POST(
      new Request('https://app.test/api/fabrika/hunting/contacts/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'MANUAL_VERIFIED',
          payload,
          consent: {
            channel: 'WHATSAPP',
            purpose: 'SALES_AUTHORITY_DISCUSSION',
            status: 'GRANTED',
            consentTextVersion: 'v1',
            evidenceReference: 'consent-form-1',
            grantedAt: '2026-07-29T10:00:00.000Z',
            iysStatus: 'APPROVED',
          },
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.consentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contactId_companyAccountId_channel_purpose: {
            contactId: 'contact-a',
            companyAccountId: 'company-a',
            channel: 'WHATSAPP',
            purpose: 'SALES_AUTHORITY_DISCUSSION',
          },
        },
        create: expect.objectContaining({
          companyAccountId: 'company-a',
          evidenceReference: 'consent-form-1',
        }),
      })
    );
  });
});
