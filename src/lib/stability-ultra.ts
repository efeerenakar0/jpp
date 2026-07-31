import 'server-only';

import { STUDIO_NEGATIVE_PROMPT } from './studio-enhancement';

export const STABLE_IMAGE_ULTRA_ENDPOINT =
  'https://api.stability.ai/v2beta/stable-image/generate/ultra';

export const STUDIO_IMAGE_TO_IMAGE_STRENGTH = 0.3;

export const SAFE_STUDIO_RETRY_PROMPT =
  'Enhance this real estate photograph with natural exposure, accurate white balance, realistic colors, clean detail, and professional architectural photography quality. Preserve the exact property, objects, materials, geometry, and composition.';

const MAX_IMAGE_BYTES = 9 * 1024 * 1024;
const MAX_RESULT_BYTES = 25 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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
      return 'Bu görsel, sadeleştirilmiş güvenli talimatla yapılan ikinci denemede de Stability AI güvenlik filtresinden geçemedi. Görselde kişi veya filtrenin yanlış algıladığı bir ayrıntı olabilir.';
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

function ultraRequestBody({
  image,
  mimeType,
  prompt,
  includeNegativePrompt,
}: {
  image: Buffer;
  mimeType: string;
  prompt: string;
  includeNegativePrompt: boolean;
}) {
  const body = new FormData();
  body.append('prompt', prompt);
  if (includeNegativePrompt) {
    body.append('negative_prompt', STUDIO_NEGATIVE_PROMPT);
  }
  body.append(
    'image',
    new Blob([new Uint8Array(image)], { type: mimeType }),
    `property.${extensionForMimeType(mimeType)}`
  );
  body.append('strength', String(STUDIO_IMAGE_TO_IMAGE_STRENGTH));
  body.append('output_format', 'jpeg');
  return body;
}

function requestStableImageUltra({
  apiKey,
  image,
  mimeType,
  prompt,
  includeNegativePrompt,
}: {
  apiKey: string;
  image: Buffer;
  mimeType: string;
  prompt: string;
  includeNegativePrompt: boolean;
}) {
  return fetch(STABLE_IMAGE_ULTRA_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'image/*',
      'stability-client-id': 'Business CEO AI Studio',
      'stability-client-version': '2.1',
    },
    body: ultraRequestBody({
      image,
      mimeType,
      prompt,
      includeNegativePrompt,
    }),
    cache: 'no-store',
  });
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
  const apiKey = process.env.STABILITY_API_KEY?.trim();
  if (!apiKey) {
    throw new StabilityUltraError('MISSING_KEY', 503);
  }

  const safePrompt = prompt.trim();
  if (!safePrompt || safePrompt.length > 10_000) {
    throw new StabilityUltraError('INVALID_PROMPT', 400);
  }

  if (
    image.length === 0 ||
    image.length > MAX_IMAGE_BYTES ||
    !SUPPORTED_IMAGE_TYPES.has(mimeType)
  ) {
    throw new StabilityUltraError('INVALID_IMAGE', 400);
  }

  let response = await requestStableImageUltra({
    apiKey,
    image,
    mimeType,
    prompt: safePrompt,
    includeNegativePrompt: true,
  });

  if (
    response.status === 403 &&
    safePrompt !== SAFE_STUDIO_RETRY_PROMPT
  ) {
    await response.body?.cancel().catch(() => undefined);
    response = await requestStableImageUltra({
      apiKey,
      image,
      mimeType,
      prompt: SAFE_STUDIO_RETRY_PROMPT,
      includeNegativePrompt: false,
    });
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
    !resultMimeType?.startsWith('image/') ||
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
