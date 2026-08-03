import { z } from 'zod';
import { portfolioVideoOverlaySchema } from './scene-plan';

export const portfolioVideoPhotoSchema = z.object({
  id: z.string().min(1).max(120),
  url: z.string().min(1).max(8_000),
  fileName: z.string().min(1).max(240),
  isCover: z.boolean(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});

export const portfolioVideoPortfolioSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(1).max(300),
  referenceCode: z.string().max(100).nullable(),
  location: z.string().max(500).nullable(),
  price: z.number().nonnegative().finite().nullable(),
  roomCount: z.string().max(80).nullable(),
  area: z.number().positive().finite().nullable(),
  description: z.string().max(20_000).nullable(),
  features: z.array(z.string().min(1).max(120)).max(8),
  status: z.enum(['DRAFT', 'ACTIVE', 'RESERVED']),
  photos: z.array(portfolioVideoPhotoSchema).max(24),
  company: z.object({
    name: z.string().min(1).max(200),
    logoUrl: z.string().max(2_000_000).nullable(),
    instagramUrl: z.string().max(1_000).nullable().default(null),
  }),
  advisor: z.object({
    name: z.string().min(1).max(200),
    phone: z.string().max(80).nullable(),
    email: z.string().max(320).nullable(),
  }),
});

export const portfolioVideoCatalogSchema = z.object({
  portfolios: z.array(portfolioVideoPortfolioSchema).max(500),
});

export const portfolioVideoStyleSchema = z.enum([
  'BALANCED',
  'BOLD',
  'CINEMATIC',
  'FAMILY',
  'INVESTMENT',
  'MINIMAL',
]);

export const portfolioVideoCreativeChoiceSchema = z.union([
  portfolioVideoStyleSchema,
  z.literal('CUSTOM'),
]);

export const portfolioVideoDirectionSchema = z.object({
  style: portfolioVideoStyleSchema,
  pace: z.enum(['FAST', 'MEDIUM', 'SLOW']),
  tone: z.enum(['CONFIDENT', 'ELEGANT', 'WARM', 'ANALYTICAL', 'CLEAN']),
  effectIntensity: z.number().min(0).max(1),
  galleryTransition: z.enum(['CUT', 'FADE', 'SLIDE']),
  photoMotion: z.enum(['ZOOM', 'PAN', 'STILL']),
  showPrice: z.boolean(),
  openingMessage: z.string().max(120).nullable(),
  closingMessage: z.string().max(120).nullable(),
  commandSummary: z.string().max(240),
});

export const portfolioVideoSceneSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(['HOOK', 'GALLERY', 'FEATURES', 'DETAILS', 'CONTACT']),
  fromFrame: z.number().int().nonnegative(),
  toFrame: z.number().int().positive(),
  headline: z.string().max(120),
  body: z.string().max(260).nullable(),
  photoIndices: z.array(z.number().int().min(0).max(23)).max(8).default([]),
  layout: z.enum(['FULL_BLEED', 'FRAMED', 'FEATURE_GRID', 'CONTACT_CARD']).default('FULL_BLEED'),
  transition: z.enum(['CUT', 'FADE', 'SLIDE']).default('FADE'),
  photoMotion: z.enum(['ZOOM', 'PAN', 'STILL']).default('ZOOM'),
  overlays: z.array(portfolioVideoOverlaySchema).max(10).default([]),
});

export const portfolioVideoStoryboardSchema = z.object({
  width: z.literal(1080),
  height: z.literal(1920),
  fps: z.literal(30),
  durationInFrames: z.literal(450),
  title: z.string().min(1).max(72),
  referenceCode: z.string().max(100).nullable(),
  locationLabel: z.string().min(1).max(100),
  priceLabel: z.string().max(100).nullable(),
  detailLabels: z.array(z.string().min(1).max(80)).max(6),
  featureLabels: z.array(z.string().min(1).max(90)).max(5),
  photoUrls: z.array(z.string().min(1).max(8_000)).max(8),
  showPrice: z.boolean(),
  showLocation: z.boolean(),
  companyName: z.string().min(1).max(120),
  companyLogoUrl: z.string().max(2_000_000).nullable(),
  advisorName: z.string().min(1).max(120),
  advisorPhone: z.string().max(80).nullable(),
  advisorEmail: z.string().max(200).nullable(),
  instagramUrl: z.string().max(1_000).nullable().default(null),
  direction: portfolioVideoDirectionSchema,
  planSummary: z.string().min(1).max(240).default('Portföye özel tanıtım akışı'),
  scenes: z.array(portfolioVideoSceneSchema).min(3).max(10),
});

export type PortfolioVideoPhoto = z.infer<typeof portfolioVideoPhotoSchema>;
export type PortfolioVideoPortfolio = z.infer<typeof portfolioVideoPortfolioSchema>;
export type PortfolioVideoCatalog = z.infer<typeof portfolioVideoCatalogSchema>;
export type PortfolioVideoStyle = z.infer<typeof portfolioVideoStyleSchema>;
export type PortfolioVideoCreativeChoice = z.infer<typeof portfolioVideoCreativeChoiceSchema>;
export type PortfolioVideoDirection = z.infer<typeof portfolioVideoDirectionSchema>;
export type PortfolioVideoScene = z.infer<typeof portfolioVideoSceneSchema>;
export type PortfolioVideoStoryboard = z.infer<typeof portfolioVideoStoryboardSchema>;

export type PortfolioPromoVideoProps = {
  storyboard: PortfolioVideoStoryboard;
};
