import { randomInt } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import {
  CompanyAccountStatus,
  CompanyMemberRole,
  type CompanyAccount,
  type CompanyMember,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { isSubscriptionAllowed } from '@/lib/company-accounts';

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export type OneTimeMemberCredentials = {
  username: string;
  temporaryCode: string;
};

export type SafeCompanyMember = Omit<CompanyMember, 'passwordHash'>;

type MemberAuthenticationFailure =
  | 'invalid'
  | 'locked'
  | 'member_disabled'
  | 'account_disabled'
  | 'subscription_inactive'
  | 'workspace_pending';

function usernamePart(value: string): string {
  return (
    value
      .trim()
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ı/g, 'i')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'calisan'
  );
}

export function normalizeMemberUsername(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function generateTemporaryCode(): string {
  return randomInt(100000, 1000000).toString();
}

async function uniqueUsername(
  companySlug: string,
  preferredName: string
): Promise<string> {
  const base = `${usernamePart(companySlug)}.${usernamePart(preferredName)}`;
  let candidate = base;
  let suffix = 2;

  while (
    await prisma.companyMember.findUnique({
      where: { username: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function toSafeCompanyMember(
  member: CompanyMember
): SafeCompanyMember {
  const { passwordHash, ...safeMember } = member;
  void passwordHash;
  return safeMember;
}

export async function createCompanyMemberAccount(input: {
  companyAccountId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  username?: string | null;
}): Promise<{
  member: SafeCompanyMember;
  credentials: OneTimeMemberCredentials;
}> {
  const account = await prisma.companyAccount.findUniqueOrThrow({
    where: { id: input.companyAccountId },
    select: { slug: true },
  });
  const username = await uniqueUsername(
    account.slug,
    input.username?.trim() || input.name
  );
  const temporaryCode = generateTemporaryCode();
  const member = await prisma.companyMember.create({
    data: {
      companyAccountId: input.companyAccountId,
      name: input.name.trim(),
      email: input.email?.trim().toLocaleLowerCase('tr-TR') || null,
      phone: input.phone?.trim() || null,
      role: CompanyMemberRole.AGENT,
      username,
      passwordHash: await hash(temporaryCode, BCRYPT_ROUNDS),
      credentialsUpdatedAt: new Date(),
    },
  });

  return {
    member: toSafeCompanyMember(member),
    credentials: { username, temporaryCode },
  };
}

export async function resetCompanyMemberCredentials(input: {
  companyAccountId: string;
  memberId: string;
}): Promise<{
  member: SafeCompanyMember;
  credentials: OneTimeMemberCredentials;
}> {
  const existing = await prisma.companyMember.findFirstOrThrow({
    where: {
      id: input.memberId,
      companyAccountId: input.companyAccountId,
    },
    include: {
      companyAccount: { select: { slug: true } },
    },
  });
  const username =
    existing.username ||
    (await uniqueUsername(existing.companyAccount.slug, existing.name));
  const temporaryCode = generateTemporaryCode();
  const member = await prisma.companyMember.update({
    where: { id: existing.id },
    data: {
      username,
      passwordHash: await hash(temporaryCode, BCRYPT_ROUNDS),
      sessionVersion: { increment: 1 },
      failedLoginAttempts: 0,
      lockedUntil: null,
      credentialsUpdatedAt: new Date(),
    },
  });

  return {
    member: toSafeCompanyMember(member),
    credentials: { username, temporaryCode },
  };
}

export async function setCompanyMemberActive(input: {
  companyAccountId: string;
  memberId: string;
  active: boolean;
}): Promise<SafeCompanyMember> {
  const existing = await prisma.companyMember.findFirstOrThrow({
    where: {
      id: input.memberId,
      companyAccountId: input.companyAccountId,
    },
    select: { id: true },
  });
  const member = await prisma.companyMember.update({
    where: { id: existing.id },
    data: {
      active: input.active,
      sessionVersion: { increment: 1 },
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  return toSafeCompanyMember(member);
}

function accountFailure(
  account: CompanyAccount
): Exclude<MemberAuthenticationFailure, 'invalid' | 'locked' | 'member_disabled'> | null {
  if (account.status !== CompanyAccountStatus.ACTIVE) {
    return 'account_disabled';
  }

  if (
    !isSubscriptionAllowed(account.subscriptionStatus) ||
    (account.subscriptionEndsAt?.getTime() || Number.POSITIVE_INFINITY) <=
      Date.now()
  ) {
    return 'subscription_inactive';
  }

  return account.workspaceEnabled ? null : 'workspace_pending';
}

export async function authenticateCompanyMember(
  usernameInput: string,
  temporaryCodeInput: string
): Promise<
  | {
      ok: true;
      account: CompanyAccount;
      member: CompanyMember;
    }
  | { ok: false; reason: MemberAuthenticationFailure }
> {
  const username = normalizeMemberUsername(usernameInput);
  const member = await prisma.companyMember.findUnique({
    where: { username },
    include: { companyAccount: true },
  });

  if (
    !member?.passwordHash ||
    !(await compare(temporaryCodeInput.trim(), member.passwordHash))
  ) {
    if (member) {
      const failedLoginAttempts = member.failedLoginAttempts + 1;
      await prisma.companyMember.update({
        where: { id: member.id },
        data: {
          failedLoginAttempts,
          lockedUntil:
            failedLoginAttempts >= MAX_LOGIN_ATTEMPTS
              ? new Date(Date.now() + LOCK_DURATION_MS)
              : null,
        },
      });
    }
    return { ok: false, reason: 'invalid' };
  }

  if (member.lockedUntil && member.lockedUntil.getTime() > Date.now()) {
    return { ok: false, reason: 'locked' };
  }

  if (!member.active) {
    return { ok: false, reason: 'member_disabled' };
  }

  const failure = accountFailure(member.companyAccount);
  if (failure) {
    return { ok: false, reason: failure };
  }

  const updatedMember = await prisma.companyMember.update({
    where: { id: member.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  return {
    ok: true,
    account: member.companyAccount,
    member: updatedMember,
  };
}
