import { describe, expect, it } from 'vitest';

import {
  isStudioImageType,
  STUDIO_MAX_PHOTOS,
  studioUploadAccountPrefix,
  studioUploadFileName,
} from './studio-upload';

describe('studio upload policy', () => {
  it('bir çalışmada 30 fotoğrafa izin verir', () => {
    expect(STUDIO_MAX_PHOTOS).toBe(30);
  });

  it('tenant yükleme yolunu ve dosya adını güvenli hale getirir', () => {
    expect(studioUploadAccountPrefix('hesap/1')).toBe('studio-source/hesap_1');
    expect(studioUploadFileName('../salon fotoğrafı.jpg')).toBe('salon-fotografi.jpg');
  });

  it('yalnız stüdyonun desteklediği görsel tiplerini kabul eder', () => {
    expect(isStudioImageType('image/jpeg')).toBe(true);
    expect(isStudioImageType('image/avif')).toBe(false);
  });
});
