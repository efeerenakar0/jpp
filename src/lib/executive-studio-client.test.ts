import { describe, expect, it } from 'vitest';
import {
  isExecutiveStudioBatchTerminal,
  mapStudioBatchItems,
} from './executive-studio-client';

describe('executive Studio client adapter', () => {
  it('maps every backend item to an independent popup progress state', () => {
    const media = mapStudioBatchItems([
      {
        id: 'pending',
        originalUrl: '/original-1.jpg',
        originalFileName: 'cephe.jpg',
        outputUrl: null,
        outputFileName: null,
        status: 'PENDING',
        errorMessage: null,
        attachedMediaId: null,
      },
      {
        id: 'complete',
        originalUrl: '/original-2.jpg',
        originalFileName: 'salon.jpg',
        outputUrl: '/enhanced-2.jpg',
        outputFileName: 'salon-enhanced.jpg',
        status: 'COMPLETED',
        errorMessage: null,
        attachedMediaId: null,
      },
      {
        id: 'failed',
        originalUrl: '/original-3.jpg',
        originalFileName: 'mutfak.jpg',
        outputUrl: null,
        outputFileName: null,
        status: 'FAILED',
        errorMessage: 'Sağlayıcı yanıt vermedi.',
        attachedMediaId: null,
      },
    ]);

    expect(media[0]).toMatchObject({ status: 'queued', progress: 10 });
    expect(media[1]).toMatchObject({
      status: 'ready',
      progress: 100,
      previewUrl: '/enhanced-2.jpg',
      originalUrl: '/original-2.jpg',
    });
    expect(media[2]).toMatchObject({
      status: 'error',
      error: 'Sağlayıcı yanıt vermedi.',
    });
  });

  it('preserves review choices while polling and detects terminal batches', () => {
    const items = [
      {
        id: 'complete',
        originalUrl: '/original.jpg',
        originalFileName: 'salon.jpg',
        outputUrl: '/enhanced.jpg',
        outputFileName: 'salon-enhanced.jpg',
        status: 'ATTACHED' as const,
        errorMessage: null,
        attachedMediaId: 'media-1',
      },
    ];
    const media = mapStudioBatchItems(items, [
      {
        id: 'complete',
        name: 'salon.jpg',
        size: 42,
        progress: 70,
        status: 'processing',
        removed: true,
        restoredToOriginal: true,
      },
    ]);

    expect(media[0]).toMatchObject({
      removed: true,
      restoredToOriginal: true,
      previewUrl: '/original.jpg',
      attachedMediaId: 'media-1',
    });
    expect(isExecutiveStudioBatchTerminal(items)).toBe(true);
    expect(
      isExecutiveStudioBatchTerminal([{ ...items[0], status: 'PROCESSING' }])
    ).toBe(false);
  });
});
