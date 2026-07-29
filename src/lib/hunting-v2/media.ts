import { createHash } from 'node:crypto';
import { resolve4, resolve6 } from 'node:dns/promises';
import { put } from '@vercel/blob';
import { assertAllowedMediaUrl, isPrivateOrReservedIp } from './security';
import type { SourceProvider } from './types';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function validateMediaMetadata(input: {
  contentType: string | null;
  byteSize: number;
  maxBytes: number;
}) {
  const contentType = input.contentType?.split(';')[0]?.trim().toLowerCase();
  if (!contentType || !ALLOWED_IMAGE_MIME_TYPES.has(contentType)) {
    throw new Error('Görsel MIME türü izinli değil.');
  }
  if (
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.byteSize > input.maxBytes
  ) {
    throw new Error('Görsel boyut sınırını aşıyor.');
  }
  return { contentType, byteSize: input.byteSize };
}

async function assertPublicMediaUrl(
  value: string,
  provider: SourceProvider
) {
  const url = assertAllowedMediaUrl(value, provider);
  if (provider === 'FIXTURE') return url;
  const addresses = [
    ...(await resolve4(url.hostname).catch(() => [])),
    ...(await resolve6(url.hostname).catch(() => [])),
  ];
  if (
    !addresses.length ||
    addresses.some((address) => isPrivateOrReservedIp(address))
  ) {
    throw new Error('Medya host güvenli bir genel IP adresine çözülmedi.');
  }
  return url;
}

export async function copyHuntingImage(input: {
  companyAccountId: string;
  listingId: string;
  order: number;
  sourceUrl: string;
  provider: SourceProvider;
  redirectCount?: number;
}) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      'MEDIA_COPY yetkisi var ancak BLOB_READ_WRITE_TOKEN yapılandırılmamış.'
    );
  }
  const source = await assertPublicMediaUrl(input.sourceUrl, input.provider);
  const maxBytes = Math.max(
    1024,
    Math.min(
      25 * 1024 * 1024,
      Number(process.env.AVCI_MEDIA_MAX_BYTES || 12 * 1024 * 1024)
    )
  );
  const response = await fetch(source, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: 'image/jpeg,image/png,image/webp' },
  });
  if (response.status >= 300 && response.status < 400) {
    if ((input.redirectCount || 0) >= 3) {
      throw new Error('Medya yönlendirme sınırı aşıldı.');
    }
    const target = response.headers.get('location');
    if (!target) throw new Error('Medya yönlendirmesi geçersiz.');
    return copyHuntingImage({
      ...input,
      sourceUrl: new URL(target, source).toString(),
      redirectCount: (input.redirectCount || 0) + 1,
    });
  }
  if (!response.ok) {
    throw new Error(`Medya indirilemedi (${response.status}).`);
  }
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) {
    throw new Error('Görsel boyut sınırını aşıyor.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const metadata = validateMediaMetadata({
    contentType: response.headers.get('content-type'),
    byteSize: bytes.byteLength,
    maxBytes,
  });
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const extension =
    metadata.contentType === 'image/png'
      ? 'png'
      : metadata.contentType === 'image/webp'
        ? 'webp'
        : 'jpg';
  const safeCompanyAccountId = input.companyAccountId.replace(
    /[^a-zA-Z0-9_-]/g,
    '_'
  );
  const safeListingId = input.listingId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const pathname = [
    'hunting',
    safeCompanyAccountId,
    safeListingId,
    `${input.order}-${checksum.slice(0, 16)}.${extension}`,
  ].join('/');
  const blob = await put(pathname, bytes, {
    access: 'public',
    addRandomSuffix: false,
    contentType: metadata.contentType,
    token,
  });
  return {
    storageKey: blob.url,
    checksum,
    mimeType: metadata.contentType,
    byteSize: metadata.byteSize,
  };
}
