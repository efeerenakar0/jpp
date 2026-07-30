import { describe, expect, it } from 'vitest';
import { summarizeStudioBatch } from './studio-batch-rules';

describe('summarizeStudioBatch', () => {
  it('tamamı başarılı batch için COMPLETED döndürür', () => {
    expect(summarizeStudioBatch(['COMPLETED', 'COMPLETED'])).toBe(
      'COMPLETED'
    );
  });

  it('kısmi başarıyı bütün batchi iptal etmeden PARTIAL olarak işaretler', () => {
    expect(summarizeStudioBatch(['COMPLETED', 'FAILED'])).toBe('PARTIAL');
  });

  it('tamamı başarısız batch için FAILED döndürür', () => {
    expect(summarizeStudioBatch(['FAILED', 'FAILED'])).toBe('FAILED');
  });

  it('devam eden en ileri durumu hesaplar', () => {
    expect(summarizeStudioBatch(['PENDING', 'UPLOADING'])).toBe('UPLOADING');
    expect(summarizeStudioBatch(['PENDING', 'PROCESSING'])).toBe(
      'PROCESSING'
    );
  });
});
