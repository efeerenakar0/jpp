import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateCredentialsCache } from '@/lib/whatsapp';

// In-memory config fallback for production serverless instances
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

/**
 * Get active Meta WhatsApp API configuration
 */
export async function GET() {
  try {
    let config = null;
    try {
      config = await prisma.whatsAppConfig.findUnique({
        where: { id: 'default' }
      });
    } catch (dbErr) {
      console.warn('[WhatsApp Config GET DB Warning]: Using in-memory config', dbErr);
    }

    const token = config?.token || inMemoryConfig.token;
    const phoneNumberId = config?.phoneNumberId || inMemoryConfig.phoneNumberId;
    const businessAccountId = config?.businessAccountId || inMemoryConfig.businessAccountId;
    const verifyToken = config?.verifyToken || inMemoryConfig.verifyToken;
    const geminiApiKey = config?.geminiApiKey || inMemoryConfig.geminiApiKey;
    const companyName = config?.companyName || inMemoryConfig.companyName;
    const assistantName = config?.assistantName || inMemoryConfig.assistantName;
    const serviceCity = config?.serviceCity || inMemoryConfig.serviceCity;

    if (token && phoneNumberId) {
      updateCredentialsCache({ token, phoneNumberId, businessAccountId });
    }

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
      source: config?.token ? 'DATABASE' : 'MEMORY'
    });
  } catch (error: any) {
    console.error('[WhatsApp Config GET Error]:', error);
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

/**
 * Save or update Meta WhatsApp API & AI configuration
 */
export async function POST(req: Request) {
  try {
    const { token, phoneNumberId, businessAccountId, verifyToken, geminiApiKey, companyName, assistantName, serviceCity } = await req.json();

    // Update in-memory fallback immediately
    inMemoryConfig = {
      token: token || '',
      phoneNumberId: phoneNumberId || '',
      businessAccountId: businessAccountId || '',
      verifyToken: verifyToken || 'jasmine_secret_verify_token',
      geminiApiKey: geminiApiKey || '',
      companyName: companyName || 'Jasmine Group',
      assistantName: assistantName || 'Efe',
      serviceCity: serviceCity || 'Alanya'
    };

    let updatedConfig = null;
    try {
      updatedConfig = await prisma.whatsAppConfig.upsert({
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
    } catch (dbErr) {
      console.warn('[WhatsApp Config POST DB Warning]: Could not persist to DB, saved to memory', dbErr);
    }

    const activeToken = updatedConfig?.token || inMemoryConfig.token;
    const activePhoneId = updatedConfig?.phoneNumberId || inMemoryConfig.phoneNumberId;
    const activeBusId = updatedConfig?.businessAccountId || inMemoryConfig.businessAccountId;

    if (activeToken && activePhoneId) {
      updateCredentialsCache({
        token: activeToken,
        phoneNumberId: activePhoneId,
        businessAccountId: activeBusId || ''
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Meta WhatsApp API & AI ayarları başarıyla kaydedildi!',
      config: {
        configured: Boolean(activeToken && activePhoneId),
        phoneNumberId: activePhoneId,
        source: updatedConfig ? 'DATABASE' : 'MEMORY'
      }
    });
  } catch (error: any) {
    console.error('[WhatsApp Config POST Error]:', error);
    return NextResponse.json({
      success: true,
      message: 'Meta WhatsApp API ayarları hafızaya kaydedildi!',
      config: {
        configured: Boolean(inMemoryConfig.token && inMemoryConfig.phoneNumberId),
        phoneNumberId: inMemoryConfig.phoneNumberId,
        source: 'MEMORY'
      }
    });
  }
}
