import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  findMany: vi.fn(),
  fetchOwnedMediaBytes: vi.fn(),
  callAI: vi.fn(),
  reserveGeneration: vi.fn(),
  completeGeneration: vi.fn(),
  failGeneration: vi.fn(),
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
vi.mock('@/lib/studio-poster-generation', () => {
  class StudioPosterGenerationError extends Error {
    constructor(
      message: string,
      public status = 400,
      public code = 'INVALID_REQUEST'
    ) {
      super(message);
    }
  }
  return {
    StudioPosterGenerationError,
    reserveStudioPosterGeneration: mocks.reserveGeneration,
    completeStudioPosterGenerationAttempt: mocks.completeGeneration,
    failStudioPosterGenerationAttempt: mocks.failGeneration,
    posterGenerationPayload: (generation: {
      id: string;
      regenerationCount: number;
      maxRegenerations: number;
    }) => ({
      id: generation.id,
      regenerationCount: generation.regenerationCount,
      maxRegenerations: generation.maxRegenerations,
      remainingRegenerations: Math.max(
        0,
        generation.maxRegenerations - generation.regenerationCount
      ),
    }),
  };
});
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
    mocks.reserveGeneration.mockResolvedValue({
      duplicate: false,
      attempt: { id: 'attempt-a', status: 'PROCESSING' },
      generation: {
        id: 'generation-a',
        regenerationCount: 0,
        maxRegenerations: 2,
      },
    });
    mocks.completeGeneration.mockResolvedValue({
      id: 'generation-a',
      regenerationCount: 0,
      maxRegenerations: 2,
    });
    mocks.failGeneration.mockResolvedValue(undefined);
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

  it('başka tenant generation kimliğini ücretli sağlayıcıdan önce reddeder', async () => {
    const { StudioPosterGenerationError } = await import(
      '@/lib/studio-poster-generation'
    );
    mocks.reserveGeneration.mockRejectedValue(
      new StudioPosterGenerationError(
        'Poster üretim kaydı bulunamadı.',
        404,
        'NOT_FOUND'
      )
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const form = new FormData();
    form.set(
      'photos',
      new File([new Uint8Array([255, 216, 255, 217])], 'property.jpg', {
        type: 'image/jpeg',
      })
    );
    form.set('mode', 'creative');
    form.set('generationAction', 'REGENERATE');
    form.set('generationId', 'foreign-generation');
    form.set('idempotencyKey', 'request-0000000002');

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/poster', {
        method: 'POST',
        body: form,
      })
    );

    expect(response.status).toBe(404);
    expect(mocks.reserveGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        companyAccountId: 'company-a',
        generationId: 'foreign-generation',
      })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('aynı idempotency anahtarını ikinci kez üretmeden tamamlanmış kabul eder', async () => {
    mocks.reserveGeneration.mockResolvedValue({
      duplicate: true,
      attempt: { id: 'attempt-a', status: 'SUCCEEDED' },
      generation: {
        id: 'generation-a',
        regenerationCount: 1,
        maxRegenerations: 2,
      },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const form = new FormData();
    form.set(
      'photos',
      new File([new Uint8Array([255, 216, 255, 217])], 'property.jpg', {
        type: 'image/jpeg',
      })
    );
    form.set('mode', 'creative');
    form.set('generationAction', 'REGENERATE');
    form.set('generationId', 'generation-a');
    form.set('idempotencyKey', 'request-0000000003');

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/poster', {
        method: 'POST',
        body: form,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      idempotent: true,
      alreadyCompleted: true,
      generation: {
        id: 'generation-a',
        remainingRegenerations: 1,
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mocks.completeGeneration).not.toHaveBeenCalled();
  });

  it('sunucu limitine gelince Stability isteği göndermeden 409 döner', async () => {
    const { StudioPosterGenerationError } = await import(
      '@/lib/studio-poster-generation'
    );
    mocks.reserveGeneration.mockRejectedValue(
      new StudioPosterGenerationError(
        'Bu poster için iki yeniden üretim hakkı kullanıldı.',
        409,
        'REGENERATION_LIMIT_REACHED'
      )
    );
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const form = new FormData();
    form.set(
      'photos',
      new File([new Uint8Array([255, 216, 255, 217])], 'property.jpg', {
        type: 'image/jpeg',
      })
    );
    form.set('mode', 'creative');
    form.set('generationAction', 'REGENERATE');
    form.set('generationId', 'generation-a');
    form.set('idempotencyKey', 'request-0000000004');

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/poster', {
        method: 'POST',
        body: form,
      })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: 'REGENERATION_LIMIT_REACHED',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
