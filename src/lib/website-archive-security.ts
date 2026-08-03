import AdmZip from 'adm-zip';

export const MAX_WEBSITE_ARCHIVE_FILES = 2_500;
export const MAX_WEBSITE_ARCHIVE_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
export const MAX_WEBSITE_ARCHIVE_ENTRY_BYTES = 50 * 1024 * 1024;
export const MAX_WEBSITE_ARCHIVE_COMPRESSION_RATIO = 150;

export type WebsiteArchiveEntryDescriptor = {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  directory: boolean;
  unixMode: number | null;
};

export class WebsiteArchiveSecurityError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_ARCHIVE'
      | 'UNSAFE_PATH'
      | 'SYMLINK'
      | 'TOO_MANY_FILES'
      | 'ENTRY_TOO_LARGE'
      | 'EXPANDED_SIZE_TOO_LARGE'
      | 'SUSPICIOUS_COMPRESSION',
    message: string
  ) {
    super(message);
    this.name = 'WebsiteArchiveSecurityError';
  }
}

function hasUnsafeArchivePath(name: string) {
  const normalized = name.replaceAll('\\', '/');
  if (
    normalized.startsWith('/') ||
    normalized.startsWith('//') ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    return true;
  }
  const segments = normalized.replace(/\/+$/u, '').split('/');
  return segments.some((segment) => segment === '..' || segment === '');
}

function isSymbolicLink(unixMode: number | null) {
  if (unixMode === null) return false;
  return (unixMode & 0o170000) === 0o120000;
}

export function validateWebsiteArchiveEntries(
  entries: WebsiteArchiveEntryDescriptor[]
) {
  let fileCount = 0;
  let totalUncompressedSize = 0;
  let totalCompressedSize = 0;

  for (const entry of entries) {
    if (hasUnsafeArchivePath(entry.name)) {
      throw new WebsiteArchiveSecurityError(
        'UNSAFE_PATH',
        'ZIP arşivinde güvenli olmayan mutlak veya üst dizin yolu bulundu.'
      );
    }
    if (isSymbolicLink(entry.unixMode)) {
      throw new WebsiteArchiveSecurityError(
        'SYMLINK',
        'ZIP arşivinde sembolik bağlantı kullanılamaz.'
      );
    }
    if (entry.directory) continue;

    fileCount += 1;
    if (fileCount > MAX_WEBSITE_ARCHIVE_FILES) {
      throw new WebsiteArchiveSecurityError(
        'TOO_MANY_FILES',
        `ZIP arşivi en fazla ${MAX_WEBSITE_ARCHIVE_FILES} dosya içerebilir.`
      );
    }
    if (entry.uncompressedSize > MAX_WEBSITE_ARCHIVE_ENTRY_BYTES) {
      throw new WebsiteArchiveSecurityError(
        'ENTRY_TOO_LARGE',
        'ZIP arşivindeki tek bir dosyanın açılmış boyutu güvenlik sınırını aşıyor.'
      );
    }

    totalUncompressedSize += Math.max(0, entry.uncompressedSize);
    totalCompressedSize += Math.max(0, entry.compressedSize);
    if (
      totalUncompressedSize > MAX_WEBSITE_ARCHIVE_UNCOMPRESSED_BYTES
    ) {
      throw new WebsiteArchiveSecurityError(
        'EXPANDED_SIZE_TOO_LARGE',
        'ZIP arşivinin toplam açılmış boyutu güvenlik sınırını aşıyor.'
      );
    }
  }

  const compressionRatio =
    totalCompressedSize > 0
      ? totalUncompressedSize / totalCompressedSize
      : totalUncompressedSize > 0
        ? Number.POSITIVE_INFINITY
        : 1;
  if (compressionRatio > MAX_WEBSITE_ARCHIVE_COMPRESSION_RATIO) {
    throw new WebsiteArchiveSecurityError(
      'SUSPICIOUS_COMPRESSION',
      'ZIP arşivinin sıkıştırma oranı güvenli sınırı aşıyor.'
    );
  }

  return { fileCount, totalUncompressedSize, compressionRatio };
}

export function inspectWebsiteArchive(buffer: Buffer) {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new WebsiteArchiveSecurityError(
      'INVALID_ARCHIVE',
      'ZIP arşivi okunamadı veya geçersiz.'
    );
  }

  try {
    const descriptors = zip.getEntries().map((entry) => {
      const unixMode = entry.attr ? (entry.attr >>> 16) & 0xffff : null;
      return {
        name: entry.entryName,
        compressedSize: Number(entry.header.compressedSize || 0),
        uncompressedSize: Number(entry.header.size || 0),
        directory: entry.isDirectory,
        unixMode,
      } satisfies WebsiteArchiveEntryDescriptor;
    });
    return validateWebsiteArchiveEntries(descriptors);
  } catch (error) {
    if (error instanceof WebsiteArchiveSecurityError) throw error;
    throw new WebsiteArchiveSecurityError(
      'INVALID_ARCHIVE',
      'ZIP arşivinin içeriği doğrulanamadı.'
    );
  }
}
