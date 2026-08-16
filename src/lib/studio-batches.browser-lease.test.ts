import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  itemFindFirst: vi.fn(),
  itemCount: vi.fn(),
  itemUpdateMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    studioBatchItem: {
      findFirst: mocks.itemFindFirst,
    },
    $transaction: vi.fn(async (callback) =>
      callback({
        $queryRaw: mocks.queryRaw,
        studioBatchItem: {
          count: mocks.itemCount,
          updateMany: mocks.itemUpdateMany,
        },
      })
    ),
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

import { processStudioBatchItem } from './studio-batches';

describe('processStudioBatchItem browser lease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.itemFindFirst.mockResolvedValue({
      id: 'item-a',
      batchId: 'batch-a',
      status: 'PENDING',
      outputUrl: null,
      leaseOwner: null,
      batch: {
        id: 'batch-a',
        companyAccountId: 'company-a',
        startedAt: null,
      },
    });
    mocks.itemCount.mockResolvedValue(5);
  });

  it('casts the PostgreSQL void advisory-lock result before Prisma deserializes it', async () => {
    await expect(
      processStudioBatchItem({
        actor: { companyAccountId: 'company-a', memberId: 'member-a' },
        batchId: 'batch-a',
        itemId: 'item-a',
      })
    ).rejects.toThrow('Ayni anda en fazla 5 fotograf islenebilir.');

    expect(mocks.queryRaw).toHaveBeenCalledOnce();
    const queryParts = mocks.queryRaw.mock.calls[0]?.[0] as TemplateStringsArray;
    expect(queryParts.join('?')).toContain('pg_advisory_xact_lock');
    expect(queryParts.join('?')).toContain('::text');
  });
});
