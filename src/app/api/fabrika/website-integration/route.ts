import { randomUUID } from 'node:crypto';
import { del, put } from '@vercel/blob';
import { NotificationType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import {
  buildWebsiteIntegrationPrompt,
  createWebsiteApiKeyLookup,
  generateWebsiteApiKey,
  MAX_SITE_SOURCE_BYTES,
  normalizeWebsiteOrigin,
  safeWebsiteArchiveName,
  websiteApiKeyHint,
  websiteIntegrationMetadataSchema,
} from '@/lib/website-integration';

export const dynamic = 'force-dynamic';

const rotateSchema = z.object({
  action: z.literal('rotate_key'),
  id: z.string().trim().min(1),
});

function apiBaseUrl(request: Request) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '') ||
    new URL(request.url).origin
  );
}

function safeIntegration<T extends { apiKeyLookup: string; sourceBlobPathname: string }>(
  integration: T
) {
  return Object.fromEntries(
    Object.entries(integration).filter(
      ([key]) => key !== 'apiKeyLookup' && key !== 'sourceBlobPathname'
    )
  ) as Omit<T, 'apiKeyLookup' | 'sourceBlobPathname'>;
}

function authError(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json(
      { success: false, error: 'Fabrika oturumu gerekli.' },
      { status: 401 }
    );
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json(
      { success: false, error: 'Bu işlem yalnızca şirket sahibine açıktır.' },
      { status: 403 }
    );
  }
  return null;
}

async function isZipArchive(file: File) {
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return (
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(signature[2] || -1) &&
    [0x04, 0x06, 0x08].includes(signature[3] || -1)
  );
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const integrations = await prisma.websiteIntegration.findMany({
      where: { companyAccountId: principal.account.id },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({
      success: true,
      integrations: integrations.map(safeIntegration),
    });
  } catch (error) {
    return (
      authError(error) ||
      NextResponse.json(
        { success: false, error: 'Site entegrasyonları yüklenemedi.' },
        { status: 500 }
      )
    );
  }
}

export async function POST(request: Request) {
  let uploadedPathname: string | null = null;

  try {
    const principal = await requireFabrikaOwner();
    const formData = await request.formData();
    const metadataValue = formData.get('metadata');
    const sourceValue = formData.get('source');
    if (typeof metadataValue !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Site bilgileri eksik.' },
        { status: 400 }
      );
    }

    let metadataJson: unknown;
    try {
      metadataJson = JSON.parse(metadataValue);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Site bilgileri okunamadı.' },
        { status: 400 }
      );
    }
    const parsed = websiteIntegrationMetadataSchema.safeParse(metadataJson);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Zorunlu site ve teknik iletişim bilgilerini kontrol edin.',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      );
    }
    if (!(sourceValue instanceof File) || sourceValue.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Web sitesi kaynak kodu ZIP dosyası gerekli.' },
        { status: 400 }
      );
    }
    if (sourceValue.size > MAX_SITE_SOURCE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kaynak kodu paketi en fazla 30 MB olabilir.',
        },
        { status: 413 }
      );
    }
    if (!(await isZipArchive(sourceValue))) {
      return NextResponse.json(
        { success: false, error: 'Yalnızca geçerli ZIP arşivi yüklenebilir.' },
        { status: 415 }
      );
    }

    const input = parsed.data;
    const websiteOrigin = normalizeWebsiteOrigin(input.websiteUrl);
    const existing = await prisma.websiteIntegration.findUnique({
      where: {
        companyAccountId_websiteOrigin: {
          companyAccountId: principal.account.id,
          websiteOrigin,
        },
      },
    });
    const sourceFileName = safeWebsiteArchiveName(sourceValue.name);
    const blob = await put(
      `website-integrations/${principal.account.id}/${randomUUID()}-${sourceFileName}`,
      sourceValue,
      {
        access: 'private',
        contentType: 'application/zip',
        addRandomSuffix: false,
        multipart: sourceValue.size > 5 * 1024 * 1024,
      }
    );
    uploadedPathname = blob.pathname;

    const apiKey = generateWebsiteApiKey();
    const promptTemplate = buildWebsiteIntegrationPrompt({
      companyName: principal.account.companyName,
      apiBaseUrl: apiBaseUrl(request),
    });
    const integration = await prisma.websiteIntegration.upsert({
      where: {
        companyAccountId_websiteOrigin: {
          companyAccountId: principal.account.id,
          websiteOrigin,
        },
      },
      create: {
        companyAccountId: principal.account.id,
        displayName: input.displayName,
        websiteUrl: input.websiteUrl,
        websiteOrigin,
        framework: input.framework,
        hostingProvider: input.hostingProvider,
        portfolioPath: input.portfolioPath,
        technicalContactEmail: input.technicalContactEmail,
        repositoryUrl: input.repositoryUrl || null,
        notes: input.notes || null,
        sourceBlobPathname: blob.pathname,
        sourceFileName,
        sourceSize: sourceValue.size,
        apiKeyLookup: createWebsiteApiKeyLookup(apiKey),
        apiKeyHint: websiteApiKeyHint(apiKey),
        promptTemplate,
      },
      update: {
        displayName: input.displayName,
        websiteUrl: input.websiteUrl,
        framework: input.framework,
        hostingProvider: input.hostingProvider,
        portfolioPath: input.portfolioPath,
        technicalContactEmail: input.technicalContactEmail,
        repositoryUrl: input.repositoryUrl || null,
        notes: input.notes || null,
        sourceBlobPathname: blob.pathname,
        sourceFileName,
        sourceSize: sourceValue.size,
        apiKeyLookup: createWebsiteApiKeyLookup(apiKey),
        apiKeyHint: websiteApiKeyHint(apiKey),
        apiKeyCreatedAt: new Date(),
        promptTemplate,
        status: 'PENDING',
        submittedAt: new Date(),
        deliveredAt: null,
      },
    });

    if (
      existing?.sourceBlobPathname &&
      existing.sourceBlobPathname !== blob.pathname
    ) {
      void del(existing.sourceBlobPathname).catch((error) => {
        console.error('[Old website archive cleanup failed]', error);
      });
    }
    await createCompanyNotification({
      companyAccountId: principal.account.id,
      type: NotificationType.WEBSITE_GENERATED,
      title: 'Web sitesi entegrasyon paketi gönderildi',
      message: `${input.displayName} kaynak kodu ve teknik bilgileri yönetici onayına ulaştı.`,
      link: '/fabrika/yazilimci',
      important: true,
      dedupeKey: `website-integration:${integration.id}:${integration.submittedAt.toISOString()}`,
      metadata: { integrationId: integration.id, websiteOrigin },
    });

    uploadedPathname = null;
    return NextResponse.json(
      {
        success: true,
        integration: safeIntegration(integration),
        oneTimeApiKey: apiKey,
        codexPrompt: buildWebsiteIntegrationPrompt({
          companyName: principal.account.companyName,
          apiBaseUrl: apiBaseUrl(request),
          apiKey,
        }),
        warning:
          'API anahtarı yalnızca bu yanıtta tam olarak gösterilir. Güvenli biçimde saklayın.',
      },
      { status: existing ? 200 : 201 }
    );
  } catch (error) {
    if (uploadedPathname) {
      await del(uploadedPathname).catch(() => undefined);
    }
    const response = authError(error);
    if (response) return response;
    console.error('[Website integration upload error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Site kaynak kodu ve entegrasyon bilgileri kaydedilemedi.',
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = rotateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz API anahtarı yenileme isteği.' },
        { status: 400 }
      );
    }
    const integration = await prisma.websiteIntegration.findFirst({
      where: {
        id: parsed.data.id,
        companyAccountId: principal.account.id,
      },
    });
    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Site entegrasyonu bulunamadı.' },
        { status: 404 }
      );
    }

    const apiKey = generateWebsiteApiKey();
    const updated = await prisma.websiteIntegration.update({
      where: { id: integration.id },
      data: {
        apiKeyLookup: createWebsiteApiKeyLookup(apiKey),
        apiKeyHint: websiteApiKeyHint(apiKey),
        apiKeyCreatedAt: new Date(),
      },
    });
    return NextResponse.json({
      success: true,
      integration: safeIntegration(updated),
      oneTimeApiKey: apiKey,
      codexPrompt: buildWebsiteIntegrationPrompt({
        companyName: principal.account.companyName,
        apiBaseUrl: apiBaseUrl(request),
        apiKey,
      }),
      warning: 'Eski site API anahtarı hemen geçersiz oldu.',
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('[Website integration rotate error]', error);
    return NextResponse.json(
      { success: false, error: 'Site API anahtarı yenilenemedi.' },
      { status: 500 }
    );
  }
}
