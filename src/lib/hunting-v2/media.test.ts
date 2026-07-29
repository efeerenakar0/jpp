import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { validateMediaMetadata } from './media';

describe('Avcı medya doğrulaması', () => {
  it('izinli görsel türünü ve boyutu kabul eder', () => {
    expect(
      validateMediaMetadata({
        contentType: 'image/jpeg',
        byteSize: 1024,
        maxBytes: 10_000,
      })
    ).toEqual({ contentType: 'image/jpeg', byteSize: 1024 });
  });

  it('çalıştırılabilir türü ve büyük dosyayı reddeder', () => {
    expect(() =>
      validateMediaMetadata({
        contentType: 'text/html',
        byteSize: 100,
        maxBytes: 10_000,
      })
    ).toThrow('Görsel MIME türü');
    expect(() =>
      validateMediaMetadata({
        contentType: 'image/png',
        byteSize: 20_000,
        maxBytes: 10_000,
      })
    ).toThrow('boyut sınırını');
  });
});
