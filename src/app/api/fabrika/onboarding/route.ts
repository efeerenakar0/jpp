import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const onboardingSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  strengths: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  uniquePoints: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  serviceAreas: z.array(z.string().trim().min(1).max(120)).max(24).default([]),
  yearsInBusiness: z.coerce.number().int().min(0).max(200).nullable().optional(),
  teamSize: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
  extraNotes: z.string().trim().max(2_000).default(''),
  completed: z.boolean().default(true),
});

function unauthorized(error: unknown) {
  return NextResponse.json(
    { success: false, error: 'Bu işlem için patron oturumu gerekli.' },
    { status: error instanceof FabrikaForbiddenError ? 403 : 401 }
  );
}

function storedState(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const account = await prisma.companyAccount.findUniqueOrThrow({
      where: { id: principal.account.id },
      select: {
        companyName: true,
        onboardingState: true,
        onboardingCompletedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      completed: Boolean(account.onboardingCompletedAt),
      completedAt: account.onboardingCompletedAt,
      profile: {
        companyName: account.companyName,
        ...(storedState(account.onboardingState) || {}),
      },
    });
  } catch (error) {
    if (
      error instanceof FabrikaSessionError ||
      error instanceof FabrikaForbiddenError
    ) return unauthorized(error);
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
    const parsed = onboardingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kurulum bilgilerini kontrol edin.',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { completed, companyName, ...profile } = parsed.data;
    const account = await prisma.companyAccount.update({
      where: { id: principal.account.id },
      data: {
        companyName,
        onboardingState: profile,
        onboardingCompletedAt: completed ? new Date() : null,
      },
      select: {
        companyName: true,
        onboardingState: true,
        onboardingCompletedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      completed: Boolean(account.onboardingCompletedAt),
      completedAt: account.onboardingCompletedAt,
      profile: {
        companyName: account.companyName,
        ...(storedState(account.onboardingState) || {}),
      },
    });
  } catch (error) {
    if (
      error instanceof FabrikaSessionError ||
      error instanceof FabrikaForbiddenError
    ) return unauthorized(error);
    console.error('[Onboarding POST Error]:', error);
    return NextResponse.json(
      { success: false, error: 'Kurulum bilgileri kaydedilemedi.' },
      { status: 500 }
    );
  }
}
