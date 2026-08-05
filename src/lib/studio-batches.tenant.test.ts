import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  mediaFindMany: vi.fn(),
  batchFindUnique: vi.fn(),
  batchCreate: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    crmPropertyMedia: { findMany: mocks.mediaFindMany },
    studioBatch: {
      findUnique: mocks.batchFindUnique,
      create: mocks.batchCreate,
    },
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
  PropertyMediaError: class PropertyMediaError extends Error {
    constructor(message: string, readonly status = 400) {
      super(message);
    }
  },
}));

vi.mock('@/lib/studio-image-engine', () => ({
  StudioImageError: class StudioImageError extends Error {},
  enhanceStudioImage: vi.fn(),
  resolveStudioImageEngine: vi.fn(() => 'REALISTIC'),
}));

import { createStudioBatch } from './studio-batches';

describe('createStudioBatch tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mediaFindMany.mockResolvedValue([]);
    mocks.batchFindUnique.mockResolvedValue(null);
  });

  it('rejects a media id that is not owned by the signed-in company', async () => {
    await expect(
      createStudioBatch({
        actor: { companyAccountId: 'company-a', memberId: 'member-a' },
        propertyId: 'property-a',
        mediaIds: ['foreign-media'],
        prompt: 'Doğal ışık düzeltme',
      })
    ).rejects.toThrow(/başka şirkete ait/i);

    expect(mocks.mediaFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ['foreign-media'] },
        companyAccountId: 'company-a',
        propertyId: 'property-a',
      }),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    expect(mocks.batchCreate).not.toHaveBeenCalled();
  });
});
