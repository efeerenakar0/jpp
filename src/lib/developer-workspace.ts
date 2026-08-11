import { z } from 'zod';

export const DEFAULT_CNAME_TARGET = 'cname.vercel-dns-0.com';

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Geçerli bir renk seçin.');

const optionalEmailSchema = z.union([
  z.literal(''),
  z.string().trim().email('Geçerli bir e-posta adresi girin.').max(320),
]);

const optionalUrlSchema = z.union([
  z.literal(''),
  z.string().trim().url('Geçerli bir bağlantı girin.').max(2_048),
]);

export const socialPlatformIdSchema = z.enum([
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'youtube',
  'x',
  'pinterest',
  'google-business',
  'whatsapp-business',
  'telegram',
]);

export type SocialPlatformId = z.infer<typeof socialPlatformIdSchema>;

export const socialAccountSchema = z
  .object({
    platform: socialPlatformIdSchema,
    username: z.string().trim().max(120),
    profileUrl: optionalUrlSchema,
    linkedEmail: optionalEmailSchema,
    linkedPhone: z.string().trim().max(40),
    twoFactorEnabled: z.boolean(),
    recoveryReady: z.boolean(),
    completedStep: z.number().int().min(0).max(8),
    notes: z.string().trim().max(4_000),
  })
  .strict();

export type SocialAccountNote = z.infer<typeof socialAccountSchema>;

const websiteFields = {
  mode: z.enum(['NEW', 'EXISTING']),
  brandName: z.string().trim().min(2, 'Marka adını girin.').max(160),
  logoData: z
    .union([
      z.literal(''),
      z
        .string()
        .max(3_000_000, 'Logo en fazla 2 MB olabilir.')
        .regex(/^data:image\/(?:png|jpeg|webp);base64,/, 'Logo PNG, JPG veya WEBP olmalı.'),
    ]),
  primaryColor: colorSchema,
  accentColor: colorSchema,
  contactEmail: optionalEmailSchema,
  contactPhone: z.string().trim().max(40),
  whatsappPhone: z.string().trim().max(40),
  address: z.string().trim().max(1_000),
  baseDomain: z.string().trim().max(253),
};

const saveWebsiteSchema = z
  .object({
    action: z.literal('save-website'),
    ...websiteFields,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.mode === 'EXISTING') {
      try {
        normalizeBaseDomain(value.baseDomain);
      } catch (error) {
        context.addIssue({
          code: 'custom',
          path: ['baseDomain'],
          message: error instanceof Error ? error.message : 'Alan adını kontrol edin.',
        });
      }
    }
  });

export const developerWorkspaceRequestSchema = z.discriminatedUnion('action', [
  saveWebsiteSchema,
  z.object({ action: z.literal('publish-site') }).strict(),
  z.object({ action: z.literal('check-domain') }).strict(),
  z
    .object({
      action: z.literal('save-social-account'),
      account: socialAccountSchema,
    })
    .strict(),
]);

export type DeveloperWorkspaceRequest = z.infer<
  typeof developerWorkspaceRequestSchema
>;

export function normalizeBaseDomain(input: string) {
  const cleaned = input
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .replace(/^portfoy\./, '')
    .replace(/\.$/, '');

  if (
    !cleaned ||
    cleaned.length > 253 ||
    !cleaned.includes('.') ||
    /[^a-z0-9.-]/.test(cleaned) ||
    cleaned.split('.').some((part) => !part || part.length > 63 || part.startsWith('-') || part.endsWith('-')) ||
    cleaned === 'localhost' ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(cleaned)
  ) {
    throw new Error('Örnek: alanadiniz.com biçiminde geçerli bir alan adı girin.');
  }

  return cleaned;
}

export function buildPortfolioHostname(baseDomain: string) {
  return `portfoy.${normalizeBaseDomain(baseDomain)}`;
}

export function parseSocialAccounts(value: unknown): SocialAccountNote[] {
  const parsed = z.array(socialAccountSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function upsertSocialAccount(
  accounts: SocialAccountNote[],
  nextAccount: SocialAccountNote,
) {
  return [
    ...accounts.filter((account) => account.platform !== nextAccount.platform),
    nextAccount,
  ];
}

export function safeSiteSlug(value: string) {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return slug || 'portfoy';
}
