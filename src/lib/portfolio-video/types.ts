import { z } from 'zod';

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

export const portfolioVideoDirectionSchema = z.object({
  style: portfolioVideoStyleSchema,
  pace: z.enum(['FAST', 'MEDIUM', 'SLOW']),
  tone: z.enum(['CONFIDENT', 'ELEGANT', 'WARM', 'ANALYTICAL', 'CLEAN']),
  effectIntensity: z.number().min(0).max(1),
  showPrice: z.boolean(),
  commandSummary: z.string().max(240),
});

export const portfolioVideoSceneSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.enum(['HOOK', 'GALLERY', 'FEATURES', 'DETAILS', 'CONTACT']),
  fromFrame: z.number().int().nonnegative(),
  toFrame: z.number().int().positive(),
  headline: z.string().max(120),
  body: z.string().max(260).nullable(),
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
  direction: portfolioVideoDirectionSchema,
  scenes: z.array(portfolioVideoSceneSchema).length(5),
});

export type PortfolioVideoPhoto = z.infer<typeof portfolioVideoPhotoSchema>;
export type PortfolioVideoPortfolio = z.infer<typeof portfolioVideoPortfolioSchema>;
export type PortfolioVideoCatalog = z.infer<typeof portfolioVideoCatalogSchema>;
export type PortfolioVideoStyle = z.infer<typeof portfolioVideoStyleSchema>;
export type PortfolioVideoDirection = z.infer<typeof portfolioVideoDirectionSchema>;
export type PortfolioVideoScene = z.infer<typeof portfolioVideoSceneSchema>;
export type PortfolioVideoStoryboard = z.infer<typeof portfolioVideoStoryboardSchema>;

export type PortfolioPromoVideoProps = {
  storyboard: PortfolioVideoStoryboard;
};
