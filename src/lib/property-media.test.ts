import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    crmProperty: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    crmPropertyMedia: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    crmActivity: {
      create: vi.fn(),
    },
    huntedListingImage: {
      findMany: vi.fn(),
    },
    studioBatch: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    studioBatchItem: {
      count: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    tx,
    transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)
    ),
  };
});

vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: mocks.transaction,
    crmProperty: mocks.tx.crmProperty,
    crmPropertyMedia: mocks.tx.crmPropertyMedia,
  },
}));

import {
  addPropertyMedia,
  archivePropertyMedia,
  assertOwnedProperty,
  attachStudioBatchItems,
  importHuntedListingMedia,
  updatePropertyMedia,
} from './property-media';

const actor = { companyAccountId: 'company-a', memberId: 'member-a' };
const property = {
  id: 'property-a',
  title: 'Sahil Villası',
  imageUrl: null,
  companyAccountId: 'company-a',
};

describe('property media tenant and lifecycle rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.crmProperty.findFirst.mockResolvedValue(property);
    mocks.tx.crmProperty.update.mockResolvedValue(property);
    mocks.tx.crmPropertyMedia.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.crmActivity.create.mockResolvedValue({ id: 'activity-a' });
  });

  it('portföy sahipliğini tenant filtresiyle doğrular', async () => {
    mocks.tx.crmProperty.findFirst.mockResolvedValueOnce(null);

    await expect(
      assertOwnedProperty(actor, 'foreign-property', mocks.tx as never)
    ).rejects.toMatchObject({ status: 404 });
    expect(mocks.tx.crmProperty.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'foreign-property',
        companyAccountId: 'company-a',
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
        companyAccountId: true,
      },
    });
  });

  it('yeni kapak seçildiğinde eski kapağı kaldırır ve legacy imageUrl alanını eşitler', async () => {
    mocks.tx.crmPropertyMedia.findFirst.mockResolvedValue({
      id: 'media-a',
      propertyId: 'property-a',
      companyAccountId: 'company-a',
      archivedAt: null,
      mediaType: 'PHOTO',
      variantType: 'ORIGINAL',
      url: 'https://blob.example/new-cover.jpg',
    });
    mocks.tx.crmPropertyMedia.update.mockResolvedValue({
      id: 'media-a',
      url: 'https://blob.example/new-cover.jpg',
      isCover: true,
    });

    await updatePropertyMedia(actor, 'property-a', 'media-a', {
      isCover: true,
    });

    expect(mocks.tx.crmPropertyMedia.updateMany).toHaveBeenCalledWith({
      where: {
        propertyId: 'property-a',
        archivedAt: null,
        isCover: true,
      },
      data: { isCover: false },
    });
    expect(mocks.tx.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'property-a' },
      data: { imageUrl: 'https://blob.example/new-cover.jpg' },
    });
  });

  it('iyileştirilmiş medyayı yalnız aynı tenant ve portföydeki orijinale bağlar', async () => {
    mocks.tx.crmPropertyMedia.count.mockResolvedValue(1);
    mocks.tx.crmPropertyMedia.findFirst
      .mockResolvedValueOnce({ id: 'cover-a' })
      .mockResolvedValueOnce({ id: 'original-a' });
    mocks.tx.crmPropertyMedia.findUnique.mockResolvedValue(null);
    mocks.tx.crmPropertyMedia.create.mockResolvedValue({
      id: 'enhanced-a',
      url: 'https://blob.example/enhanced.jpg',
    });

    await addPropertyMedia(actor, 'property-a', [
      {
        url: 'https://blob.example/enhanced.jpg',
        fileName: 'enhanced.jpg',
        mimeType: 'image/jpeg',
        source: 'STUDIO_ENHANCED',
        variantType: 'ENHANCED',
        parentMediaId: 'original-a',
      },
    ]);

    expect(mocks.tx.crmPropertyMedia.findFirst).toHaveBeenLastCalledWith({
      where: {
        id: 'original-a',
        propertyId: 'property-a',
        companyAccountId: 'company-a',
        archivedAt: null,
      },
      select: { id: true },
    });
    expect(mocks.tx.crmPropertyMedia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentMediaId: 'original-a',
        variantType: 'ENHANCED',
        source: 'STUDIO_ENHANCED',
        isCover: false,
      }),
    });
  });

  it('aynı fingerprint aktifken mükerrer medya ve aktivite üretmez', async () => {
    mocks.tx.crmPropertyMedia.count.mockResolvedValue(1);
    mocks.tx.crmPropertyMedia.findFirst.mockResolvedValue({ id: 'cover-a' });
    mocks.tx.crmPropertyMedia.findUnique.mockResolvedValue({
      id: 'media-existing',
      archivedAt: null,
    });

    const result = await addPropertyMedia(actor, 'property-a', [
      {
        url: 'https://blob.example/original.jpg',
        fileName: 'original.jpg',
        mimeType: 'image/jpeg',
        fingerprint: 'upload:abc',
      },
    ]);

    expect(result).toEqual([
      expect.objectContaining({ id: 'media-existing' }),
    ]);
    expect(mocks.tx.crmPropertyMedia.create).not.toHaveBeenCalled();
    expect(mocks.tx.crmActivity.create).not.toHaveBeenCalled();
  });

  it('arşivlenmiş aynı dosyayı yeniden yüklemede geri getirir', async () => {
    mocks.tx.crmPropertyMedia.count.mockResolvedValue(0);
    mocks.tx.crmPropertyMedia.findFirst.mockResolvedValue(null);
    mocks.tx.crmPropertyMedia.findUnique.mockResolvedValue({
      id: 'media-archived',
      archivedAt: new Date('2026-07-29T00:00:00.000Z'),
      mediaType: 'PHOTO',
      variantType: 'ORIGINAL',
      usageRightsStatus: 'UNVERIFIED',
      url: 'https://blob.example/restored.jpg',
    });
    mocks.tx.crmPropertyMedia.update.mockResolvedValue({
      id: 'media-archived',
      archivedAt: null,
      isCover: true,
      url: 'https://blob.example/restored.jpg',
    });

    await addPropertyMedia(actor, 'property-a', [
      {
        url: 'https://blob.example/restored.jpg',
        fileName: 'restored.jpg',
        mimeType: 'image/jpeg',
        fingerprint: 'upload:restore',
        usageRightsStatus: 'CONFIRMED',
      },
    ]);

    expect(mocks.tx.crmPropertyMedia.update).toHaveBeenCalledWith({
      where: { id: 'media-archived' },
      data: {
        archivedAt: null,
        sortOrder: 0,
        isCover: true,
        usageRightsStatus: 'CONFIRMED',
      },
    });
    expect(mocks.tx.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'property-a' },
      data: { imageUrl: 'https://blob.example/restored.jpg' },
    });
  });

  it('silme yerine soft archive uygular ve kapağı güvenli biçimde değiştirir', async () => {
    mocks.tx.crmPropertyMedia.findMany.mockResolvedValue([
      { id: 'old-cover', isCover: true },
    ]);
    mocks.tx.crmPropertyMedia.findFirst.mockResolvedValue({
      id: 'replacement',
      url: 'https://blob.example/replacement.jpg',
    });
    mocks.tx.crmPropertyMedia.update.mockResolvedValue({
      id: 'replacement',
      isCover: true,
    });

    await archivePropertyMedia(actor, 'property-a', ['old-cover']);

    expect(mocks.tx.crmPropertyMedia.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['old-cover'] } },
      data: { archivedAt: expect.any(Date), isCover: false },
    });
    expect(mocks.tx.crmPropertyMedia.update).toHaveBeenCalledWith({
      where: { id: 'replacement' },
      data: { isCover: true },
    });
    expect(mocks.tx.crmProperty.update).toHaveBeenCalledWith({
      where: { id: 'property-a' },
      data: { imageUrl: 'https://blob.example/replacement.jpg' },
    });
  });

  it('aynı Stüdyo sonucunu ikinci kez medya oluşturmadan döndürür', async () => {
    mocks.tx.studioBatch.findFirst.mockResolvedValue({
      id: 'batch-a',
      items: [
        {
          id: 'item-a',
          attachedMediaId: 'attached-a',
        },
      ],
    });
    mocks.tx.crmPropertyMedia.findFirst.mockResolvedValue({
      id: 'attached-a',
      propertyId: 'property-a',
      companyAccountId: 'company-a',
    });
    mocks.tx.studioBatchItem.count.mockResolvedValue(0);
    mocks.tx.studioBatch.update.mockResolvedValue({ id: 'batch-a' });

    const result = await attachStudioBatchItems({
      actor,
      batchId: 'batch-a',
      propertyId: 'property-a',
      itemIds: ['item-a'],
    });

    expect(result).toEqual([expect.objectContaining({ id: 'attached-a' })]);
    expect(mocks.tx.crmPropertyMedia.create).not.toHaveBeenCalled();
    expect(mocks.tx.crmActivity.create).not.toHaveBeenCalled();
  });

  it('Avcı medyasını doğrulanmamış hak durumuyla ve idempotent biçimde aktarır', async () => {
    const image = {
      id: 'hunter-image-a',
      sourceUrl: 'https://source.example/image.jpg',
      storageKey: 'https://blob.example/image.jpg',
      mimeType: 'image/jpeg',
      width: 1600,
      height: 1200,
      byteSize: 1234,
      order: 0,
    };
    const created = {
      id: 'hunter-media-a',
      url: image.storageKey,
      isCover: true,
    };
    mocks.tx.huntedListingImage.findMany.mockResolvedValue([image]);
    mocks.tx.crmPropertyMedia.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created)
      .mockResolvedValueOnce(created);
    mocks.tx.crmPropertyMedia.create.mockResolvedValue(created);

    await importHuntedListingMedia({
      tx: mocks.tx as never,
      actor,
      propertyId: 'property-a',
      huntedListingId: 'listing-a',
    });
    await importHuntedListingMedia({
      tx: mocks.tx as never,
      actor,
      propertyId: 'property-a',
      huntedListingId: 'listing-a',
    });

    expect(mocks.tx.crmPropertyMedia.create).toHaveBeenCalledTimes(1);
    expect(mocks.tx.crmPropertyMedia.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: 'HUNTER',
        variantType: 'ORIGINAL',
        usageRightsStatus: 'UNVERIFIED',
        fingerprint: 'hunter:hunter-image-a',
      }),
    });
  });
});
