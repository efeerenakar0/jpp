import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/hunting-v2/security', () => ({
  isPrivateOrReservedIp: () => false,
}));

vi.mock('@vercel/blob', () => ({ put: vi.fn() }));
import {
  MediaValidationError,
  normalizeMediaFileName,
  PROPERTY_MEDIA_MAX_FILE_BYTES,
  validatePropertyMediaFiles,
} from './media-storage';

function imageFile(
  name: string,
  type = 'image/jpeg',
  size = 4
) {
  return new File([new Uint8Array(size)], name, { type });
}

describe('validatePropertyMediaFiles', () => {
  it('JPG, PNG, WebP ve AVIF görselleri kabul eder', () => {
    expect(() =>
      validatePropertyMediaFiles([
        imageFile('a.jpg'),
        imageFile('b.png', 'image/png'),
        imageFile('c.webp', 'image/webp'),
        imageFile('d.avif', 'image/avif'),
      ])
    ).not.toThrow();
  });

  it('geçersiz MIME ve büyük dosyayı reddeder', () => {
    expect(() =>
      validatePropertyMediaFiles([imageFile('script.svg', 'image/svg+xml')])
    ).toThrow(MediaValidationError);
    expect(() =>
      validatePropertyMediaFiles([
        imageFile('large.jpg', 'image/jpeg', PROPERTY_MEDIA_MAX_FILE_BYTES + 1),
      ])
    ).toThrow(/15 MB/);
  });

  it('tek istekte on ikiden fazla dosyayı reddeder', () => {
    expect(() =>
      validatePropertyMediaFiles(
        Array.from({ length: 13 }, (_, index) => imageFile(`${index}.jpg`))
      )
    ).toThrow(/12/);
  });
});

describe('normalizeMediaFileName', () => {
  it('istemci dosya adını depolama yolu için güvenli hale getirir', () => {
    expect(normalizeMediaFileName('../../ Villa Görseli (1).jpg')).toBe(
      '..-..-Villa-Go-rseli-1-.jpg'
    );
  });
});
