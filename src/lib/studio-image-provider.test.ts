import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { StabilityUltraError } from './stability-ultra';
import {
  generateStudioPosterBackground,
  type StudioImageProvider,
} from './studio-image-provider';

const originalImage = Buffer.from([255, 216, 255, 217]);

function provider(
  generate: StudioImageProvider['generate']
): StudioImageProvider {
  return {
    id: 'stability',
    model: 'Stable Image Ultra',
    generate,
  };
}

describe('studio poster image provider orchestration', () => {
  it('returns the generated image when the configured provider succeeds', async () => {
    const generated = Buffer.from([137, 80, 78, 71]);
    const generate = vi.fn().mockResolvedValue({
      buffer: generated,
      mimeType: 'image/png',
      extension: 'png',
    });

    const result = await generateStudioPosterBackground(
      {
        image: originalImage,
        mimeType: 'image/jpeg',
        prompt: 'Real-estate image',
        negativePrompt: 'text',
        strength: 0.55,
        clientUserId: 'company-a',
      },
      provider(generate)
    );

    expect(result).toEqual({
      buffer: generated,
      mimeType: 'image/png',
      source: 'provider',
      provider: 'stability',
      model: 'Stable Image Ultra',
      fallbackUsed: false,
    });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        strength: 0.55,
        clientUserId: 'company-a',
      })
    );
  });

  it('returns the original canvas background when generation fails', async () => {
    const generate = vi
      .fn()
      .mockRejectedValue(
        new StabilityUltraError('RATE_LIMITED', 503, 429)
      );

    const result = await generateStudioPosterBackground(
      {
        image: originalImage,
        mimeType: 'image/jpeg',
        prompt: 'Real-estate image',
        negativePrompt: 'text',
        strength: 0.55,
      },
      provider(generate)
    );

    expect(result).toEqual({
      buffer: originalImage,
      mimeType: 'image/jpeg',
      source: 'canvas-fallback',
      provider: 'stability',
      model: 'Stable Image Ultra',
      fallbackUsed: true,
      fallbackCode: 'RATE_LIMITED',
    });
  });

  it('does not expose unexpected provider error details in fallback metadata', async () => {
    const generate = vi
      .fn()
      .mockRejectedValue(new Error('upstream response contains a secret'));

    const result = await generateStudioPosterBackground(
      {
        image: originalImage,
        mimeType: 'image/jpeg',
        prompt: 'Real-estate image',
      },
      provider(generate)
    );

    expect(result.fallbackCode).toBe('PROVIDER_UNAVAILABLE');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
