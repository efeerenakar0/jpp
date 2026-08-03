import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
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

export const dynamic = "force-dynamic";

const rotateSchema = z.object({
  action: z.literal("rotate_key"),
  id: z.string().trim().min(1),
});

const updatePromptSchema = z.object({
  action: z.literal("update_prompt"),
  id: z.string().trim().min(1),
  promptTemplate: z.string().trim().min(120).max(50_000),
});

const patchSchema = z.discriminatedUnion("action", [
  rotateSchema,
  updatePromptSchema,
]);

function apiBaseUrl(request: Request) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") ||
    new URL(request.url).origin
  );
}

function safeVersion(version: Record<string, unknown>) {
  const safe = { ...version };
  delete safe.sourceBlobPathname;
  delete safe.resultBlobPathname;
  return safe;
}

function safeIntegration<T extends { apiKeyLookup: string; sourceBlobPathname: string; versions?: Array<Record<string, unknown>> }>(integration: T) {
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
        apiKeys: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            environment: true,
            status: true,
            keyHint: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        promptVersions: {
          orderBy: { version: "desc" },
          take: 10,
          select: {
            id: true,
            version: true,
            promptTemplate: true,
            source: true,
            createdByType: true,
            createdAt: true,
          },
        },
      },
    });
    return NextResponse.json({
      success: true,
      integrations: integrations.map(safeIntegration),
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
        integration: safeIntegration(integration),
        oneTimeApiKey: apiKey,
        stagingKeyExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        workOrder,
        codexPrompt: buildWebsiteIntegrationPrompt({
          companyName: principal.account.companyName,
          apiBaseUrl: apiBaseUrl(request),
          apiKey,
        }),
        warning:
          "API anahtarı yalnızca bu yanıtta tam olarak gösterilir. Güvenli biçimde saklayın.",
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

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Geçersiz site entegrasyonu isteği." },
        { status: 400 },
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
        { success: false, error: "Site entegrasyonu bulunamadı." },
        { status: 404 },
      );
    }

    if (parsed.data.action === "update_prompt") {
      const promptTemplate = parsed.data.promptTemplate;
      const updated = await prisma.$transaction(async (tx) => {
        const latest = await tx.websitePromptVersion.aggregate({
          where: { websiteIntegrationId: integration.id },
          _max: { version: true },
        });
        const saved = await tx.websiteIntegration.update({
          where: { id: integration.id },
          data: { promptTemplate },
        });
        const version = await tx.websitePromptVersion.create({
          data: {
            companyAccountId: principal.account.id,
            websiteIntegrationId: integration.id,
            version: (latest._max.version || 0) + 1,
            promptTemplate,
            source: "OWNER_EDIT",
            createdByType: principal.type,
            createdById: principal.account.id,
          },
          select: { id: true, version: true, createdAt: true },
        });
        await tx.managerAuditLog.create({
          data: {
            companyAccountId: principal.account.id,
            actorType: principal.type,
            actorId: principal.account.id,
            operation: "WEBSITE_PROMPT_UPDATED",
            entityType: "WebsiteIntegration",
            entityId: integration.id,
            evidence: { version: version.version },
            result: "SUCCESS",
            completedAt: new Date(),
          },
        });
        return { saved, version };
      });
      return NextResponse.json({
        success: true,
        integration: safeIntegration(updated.saved),
        promptVersion: updated.version,
      });
    }

    if (integration.status !== "APPROVED" && integration.status !== "DELIVERED") {
      return NextResponse.json(
        {
          success: false,
          error: "Production anahtarı yalnız QA onayından sonra oluşturulabilir.",
        },
        { status: 409 },
      );
    }

    const apiKey = generateWebsiteApiKey();
    const updated = await prisma.$transaction(async (tx) => {
      await tx.websiteIntegrationApiKey.updateMany({
        where: {
          websiteIntegrationId: integration.id,
          environment: "PRODUCTION",
          status: "ACTIVE",
        },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      const saved = await tx.websiteIntegration.update({
        where: { id: integration.id },
        data: {
          apiKeyLookup: createWebsiteApiKeyLookup(apiKey),
          apiKeyHint: websiteApiKeyHint(apiKey),
          apiKeyCreatedAt: new Date(),
        },
      });
      await tx.websiteIntegrationApiKey.create({
        data: {
          companyAccountId: principal.account.id,
          websiteIntegrationId: integration.id,
          environment: "PRODUCTION",
          status: "ACTIVE",
          keyLookup: createWebsiteApiKeyLookup(apiKey),
          keyHint: websiteApiKeyHint(apiKey),
          createdByType: principal.type,
          createdById: principal.account.id,
        },
      });
      await tx.managerAuditLog.create({
        data: {
          companyAccountId: principal.account.id,
          actorType: principal.type,
          actorId: principal.account.id,
          operation: "WEBSITE_API_KEY_ROTATED",
          entityType: "WebsiteIntegration",
          entityId: integration.id,
          result: "SUCCESS",
          completedAt: new Date(),
        },
      });
      return saved;
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
      warning: "Eski site API anahtarı hemen geçersiz oldu.",
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error("[Website integration rotate error]", error);
    return NextResponse.json(
      { success: false, error: "Site API anahtarı yenilenemedi." },
      { status: 500 },
    );
  }
}
