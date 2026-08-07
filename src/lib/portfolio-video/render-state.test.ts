import { describe, expect, it } from 'vitest';
import {
  initialPortfolioVideoRenderState,
  shouldRequestFreshPortfolioVideoPlan,
  portfolioVideoRenderReducer,
  toPortfolioVideoRenderError,
} from './render-state';

describe('portfolio video render state', () => {
  it('AI planlama ve MP4 kodlama aşamalarını ayrı, iptal edilebilir durumlar olarak izler', () => {
    const planning = portfolioVideoRenderReducer(
      initialPortfolioVideoRenderState,
      { type: 'PLAN' }
    );
    const rendering = portfolioVideoRenderReducer(planning, { type: 'START' });
    const encoding = portfolioVideoRenderReducer(rendering, { type: 'ENCODE' });

    expect(planning).toMatchObject({ status: 'PLANNING', progress: 0 });
    expect(encoding).toMatchObject({ status: 'ENCODING', progress: 0.95 });
    expect(
      portfolioVideoRenderReducer(encoding, { type: 'CANCEL' })
    ).toMatchObject({ status: 'CANCELLED', progress: 0 });
  });

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

  it('ilk renderda plansızsa ve kullanıcı yeni varyasyon isterse yeni plan ister', () => {
    expect(
      shouldRequestFreshPortfolioVideoPlan({
        hasDirectedStoryboard: false,
        forceNewVariation: false,
      })
    ).toBe(true);
    expect(
      shouldRequestFreshPortfolioVideoPlan({
        hasDirectedStoryboard: true,
        forceNewVariation: true,
      })
    ).toBe(true);
  });

  it('hazır planın normal yeniden renderında aynı doğrulanmış planı korur', () => {
    expect(
      shouldRequestFreshPortfolioVideoPlan({
        hasDirectedStoryboard: true,
        forceNewVariation: false,
      })
    ).toBe(false);
  });
});
