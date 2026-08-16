export const STUDIO_MAX_PHOTOS = 30;
export const STUDIO_MAX_FILE_BYTES = 9 * 1024 * 1024;
export const STUDIO_MAX_TOTAL_BYTES = 120 * 1024 * 1024;

export const STUDIO_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type StudioUploadedFile = {
  url: string;
  pathname: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

export function studioUploadAccountPrefix(companyAccountId: string) {
  const safeAccountId = companyAccountId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `studio-source/${safeAccountId}`;
}

export function isStudioImageType(value: string) {
  return (STUDIO_IMAGE_TYPES as readonly string[]).includes(value);
}

export function studioUploadFileName(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .replace(/[ıİ]/g, 'i')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[.-]+/, '')
      .replace(/-+$/g, '')
      .slice(-100) || 'fotograf.jpg'
  );
}
