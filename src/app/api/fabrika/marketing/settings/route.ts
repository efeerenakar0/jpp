import { AiProvider } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import {
  DEFAULT_OPENROUTER_MODEL,
  saveCompanyMarketingCredential,
} from '@/lib/marketing-ai';

const settingsSchema = z.object({
  apiKey: z.string().trim().optional(),
  model: z.string().trim().min(2).max(120).default(DEFAULT_OPENROUTER_MODEL),
  active: z.boolean().default(true),
});

function authError(error: unknown) {
  if (error instanceof FabrikaForbiddenError || error instanceof FabrikaSessionError) {
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
    const credential = await prisma.companyAiCredential.findUnique({
      where: {
        companyAccountId_provider: {
          companyAccountId: principal.account.id,
          provider: AiProvider.OPENROUTER,
        },
      },
      select: { keyHint: true, model: true, active: true, updatedAt: true },
    });
    return NextResponse.json({
      configured: Boolean(credential),
      keyHint: credential?.keyHint || null,
      model: credential?.model || DEFAULT_OPENROUTER_MODEL,
      active: credential?.active || false,
      updatedAt: credential?.updatedAt || null,
    });
  } catch (error) {
    return authError(error) || NextResponse.json({ error: 'Ayarlar alınamadı.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Ayarlar geçersiz.' },
        { status: 400 }
      );
    }
    const credential = await saveCompanyMarketingCredential({
      accountId: principal.account.id,
      apiKey: parsed.data.apiKey,
      model: parsed.data.model,
      active: parsed.data.active,
    });
    return NextResponse.json({
      success: true,
      configured: true,
      keyHint: credential.keyHint,
      model: credential.model,
      active: credential.active,
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.' },
      { status: 400 }
    );
  }
}
