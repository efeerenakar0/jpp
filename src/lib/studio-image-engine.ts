import 'server-only';

import sharp from 'sharp';

import { enhanceWithStableImageUltra } from '@/lib/stability-ultra';

export const MAX_STUDIO_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_STUDIO_IMAGE_PIXELS = 40_000_000;

export type StudioImageEngine = 'REALISTIC' | 'CREATIVE';

export type StudioImageResult = {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  engine: StudioImageEngine;
};

export class StudioImageError extends Error {
  constructor(
    readonly code:
      | 'INVALID_IMAGE'
      | 'IMAGE_TOO_LARGE'
      | 'IMAGE_TOO_MANY_PIXELS'
      | 'ANIMATED_IMAGE'
      | 'UNSUPPORTED_IMAGE',
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'StudioImageError';
  }
}

const MIME_BY_FORMAT = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

type SupportedFormat = keyof typeof MIME_BY_FORMAT;

function studioImageError(error: unknown): StudioImageError {
  if (error instanceof StudioImageError) return error;
  return new StudioImageError(
    'INVALID_IMAGE',
    'Görsel okunamadı veya dosya hasarlı. JPG, PNG ya da WebP dosyasını yeniden yükleyin.'
  );
}

async function inspectStudioImage(image: Buffer, declaredMimeType: string) {
  if (!image.length) {
    throw new StudioImageError('INVALID_IMAGE', 'Görsel dosyası boş.');
  }
  if (image.length > MAX_STUDIO_IMAGE_BYTES) {
    throw new StudioImageError(
      'IMAGE_TOO_LARGE',
      'Görsel 15 MB sınırını aşıyor. Daha küçük bir dosya yükleyin.'
    );
  }

  try {
    const metadata = await sharp(image, {
      animated: true,
      failOn: 'error',
      limitInputPixels: MAX_STUDIO_IMAGE_PIXELS,
      sequentialRead: true,
    }).metadata();
    const format = metadata.format as SupportedFormat | undefined;
    if (!format || !(format in MIME_BY_FORMAT)) {
      throw new StudioImageError(
        'UNSUPPORTED_IMAGE',
        'Bu görsel türü desteklenmiyor. JPG, PNG veya WebP kullanın.'
      );
    }
    if (MIME_BY_FORMAT[format] !== declaredMimeType) {
      throw new StudioImageError(
        'INVALID_IMAGE',
        'Dosya içeriği ile uzantısı uyuşmuyor. Görseli yeniden dışa aktarıp yükleyin.'
      );
    }
    if ((metadata.pages ?? 1) > 1) {
      throw new StudioImageError(
        'ANIMATED_IMAGE',
        'Hareketli görseller desteklenmiyor. Tek kare JPG, PNG veya WebP yükleyin.'
      );
    }
    const width = metadata.autoOrient?.width ?? metadata.width;
    const height = metadata.autoOrient?.height ?? metadata.height;
    if (!width || !height || width * height > MAX_STUDIO_IMAGE_PIXELS) {
      throw new StudioImageError(
        'IMAGE_TOO_MANY_PIXELS',
        'Görsel çözünürlüğü güvenli işleme sınırını aşıyor.'
      );
    }
    return { metadata, format, width, height };
  } catch (error) {
    throw studioImageError(error);
  }
}

export function resolveStudioImageEngine(
  preset?: string | null
): StudioImageEngine {
  return preset === 'creative-ai' ? 'CREATIVE' : 'REALISTIC';
}

async function enhanceRealisticStudioImage(
  image: Buffer,
  mimeType: string
): Promise<StudioImageResult> {
  const inspected = await inspectStudioImage(image, mimeType);
  try {
    const buffer = await sharp(image, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_STUDIO_IMAGE_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .modulate({ brightness: 1.015, saturation: 1.015 })
      .sharpen({ sigma: 0.6, m1: 0.35, m2: 0.7, x1: 2, y2: 10, y3: 20 })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4', progressive: true })
      .toBuffer();

    return {
      buffer,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      width: inspected.width,
      height: inspected.height,
      engine: 'REALISTIC',
    };
  } catch (error) {
    throw studioImageError(error);
  }
}

export async function enhanceStudioImage(input: {
  engine: StudioImageEngine;
  image: Buffer;
  mimeType: string;
  prompt: string;
  creativeProvider?: typeof enhanceWithStableImageUltra;
}): Promise<StudioImageResult> {
  await inspectStudioImage(input.image, input.mimeType);
  if (input.engine === 'REALISTIC') {
    return enhanceRealisticStudioImage(input.image, input.mimeType);
  }

  const provider = input.creativeProvider ?? enhanceWithStableImageUltra;
  const generated = await provider({
    image: input.image,
    mimeType: input.mimeType,
    prompt: input.prompt,
  });
  const inspected = await inspectStudioImage(
    generated.buffer,
    generated.mimeType
  );
  return {
    ...generated,
    width: inspected.width,
    height: inspected.height,
    engine: 'CREATIVE',
  } as StudioImageResult;
}
