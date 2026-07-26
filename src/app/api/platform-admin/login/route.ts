import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  PLATFORM_ADMIN_SESSION_COOKIE,
  PLATFORM_ADMIN_SESSION_MAX_AGE,
  createPlatformAdminAttemptKey,
  createPlatformAdminSessionToken,
  isPlatformAdminConfigured,
  validatePlatformAdminCredentials,
} from '@/lib/platform-admin-auth';

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

function getClientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return forwardedFor?.split(',')[0]?.trim() || 'unknown-client';
}

export async function POST(request: Request) {
  if (!isPlatformAdminConfigured()) {
    return NextResponse.json(
      { error: 'Platform yöneticisi girişi henüz yapılandırılmamış.' },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
    const username =
      typeof body.username === 'string' ? body.username.trim() : '';
    const password =
      typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Kullanıcı adı ve şifre gereklidir.' },
        { status: 400 }
      );
    }

    const attemptKey = createPlatformAdminAttemptKey(
      getClientIdentifier(request),
      username
    );
    const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MS);
    const failedAttempts = await prisma.platformAdminLoginAttempt.count({
      where: {
        keyHash: attemptKey,
        succeeded: false,
        createdAt: { gte: windowStart },
      },
    });

    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        {
          error:
            'Çok fazla başarısız deneme yapıldı. 15 dakika sonra tekrar deneyin.',
        },
        { status: 429 }
      );
    }

    const valid = validatePlatformAdminCredentials(username, password);
    await prisma.platformAdminLoginAttempt.create({
      data: {
        keyHash: attemptKey,
        succeeded: valid,
      },
    });

    if (!valid) {
      return NextResponse.json(
        { error: 'Kullanıcı adı veya şifre hatalı.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: PLATFORM_ADMIN_SESSION_COOKIE,
      value: createPlatformAdminSessionToken(username),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: PLATFORM_ADMIN_SESSION_MAX_AGE,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Platform Admin Login Error]:', error);
    return NextResponse.json(
      { error: 'Giriş isteği işlenemedi.' },
      { status: 500 }
    );
  }
}
