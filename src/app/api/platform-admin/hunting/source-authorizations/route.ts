import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';
import {
  createSourceAuthorization,
  updateSourceAuthorization,
} from '@/lib/hunting-v2/source-authorization-service';

export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json(
    { error: 'Platform yöneticisi oturumu gerekli.' },
    { status: 401 }
  );
}

function errorResponse(error: unknown) {
  if (error instanceof Error) {
    const knownError =
      error.name === 'ZodError' ||
      error.message.includes('bulunamadı') ||
      error.message.includes('oluşturulamaz') ||
      error.message.includes('aktifleştirilemez') ||
      error.message.includes('kapsam');
    if (!knownError) {
      console.error('[SourceAuthorization API Error]:', error);
      return NextResponse.json(
        { error: 'Kaynak yetkisi işlemi tamamlanamadı.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: error.message },
      {
        status:
          error.name === 'ZodError'
            ? 400
            : error.message.includes('bulunamadı')
              ? 404
              : 400,
      }
    );
  }
  return NextResponse.json(
    { error: 'Kaynak yetkisi işlemi tamamlanamadı.' },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  if (!(await requirePlatformAdmin())) return unauthorized();

  const accountId = new URL(request.url).searchParams.get('companyAccountId');
  const authorizations = await prisma.sourceAuthorization.findMany({
    where: accountId ? { companyAccountId: accountId } : undefined,
    select: {
      id: true,
      companyAccountId: true,
      provider: true,
      status: true,
      allowedScopes: true,
      contractReference: true,
      startsAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      companyAccount: {
        select: { companyName: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({ authorizations });
}

export async function POST(request: Request) {
  if (!(await requirePlatformAdmin())) return unauthorized();

  try {
    const authorization = await createSourceAuthorization(await request.json());
    return NextResponse.json({ authorization }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  if (!(await requirePlatformAdmin())) return unauthorized();

  try {
    const authorization = await updateSourceAuthorization(await request.json());
    return NextResponse.json({ authorization });
  } catch (error) {
    return errorResponse(error);
  }
}
