import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  mediaFindMany: vi.fn(),
  batchFindUnique: vi.fn(),
  batchCreate: vi.fn(),
  batchUpdate: vi.fn(),
  itemCreateMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    crmPropertyMedia: { findMany: mocks.mediaFindMany },
    studioBatch: {
      findUnique: mocks.batchFindUnique,
      create: mocks.batchCreate,
      update: mocks.batchUpdate,
    },
    studioBatchItem: { createMany: mocks.itemCreateMany },
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
  LOCAL_STUDIO_IMAGE_MODEL: 'studio-adaptive-photography-v2',
  StudioImageError: class StudioImageError extends Error {},
  enhanceStudioImage: vi.fn(),
  resolveStudioImageEngine: vi.fn(() => 'REALISTIC'),
  resolveStudioImageModelTier: vi.fn(() => 'STANDARD'),
}));

import { createStudioBatch } from './studio-batches';

describe('createStudioBatch tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mediaFindMany.mockResolvedValue([]);
    mocks.batchFindUnique.mockResolvedValue(null);
    mocks.batchCreate.mockResolvedValue({ id: 'batch-a' });
    mocks.batchUpdate.mockResolvedValue({ id: 'batch-a', status: 'PENDING', items: [] });
    mocks.itemCreateMany.mockResolvedValue({ count: 1 });
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

  it('creates every new enhancement batch with the fixed FLUX model', async () => {
    mocks.mediaFindMany.mockResolvedValue([
      {
        id: 'media-a',
        url: 'https://assets.test/media-a.jpg',
        storageKey: 'property/media-a.jpg',
        fileName: 'salon.jpg',
        mimeType: 'image/jpeg',
        width: 1600,
        height: 900,
        byteSize: 120_000,
      },
    ]);

    await createStudioBatch({
      actor: { companyAccountId: 'company-a', memberId: 'member-a' },
      propertyId: 'property-a',
      mediaIds: ['media-a'],
      prompt: 'Doğal emlak fotoğrafı',
      preset: 'creative-ai',
    });

    expect(mocks.batchCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'OPENROUTER',
        model: 'black-forest-labs/flux.2-klein-4b',
      }),
    });
  });
});
