import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  assertPublicSourceUrl: vi.fn(),
  authorizationFindFirst: vi.fn(),
  authorizationUpsert: vi.fn(),
  huntJobCount: vi.fn(),
  huntJobFindUnique: vi.fn(),
  huntJobCreate: vi.fn(),
  huntJobUpdate: vi.fn(),
  huntJobFindUniqueOrThrow: vi.fn(),
  huntJobFindMany: vi.fn(),
  activeLockFindUnique: vi.fn(),
  activeLockCreate: vi.fn(),
  activeLockDelete: vi.fn(),
  quotaUpsert: vi.fn(),
  quotaUpdate: vi.fn(),
  cacheFindUnique: vi.fn(),
  cacheCreate: vi.fn(),
  cacheUpdateMany: vi.fn(),
  cacheUpdate: vi.fn(),
  dispatchQueuedHuntWorker: vi.fn(),
}));

const tx = {
  huntJob: {
    findUnique: mocks.huntJobFindUnique,
    create: mocks.huntJobCreate,
    update: mocks.huntJobUpdate,
    count: mocks.huntJobCount,
  },
  huntingActiveJobLock: {
    findUnique: mocks.activeLockFindUnique,
    create: mocks.activeLockCreate,
    delete: mocks.activeLockDelete,
  },
  huntingMonthlyQuota: {
    upsert: mocks.quotaUpsert,
    update: mocks.quotaUpdate,
  },
  huntingSearchCache: {
    findUnique: mocks.cacheFindUnique,
    create: mocks.cacheCreate,
    delete: vi.fn(),
  },
};

vi.mock('./security', () => ({
  assertPublicSourceUrl: mocks.assertPublicSourceUrl,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(async (value: unknown) =>
      typeof value === 'function'
        ? (value as (input: typeof tx) => unknown)(tx)
        : Promise.all(value as Promise<unknown>[])
    ),
    sourceAuthorization: {
      findFirst: mocks.authorizationFindFirst,
      upsert: mocks.authorizationUpsert,
    },
    huntJob: {
      count: mocks.huntJobCount,
      findUniqueOrThrow: mocks.huntJobFindUniqueOrThrow,
      update: mocks.huntJobUpdate,
      findMany: mocks.huntJobFindMany,
    },
    huntingSearchCache: {
      updateMany: mocks.cacheUpdateMany,
      update: mocks.cacheUpdate,
      findUnique: mocks.cacheFindUnique,
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

const filters = {
  province: 'İstanbul',
  district: 'Kadıköy',
  propertyType: 'KONUT' as const,
};

function jobBody() {
  return { provider: 'SAHIBINDEN' as const, filters };
}

describe('Avcı ClearPath iş sınırları', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AVCI_LIVE_PROVIDER_ENABLED = 'true';
    process.env.AVCI_WORKER_DISPATCH_MODE = 'apify';
    delete process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_ENABLED;
    delete process.env.AVCI_SAHIBINDEN_PLATFORM_AUTHORIZATION_REFERENCE;
    mocks.assertPublicSourceUrl.mockResolvedValue(undefined);
    mocks.authorizationFindFirst.mockResolvedValue(activeAuthorization);
    mocks.huntJobCount.mockResolvedValue(0);
    mocks.huntJobFindUnique.mockResolvedValue(null);
    mocks.activeLockFindUnique.mockResolvedValue(null);
    mocks.quotaUpsert.mockResolvedValue({
      id: 'quota-1', used: 0, reserved: 0,
    });
    mocks.cacheFindUnique.mockResolvedValue(null);
    mocks.cacheCreate.mockImplementation(async ({ data }) => ({
      id: 'cache-1', apifyRunId: null, apifyDatasetId: null, ...data,
    }));
    mocks.huntJobCreate.mockImplementation(async ({ data }) => ({
      id: 'job-1', status: 'QUEUED', ...data,
    }));
    mocks.cacheUpdateMany.mockResolvedValue({ count: 1 });
    mocks.dispatchQueuedHuntWorker.mockResolvedValue({
      status: 'started', runId: 'run-1', datasetId: 'dataset-1',
      actorId: 'clearpath~sahibinden-scraper-pro', apifyStatus: 'READY',
    });
    mocks.huntJobFindUniqueOrThrow.mockResolvedValue({
      id: 'job-1', status: 'RUNNING', propertyType: 'KONUT',
    });
    mocks.huntJobFindMany.mockResolvedValue([]);
  });

  it('tenant kimliğini servis bağlamından kullanır ve 50/500 kotasını ayırır', async () => {
    await expect(createHuntJob({
      companyAccountId: 'company-a', createdBy: 'OWNER:owner-a', body: jobBody(),
    })).resolves.toMatchObject({ id: 'job-1', status: 'RUNNING' });

    expect(mocks.huntJobCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyAccountId: 'company-a', sourceAuthorizationId: 'auth-1',
        propertyType: 'KONUT', requestedResults: 50, quotaReserved: 50,
      }),
    });
    expect(mocks.quotaUpdate).toHaveBeenCalledWith({
      where: { id: 'quota-1' }, data: { reserved: { increment: 50 } },
    });
  });

  it('owner-only URL ve ilk taramada en yeni sıralamasını kullanır', async () => {
    await createHuntJob({
      companyAccountId: 'company-a', createdBy: 'OWNER:owner-a', body: jobBody(),
    });
    const url = String(mocks.huntJobCreate.mock.calls[0][0].data.searchUrl);
    expect(url).toContain('/emlak-konut/istanbul-kadikoy/sahibinden');
    expect(url).toContain('a27=38460');
    expect(url).toContain('sorting=date_desc');
  });

  it('aynı konumda sonraki güvenli sıralamaya geçer', async () => {
    mocks.huntJobCount.mockResolvedValue(1);
    await createHuntJob({
      companyAccountId: 'company-a', createdBy: 'OWNER:owner-a', body: jobBody(),
    });
    expect(String(mocks.huntJobCreate.mock.calls[0][0].data.searchUrl)).toContain(
      'sorting=date_asc'
    );
  });

  it('dört sıralama bittikten sonra yeni ücretli iş açmaz', async () => {
    mocks.huntJobCount.mockResolvedValue(4);
    await expect(createHuntJob({
      companyAccountId: 'company-a', createdBy: 'OWNER:owner-a', body: jobBody(),
    })).rejects.toThrow('yeni ücretli tarama başlatılmadı');
    expect(mocks.dispatchQueuedHuntWorker).not.toHaveBeenCalled();
  });

  it('serbest canlı Sahibinden bağlantısını reddeder', async () => {
    await expect(createHuntJob({
      companyAccountId: 'company-a', createdBy: 'OWNER:owner-a',
      body: { provider: 'SAHIBINDEN', searchUrl: 'https://www.sahibinden.com/satilik' },
    })).rejects.toThrow('yalniz dogrulanmis filtrelerle');
  });

  it('canlı sağlayıcı kapalıyken veritabanına dokunmadan reddeder', async () => {
    process.env.AVCI_LIVE_PROVIDER_ENABLED = 'false';
    await expect(createHuntJob({
      companyAccountId: 'company-a', createdBy: 'OWNER:owner-a', body: jobBody(),
    })).rejects.toThrow('varsayılan olarak kapalı');
    expect(mocks.authorizationFindFirst).not.toHaveBeenCalled();
  });

  it('eksik kaynak yetkisi kapsamını fail-closed reddeder', async () => {
    mocks.authorizationFindFirst.mockResolvedValue({
      ...activeAuthorization,
      allowedScopes: ['SEARCH_READ', 'DETAIL_READ', 'MEDIA_READ'],
    });
    await expect(createHuntJob({
      companyAccountId: 'company-a', createdBy: 'OWNER:owner-a', body: jobBody(),
    })).rejects.toThrow('kapsami eksik');
    expect(mocks.huntJobCreate).not.toHaveBeenCalled();
  });
});
