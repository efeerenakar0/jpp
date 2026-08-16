import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  itemFindFirst: vi.fn(),
  itemFindMany: vi.fn(),
  itemUpdateMany: vi.fn(),
  itemCount: vi.fn(),
  batchFindUnique: vi.fn(),
  batchUpdate: vi.fn(),
  operationEventUpsert: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    studioBatchItem: {
      findFirst: mocks.itemFindFirst,
      findMany: mocks.itemFindMany,
      updateMany: mocks.itemUpdateMany,
      count: mocks.itemCount,
    },
    studioBatch: {
      findUnique: mocks.batchFindUnique,
      update: mocks.batchUpdate,
    },
    operationEvent: { upsert: mocks.operationEventUpsert },
  },
}));

vi.mock('@/lib/media-storage', () => ({
  fetchOwnedMediaBytes: vi.fn(),
  persistGeneratedMedia: vi.fn(),
  persistPropertyMediaFile: vi.fn(),
  validatePropertyMediaFiles: vi.fn(),
}));

vi.mock('@/lib/property-media', () => ({
  assertOwnedProperty: vi.fn(),
  PropertyMediaError: class PropertyMediaError extends Error {},
}));

vi.mock('@/lib/studio-image-engine', () => ({
  LOCAL_STUDIO_IMAGE_MODEL: 'studio-adaptive-photography-v2',
  StudioImageError: class StudioImageError extends Error {},
  enhanceStudioImage: vi.fn(),
  resolveStudioImageEngine: vi.fn(() => 'REALISTIC'),
  resolveStudioImageModelTier: vi.fn(() => 'STANDARD'),
}));

import {
  isLegacyStudioSafetyFailure,
  processNextStudioBatchItem,
} from './studio-batches';

describe('legacy Studio safety retry detection', () => {
  it.each([
    'Yapay zeka fotografin kadrajini degistirdi. Guvenlik icin bu sonuc kaydedilmedi; tekrar deneyin.',
    'Yapay zeka fotografi gereğinden fazla aydinlatti. Guvenlik icin bu sonuc kaydedilmedi; tekrar deneyin.',
    'Güvenlik kontrolünde reddedildi.',
    'Yapay zeka gecersiz bir gorsel dondurdu. Bu fotografi tekrar deneyin.',
  ])('routes a former safety failure to the free local retry path: %s', (message) => {
    expect(isLegacyStudioSafetyFailure(message)).toBe(true);
  });

  it('does not hide a real provider outage behind the local retry path', () => {
    expect(
      isLegacyStudioSafetyFailure('OpenRouter gorsel servisine ulasilamadi.')
    ).toBe(false);
  });
});

describe('processNextStudioBatchItem lease and retry', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.itemFindFirst.mockResolvedValue({
      id: 'item-a',
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: null,
      leaseExpiresAt: null,
      batch: {
        id: 'batch-a',
        companyAccountId: 'company-a',
        createdByMemberId: 'member-a',
      },
    });
    mocks.itemUpdateMany.mockResolvedValue({ count: 1 });
    mocks.itemCount.mockResolvedValue(0);
    mocks.batchFindUnique.mockResolvedValue({
      companyAccountId: 'company-a',
      propertyId: 'property-a',
    });
    mocks.itemFindMany.mockResolvedValue([{ status: 'PENDING', errorMessage: null }]);
    mocks.batchUpdate.mockResolvedValue({ id: 'batch-a' });
  });

  it('claims a due item with a compare-and-set lease and injected clock', async () => {
    const processItem = vi.fn().mockResolvedValue({ id: 'item-a' });

    await processNextStudioBatchItem({
      now,
      workerId: 'worker-a',
      processItem,
    });

    expect(mocks.itemUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'item-a',
        status: 'PENDING',
        AND: [
          { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
          { OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] },
        ],
      },
      data: {
        status: 'PROCESSING',
        errorMessage: null,
        leaseOwner: 'worker-a',
        leaseExpiresAt: new Date('2026-08-04T12:15:00.000Z'),
        nextAttemptAt: null,
        lastAttemptAt: now,
        attemptCount: { increment: 1 },
      },
    });
    expect(processItem).toHaveBeenCalledWith(
      expect.objectContaining({ leaseOwner: 'worker-a' })
    );
  });

  it('requeues a transient failure using the same lease token', async () => {
    const processItem = vi.fn().mockRejectedValue(new Error('Geçici hata'));

    const result = await processNextStudioBatchItem({
      now,
      workerId: 'worker-a',
      processItem,
    });

    expect(mocks.itemUpdateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'item-a',
        status: 'PROCESSING',
        leaseOwner: 'worker-a',
      },
      data: expect.objectContaining({
        status: 'PENDING',
        nextAttemptAt: new Date('2026-08-04T12:00:30.000Z'),
        leaseOwner: null,
        leaseExpiresAt: null,
      }),
    });
    expect(result).toMatchObject({ ok: false, retryScheduled: true });
  });

  it('does nothing when another worker wins the claim', async () => {
    mocks.itemUpdateMany.mockResolvedValueOnce({ count: 0 });
    const processItem = vi.fn();

    const result = await processNextStudioBatchItem({
      now,
      workerId: 'worker-lost',
      processItem,
    });

    expect(result).toBeNull();
    expect(processItem).not.toHaveBeenCalled();
  });

  it('does not start a sixth image in the same batch', async () => {
    mocks.itemCount.mockResolvedValue(5);
    const processItem = vi.fn();

    const result = await processNextStudioBatchItem({
      now,
      workerId: 'worker-sixth',
      processItem,
    });

    expect(result).toBeNull();
    expect(mocks.itemUpdateMany).not.toHaveBeenCalled();
    expect(processItem).not.toHaveBeenCalled();
  });
});
