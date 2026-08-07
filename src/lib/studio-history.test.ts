import { describe, expect, it } from 'vitest';

import { summarizeStudioBatchHistory } from './studio-history';

describe('studio batch history summary', () => {
  it('tamamlanan ve hata veren dosyaları terminal ilerlemeye dahil eder', () => {
    expect(
      summarizeStudioBatchHistory({
        batchStatus: 'PARTIAL',
        itemStatuses: ['COMPLETED', 'ATTACHED', 'FAILED', 'PROCESSING'],
      })
    ).toMatchObject({
      completed: 2,
      failed: 1,
      progress: 75,
      ready: true,
      openable: true,
      label: 'Hazır',
    });
  });

  it('tamamı hata veren çalışmayı tekrar denemek için açılabilir tutar', () => {
    expect(
      summarizeStudioBatchHistory({
        batchStatus: 'FAILED',
        itemStatuses: ['FAILED', 'FAILED'],
      })
    ).toEqual({
      completed: 0,
      failed: 2,
      progress: 100,
      ready: false,
      openable: true,
      label: 'Başarısız',
    });
  });

  it('henüz çalışan işi sonuç ekranına açmaz', () => {
    expect(
      summarizeStudioBatchHistory({
        batchStatus: 'PROCESSING',
        itemStatuses: ['PROCESSING', 'PENDING'],
      })
    ).toMatchObject({ progress: 0, openable: false, label: 'İşleniyor' });
  });
});
