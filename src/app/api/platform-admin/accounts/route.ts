import { NextResponse } from 'next/server';
import {
  CompanyAccountStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  createCompanyAccount,
  ensureLegacyJasmineAccount,
  resetCompanyCredentials,
  toSafeCompanyAccount,
} from '@/lib/company-accounts';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';

const createAccountSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  ownerName: z.string().trim().min(2).max(120),
  ownerEmail: z
    .string()
    .trim()
    .email()
    .max(160)
    .optional()
    .or(z.literal('')),
  subscriptionPlan: z.string().trim().min(2).max(40).optional(),
  subscriptionEndsAt: z.string().datetime().optional().nullable(),
});

const updateAccountSchema = z.discriminatedUnion('action', [
  z.object({
    id: z.string().min(1),
    action: z.literal('account_status'),
    status: z.nativeEnum(CompanyAccountStatus),
  }),
  z.object({
    id: z.string().min(1),
    action: z.literal('hunter_access'),
    hunterEnabled: z.boolean(),
  }),
  z.object({
    id: z.string().min(1),
    action: z.literal('subscription_status'),
    subscriptionStatus: z.nativeEnum(SubscriptionStatus),
  }),
  z.object({
    id: z.string().min(1),
    action: z.literal('reset_credentials'),
  }),
]);

async function unauthorized() {
  return NextResponse.json(
    { error: 'Platform yöneticisi oturumu gerekli.' },
    { status: 401 }
  );
}

export async function GET() {
  if (!(await requirePlatformAdmin())) {
    return unauthorized();
  }

  await ensureLegacyJasmineAccount();
  const accounts = await prisma.companyAccount.findMany({
    orderBy: { createdAt: 'desc' },
  });
  const safeAccounts = accounts.map(toSafeCompanyAccount);

  return NextResponse.json({
    accounts: safeAccounts,
    stats: {
      total: accounts.length,
      active: accounts.filter(
        (account) => account.status === CompanyAccountStatus.ACTIVE
      ).length,
      pausedSubscriptions: accounts.filter(
        (account) =>
          account.subscriptionStatus === SubscriptionStatus.PAUSED
      ).length,
      pendingWorkspaces: accounts.filter(
        (account) => !account.workspaceEnabled
      ).length,
    },
  });
}

export async function POST(request: Request) {
  if (!(await requirePlatformAdmin())) {
    return unauthorized();
  }

  try {
    const parsed = createAccountSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            'Şirket adı, hesap sahibi ve abonelik bilgilerini kontrol edin.',
        },
        { status: 400 }
      );
    }

    const result = await createCompanyAccount({
      ...parsed.data,
      ownerEmail: parsed.data.ownerEmail || null,
      subscriptionEndsAt: parsed.data.subscriptionEndsAt
        ? new Date(parsed.data.subscriptionEndsAt)
        : null,
    });

    return NextResponse.json(
      {
        account: result.account,
        oneTimeCredentials: result.credentials,
        warning:
          'Bu giriş bilgileri yalnızca bir kez gösterilir. Güvenli biçimde müşteriye iletin.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Platform Account POST Error]:', error);
    return NextResponse.json(
      { error: 'Şirket hesabı oluşturulamadı.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await requirePlatformAdmin())) {
    return unauthorized();
  }

  try {
    const parsed = updateAccountSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Geçersiz hesap işlemi.' },
        { status: 400 }
      );
    }

    const input = parsed.data;

    if (input.action === 'reset_credentials') {
      const result = await resetCompanyCredentials(input.id);
      return NextResponse.json({
        account: result.account,
        oneTimeCredentials: result.credentials,
        warning:
          'Eski giriş bilgileri geçersiz oldu. Yeni bilgileri yalnızca güvenli kanaldan paylaşın.',
      });
    }

    const currentPlan =
      input.action === 'hunter_access'
        ? await prisma.companyAccount.findUniqueOrThrow({
            where: { id: input.id },
            select: { subscriptionPlan: true },
          })
        : null;
    const account = await prisma.companyAccount.update({
      where: { id: input.id },
      data:
        input.action === 'account_status'
          ? {
              status: input.status,
              sessionVersion: { increment: 1 },
            }
          : input.action === 'subscription_status'
            ? {
              subscriptionStatus: input.subscriptionStatus,
              sessionVersion: { increment: 1 },
              }
            : {
                subscriptionPlan: input.hunterEnabled
                  ? currentPlan!.subscriptionPlan.includes('+hunter')
                    ? currentPlan!.subscriptionPlan
                    : `${currentPlan!.subscriptionPlan}+hunter`
                  : currentPlan!.subscriptionPlan.replace('+hunter', ''),
              },
    });

    return NextResponse.json({
      account: toSafeCompanyAccount(account),
    });
  } catch (error) {
    console.error('[Platform Account PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Şirket hesabı güncellenemedi.' },
      { status: 500 }
    );
  }
}
