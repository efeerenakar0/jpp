import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';

const configSchema = z.object({
  companyName: z.string().trim().max(160).optional(),
  assistantName: z.string().trim().max(80).optional(),
  serviceCity: z.string().trim().max(120).optional(),
  companyAddress: z.string().trim().max(2000).optional(),
  companyDetails: z.string().trim().max(5000).optional(),
  websiteUrl: z.string().trim().max(1000).optional(),
  instagramUrl: z.string().trim().max(1000).optional(),
  languages: z.string().trim().max(500).optional(),
});

function authError(error: unknown) {
  if (
    error instanceof FabrikaForbiddenError ||
    error instanceof FabrikaSessionError
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: error instanceof FabrikaForbiddenError ? 403 : 401 }
    );
  }
  return null;
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const config = await prisma.whatsAppConfig.findUnique({
      where: { companyAccountId: principal.account.id },
    });
    return NextResponse.json({
      companyName: config?.companyName || principal.account.companyName,
      assistantName: config?.assistantName || 'Efe',
      serviceCity: config?.serviceCity || 'Alanya',
      companyAddress: config?.companyAddress || '',
      companyDetails: config?.companyDetails || '',
      websiteUrl: config?.websiteUrl || '',
      instagramUrl: config?.instagramUrl || '',
      languages: config?.languages || 'Türkçe',
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('[WhatsApp Config GET Error]:', error);
    return NextResponse.json(
      { error: 'WhatsApp ayarları okunamadı.' },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = configSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ayar alanlarından biri geçersiz.' },
        { status: 400 }
      );
    }
    const body = parsed.data;
    await prisma.whatsAppConfig.upsert({
      where: { companyAccountId: principal.account.id },
      update: {
        provider: 'WAHA',
        companyName: body.companyName || undefined,
        assistantName: body.assistantName || undefined,
        serviceCity: body.serviceCity || undefined,
        companyAddress: body.companyAddress || undefined,
        companyDetails: body.companyDetails || undefined,
        websiteUrl: body.websiteUrl || undefined,
        instagramUrl: body.instagramUrl || undefined,
        languages: body.languages || undefined,
      },
      create: {
        companyAccountId: principal.account.id,
        provider: 'WAHA',
        companyName: body.companyName || principal.account.companyName,
        assistantName: body.assistantName || 'Efe',
        serviceCity: body.serviceCity || 'Alanya',
        companyAddress: body.companyAddress || null,
        companyDetails: body.companyDetails || null,
        websiteUrl: body.websiteUrl || null,
        instagramUrl: body.instagramUrl || null,
        languages: body.languages || 'Türkçe',
      },
    });
    return NextResponse.json({
      success: true,
      message: 'Ayarlar şirkete özel ve şifreli biçimde kaydedildi.',
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('[WhatsApp Config POST Error]:', error);
    return NextResponse.json(
      { error: 'Ayarlar kaydedilemedi.' },
      { status: 503 }
    );
  }
}
