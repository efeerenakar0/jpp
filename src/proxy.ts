import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  FABRIKA_SESSION_COOKIE,
  verifyFabrikaSessionToken,
} from '@/lib/fabrika-auth';

const FABRIKA_LOGIN_PATH = '/fabrika-giris';
const PUBLIC_WHATSAPP_WEBHOOKS = new Set([
  '/api/whatsapp/webhook',
  '/api/webhook/whatsapp',
]);

function isFabrikaProtectedPath(pathname: string): boolean {
  return (
    pathname === '/fabrika' ||
    pathname.startsWith('/fabrika/') ||
    pathname.startsWith('/api/fabrika/') ||
    pathname.startsWith('/api/whatsapp/') ||
    pathname.startsWith('/api/portfolios/')
  );
}

function unauthorizedApiResponse() {
  return NextResponse.json(
    { error: 'Bu işlem için Fabrika oturumu gerekli.' },
    { status: 401 }
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(FABRIKA_SESSION_COOKIE)?.value;
  const hasFabrikaSession = verifyFabrikaSessionToken(sessionToken);

  if (pathname === FABRIKA_LOGIN_PATH) {
    return hasFabrikaSession
      ? NextResponse.redirect(new URL('/fabrika', request.url))
      : NextResponse.next();
  }

  if (
    isFabrikaProtectedPath(pathname) &&
    !PUBLIC_WHATSAPP_WEBHOOKS.has(pathname) &&
    !hasFabrikaSession
  ) {
    if (pathname.startsWith('/api/')) {
      return unauthorizedApiResponse();
    }

    return NextResponse.redirect(new URL(FABRIKA_LOGIN_PATH, request.url));
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/emlakci-panel')) {
    const isLoginPage = pathname.startsWith('/admin/giris');

    if (!isLoginPage) {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (pathname.startsWith('/admin') && token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/giris', request.url));
      }

      if (
        pathname.startsWith('/emlakci-panel') &&
        token?.role !== 'AGENT' &&
        token?.role !== 'ADMIN'
      ) {
        return NextResponse.redirect(new URL('/admin/giris', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/emlakci-panel/:path*',
    '/fabrika/:path*',
    '/fabrika-giris',
    '/api/fabrika/:path*',
    '/api/whatsapp/:path*',
    '/api/portfolios/:path*',
  ],
};
