import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { companySettingsRequestSchema } from '@/lib/company-settings';
import {
  CompanySettingsValidationError,
  getCompanySettings,
  saveCompanySettings,
} from '@/lib/company-settings-service';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';

export const dynamic = 'force-dynamic';

function authError(error: FabrikaSessionError | FabrikaForbiddenError) {
  return NextResponse.json(
    { success: false, error: 'Bu işlem için patron oturumu gerekli.' },
    { status: error instanceof FabrikaForbiddenError ? 403 : 401 }
  );
}

function serverError(error: unknown, fallback: string) {
  if (
    error instanceof FabrikaSessionError ||
    error instanceof FabrikaForbiddenError
  ) {
    return authError(error);
  }
  if (error instanceof CompanySettingsValidationError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: error.issues[0]?.message || 'Ayarları kontrol edin.',
        issues: error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  console.error('[Company Settings Error]', {
    type: error instanceof Error ? error.name : 'UnknownError',
    code:
      typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code).slice(0, 80)
        : undefined,
  });
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const result = await getCompanySettings(principal.account.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return serverError(error, 'Şirket ayarları yüklenemedi.');
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = companySettingsRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Ayarları kontrol edin.',
          issues: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await saveCompanySettings(
      principal.account.id,
      parsed.data,
      new Date()
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return serverError(error, 'Şirket ayarları kaydedilemedi.');
  }
}
