import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { OpenRouterStudioImageError } from './openrouter-studio-image';

import {
  MAX_STUDIO_IMAGE_BYTES,
  StudioImageError,
  analyseStudioImage,
  enhanceStudioImage,
  resolveStudioImageEngine,
} from './studio-image-engine';

const ANIMATED_WEBP = Buffer.from(
  'UklGRsIAAABXRUJQVlA4WAoAAAACAAAADwAADwAAQU5JTQYAAAD/////AABBTk1GSAAAAAAAAAAAAA8AAA8AAMgAAAJWUDggMAAAANABAJ0BKhAAEAABQCYloAJ0ugH4AAOwAP7zaZf+YJl0XXN7/9HG/S4P0cb/0XAAAEFOTUZGAAAAAAAAAAAADwAADwAAyAAAAFZQOCAuAAAAtAEAnQEqEAAQAAAAJiWgAnS6AAQwAAD++1Xj/6XB/9Lg/+lwf+lwfoUbKJfMAA==',
  'base64'
);

async function passthroughRealisticProvider(input: { image: Buffer }) {
  const output = await sharp(input.image)
    .rotate()
    .flatten({ background: '#ffffff' })
    .toColourspace('srgb')
    .jpeg()
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: output.data,
    mimeType: 'image/jpeg' as const,
    extension: 'jpg' as const,
    width: output.info.width,
    height: output.info.height,
    model: 'openai/gpt-image-1-mini' as const,
  };
}

async function luminanceCorrelation(first: Buffer, second: Buffer) {
  const sample = async (image: Buffer) =>
    sharp(image)
      .resize({ width: 96, height: 60, fit: 'fill' })
      .greyscale()
      .normalise()
      .raw()
      .toBuffer();
  const [left, right] = await Promise.all([sample(first), sample(second)]);
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftPower = 0;
  let rightPower = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] - leftMean;
    const rightValue = right[index] - rightMean;
    numerator += leftValue * rightValue;
    leftPower += leftValue ** 2;
    rightPower += rightValue ** 2;
  }
  return numerator / Math.sqrt(leftPower * rightPower);
}

describe('studio image engine selection', () => {
  it('uses deterministic REALISTIC processing unless creative AI is explicit', () => {
    expect(resolveStudioImageEngine()).toBe('REALISTIC');
    expect(resolveStudioImageEngine('professional-camera')).toBe('REALISTIC');
    expect(resolveStudioImageEngine('custom')).toBe('REALISTIC');
    expect(resolveStudioImageEngine('creative-ai')).toBe('CREATIVE');
  });

  it('maps persisted model IDs to the correct processing tier', async () => {
    const { resolveStudioImageModelTier } = await import('./studio-image-engine');
    expect(resolveStudioImageModelTier('openai/gpt-image-1-mini')).toBe('STANDARD');
    expect(resolveStudioImageModelTier('studio-adaptive-photography-v2')).toBe(
      'STANDARD'
    );
    expect(resolveStudioImageModelTier('openai/gpt-image-2')).toBe('PREMIUM');
    expect(
      resolveStudioImageModelTier('black-forest-labs/flux.2-klein-4b')
    ).toBe('FLUX');
    expect(resolveStudioImageModelTier('unknown')).toBe('STANDARD');
  });
});

describe('enhanceStudioImage REALISTIC', () => {
  it('analyses each image before choosing exposure and contrast recovery', async () => {
    const dark = await sharp({
      create: {
        width: 96,
        height: 96,
        channels: 3,
        background: { r: 32, g: 36, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();

    await expect(analyseStudioImage(dark, 'image/jpeg')).resolves.toMatchObject({
      needsShadowRecovery: true,
      needsHighlightRecovery: false,
      needsContrastRecovery: true,
      adjustments: {
        shadowRecovery: true,
      },
    });
  });

  it('creates different correction recipes for dark and bright photos', async () => {
    const dark = await sharp({
      create: {
        width: 96,
        height: 96,
        channels: 3,
        background: { r: 35, g: 38, b: 42 },
      },
    })
      .jpeg()
      .toBuffer();
    const bright = await sharp({
      create: {
        width: 96,
        height: 96,
        channels: 3,
        background: { r: 248, g: 246, b: 242 },
      },
    })
      .jpeg()
      .toBuffer();

    const darkAnalysis = await analyseStudioImage(dark, 'image/jpeg');
    const brightAnalysis = await analyseStudioImage(bright, 'image/jpeg');

    expect(darkAnalysis.adjustments.brightness).toBeGreaterThan(1);
    expect(brightAnalysis.adjustments.brightness).toBeLessThan(1);
    expect(darkAnalysis.adjustments).not.toEqual(brightAnalysis.adjustments);
  });

  it('uses conservative per-channel gains for a strong colour cast', async () => {
    const warm = await sharp({
      create: {
        width: 96,
        height: 96,
        channels: 3,
        background: { r: 190, g: 125, b: 75 },
      },
    })
      .jpeg()
      .toBuffer();

    const analysis = await analyseStudioImage(warm, 'image/jpeg');

    expect(analysis.colourCast).toBeGreaterThan(0.07);
    expect(analysis.adjustments.redGain).toBeLessThan(1);
    expect(analysis.adjustments.blueGain).toBeGreaterThan(1);
    expect(analysis.adjustments.redGain).toBeGreaterThanOrEqual(0.96);
    expect(analysis.adjustments.blueGain).toBeLessThanOrEqual(1.04);
  });

  it('keeps the original frame while producing distinct outputs per photo', async () => {
    const dark = await sharp({
      create: {
        width: 160,
        height: 100,
        channels: 3,
        background: { r: 42, g: 50, b: 58 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 80,
              height: 50,
              channels: 3,
              background: { r: 85, g: 95, b: 105 },
            },
          })
            .png()
            .toBuffer(),
          left: 40,
          top: 25,
        },
      ])
      .jpeg()
      .toBuffer();
    const bright = await sharp({
      create: {
        width: 160,
        height: 100,
        channels: 3,
        background: { r: 235, g: 226, b: 205 },
      },
    })
      .composite([
        {
          input: await sharp({
            create: {
              width: 80,
              height: 50,
              channels: 3,
              background: { r: 205, g: 195, b: 178 },
            },
          })
            .png()
            .toBuffer(),
          left: 40,
          top: 25,
        },
      ])
      .jpeg()
      .toBuffer();
    const darkResult = await enhanceStudioImage({
      engine: 'REALISTIC',
      image: dark,
      mimeType: 'image/jpeg',
      prompt: 'Doğal kalite artışı.',
      realisticProvider: passthroughRealisticProvider,
    });
    const brightResult = await enhanceStudioImage({
      engine: 'REALISTIC',
      image: bright,
      mimeType: 'image/jpeg',
      prompt: 'Doğal kalite artışı.',
      realisticProvider: passthroughRealisticProvider,
    });

    expect(darkResult).toMatchObject({ width: 160, height: 100 });
    expect(brightResult).toMatchObject({ width: 160, height: 100 });
    expect(darkResult.analysis?.adjustments.brightness).toBeGreaterThan(1);
    expect(brightResult.analysis?.adjustments.brightness).toBeLessThan(1);
    expect(darkResult.buffer.equals(brightResult.buffer)).toBe(false);
    expect(await luminanceCorrelation(dark, darkResult.buffer)).toBeGreaterThan(0.9);
  });

  it('auto-orients EXIF photos while preserving their physical dimensions', async () => {
    const input = await sharp({
      create: {
        width: 12,
        height: 8,
        channels: 3,
        background: { r: 90, g: 110, b: 130 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const result = await enhanceStudioImage({
      engine: 'REALISTIC',
      image: input,
      mimeType: 'image/jpeg',
      prompt: 'Mimariyi değiştirmeden ışığı düzelt.',
      realisticProvider: passthroughRealisticProvider,
    });
    const metadata = await sharp(result.buffer).metadata();

    expect(result).toMatchObject({
      mimeType: 'image/jpeg',
      extension: 'jpg',
      width: 8,
      height: 12,
      engine: 'REALISTIC',
    });
    expect(metadata).toMatchObject({ width: 8, height: 12, space: 'srgb' });
    expect(metadata.orientation).toBeUndefined();
  });

  it('converts CMYK input to browser-safe sRGB without resizing it', async () => {
    const input = await sharp({
      create: {
        width: 20,
        height: 14,
        channels: 3,
        background: { r: 140, g: 100, b: 80 },
      },
    })
      .toColourspace('cmyk')
      .jpeg()
      .toBuffer();

    const result = await enhanceStudioImage({
      engine: 'REALISTIC',
      image: input,
      mimeType: 'image/jpeg',
      prompt: 'Doğal renk düzeltme.',
      realisticProvider: passthroughRealisticProvider,
    });

    await expect(sharp(result.buffer).metadata()).resolves.toMatchObject({
      width: 20,
      height: 14,
      space: 'srgb',
    });
  });

  it.each([
    ['corrupt payload', Buffer.from('not-an-image'), 'image/jpeg'],
    ['oversized payload', Buffer.alloc(MAX_STUDIO_IMAGE_BYTES + 1), 'image/jpeg'],
    ['animated webp', ANIMATED_WEBP, 'image/webp'],
  ])('rejects %s before producing an output', async (_name, image, mimeType) => {
    await expect(
      enhanceStudioImage({
        engine: 'REALISTIC',
        image,
        mimeType,
        prompt: 'Doğal renk düzeltme.',
      })
    ).rejects.toBeInstanceOf(StudioImageError);
  });

  it('never calls the Stability provider in REALISTIC mode', async () => {
    const provider = vi.fn();
    const input = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#777777',
      },
    })
      .jpeg()
      .toBuffer();

    await enhanceStudioImage({
      engine: 'REALISTIC',
      image: input,
      mimeType: 'image/jpeg',
      prompt: 'Doğal renk düzeltme.',
      creativeProvider: provider,
      realisticProvider: passthroughRealisticProvider,
    });

    expect(provider).not.toHaveBeenCalled();
  });

  it('keeps standard processing local and never calls OpenRouter', async () => {
    const source = await sharp({
      create: {
        width: 80,
        height: 60,
        channels: 3,
        background: '#777777',
      },
    })
      .jpeg()
      .toBuffer();
    const realisticProvider = vi.fn(passthroughRealisticProvider);

    const result = await enhanceStudioImage({
      engine: 'REALISTIC',
      image: source,
      mimeType: 'image/jpeg',
      prompt: 'Doğal kalite artışı.',
      realisticProvider,
    });

    expect(realisticProvider).not.toHaveBeenCalled();
    expect(result).toMatchObject({ width: 80, height: 60, engine: 'REALISTIC' });
  });

  it('uses GPT Image 2 only for an explicit premium batch', async () => {
    const source = await sharp({
      create: {
        width: 80,
        height: 60,
        channels: 3,
        background: '#777777',
      },
    })
      .jpeg()
      .toBuffer();
    const realisticProvider = vi.fn(passthroughRealisticProvider);

    await enhanceStudioImage({
      engine: 'REALISTIC',
      modelTier: 'PREMIUM',
      image: source,
      mimeType: 'image/jpeg',
      prompt: 'Zor fotoğrafı doğal biçimde iyileştir.',
      realisticProvider,
    });

    expect(realisticProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'openai/gpt-image-2' })
    );
  });

  it('uses FLUX.2 Klein only for an explicit experimental batch', async () => {
    const source = await sharp({
      create: {
        width: 80,
        height: 60,
        channels: 3,
        background: '#777777',
      },
    })
      .jpeg()
      .toBuffer();
    const realisticProvider = vi.fn(passthroughRealisticProvider);

    await enhanceStudioImage({
      engine: 'REALISTIC',
      modelTier: 'FLUX',
      image: source,
      mimeType: 'image/jpeg',
      prompt: 'Işığı doğal biçimde iyileştir.',
      realisticProvider,
    });

    expect(realisticProvider).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'black-forest-labs/flux.2-klein-4b' })
    );
  });

  it.each([
    'COMPOSITION_CHANGED',
    'EXPOSURE_CHANGED',
    'INVALID_PROVIDER_RESPONSE',
  ] as const)(
    'uses the original photo with safe local adjustments when FLUX reports %s',
    async (code) => {
      const source = await sharp({
        create: {
          width: 160,
          height: 100,
          channels: 3,
          background: { r: 42, g: 52, b: 62 },
        },
      })
        .composite([
          {
            input: await sharp({
              create: {
                width: 80,
                height: 45,
                channels: 3,
                background: { r: 205, g: 185, b: 150 },
              },
            })
              .png()
              .toBuffer(),
            left: 0,
            top: 0,
          },
          {
            input: await sharp({
              create: {
                width: 80,
                height: 45,
                channels: 3,
                background: { r: 70, g: 105, b: 135 },
              },
            })
              .png()
              .toBuffer(),
            left: 80,
            top: 55,
          },
          {
            input: await sharp({
              create: {
                width: 24,
                height: 80,
                channels: 3,
                background: { r: 155, g: 72, b: 48 },
              },
            })
              .png()
              .toBuffer(),
            left: 68,
            top: 10,
          },
        ])
        .jpeg()
        .toBuffer();
      const realisticProvider = vi.fn().mockRejectedValue(
        new OpenRouterStudioImageError(code, 'Güvenli olmayan sağlayıcı çıktısı.')
      );

      const result = await enhanceStudioImage({
        engine: 'REALISTIC',
        modelTier: 'FLUX',
        image: source,
        mimeType: 'image/jpeg',
        prompt: 'Işığı doğal biçimde iyileştir.',
        realisticProvider,
      });

      expect(realisticProvider).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        width: 160,
        height: 100,
        mimeType: 'image/jpeg',
        engine: 'REALISTIC',
      });
      expect(await luminanceCorrelation(source, result.buffer)).toBeGreaterThan(0.9);
    }
  );

  it('keeps real OpenRouter service failures retryable instead of hiding them', async () => {
    const source = await sharp({
      create: {
        width: 80,
        height: 60,
        channels: 3,
        background: '#777777',
      },
    })
      .jpeg()
      .toBuffer();
    const providerError = new OpenRouterStudioImageError(
      'PROVIDER_ERROR',
      'OpenRouter geçici olarak kullanılamıyor.'
    );
    const realisticProvider = vi.fn().mockRejectedValue(providerError);

    await expect(
      enhanceStudioImage({
        engine: 'REALISTIC',
        modelTier: 'FLUX',
        image: source,
        mimeType: 'image/jpeg',
        prompt: 'Işığı doğal biçimde iyileştir.',
        realisticProvider,
      })
    ).rejects.toBe(providerError);
    expect(realisticProvider).toHaveBeenCalledOnce();
  });

  it('uses Stability only for the explicit CREATIVE mode', async () => {
    const source = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: '#777777',
      },
    })
      .jpeg()
      .toBuffer();
    const generated = await sharp(source).png().toBuffer();
    const provider = vi.fn().mockResolvedValue({
      buffer: generated,
      mimeType: 'image/png',
      extension: 'png',
    });

    const result = await enhanceStudioImage({
      engine: 'CREATIVE',
      image: source,
      mimeType: 'image/jpeg',
      prompt: 'Temsilî bir akşam atmosferi oluştur.',
      creativeProvider: provider,
    });

    expect(provider).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      engine: 'CREATIVE',
      width: 10,
      height: 10,
      mimeType: 'image/png',
    });
  });
});
