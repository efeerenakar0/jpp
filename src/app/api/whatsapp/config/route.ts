import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  testMetaWhatsAppConnection,
} from '@/lib/whatsapp';
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from '@/lib/whatsapp-crypto';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';

const configSchema = z.object({
  action: z.enum(['save', 'test']).optional(),
  token: z.string().trim().max(4096).optional(),
  phoneNumberId: z.string().trim().max(128).optional(),
  businessAccountId: z.string().trim().max(128).optional(),
  verifyToken: z.string().trim().max(256).optional(),
  geminiApiKey: z.string().trim().max(4096).optional(),
  companyName: z.string().trim().max(160).optional(),
  assistantName: z.string().trim().max(80).optional(),
  serviceCity: z.string().trim().max(120).optional(),
  companyAddress: z.string().trim().max(2000).optional(),
  companyDetails: z.string().trim().max(5000).optional(),
  websiteUrl: z.string().trim().max(1000).optional(),
  instagramUrl: z.string().trim().max(1000).optional(),
  languages: z.string().trim().max(500).optional(),
  fallbackTemplateName: z.string().trim().max(160).optional(),
  templateLanguage: z.string().trim().max(20).optional(),
});

function optional(value: string | undefined) {
  return value || undefined;
}

function authError(error: unknown) {
  if (
    error instanceof FabrikaForbiddenError ||
    error instanceof FabrikaSessionError
  ) {
    return NextResponse.json(
      { error: error.message },
      { status: error instanceof FabrikaForbiddenError ? 403 : 401 }
    );
  }
  return null;
}

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const config = await prisma.whatsAppConfig.findUnique({
      where: { companyAccountId: principal.account.id },
    });
    return NextResponse.json({
      configured: Boolean(config?.token && config.phoneNumberId),
      tokenMasked: maskSecret(config?.token),
      aiKeyMasked: maskSecret(config?.geminiApiKey),
      phoneNumberId: config?.phoneNumberId || '',
      businessAccountId: config?.businessAccountId || '',
      companyName: config?.companyName || principal.account.companyName,
      assistantName: config?.assistantName || 'Efe',
      serviceCity: config?.serviceCity || 'Alanya',
      companyAddress: config?.companyAddress || '',
      companyDetails: config?.companyDetails || '',
      websiteUrl: config?.websiteUrl || '',
      instagramUrl: config?.instagramUrl || '',
      languages: config?.languages || 'Türkçe',
      fallbackTemplateName: config?.fallbackTemplateName || '',
      templateLanguage: config?.templateLanguage || 'tr',
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('[WhatsApp Config GET Error]:', error);
    return NextResponse.json(
      { error: 'WhatsApp ayarları okunamadı.' },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const parsed = configSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Ayar alanlarından biri geçersiz.' },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const saved = await prisma.whatsAppConfig.findUnique({
      where: { companyAccountId: principal.account.id },
    });

    if (body.action === 'test') {
      let token = optional(body.token);
      let phoneNumberId = optional(body.phoneNumberId);
      if (!token && saved?.token) token = decryptSecret(saved.token);
      if (!phoneNumberId) phoneNumberId = saved?.phoneNumberId || undefined;
      if (!token || !phoneNumberId) {
        return NextResponse.json(
          { error: 'Meta Access Token ve Phone Number ID gerekli.' },
          { status: 400 }
        );
      }
      const connected = await testMetaWhatsAppConnection({
        token,
        phoneNumberId,
      });
      return connected
        ? NextResponse.json({
            success: true,
            message: 'Meta WhatsApp kimlik bilgileri doğrulandı.',
          })
        : NextResponse.json(
            { error: 'Meta API kimlik bilgileri doğrulanamadı.' },
            { status: 502 }
          );
    }

    const token = optional(body.token);
    const geminiApiKey = optional(body.geminiApiKey);
    await prisma.whatsAppConfig.upsert({
      where: { companyAccountId: principal.account.id },
      update: {
        ...(token && body.phoneNumberId ? { provider: 'META' } : {}),
        ...(token ? { token: encryptSecret(token) } : {}),
        ...(geminiApiKey
          ? { geminiApiKey: encryptSecret(geminiApiKey) }
          : {}),
        phoneNumberId: optional(body.phoneNumberId),
        businessAccountId: optional(body.businessAccountId),
        verifyToken: optional(body.verifyToken),
        companyName: optional(body.companyName),
        assistantName: optional(body.assistantName),
        serviceCity: optional(body.serviceCity),
        companyAddress: optional(body.companyAddress),
        companyDetails: optional(body.companyDetails),
        websiteUrl: optional(body.websiteUrl),
        instagramUrl: optional(body.instagramUrl),
        languages: optional(body.languages),
        fallbackTemplateName: optional(body.fallbackTemplateName),
        templateLanguage: optional(body.templateLanguage),
      },
      create: {
        companyAccountId: principal.account.id,
        provider: 'META',
        token: token ? encryptSecret(token) : null,
        geminiApiKey: geminiApiKey ? encryptSecret(geminiApiKey) : null,
        phoneNumberId: optional(body.phoneNumberId),
        businessAccountId: optional(body.businessAccountId),
        verifyToken:
          optional(body.verifyToken) ||
          process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
          'configure-in-environment',
        companyName: optional(body.companyName) || principal.account.companyName,
        assistantName: optional(body.assistantName) || 'Efe',
        serviceCity: optional(body.serviceCity) || 'Alanya',
        companyAddress: optional(body.companyAddress),
        companyDetails: optional(body.companyDetails),
        websiteUrl: optional(body.websiteUrl),
        instagramUrl: optional(body.instagramUrl),
        languages: optional(body.languages) || 'Türkçe',
        fallbackTemplateName: optional(body.fallbackTemplateName),
        templateLanguage: optional(body.templateLanguage) || 'tr',
      },
    });
    return NextResponse.json({
      success: true,
      message: 'Ayarlar şirkete özel ve şifreli biçimde kaydedildi.',
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;
    console.error('[WhatsApp Config POST Error]:', error);
    return NextResponse.json(
      { error: 'Ayarlar kaydedilemedi.' },
      { status: 503 }
    );
  }
}
