import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';
import {
  buildWebsiteIntegrationPrompt,
  createWebsiteApiKeyLookup,
  generateWebsiteApiKey,
  websiteApiKeyHint,
  websiteIntegrationStatuses,
} from '@/lib/website-integration';
import { assertWebsiteDeliveryTransition } from '@/lib/website-delivery-state';

export const dynamic = 'force-dynamic';

const updateSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('status'),
    id: z.string().trim().min(1),
    status: z.enum(websiteIntegrationStatuses),
  }),
  z.object({
    action: z.literal('rotate_key'),
    id: z.string().trim().min(1),
  }),
]);

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Platform yöneticisi oturumu gerekli.' },
    { status: 401 }
  );
}

function apiBaseUrl(request: Request) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ||
    new URL(request.url).origin
  );
}

function safeVersion(version: Record<string, unknown>) {
  const safe = { ...version };
  delete safe.sourceBlobPathname;
  delete safe.resultBlobPathname;
  return safe;
}

function safeIntegration<
  T extends {
    apiKeyLookup: string;
    sourceBlobPathname: string;
    versions?: Array<Record<string, unknown>>;
  },
>(integration: T) {
  const {
    apiKeyLookup: _lookup,
    sourceBlobPathname: _pathname,
    versions,
    ...safe
  } = integration;
  void _lookup;
  void _pathname;
  return {
    ...safe,
    ...(versions
      ? {
          versions: versions.map(safeVersion),
        }
      : {}),
  };
}

export async function GET() {
  if (!(await requirePlatformAdmin())) return unauthorized();

  try {
    const [integrations, generatedSites] = await Promise.all([
      prisma.websiteIntegration.findMany({
        include: {
          companyAccount: {
            select: {
              id: true,
              companyName: true,
              slug: true,
              ownerName: true,
              ownerEmail: true,
            },
          },
          versions: { orderBy: { version: 'desc' }, take: 10 },
          apiKeys: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              environment: true,
              status: true,
              keyHint: true,
              expiresAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
      }),
      prisma.generatedWebsite.findMany({
        include: {
          companyAccount: {
            select: { id: true, companyName: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    return NextResponse.json({
      success: true,
      integrations: integrations.map((integration) => ({
        ...safeIntegration(integration),
        downloadUrl: `/api/platform-admin/website-integrations/${integration.id}/download`,
      })),
      generatedSites,
    });
  } catch (error) {
    console.error('[Platform website integrations GET error]', error);
    return NextResponse.json(
      { success: false, error: 'Site entegrasyonları yüklenemedi.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await requirePlatformAdmin())) return unauthorized();

  try {
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz site entegrasyonu işlemi.' },
        { status: 400 }
      );
    }
    const current = await prisma.websiteIntegration.findUnique({
      where: { id: parsed.data.id },
      include: {
        companyAccount: {
          select: { companyName: true },
        },
      },
    });
    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Site entegrasyonu bulunamadı.' },
        { status: 404 }
      );
    }

    if (parsed.data.action === 'rotate_key') {
      if (current.status !== 'APPROVED' && current.status !== 'DELIVERED') {
        return NextResponse.json(
          { success: false, error: 'Production anahtarı yalnız QA onayından sonra yenilenebilir.' },
          { status: 409 }
        );
      }
      const apiKey = generateWebsiteApiKey();
      const integration = await prisma.$transaction(async (tx) => {
        await tx.websiteIntegrationApiKey.updateMany({
          where: {
            websiteIntegrationId: current.id,
            environment: 'PRODUCTION',
            status: 'ACTIVE',
          },
          data: { status: 'REVOKED', revokedAt: new Date() },
        });
        await tx.websiteIntegrationApiKey.create({
          data: {
            companyAccountId: current.companyAccountId,
            websiteIntegrationId: current.id,
            environment: 'PRODUCTION',
            keyLookup: createWebsiteApiKeyLookup(apiKey),
            keyHint: websiteApiKeyHint(apiKey),
            createdByType: 'PLATFORM_ADMIN',
            createdById: 'platform-admin',
          },
        });
        return tx.websiteIntegration.update({
          where: { id: current.id },
          data: {
            apiKeyLookup: createWebsiteApiKeyLookup(apiKey),
            apiKeyHint: websiteApiKeyHint(apiKey),
            apiKeyCreatedAt: new Date(),
          },
          include: {
            companyAccount: {
              select: {
                id: true,
                companyName: true,
                slug: true,
                ownerName: true,
                ownerEmail: true,
              },
            },
          },
        });
      });
      return NextResponse.json({
        success: true,
        integration: safeIntegration(integration),
        oneTimeApiKey: apiKey,
        codexPrompt: buildWebsiteIntegrationPrompt({
          companyName: current.companyAccount.companyName,
          apiBaseUrl: apiBaseUrl(request),
          apiKey,
        }),
        warning:
          'Eski anahtar hemen geçersiz oldu. Yeni anahtar yalnızca bu yanıtta tam gösterilir.',
      });
    }

    if (parsed.data.status === 'APPROVED' || parsed.data.status === 'DELIVERED') {
      return NextResponse.json(
        { success: false, error: 'Onay ve teslim işlemlerini QA teslim akışından tamamlayın.' },
        { status: 409 }
      );
    }
    assertWebsiteDeliveryTransition(current.status, parsed.data.status);
    const integration = await prisma.websiteIntegration.update({
      where: { id: current.id },
      data: {
        status: parsed.data.status,
        deliveredAt: null,
      },
      include: {
        companyAccount: {
          select: {
            id: true,
            companyName: true,
            slug: true,
            ownerName: true,
            ownerEmail: true,
          },
        },
      },
    });
    return NextResponse.json({
      success: true,
      integration: safeIntegration(integration),
    });
  } catch (error) {
    console.error('[Platform website integrations PATCH error]', error);
    return NextResponse.json(
      { success: false, error: 'Site entegrasyonu güncellenemedi.' },
      { status: 500 }
    );
  }
}
