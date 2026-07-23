import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateCredentialsCache } from '@/lib/whatsapp';

/**
 * Get active Meta WhatsApp API configuration
 */
export async function GET() {
  try {
    const config = await prisma.whatsAppConfig.findUnique({
      where: { id: 'default' }
    });

    const token = config?.token || process.env.WHATSAPP_TOKEN || '';
    const phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const businessAccountId = config?.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    const verifyToken = config?.verifyToken || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'jasmine_secret_verify_token';
    const geminiApiKey = config?.geminiApiKey || process.env.GEMINI_API_KEY || '';
    const companyName = config?.companyName || 'Jasmine Group';
    const assistantName = config?.assistantName || 'Efe';
    const serviceCity = config?.serviceCity || 'Alanya';

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
      source: config?.token ? 'DATABASE' : (process.env.WHATSAPP_TOKEN ? 'ENV' : 'NONE')
    });
  } catch (error: any) {
    console.error('[WhatsApp Config GET Error]:', error);
    return NextResponse.json({
      configured: false,
      tokenMasked: '',
      tokenRaw: process.env.WHATSAPP_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'jasmine_secret_verify_token',
      geminiApiKey: process.env.GEMINI_API_KEY || '',
      companyName: 'Jasmine Group',
      assistantName: 'Efe',
      serviceCity: 'Alanya',
      source: 'FALLBACK'
    });
  }
}

/**
 * Save or update Meta WhatsApp API & AI configuration in Database
 */
export async function POST(req: Request) {
  try {
    const { token, phoneNumberId, businessAccountId, verifyToken, geminiApiKey, companyName, assistantName, serviceCity } = await req.json();

    const updatedConfig = await prisma.whatsAppConfig.upsert({
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

    if (updatedConfig.token && updatedConfig.phoneNumberId) {
      updateCredentialsCache({
        token: updatedConfig.token,
        phoneNumberId: updatedConfig.phoneNumberId,
        businessAccountId: updatedConfig.businessAccountId || ''
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Meta WhatsApp API ayarları veritabanına başarıyla kaydedildi!',
      config: {
        configured: Boolean(updatedConfig.token && updatedConfig.phoneNumberId),
        phoneNumberId: updatedConfig.phoneNumberId,
        source: 'DATABASE'
      }
    });
  } catch (error: any) {
    console.error('[WhatsApp Config POST Error]:', error);
    return NextResponse.json({ error: 'Ayarlar kaydedilemedi: ' + error.message }, { status: 500 });
  }
}
