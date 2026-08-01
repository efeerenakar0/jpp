import 'server-only';

import { STUDIO_NEGATIVE_PROMPT } from './studio-enhancement';
import { detectStudioImageMimeType } from './studio-image-format';

export const STABLE_IMAGE_ULTRA_ENDPOINT =
  'https://api.stability.ai/v2beta/stable-image/generate/ultra';

export const STUDIO_IMAGE_TO_IMAGE_STRENGTH = 0.82;

const MAX_IMAGE_BYTES = 9 * 1024 * 1024;
const MAX_RESULT_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 90_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 180_000;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type StabilityUltraGenerationInput = {
  image: Buffer;
  mimeType: string;
  prompt: string;
  negativePrompt?: string;
  strength?: number;
  clientUserId?: string;
};

export type StabilityUltraGenerationResult = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
};

export type StabilityUltraErrorCode =
  | 'MISSING_KEY'
  | 'INVALID_PROMPT'
  | 'INVALID_IMAGE'
  | 'INVALID_KEY'
  | 'INSUFFICIENT_CREDITS'
  | 'CONTENT_REJECTED'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_RESPONSE';

export class StabilityUltraError extends Error {
  constructor(
    readonly code: StabilityUltraErrorCode,
    readonly status: number,
    readonly providerStatus?: number,
    message?: string
  ) {
    super(message || stabilityUltraErrorMessage(code));
    this.name = 'StabilityUltraError';
  }
}

function stabilityUltraErrorMessage(code: StabilityUltraErrorCode) {
  switch (code) {
    case 'MISSING_KEY':
      return 'Stable Image Ultra bağlantısı henüz yapılandırılmamış. Sistem yöneticinizin STABILITY_API_KEY ortam değişkenini eklemesi gerekiyor.';
    case 'INVALID_PROMPT':
      return 'İyileştirme talimatı boş veya çok uzun. Lütfen 10.000 karakterden kısa bir talimat yazın.';
    case 'INVALID_IMAGE':
      return 'Yüklenen görsel işlenemedi. JPG, PNG veya WEBP biçiminde, 9 MB’den küçük ve en az 64 × 64 piksel bir görsel deneyin.';
    case 'INVALID_KEY':
      return 'Stable Image Ultra bağlantısı doğrulanamadı. Sistem yöneticiniz API anahtarını kontrol etmelidir.';
    case 'INSUFFICIENT_CREDITS':
      return 'Stability AI hesabında yeterli kredi bulunmuyor. Sistem yöneticiniz bakiye ve kullanım limitini kontrol etmelidir.';
    case 'CONTENT_REJECTED':
      return 'Görsel veya talimat Stability AI güvenlik denetiminden geçemedi. Farklı bir görsel ya da daha sade bir talimat deneyin.';
    case 'RATE_LIMITED':
      return 'Stability AI şu anda yoğun. Lütfen yaklaşık bir dakika bekleyip yeniden deneyin.';
    case 'PROVIDER_UNAVAILABLE':
      return 'Stable Image Ultra görsel servisine şu anda ulaşılamıyor. Lütfen kısa bir süre sonra yeniden deneyin.';
    case 'INVALID_RESPONSE':
      return 'Stable Image Ultra geçerli bir görsel döndürmedi. Lütfen işlemi yeniden deneyin.';
  }
}

function providerError(status: number) {
  if (status === 401) {
    return new StabilityUltraError('INVALID_KEY', 503, status);
  }
  if (status === 402) {
    return new StabilityUltraError('INSUFFICIENT_CREDITS', 402, status);
  }
  if (status === 403) {
    return new StabilityUltraError('CONTENT_REJECTED', 422, status);
  }
  if (status === 429) {
    return new StabilityUltraError('RATE_LIMITED', 503, status);
  }
  if (status === 413) {
    return new StabilityUltraError(
      'INVALID_IMAGE',
      413,
      status,
      'Görsel Stability AI sınırlarını aşıyor. Lütfen JPG, PNG veya WEBP biçiminde ve 9 MB’den küçük bir görsel yükleyin.'
    );
  }
  if (status === 400 || status === 422) {
    return new StabilityUltraError('INVALID_IMAGE', 422, status);
  }
  return new StabilityUltraError('PROVIDER_UNAVAILABLE', 503, status);
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function requestTimeoutMs() {
  const configured = Number(process.env.STABILITY_API_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_TIMEOUT_MS;
  return Math.min(
    Math.max(Math.trunc(configured), MIN_TIMEOUT_MS),
    MAX_TIMEOUT_MS
  );
}

export async function generateWithStableImageUltra({
  image,
  mimeType,
  prompt,
  negativePrompt,
  strength,
  clientUserId,
}: StabilityUltraGenerationInput): Promise<StabilityUltraGenerationResult> {
  const apiKey = process.env.STABILITY_API_KEY?.trim();
  if (!apiKey) {
    throw new StabilityUltraError('MISSING_KEY', 503);
  }

  const safePrompt = prompt.trim();
  const safeNegativePrompt = negativePrompt?.trim() || '';
  if (
    !safePrompt ||
    safePrompt.length > 10_000 ||
    safeNegativePrompt.length > 10_000 ||
    (strength !== undefined &&
      (!Number.isFinite(strength) || strength < 0 || strength > 1))
  ) {
    throw new StabilityUltraError('INVALID_PROMPT', 400);
  }

  const detectedMimeType = detectStudioImageMimeType(image);
  if (
    image.length === 0 ||
    image.length > MAX_IMAGE_BYTES ||
    !SUPPORTED_IMAGE_TYPES.has(mimeType) ||
    !detectedMimeType
  ) {
    throw new StabilityUltraError('INVALID_IMAGE', 400);
  }

  const body = new FormData();
  body.append('prompt', safePrompt);
  if (safeNegativePrompt) {
    body.append('negative_prompt', safeNegativePrompt);
  }
  body.append(
    'image',
    new Blob([new Uint8Array(image)], { type: detectedMimeType }),
    `property.${extensionForMimeType(detectedMimeType)}`
  );
  if (strength !== undefined) {
    body.append('strength', String(strength));
  }
  body.append('output_format', 'jpeg');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: 'image/*',
    'stability-client-id': 'Business CEO AI Studio',
    'stability-client-version': '2.0',
  };
  const safeClientUserId = clientUserId?.trim().slice(0, 256);
  if (safeClientUserId) {
    headers['stability-client-user-id'] = safeClientUserId;
  }

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    requestTimeoutMs()
  );
  let response: Response;
  try {
    response = await fetch(STABLE_IMAGE_ULTRA_ENDPOINT, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
      signal: abortController.signal,
    });
  } catch {
    throw new StabilityUltraError('PROVIDER_UNAVAILABLE', 503);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw providerError(response.status);
  }

  const resultMimeType = response.headers
    .get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase();
  const result = Buffer.from(await response.arrayBuffer());
  if (
    !resultMimeType ||
    !SUPPORTED_IMAGE_TYPES.has(resultMimeType) ||
    result.length === 0 ||
    result.length > MAX_RESULT_BYTES
  ) {
    throw new StabilityUltraError(
      'INVALID_RESPONSE',
      502,
      response.status
    );
  }

  return {
    buffer: result,
    mimeType: resultMimeType,
    extension: extensionForMimeType(resultMimeType),
  };
}

export async function enhanceWithStableImageUltra({
  image,
  mimeType,
  prompt,
}: {
  image: Buffer;
  mimeType: string;
  prompt: string;
}) {
  return generateWithStableImageUltra({
    image,
    mimeType,
    prompt,
    negativePrompt: STUDIO_NEGATIVE_PROMPT,
    strength: STUDIO_IMAGE_TO_IMAGE_STRENGTH,
  });
}
