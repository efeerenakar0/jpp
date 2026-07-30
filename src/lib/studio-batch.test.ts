import { describe, expect, it, vi } from 'vitest';

import { processStudioBatch } from './studio-batch';

describe('processStudioBatch', () => {
  it('keeps successful images when another image is rejected', async () => {
    const onProgress = vi.fn();
    const result = await processStudioBatch({
      items: ['salon.jpg', 'cephe.jpg', 'mutfak.jpg'],
      getName: (name) => name,
      process: async (name) => {
        if (name === 'cephe.jpg') {
          throw new Error('Bu görsel güvenlik denetiminden geçemedi.');
        }
        return `${name}:iyilestirildi`;
      },
      onProgress,
    });

    expect(result.successes).toEqual([
      'salon.jpg:iyilestirildi',
      'mutfak.jpg:iyilestirildi',
    ]);
    expect(result.failures).toEqual([
      {
        name: 'cephe.jpg',
        message: 'Bu görsel güvenlik denetiminden geçemedi.',
      },
    ]);
    expect(onProgress).toHaveBeenLastCalledWith({
      completed: 3,
      total: 3,
      name: 'mutfak.jpg',
    });
  });

  it('uses a safe Turkish fallback for unknown failures and continues', async () => {
    const result = await processStudioBatch({
      items: ['bir.jpg', 'iki.jpg'],
      getName: (name) => name,
      process: async (name) => {
        if (name === 'bir.jpg') throw 'unknown failure';
        return name;
      },
    });

    expect(result.successes).toEqual(['iki.jpg']);
    expect(result.failures).toEqual([
      {
        name: 'bir.jpg',
        message: 'Görsel işlenemedi. Lütfen yeniden deneyin.',
      },
    ]);
  });
});
