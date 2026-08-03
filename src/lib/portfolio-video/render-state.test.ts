import { describe, expect, it } from 'vitest';
import {
  initialPortfolioVideoRenderState,
  portfolioVideoRenderReducer,
  toPortfolioVideoRenderError,
} from './render-state';

describe('portfolio video render state', () => {
  it('ilerlemeyi 0-1 aralığında tutar ve başarıyı tamamlar', () => {
    const rendering = portfolioVideoRenderReducer(
      initialPortfolioVideoRenderState,
      { type: 'START' }
    );
    const progressed = portfolioVideoRenderReducer(rendering, {
      type: 'PROGRESS',
      progress: 1.7,
      estimatedTimeMs: 2500,
    });
    const completed = portfolioVideoRenderReducer(progressed, {
      type: 'SUCCESS',
      downloadUrl: 'blob:video-a',
    });

    expect(progressed.progress).toBe(1);
    expect(completed).toMatchObject({
      status: 'SUCCESS',
      progress: 1,
      downloadUrl: 'blob:video-a',
    });
  });

  it('iptalden sonra gelen geç ilerleme olayını yok sayar', () => {
    const cancelled = portfolioVideoRenderReducer(
      portfolioVideoRenderReducer(initialPortfolioVideoRenderState, {
        type: 'START',
      }),
      { type: 'CANCEL' }
    );
    const stale = portfolioVideoRenderReducer(cancelled, {
      type: 'PROGRESS',
      progress: 0.9,
      estimatedTimeMs: 100,
    });

    expect(stale).toEqual(cancelled);
    expect(stale.status).toBe('CANCELLED');
  });

  it('AbortError ve tarayıcı uyumsuzluğunu kullanıcı dostu Türkçe açıklar', () => {
    expect(
      toPortfolioVideoRenderError(
        new DOMException('The operation was aborted', 'AbortError')
      )
    ).toContain('iptal');
    expect(toPortfolioVideoRenderError(new Error('webcodecs-unavailable'))).toContain(
      'tarayıcı'
    );
  });
});
