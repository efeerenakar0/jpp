import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  assertOwnedProperty: vi.fn(),
  addPropertyMedia: vi.fn(),
  persistGeneratedMedia: vi.fn(),
  validatePropertyMediaFiles: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    crmPropertyMedia: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock('@/lib/media-storage', () => ({
  persistGeneratedMedia: mocks.persistGeneratedMedia,
  validatePropertyMediaFiles: mocks.validatePropertyMediaFiles,
}));

vi.mock('@/lib/property-media', () => ({
  PropertyMediaError: class PropertyMediaError extends Error {
    constructor(
      message: string,
      public status = 400
    ) {
      super(message);
    }
  },
  assertOwnedProperty: mocks.assertOwnedProperty,
  addPropertyMedia: mocks.addPropertyMedia,
}));

vi.mock('@/lib/property-media-http', () => ({
  propertyMediaHttpError: (error: unknown) =>
    Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Beklenmeyen hata.',
      },
      {
        status:
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          typeof error.status === 'number'
            ? error.status
            : 500,
      }
    ),
}));

import { POST } from './route';

function posterRequest(mediaIds: string[] = []) {
  const form = new FormData();
  form.set('propertyId', 'property-a');
  form.set(
    'poster',
    new File([new Uint8Array([255, 216, 255, 217])], 'poster.jpg', {
      type: 'image/jpeg',
    })
  );
  form.set('mode', 'faithful');
  form.set('mediaIdsJson', JSON.stringify(mediaIds));
  return new Request('https://app.test/api/fabrika/studio/poster/save', {
    method: 'POST',
    body: form,
  });
}

describe('POST /api/fabrika/studio/poster/save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      account: { id: 'company-a' },
      member: { id: 'member-a' },
    });
    mocks.assertOwnedProperty.mockResolvedValue({ id: 'property-a' });
    mocks.findFirst.mockResolvedValue(null);
    mocks.persistGeneratedMedia.mockResolvedValue({
      url: 'https://blob.example/poster.jpg',
      storageKey: 'property-media/company-a/property-a/poster.jpg',
      fileName: 'poster.jpg',
      mimeType: 'image/jpeg',
      byteSize: 4,
      checksum: 'checksum-a',
    });
    mocks.addPropertyMedia.mockResolvedValue([
      { id: 'poster-media-a', url: 'https://blob.example/poster.jpg' },
    ]);
  });

  it('kaynak doğrulanmamışsa poster kullanım hakkını otomatik onaylamaz', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'source-a', usageRightsStatus: 'UNVERIFIED' },
    ]);

    const response = await POST(posterRequest(['source-a']));

    expect(response.status).toBe(200);
    expect(mocks.addPropertyMedia).toHaveBeenCalledWith(
      {
        companyAccountId: 'company-a',
        memberId: 'member-a',
      },
      'property-a',
      [
        expect.objectContaining({
          usageRightsStatus: 'UNVERIFIED',
          parentMediaId: 'source-a',
        }),
      ],
      expect.any(Object)
    );
  });

  it('kısıtlı kaynağı Blob yazmadan reddeder', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'source-a', usageRightsStatus: 'RESTRICTED' },
    ]);

    const response = await POST(posterRequest(['source-a']));

    expect(response.status).toBe(403);
    expect(mocks.persistGeneratedMedia).not.toHaveBeenCalled();
    expect(mocks.addPropertyMedia).not.toHaveBeenCalled();
  });

  it('aynı fingerprint ile yeniden kaydetmeyi idempotent tamamlar', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'source-a', usageRightsStatus: 'CONFIRMED' },
    ]);
    mocks.findFirst.mockResolvedValue({
      id: 'poster-existing',
      fingerprint: 'poster:existing',
    });

    const response = await POST(posterRequest(['source-a']));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      idempotent: true,
      media: { id: 'poster-existing' },
    });
    expect(mocks.persistGeneratedMedia).not.toHaveBeenCalled();
  });
});
