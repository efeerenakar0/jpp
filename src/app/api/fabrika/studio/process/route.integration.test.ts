import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  requireFabrikaPrincipal: vi.fn(),
  enhanceWithOpenRouterFluxKlein: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({
  FabrikaSessionError: class FabrikaSessionError extends Error {},
  requireFabrikaPrincipal: mocks.requireFabrikaPrincipal,
}));

vi.mock('@/lib/openrouter-studio-image', () => ({
  OpenRouterStudioImageError: class OpenRouterStudioImageError extends Error {
    constructor(
      readonly code: string,
      readonly status: number
    ) {
      super(code);
    }
  },
  enhanceWithOpenRouterFluxKlein: mocks.enhanceWithOpenRouterFluxKlein,
}));

vi.mock('@/lib/studio-enhancement', () => ({
  DEFAULT_STUDIO_ENHANCEMENT_PROMPT: 'Varsayılan iyileştirme talimatı',
}));

import { POST } from './route';

describe('POST /api/fabrika/studio/process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireFabrikaPrincipal.mockResolvedValue({
      type: 'OWNER',
      account: { id: 'company-a' },
      member: null,
    });
    mocks.enhanceWithOpenRouterFluxKlein.mockResolvedValue({
      buffer: Buffer.from([255, 216, 255, 217]),
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('görseli aynı multipart isteğinde işler ve sonucu doğrudan döndürür', async () => {
    const formData = new FormData();
    formData.set(
      'photo',
      new File([Uint8Array.from([255, 216, 255, 217])], 'salon.png', {
        type: 'image/png',
      })
    );
    formData.set('prompt', 'Işığı doğal biçimde düzelt.');

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/process', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(
      decodeURIComponent(response.headers.get('x-studio-file-name') || '')
    ).toBe('salon_AI_iyilestirilmis.jpg');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      Uint8Array.from([255, 216, 255, 217])
    );
    expect(mocks.enhanceWithOpenRouterFluxKlein).toHaveBeenCalledWith({
      image: Buffer.from([255, 216, 255, 217]),
      mimeType: 'image/png',
      prompt: 'Işığı doğal biçimde düzelt.',
    });
  });

  it('görsel bulunmadığında kullanıcı dostu hata döndürür', async () => {
    const formData = new FormData();
    formData.set('prompt', 'Işığı doğal biçimde düzelt.');

    const response = await POST(
      new Request('https://app.test/api/fabrika/studio/process', {
        method: 'POST',
        body: formData,
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'INVALID_IMAGE',
      error: expect.stringContaining('fotoğraf'),
    });
    expect(mocks.enhanceWithOpenRouterFluxKlein).not.toHaveBeenCalled();
  });
});
