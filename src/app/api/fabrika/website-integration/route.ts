import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from "@/lib/fabrika-session";
import { createCompanyNotification } from "@/lib/fabrika-notifications";
import {
  buildWebsiteCodexWorkOrder,
  buildWebsiteIntegrationPrompt,
  createWebsiteApiKeyLookup,
  generateWebsiteApiKey,
  MAX_SITE_SOURCE_BYTES,
  normalizeWebsiteOrigin,
  safeWebsiteArchiveName,
  sha256Hex,
  websiteApiKeyHint,
  websiteIntegrationMetadataSchema,
} from "@/lib/website-integration";
import {
  inspectWebsiteArchive,
  WebsiteArchiveSecurityError,
} from "@/lib/website-archive-security";
import { toCustomerWebsiteIntegration } from "@/lib/website-integration-customer";

export const dynamic = "force-dynamic";

function apiBaseUrl(request: Request) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    new URL(request.url).origin
  );
}

function authError(error: unknown) {
  if (error instanceof FabrikaSessionError) {
    return NextResponse.json(
      { success: false, error: "Fabrika oturumu gerekli." },
      { status: 401 },
    );
  }
  if (error instanceof FabrikaForbiddenError) {
    return NextResponse.json(
      { success: false, error: "Bu işlem yalnızca şirket sahibine açıktır." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const integrations = await prisma.websiteIntegration.findMany({
      where: { companyAccountId: principal.account.id },
      orderBy: { updatedAt: "desc" },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 10,
        },
      },
    });
    return NextResponse.json({
      success: true,
      integrations: integrations.map(toCustomerWebsiteIntegration),
    });
  } catch (error) {
    return (
      authError(error) ||
      NextResponse.json(
        { success: false, error: "Site entegrasyonları yüklenemedi." },
        { status: 500 },
      )
    );
  }
}

export async function POST(request: Request) {
  let uploadedPathname: string | null = null;

  try {
    const principal = await requireFabrikaOwner();
    const formData = await request.formData();
    const metadataValue = formData.get("metadata");
    const sourceValue = formData.get("source");
    if (typeof metadataValue !== "string") {
      return NextResponse.json(
        { success: false, error: "Site bilgileri eksik." },
        { status: 400 },
      );
    }

    let metadataJson: unknown;
    try {
      metadataJson = JSON.parse(metadataValue);
    } catch {
      return NextResponse.json(
        { success: false, error: "Site bilgileri okunamadı." },
        { status: 400 },
      );
    }
    const parsed = websiteIntegrationMetadataSchema.safeParse(metadataJson);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Zorunlu site ve teknik iletişim bilgilerini kontrol edin.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    if (!(sourceValue instanceof File) || sourceValue.size === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Web sitesi kaynak kodu ZIP dosyası gerekli.",
        },
        { status: 400 },
      );
    }
    if (sourceValue.size > MAX_SITE_SOURCE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: "Kaynak kodu paketi en fazla 30 MB olabilir.",
        },
        { status: 413 },
      );
    }
    const sourceBuffer = Buffer.from(await sourceValue.arrayBuffer());
    let sourceSecurityReport: ReturnType<typeof inspectWebsiteArchive>;
    try {
      sourceSecurityReport = inspectWebsiteArchive(sourceBuffer);
    } catch (error) {
      if (error instanceof WebsiteArchiveSecurityError) {
        return NextResponse.json(
          { success: false, error: error.message, code: error.code },
          { status: error.code === "INVALID_ARCHIVE" ? 415 : 400 },
        );
      }
      throw error;
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
      sourceBuffer,
      {
        access: "private",
        contentType: "application/zip",
        addRandomSuffix: false,
        multipart: sourceValue.size > 5 * 1024 * 1024,
      },
    );
    uploadedPathname = blob.pathname;

    const apiKey = generateWebsiteApiKey();
    const integrationId = existing?.id || randomUUID();
    const sourceVersion = existing ? existing.currentSourceVersion + 1 : 1;
    const promptTemplate = buildWebsiteIntegrationPrompt({
      companyName: principal.account.companyName,
      apiBaseUrl: apiBaseUrl(request),
    });
    const workOrder = buildWebsiteCodexWorkOrder({
      integrationId,
      version: sourceVersion,
      companyName: principal.account.companyName,
      displayName: input.displayName,
      framework: input.framework,
      hostingProvider: input.hostingProvider,
      websiteUrl: input.websiteUrl,
      portfolioPath: input.portfolioPath,
      sourceDownloadUrl: `${apiBaseUrl(request)}/api/platform-admin/website-integrations/${integrationId}/download?version=${sourceVersion}`,
      apiBaseUrl: apiBaseUrl(request),
    });
    const integration = await prisma.$transaction(async (tx) => {
      const saved = await tx.websiteIntegration.upsert({
        where: {
          companyAccountId_websiteOrigin: {
            companyAccountId: principal.account.id,
            websiteOrigin,
          },
        },
        create: {
          id: integrationId,
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
          status: "SUBMITTED",
          currentSourceVersion: sourceVersion,
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
          status: "SUBMITTED",
          currentSourceVersion: sourceVersion,
          deliveryType: null,
          previewUrl: null,
          finalUrl: null,
          approvedAt: null,
          approvedByAdminId: null,
          lastError: null,
          submittedAt: new Date(),
          deliveredAt: null,
        },
      });
      await tx.websiteIntegrationApiKey.updateMany({
        where: {
          websiteIntegrationId: saved.id,
          environment: "STAGING",
          status: "ACTIVE",
        },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      await tx.websiteIntegrationApiKey.create({
        data: {
          companyAccountId: principal.account.id,
          websiteIntegrationId: saved.id,
          environment: "STAGING",
          status: "ACTIVE",
          keyLookup: createWebsiteApiKeyLookup(apiKey),
          keyHint: websiteApiKeyHint(apiKey),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdByType: principal.type,
          createdById: principal.account.id,
        },
      });
      await tx.websiteIntegrationVersion.create({
        data: {
          companyAccountId: principal.account.id,
          websiteIntegrationId: saved.id,
          version: sourceVersion,
          sourceBlobPathname: blob.pathname,
          sourceFileName,
          sourceSize: sourceBuffer.byteLength,
          sourceSha256: sha256Hex(sourceBuffer),
          sourceSecurityReport,
          workOrderVersion: 1,
          workOrder,
          submittedByType: principal.type,
          submittedById: principal.account.id,
        },
      });
      const latest = await tx.websitePromptVersion.aggregate({
        where: { websiteIntegrationId: saved.id },
        _max: { version: true },
      });
      await tx.websitePromptVersion.create({
        data: {
          companyAccountId: principal.account.id,
          websiteIntegrationId: saved.id,
          version: (latest._max.version || 0) + 1,
          promptTemplate,
          source: existing ? "SOURCE_REUPLOAD" : "INTEGRATION_CREATED",
          createdByType: principal.type,
          createdById: principal.account.id,
          sourceSnapshot: {
            websiteOrigin,
            framework: input.framework,
            hostingProvider: input.hostingProvider,
            portfolioPath: input.portfolioPath,
            sourceFileName,
          },
        },
      });
      await tx.managerAuditLog.create({
        data: {
          companyAccountId: principal.account.id,
          actorType: principal.type,
          actorId: principal.account.id,
          operation: existing
            ? "WEBSITE_INTEGRATION_RESUBMITTED"
            : "WEBSITE_INTEGRATION_CREATED",
          entityType: "WebsiteIntegration",
          entityId: saved.id,
          verifiedContext: { websiteOrigin },
          result: "SUCCESS",
          completedAt: new Date(),
        },
      });
      return saved;
    });

    await createCompanyNotification({
      companyAccountId: principal.account.id,
      type: NotificationType.WEBSITE_GENERATED,
      title: "Web sitesi entegrasyon paketi gönderildi",
      message: `${input.displayName} kaynak kodu ve teknik bilgileri yönetici onayına ulaştı.`,
      link: "/fabrika/yazilimci",
      important: true,
      dedupeKey: `website-integration:${integration.id}:${integration.submittedAt.toISOString()}`,
      metadata: { integrationId: integration.id, websiteOrigin },
    });

    uploadedPathname = null;
    return NextResponse.json(
      {
        success: true,
        integration: toCustomerWebsiteIntegration(integration),
        message:
          "Site paketi platform yöneticisinin güvenli iş emri ve kalite kontrol kuyruğuna alındı.",
      },
      { status: existing ? 200 : 201 },
    );
  } catch (error) {
    if (uploadedPathname) {
      await del(uploadedPathname).catch(() => undefined);
    }
    const response = authError(error);
    if (response) return response;
    console.error("[Website integration upload error]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Site kaynak kodu ve entegrasyon bilgileri kaydedilemedi.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH() {
  try {
    await requireFabrikaOwner();
    return NextResponse.json(
      {
        success: false,
        error:
          "Site iş emri ve bağlantı anahtarları yalnız platform yöneticisi tarafından yönetilir.",
      },
      { status: 405, headers: { Allow: "GET, POST" } },
    );
  } catch (error) {
    return (
      authError(error) ||
      NextResponse.json(
        { success: false, error: "İstek tamamlanamadı." },
        { status: 500 },
      )
    );
  }
}
