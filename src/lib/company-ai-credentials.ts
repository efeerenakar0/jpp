import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { AiProvider } from '@prisma/client';
import prisma from '@/lib/prisma';

export const STUDIO_PROVIDERS = [AiProvider.OPENAI, AiProvider.GEMINI] as const;

export type StudioProvider = (typeof STUDIO_PROVIDERS)[number];

export const STUDIO_PROVIDER_DEFAULTS: Record<StudioProvider, string> = {
  [AiProvider.OPENAI]: 'gpt-image-1',
  [AiProvider.GEMINI]: 'gemini-2.5-flash-image',
};

const DEPRECATED_GEMINI_MODELS = new Set([
  'gemini-2.5-flash-image-preview',
  'gemini-2.5-flash-preview-image',
]);

export function normalizeStudioModel(provider: StudioProvider, model?: string | null) {
  const normalized = model?.trim();
  if (!normalized) return STUDIO_PROVIDER_DEFAULTS[provider];
  if (provider === AiProvider.GEMINI && DEPRECATED_GEMINI_MODELS.has(normalized)) {
    return STUDIO_PROVIDER_DEFAULTS[AiProvider.GEMINI];
  }
  return normalized;
}

function encryptionKey() {
  const secret =
    process.env.COMPANY_AI_CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    process.env.COMPANY_CREDENTIAL_SECRET?.trim() ||
    process.env.FABRIKA_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error('AI anahtarlarını güvenle saklamak için sunucu güvenlik anahtarı yapılandırılmamış.');
  }

  return createHash('sha256').update(secret).digest();
}

function encryptApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decryptApiKey(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Kayıtlı AI anahtarı okunamadı. Anahtarı ayarlardan yeniden kaydedin.');
  }

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function keyHint(apiKey: string) {
  const normalized = apiKey.trim();
  if (normalized.length < 10) return '••••••';
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

export function isStudioProvider(value: unknown): value is StudioProvider {
  return value === AiProvider.OPENAI || value === AiProvider.GEMINI;
}

export async function saveCompanyStudioCredential(input: {
  accountId: string;
  provider: StudioProvider;
  apiKey?: string;
  model?: string;
  active: boolean;
}) {
  const existing = await prisma.companyAiCredential.findUnique({
    where: {
      companyAccountId_provider: {
        companyAccountId: input.accountId,
        provider: input.provider,
      },
    },
  });

  const apiKey = input.apiKey?.trim();
  if (!existing && !apiKey) {
    throw new Error('Bu sağlayıcı için bir API anahtarı girin.');
  }

  if (apiKey && apiKey.length < 12) {
    throw new Error('API anahtarı geçersiz görünüyor.');
  }

  if (input.active) {
    await prisma.companyAiCredential.updateMany({
      where: { companyAccountId: input.accountId },
      data: { active: false },
    });
  }

  return prisma.companyAiCredential.upsert({
    where: {
      companyAccountId_provider: {
        companyAccountId: input.accountId,
        provider: input.provider,
      },
    },
    create: {
      companyAccountId: input.accountId,
      provider: input.provider,
      encryptedApiKey: encryptApiKey(apiKey || ''),
      keyHint: keyHint(apiKey || ''),
      model: normalizeStudioModel(input.provider, input.model),
      active: input.active,
    },
    update: {
      ...(apiKey
        ? {
            encryptedApiKey: encryptApiKey(apiKey),
            keyHint: keyHint(apiKey),
          }
        : {}),
      model: normalizeStudioModel(input.provider, input.model),
      active: input.active,
    },
  });
}

export async function getCompanyStudioCredential(accountId: string) {
  const credential = await prisma.companyAiCredential.findFirst({
    where: { companyAccountId: accountId, active: true, provider: { in: [...STUDIO_PROVIDERS] } },
    orderBy: { updatedAt: 'desc' },
  });

  if (!credential) return null;

  return {
    provider: credential.provider as StudioProvider,
    apiKey: decryptApiKey(credential.encryptedApiKey),
    model: normalizeStudioModel(
      credential.provider as StudioProvider,
      credential.model
    ),
  };
}

export function publicStudioCredentialStatus(credentials: Array<{
  provider: AiProvider;
  keyHint: string;
  model: string | null;
  active: boolean;
}>) {
  return STUDIO_PROVIDERS.map((provider) => {
    const credential = credentials.find((item) => item.provider === provider);
    return {
      provider,
      configured: Boolean(credential),
      active: credential?.active || false,
      keyHint: credential?.keyHint || null,
      model: normalizeStudioModel(provider, credential?.model),
    };
  });
}
