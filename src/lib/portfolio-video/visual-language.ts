import type { AiVideoFormat, AiVideoPlan } from './ai-video-types';

type Scene = AiVideoPlan['scenes'][number];

export type SceneComposition =
  | 'EDITORIAL_HERO'
  | 'CINEMATIC_IMAGE'
  | 'PRICE_SPOTLIGHT'
  | 'FEATURE_MATRIX'
  | 'LOCATION_EDITORIAL'
  | 'CONTACT_GLASS'
  | 'BRAND_FINALE'
  | 'KEN_BURNS_GALLERY'
  | 'DUAL_FRAME';

const COMPOSITIONS: Record<Scene['helper'], SceneComposition> = {
  Hero: 'EDITORIAL_HERO',
  PropertyImage: 'CINEMATIC_IMAGE',
  PriceCard: 'PRICE_SPOTLIGHT',
  FeatureGrid: 'FEATURE_MATRIX',
  LocationCard: 'LOCATION_EDITORIAL',
  CTA: 'CONTACT_GLASS',
  LogoOutro: 'BRAND_FINALE',
  KenBurns: 'KEN_BURNS_GALLERY',
  SplitScreen: 'DUAL_FRAME',
};

export function transitionDurationFor(scene: Scene) {
  return Math.max(6, Math.min(18, Math.floor(scene.durationInFrames / 3)));
}

export function headlineSizeFor(
  headline: string | null,
  format: AiVideoFormat,
  helper: Scene['helper'],
) {
  const length = headline?.trim().length ?? 0;
  const base = format === '9:16' ? 92 : format === '1:1' ? 78 : 70;
  const helperScale = helper === 'PriceCard' ? 1.1 : helper === 'LogoOutro' ? 0.9 : 1;
  const lengthScale = length > 72 ? 0.66 : length > 48 ? 0.76 : length > 28 ? 0.88 : 1;
  return Math.round(base * helperScale * lengthScale);
}

export function resolveSceneVisualSpec(scene: Scene, format: AiVideoFormat) {
  const vertical = format === '9:16';
  const square = format === '1:1';
  return {
    composition: COMPOSITIONS[scene.helper],
    safePaddingX: vertical ? 84 : square ? 72 : 88,
    safePaddingY: vertical ? 126 : square ? 82 : 64,
    maxContentWidth: vertical ? 900 : square ? 940 : 1320,
    headlineSize: headlineSizeFor(scene.headline, format, scene.helper),
    bodySize: vertical ? 34 : 30,
    transitionFrames: transitionDurationFor(scene),
    cardRadius: vertical ? 34 : 28,
  } as const;
}
