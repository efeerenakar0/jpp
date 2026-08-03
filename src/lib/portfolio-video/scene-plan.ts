import { z } from 'zod';

export const portfolioVideoOverlayTypeSchema = z.enum([
  'BRAND',
  'TITLE',
  'DESCRIPTION',
  'PRICE',
  'LOCATION',
  'DETAILS',
  'FEATURES',
  'CONTACT',
  'INSTAGRAM',
  'CUSTOM',
]);

export const portfolioVideoOverlaySchema = z.object({
  type: portfolioVideoOverlayTypeSchema,
  text: z.string().max(120).nullable().default(null),
  animation: z.enum(['FADE', 'SLIDE_UP', 'POP', 'TYPE']).default('FADE'),
  position: z.enum(['TOP', 'CENTER', 'BOTTOM']).default('BOTTOM'),
  revealAtFrame: z.number().int().min(0).max(300).default(0),
});

export const portfolioVideoPlannedSceneSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(['HOOK', 'GALLERY', 'FEATURES', 'DETAILS', 'CONTACT']),
  durationInFrames: z.number().int().min(30).max(300),
  photoIndices: z.array(z.number().int().min(0).max(23)).max(8),
  layout: z.enum(['FULL_BLEED', 'FRAMED', 'FEATURE_GRID', 'CONTACT_CARD']),
  transition: z.enum(['CUT', 'FADE', 'SLIDE']),
  photoMotion: z.enum(['ZOOM', 'PAN', 'STILL']),
  headline: z.string().max(120),
  body: z.string().max(260).nullable(),
  overlays: z.array(portfolioVideoOverlaySchema).max(10),
});

export const portfolioVideoScenePlanSchema = z.object({
  summary: z.string().min(1).max(240),
  scenes: z.array(portfolioVideoPlannedSceneSchema).min(3).max(10),
});

export type PortfolioVideoScenePlan = z.infer<typeof portfolioVideoScenePlanSchema>;

const aiOverlaySchema = portfolioVideoOverlaySchema.extend({
  revealAtFrame: z.coerce.number().int().min(0).max(300).default(0),
});

const aiSceneSchema = z.object({
  type: z.enum(['HOOK', 'GALLERY', 'FEATURES', 'DETAILS', 'CONTACT']),
  durationSeconds: z.coerce.number().min(1).max(12),
  photoIndices: z.array(z.coerce.number().int()).max(8).default([]),
  layout: z.enum(['FULL_BLEED', 'FRAMED', 'FEATURE_GRID', 'CONTACT_CARD']),
  transition: z.enum(['CUT', 'FADE', 'SLIDE']),
  photoMotion: z.enum(['ZOOM', 'PAN', 'STILL']),
  headline: z.string().max(300).default(''),
  body: z.string().max(800).nullable().default(null),
  overlays: z.array(aiOverlaySchema).max(10).default([]),
});

const aiPlanSchema = z.object({
  summary: z.string().min(1).max(500),
  scenes: z.array(aiSceneSchema).min(3).max(10),
});

function normalizeTurkish(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replaceAll('ı', 'i')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeCopy(value: string | null | undefined, maxLength: number) {
  if (!value) return value ?? null;
  const clean = value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\b(?:eval|function|window|document|javascript|script)\b(?:\.[a-z0-9_$]+)?/gi, ' ')
    .replace(/[{};$`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  return clean.slice(0, maxLength);
}

function normalizeDurations(seconds: number[]) {
  const sceneCount = seconds.length;
  const minimumTotal = sceneCount * 30;
  const distributable = 450 - minimumTotal;
  const weightTotal = seconds.reduce((sum, value) => sum + value, 0) || sceneCount;
  const frames = seconds.map((value) => 30 + Math.floor((value / weightTotal) * distributable));
  let remaining = 450 - frames.reduce((sum, value) => sum + value, 0);
  let cursor = 0;
  while (remaining > 0) {
    frames[cursor % frames.length] += 1;
    cursor += 1;
    remaining -= 1;
  }
  return frames;
}

function validPhotoIndices(indices: number[], photoCount: number) {
  if (photoCount <= 0) return [];
  return [...new Set(indices.filter((index) => index >= 0 && index < photoCount))].slice(0, 8);
}

export function parseCreativeScenePlan(rawPlan: unknown, options: { photoCount: number }) {
  const parsed = aiPlanSchema.parse(rawPlan);
  const durations = normalizeDurations(parsed.scenes.map((scene) => scene.durationSeconds));
  return portfolioVideoScenePlanSchema.parse({
    summary: safeCopy(parsed.summary, 240) || 'Özel sahne planı',
    scenes: parsed.scenes.map((scene, index) => {
      const durationInFrames = durations[index];
      const photoIndices = validPhotoIndices(scene.photoIndices, options.photoCount);
      return {
        id: `scene-${index + 1}-${scene.type.toLocaleLowerCase('tr-TR')}`,
        type: scene.type,
        durationInFrames,
        photoIndices:
          photoIndices.length || options.photoCount <= 0
            ? photoIndices
            : [Math.min(index, options.photoCount - 1)],
        layout: scene.layout,
        transition: scene.transition,
        photoMotion: scene.photoMotion,
        headline: safeCopy(scene.headline, 120) || '',
        body: safeCopy(scene.body, 260),
        overlays: scene.overlays.map((overlay) => ({
          ...overlay,
          text: safeCopy(overlay.text, 120),
          revealAtFrame: Math.min(overlay.revealAtFrame, durationInFrames - 1),
        })),
      };
    }),
  });
}

type LocalScenePlanInput = {
  command: string;
  photoCount: number;
  showPrice: boolean;
  showLocation: boolean;
  instagramUrl: string | null;
};

type DraftScene = Omit<
  z.input<typeof aiSceneSchema>,
  'durationSeconds'
> & { durationSeconds: number };

function overlay(
  type: z.infer<typeof portfolioVideoOverlayTypeSchema>,
  options: Partial<z.infer<typeof portfolioVideoOverlaySchema>> = {}
) {
  return portfolioVideoOverlaySchema.parse({ type, ...options });
}

export function buildLocalScenePlan(input: LocalScenePlanInput): PortfolioVideoScenePlan {
  const command = normalizeTurkish(input.command);
  const sequentialPhotos = Array.from(
    { length: Math.max(0, input.photoCount - 1) },
    (_, index) => index + 1
  );
  const wantsPriceReveal = input.showPrice && /fiyat/.test(command) &&
    /bir anda|aniden|belir|patla|sonra/.test(command);
  const wantsInstagram = /instagram|insta/.test(command);
  const minimal = /sade|minimal|az efekt/.test(command);
  const energetic = /dikkat cekici|enerjik|hizli|guclu|bir anda|patla|animasyon/.test(command);
  const cinematic = /luks|sinematik|zarif|yavas/.test(command);
  const transition = energetic ? 'SLIDE' : cinematic ? 'FADE' : minimal ? 'CUT' : 'FADE';
  const motion = minimal ? 'STILL' : cinematic ? 'PAN' : 'ZOOM';
  const scenes: DraftScene[] = [
    {
      type: 'HOOK',
      durationSeconds: wantsPriceReveal ? 2 : 3,
      photoIndices: input.photoCount ? [0] : [],
      layout: 'FULL_BLEED',
      transition: cinematic ? 'FADE' : 'CUT',
      photoMotion: motion,
      headline: 'Portföyü keşfedin',
      body: null,
      overlays: [
        overlay('BRAND', { animation: 'FADE', position: 'TOP' }),
        overlay('TITLE', { animation: energetic ? 'POP' : 'SLIDE_UP', position: 'BOTTOM', revealAtFrame: 8 }),
      ],
    },
  ];

  if (wantsPriceReveal) {
    scenes.push({
      type: 'DETAILS',
      durationSeconds: 2.5,
      photoIndices: input.photoCount ? [0] : [],
      layout: 'FULL_BLEED',
      transition: 'CUT',
      photoMotion: 'STILL',
      headline: 'Fiyat',
      body: null,
      overlays: [
        overlay('PRICE', { animation: 'POP', position: 'CENTER', revealAtFrame: 18 }),
        ...(input.showLocation ? [overlay('LOCATION', { animation: 'SLIDE_UP', position: 'BOTTOM', revealAtFrame: 28 })] : []),
      ],
    });
  }

  scenes.push({
    type: 'GALLERY',
    durationSeconds: minimal ? 7 : wantsPriceReveal ? 6.5 : 5,
    photoIndices: sequentialPhotos.length ? sequentialPhotos : input.photoCount ? [0] : [],
    layout: 'FRAMED',
    transition,
    photoMotion: motion,
    headline: minimal ? '' : 'Portföyün diğer kareleri',
    body: null,
    overlays: minimal ? [] : [overlay('DESCRIPTION', { animation: 'FADE', position: 'BOTTOM', revealAtFrame: 8 })],
  });

  if (!minimal && !wantsPriceReveal) {
    scenes.push({
      type: 'FEATURES',
      durationSeconds: 3,
      photoIndices: input.photoCount > 1 ? [1] : input.photoCount ? [0] : [],
      layout: 'FEATURE_GRID',
      transition,
      photoMotion: motion,
      headline: 'Öne çıkan özellikler',
      body: null,
      overlays: [overlay('FEATURES', { animation: 'SLIDE_UP', position: 'CENTER', revealAtFrame: 5 })],
    });
  }

  if (!minimal && !wantsPriceReveal) {
    scenes.push({
      type: 'DETAILS',
      durationSeconds: 2.5,
      photoIndices: input.photoCount > 2 ? [2] : input.photoCount ? [0] : [],
      layout: 'FULL_BLEED',
      transition,
      photoMotion: motion,
      headline: input.showPrice ? 'Portföy bilgileri' : 'Konum ve detaylar',
      body: null,
      overlays: [
        ...(input.showLocation ? [overlay('LOCATION', { animation: 'SLIDE_UP', position: 'TOP' })] : []),
        ...(input.showPrice ? [overlay('PRICE', { animation: energetic ? 'POP' : 'SLIDE_UP', position: 'CENTER', revealAtFrame: 8 })] : []),
        overlay('DETAILS', { animation: 'FADE', position: 'BOTTOM', revealAtFrame: 14 }),
      ],
    });
  }

  scenes.push({
    type: 'CONTACT',
    durationSeconds: wantsInstagram ? 4 : 3.5,
    photoIndices: input.photoCount ? [Math.max(0, input.photoCount - 1)] : [],
    layout: 'CONTACT_CARD',
    transition: wantsInstagram ? 'SLIDE' : 'FADE',
    photoMotion: wantsInstagram ? 'PAN' : motion,
    headline: wantsInstagram ? 'Instagram’da bizi takip edin' : 'Bu portföyü yakından görün',
    body: null,
    overlays: [
      overlay('BRAND', { animation: 'FADE', position: 'TOP' }),
      ...(wantsInstagram
        ? [overlay('INSTAGRAM', {
            text: input.instagramUrl,
            animation: 'SLIDE_UP',
            position: 'CENTER',
            revealAtFrame: 12,
          })]
        : []),
      overlay('CONTACT', { animation: energetic ? 'POP' : 'SLIDE_UP', position: 'BOTTOM', revealAtFrame: 18 }),
    ],
  });

  return parseCreativeScenePlan(
    {
      summary: wantsPriceReveal && wantsInstagram
        ? 'Ana fotoğraf, gecikmeli fiyat, sıralı fotoğraflar ve animasyonlu Instagram kapanışı'
        : minimal
          ? 'Sade fotoğraf akışı ve iletişim kapanışı'
          : 'Portföye özel dinamik tanıtım akışı',
      scenes,
    },
    { photoCount: input.photoCount }
  );
}
