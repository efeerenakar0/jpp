import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import {
  FABRIKA_SESSION_COOKIE,
  readFabrikaSessionToken,
} from '@/lib/fabrika-auth';
import {
  PLATFORM_ADMIN_SESSION_COOKIE,
  verifyPlatformAdminSessionToken,
} from '@/lib/platform-admin-auth';
import prisma from '@/lib/prisma';
import { resolveRootRedirect } from '@/lib/root-navigation';

const FABRIKA_LOGIN_PATH = '/fabrika-giris';
const PUBLIC_WHATSAPP_WEBHOOKS = new Set([
  '/api/webhook/whatsapp',
]);
const EVOLUTION_WEBHOOK_PREFIX = '/api/whatsapp/evolution/webhook/';
const WAHA_WEBHOOK_PREFIX = '/api/whatsapp/waha/webhook/';

function isPublicWhatsAppWebhook(pathname: string): boolean {
  return (
    PUBLIC_WHATSAPP_WEBHOOKS.has(pathname) ||
    pathname.startsWith(EVOLUTION_WEBHOOK_PREFIX) ||
    pathname.startsWith(WAHA_WEBHOOK_PREFIX)
  );
}

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
  const hostname = request.headers
    .get('host')
    ?.split(':')[0]
    .toLocaleLowerCase('en-US');

  if (
    pathname === '/' &&
    hostname &&
    hostname !== 'localhost' &&
    !hostname.endsWith('.localhost') &&
    !hostname.endsWith('.vercel.app')
  ) {
    const publicWorkspace = await prisma.developerWorkspace.findUnique({
      where: { customHostname: hostname },
      select: { temporarySlug: true, siteStatus: true, domainStatus: true },
    });
    if (
      publicWorkspace?.siteStatus === 'PUBLISHED' &&
      publicWorkspace.domainStatus === 'VERIFIED'
    ) {
      const publicUrl = request.nextUrl.clone();
      publicUrl.pathname = `/site/${publicWorkspace.temporarySlug}`;
      return NextResponse.rewrite(publicUrl);
    }
  }

  const rootRedirect = resolveRootRedirect(pathname);

  if (rootRedirect) {
    return NextResponse.redirect(new URL(rootRedirect, request.url));
  }

  const sessionToken = request.cookies.get(FABRIKA_SESSION_COOKIE)?.value;
  const sessionPayload = readFabrikaSessionToken(sessionToken);
  const companyAccount = sessionPayload
    ? await prisma.companyAccount.findUnique({
        where: { id: sessionPayload.accountId },
        select: {
          status: true,
          subscriptionStatus: true,
          subscriptionEndsAt: true,
          workspaceEnabled: true,
          subscriptionPlan: true,
          slug: true,
          sessionVersion: true,
        },
      })
    : null;
  const companyMember =
    sessionPayload?.principalType === 'EMPLOYEE'
      ? await prisma.companyMember.findFirst({
          where: {
            id: sessionPayload.principalId,
            companyAccountId: sessionPayload.accountId,
          },
          select: {
            active: true,
            sessionVersion: true,
          },
        })
      : null;
  const hasValidPrincipal =
    sessionPayload?.principalType === 'OWNER'
      ? sessionPayload.principalId === sessionPayload.accountId &&
        sessionPayload.principalSessionVersion ===
          companyAccount?.sessionVersion
      : Boolean(
          companyMember?.active &&
            companyMember.sessionVersion ===
              sessionPayload?.principalSessionVersion
        );
  const hasFabrikaSession = Boolean(
    sessionPayload &&
      companyAccount?.status === 'ACTIVE' &&
      companyAccount.workspaceEnabled &&
      companyAccount.sessionVersion === sessionPayload.accountSessionVersion &&
      hasValidPrincipal &&
      (!companyAccount.subscriptionEndsAt ||
        companyAccount.subscriptionEndsAt.getTime() > Date.now()) &&
      (companyAccount.subscriptionStatus === 'ACTIVE' ||
        companyAccount.subscriptionStatus === 'TRIAL')
  );

  const platformAdminToken = request.cookies.get(
    PLATFORM_ADMIN_SESSION_COOKIE
  )?.value;
  const hasPlatformAdminSession =
    verifyPlatformAdminSessionToken(platformAdminToken);
  const isPlatformAdminLogin =
    pathname === '/platform-admin/giris' ||
    pathname === '/api/platform-admin/login';
  const isPlatformAdminPath =
    pathname === '/platform-admin' ||
    pathname.startsWith('/platform-admin/') ||
    pathname.startsWith('/api/platform-admin/');

  if (isPlatformAdminLogin) {
    return hasPlatformAdminSession
      ? NextResponse.redirect(new URL('/platform-admin', request.url))
      : NextResponse.next();
  }

  if (isPlatformAdminPath && !hasPlatformAdminSession) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Platform yöneticisi oturumu gerekli.' },
        { status: 401 }
      );
    }

    return NextResponse.redirect(
      new URL('/platform-admin/giris', request.url)
    );
  }

  if (
    pathname === FABRIKA_LOGIN_PATH ||
    pathname.startsWith(`${FABRIKA_LOGIN_PATH}/`)
  ) {
    return hasFabrikaSession
      ? NextResponse.redirect(new URL('/fabrika', request.url))
      : NextResponse.next();
  }

  const isHunterRoute =
    pathname === '/fabrika/avci' ||
    pathname.startsWith('/fabrika/avci/') ||
    pathname.startsWith('/api/fabrika/hunting/');
  if (
    hasFabrikaSession &&
    isHunterRoute &&
    companyAccount?.slug !== 'jasmine-group' &&
    !companyAccount?.subscriptionPlan.includes('+hunter')
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Avcı paketi bu şirket için etkin değil.' },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL('/fabrika/portfoyler', request.url));
  }

  if (
    isFabrikaProtectedPath(pathname) &&
    !isPublicWhatsAppWebhook(pathname) &&
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
    '/',
    '/admin/:path*',
    '/emlakci-panel/:path*',
    '/fabrika/:path*',
    '/fabrika-giris',
    '/api/fabrika/:path*',
    '/api/whatsapp/:path*',
    '/api/portfolios/:path*',
    '/platform-admin/:path*',
    '/api/platform-admin/:path*',
  ],
};
