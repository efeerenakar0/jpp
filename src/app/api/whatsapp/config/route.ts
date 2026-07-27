import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  testMetaWhatsAppConnection,
  updateCredentialsCache,
} from '@/lib/whatsapp';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';

type ConfigInput = {
  action?: string;
  token?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  verifyToken?: string;
  geminiApiKey?: string;
  companyName?: string;
  assistantName?: string;
  serviceCity?: string;
  companyAddress?: string;
  companyDetails?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  languages?: string;
  fallbackTemplateName?: string;
  templateLanguage?: string;
};

function cleanOptional(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const cleaned = value.trim();
  return cleaned || undefined;
}

function maskSecret(value?: string | null): string {
  if (!value) {
    return '';
  }

  return value.length > 12
    ? `${value.slice(0, 6)}…${value.slice(-4)}`
    : '••••••••';
}

export async function GET() {
  try {
    await requireFabrikaOwner();
    const config = await prisma.whatsAppConfig.findUnique({
      where: { id: 'default' },
    });

    const token = config?.token || process.env.WHATSAPP_TOKEN || '';
    const geminiApiKey = config?.geminiApiKey || process.env.GEMINI_API_KEY || '';

    return NextResponse.json({
      configured: Boolean(
        token &&
        (config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID)
      ),
      tokenMasked: maskSecret(token),
      aiKeyMasked: maskSecret(geminiApiKey),
      phoneNumberId:
        config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId:
        config?.businessAccountId ||
        process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
        '',
      companyName: config?.companyName || 'Jasmine Group',
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
    if (
      error instanceof FabrikaForbiddenError ||
      error instanceof FabrikaSessionError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof FabrikaForbiddenError ? 403 : 401 }
      );
    }
    console.error('[WhatsApp Config GET Error]:', error);
    return NextResponse.json(
      { error: 'WhatsApp ayarları veritabanından okunamadı.' },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireFabrikaOwner();
  } catch (error) {
    if (
      error instanceof FabrikaForbiddenError ||
      error instanceof FabrikaSessionError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error instanceof FabrikaForbiddenError ? 403 : 401 }
      );
    }
    throw error;
  }

  let body: ConfigInput;

  try {
    body = (await request.json()) as ConfigInput;
  } catch {
    return NextResponse.json(
      { error: 'Geçersiz ayar isteği.' },
      { status: 400 }
    );
  }

  const token = cleanOptional(body.token);
  const phoneNumberId = cleanOptional(body.phoneNumberId);
  const businessAccountId = cleanOptional(body.businessAccountId);

  if (body.action === 'test') {
    let activeToken = token;
    let activePhoneNumberId = phoneNumberId;

    if (!activeToken || !activePhoneNumberId) {
      const saved = await prisma.whatsAppConfig.findUnique({
        where: { id: 'default' },
      });
      activeToken = activeToken || saved?.token || process.env.WHATSAPP_TOKEN;
      activePhoneNumberId =
        activePhoneNumberId ||
        saved?.phoneNumberId ||
        process.env.WHATSAPP_PHONE_NUMBER_ID;
    }

    if (!activeToken || !activePhoneNumberId) {
      return NextResponse.json(
        { error: 'Meta Access Token veya Phone Number ID yapılandırılmamış.' },
        { status: 400 }
      );
    }

    const connected = await testMetaWhatsAppConnection({
      token: activeToken,
      phoneNumberId: activePhoneNumberId,
    });

    return connected
      ? NextResponse.json({
          success: true,
          message: 'Meta WhatsApp Cloud API kimlik bilgileri doğrulandı.',
        })
      : NextResponse.json(
          { error: 'Meta API kimlik bilgileri doğrulanamadı.' },
          { status: 502 }
        );
  }

  try {
    const config = await prisma.whatsAppConfig.upsert({
      where: { id: 'default' },
      update: {
        token,
        phoneNumberId,
        businessAccountId,
        verifyToken: cleanOptional(body.verifyToken),
        geminiApiKey: cleanOptional(body.geminiApiKey),
        companyName: cleanOptional(body.companyName),
        assistantName: cleanOptional(body.assistantName),
        serviceCity: cleanOptional(body.serviceCity),
        companyAddress: cleanOptional(body.companyAddress),
        companyDetails: cleanOptional(body.companyDetails),
        websiteUrl: cleanOptional(body.websiteUrl),
        instagramUrl: cleanOptional(body.instagramUrl),
        languages: cleanOptional(body.languages),
        fallbackTemplateName: cleanOptional(body.fallbackTemplateName),
        templateLanguage: cleanOptional(body.templateLanguage),
      },
      create: {
        id: 'default',
        token,
        phoneNumberId,
        businessAccountId,
        verifyToken:
          cleanOptional(body.verifyToken) ||
          process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ||
          'configure-in-environment',
        geminiApiKey: cleanOptional(body.geminiApiKey),
        companyName: cleanOptional(body.companyName) || 'Jasmine Group',
        assistantName: cleanOptional(body.assistantName) || 'Efe',
        serviceCity: cleanOptional(body.serviceCity) || 'Alanya',
        companyAddress: cleanOptional(body.companyAddress),
        companyDetails: cleanOptional(body.companyDetails),
        websiteUrl: cleanOptional(body.websiteUrl),
        instagramUrl: cleanOptional(body.instagramUrl),
        languages: cleanOptional(body.languages) || 'Türkçe',
        fallbackTemplateName: cleanOptional(body.fallbackTemplateName),
        templateLanguage: cleanOptional(body.templateLanguage) || 'tr',
      },
    });

    if (config.token && config.phoneNumberId) {
      updateCredentialsCache({
        token: config.token,
        phoneNumberId: config.phoneNumberId,
        businessAccountId: config.businessAccountId || '',
        geminiApiKey: config.geminiApiKey || undefined,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Ayarlar güvenli biçimde kaydedildi.',
    });
  } catch (error) {
    console.error('[WhatsApp Config POST Error]:', error);
    return NextResponse.json(
      { error: 'Ayarlar veritabanına kaydedilemedi.' },
      { status: 503 }
    );
  }
}
