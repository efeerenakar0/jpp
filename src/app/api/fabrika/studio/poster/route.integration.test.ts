import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  findMany: vi.fn(),
  findProperty: vi.fn(),
  findSettings: vi.fn(),
  fetchOwnedMediaBytes: vi.fn(),
  publishReference: vi.fn(),
  deleteReferences: vi.fn(),
  persistStudioPosterOutput: vi.fn(),
  callAI: vi.fn(),
  generateBannerbearPoster: vi.fn(),
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
    crmProperty: { findMany: vi.fn(), findFirst: mocks.findProperty },
    companySettings: { findUnique: mocks.findSettings },
    companyAccount: { update: vi.fn() },
  },
}));

vi.mock('@/lib/media-storage', () => ({
  MediaValidationError: class MediaValidationError extends Error {
    status = 400;
  },
  fetchOwnedMediaBytes: mocks.fetchOwnedMediaBytes,
  publishStudioPosterReference: mocks.publishReference,
  deleteStudioPosterReferences: mocks.deleteReferences,
  persistStudioPosterOutput: mocks.persistStudioPosterOutput,
}));

vi.mock('@/lib/ai', () => ({ callAI: mocks.callAI }));
vi.mock('@/lib/bannerbear-poster', () => {
  class BannerbearPosterError extends Error {
    constructor(
      message: string,
      public code: string,
      public status = 502
    ) {
      super(message);
    }
  }
  return {
    BannerbearPosterError,
    generateBannerbearPoster: mocks.generateBannerbearPoster,
  };
});
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

import { BannerbearPosterError } from '@/lib/bannerbear-poster';
import { POST } from './route';

describe('POST /api/fabrika/studio/poster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      account: {
        id: 'company-a',
        companyName: 'Jasmine',
        ownerPhone: '+905559998877',
        brandLogoData:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z9WQAAAAASUVORK5CYII=',
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
    mocks.findProperty.mockResolvedValue({
      id: 'property-a',
      title: 'Alanya Deniz Manzaralı Villa',
      location: 'Antalya / Alanya / Mahmutlar',
      price: 9_300_000,
      roomCount: '3+1',
      propertyType: 'Villa',
      area: 180,
      listingType: 'SALE',
      description: 'Özel havuzlu ve deniz manzaralı.',
    });
    mocks.findSettings.mockResolvedValue({
      contactPhone: '0555 123 45 67',
    });
    mocks.callAI.mockResolvedValue({
      content: JSON.stringify({
        headline: 'Alanya Deniz Manzaralı Villa',
        summary: 'Özel havuzlu ve deniz manzaralı.',
        callToAction: 'Bilgi ve randevu için iletişime geçin',
      }),
    });
    mocks.publishReference.mockResolvedValue({
      url: 'https://blob.example/temp-reference.jpg',
      storageKey: 'studio-poster-references/company-a/attempt-a/temp.jpg',
    });
    mocks.deleteReferences.mockResolvedValue(undefined);
    mocks.generateBannerbearPoster.mockResolvedValue({
      buffer: Buffer.from([255, 216, 255, 217]),
      providerRequestId: 'bannerbear-image-a',
      templateUid: 'PaB8NZzp69wGjnMxKm',
      templateName: 'Siyah Altın · Klasik',
    });
    mocks.persistStudioPosterOutput.mockResolvedValue({
      url: 'https://blob.example/studio-posters/poster-a.jpg',
      storageKey: 'studio-posters/company-a/generation-a/poster-a.jpg',
      mimeType: 'image/jpeg',
      byteSize: 4,
      checksum: 'stored-poster-sha256',
    });
    process.env.BANNERBEAR_API_KEY = 'test-bannerbear-key';
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

  it('seçilen fotoğrafı, logo ve doğrulanmış veritabanı bilgileriyle Bannerbear şablonuna gönderir', async () => {
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
      mode: 'creative',
      posterUrl: 'https://blob.example/studio-posters/poster-a.jpg',
      posterDataUrl: 'https://blob.example/studio-posters/poster-a.jpg',
      requiresTextReview: false,
      providerCostUsd: 0,
      providerRequestId: 'bannerbear-image-a',
      templateUid: 'PaB8NZzp69wGjnMxKm',
      usedMediaIds: ['media-a'],
      heroKey: 'media:media-a',
    });
    expect(mocks.fetchOwnedMediaBytes).toHaveBeenCalledWith(
      'https://blob.example/property-a.jpg',
      { maxBytes: 9 * 1024 * 1024 }
    );
    expect(mocks.generateBannerbearPoster).toHaveBeenCalledTimes(1);
    const posterRequest = mocks.generateBannerbearPoster.mock.calls[0][0] as {
      imageUrls: string[];
      logoUrl: string;
      facts: Record<string, string | string[]>;
      format: string;
      apiKey: string;
      templateUid: string;
    };
    expect(posterRequest.format).toBe('post');
    expect(posterRequest.apiKey).toBe('test-bannerbear-key');
    expect(posterRequest.templateUid).toBe('PaB8NZzp69wGjnMxKm');
    expect(posterRequest.imageUrls).toEqual([
      'https://blob.example/property-a.jpg',
    ]);
    expect(posterRequest.logoUrl).toBe(
      'https://blob.example/temp-reference.jpg'
    );
    expect(posterRequest.facts).toMatchObject({
      companyName: 'Jasmine',
      headline: 'Alanya Deniz Manzaralı Villa',
      summary: 'Özel havuzlu ve deniz manzaralı.',
      price: '9.300.000 TL',
      location: 'Antalya / Alanya',
      roomCount: '3+1',
      area: '180',
      contactPhone: '+90 555 123 45 67',
    });
    expect(mocks.persistStudioPosterOutput).toHaveBeenCalledWith({
      companyAccountId: 'company-a',
      generationId: 'generation-a',
      attemptId: 'attempt-a',
      bytes: Buffer.from([255, 216, 255, 217]),
      format: 'post',
    });
    expect(mocks.completeGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        resultDigest: 'stored-poster-sha256',
        outputUrl: 'https://blob.example/studio-posters/poster-a.jpg',
        outputStorageKey:
          'studio-posters/company-a/generation-a/poster-a.jpg',
        providerCostUsd: 0,
        providerRequestId: 'bannerbear-image-a',
      })
    );
    expect(mocks.deleteReferences).toHaveBeenCalledWith([
      'studio-poster-references/company-a/attempt-a/temp.jpg',
    ]);
  });

  it('otomatik görünümde geçersiz şablonu farklı gerçek bir düzenle yeniden dener', async () => {
    mocks.generateBannerbearPoster
      .mockRejectedValueOnce(
        new BannerbearPosterError(
          'İlk şablon geçerli bir görsel döndürmedi.',
          'INVALID_PROVIDER_RESPONSE',
          502
        )
      )
      .mockResolvedValueOnce({
        buffer: Buffer.from([255, 216, 255, 217]),
        providerRequestId: 'bannerbear-image-b',
        templateUid: 'second-template',
        templateName: 'İkinci gerçek düzen',
      });
    const form = new FormData();
    form.set(
      'photos',
      new File([new Uint8Array([255, 216, 255, 217])], 'property.jpg', {
        type: 'image/jpeg',
      })
    );
    form.set('mode', 'creative');
    form.set('automaticStyle', 'true');
    form.set('idempotencyKey', 'request-auto-rotation-0001');

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/poster', {
        method: 'POST',
        body: form,
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.generateBannerbearPoster).toHaveBeenCalledTimes(2);
    const first = mocks.generateBannerbearPoster.mock.calls[0][0] as {
      presetId: string;
      templateUid: string;
    };
    const second = mocks.generateBannerbearPoster.mock.calls[1][0] as {
      presetId: string;
      templateUid: string;
    };
    expect(second.presetId).not.toBe(first.presetId);
    expect(second.templateUid).not.toBe(first.templateUid);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      providerRequestId: 'bannerbear-image-b',
      presetId: second.presetId,
      templateUid: second.templateUid,
    });
  });

  it('portföyde bulunmayan alanları Bannerbear alanlarına eklemez', async () => {
    mocks.callAI.mockRejectedValueOnce(new Error('copy model unavailable'));
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      account: {
        id: 'company-a',
        companyName: 'Jasmine',
        ownerPhone: null,
        brandLogoData: null,
      },
      member: null,
      permissions: { canManageSecrets: true },
    });
    mocks.findSettings.mockResolvedValue(null);
    mocks.findProperty.mockResolvedValue({
      id: 'property-a',
      title: 'Yeni Portföy',
      location: null,
      price: null,
      roomCount: null,
      propertyType: null,
      area: null,
      listingType: 'SALE',
      description: null,
    });
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

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/poster', {
        method: 'POST',
        body: form,
      })
    );

    expect(response.status).toBe(200);
    const request = mocks.generateBannerbearPoster.mock.calls[0][0] as {
      facts: Record<string, string>;
      imageUrls: string[];
      logoUrl: string | null;
    };
    expect(request.facts.headline).toBe('Yeni Portföy');
    expect(request.facts.price).toBe('');
    expect(request.facts.location).toBe('');
    expect(request.facts.roomCount).toBe('');
    expect(request.facts.area).toBe('');
    expect(request.facts.contactPhone).toBe('');
    expect(request.logoUrl).toBeNull();
    expect(request.imageUrls).toEqual(['https://blob.example/property-a.jpg']);
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
      attempt: {
        id: 'attempt-a',
        status: 'SUCCEEDED',
        outputUrl: 'https://blob.example/studio-posters/existing.jpg',
        providerCostUsd: 0.014,
        providerRequestId: 'generation-openrouter-existing',
      },
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
      posterUrl: 'https://blob.example/studio-posters/existing.jpg',
      posterDataUrl: 'https://blob.example/studio-posters/existing.jpg',
      providerCostUsd: 0.014,
      generation: {
        id: 'generation-a',
        remainingRegenerations: 1,
      },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mocks.completeGeneration).not.toHaveBeenCalled();
    expect(mocks.persistStudioPosterOutput).not.toHaveBeenCalled();
  });

  it('sunucu limitine gelince Bannerbear isteği göndermeden 409 döner', async () => {
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
    expect(mocks.generateBannerbearPoster).not.toHaveBeenCalled();
  });

  it('ücretli üretimden sonra dosya kaydı başarısız olursa sonucu tamamlanmış saymaz', async () => {
    mocks.persistStudioPosterOutput.mockRejectedValue(
      new Error('blob temporarily unavailable')
    );
    const form = new FormData();
    form.set(
      'photos',
      new File([new Uint8Array([255, 216, 255, 217])], 'property.jpg', {
        type: 'image/jpeg',
      })
    );
    form.set('mode', 'creative');
    form.set('idempotencyKey', 'request-0000000015');

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/poster', {
        method: 'POST',
        body: form,
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'POSTER_STORAGE_FAILED',
    });
    expect(mocks.generateBannerbearPoster).toHaveBeenCalledTimes(1);
    expect(mocks.completeGeneration).not.toHaveBeenCalled();
    expect(mocks.failGeneration).toHaveBeenCalledWith({
      companyAccountId: 'company-a',
      attemptId: 'attempt-a',
      failureCode: 'POSTER_STORAGE_FAILED',
    });
  });
});
