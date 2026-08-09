import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  listingFindFirst: vi.fn(),
  contactFindFirst: vi.fn(),
  contactUpdate: vi.fn(),
  contactCreate: vi.fn(),
  resolve: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    huntedListing: { findFirst: mocks.listingFindFirst },
    $transaction: vi.fn(async (callback) =>
      callback({
        huntedContact: {
          findFirst: mocks.contactFindFirst,
          update: mocks.contactUpdate,
          create: mocks.contactCreate,
        },
      })
    ),
  },
}));

vi.mock('./contact-providers', () => ({
  getContactProvider: () => ({ resolve: mocks.resolve }),
}));

vi.mock('./contact-crypto', () => ({
  decryptContactPhone: vi.fn(),
  encryptContactPhone: () => 'contact:v1:ciphertext',
  maskContactPhone: () => '+90 5•• ••• 22 33',
  phoneHmac: () => 'new-phone-hmac',
}));

import { importHuntedContact } from './contact-service';

describe('importHuntedContact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listingFindFirst.mockResolvedValue({ id: 'listing-a' });
    mocks.resolve.mockResolvedValue({
      listingId: 'listing-a',
      phone: '+905551112233',
      subjectRole: 'OWNER',
      sourceType: 'AUTHORIZED_SOURCE',
      sourceReference: 'https://www.sahibinden.com/ilan/123/detay',
      purpose: 'PORTFOLIO_DISCOVERY',
      sourcePurposeAllowed: false,
      verificationStatus: 'UNVERIFIED',
      verifiedAt: null,
      verificationMethod: null,
      legalBasisStatus: 'CONFIRMED',
      retentionUntil: '2026-11-07T12:00:00.000Z',
    });
    mocks.contactFindFirst.mockResolvedValue({ id: 'legacy-contact' });
    mocks.contactUpdate.mockResolvedValue({ id: 'legacy-contact' });
  });

  it('telefonsuz eski ilan kaydını yeni HMAC ile güncelleyip çoğaltmaz', async () => {
    await importHuntedContact({
      companyAccountId: 'company-a',
      providerName: 'MANUAL_VERIFIED',
      payload: {},
    });

    expect(mocks.contactFindFirst).toHaveBeenCalledWith({
      where: {
        companyAccountId: 'company-a',
        listingId: 'listing-a',
        OR: [
          { phoneHmac: 'new-phone-hmac' },
          { phoneCiphertext: null, sourceType: 'LEGACY_UNVERIFIED' },
        ],
      },
    });
    expect(mocks.contactUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'legacy-contact' },
        data: expect.objectContaining({
          phoneHmac: 'new-phone-hmac',
          phoneCiphertext: 'contact:v1:ciphertext',
        }),
      })
    );
    expect(mocks.contactCreate).not.toHaveBeenCalled();
  });
});
