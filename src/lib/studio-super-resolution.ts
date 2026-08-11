import 'server-only';

const MAX_SUPER_RESOLUTION_BYTES = 25 * 1024 * 1024;

type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type StudioSuperResolutionResult = {
  buffer: Buffer;
  mimeType: SupportedImageMimeType;
  model: string;
};

function supportedMimeType(value: string | null): value is SupportedImageMimeType {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

export function shouldUseStudioSuperResolution(input: {
  width: number;
  height: number;
}) {
  const longestEdge = Math.max(input.width, input.height);
  const shortestEdge = Math.min(input.width, input.height);
  return longestEdge < 2_200 || shortestEdge < 1_200;
}

/**
 * Optional bridge to a separately hosted Real-ESRGAN or SwinIR GPU worker.
 * The deterministic Sharp pipeline remains the fallback when this service is
 * not configured or temporarily unavailable.
 */
export async function enhanceWithConfiguredSuperResolution(input: {
  image: Buffer;
  mimeType: string;
  width: number;
  height: number;
}): Promise<StudioSuperResolutionResult | null> {
  const endpoint = process.env.STUDIO_SUPER_RESOLUTION_ENDPOINT?.trim();
  if (!endpoint || !shouldUseStudioSuperResolution(input)) return null;
  if (!supportedMimeType(input.mimeType)) return null;

  const model =
    process.env.STUDIO_SUPER_RESOLUTION_MODEL?.trim() || 'realesrgan-x4plus';
  const extension =
    input.mimeType === 'image/png'
      ? 'png'
      : input.mimeType === 'image/webp'
        ? 'webp'
        : 'jpg';
  const formData = new FormData();
  formData.set(
    'image',
    new Blob([new Uint8Array(input.image)], { type: input.mimeType }),
    `studio-source.${extension}`
  );
  formData.set('model', model);
  formData.set('scale', '2');
  formData.set('contentType', 'real-estate');

  const token = process.env.STUDIO_SUPER_RESOLUTION_TOKEN?.trim();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
    signal: AbortSignal.timeout(150_000),
  });
  const responseMimeType =
    response.headers.get('content-type')?.split(';')[0] ?? null;
  if (!response.ok || !supportedMimeType(responseMimeType)) {
    throw new Error('GPU görüntü iyileştirme servisi geçerli bir sonuç üretmedi.');
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_SUPER_RESOLUTION_BYTES) {
    throw new Error('GPU görüntü iyileştirme çıktısı güvenli boyut sınırını aşıyor.');
  }
  return { buffer, mimeType: responseMimeType, model };
}
