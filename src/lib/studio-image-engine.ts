import 'server-only';

import sharp from 'sharp';

import { enhanceWithStableImageUltra } from '@/lib/stability-ultra';
import { enhanceWithConfiguredSuperResolution } from '@/lib/studio-super-resolution';

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
  analysis?: StudioImageAnalysis;
};

export type StudioImageAnalysis = {
  luminance: number;
  contrast: number;
  colourCast: number;
  needsShadowRecovery: boolean;
  needsHighlightRecovery: boolean;
  needsContrastRecovery: boolean;
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export async function analyseStudioImage(
  image: Buffer,
  declaredMimeType: string
): Promise<StudioImageAnalysis> {
  await inspectStudioImage(image, declaredMimeType);
  try {
    const stats = await sharp(image, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_STUDIO_IMAGE_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .stats();
    const channels = stats.channels.slice(0, 3);
    const means = channels.map((channel) => channel.mean);
    const deviations = channels.map((channel) => channel.stdev);
    const [red = 0, green = red, blue = green] = means;
    const luminance = clamp(
      (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255,
      0,
      1
    );
    const contrast = clamp(
      deviations.reduce((total, value) => total + value, 0) /
        Math.max(1, deviations.length) /
        64,
      0,
      1
    );
    const colourCast = clamp(
      (Math.max(...means) - Math.min(...means)) / 255,
      0,
      1
    );
    return {
      luminance,
      contrast,
      colourCast,
      needsShadowRecovery: luminance < 0.42,
      needsHighlightRecovery: luminance > 0.76,
      needsContrastRecovery: contrast < 0.42,
    };
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
  const analysis = await analyseStudioImage(image, mimeType);
  try {
    let pipeline = sharp(image, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_STUDIO_IMAGE_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb');

    if (
      analysis.needsContrastRecovery &&
      inspected.width >= 64 &&
      inspected.height >= 64
    ) {
      pipeline = analysis.needsShadowRecovery
        ? pipeline.clahe({ width: 3, height: 3, maxSlope: 1.35 })
        : pipeline.normalise({ lower: 1, upper: 99 });
    }

    const brightness = analysis.needsShadowRecovery
      ? 1.075
      : analysis.needsHighlightRecovery
        ? 0.965
        : 1.01;
    const saturation = analysis.colourCast > 0.2 ? 0.985 : 1.025;
    const buffer = await pipeline
      .modulate({ brightness, saturation })
      .sharpen({
        sigma: analysis.contrast < 0.3 ? 0.8 : 0.58,
        m1: 0.35,
        m2: 0.7,
        x1: 2,
        y2: 10,
        y3: 20,
      })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4', progressive: true })
      .toBuffer();

    return {
      buffer,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      width: inspected.width,
      height: inspected.height,
      engine: 'REALISTIC',
      analysis,
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
  superResolutionProvider?: typeof enhanceWithConfiguredSuperResolution;
}): Promise<StudioImageResult> {
  const sourceInspection = await inspectStudioImage(input.image, input.mimeType);
  if (input.engine === 'REALISTIC') {
    const provider =
      input.superResolutionProvider ?? enhanceWithConfiguredSuperResolution;
    const superResolved = await provider({
      image: input.image,
      mimeType: input.mimeType,
      width: sourceInspection.width,
      height: sourceInspection.height,
    }).catch(() => null);
    return enhanceRealisticStudioImage(
      superResolved?.buffer ?? input.image,
      superResolved?.mimeType ?? input.mimeType
    );
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
