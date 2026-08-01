import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  SAFE_STUDIO_RETRY_PROMPT,
  STABLE_IMAGE_ULTRA_ENDPOINT,
  StabilityUltraError,
  enhanceWithStableImageUltra,
  generateWithStableImageUltra,
} from './stability-ultra';
import {
  DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
  STUDIO_NEGATIVE_PROMPT,
} from './studio-enhancement';

describe('Stable Image Ultra studio enhancer', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.STABILITY_API_KEY;

  beforeEach(() => {
    process.env.STABILITY_API_KEY = 'sk-test-stability-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.STABILITY_API_KEY;
    else process.env.STABILITY_API_KEY = originalApiKey;
    vi.restoreAllMocks();
  });

  it('recreates the original image through Ultra with high transformation strength', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Uint8Array.from([255, 216, 255, 217]), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      })
    );
    global.fetch = fetchMock;

    const result = await enhanceWithStableImageUltra({
      image: Buffer.from([255, 216, 255, 217]),
      mimeType: 'image/jpeg',
      prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
    });

    expect(result).toMatchObject({
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(STABLE_IMAGE_ULTRA_ENDPOINT);
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer sk-test-stability-key',
      Accept: 'image/*',
    });

    const body = options.body as FormData;
    expect(body.get('prompt')).toBe(DEFAULT_STUDIO_ENHANCEMENT_PROMPT);
    expect(body.get('negative_prompt')).toBe(STUDIO_NEGATIVE_PROMPT);
    expect(body.get('strength')).toBe('0.82');
    expect(body.get('output_format')).toBe('jpeg');
    expect(body.get('image')).toBeInstanceOf(Blob);
  });

  it('supports poster-specific generation settings through the provider adapter', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Uint8Array.from([255, 216, 255, 217]), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      })
    );
    global.fetch = fetchMock;

    await generateWithStableImageUltra({
      image: Buffer.from([255, 216, 255, 217]),
      mimeType: 'image/jpeg',
      prompt: 'Create a polished real-estate hero image.',
      negativePrompt: 'text, watermark',
      strength: 0.55,
      clientUserId: 'company-123',
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.headers).toMatchObject({
      'stability-client-user-id': 'company-123',
    });

    const body = options.body as FormData;
    expect(body.get('prompt')).toBe(
      'Create a polished real-estate hero image.'
    );
    expect(body.get('negative_prompt')).toBe('text, watermark');
    expect(body.get('strength')).toBe('0.55');
  });

  it('uses the real image signature when the declared MIME type is wrong', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(Uint8Array.from([255, 216, 255, 217]), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      })
    );

    await generateWithStableImageUltra({
      image: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]),
      mimeType: 'image/jpeg',
      prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
      strength: 0.82,
    });

    const [, options] = vi.mocked(global.fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const image = (options.body as FormData).get('image');
    expect(image).toBeInstanceOf(File);
    expect((image as File).type).toBe('image/png');
    expect((image as File).name).toBe('property.png');
  });

  it('fails before making a request when STABILITY_API_KEY is missing', async () => {
    delete process.env.STABILITY_API_KEY;
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await expect(
      enhanceWithStableImageUltra({
        image: Buffer.from([255, 216, 255, 217]),
        mimeType: 'image/jpeg',
        prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
      })
    ).rejects.toMatchObject({
      code: 'MISSING_KEY',
      status: 503,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries a moderated prompt once with a short conservative prompt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            name: 'content_moderation',
            errors: ['Request was flagged'],
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(Uint8Array.from([255, 216, 255, 217]), {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        })
      );
    global.fetch = fetchMock;

    await expect(
      enhanceWithStableImageUltra({
        image: Buffer.from([255, 216, 255, 217]),
        mimeType: 'image/jpeg',
        prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
      })
    ).resolves.toMatchObject({
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(retryBody.get('prompt')).toBe(SAFE_STUDIO_RETRY_PROMPT);
    expect(retryBody.get('negative_prompt')).toBeNull();
    expect(retryBody.get('image')).toBeInstanceOf(Blob);
    expect(retryBody.get('strength')).toBe('0.82');
  });

  it('returns a content rejection only after the conservative retry is also moderated', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'content_moderation',
          errors: ['Request was flagged'],
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );
    global.fetch = fetchMock;

    await expect(
      enhanceWithStableImageUltra({
        image: Buffer.from([255, 216, 255, 217]),
        mimeType: 'image/jpeg',
        prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
      })
    ).rejects.toMatchObject({
      code: 'CONTENT_REJECTED',
      status: 422,
      providerStatus: 403,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      429,
      'RATE_LIMITED',
      'Stability AI şu anda yoğun',
    ],
    [
      413,
      'INVALID_IMAGE',
      'Görsel Stability AI sınırlarını aşıyor',
    ],
    [
      422,
      'INVALID_IMAGE',
      'Yüklenen görsel işlenemedi',
    ],
    [
      500,
      'PROVIDER_UNAVAILABLE',
      'görsel servisine şu anda ulaşılamıyor',
    ],
  ])(
    'maps provider status %i to a Turkish user-facing error',
    async (status, code, message) => {
      global.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ errors: ['provider detail'] }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      try {
        await enhanceWithStableImageUltra({
          image: Buffer.from([255, 216, 255, 217]),
          mimeType: 'image/jpeg',
          prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
        });
        throw new Error('Expected enhancer to fail');
      } catch (error) {
        expect(error).toBeInstanceOf(StabilityUltraError);
        expect(error).toMatchObject({ code });
        expect((error as Error).message).toContain(message);
      }
    }
  );

  it('rejects unsupported and empty images locally with a Turkish message', async () => {
    await expect(
      enhanceWithStableImageUltra({
        image: Buffer.alloc(0),
        mimeType: 'image/gif',
        prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
      })
    ).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
      status: 400,
    });
  });

  it('maps network failures to a safe provider error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('socket secret detail'));

    await expect(
      generateWithStableImageUltra({
        image: Buffer.from([255, 216, 255, 217]),
        mimeType: 'image/jpeg',
        prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
      })
    ).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
      status: 503,
    });
  });

  it('rejects unexpected image response types from the provider', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('<svg></svg>', {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      })
    );

    await expect(
      generateWithStableImageUltra({
        image: Buffer.from([255, 216, 255, 217]),
        mimeType: 'image/jpeg',
        prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
      })
    ).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
    });
  });
});
