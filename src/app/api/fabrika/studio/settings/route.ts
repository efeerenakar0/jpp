import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  isStudioProvider,
  publicStudioCredentialStatus,
  saveCompanyStudioCredential,
} from '@/lib/company-ai-credentials';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const credentials = await prisma.companyAiCredential.findMany({
      where: { companyAccountId: principal.account.id },
      select: { provider: true, keyHint: true, model: true, active: true },
    });

    return NextResponse.json({
      providers: publicStudioCredentialStatus(credentials),
    });
  } catch (error) {
    const status = error instanceof FabrikaForbiddenError ? 403 : 401;
    if (
      error instanceof FabrikaForbiddenError ||
      error instanceof FabrikaSessionError
    ) {
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}

export async function PUT(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const body = (await request.json()) as Record<string, unknown>;
    if (!isStudioProvider(body.provider)) {
      return NextResponse.json({ error: 'Geçerli bir AI sağlayıcısı seçin.' }, { status: 400 });
    }

    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : undefined;
    const model = typeof body.model === 'string' ? body.model : undefined;
    const active = body.active !== false;
    const credential = await saveCompanyStudioCredential({
      accountId: principal.account.id,
      provider: body.provider,
      apiKey,
      model,
      active,
    });

    return NextResponse.json({
      success: true,
      provider: credential.provider,
      keyHint: credential.keyHint,
      model: credential.model,
      active: credential.active,
    });
  } catch (error) {
    if (
      error instanceof FabrikaForbiddenError ||
      error instanceof FabrikaSessionError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof FabrikaForbiddenError ? 403 : 401 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI ayarları kaydedilemedi.' },
      { status: 400 }
    );
  }
}
