import { NextResponse } from 'next/server';
import {
  createFabrikaSessionToken,
  FABRIKA_SESSION_COOKIE,
  FABRIKA_SESSION_MAX_AGE,
  isFabrikaAuthConfigured,
  validateFabrikaCredentials,
} from '@/lib/fabrika-auth';

export async function POST(request: Request) {
  if (!isFabrikaAuthConfigured()) {
    return NextResponse.json(
      { error: 'Fabrika girişi sunucuda henüz yapılandırılmamış.' },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      accessKey?: unknown;
      verificationCode?: unknown;
    };
    const accessKey = typeof body.accessKey === 'string' ? body.accessKey : '';
    const verificationCode =
      typeof body.verificationCode === 'string' ? body.verificationCode : '';

    if (!validateFabrikaCredentials(accessKey, verificationCode)) {
      return NextResponse.json(
        { error: 'Giriş anahtarı veya doğrulama kodu hatalı.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: FABRIKA_SESSION_COOKIE,
      value: createFabrikaSessionToken(),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: FABRIKA_SESSION_MAX_AGE,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Giriş isteği işlenemedi.' },
      { status: 400 }
    );
  }
}
