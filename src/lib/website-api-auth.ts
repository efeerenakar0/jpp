import 'server-only';

import type { CompanyAccount, WebsiteIntegration } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  apiKeyFromRequest,
  createWebsiteApiKeyLookup,
  normalizeWebsiteOrigin,
  WebsiteApiRateLimiter,
} from '@/lib/website-integration';

type WebsiteApiPrincipal = {
  integration: WebsiteIntegration;
  account: CompanyAccount;
};

export class WebsiteApiAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'WebsiteApiAuthError';
  }
}

const globalForWebsiteApi = globalThis as unknown as {
  websiteApiRateLimiter?: WebsiteApiRateLimiter;
};

const rateLimiter =
  globalForWebsiteApi.websiteApiRateLimiter ||
  new WebsiteApiRateLimiter(120, 60_000);

if (process.env.NODE_ENV !== 'production') {
  globalForWebsiteApi.websiteApiRateLimiter = rateLimiter;
}

export async function requireWebsiteApiPrincipal(
  request: Request
): Promise<WebsiteApiPrincipal> {
  const apiKey = apiKeyFromRequest(request);
  if (!apiKey || !apiKey.startsWith('jpp_site_')) {
    throw new WebsiteApiAuthError(401, 'Geçerli API anahtarı gerekli.');
  }

  const integration = await prisma.websiteIntegration.findUnique({
    where: { apiKeyLookup: createWebsiteApiKeyLookup(apiKey) },
    include: { companyAccount: true },
  });
  if (!integration) {
    throw new WebsiteApiAuthError(401, 'Geçerli API anahtarı gerekli.');
  }
  if (!['READY', 'DELIVERED'].includes(integration.status)) {
    throw new WebsiteApiAuthError(403, 'Site entegrasyonu henüz etkin değil.');
  }

  const account = integration.companyAccount;
  if (
    account.status !== 'ACTIVE' ||
    !account.workspaceEnabled ||
    ['CANCELLED', 'EXPIRED', 'PAUSED'].includes(account.subscriptionStatus)
  ) {
    throw new WebsiteApiAuthError(403, 'Şirket hesabı API erişimine kapalı.');
  }

  const requestOrigin = request.headers.get('origin');
  if (requestOrigin) {
    let normalizedOrigin: string;
    try {
      normalizedOrigin = normalizeWebsiteOrigin(requestOrigin);
    } catch {
      throw new WebsiteApiAuthError(403, 'Bu kaynak için API erişimi kapalı.');
    }
    if (normalizedOrigin !== integration.websiteOrigin) {
      throw new WebsiteApiAuthError(403, 'Bu kaynak için API erişimi kapalı.');
    }
  }

  const forwardedFor = request.headers.get('x-forwarded-for') || 'server';
  const client = forwardedFor.split(',')[0]?.trim() || 'server';
  if (!rateLimiter.check(`${integration.id}:${client}`)) {
    throw new WebsiteApiAuthError(429, 'Çok fazla istek gönderildi.');
  }

  return { integration, account };
}

export function websiteApiResponse(
  request: Request,
  principal: WebsiteApiPrincipal,
  body: unknown,
  init?: ResponseInit
) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Vary', 'Origin');
  const requestOrigin = request.headers.get('origin');
  if (
    requestOrigin &&
    normalizeWebsiteOrigin(requestOrigin) ===
      principal.integration.websiteOrigin
  ) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
  }
  return Response.json(body, { ...init, headers });
}

export function websiteApiError(error: unknown) {
  if (error instanceof WebsiteApiAuthError) {
    return Response.json(
      { success: false, error: error.message },
      {
        status: error.status,
        headers: {
          'Cache-Control': 'no-store',
          Vary: 'Origin',
        },
      }
    );
  }

  console.error('[Website portfolio API error]', error);
  return Response.json(
    { success: false, error: 'Portföy işlemi tamamlanamadı.' },
    {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        Vary: 'Origin',
      },
    }
  );
}

export async function websiteApiPreflight(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return new Response(null, { status: 204 });

  let normalizedOrigin: string;
  try {
    normalizedOrigin = normalizeWebsiteOrigin(origin);
  } catch {
    return new Response(null, { status: 403 });
  }

  const integration = await prisma.websiteIntegration.findFirst({
    where: {
      websiteOrigin: normalizedOrigin,
      status: { in: ['READY', 'DELIVERED'] },
      companyAccount: {
        status: 'ACTIVE',
        workspaceEnabled: true,
      },
    },
    select: { id: true },
  });
  if (!integration) return new Response(null, { status: 403 });

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key',
      'Access-Control-Max-Age': '3600',
      Vary: 'Origin',
    },
  });
}
