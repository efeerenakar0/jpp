import { randomInt } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import {
  CompanyAccountStatus,
  CompanyMemberRole,
  MemberAvailability,
  PhoneVerificationStatus,
  Prisma,
  type CompanyAccount,
  type CompanyMember,
} from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { isSubscriptionAllowed } from '@/lib/company-accounts';
import {
  normalizeE164,
  validateEmployeePhoneAssignment as validateEmployeePhoneRegistration,
} from '@/lib/digital-manager/domain';

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export type OneTimeMemberCredentials = {
  username: string;
  temporaryCode: string;
};

export type SafeCompanyMember = Omit<CompanyMember, 'passwordHash'>;

const workDaySchema = z.object({
  day: z.enum([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ]),
  enabled: z.boolean().default(true),
  start: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Başlangıç saati SS:DD biçiminde olmalı.'),
  end: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Bitiş saati SS:DD biçiminde olmalı.'),
});

export const memberWorkHoursSchema = z
  .object({
    timezone: z.string().trim().min(1).max(64).default('Europe/Istanbul'),
    days: z.array(workDaySchema).max(7),
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.days.forEach((day, index) => {
      if (seen.has(day.day)) {
        context.addIssue({
          code: 'custom',
          message: 'Aynı gün çalışma saatlerine birden fazla kez eklenemez.',
          path: ['days', index, 'day'],
        });
      }
      seen.add(day.day);
    });
  });

const uniqueTrimmedListSchema = z
  .array(z.string().trim().min(1).max(80))
  .max(30)
  .transform((items) => [...new Set(items)]);

export const companyMemberOperationalFieldsSchema = z.object({
  role: z
    .enum([
      CompanyMemberRole.MANAGER,
      CompanyMemberRole.AGENT,
      CompanyMemberRole.VIEWER,
    ])
    .optional(),
  canReceiveWhatsAppTasks: z.boolean().optional(),
  allowAutomaticInternalMessages: z.boolean().optional(),
  preferredLanguage: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .regex(
      /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/,
      'Dil kodu tr veya tr-TR biçiminde olmalı.'
    )
    .optional(),
  workHours: memberWorkHoursSchema.nullable().optional(),
  availability: z.nativeEnum(MemberAvailability).optional(),
  specialtyRegions: uniqueTrimmedListSchema.optional(),
  specialties: uniqueTrimmedListSchema.optional(),
  maxActiveTaskCapacity: z.number().int().min(1).max(100).optional(),
});

export type CompanyMemberOperationalInput = z.infer<
  typeof companyMemberOperationalFieldsSchema
>;

export class CompanyMemberValidationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 = 400
  ) {
    super(message);
    this.name = 'CompanyMemberValidationError';
  }
}

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

function validationError(error: unknown): CompanyMemberValidationError {
  if (error instanceof CompanyMemberValidationError) return error;
  const message =
    error instanceof Error ? error.message : 'Telefon numarası doğrulanamadı.';
  return new CompanyMemberValidationError(
    message,
    message.toLocaleLowerCase('tr-TR').includes('başka bir aktif') ? 409 : 400
  );
}

function inputJson(
  value: CompanyMemberOperationalInput['workHours']
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull | undefined {
  if (value === undefined) return undefined;
  return value === null ? Prisma.DbNull : value;
}

async function accountAndPhoneContext(
  transaction: Prisma.TransactionClient,
  companyAccountId: string,
  excludeMemberId?: string
) {
  const account = await transaction.companyAccount.findUnique({
    where: { id: companyAccountId },
    select: {
      slug: true,
      whatsAppConfig: { select: { connectedPhone: true } },
    },
  });
  if (!account) {
    throw new CompanyMemberValidationError('Şirket hesabı bulunamadı.', 404);
  }
  const activeMembers = await transaction.companyMember.findMany({
    where: {
      companyAccountId,
      active: true,
      ...(excludeMemberId ? { id: { not: excludeMemberId } } : {}),
    },
    select: { phone: true, phoneNormalized: true },
  });
  return {
    account,
    activeEmployeePhones: activeMembers.map(
      (member) => member.phoneNormalized || member.phone
    ),
  };
}

function validatedPhone(input: {
  phone?: string | null;
  connectedCompanyPhone?: string | null;
  activeEmployeePhones: Array<string | null | undefined>;
}) {
  const phone = input.phone?.trim() || null;
  if (!phone) return { phone: null, phoneNormalized: null };
  try {
    return {
      phone,
      phoneNormalized: validateEmployeePhoneRegistration({
        phone,
        connectedCompanyPhone: input.connectedCompanyPhone,
        activeEmployeePhones: input.activeEmployeePhones,
      }),
    };
  } catch (error) {
    throw validationError(error);
  }
}

function verificationData(input: {
  phoneNormalized: string | null;
}) {
  if (!input.phoneNormalized) {
    return {
      phoneVerificationStatus: PhoneVerificationStatus.UNVERIFIED,
      phoneVerifiedAt: null,
    };
  }
  return {
    phoneVerificationStatus: PhoneVerificationStatus.UNVERIFIED,
    phoneVerifiedAt: null,
  };
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
} & CompanyMemberOperationalInput): Promise<{
  member: SafeCompanyMember;
  credentials: OneTimeMemberCredentials;
}> {
  const account = await prisma.companyAccount.findUniqueOrThrow({
    where: { id: input.companyAccountId },
    select: { slug: true },
  });
  const operational = companyMemberOperationalFieldsSchema.parse(input);
  const username = await uniqueUsername(
    account.slug,
    input.username?.trim() || input.name
  );
  const temporaryCode = generateTemporaryCode();
  const passwordHash = await hash(temporaryCode, BCRYPT_ROUNDS);
  const member = await prisma.$transaction(
    async (transaction) => {
      const phoneContext = await accountAndPhoneContext(
        transaction,
        input.companyAccountId
      );
      const phone = validatedPhone({
        phone: input.phone,
        connectedCompanyPhone:
          phoneContext.account.whatsAppConfig?.connectedPhone,
        activeEmployeePhones: phoneContext.activeEmployeePhones,
      });
      if (
        !phone.phoneNormalized &&
        (operational.canReceiveWhatsAppTasks === true ||
          operational.allowAutomaticInternalMessages === true)
      ) {
        throw new CompanyMemberValidationError(
          'WhatsApp görevleri için önce geçerli bir çalışan telefonu girin.'
        );
      }
      const verification = verificationData({
        phoneNormalized: phone.phoneNormalized,
      });
      const canReceiveWhatsAppTasks = phone.phoneNormalized
        ? operational.canReceiveWhatsAppTasks ?? true
        : false;

      return transaction.companyMember.create({
        data: {
          companyAccountId: input.companyAccountId,
          name: input.name.trim(),
          email: input.email?.trim().toLocaleLowerCase('tr-TR') || null,
          phone: phone.phone,
          phoneNormalized: phone.phoneNormalized,
          ...verification,
          canReceiveWhatsAppTasks,
          allowAutomaticInternalMessages:
            canReceiveWhatsAppTasks &&
            (operational.allowAutomaticInternalMessages ?? false),
          preferredLanguage: operational.preferredLanguage || 'tr',
          workHours: inputJson(operational.workHours),
          availability:
            operational.availability || MemberAvailability.AVAILABLE,
          specialtyRegions: operational.specialtyRegions || [],
          specialties: operational.specialties || [],
          maxActiveTaskCapacity:
            operational.maxActiveTaskCapacity ?? 10,
          role: operational.role || CompanyMemberRole.AGENT,
          username,
          passwordHash,
          credentialsUpdatedAt: new Date(),
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return {
    member: toSafeCompanyMember(member),
    credentials: { username, temporaryCode },
  };
}

export async function updateCompanyMemberProfile(
  input: {
    companyAccountId: string;
    memberId: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
  } & CompanyMemberOperationalInput
): Promise<SafeCompanyMember> {
  const operational = companyMemberOperationalFieldsSchema.parse(input);
  const member = await prisma.$transaction(
    async (transaction) => {
      const existing = await transaction.companyMember.findFirst({
        where: {
          id: input.memberId,
          companyAccountId: input.companyAccountId,
        },
      });
      if (!existing) {
        throw new CompanyMemberValidationError('Çalışan bulunamadı.', 404);
      }
      const phoneContext = await accountAndPhoneContext(
        transaction,
        input.companyAccountId,
        existing.id
      );
      const nextPhone =
        input.phone === undefined ? existing.phone : input.phone?.trim() || null;
      const phone = validatedPhone({
        phone: nextPhone,
        connectedCompanyPhone:
          phoneContext.account.whatsAppConfig?.connectedPhone,
        activeEmployeePhones: phoneContext.activeEmployeePhones,
      });
      if (
        !phone.phoneNormalized &&
        (operational.canReceiveWhatsAppTasks === true ||
          operational.allowAutomaticInternalMessages === true)
      ) {
        throw new CompanyMemberValidationError(
          'WhatsApp görevleri için önce geçerli bir çalışan telefonu girin.'
        );
      }
      const verification = verificationData({
        phoneNormalized: phone.phoneNormalized,
      });
      const canReceiveWhatsAppTasks = phone.phoneNormalized
        ? operational.canReceiveWhatsAppTasks ??
          existing.canReceiveWhatsAppTasks
        : false;

      return transaction.companyMember.update({
        where: { id: existing.id },
        data: {
          name: input.name?.trim() || undefined,
          email:
            input.email === undefined
              ? undefined
              : input.email?.trim().toLocaleLowerCase('tr-TR') || null,
          phone: phone.phone,
          phoneNormalized: phone.phoneNormalized,
          ...verification,
          role: operational.role,
          canReceiveWhatsAppTasks,
          allowAutomaticInternalMessages: canReceiveWhatsAppTasks
            ? operational.allowAutomaticInternalMessages
            : false,
          preferredLanguage: operational.preferredLanguage,
          workHours: inputJson(operational.workHours),
          availability: operational.availability,
          specialtyRegions: operational.specialtyRegions,
          specialties: operational.specialties,
          maxActiveTaskCapacity: operational.maxActiveTaskCapacity,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  return toSafeCompanyMember(member);
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
