import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import {
  isStudioProvider,
  publicStudioCredentialStatus,
  saveCompanyStudioCredential,
} from '@/lib/company-ai-credentials';
import {
  FABRIKA_SESSION_COOKIE,
  readFabrikaSessionToken,
} from '@/lib/fabrika-auth';

async function currentAccountId() {
  const cookieStore = await cookies();
  const session = readFabrikaSessionToken(
    cookieStore.get(FABRIKA_SESSION_COOKIE)?.value
  );
  return session?.accountId || null;
}

export async function GET() {
  const accountId = await currentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'Fabrika oturumu gerekli.' }, { status: 401 });
  }

  const credentials = await prisma.companyAiCredential.findMany({
    where: { companyAccountId: accountId },
    select: { provider: true, keyHint: true, model: true, active: true },
  });

  return NextResponse.json({ providers: publicStudioCredentialStatus(credentials) });
}

export async function PUT(request: Request) {
  const accountId = await currentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'Fabrika oturumu gerekli.' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!isStudioProvider(body.provider)) {
      return NextResponse.json({ error: 'Geçerli bir AI sağlayıcısı seçin.' }, { status: 400 });
    }

    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : undefined;
    const model = typeof body.model === 'string' ? body.model : undefined;
    const active = body.active !== false;
    const credential = await saveCompanyStudioCredential({
      accountId,
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI ayarları kaydedilemedi.' },
      { status: 400 }
    );
  }
}
