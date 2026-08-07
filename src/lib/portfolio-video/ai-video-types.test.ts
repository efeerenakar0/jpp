import { describe, expect, it } from 'vitest';
import { aiVideoPlanSchema } from './ai-video-types';

const basePlan = {
  schemaVersion: 1 as const,
  creativeSeed: 7,
  format: '9:16' as const,
  durationSeconds: 15 as const,
  fps: 30 as const,
  width: 1080 as const,
  height: 1920 as const,
  theme: {
    background: '#020817',
    surface: '#0b1728',
    text: '#ffffff',
    accent: '#22d3ee',
    font: 'MODERN' as const,
  },
  scenes: [
    { id: 'hero', helper: 'Hero' as const, startFrame: 0, durationInFrames: 150, assetIds: ['a'], factRefs: ['TITLE' as const], headline: 'Açılış', body: null, motion: 'ZOOM_IN' as const, transition: 'FADE' as const, layout: 'FULL' as const },
    { id: 'gallery', helper: 'SplitScreen' as const, startFrame: 150, durationInFrames: 150, assetIds: ['a'], factRefs: ['LOCATION' as const], headline: 'Galeri', body: null, motion: 'PAN_LEFT' as const, transition: 'SLIDE' as const, layout: 'SPLIT' as const },
    { id: 'outro', helper: 'LogoOutro' as const, startFrame: 300, durationInFrames: 150, assetIds: ['a'], factRefs: ['COMPANY_NAME' as const], headline: 'Final', body: null, motion: 'STILL' as const, transition: 'FADE' as const, layout: 'CENTER' as const },
  ],
};

describe('AI video plan continuity', () => {
  it('sahneler arasında boş kare bırakılmasına izin vermez', () => {
    const planWithGap = {
      ...basePlan,
      scenes: basePlan.scenes.map((scene, index) => index === 1
        ? { ...scene, startFrame: 165, durationInFrames: 135 }
        : scene),
    };

    expect(() => aiVideoPlanSchema.parse(planWithGap)).toThrow(/boşluk/i);
  });

  it('aynı sahne kimliğinin tekrar kullanılmasına izin vermez', () => {
    const duplicateId = {
      ...basePlan,
      scenes: basePlan.scenes.map((scene, index) => index === 1
        ? { ...scene, id: 'hero' }
        : scene),
    };

    expect(() => aiVideoPlanSchema.parse(duplicateId)).toThrow(/kimliği/i);
  });
});
