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

function safeIntegration<
  T extends { apiKeyLookup: string; sourceBlobPathname: string },
>(integration: T) {
  const { apiKeyLookup: _lookup, sourceBlobPathname: _pathname, ...safe } =
    integration;
  return safe;
}

export async function GET() {
  if (!(await requirePlatformAdmin())) return unauthorized();

  try {
    const integrations = await prisma.websiteIntegration.findMany({
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
      orderBy: [{ status: 'asc' }, { submittedAt: 'desc' }],
    });

    return NextResponse.json({
      success: true,
      integrations: integrations.map((integration) => ({
        ...safeIntegration(integration),
        downloadUrl: `/api/platform-admin/website-integrations/${integration.id}/download`,
      })),
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
      const apiKey = generateWebsiteApiKey();
      const integration = await prisma.websiteIntegration.update({
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

    const integration = await prisma.websiteIntegration.update({
      where: { id: current.id },
      data: {
        status: parsed.data.status,
        deliveredAt:
          parsed.data.status === 'DELIVERED'
            ? current.deliveredAt || new Date()
            : null,
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
