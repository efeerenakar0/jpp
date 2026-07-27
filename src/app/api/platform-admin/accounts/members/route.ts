import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  createCompanyMemberAccount,
  resetCompanyMemberCredentials,
  setCompanyMemberActive,
} from '@/lib/company-members';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';

const createMemberSchema = z.object({
  accountId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  username: z.string().trim().min(2).max(40).optional().or(z.literal('')),
});

const updateMemberSchema = z.discriminatedUnion('action', [
  z.object({
    accountId: z.string().trim().min(1),
    memberId: z.string().trim().min(1),
    action: z.literal('reset_credentials'),
  }),
  z.object({
    accountId: z.string().trim().min(1),
    memberId: z.string().trim().min(1),
    action: z.literal('set_active'),
    active: z.boolean(),
  }),
]);

function unauthorized() {
  return NextResponse.json(
    { error: 'Platform yöneticisi oturumu gerekli.' },
    { status: 401 }
  );
}

async function listMembers(accountId: string) {
  return prisma.companyMember.findMany({
    where: { companyAccountId: accountId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      active: true,
      username: true,
      lastLoginAt: true,
      credentialsUpdatedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function GET(request: Request) {
  if (!(await requirePlatformAdmin())) {
    return unauthorized();
  }

  const accountId = new URL(request.url).searchParams.get('accountId')?.trim();
  if (!accountId) {
    return NextResponse.json({ error: 'Şirket hesabı gerekli.' }, { status: 400 });
  }

  return NextResponse.json({ members: await listMembers(accountId) });
}

export async function POST(request: Request) {
  if (!(await requirePlatformAdmin())) {
    return unauthorized();
  }

  try {
    const parsed = createMemberSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Çalışan bilgilerini kontrol edin.' },
        { status: 400 }
      );
    }

    const result = await createCompanyMemberAccount({
      companyAccountId: parsed.data.accountId,
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      username: parsed.data.username || null,
    });

    return NextResponse.json(
      {
        member: result.member,
        members: await listMembers(parsed.data.accountId),
        oneTimeCredentials: result.credentials,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Platform Member POST Error]:', error);
    return NextResponse.json(
      { error: 'Çalışan hesabı oluşturulamadı.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await requirePlatformAdmin())) {
    return unauthorized();
  }

  try {
    const parsed = updateMemberSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Geçersiz çalışan işlemi.' },
        { status: 400 }
      );
    }
    const input = parsed.data;

    if (input.action === 'reset_credentials') {
      const result = await resetCompanyMemberCredentials({
        companyAccountId: input.accountId,
        memberId: input.memberId,
      });
      return NextResponse.json({
        member: result.member,
        members: await listMembers(input.accountId),
        oneTimeCredentials: result.credentials,
      });
    }

    const member = await setCompanyMemberActive({
      companyAccountId: input.accountId,
      memberId: input.memberId,
      active: input.active,
    });
    return NextResponse.json({
      member,
      members: await listMembers(input.accountId),
    });
  } catch (error) {
    console.error('[Platform Member PATCH Error]:', error);
    return NextResponse.json(
      { error: 'Çalışan hesabı güncellenemedi.' },
      { status: 500 }
    );
  }
}
