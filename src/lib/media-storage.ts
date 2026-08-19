import { createHash } from 'node:crypto';
import { resolve4, resolve6 } from 'node:dns/promises';
import { del, put } from '@vercel/blob';
import { isPrivateOrReservedIp } from '@/lib/hunting-v2/security';

export const PROPERTY_MEDIA_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
export const PROPERTY_MEDIA_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const PROPERTY_MEDIA_MAX_FILES = 12;
export const PROPERTY_MEDIA_MAX_TOTAL_BYTES = 60 * 1024 * 1024;

export class MediaValidationError extends Error {
  status = 400;
}

export function normalizeMediaFileName(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(-100) || 'gorsel'
  );
}

export function validatePropertyMediaFiles(files: File[]) {
  if (!files.length) {
    throw new MediaValidationError('En az bir görsel seçin.');
  }
  if (files.length > PROPERTY_MEDIA_MAX_FILES) {
    throw new MediaValidationError(
      `Tek seferde en fazla ${PROPERTY_MEDIA_MAX_FILES} görsel yükleyebilirsiniz.`
    );
  }
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > PROPERTY_MEDIA_MAX_TOTAL_BYTES) {
    throw new MediaValidationError(
      'Seçilen görsellerin toplam boyutu 60 MB sınırını aşıyor.'
    );
  }
  for (const file of files) {
    if (!PROPERTY_MEDIA_MIME_TYPES.has(file.type)) {
      throw new MediaValidationError(
        `${file.name || 'Görsel'} desteklenmiyor. JPG, PNG, WebP veya AVIF kullanın.`
      );
    }
    if (file.size <= 0 || file.size > PROPERTY_MEDIA_MAX_FILE_BYTES) {
      throw new MediaValidationError(
        `${file.name || 'Görsel'} 15 MB veya daha küçük olmalıdır.`
      );
    }
  }
}

export async function persistPropertyMediaFile(input: {
  companyAccountId: string;
  propertyId: string;
  file: File;
  folder?: string;
}) {
  validatePropertyMediaFiles([input.file]);
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const safeAccountId = input.companyAccountId.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const safePropertyId = input.propertyId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFileName = normalizeMediaFileName(input.file.name);
  const pathname = [
    'property-media',
    safeAccountId,
    safePropertyId,
    input.folder ?? 'originals',
    `${checksum.slice(0, 20)}-${safeFileName}`,
  ].join('/');
  const blob = await put(pathname, bytes, {
    access: 'public',
    addRandomSuffix: false,
    contentType: input.file.type,
  });
  return {
    url: blob.url,
    storageKey: blob.pathname || pathname,
    fileName: safeFileName,
    mimeType: input.file.type,
    byteSize: bytes.byteLength,
    checksum,
  };
}

export async function persistGeneratedMedia(input: {
  companyAccountId: string;
  propertyId: string;
  bytes: Buffer;
  fileName: string;
  mimeType: string;
  folder: string;
}) {
  if (
    !PROPERTY_MEDIA_MIME_TYPES.has(input.mimeType) ||
    input.bytes.byteLength <= 0 ||
    input.bytes.byteLength > PROPERTY_MEDIA_MAX_FILE_BYTES
  ) {
    throw new MediaValidationError('Üretilen görsel geçerli değil.');
  }
  const checksum = createHash('sha256').update(input.bytes).digest('hex');
  const safeAccountId = input.companyAccountId.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const safePropertyId = input.propertyId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFileName = normalizeMediaFileName(input.fileName);
  const pathname = [
    'property-media',
    safeAccountId,
    safePropertyId,
    input.folder,
    `${checksum.slice(0, 20)}-${safeFileName}`,
  ].join('/');
  const blob = await put(pathname, input.bytes, {
    access: 'public',
    addRandomSuffix: false,
    contentType: input.mimeType,
  });
  return {
    url: blob.url,
    storageKey: blob.pathname || pathname,
    fileName: safeFileName,
    mimeType: input.mimeType,
    byteSize: input.bytes.byteLength,
    checksum,
  };
}

export async function persistStudioPosterOutput(input: {
  companyAccountId: string;
  generationId: string;
  attemptId: string;
  bytes: Buffer;
  format: 'post' | 'story';
}) {
  const mimeType = 'image/jpeg';
  if (
    input.bytes.byteLength <= 0 ||
    input.bytes.byteLength > PROPERTY_MEDIA_MAX_FILE_BYTES
  ) {
    throw new MediaValidationError('Üretilen poster geçerli değil.');
  }

  const checksum = createHash('sha256').update(input.bytes).digest('hex');
  const safeAccountId = input.companyAccountId.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const safeGenerationId = input.generationId.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const safeAttemptId = input.attemptId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const pathname = [
    'studio-posters',
    safeAccountId,
    safeGenerationId,
    `${safeAttemptId}-${checksum.slice(0, 20)}-${input.format}.jpg`,
  ].join('/');
  const blob = await put(pathname, input.bytes, {
    access: 'public',
    addRandomSuffix: false,
    contentType: mimeType,
  });

  return {
    url: blob.url,
    storageKey: blob.pathname || pathname,
    mimeType,
    byteSize: input.bytes.byteLength,
    checksum,
  };
}

export async function publishStudioPosterReference(input: {
  companyAccountId: string;
  attemptId: string;
  role: string;
  bytes: Buffer;
  mimeType: string;
}) {
  if (
    !PROPERTY_MEDIA_MIME_TYPES.has(input.mimeType) ||
    input.bytes.byteLength <= 0 ||
    input.bytes.byteLength > PROPERTY_MEDIA_MAX_FILE_BYTES
  ) {
    throw new MediaValidationError('Poster referans görseli geçerli değil.');
  }
  const checksum = createHash('sha256').update(input.bytes).digest('hex');
  const safeAccountId = input.companyAccountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeAttemptId = input.attemptId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeRole = input.role.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'source';
  const extension = input.mimeType === 'image/png'
    ? 'png'
    : input.mimeType === 'image/webp'
      ? 'webp'
      : input.mimeType === 'image/avif'
        ? 'avif'
        : 'jpg';
  const pathname = [
    'studio-poster-references',
    safeAccountId,
    safeAttemptId,
    `${safeRole}-${checksum.slice(0, 20)}.${extension}`,
  ].join('/');
  const blob = await put(pathname, input.bytes, {
    access: 'public',
    addRandomSuffix: false,
    contentType: input.mimeType,
  });
  return { url: blob.url, storageKey: blob.pathname || pathname };
}

export async function deleteStudioPosterReferences(storageKeys: string[]) {
  const uniqueKeys = Array.from(new Set(storageKeys.filter(Boolean)));
  if (!uniqueKeys.length) return;
  await del(uniqueKeys);
}

export async function fetchOwnedMediaBytes(
  value: string,
  options: { maxBytes?: number; redirects?: number } = {}
): Promise<{ bytes: Buffer; mimeType: string }> {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new MediaValidationError('Medya adresi güvenli HTTPS olmalıdır.');
  }
  const addresses = [
    ...(await resolve4(url.hostname).catch(() => [])),
    ...(await resolve6(url.hostname).catch(() => [])),
  ];
  if (
    !addresses.length ||
    addresses.some((address) => isPrivateOrReservedIp(address))
  ) {
    throw new MediaValidationError('Medya adresi güvenli değil.');
  }
  const maxBytes = options.maxBytes ?? PROPERTY_MEDIA_MAX_FILE_BYTES;
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: [...PROPERTY_MEDIA_MIME_TYPES].join(',') },
  });
  if (response.status >= 300 && response.status < 400) {
    if ((options.redirects ?? 0) >= 3) {
      throw new MediaValidationError('Medya yönlendirme sınırı aşıldı.');
    }
    const location = response.headers.get('location');
    if (!location) {
      throw new MediaValidationError('Medya yönlendirmesi geçersiz.');
    }
    return fetchOwnedMediaBytes(new URL(location, url).toString(), {
      ...options,
      redirects: (options.redirects ?? 0) + 1,
    });
  }
  if (!response.ok) {
    throw new MediaValidationError(`Medya indirilemedi (${response.status}).`);
  }
  const declaredBytes = Number(response.headers.get('content-length') || 0);
  if (declaredBytes > maxBytes) {
    throw new MediaValidationError('Medya boyut sınırını aşıyor.');
  }
  const mimeType =
    response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ||
    '';
  if (!PROPERTY_MEDIA_MIME_TYPES.has(mimeType)) {
    throw new MediaValidationError('Medya dosya türü desteklenmiyor.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) {
    throw new MediaValidationError('Medya boyut sınırını aşıyor.');
  }
  return { bytes, mimeType };
}
