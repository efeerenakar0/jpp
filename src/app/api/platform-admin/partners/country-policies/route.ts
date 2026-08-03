import { NextResponse } from 'next/server';
import { PartnerCountryPolicyStatus } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';

const schema = z.object({
  companyAccountId: z.string().trim().min(1),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  status: z.nativeEnum(PartnerCountryPolicyStatus),
  legalBasisNote: z.string().trim().min(5).max(5000),
  consentRequired: z.boolean().default(false),
  footerText: z.string().trim().max(3000).optional(),
  dailyCompanyLimit: z.number().int().min(1).max(500).default(25),
  dailyDomainLimit: z.number().int().min(1).max(25).default(3),
  dailyMailboxLimit: z.number().int().min(1).max(500).default(25),
});

export async function GET(request: Request) {
  if (!(await requirePlatformAdmin())) return NextResponse.json({ success: false }, { status: 401 });
  const accountId = new URL(request.url).searchParams.get('companyAccountId');
  const policies = await prisma.partnerCountryPolicy.findMany({ where: accountId ? { companyAccountId: accountId } : undefined, include: { companyAccount: { select: { companyName: true } } }, orderBy: [{ companyAccountId: 'asc' }, { countryCode: 'asc' }] });
  return NextResponse.json({ success: true, policies });
}

export async function PATCH(request: Request) {
  const admin = await requirePlatformAdmin();
  if (!admin) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const policy = await prisma.partnerCountryPolicy.upsert({
      where: { companyAccountId_countryCode: { companyAccountId: input.companyAccountId, countryCode: input.countryCode } },
      create: { ...input, footerText: input.footerText || null, reviewedByType: 'PLATFORM_ADMIN', reviewedById: admin.username, reviewedAt: new Date() },
      update: { ...input, footerText: input.footerText || null, reviewedByType: 'PLATFORM_ADMIN', reviewedById: admin.username, reviewedAt: new Date() },
    });
    return NextResponse.json({ success: true, policy });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error && error.name === 'ZodError' ? 'Politika alanlarını kontrol edin.' : 'Politika kaydedilemedi.' }, { status: 400 });
  }
}
