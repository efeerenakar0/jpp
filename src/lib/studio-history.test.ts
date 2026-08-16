import { describe, expect, it } from 'vitest';

import {
  groupStudioBatchHistory,
  summarizeStudioBatchHistory,
} from './studio-history';

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

describe('studio geçmiş çalışma gruplaması', () => {
  it('aynı çalışmadaki beş fotoğrafı geçmişte tek kartta gruplar', () => {
    const entries = groupStudioBatchHistory([
      {
        id: 'batch-1',
        title: 'Modern Villa',
        status: 'COMPLETED',
        createdAt: '2026-08-14T00:00:00.000Z',
        property: null,
        items: Array.from({ length: 5 }, (_, index) => ({
          id: `item-${index + 1}`,
          status: 'COMPLETED' as const,
          originalFileName: `villa-${index + 1}.jpg`,
          originalUrl: `https://example.com/original-${index + 1}.jpg`,
          outputUrl: `https://example.com/output-${index + 1}.jpg`,
          outputFileName: `villa-${index + 1}-iyilestirilmis.jpg`,
          attachedMediaId: null,
        })),
      },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      batchId: 'batch-1',
      batchTitle: 'Modern Villa',
      itemCount: 5,
      readyItemIds: ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'],
    });
  });
});
