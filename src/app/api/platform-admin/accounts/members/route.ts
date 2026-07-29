import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  CompanyMemberValidationError,
  companyMemberOperationalFieldsSchema,
  createCompanyMemberAccount,
  resetCompanyMemberCredentials,
  setCompanyMemberActive,
  updateCompanyMemberProfile,
} from '@/lib/company-members';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';

const emailSchema = z.string().trim().email().optional().or(z.literal(''));
const phoneSchema = z.string().trim().max(40).optional().or(z.literal(''));

const createMemberSchema = z
  .object({
    accountId: z.string().trim().min(1),
    name: z.string().trim().min(2).max(120),
    email: emailSchema,
    phone: phoneSchema,
    username: z.string().trim().min(2).max(40).optional().or(z.literal('')),
  })
  .extend(companyMemberOperationalFieldsSchema.shape);

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
  z
    .object({
      accountId: z.string().trim().min(1),
      memberId: z.string().trim().min(1),
      action: z.literal('update_profile'),
      name: z.string().trim().min(2).max(120).optional(),
      email: emailSchema,
      phone: phoneSchema,
    })
    .extend(companyMemberOperationalFieldsSchema.shape),
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
      phoneNormalized: true,
      canReceiveWhatsAppTasks: true,
      allowAutomaticInternalMessages: true,
      preferredLanguage: true,
      workHours: true,
      availability: true,
      specialtyRegions: true,
      specialties: true,
      maxActiveTaskCapacity: true,
      lastAssignedAt: true,
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

function memberErrorResponse(error: unknown, fallback: string) {
  if (error instanceof CompanyMemberValidationError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode }
    );
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = Array.isArray(error.meta?.target)
      ? error.meta.target.join(' ')
      : String(error.meta?.target || '');
    const message = target.includes('phone')
      ? 'Bu telefon numarası başka bir aktif ekip üyesine atanmış.'
      : target.includes('username')
        ? 'Bu kullanıcı adı zaten kullanılıyor.'
        : target.includes('email')
          ? 'Bu e-posta adresi aynı şirkette zaten kullanılıyor.'
          : 'Aynı bilgilerle kayıtlı başka bir ekip üyesi bulunuyor.';
    return NextResponse.json({ error: message }, { status: 409 });
  }
  console.error('[Platform Member Error]:', error);
  return NextResponse.json({ error: fallback }, { status: 500 });
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
        {
          error:
            parsed.error.issues[0]?.message ||
            'Çalışan bilgilerini kontrol edin.',
        },
        { status: 400 }
      );
    }
    const {
      accountId,
      name,
      email,
      phone,
      username,
      ...operational
    } = parsed.data;

    const result = await createCompanyMemberAccount({
      companyAccountId: accountId,
      name,
      email: email || null,
      phone: phone || null,
      username: username || null,
      ...operational,
    });

    return NextResponse.json(
      {
        member: result.member,
        members: await listMembers(accountId),
        oneTimeCredentials: result.credentials,
      },
      { status: 201 }
    );
  } catch (error) {
    return memberErrorResponse(
      error,
      'Çalışan hesabı oluşturulamadı.'
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
        {
          error:
            parsed.error.issues[0]?.message || 'Geçersiz çalışan işlemi.',
        },
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

    if (input.action === 'update_profile') {
      const {
        accountId,
        memberId,
        name,
        email,
        phone,
        action: _action,
        ...operational
      } = input;
      void _action;
      const member = await updateCompanyMemberProfile({
        companyAccountId: accountId,
        memberId,
        name,
        email: email === undefined ? undefined : email || null,
        phone: phone === undefined ? undefined : phone || null,
        ...operational,
      });
      return NextResponse.json({
        member,
        members: await listMembers(accountId),
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
    return memberErrorResponse(
      error,
      'Çalışan hesabı güncellenemedi.'
    );
  }
}
