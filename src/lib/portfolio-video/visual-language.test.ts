import { describe, expect, it } from 'vitest';
import type { AiVideoPlan } from './ai-video-types';
import {
  headlineSizeFor,
  resolveSceneVisualSpec,
  transitionDurationFor,
} from './visual-language';

const baseScene: AiVideoPlan['scenes'][number] = {
  id: 'scene-1',
  helper: 'Hero',
  startFrame: 0,
  durationInFrames: 90,
  assetIds: ['photo-1'],
  factRefs: ['TITLE'],
  headline: 'Deniz manzaralı seçkin yaşam',
  body: null,
  motion: 'ZOOM_IN',
  transition: 'FADE',
  layout: 'CENTER',
};

describe('portfolio video visual language', () => {
  it('her profesyonel sahne yardımcısına farklı bir kompozisyon verir', () => {
    const compositions = [
      'Hero',
      'PropertyImage',
      'PriceCard',
      'FeatureGrid',
      'LocationCard',
      'CTA',
      'LogoOutro',
      'KenBurns',
      'SplitScreen',
    ].map((helper) =>
      resolveSceneVisualSpec(
        { ...baseScene, helper: helper as AiVideoPlan['scenes'][number]['helper'] },
        '9:16',
      ).composition,
    );

    expect(new Set(compositions).size).toBe(compositions.length);
  });

  it('dikey videoda sosyal medya güvenli alanını korur', () => {
    const vertical = resolveSceneVisualSpec(baseScene, '9:16');
    const landscape = resolveSceneVisualSpec(baseScene, '16:9');

    expect(vertical.safePaddingX).toBeGreaterThanOrEqual(72);
    expect(vertical.safePaddingY).toBeGreaterThan(landscape.safePaddingY);
    expect(vertical.maxContentWidth).toBeLessThanOrEqual(920);
  });

  it('uzun başlıklarda taşmayı önlemek için tipografiyi küçültür', () => {
    expect(headlineSizeFor('Kısa başlık', '9:16', 'Hero')).toBeGreaterThan(
      headlineSizeFor('Alanya merkezde denize yakın, geniş teraslı ve yatırım fırsatı sunan seçkin yaşam alanı', '9:16', 'Hero'),
    );
  });

  it('geçiş süresini kısa sahnenin güvenli sınırında tutar', () => {
    expect(transitionDurationFor({ ...baseScene, durationInFrames: 30 })).toBeLessThanOrEqual(10);
    expect(transitionDurationFor(baseScene)).toBeGreaterThanOrEqual(12);
  });
});
