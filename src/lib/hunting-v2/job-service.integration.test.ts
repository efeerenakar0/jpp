import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  assertPublicSourceUrl: vi.fn(),
  authorizationFindFirst: vi.fn(),
  authorizationUpsert: vi.fn(),
  jobUpsert: vi.fn(),
}));

vi.mock('./security', () => ({
  assertPublicSourceUrl: mocks.assertPublicSourceUrl,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    sourceAuthorization: {
      findFirst: mocks.authorizationFindFirst,
      upsert: mocks.authorizationUpsert,
    },
    huntJob: {
      upsert: mocks.jobUpsert,
    },
  },
}));

import { createHuntJob } from './job-service';

const activeAuthorization = {
  id: 'auth-1',
  companyAccountId: 'company-a',
  provider: 'SAHIBINDEN',
  status: 'ACTIVE',
  allowedScopes: ['SEARCH_READ', 'DETAIL_READ', 'MEDIA_READ', 'CONTACT_READ'],
  startsAt: new Date('2025-01-01T00:00:00.000Z'),
  expiresAt: new Date('2099-01-01T00:00:00.000Z'),
};

describe('Avcı job servisi entegrasyon sınırları', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AVCI_LIVE_PROVIDER_ENABLED = 'true';
    mocks.assertPublicSourceUrl.mockResolvedValue(
      new URL('https://www.sahibinden.com/satilik')
    );
    mocks.authorizationFindFirst.mockResolvedValue(activeAuthorization);
    mocks.jobUpsert.mockResolvedValue({
      id: 'job-1',
      status: 'QUEUED',
    });
  });

  it('tenant kimliğini istemciden değil servis bağlamından kullanır ve idempotent upsert yapar', async () => {
    await expect(
      createHuntJob({
        companyAccountId: 'company-a',
        createdBy: 'OWNER:owner-a',
        body: {
          provider: 'SAHIBINDEN',
          searchUrl: 'https://www.sahibinden.com/satilik',
        },
      })
    ).resolves.toMatchObject({ id: 'job-1' });

    expect(mocks.authorizationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyAccountId: 'company-a',
          provider: 'SAHIBINDEN',
          status: 'ACTIVE',
        }),
      })
    );
    expect(mocks.jobUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyAccountId_idempotencyKey: {
            companyAccountId: 'company-a',
            idempotencyKey: expect.stringMatching(/^[a-f0-9]{64}$/),
          },
        },
        create: expect.objectContaining({
          companyAccountId: 'company-a',
          sourceAuthorizationId: 'auth-1',
          createdBy: 'OWNER:owner-a',
        }),
      })
    );
  });

  it('serbest bağlantı istemeden filtrelerden owner-only arama URLsi üretir', async () => {
    await createHuntJob({
      companyAccountId: 'company-a',
      createdBy: 'OWNER:owner-a',
      body: {
        provider: 'SAHIBINDEN',
        filters: {
          listingType: 'SALE',
          propertyType: 'APARTMENT',
          province: 'İstanbul',
          district: 'Kadıköy',
          furnished: 'YES',
          minPrice: 3_000_000,
          maxPrice: 15_000_000,
        },
      },
    });

    expect(mocks.assertPublicSourceUrl).toHaveBeenCalledWith(
      expect.stringContaining(
        '/satilik-daire/istanbul-kadikoy/sahibinden?'
      ),
      'SAHIBINDEN'
    );
    expect(mocks.jobUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          searchUrl: expect.stringContaining('a103713=true'),
        }),
      })
    );
  });

  it('canlı provider bayrağı kapalıyken veritabanı işine başlamadan reddeder', async () => {
    process.env.AVCI_LIVE_PROVIDER_ENABLED = 'false';
    await expect(
      createHuntJob({
        companyAccountId: 'company-a',
        createdBy: 'OWNER:owner-a',
        body: {
          provider: 'SAHIBINDEN',
          searchUrl: 'https://www.sahibinden.com/satilik',
        },
      })
    ).rejects.toThrow('varsayılan olarak kapalı');
    expect(mocks.authorizationFindFirst).not.toHaveBeenCalled();
    expect(mocks.jobUpsert).not.toHaveBeenCalled();
  });

  it('gerekli yetki kapsamı eksikse fail-closed davranır', async () => {
    mocks.authorizationFindFirst.mockResolvedValue({
      ...activeAuthorization,
      allowedScopes: ['SEARCH_READ', 'DETAIL_READ', 'MEDIA_READ'],
    });
    await expect(
      createHuntJob({
        companyAccountId: 'company-a',
        createdBy: 'OWNER:owner-a',
        body: {
          provider: 'SAHIBINDEN',
          searchUrl: 'https://www.sahibinden.com/satilik',
        },
      })
    ).rejects.toThrow('kapsamı eksik');
    expect(mocks.jobUpsert).not.toHaveBeenCalled();
  });
});
