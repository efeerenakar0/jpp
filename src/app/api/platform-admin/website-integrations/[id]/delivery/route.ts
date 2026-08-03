import { randomUUID } from 'node:crypto';
import { del, put } from '@vercel/blob';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';
import {
  createWebsiteApiKeyLookup,
  createWebsiteDeliveryToken,
  createWebsiteDeliveryTokenHash,
  generateWebsiteApiKey,
  safeWebsiteArchiveName,
  sha256Hex,
  websiteApiKeyHint,
  websiteDeliveryTokenHint,
} from '@/lib/website-integration';
import {
  inspectWebsiteArchive,
  WebsiteArchiveSecurityError,
} from '@/lib/website-archive-security';
import {
  assertWebsiteDeliveryTransition,
  canAdminUploadWebsiteResult,
} from '@/lib/website-delivery-state';

export const dynamic = 'force-dynamic';

const jsonActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start_work') }),
  z.object({
    action: z.literal('qa'),
    result: z.enum(['PASSED', 'FAILED']),
    report: z.record(z.string(), z.unknown()).default({}),
  }),
  z.object({
    action: z.literal('deliver'),
    deliveryType: z.enum(['ZIP_ONLY', 'ADMIN_DEPLOYED', 'CUSTOMER_DEPLOYS']),
    finalUrl: z.string().trim().url().max(500).optional(),
  }),
  z.object({
    action: z.literal('create_delivery_token'),
    recipientEmail: z.string().trim().email().max(160).optional(),
    expiresInHours: z.number().int().min(1).max(168).default(24),
  }),
]);

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Platform yöneticisi oturumu gerekli.' },
    { status: 401 }
  );
}

function statusConflict(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 409 });
}

async function getCurrent(id: string) {
  return prisma.websiteIntegration.findUnique({
    where: { id },
    include: {
      companyAccount: { select: { id: true, companyName: true } },
      versions: { orderBy: { version: 'desc' }, take: 1 },
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await requirePlatformAdmin();
  if (!admin) return unauthorized();
  const { id } = await context.params;

  if (request.headers.get('content-type')?.includes('multipart/form-data')) {
    let uploadedPathname: string | null = null;
    try {
      const integration = await getCurrent(id);
      if (!integration || !integration.versions[0]) {
        return NextResponse.json(
          { success: false, error: 'Site entegrasyonu veya kaynak sürümü bulunamadı.' },
          { status: 404 }
        );
      }
      if (!canAdminUploadWebsiteResult(integration.status)) {
        return statusConflict('Bu durumda tamamlanmış paket yüklenemez. Önce işi başlatın.');
      }

      const form = await request.formData();
      const file = form.get('result');
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json(
          { success: false, error: 'Tamamlanmış ZIP dosyası gerekli.' },
          { status: 400 }
        );
      }
      if (file.size > 30 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: 'Tamamlanmış paket en fazla 30 MB olabilir.' },
          { status: 413 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const securityReport = inspectWebsiteArchive(buffer);
      const fileName = safeWebsiteArchiveName(file.name);
      const blob = await put(
        `website-deliveries/${integration.companyAccountId}/${randomUUID()}-${fileName}`,
        buffer,
        {
          access: 'private',
          contentType: 'application/zip',
          addRandomSuffix: false,
          multipart: file.size > 5 * 1024 * 1024,
        }
      );
      uploadedPathname = blob.pathname;

      let buildReport: Record<string, unknown> = {};
      const buildReportValue = form.get('buildReport');
      if (typeof buildReportValue === 'string' && buildReportValue.trim()) {
        const parsed = JSON.parse(buildReportValue) as unknown;
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
          throw new Error('Build raporu JSON nesnesi olmalıdır.');
        }
        buildReport = parsed as Record<string, unknown>;
      }
      const previewUrlValue = form.get('previewUrl');
      const previewUrl =
        typeof previewUrlValue === 'string' && previewUrlValue.trim()
          ? z.string().url().parse(previewUrlValue.trim())
          : null;

      const version = integration.versions[0];
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        const latest = await tx.websiteIntegration.findUnique({ where: { id } });
        if (!latest) throw new Error('Site entegrasyonu bulunamadı.');
        assertWebsiteDeliveryTransition(latest.status, 'READY_FOR_QA');
        await tx.websiteIntegrationVersion.update({
          where: { id: version.id },
          data: {
            resultBlobPathname: blob.pathname,
            resultFileName: fileName,
            resultSize: buffer.byteLength,
            resultSha256: sha256Hex(buffer),
            resultSecurityReport: securityReport,
            buildReport: buildReport as Prisma.InputJsonObject,
            previewUrl,
            qaStatus: 'PENDING',
            qaReport: undefined,
            resultUploadedByAdminId: admin.username,
            resultUploadedAt: now,
            lastError: null,
          },
        });
        await tx.websiteIntegration.update({
          where: { id },
          data: { status: 'READY_FOR_QA', previewUrl, lastError: null },
        });
        await tx.managerAuditLog.create({
          data: {
            companyAccountId: integration.companyAccountId,
            actorType: 'PLATFORM_ADMIN',
            actorId: admin.username,
            operation: 'WEBSITE_RESULT_UPLOADED',
            entityType: 'WebsiteIntegrationVersion',
            entityId: version.id,
            evidence: { resultSha256: sha256Hex(buffer), fileCount: securityReport.fileCount },
            result: 'SUCCESS',
            completedAt: now,
          },
        });
      });
      uploadedPathname = null;
      return NextResponse.json({ success: true, status: 'READY_FOR_QA' });
    } catch (error) {
      if (uploadedPathname) await del(uploadedPathname).catch(() => undefined);
      if (error instanceof WebsiteArchiveSecurityError) {
        return NextResponse.json(
          { success: false, error: error.message, code: error.code },
          { status: error.code === 'INVALID_ARCHIVE' ? 415 : 400 }
        );
      }
      console.error('[Website result upload failed]', error instanceof Error ? error.message : 'unknown');
      return NextResponse.json(
        { success: false, error: 'Tamamlanmış site paketi kaydedilemedi.' },
        { status: 500 }
      );
    }
  }

  try {
    const parsed = jsonActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Geçersiz site teslim işlemi.' },
        { status: 400 }
      );
    }
    const integration = await getCurrent(id);
    if (!integration || !integration.versions[0]) {
      return NextResponse.json(
        { success: false, error: 'Site entegrasyonu bulunamadı.' },
        { status: 404 }
      );
    }
    const version = integration.versions[0];
    const now = new Date();

    if (parsed.data.action === 'start_work') {
      assertWebsiteDeliveryTransition(integration.status, 'IN_PROGRESS');
      await prisma.websiteIntegration.update({ where: { id }, data: { status: 'IN_PROGRESS' } });
      return NextResponse.json({ success: true, status: 'IN_PROGRESS', workOrder: version.workOrder });
    }

    if (parsed.data.action === 'qa') {
      const qaInput = parsed.data;
      const targetStatus = qaInput.result === 'PASSED' ? 'APPROVED' : 'CHANGES_REQUESTED';
      assertWebsiteDeliveryTransition(integration.status, targetStatus);
      if (!version.resultBlobPathname || !version.resultSha256) {
        return statusConflict('QA için tamamlanmış paket yüklenmiş olmalıdır.');
      }
      await prisma.$transaction(async (tx) => {
        await tx.websiteIntegrationVersion.update({
          where: { id: version.id },
          data: {
            qaStatus: qaInput.result,
            qaReport: qaInput.report as Prisma.InputJsonObject,
            approvedAt: qaInput.result === 'PASSED' ? now : null,
            approvedByAdminId: qaInput.result === 'PASSED' ? admin.username : null,
            lastError:
              qaInput.result === 'FAILED'
                ? JSON.stringify(qaInput.report).slice(0, 5_000)
                : null,
          },
        });
        await tx.websiteIntegration.update({
          where: { id },
          data: {
            status: targetStatus,
            approvedAt: qaInput.result === 'PASSED' ? now : null,
            approvedByAdminId: qaInput.result === 'PASSED' ? admin.username : null,
            lastError:
              qaInput.result === 'FAILED'
                ? JSON.stringify(qaInput.report).slice(0, 5_000)
                : null,
          },
        });
      });
      return NextResponse.json({ success: true, status: targetStatus });
    }

    if (parsed.data.action === 'deliver') {
      const deliveryInput = parsed.data;
      assertWebsiteDeliveryTransition(integration.status, 'DELIVERED');
      if (version.qaStatus !== 'PASSED' || !version.resultBlobPathname) {
        return statusConflict('Teslim için QA onayı ve tamamlanmış paket gereklidir.');
      }
      if (deliveryInput.deliveryType === 'ADMIN_DEPLOYED' && !deliveryInput.finalUrl) {
        return NextResponse.json(
          { success: false, error: 'Admin deploy tesliminde final URL zorunludur.' },
          { status: 400 }
        );
      }
      const productionKey = generateWebsiteApiKey();
      const finalOrigin = deliveryInput.finalUrl ? new URL(deliveryInput.finalUrl).origin.toLowerCase() : null;
      await prisma.$transaction(async (tx) => {
        await tx.websiteIntegrationApiKey.updateMany({
          where: { websiteIntegrationId: id, environment: 'PRODUCTION', status: 'ACTIVE' },
          data: { status: 'REVOKED', revokedAt: now },
        });
        await tx.websiteIntegrationApiKey.create({
          data: {
            companyAccountId: integration.companyAccountId,
            websiteIntegrationId: id,
            environment: 'PRODUCTION',
            keyLookup: createWebsiteApiKeyLookup(productionKey),
            keyHint: websiteApiKeyHint(productionKey),
            createdByType: 'PLATFORM_ADMIN',
            createdById: admin.username,
          },
        });
        await tx.websiteIntegrationVersion.update({
          where: { id: version.id },
          data: {
            deliveryType: deliveryInput.deliveryType,
            finalUrl: deliveryInput.finalUrl || null,
            deliveredAt: now,
          },
        });
        await tx.websiteIntegration.update({
          where: { id },
          data: {
            status: 'DELIVERED',
            deliveryType: deliveryInput.deliveryType,
            finalUrl: deliveryInput.finalUrl || null,
            websiteOrigin: finalOrigin || integration.websiteOrigin,
            deliveredAt: now,
            apiKeyLookup: createWebsiteApiKeyLookup(productionKey),
            apiKeyHint: websiteApiKeyHint(productionKey),
            apiKeyCreatedAt: now,
          },
        });
      });
      return NextResponse.json({
        success: true,
        status: 'DELIVERED',
        oneTimeProductionApiKey: productionKey,
        warning: 'Production anahtarı yalnız bu yanıtta gösterilir.',
      });
    }

    if (integration.status !== 'APPROVED' && integration.status !== 'DELIVERED') {
      return statusConflict('Teslim bağlantısı yalnız QA onayından sonra oluşturulabilir.');
    }
    if (!version.resultBlobPathname) {
      return statusConflict('Tamamlanmış paket bulunamadı.');
    }
    const tokenInput = parsed.data;
    const token = createWebsiteDeliveryToken();
    const expiresAt = new Date(now.getTime() + tokenInput.expiresInHours * 60 * 60 * 1000);
    await prisma.websiteDeliveryToken.create({
      data: {
        companyAccountId: integration.companyAccountId,
        websiteIntegrationId: id,
        versionId: version.id,
        tokenHash: createWebsiteDeliveryTokenHash(token),
        tokenHint: websiteDeliveryTokenHint(token),
        recipientEmail: tokenInput.recipientEmail || null,
        expiresAt,
        createdByAdminId: admin.username,
      },
    });
    return NextResponse.json({ success: true, oneTimeDeliveryToken: token, expiresAt });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Geçersiz site teslim')) {
      return statusConflict(error.message);
    }
    console.error('[Website delivery action failed]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Site teslim işlemi tamamlanamadı.' },
      { status: 500 }
    );
  }
}
