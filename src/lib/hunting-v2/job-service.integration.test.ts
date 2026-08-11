import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  assertPublicSourceUrl: vi.fn(),
  authorizationFindFirst: vi.fn(),
  authorizationUpsert: vi.fn(),
  jobUpsert: vi.fn(),
  dispatchQueuedHuntWorker: vi.fn(),
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

vi.mock('./worker-dispatch', () => ({
  dispatchQueuedHuntWorker: mocks.dispatchQueuedHuntWorker,
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
    delete process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_ENABLED;
    delete process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_REFERENCE;
    delete process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_STARTS_AT;
    delete process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_EXPIRES_AT;
    mocks.assertPublicSourceUrl.mockResolvedValue(
      new URL('https://www.sahibinden.com/satilik')
    );
    mocks.authorizationFindFirst.mockResolvedValue(activeAuthorization);
    mocks.jobUpsert.mockResolvedValue({
      id: 'job-1',
      status: 'QUEUED',
    });
    mocks.dispatchQueuedHuntWorker.mockResolvedValue({ status: 'disabled' });
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
    expect(mocks.dispatchQueuedHuntWorker).toHaveBeenCalledWith('job-1');
  });

  it('tamamlanmış idempotent işi yeniden tetiklemez', async () => {
    mocks.jobUpsert.mockResolvedValue({
      id: 'job-1',
      status: 'COMPLETED',
    });

    await createHuntJob({
      companyAccountId: 'company-a',
      createdBy: 'OWNER:owner-a',
      body: {
        provider: 'SAHIBINDEN',
        searchUrl: 'https://www.sahibinden.com/satilik',
      },
    });

    expect(mocks.dispatchQueuedHuntWorker).not.toHaveBeenCalled();
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

  it('platform-geneli Sahibinden iznini tenant için materialize edip işi başlatır', async () => {
    process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_ENABLED = 'true';
    process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_REFERENCE =
      'business-ai-portfoy-uzmani';
    process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_STARTS_AT =
      '2026-08-03T00:00:00.000Z';
    mocks.authorizationFindFirst.mockResolvedValue(null);
    mocks.authorizationUpsert.mockResolvedValue({
      ...activeAuthorization,
      id: 'platform-auth-1',
      contractReference: 'platform:business-ai-portfoy-uzmani',
      startsAt: new Date('2026-08-03T00:00:00.000Z'),
      expiresAt: null,
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
    ).resolves.toMatchObject({ id: 'job-1' });

    expect(mocks.authorizationUpsert).toHaveBeenCalledWith({
      where: {
        companyAccountId_provider_contractReference: {
          companyAccountId: 'company-a',
          provider: 'SAHIBINDEN',
          contractReference: 'platform:business-ai-portfoy-uzmani',
        },
      },
      update: {
        status: 'ACTIVE',
        allowedScopes: [
          'SEARCH_READ',
          'DETAIL_READ',
          'MEDIA_READ',
          'CONTACT_READ',
        ],
        startsAt: new Date('2026-08-03T00:00:00.000Z'),
        expiresAt: null,
      },
      create: {
        companyAccountId: 'company-a',
        provider: 'SAHIBINDEN',
        status: 'ACTIVE',
        allowedScopes: [
          'SEARCH_READ',
          'DETAIL_READ',
          'MEDIA_READ',
          'CONTACT_READ',
        ],
        contractReference: 'platform:business-ai-portfoy-uzmani',
        startsAt: new Date('2026-08-03T00:00:00.000Z'),
        expiresAt: null,
      },
    });
    expect(mocks.jobUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceAuthorizationId: 'platform-auth-1',
        }),
      })
    );
  });

  it('platform izni açıkken sözleşme referansı yoksa fail-closed davranır', async () => {
    process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_ENABLED = 'true';
    mocks.authorizationFindFirst.mockResolvedValue(null);

    await expect(
      createHuntJob({
        companyAccountId: 'company-a',
        createdBy: 'OWNER:owner-a',
        body: {
          provider: 'SAHIBINDEN',
          searchUrl: 'https://www.sahibinden.com/satilik',
        },
      })
    ).rejects.toThrow('referansı eksik');

    expect(mocks.authorizationUpsert).not.toHaveBeenCalled();
    expect(mocks.jobUpsert).not.toHaveBeenCalled();
  });
});
