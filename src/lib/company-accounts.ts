import {
  createHmac,
  randomBytes,
  randomInt,
} from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import {
  CompanyAccountStatus,
  SubscriptionStatus,
  type CompanyAccount,
} from '@prisma/client';
import prisma from '@/lib/prisma';

const BCRYPT_ROUNDS = 12;
const LEGACY_JASMINE_SLUG = 'jasmine-group';

export type OneTimeCompanyCredentials = {
  accessKey: string;
  verificationCode: string;
};

type CreateCompanyAccountInput = {
  companyName: string;
  ownerName: string;
  ownerEmail?: string | null;
  subscriptionPlan?: string;
  subscriptionEndsAt?: Date | null;
};

export type SafeCompanyAccount = Omit<
  CompanyAccount,
  | 'accessKeyLookup'
  | 'accessKeyHash'
  | 'verificationCodeHash'
>;

function getCredentialSecret(): string {
  const secret =
    process.env.COMPANY_CREDENTIAL_SECRET?.trim() ||
    process.env.FABRIKA_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error('Şirket kimlik bilgisi güvenlik anahtarı yapılandırılmamış.');
  }

  return secret;
}

function normalizeAccessKey(accessKey: string): string {
  return accessKey.trim().toLocaleLowerCase('tr-TR');
}

function createAccessKeyLookup(accessKey: string): string {
  return createHmac('sha256', getCredentialSecret())
    .update(normalizeAccessKey(accessKey))
    .digest('hex');
}

function createAccessKeyHint(accessKey: string): string {
  if (accessKey.length <= 8) {
    return `${accessKey.slice(0, 2)}••••${accessKey.slice(-2)}`;
  }

  return `${accessKey.slice(0, 4)}••••${accessKey.slice(-4)}`;
}

function createVerificationCodeHint(code: string): string {
  return `••••${code.slice(-2)}`;
}

function slugify(value: string): string {
  return (
    value
      .trim()
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'sirket'
  );
}

async function uniqueSlug(companyName: string): Promise<string> {
  const base = slugify(companyName);
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.companyAccount.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function generateCompanyCredentials(): OneTimeCompanyCredentials {
  return {
    accessKey: `jas_${randomBytes(12).toString('base64url')}`,
    verificationCode: randomInt(100000, 1000000).toString(),
  };
}

async function credentialData(
  credentials: OneTimeCompanyCredentials
) {
  return {
    accessKeyLookup: createAccessKeyLookup(credentials.accessKey),
    accessKeyHash: await hash(
      normalizeAccessKey(credentials.accessKey),
      BCRYPT_ROUNDS
    ),
    accessKeyHint: createAccessKeyHint(credentials.accessKey),
    verificationCodeHash: await hash(
      credentials.verificationCode,
      BCRYPT_ROUNDS
    ),
    verificationCodeHint: createVerificationCodeHint(
      credentials.verificationCode
    ),
  };
}

export function toSafeCompanyAccount(
  account: CompanyAccount
): SafeCompanyAccount {
  return {
    id: account.id,
    companyName: account.companyName,
    slug: account.slug,
    ownerName: account.ownerName,
    ownerEmail: account.ownerEmail,
    accessKeyHint: account.accessKeyHint,
    verificationCodeHint: account.verificationCodeHint,
    status: account.status,
    subscriptionStatus: account.subscriptionStatus,
    subscriptionPlan: account.subscriptionPlan,
    subscriptionEndsAt: account.subscriptionEndsAt,
    workspaceEnabled: account.workspaceEnabled,
    sessionVersion: account.sessionVersion,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

export async function createCompanyAccount(
  input: CreateCompanyAccountInput
): Promise<{
  account: SafeCompanyAccount;
  credentials: OneTimeCompanyCredentials;
}> {
  const credentials = generateCompanyCredentials();
  const account = await prisma.companyAccount.create({
    data: {
      companyName: input.companyName.trim(),
      slug: await uniqueSlug(input.companyName),
      ownerName: input.ownerName.trim(),
      ownerEmail: input.ownerEmail?.trim().toLocaleLowerCase('tr-TR') || null,
      subscriptionPlan: input.subscriptionPlan?.trim() || 'standard',
      subscriptionEndsAt: input.subscriptionEndsAt || null,
      workspaceEnabled: false,
      ...(await credentialData(credentials)),
    },
  });

  return {
    account: toSafeCompanyAccount(account),
    credentials,
  };
}

export async function resetCompanyCredentials(
  accountId: string
): Promise<{
  account: SafeCompanyAccount;
  credentials: OneTimeCompanyCredentials;
}> {
  const credentials = generateCompanyCredentials();
  const data = await credentialData(credentials);
  const account = await prisma.companyAccount.update({
    where: { id: accountId },
    data: {
      ...data,
      sessionVersion: { increment: 1 },
    },
  });

  return {
    account: toSafeCompanyAccount(account),
    credentials,
  };
}

export function isSubscriptionAllowed(
  subscriptionStatus: SubscriptionStatus
): boolean {
  return (
    subscriptionStatus === SubscriptionStatus.ACTIVE ||
    subscriptionStatus === SubscriptionStatus.TRIAL
  );
}

export async function ensureLegacyJasmineAccount(): Promise<CompanyAccount | null> {
  const existing = await prisma.companyAccount.findUnique({
    where: { slug: LEGACY_JASMINE_SLUG },
  });

  if (existing?.accessKeyHash && existing.verificationCodeHash) {
    return existing;
  }

  const accessKey = process.env.FABRIKA_ACCESS_KEY?.trim();
  const verificationCode =
    process.env.FABRIKA_VERIFICATION_CODE?.trim();

  if (!accessKey || !verificationCode) {
    return existing;
  }

  const data = await credentialData({ accessKey, verificationCode });

  return prisma.companyAccount.upsert({
    where: { slug: LEGACY_JASMINE_SLUG },
    update: {
      ...(existing?.accessKeyHash ? {} : data),
      workspaceEnabled: true,
    },
    create: {
      companyName: 'Jasmine Group',
      slug: LEGACY_JASMINE_SLUG,
      ownerName: 'Efe Eren',
      status: CompanyAccountStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      subscriptionPlan: 'founder',
      workspaceEnabled: true,
      ...data,
    },
  });
}

export async function authenticateCompanyAccount(
  accessKey: string,
  verificationCode: string
): Promise<
  | { ok: true; account: CompanyAccount }
  | {
      ok: false;
      reason:
        | 'invalid'
        | 'account_disabled'
        | 'subscription_inactive'
        | 'workspace_pending';
    }
> {
  await ensureLegacyJasmineAccount();

  const account = await prisma.companyAccount.findUnique({
    where: {
      accessKeyLookup: createAccessKeyLookup(accessKey),
    },
  });

  if (
    !account?.accessKeyHash ||
    !account.verificationCodeHash ||
    !(await compare(normalizeAccessKey(accessKey), account.accessKeyHash)) ||
    !(await compare(verificationCode.trim(), account.verificationCodeHash))
  ) {
    return { ok: false, reason: 'invalid' };
  }

  if (account.status !== CompanyAccountStatus.ACTIVE) {
    return { ok: false, reason: 'account_disabled' };
  }

  if (!isSubscriptionAllowed(account.subscriptionStatus)) {
    return { ok: false, reason: 'subscription_inactive' };
  }

  if (
    account.subscriptionEndsAt &&
    account.subscriptionEndsAt.getTime() <= Date.now()
  ) {
    return { ok: false, reason: 'subscription_inactive' };
  }

  if (!account.workspaceEnabled) {
    return { ok: false, reason: 'workspace_pending' };
  }

  const updated = await prisma.companyAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
  });

  return { ok: true, account: updated };
}
