import { z } from 'zod';

export const aiVideoFormatSchema = z.enum(['9:16', '1:1', '16:9']);
export const aiVideoDurationSchema = z.union([z.literal(15), z.literal(30)]);
export const aiVideoHelperSchema = z.enum([
  'PropertyImage', 'Hero', 'PriceCard', 'FeatureGrid', 'LocationCard',
  'CTA', 'LogoOutro', 'KenBurns', 'SplitScreen',
]);
export const aiVideoFactRefSchema = z.enum([
  'TITLE', 'REFERENCE', 'PRICE', 'LOCATION', 'ROOMS', 'AREA',
  'FEATURE_1', 'FEATURE_2', 'FEATURE_3', 'FEATURE_4', 'FEATURE_5',
  'COMPANY_NAME',
]);

export const aiVideoAssetSchema = z.object({
  assetId: z.string().min(1).max(120),
  index: z.number().int().min(0).max(7),
  isCover: z.boolean(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

export const aiVideoModelPortfolioSchema = z.object({
  title: z.string().min(1).max(160),
  referenceCode: z.string().max(80).nullable(),
  location: z.string().max(160).nullable(),
  priceLabel: z.string().max(80).nullable(),
  roomCount: z.string().max(40).nullable(),
  areaLabel: z.string().max(40).nullable(),
  description: z.string().max(1_200).nullable(),
  features: z.array(z.string().min(1).max(100)).max(5),
  companyName: z.string().min(1).max(120),
  assets: z.array(aiVideoAssetSchema).min(1).max(8),
});

export const aiVideoSceneSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  helper: aiVideoHelperSchema,
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().min(15).max(900),
  assetIds: z.array(z.string().min(1).max(120)).max(4),
  factRefs: z.array(aiVideoFactRefSchema).max(6),
  headline: z.string().max(90).nullable(),
  body: z.string().max(160).nullable(),
  motion: z.enum(['STILL', 'ZOOM_IN', 'ZOOM_OUT', 'PAN_LEFT', 'PAN_RIGHT', 'FLOAT']),
  transition: z.enum(['CUT', 'FADE', 'SLIDE', 'WIPE', 'SCALE']),
  layout: z.enum(['FULL', 'CENTER', 'LEFT', 'RIGHT', 'GRID', 'SPLIT']),
});

export const aiVideoPlanSchema = z.object({
  schemaVersion: z.literal(1),
  creativeSeed: z.number().int().min(0).max(2_147_483_647),
  format: aiVideoFormatSchema,
  durationSeconds: aiVideoDurationSchema,
  fps: z.literal(30),
  width: z.union([z.literal(1080), z.literal(1920)]),
  height: z.union([z.literal(1080), z.literal(1920)]),
  theme: z.object({
    background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    font: z.enum(['MODERN', 'EDITORIAL', 'BOLD', 'MINIMAL']),
  }),
  scenes: z.array(aiVideoSceneSchema).min(3).max(12),
}).superRefine((plan, context) => {
  const expected = plan.durationSeconds * plan.fps;
  const dimensions = plan.format === '9:16'
    ? [1080, 1920]
    : plan.format === '16:9'
      ? [1920, 1080]
      : [1080, 1080];
  if (plan.width !== dimensions[0] || plan.height !== dimensions[1]) {
    context.addIssue({ code: 'custom', message: 'Video ölçüleri seçilen formatla uyuşmuyor.' });
  }
  const ordered = [...plan.scenes].sort((a, b) => a.startFrame - b.startFrame);
  if (ordered[0]?.startFrame !== 0) {
    context.addIssue({ code: 'custom', message: 'İlk sahne sıfırıncı karede başlamalı.' });
  }
  for (let index = 0; index < ordered.length; index += 1) {
    const scene = ordered[index];
    if (!scene) continue;
    const end = scene.startFrame + scene.durationInFrames;
    if (end > expected) context.addIssue({ code: 'custom', message: 'Sahne video süresini aşıyor.' });
    const next = ordered[index + 1];
    if (next && next.startFrame < end) context.addIssue({ code: 'custom', message: 'Sahneler çakışamaz.' });
  }
  const last = ordered.at(-1);
  if (!last || last.startFrame + last.durationInFrames !== expected) {
    context.addIssue({ code: 'custom', message: 'Sahneler seçilen sürenin tamamını kapsamalı.' });
  }
});

export const aiVideoProgramSchema = z.object({
  plan: aiVideoPlanSchema,
  code: z.string().min(100).max(40_000),
});

export type AiVideoFormat = z.infer<typeof aiVideoFormatSchema>;
export type AiVideoDuration = z.infer<typeof aiVideoDurationSchema>;
export type AiVideoPlan = z.infer<typeof aiVideoPlanSchema>;
export type AiVideoModelPortfolio = z.infer<typeof aiVideoModelPortfolioSchema>;

export function aiVideoDimensions(format: AiVideoFormat) {
  if (format === '16:9') return { width: 1920 as const, height: 1080 as const };
  if (format === '1:1') return { width: 1080 as const, height: 1080 as const };
  return { width: 1080 as const, height: 1920 as const };
}
