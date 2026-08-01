import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { Prisma, type CompanyAccount, type WebsiteIntegration } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  apiKeyFromRequest,
  createWebsiteRequestSignature,
  createWebsiteApiKeyLookup,
  normalizeWebsiteOrigin,
  WEBSITE_CONNECTOR_MAX_CLOCK_SKEW_MS,
  WEBSITE_CONNECTOR_VERSION,
  websiteRequestBodyHash,
  websiteRequestCanonicalValue,
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

const WEBSITE_RATE_LIMIT_PER_MINUTE = 120;

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function verifySignedRequest(
  request: Request,
  integration: WebsiteIntegration,
  apiKey: string
) {
  const version = request.headers.get('x-jasmine-version')?.trim();
  const timestamp = request.headers.get('x-jasmine-timestamp')?.trim() || '';
  const nonce = request.headers.get('x-jasmine-nonce')?.trim() || '';
  const signature = request.headers.get('x-jasmine-signature')?.trim() || '';

  if (version !== WEBSITE_CONNECTOR_VERSION) {
    throw new WebsiteApiAuthError(400, 'Website Connector sürümü geçersiz.');
  }
  if (!/^\d{10}$/.test(timestamp)) {
    throw new WebsiteApiAuthError(400, 'İstek zaman damgası geçersiz.');
  }
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new WebsiteApiAuthError(400, 'İstek kimliği geçersiz.');
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) {
    throw new WebsiteApiAuthError(401, 'İstek imzası geçersiz.');
  }

  const timestampMs = Number(timestamp) * 1000;
  const now = Date.now();
  if (Math.abs(now - timestampMs) > WEBSITE_CONNECTOR_MAX_CLOCK_SKEW_MS) {
    throw new WebsiteApiAuthError(401, 'İstek zaman aşımına uğramış.');
  }

  const url = new URL(request.url);
  const bodyHash = websiteRequestBodyHash(await request.clone().arrayBuffer());
  const canonicalValue = websiteRequestCanonicalValue({
    method: request.method,
    pathWithQuery: `${url.pathname}${url.search}`,
    timestamp,
    nonce,
    bodyHash,
  });
  const expected = createWebsiteRequestSignature(apiKey, canonicalValue);
  if (!safeEqual(signature, expected)) {
    throw new WebsiteApiAuthError(401, 'İstek imzası doğrulanamadı.');
  }

  const expiresAt = new Date(timestampMs + WEBSITE_CONNECTOR_MAX_CLOCK_SKEW_MS);
  try {
    await prisma.websiteRequestNonce.create({
      data: { websiteIntegrationId: integration.id, nonce, expiresAt },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new WebsiteApiAuthError(409, 'Bu istek daha önce işlendi.');
    }
    throw error;
  }

  const bucketStart = new Date(Math.floor(now / 60_000) * 60_000);
  const bucket = await prisma.websiteRateLimitBucket.upsert({
    where: {
      websiteIntegrationId_bucketStart: {
        websiteIntegrationId: integration.id,
        bucketStart,
      },
    },
    create: {
      websiteIntegrationId: integration.id,
      bucketStart,
      requestCount: 1,
    },
    update: { requestCount: { increment: 1 } },
    select: { requestCount: true },
  });
  if (bucket.requestCount > WEBSITE_RATE_LIMIT_PER_MINUTE) {
    throw new WebsiteApiAuthError(429, 'Çok fazla istek gönderildi.');
  }

  if (Math.random() < 0.02) {
    void Promise.all([
      prisma.websiteRequestNonce.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }),
      prisma.websiteRateLimitBucket.deleteMany({
        where: { bucketStart: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
      }),
    ]).catch(() => undefined);
  }
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
  if (
    requestOrigin &&
    normalizeWebsiteOrigin(requestOrigin) !== integration.websiteOrigin
  ) {
    throw new WebsiteApiAuthError(403, 'Bu kaynak için API erişimi kapalı.');
  }

  await verifySignedRequest(request, integration, apiKey);

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
      'Access-Control-Allow-Headers':
        'Authorization, Content-Type, X-API-Key, X-Jasmine-Version, X-Jasmine-Timestamp, X-Jasmine-Nonce, X-Jasmine-Signature',
      'Access-Control-Max-Age': '3600',
      Vary: 'Origin',
    },
  });
}
