import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import {
  createDeedCaseSchema,
  createDeedTrackingCase,
  DeedTrackingError,
  listDeedTrackingCases,
  updateDeedCaseSchema,
  updateDeedTrackingCase,
} from '@/lib/deed-tracking-service';
import { FabrikaSessionError, requireFabrikaPrincipal } from '@/lib/fabrika-session';

export const dynamic = 'force-dynamic';

function principalRef(principal: Awaited<ReturnType<typeof requireFabrikaPrincipal>>) {
  return {
    type: principal.type,
    id: principal.type === 'OWNER' ? principal.account.id : principal.member.id,
  };
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json({ success: false, error: 'Oturum gerekli.' }, { status: 401 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { success: false, error: error.issues[0]?.message || 'Bilgileri kontrol edin.' },
      { status: 400 }
    );
  }
  if (error instanceof DeedTrackingError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'FORBIDDEN'
          ? 403
          : error.code === 'CONFLICT'
            ? 409
            : 422;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
  console.error(
    '[Deed Tracking Error]',
    {
      type: error instanceof Error ? error.name : 'UnknownError',
      code:
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code).slice(0, 80)
          : undefined,
    }
  );
  return NextResponse.json({ success: false, error: fallback }, { status: 500 });
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const cases = await listDeedTrackingCases({
      companyAccountId: principal.account.id,
      assignedMemberId:
        principal.type === 'EMPLOYEE' ? principal.member.id : undefined,
    });
    return NextResponse.json({ success: true, cases });
  } catch (error) {
    return errorResponse(error, 'Tapu takip kayıtları yüklenemedi.');
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = createDeedCaseSchema.parse(await request.json());
    const data =
      principal.type === 'EMPLOYEE'
        ? { ...parsed, assignedMemberId: principal.member.id }
        : parsed;
    const deedCase = await createDeedTrackingCase({
      companyAccountId: principal.account.id,
      data,
      principal: principalRef(principal),
      now: new Date(),
    });
    return NextResponse.json({ success: true, deedCase }, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Tapu takip kaydı oluşturulamadı.');
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = updateDeedCaseSchema.parse(await request.json());
    if (
      principal.type === 'EMPLOYEE' &&
      parsed.assignedMemberId !== undefined &&
      parsed.assignedMemberId !== principal.member.id
    ) {
      return NextResponse.json(
        { success: false, error: 'Çalışan yalnız kendi sorumluluğundaki dosyayı yönetebilir.' },
        { status: 403 }
      );
    }
    const deedCase = await updateDeedTrackingCase({
      companyAccountId: principal.account.id,
      accessibleMemberId:
        principal.type === 'EMPLOYEE' ? principal.member.id : undefined,
      data: parsed,
      principal: principalRef(principal),
      now: new Date(),
    });
    return NextResponse.json({ success: true, deedCase });
  } catch (error) {
    return errorResponse(error, 'Tapu takip kaydı güncellenemedi.');
  }
}
