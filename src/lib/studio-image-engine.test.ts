import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

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

describe('studio image engine selection', () => {
  it('uses deterministic REALISTIC processing unless creative AI is explicit', () => {
    expect(resolveStudioImageEngine()).toBe('REALISTIC');
    expect(resolveStudioImageEngine('professional-camera')).toBe('REALISTIC');
    expect(resolveStudioImageEngine('custom')).toBe('REALISTIC');
    expect(resolveStudioImageEngine('creative-ai')).toBe('CREATIVE');
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
    });
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
    });

    expect(provider).not.toHaveBeenCalled();
  });

  it('can pass low-resolution photos through a configured GPU restoration bridge', async () => {
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
    const upscaled = await sharp(source).resize(160, 120).jpeg().toBuffer();
    const superResolutionProvider = vi.fn().mockResolvedValue({
      buffer: upscaled,
      mimeType: 'image/jpeg' as const,
      model: 'realesrgan-x4plus',
    });

    const result = await enhanceStudioImage({
      engine: 'REALISTIC',
      image: source,
      mimeType: 'image/jpeg',
      prompt: 'Doğal kalite artışı.',
      superResolutionProvider,
    });

    expect(superResolutionProvider).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ width: 160, height: 120, engine: 'REALISTIC' });
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
