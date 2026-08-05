import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';

import {
  companyOnboardingRequestSchema,
  managerPreferencesFromOnboarding,
  normalizeCompanyOnboardingState,
} from '@/lib/company-onboarding';
import { normalizeE164 } from '@/lib/digital-manager/domain';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function unauthorized(error: unknown) {
  return NextResponse.json(
    { success: false, error: 'Bu işlem için patron oturumu gerekli.' },
    { status: error instanceof FabrikaForbiddenError ? 403 : 401 }
  );
}

function completedProfile(
  profile: ReturnType<typeof normalizeCompanyOnboardingState>,
  completed: boolean
) {
  return completed
    ? {
        ...profile,
        setupDisposition: 'COMPLETED' as const,
        currentStep: 6,
      }
    : profile;
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const account = await prisma.companyAccount.findUniqueOrThrow({
      where: { id: principal.account.id },
      select: {
        companyName: true,
        ownerPhone: true,
        onboardingState: true,
        onboardingCompletedAt: true,
      },
    });
    const complete = Boolean(account.onboardingCompletedAt);
    const profile = completedProfile(
      normalizeCompanyOnboardingState(account.onboardingState, account.companyName),
      complete
    );

    if (!profile.ownerPhone && account.ownerPhone) {
      profile.ownerPhone = account.ownerPhone;
    }

    return NextResponse.json({
      success: true,
      completed: complete,
      completedAt: account.onboardingCompletedAt,
      profile,
    });
  } catch (error) {
    if (
      error instanceof FabrikaSessionError ||
      error instanceof FabrikaForbiddenError
    ) {
      return unauthorized(error);
    }
    console.error('[Onboarding GET Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Kurulum bilgileri yüklenemedi.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = companyOnboardingRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            parsed.error.issues[0]?.message ||
            'Kurulum bilgilerini kontrol edin.',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { completed, ...profile } = parsed.data;
    const ownerPhoneNormalized = profile.ownerPhone
      ? normalizeE164(profile.ownerPhone)
      : null;
    if (profile.ownerPhone && !ownerPhoneNormalized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Patron telefonunu ülke koduyla girin (ör. +905551112233).',
        },
        { status: 400 }
      );
    }
    const preferences = managerPreferencesFromOnboarding(profile);

    const account = await prisma.$transaction(async (tx) => {
      const existing = await tx.companyAccount.findUniqueOrThrow({
        where: { id: principal.account.id },
        select: { ownerPhoneNormalized: true },
      });
      const phoneChanged = existing.ownerPhoneNormalized !== ownerPhoneNormalized;

      const updated = await tx.companyAccount.update({
        where: { id: principal.account.id },
        data: {
          companyName: profile.companyName,
          ownerPhone: profile.ownerPhone || null,
          ownerPhoneNormalized,
          onboardingState: profile as Prisma.InputJsonValue,
          onboardingCompletedAt: completed ? new Date() : null,
        },
        select: {
          companyName: true,
          onboardingState: true,
          onboardingCompletedAt: true,
        },
      });

      await tx.managerNotificationPreference.upsert({
        where: { companyAccountId: principal.account.id },
        create: {
          companyAccountId: principal.account.id,
          ...preferences,
          ownerPhoneNormalized,
        },
        update: {
          ...preferences,
          ownerPhoneNormalized,
          ...(phoneChanged
            ? {
                ownerPhoneVerificationStatus: 'UNVERIFIED' as const,
                ownerPhoneVerifiedAt: null,
              }
            : {}),
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      completed: Boolean(account.onboardingCompletedAt),
      completedAt: account.onboardingCompletedAt,
      profile: completedProfile(
        normalizeCompanyOnboardingState(
          account.onboardingState,
          account.companyName
        ),
        Boolean(account.onboardingCompletedAt)
      ),
    });
  } catch (error) {
    if (
      error instanceof FabrikaSessionError ||
      error instanceof FabrikaForbiddenError
    ) {
      return unauthorized(error);
    }
    console.error('[Onboarding POST Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Kurulum bilgileri kaydedilemedi.' },
      { status: 500 }
    );
  }
}
