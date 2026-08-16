import 'server-only';

import sharp from 'sharp';

const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';
export const OPENROUTER_STUDIO_IMAGE_MODEL = 'openai/gpt-image-1-mini';
export const OPENROUTER_STUDIO_PREMIUM_IMAGE_MODEL = 'openai/gpt-image-2';
export const OPENROUTER_STUDIO_FLUX_IMAGE_MODEL =
  'black-forest-labs/flux.2-klein-4b';
export const OPENROUTER_STUDIO_IMAGE_QUALITY = 'low' as const;
const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_PROVIDER_RESPONSE_BYTES = 30 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 270_000;
const LANDSCAPE_REFERENCE_BOUNDS = { width: 1280, height: 720 } as const;
const PORTRAIT_REFERENCE_BOUNDS = { width: 720, height: 1280 } as const;
const MINI_LANDSCAPE_REFERENCE_BOUNDS = { width: 1080, height: 720 } as const;
const MINI_PORTRAIT_REFERENCE_BOUNDS = { width: 720, height: 1080 } as const;
const SQUARE_REFERENCE_BOUNDS = { width: 1024, height: 1024 } as const;

type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export type OpenRouterStudioImageModel =
  | typeof OPENROUTER_STUDIO_IMAGE_MODEL
  | typeof OPENROUTER_STUDIO_PREMIUM_IMAGE_MODEL
  | typeof OPENROUTER_STUDIO_FLUX_IMAGE_MODEL;

export type OpenRouterStudioImageResult = {
  buffer: Buffer;
  mimeType: 'image/jpeg';
  extension: 'jpg';
  width: number;
  height: number;
  model: OpenRouterStudioImageModel;
};

export class OpenRouterStudioImageError extends Error {
  constructor(
    readonly code:
      | 'NOT_CONFIGURED'
      | 'INVALID_SOURCE'
      | 'PROVIDER_ERROR'
      | 'INVALID_PROVIDER_RESPONSE'
      | 'COMPOSITION_CHANGED'
      | 'EXPOSURE_CHANGED',
    message: string,
    readonly status = 502
  ) {
    super(message);
    this.name = 'OpenRouterStudioImageError';
  }
}

function outputBounds(width: number, height: number) {
  const ratio = width / height;
  const isSquare = ratio >= 0.95 && ratio <= 1.05;
  if (isSquare) return { width: 1024, height: 1024 };
  return width > height
    ? { width: 1920, height: 1080 }
    : { width: 1080, height: 1920 };
}

function referenceBounds(width: number, height: number) {
  const ratio = width / height;
  const isSquare = ratio >= 0.95 && ratio <= 1.05;
  if (isSquare) return SQUARE_REFERENCE_BOUNDS;
  return width > height
    ? LANDSCAPE_REFERENCE_BOUNDS
    : PORTRAIT_REFERENCE_BOUNDS;
}

function miniReferenceBounds(width: number, height: number) {
  const ratio = width / height;
  const isSquare = ratio >= 0.95 && ratio <= 1.05;
  if (isSquare) return SQUARE_REFERENCE_BOUNDS;
  return width > height
    ? MINI_LANDSCAPE_REFERENCE_BOUNDS
    : MINI_PORTRAIT_REFERENCE_BOUNDS;
}

function miniAspectRatio(width: number, height: number) {
  const ratio = width / height;
  const isSquare = ratio >= 0.95 && ratio <= 1.05;
  if (isSquare) return { request: '1:1' as const, numeric: 1 };
  return width > height
    ? { request: '3:2' as const, numeric: 3 / 2 }
    : { request: '2:3' as const, numeric: 2 / 3 };
}

function declaredMimeType(value: string): SupportedImageMimeType {
  if (value === 'image/jpeg' || value === 'image/png' || value === 'image/webp') {
    return value;
  }
  throw new OpenRouterStudioImageError(
    'INVALID_SOURCE',
    'Yalnizca JPG, PNG veya WebP fotograflar iyilestirilebilir.',
    400
  );
}

async function prepareReferenceImage(input: {
  image: Buffer;
  mimeType: string;
  model: OpenRouterStudioImageModel;
}) {
  declaredMimeType(input.mimeType);
  try {
    const metadata = await sharp(input.image, {
      animated: true,
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    }).metadata();
    if ((metadata.pages ?? 1) > 1) {
      throw new OpenRouterStudioImageError(
        'INVALID_SOURCE',
        'Hareketli gorseller desteklenmiyor.',
        400
      );
    }
    const width = metadata.autoOrient?.width ?? metadata.width;
    const height = metadata.autoOrient?.height ?? metadata.height;
    if (!width || !height || width * height > MAX_IMAGE_PIXELS) {
      throw new OpenRouterStudioImageError(
        'INVALID_SOURCE',
        'Fotografin cozunurlugu guvenli isleme sinirini asiyor.',
        400
      );
    }
    const usesMiniModel = input.model === OPENROUTER_STUDIO_IMAGE_MODEL;
    const providerReferenceBounds = usesMiniModel
      ? miniReferenceBounds(width, height)
      : referenceBounds(width, height);
    const providerOutputBounds = outputBounds(width, height);
    const providerAspectRatio = usesMiniModel
      ? miniAspectRatio(width, height)
      : { request: 'auto' as const, numeric: width / height };
    const prepared = await sharp(input.image, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .resize({
        width: providerReferenceBounds.width,
        height: providerReferenceBounds.height,
        fit: usesMiniModel ? 'contain' : 'inside',
        background: { r: 12, g: 18, b: 24 },
        withoutEnlargement: true,
      })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4', progressive: true })
      .toBuffer({ resolveWithObject: true });
    return {
      buffer: prepared.data,
      width: prepared.info.width,
      height: prepared.info.height,
      sourceAspectRatio: width / height,
      providerAspectRatio: providerAspectRatio.numeric,
      requestAspectRatio: providerAspectRatio.request,
      removeTemporaryMatte: usesMiniModel,
      outputBounds: providerOutputBounds,
    };
  } catch (error) {
    if (error instanceof OpenRouterStudioImageError) throw error;
    throw new OpenRouterStudioImageError(
      'INVALID_SOURCE',
      'Fotograf okunamadi. Dosyayi JPG, PNG veya WebP olarak yeniden yukleyin.',
      400
    );
  }
}

export function buildRealEstateEnhancementPrompt(customInstruction?: string) {
  const safeCustomInstruction = customInstruction?.trim().slice(0, 2_000);
  return [
    'Perform a strict, conservative image-to-image retouch of the supplied real-estate photograph. The reference image is the source of truth. Do not recreate or redesign the scene.',
    'Make the property look polished, premium and appealing mainly through realistic practical lighting, accurate white balance, natural color separation, restrained local contrast, tonal depth, subtle clarity, clean detail and light noise reduction — not through a broad global exposure increase.',
    'Preserve the exact time of day. A night or blue-hour photograph must remain night or blue hour; a daytime photograph must remain daytime. Never replace the sky or simulate sunlight to move the scene to another time.',
    'Prefer subtle local lighting over changing the whole image. Existing visible lamps, ceiling lights, wall sconces, window light, pool lights and garden/path lights may be switched on or made gently more attractive. Add only believable light spill around those already visible sources; keep the rest of the exposure and shadow depth close to the reference.',
    'Protect all highlight detail in windows, lamps, ceilings, white walls, reflections and sky. Do not create clipped highlights, blown whites, washed-out surfaces, lifted blacks or flat grey shadows. Preserve the original lighting direction, fixture positions, natural depth and atmosphere.',
    'Use neutral, realistic colors, moderate saturation and gentle sharpening. No HDR look, halos, excessive glow, bloom, whole-scene relighting, exaggerated dynamic range, color cast, plastic texture or invented detail.',
    'If a temporary plain border surrounds the supplied photograph, it is only a processing matte. Preserve the complete photograph inside it; do not crop, zoom, replace or redesign its content.',
    'Preserve the exact room, building, furniture, objects, materials, architecture, geometry, perspective, camera position, crop, windows, view and every visible feature.',
    safeCustomInstruction
      ? `Optional user preference: ${safeCustomInstruction}`
      : '',
    'Ignore any optional preference that asks for strong global brightening, artificial relighting, staging, geometry changes or anything that conflicts with the preservation rules.',
    'Do not add, remove, replace, move, redesign, stage, repair, straighten, expand or invent any physical object or property feature. Do not add new light fixtures, windows, LED strips, landscaping, furniture or architecture. Do not alter text, logos, people or sky. Keep the exact framing and aspect ratio.',
    'Return one honest, natural and professionally finished property-listing photograph. Buyer appeal should come from believable existing practical lights, tonal depth, accurate color and clean detail, never from changing the time of day or excessive brightness.',
  ]
    .filter(Boolean)
    .join('\n');
}

function providerErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;
  const error = 'error' in payload ? payload.error : null;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return typeof error.message === 'string' ? error.message : null;
  }
  return null;
}

function decodeProviderImage(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) return null;
  if (!Array.isArray(payload.data) || payload.data.length !== 1) return null;
  const item = payload.data[0];
  if (!item || typeof item !== 'object' || !('b64_json' in item)) return null;
  if (typeof item.b64_json !== 'string' || !item.b64_json.trim()) return null;
  try {
    const buffer = Buffer.from(item.b64_json, 'base64');
    if (!buffer.length || buffer.length > MAX_PROVIDER_RESPONSE_BYTES) return null;
    return buffer;
  } catch {
    return null;
  }
}

type LuminanceProfile = {
  median: number;
  highlightClipRatio: number;
};

async function measureLuminance(image: Buffer): Promise<LuminanceProfile> {
  const sample = await sharp(image, {
    animated: false,
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
    sequentialRead: true,
  })
    .rotate()
    .flatten({ background: '#ffffff' })
    .greyscale()
    .resize({ width: 192, height: 192, fit: 'inside', withoutEnlargement: true })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const histogram = new Uint32Array(256);
  const channels = Math.max(1, sample.info.channels);
  let total = 0;
  let clipped = 0;
  for (let index = 0; index < sample.data.length; index += channels) {
    const value = sample.data[index];
    histogram[value] += 1;
    total += 1;
    if (value >= 250) clipped += 1;
  }
  let cumulative = 0;
  let median = 0;
  const midpoint = Math.ceil(total / 2);
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative >= midpoint) {
      median = value;
      break;
    }
  }
  return {
    median,
    highlightClipRatio: total ? clipped / total : 0,
  };
}

async function balanceProviderExposure(input: {
  sourceImage: Buffer;
  outputImage: Buffer;
  applyToneGrade: boolean;
}) {
  const [source, output] = await Promise.all([
    measureLuminance(input.sourceImage),
    measureLuminance(input.outputImage),
  ]);
  const medianLift =
    source.median < 85 ? 18 : source.median <= 155 ? 10 : source.median <= 180 ? 4 : 0;
  const medianCeiling = Math.max(
    source.median,
    Math.min(190, source.median + medianLift)
  );
  const softCeiling = Math.min(198, medianCeiling + 8);
  const irrecoverableHighlightRatio = Math.max(
    0.35,
    source.highlightClipRatio + 0.25
  );
  if (
    output.median >= 245 &&
    output.highlightClipRatio > irrecoverableHighlightRatio
  ) {
    throw new OpenRouterStudioImageError(
      'EXPOSURE_CHANGED',
      'Yapay zeka fotografi gereğinden fazla aydinlatti. Guvenlik icin bu sonuc kaydedilmedi; tekrar deneyin.'
    );
  }
  const brightness =
    output.median > softCeiling + 2
      ? Math.max(0.72, softCeiling / output.median)
      : 1;
  if (brightness !== 1 || input.applyToneGrade) {
    let adjusted = sharp(input.outputImage, { sequentialRead: true }).modulate({
      brightness,
      saturation: input.applyToneGrade ? 1.08 : 1,
    });
    if (input.applyToneGrade) {
      const contrast = 1.035;
      adjusted = adjusted.linear(contrast, 128 * (1 - contrast));
    }
    return adjusted
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4', progressive: true })
      .toBuffer();
  }

  return input.outputImage;
}

async function normalizeProviderOutput(input: {
  image: Buffer;
  sourceImage: Buffer;
  sourceAspectRatio: number;
  providerAspectRatio: number;
  removeTemporaryMatte: boolean;
  applyToneGrade: boolean;
  bounds: { width: number; height: number };
}) {
  try {
    const metadata = await sharp(input.image, {
      animated: true,
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    }).metadata();
    if ((metadata.pages ?? 1) > 1 || !metadata.width || !metadata.height) {
      throw new Error('invalid output');
    }
    const outputAspectRatio = metadata.width / metadata.height;
    const aspectRatioDrift = Math.abs(
      outputAspectRatio / input.providerAspectRatio - 1
    );
    if (aspectRatioDrift > 0.035) {
      throw new OpenRouterStudioImageError(
        'COMPOSITION_CHANGED',
        'Yapay zeka fotografin kadrajini degistirdi. Guvenlik icin bu sonuc kaydedilmedi; tekrar deneyin.'
      );
    }
    const oriented = await sharp(input.image, {
      animated: false,
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
      sequentialRead: true,
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .toColourspace('srgb')
      .toBuffer({ resolveWithObject: true });
    let output = sharp(oriented.data, { sequentialRead: true });
    if (input.removeTemporaryMatte) {
      const currentRatio = oriented.info.width / oriented.info.height;
      if (currentRatio > input.sourceAspectRatio) {
        const width = Math.min(
          oriented.info.width,
          Math.round(oriented.info.height * input.sourceAspectRatio)
        );
        output = output.extract({
          left: Math.floor((oriented.info.width - width) / 2),
          top: 0,
          width,
          height: oriented.info.height,
        });
      } else if (currentRatio < input.sourceAspectRatio) {
        const height = Math.min(
          oriented.info.height,
          Math.round(oriented.info.width / input.sourceAspectRatio)
        );
        output = output.extract({
          left: 0,
          top: Math.floor((oriented.info.height - height) / 2),
          width: oriented.info.width,
          height,
        });
      }
    }
    const normalized = await output
      .resize({
        width: input.bounds.width,
        height: input.bounds.height,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4', progressive: true })
      .toBuffer({ resolveWithObject: true });
    const exposureBalanced = await balanceProviderExposure({
      sourceImage: input.sourceImage,
      outputImage: normalized.data,
      applyToneGrade: input.applyToneGrade,
    });
    const balancedMetadata = await sharp(exposureBalanced, {
      failOn: 'error',
      limitInputPixels: MAX_IMAGE_PIXELS,
    }).metadata();
    return {
      buffer: exposureBalanced,
      width: balancedMetadata.width ?? normalized.info.width,
      height: balancedMetadata.height ?? normalized.info.height,
    };
  } catch (error) {
    if (error instanceof OpenRouterStudioImageError) throw error;
    throw new OpenRouterStudioImageError(
      'INVALID_PROVIDER_RESPONSE',
      'Yapay zeka gecersiz bir gorsel dondurdu. Bu fotografi tekrar deneyin.'
    );
  }
}

export async function enhanceWithOpenRouterStudioImage(input: {
  image: Buffer;
  mimeType: string;
  prompt?: string;
  model?: OpenRouterStudioImageModel;
  fetchImpl?: typeof fetch;
  apiKey?: string;
}): Promise<OpenRouterStudioImageResult> {
  const apiKey = input.apiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new OpenRouterStudioImageError(
      'NOT_CONFIGURED',
      'OpenRouter gorsel duzenleme anahtari sunucuda yapilandirilmamis.',
      503
    );
  }
  const model = input.model ?? OPENROUTER_STUDIO_IMAGE_MODEL;
  const usesFluxModel = model === OPENROUTER_STUDIO_FLUX_IMAGE_MODEL;
  const reference = await prepareReferenceImage({
    image: input.image,
    mimeType: input.mimeType,
    model,
  });
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(OPENROUTER_IMAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer':
          process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://jpp-ufeb.vercel.app',
        'X-OpenRouter-Title': 'Business CEO AI Real Estate Studio',
      },
      body: JSON.stringify({
        model,
        prompt: buildRealEstateEnhancementPrompt(input.prompt),
        ...(usesFluxModel
          ? {}
          : { quality: OPENROUTER_STUDIO_IMAGE_QUALITY }),
        n: 1,
        provider: {
          only: [usesFluxModel ? 'black-forest-labs' : 'openai'],
          allow_fallbacks: false,
        },
        aspect_ratio: reference.requestAspectRatio,
        input_references: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${reference.buffer.toString('base64')}`,
            },
          },
        ],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError');
    throw new OpenRouterStudioImageError(
      'PROVIDER_ERROR',
      timedOut
        ? 'Gorsel duzenleme zaman asimina ugradi. Fotograf kuyrukta tekrar denenebilir.'
        : 'OpenRouter gorsel servisine ulasilamadi. Fotograf kuyrukta tekrar denenebilir.'
    );
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const detail = providerErrorMessage(payload);
    throw new OpenRouterStudioImageError(
      'PROVIDER_ERROR',
      detail
        ? `OpenRouter gorsel duzenleme hatasi: ${detail.slice(0, 500)}`
        : `OpenRouter gorsel duzenleme istegi basarisiz oldu (${response.status}).`
    );
  }
  const generated = decodeProviderImage(payload);
  if (!generated) {
    throw new OpenRouterStudioImageError(
      'INVALID_PROVIDER_RESPONSE',
      'OpenRouter gorsel cevabi beklenen bicimde degildi.'
    );
  }
  const normalized = await normalizeProviderOutput({
    image: generated,
    sourceImage: input.image,
    sourceAspectRatio: reference.sourceAspectRatio,
    providerAspectRatio: reference.providerAspectRatio,
    removeTemporaryMatte: reference.removeTemporaryMatte,
    applyToneGrade: usesFluxModel,
    bounds: reference.outputBounds,
  });
  return {
    ...normalized,
    mimeType: 'image/jpeg',
    extension: 'jpg',
    model,
  };
}

export function enhanceWithOpenRouterGptImage2(
  input: Omit<Parameters<typeof enhanceWithOpenRouterStudioImage>[0], 'model'>
) {
  return enhanceWithOpenRouterStudioImage({
    ...input,
    model: OPENROUTER_STUDIO_PREMIUM_IMAGE_MODEL,
  });
}

export function enhanceWithOpenRouterFluxKlein(
  input: Omit<Parameters<typeof enhanceWithOpenRouterStudioImage>[0], 'model'>
) {
  return enhanceWithOpenRouterStudioImage({
    ...input,
    model: OPENROUTER_STUDIO_FLUX_IMAGE_MODEL,
  });
}
