import 'server-only';

import sharp from 'sharp';

import {
  OPENROUTER_STUDIO_FLUX_IMAGE_MODEL,
  OPENROUTER_STUDIO_PREMIUM_IMAGE_MODEL,
  OpenRouterStudioImageError,
  enhanceWithOpenRouterStudioImage,
} from '@/lib/openrouter-studio-image';
import { enhanceWithStableImageUltra } from '@/lib/stability-ultra';

export const MAX_STUDIO_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_STUDIO_IMAGE_PIXELS = 40_000_000;

export type StudioImageEngine = 'REALISTIC' | 'CREATIVE';
export type StudioImageModelTier = 'STANDARD' | 'FLUX' | 'PREMIUM';
export const LOCAL_STUDIO_IMAGE_MODEL = 'studio-adaptive-photography-v2';

const SAFE_LOCAL_FALLBACK_ERROR_CODES = new Set([
  'COMPOSITION_CHANGED',
  'EXPOSURE_CHANGED',
  'INVALID_PROVIDER_RESPONSE',
]);

function shouldUseSafeLocalFallback(error: unknown) {
  return (
    error instanceof OpenRouterStudioImageError &&
    SAFE_LOCAL_FALLBACK_ERROR_CODES.has(error.code)
  );
}

export function resolveStudioImageModelTier(
  model?: string | null
): StudioImageModelTier {
  if (model === OPENROUTER_STUDIO_FLUX_IMAGE_MODEL) return 'FLUX';
  return model === OPENROUTER_STUDIO_PREMIUM_IMAGE_MODEL
    ? 'PREMIUM'
    : 'STANDARD';
}

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
  medianLuminance: number;
  contrast: number;
  colourCast: number;
  saturation: number;
  shadowClipRatio: number;
  highlightClipRatio: number;
  sharpness: number;
  needsShadowRecovery: boolean;
  needsHighlightRecovery: boolean;
  needsContrastRecovery: boolean;
  adjustments: StudioImageAdjustments;
};

export type StudioImageAdjustments = {
  brightness: number;
  saturation: number;
  contrast: number;
  redGain: number;
  greenGain: number;
  blueGain: number;
  sharpenSigma: number;
  shadowRecovery: boolean;
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

function round(value: number, digits = 4) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function histogramPercentile(
  histogram: Uint32Array,
  sampleCount: number,
  percentile: number
) {
  const target = Math.max(1, Math.ceil(sampleCount * percentile));
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value] ?? 0;
    if (seen >= target) return value;
  }
  return 255;
}

function buildStudioAdjustments(input: {
  luminance: number;
  medianLuminance: number;
  contrast: number;
  saturation: number;
  colourCast: number;
  red: number;
  green: number;
  blue: number;
  shadowClipRatio: number;
  highlightClipRatio: number;
  sharpness: number;
}): StudioImageAdjustments {
  let brightness = clamp(
    1 + (0.6 - input.medianLuminance) * 0.22,
    0.97,
    1.12
  );
  if (input.highlightClipRatio > 0.04) {
    brightness = Math.min(brightness, 0.995);
  }
  if (input.highlightClipRatio > 0.12 || input.medianLuminance > 0.78) {
    brightness = Math.min(brightness, 0.98);
  }

  const saturation = clamp(
    1 + (0.25 - input.saturation) * 0.18,
    0.96,
    1.05
  );
  const contrast = clamp(1 + (0.52 - input.contrast) * 0.12, 0.985, 1.065);

  const channelAverage = Math.max(1, (input.red + input.green + input.blue) / 3);
  const shouldCorrectWhiteBalance = input.colourCast > 0.07;
  const channelGain = (channelMean: number) =>
    shouldCorrectWhiteBalance
      ? clamp(channelAverage / Math.max(1, channelMean), 0.96, 1.04)
      : 1;

  const sharpenSigma =
    input.sharpness < 0.75
      ? 0.9
      : input.sharpness < 1.5
        ? 0.72
        : input.sharpness < 3
          ? 0.58
          : 0.5;

  return {
    brightness: round(brightness),
    saturation: round(saturation),
    contrast: round(contrast),
    redGain: round(channelGain(input.red)),
    greenGain: round(channelGain(input.green)),
    blueGain: round(channelGain(input.blue)),
    sharpenSigma,
    shadowRecovery:
      input.medianLuminance < 0.38 &&
      input.contrast < 0.48 &&
      input.highlightClipRatio < 0.08,
  };
}

export async function analyseStudioImage(
  image: Buffer,
  declaredMimeType: string
): Promise<StudioImageAnalysis> {
  await inspectStudioImage(image, declaredMimeType);
  try {
    const sample = await sharp(image, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_STUDIO_IMAGE_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .removeAlpha()
      .resize({
        width: 320,
        height: 320,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const stats = await sharp(sample.data, { raw: sample.info }).stats();
    const channels = stats.channels.slice(0, 3);
    const means = channels.map((channel) => channel.mean);
    const [red = 0, green = red, blue = green] = means;
    const histogram = new Uint32Array(256);
    let luminanceTotal = 0;
    let saturationTotal = 0;
    let shadowPixels = 0;
    let highlightPixels = 0;
    const channelCount = sample.info.channels;
    const sampleCount = Math.max(1, sample.info.width * sample.info.height);
    for (let offset = 0; offset < sample.data.length; offset += channelCount) {
      const pixelRed = sample.data[offset] ?? 0;
      const pixelGreen = sample.data[offset + 1] ?? pixelRed;
      const pixelBlue = sample.data[offset + 2] ?? pixelGreen;
      const pixelLuminance = clamp(
        Math.round(
          pixelRed * 0.2126 + pixelGreen * 0.7152 + pixelBlue * 0.0722
        ),
        0,
        255
      );
      histogram[pixelLuminance] += 1;
      luminanceTotal += pixelLuminance;
      if (pixelLuminance <= 16) shadowPixels += 1;
      if (pixelLuminance >= 244) highlightPixels += 1;
      const maximum = Math.max(pixelRed, pixelGreen, pixelBlue);
      const minimum = Math.min(pixelRed, pixelGreen, pixelBlue);
      saturationTotal += maximum ? (maximum - minimum) / maximum : 0;
    }
    const luminance = clamp(luminanceTotal / sampleCount / 255, 0, 1);
    const medianLuminance =
      histogramPercentile(histogram, sampleCount, 0.5) / 255;
    const lowPercentile = histogramPercentile(histogram, sampleCount, 0.1);
    const highPercentile = histogramPercentile(histogram, sampleCount, 0.9);
    const contrast = clamp((highPercentile - lowPercentile) / 255, 0, 1);
    const saturation = clamp(saturationTotal / sampleCount, 0, 1);
    const shadowClipRatio = shadowPixels / sampleCount;
    const highlightClipRatio = highlightPixels / sampleCount;
    const colourCast = clamp(
      (Math.max(...means) - Math.min(...means)) /
        Math.max(1, means.reduce((total, value) => total + value, 0) / means.length),
      0,
      1
    );
    const sharpness = Math.max(0, stats.sharpness);
    const adjustments = buildStudioAdjustments({
      luminance,
      medianLuminance,
      contrast,
      saturation,
      colourCast,
      red,
      green,
      blue,
      shadowClipRatio,
      highlightClipRatio,
      sharpness,
    });
    return {
      luminance: round(luminance),
      medianLuminance: round(medianLuminance),
      contrast: round(contrast),
      colourCast: round(colourCast),
      saturation: round(saturation),
      shadowClipRatio: round(shadowClipRatio),
      highlightClipRatio: round(highlightClipRatio),
      sharpness: round(sharpness),
      needsShadowRecovery: medianLuminance < 0.42 || shadowClipRatio > 0.08,
      needsHighlightRecovery:
        medianLuminance > 0.72 || highlightClipRatio > 0.04,
      needsContrastRecovery: contrast < 0.48,
      adjustments,
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

function studioOutputBounds(width: number, height: number) {
  const ratio = width / height;
  if (ratio >= 0.95 && ratio <= 1.05) {
    return { width: 1024, height: 1024 };
  }
  return width > height
    ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1920 };
}

export async function applyStudioImageAdjustments(input: {
  image: Buffer;
  mimeType: string;
  analysis?: StudioImageAnalysis;
}): Promise<StudioImageResult> {
  const inspected = await inspectStudioImage(input.image, input.mimeType);
  const analysis =
    input.analysis ?? (await analyseStudioImage(input.image, input.mimeType));
  const adjustments = analysis.adjustments;
  const bounds = studioOutputBounds(inspected.width, inspected.height);

  try {
    let pipeline = sharp(input.image, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_STUDIO_IMAGE_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .removeAlpha()
      .recomb([
        [adjustments.redGain, 0, 0],
        [0, adjustments.greenGain, 0],
        [0, 0, adjustments.blueGain],
      ])
      .modulate({
        brightness: adjustments.brightness,
        saturation: adjustments.saturation,
      });

    if (Math.abs(adjustments.contrast - 1) > 0.002) {
      pipeline = pipeline.linear(
        adjustments.contrast,
        128 * (1 - adjustments.contrast)
      );
    }
    if (adjustments.shadowRecovery) {
      pipeline = pipeline.clahe({ width: 4, height: 4, maxSlope: 2 });
    }

    const output = await pipeline
      .resize({
        width: bounds.width,
        height: bounds.height,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .sharpen({
        sigma: adjustments.sharpenSigma,
        m1: 0.3,
        m2: 0.65,
        x1: 2,
        y2: 8,
        y3: 16,
      })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4', progressive: true })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: output.data,
      mimeType: 'image/jpeg',
      extension: 'jpg',
      width: output.info.width,
      height: output.info.height,
      engine: 'REALISTIC',
      analysis,
    };
  } catch (error) {
    throw studioImageError(error);
  }
}

export async function enhanceStudioImage(input: {
  engine: StudioImageEngine;
  modelTier?: StudioImageModelTier;
  image: Buffer;
  mimeType: string;
  prompt: string;
  creativeProvider?: typeof enhanceWithStableImageUltra;
  realisticProvider?: typeof enhanceWithOpenRouterStudioImage;
}): Promise<StudioImageResult> {
  await inspectStudioImage(input.image, input.mimeType);
  if (input.engine === 'REALISTIC') {
    const analysis = await analyseStudioImage(input.image, input.mimeType);
    if (input.modelTier === undefined || input.modelTier === 'STANDARD') {
      return applyStudioImageAdjustments({
        image: input.image,
        mimeType: input.mimeType,
        analysis,
      });
    }
    const provider = input.realisticProvider ?? enhanceWithOpenRouterStudioImage;
    const model =
      input.modelTier === 'FLUX'
        ? OPENROUTER_STUDIO_FLUX_IMAGE_MODEL
        : OPENROUTER_STUDIO_PREMIUM_IMAGE_MODEL;
    let generated;
    try {
      generated = await provider({
        image: input.image,
        mimeType: input.mimeType,
        prompt: input.prompt,
        model,
      });
    } catch (error) {
      if (shouldUseSafeLocalFallback(error)) {
        return applyStudioImageAdjustments({
          image: input.image,
          mimeType: input.mimeType,
          analysis,
        });
      }
      throw error;
    }
    const inspected = await inspectStudioImage(generated.buffer, generated.mimeType);
    return {
      buffer: generated.buffer,
      mimeType: generated.mimeType,
      extension: generated.extension,
      width: inspected.width,
      height: inspected.height,
      engine: 'REALISTIC',
      analysis,
    };
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
