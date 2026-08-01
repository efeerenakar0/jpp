export type StudioImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

function matches(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function detectStudioImageMimeType(
  bytes: Uint8Array
): StudioImageMimeType | null {
  if (bytes.length >= 3 && matches(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    matches(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    matches(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }
  return null;
}
