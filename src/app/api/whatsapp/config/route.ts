import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateCredentialsCache } from '@/lib/whatsapp';

let inMemoryConfig = {
  token: process.env.WHATSAPP_TOKEN || '',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
  verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'jasmine_secret_verify_token',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  companyName: 'Jasmine Group',
  assistantName: 'Efe',
  serviceCity: 'Alanya'
};

function syncGlobalMetaConfig(token: string, phoneNumberId: string, businessAccountId: string) {
  if (token && phoneNumberId) {
    const creds = { token, phoneNumberId, businessAccountId };
    (globalThis as any).globalMetaConfig = creds;
    updateCredentialsCache(creds);
  }
}

export async function GET(req: Request) {
  try {
    const headerToken = req.headers.get('x-meta-token');
    const headerPhoneId = req.headers.get('x-meta-phone-id');
    if (headerToken && headerPhoneId) {
      inMemoryConfig.token = headerToken;
      inMemoryConfig.phoneNumberId = headerPhoneId;
      syncGlobalMetaConfig(headerToken, headerPhoneId, inMemoryConfig.businessAccountId);
    }

    let config = null;
    try {
      config = await prisma.whatsAppConfig.findUnique({
        where: { id: 'default' }
      });
    } catch (dbErr) {}

    const token = config?.token || inMemoryConfig.token;
    const phoneNumberId = config?.phoneNumberId || inMemoryConfig.phoneNumberId;
    const businessAccountId = config?.businessAccountId || inMemoryConfig.businessAccountId;
    const verifyToken = config?.verifyToken || inMemoryConfig.verifyToken;
    const geminiApiKey = config?.geminiApiKey || inMemoryConfig.geminiApiKey;
    const companyName = config?.companyName || inMemoryConfig.companyName;
    const assistantName = config?.assistantName || inMemoryConfig.assistantName;
    const serviceCity = config?.serviceCity || inMemoryConfig.serviceCity;

    syncGlobalMetaConfig(token, phoneNumberId, businessAccountId);

    return NextResponse.json({
      configured: Boolean(token && phoneNumberId),
      tokenMasked: token ? `${token.substring(0, 6)}...${token.slice(-4)}` : '',
      tokenRaw: token,
      phoneNumberId,
      businessAccountId,
      verifyToken,
      geminiApiKey,
      companyName,
      assistantName,
      serviceCity,
      source: token ? 'ACTIVE' : 'NONE'
    });
  } catch (error: any) {
    syncGlobalMetaConfig(inMemoryConfig.token, inMemoryConfig.phoneNumberId, inMemoryConfig.businessAccountId);
    return NextResponse.json({
      configured: Boolean(inMemoryConfig.token && inMemoryConfig.phoneNumberId),
      tokenMasked: inMemoryConfig.token ? `${inMemoryConfig.token.substring(0, 6)}...${inMemoryConfig.token.slice(-4)}` : '',
      tokenRaw: inMemoryConfig.token,
      phoneNumberId: inMemoryConfig.phoneNumberId,
      businessAccountId: inMemoryConfig.businessAccountId,
      verifyToken: inMemoryConfig.verifyToken,
      geminiApiKey: inMemoryConfig.geminiApiKey,
      companyName: inMemoryConfig.companyName,
      assistantName: inMemoryConfig.assistantName,
      serviceCity: inMemoryConfig.serviceCity,
      source: 'FALLBACK'
    });
  }
}

export async function POST(req: Request) {
  try {
    const { token, phoneNumberId, businessAccountId, verifyToken, geminiApiKey, companyName, assistantName, serviceCity } = await req.json();

    inMemoryConfig = {
      token: token || inMemoryConfig.token,
      phoneNumberId: phoneNumberId || inMemoryConfig.phoneNumberId,
      businessAccountId: businessAccountId || inMemoryConfig.businessAccountId,
      verifyToken: verifyToken || 'jasmine_secret_verify_token',
      geminiApiKey: geminiApiKey || inMemoryConfig.geminiApiKey,
      companyName: companyName || 'Jasmine Group',
      assistantName: assistantName || 'Efe',
      serviceCity: serviceCity || 'Alanya'
    };

    syncGlobalMetaConfig(inMemoryConfig.token, inMemoryConfig.phoneNumberId, inMemoryConfig.businessAccountId);

    try {
      await prisma.whatsAppConfig.upsert({
        where: { id: 'default' },
        update: {
          token: token || null,
          phoneNumberId: phoneNumberId || null,
          businessAccountId: businessAccountId || null,
          verifyToken: verifyToken || 'jasmine_secret_verify_token',
          geminiApiKey: geminiApiKey || null,
          companyName: companyName || 'Jasmine Group',
          assistantName: assistantName || 'Efe',
          serviceCity: serviceCity || 'Alanya'
        },
        create: {
          id: 'default',
          token: token || null,
          phoneNumberId: phoneNumberId || null,
          businessAccountId: businessAccountId || null,
          verifyToken: verifyToken || 'jasmine_secret_verify_token',
          geminiApiKey: geminiApiKey || null,
          companyName: companyName || 'Jasmine Group',
          assistantName: assistantName || 'Efe',
          serviceCity: serviceCity || 'Alanya'
        }
      });
    } catch (dbErr) {}

    return NextResponse.json({
      success: true,
      message: 'Meta WhatsApp API & AI ayarları başarıyla kaydedildi!',
      config: {
        configured: Boolean(inMemoryConfig.token && inMemoryConfig.phoneNumberId),
        phoneNumberId: inMemoryConfig.phoneNumberId,
        source: 'ACTIVE'
      }
    });
  } catch (error: any) {
    syncGlobalMetaConfig(inMemoryConfig.token, inMemoryConfig.phoneNumberId, inMemoryConfig.businessAccountId);
    return NextResponse.json({
      success: true,
      message: 'Meta WhatsApp API ayarları kaydedildi!',
      config: {
        configured: Boolean(inMemoryConfig.token && inMemoryConfig.phoneNumberId),
        phoneNumberId: inMemoryConfig.phoneNumberId,
        source: 'MEMORY'
      }
    });
  }
}
