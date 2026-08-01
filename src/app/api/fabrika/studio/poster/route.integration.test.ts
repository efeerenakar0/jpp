import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  findMany: vi.fn(),
  fetchOwnedMediaBytes: vi.fn(),
  callAI: vi.fn(),
  generateStudioPosterBackground: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  FabrikaForbiddenError: class FabrikaForbiddenError extends Error {},
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    crmPropertyMedia: { findMany: mocks.findMany },
    crmProperty: { findMany: vi.fn(), findFirst: vi.fn() },
    companyAccount: { update: vi.fn() },
  },
}));

vi.mock('@/lib/media-storage', () => ({
  MediaValidationError: class MediaValidationError extends Error {
    status = 400;
  },
  fetchOwnedMediaBytes: mocks.fetchOwnedMediaBytes,
}));

vi.mock('@/lib/ai', () => ({ callAI: mocks.callAI }));
vi.mock('@/lib/studio-image-provider', () => ({
  generateStudioPosterBackground: mocks.generateStudioPosterBackground,
}));
vi.mock('@/lib/stability-ultra', () => ({
  STUDIO_IMAGE_TO_IMAGE_STRENGTH: 0.82,
}));
vi.mock('@/lib/property-media-http', () => ({
  propertyMediaHttpError: (error: unknown) =>
    Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Poster oluşturulamadı.',
      },
      { status: 500 }
    ),
}));

import { POST } from './route';

describe('POST /api/fabrika/studio/poster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      account: {
        id: 'company-a',
        companyName: 'Jasmine',
        brandLogoData: null,
      },
      member: null,
      permissions: { canManageSecrets: true },
    });
  });

  it('başka tenant veya portföye ait mediaIds kullanımını reddeder', async () => {
    mocks.findMany.mockResolvedValue([]);
    const form = new FormData();
    form.set('propertyId', 'property-a');
    form.set('mediaIdsJson', JSON.stringify(['foreign-media']));

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/poster', {
        method: 'POST',
        body: form,
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ['foreign-media'] },
        companyAccountId: 'company-a',
        propertyId: 'property-a',
      }),
    });
    expect(mocks.fetchOwnedMediaBytes).not.toHaveBeenCalled();
  });

  it('portföy medyasını istemcide File nesnesine çevirmeden sunucuda kullanır', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 'media-a',
        url: 'https://blob.example/property-a.jpg',
        fileName: 'property-a.jpg',
      },
    ]);
    mocks.fetchOwnedMediaBytes.mockResolvedValue({
      bytes: Buffer.from([255, 216, 255, 217]),
      mimeType: 'image/jpeg',
    });
    const form = new FormData();
    form.set('propertyId', 'property-a');
    form.set('mediaIdsJson', JSON.stringify(['media-a']));
    form.set('sourceOrderJson', JSON.stringify(['media:media-a']));
    form.set('heroKey', 'media:media-a');
    form.set('mode', 'faithful');

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/poster', {
        method: 'POST',
        body: form,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      mode: 'faithful',
      usedMediaIds: ['media-a'],
      heroKey: 'media:media-a',
    });
    expect(mocks.fetchOwnedMediaBytes).toHaveBeenCalledWith(
      'https://blob.example/property-a.jpg',
      { maxBytes: 9 * 1024 * 1024 }
    );
  });

  it('geçersiz manuel dosya türünü sağlayıcıya göndermeden reddeder', async () => {
    const form = new FormData();
    form.set(
      'photos',
      new File([new Uint8Array([1, 2, 3])], 'payload.svg', {
        type: 'image/svg+xml',
      })
    );

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/poster', {
        method: 'POST',
        body: form,
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.fetchOwnedMediaBytes).not.toHaveBeenCalled();
  });
});
