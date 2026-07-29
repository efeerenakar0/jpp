import { NextResponse } from 'next/server';
import { z } from 'zod';

import { normalizeE164 } from '@/lib/digital-manager/domain';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import { prisma } from '@/lib/prisma';

const clockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Saat SS:DD biçiminde olmalı.');

const preferenceSchema = z
  .object({
    ownerPhone: z.string().trim().max(40).nullable().optional(),
    ownerPhoneVerified: z.boolean().optional(),
    notifyCriticalImmediately: z.boolean().optional(),
    notifyTaskAccepted: z.boolean().optional(),
    notifyOnlyProblemsAndDelays: z.boolean().optional(),
    alwaysNotifyHotLeads: z.boolean().optional(),
    hourlySummaryEnabled: z.boolean().optional(),
    morningSummaryEnabled: z.boolean().optional(),
    eveningSummaryEnabled: z.boolean().optional(),
    quietHoursEnabled: z.boolean().optional(),
    quietHoursStart: clockSchema.optional(),
    quietHoursEnd: clockSchema.optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    autonomyMode: z
      .enum(['SUGGEST_ONLY', 'APPROVAL_REQUIRED', 'AUTO_LOW_RISK'])
      .optional(),
    allowAutomaticEmployeeAssignment: z.boolean().optional(),
    allowAutomaticEmployeeWhatsApp: z.boolean().optional(),
  })
  .strict();

function errorResponse(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error('[Digital Manager Preferences Error]:', error);
  return NextResponse.json(
    { error: 'Dijital Genel Müdür tercihleri kaydedilemedi.' },
    { status: 500 }
  );
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const preferences = await prisma.managerNotificationPreference.upsert({
      where: { companyAccountId: principal.account.id },
      update: {},
      create: { companyAccountId: principal.account.id },
    });
    return NextResponse.json({ preferences });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = preferenceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || 'Tercihler geçersiz.',
        },
        { status: 400 }
      );
    }
    const {
      ownerPhoneVerified,
      ownerPhone,
      ...preferenceData
    } = parsed.data;
    if (ownerPhoneVerified !== undefined) {
      return NextResponse.json(
        {
          error:
            'Telefon doğrulaması yalnız WhatsApp ile gönderilen tek kullanımlık kodla yapılabilir.',
        },
        { status: 400 }
      );
    }
    const requestedNormalized =
      ownerPhone === undefined
        ? undefined
        : normalizeE164(ownerPhone);
    if (ownerPhone && !requestedNormalized) {
      return NextResponse.json(
        { error: 'Patron telefonu geçerli E.164 biçiminde olmalı.' },
        { status: 400 }
      );
    }
    const [connected, existing, account] = await Promise.all([
      prisma.whatsAppConfig.findUnique({
        where: { companyAccountId: principal.account.id },
        select: { connectedPhone: true },
      }),
      prisma.managerNotificationPreference.findUnique({
        where: { companyAccountId: principal.account.id },
        select: {
          ownerPhone: true,
          ownerPhoneNormalized: true,
          ownerPhoneVerificationStatus: true,
          ownerPhoneVerifiedAt: true,
        },
      }),
      prisma.companyAccount.findUnique({
        where: { id: principal.account.id },
        select: {
          ownerPhone: true,
          ownerPhoneNormalized: true,
          ownerPhoneVerificationStatus: true,
          ownerPhoneVerifiedAt: true,
        },
      }),
    ]);
    const effectiveOwnerPhone =
      ownerPhone === undefined
        ? existing?.ownerPhone || account?.ownerPhone || null
        : ownerPhone;
    const effectiveNormalized =
      ownerPhone === undefined
        ? existing?.ownerPhoneNormalized ||
          account?.ownerPhoneNormalized ||
          normalizeE164(effectiveOwnerPhone)
        : requestedNormalized;
    const previousNormalized =
      existing?.ownerPhoneNormalized ||
      account?.ownerPhoneNormalized ||
      null;
    const phoneChanged =
      ownerPhone !== undefined &&
      effectiveNormalized !== previousNormalized;
    const effectiveVerified =
      !phoneChanged &&
      (existing?.ownerPhoneVerificationStatus ||
        account?.ownerPhoneVerificationStatus) === 'VERIFIED';
    if (
      ownerPhone !== undefined &&
      effectiveNormalized &&
      normalizeE164(connected?.connectedPhone) === effectiveNormalized
    ) {
      return NextResponse.json(
        {
          error:
            'Patronun kişisel komut numarası bağlı işletme numarasıyla aynı olamaz.',
        },
        { status: 409 }
      );
    }
    const preferences = await prisma.managerNotificationPreference.upsert({
      where: { companyAccountId: principal.account.id },
      create: {
        companyAccountId: principal.account.id,
        ...preferenceData,
        ownerPhone: effectiveOwnerPhone,
        ownerPhoneNormalized: effectiveNormalized,
        ownerPhoneVerificationStatus: effectiveVerified
          ? 'VERIFIED'
          : 'UNVERIFIED',
        ownerPhoneVerifiedAt:
          effectiveVerified
            ? existing?.ownerPhoneVerifiedAt ||
              account?.ownerPhoneVerifiedAt ||
              null
            : null,
      },
      update: {
        ...preferenceData,
        ...(ownerPhone === undefined ? {} : { ownerPhone }),
        ...(ownerPhone === undefined
          ? {}
          : { ownerPhoneNormalized: requestedNormalized }),
        ...(ownerPhone === undefined
          ? {}
          : {
              ownerPhoneVerificationStatus: effectiveVerified
                ? ('VERIFIED' as const)
                : ('UNVERIFIED' as const),
              ownerPhoneVerifiedAt: effectiveVerified
                ? existing?.ownerPhoneVerifiedAt ||
                  account?.ownerPhoneVerifiedAt ||
                  null
                : null,
            }),
      },
    });
    if (ownerPhone !== undefined) {
      await prisma.companyAccount.update({
        where: { id: principal.account.id },
        data: {
          ownerPhone: effectiveOwnerPhone,
          ownerPhoneNormalized: effectiveNormalized,
          ownerPhoneVerificationStatus: effectiveVerified
            ? 'VERIFIED'
            : 'UNVERIFIED',
          ownerPhoneVerifiedAt: effectiveVerified
            ? existing?.ownerPhoneVerifiedAt ||
              account?.ownerPhoneVerifiedAt ||
              null
            : null,
        },
      });
    }
    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    return errorResponse(error);
  }
}
