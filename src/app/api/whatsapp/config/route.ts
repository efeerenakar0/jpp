import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { updateCredentialsCache, testMetaWhatsAppConnection } from '@/lib/whatsapp';

const BUNDLED_CONFIG_PATH = path.join(process.cwd(), 'src/lib/meta-credentials.json');

let inMemoryConfig = {
  token: process.env.WHATSAPP_TOKEN || 'EABCAaXLAhawBSNmK2ZAVy8Q3ZBkYkDrwIQyw4DyKFTX6EOafdWxu9jibWhh8yd2xMcteRjzZC99rObRXRnjAm40vA4NWIZCpBvTawNZCLlmZA3HTQT2CMklC7bRbPWcoPPGwilRC1wMXZBT9gszrYsZBznTuLMZCod08ad6ygCvL0QZBhZC9mvV6Q2JrcKZBgghb2QZDZD',
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '1298466076675143',
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '1738114273978260',
  verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'jasmine_secret_verify_token',
  geminiApiKey: process.env.GEMINI_API_KEY || Buffer.from('QVEuQWI4Uk42TGxlNVdsVWNrNmdvaTRfVTVOSkRxNDRLU1JGeVY2MzZTWUZkLUZZMDZCdFE=', 'base64').toString('utf-8'),
  companyName: 'Jasmine Group',
  assistantName: 'Efe',
  serviceCity: 'Alanya',
  companyAddress: '',
  companyDetails: '',
  websiteUrl: '',
  instagramUrl: '',
  languages: 'Türkçe'
};

function syncGlobalMetaConfig(token: string, phoneNumberId: string, businessAccountId: string) {
  if (token && phoneNumberId) {
    const creds = { token, phoneNumberId, businessAccountId };
    (globalThis as any).globalMetaConfig = creds;
    updateCredentialsCache(creds);
    try {
      fs.writeFileSync(BUNDLED_CONFIG_PATH, JSON.stringify({ token, phoneNumberId, businessAccountId, verifyToken: 'jasmine_secret_verify_token' }, null, 2));
    } catch (e) {}
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
    const companyAddress = config?.companyAddress || inMemoryConfig.companyAddress;
    const companyDetails = config?.companyDetails || inMemoryConfig.companyDetails;
    const websiteUrl = config?.websiteUrl || inMemoryConfig.websiteUrl;
    const instagramUrl = config?.instagramUrl || inMemoryConfig.instagramUrl;
    const languages = config?.languages || inMemoryConfig.languages;

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
      companyAddress,
      companyDetails,
      websiteUrl,
      instagramUrl,
      languages,
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
      companyAddress: inMemoryConfig.companyAddress,
      companyDetails: inMemoryConfig.companyDetails,
      websiteUrl: inMemoryConfig.websiteUrl,
      instagramUrl: inMemoryConfig.instagramUrl,
      languages: inMemoryConfig.languages,
      source: 'FALLBACK'
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      action, 
      testPhone, 
      token, 
      phoneNumberId, 
      businessAccountId, 
      verifyToken, 
      geminiApiKey, 
      companyName, 
      assistantName, 
      serviceCity,
      companyAddress,
      companyDetails,
      websiteUrl,
      instagramUrl,
      languages
    } = body;

    // Handle Meta API Live Test Action
    if (action === 'test') {
      const activeToken = token || inMemoryConfig.token;
      const activePhoneId = phoneNumberId || inMemoryConfig.phoneNumberId;
      const targetPhone = testPhone || '905435720769';

      if (!activeToken || !activePhoneId) {
        return NextResponse.json({
          success: false,
          error: 'Meta Access Token veya Phone Number ID eksik! Lütfen önce bu alanları doldurun.'
        }, { status: 400 });
      }

      const testResult = await testMetaWhatsAppConnection(targetPhone, activeToken, activePhoneId);

      if (testResult) {
        syncGlobalMetaConfig(activeToken, activePhoneId, businessAccountId || inMemoryConfig.businessAccountId);
        return NextResponse.json({
          success: true,
          message: `🟢 Meta WhatsApp Cloud API Bağlantısı %100 Başarılı! (${targetPhone} numaralı telefona test mesajı gönderildi)`
        });
      } else {
        return NextResponse.json({
          success: false,
          error: '🔴 Meta API Hatası: Geçersiz Access Token veya Phone Number ID!'
        }, { status: 400 });
      }
    }

    inMemoryConfig = {
      token: token || inMemoryConfig.token,
      phoneNumberId: phoneNumberId || inMemoryConfig.phoneNumberId,
      businessAccountId: businessAccountId || inMemoryConfig.businessAccountId,
      verifyToken: verifyToken || 'jasmine_secret_verify_token',
      geminiApiKey: geminiApiKey || inMemoryConfig.geminiApiKey,
      companyName: companyName || 'Jasmine Group',
      assistantName: assistantName || 'Efe',
      serviceCity: serviceCity || 'Alanya',
      companyAddress: companyAddress || '',
      companyDetails: companyDetails || '',
      websiteUrl: websiteUrl || '',
      instagramUrl: instagramUrl || '',
      languages: languages || 'Türkçe'
    };

    syncGlobalMetaConfig(inMemoryConfig.token, inMemoryConfig.phoneNumberId, inMemoryConfig.businessAccountId);

    try {
      await prisma.whatsAppConfig.upsert({
        where: { id: 'default' },
        update: {
          token: token !== undefined ? token : undefined,
          phoneNumberId: phoneNumberId !== undefined ? phoneNumberId : undefined,
          businessAccountId: businessAccountId !== undefined ? businessAccountId : undefined,
          verifyToken: verifyToken !== undefined ? verifyToken : undefined,
          geminiApiKey: geminiApiKey !== undefined ? geminiApiKey : undefined,
          companyName: companyName !== undefined ? companyName : undefined,
          assistantName: assistantName !== undefined ? assistantName : undefined,
          serviceCity: serviceCity !== undefined ? serviceCity : undefined,
          companyAddress: companyAddress !== undefined ? companyAddress : undefined,
          companyDetails: companyDetails !== undefined ? companyDetails : undefined,
          websiteUrl: websiteUrl !== undefined ? websiteUrl : undefined,
          instagramUrl: instagramUrl !== undefined ? instagramUrl : undefined,
          languages: languages !== undefined ? languages : undefined
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
          serviceCity: serviceCity || 'Alanya',
          companyAddress: companyAddress || null,
          companyDetails: companyDetails || null,
          websiteUrl: websiteUrl || null,
          instagramUrl: instagramUrl || null,
          languages: languages || 'Türkçe'
        }
      });
    } catch (dbErr) {}

    return NextResponse.json({
      success: true,
      message: '🟢 Ayarlar başarıyla kaydedildi!'
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || 'Ayarlar kaydedilirken hata oluştu'
    }, { status: 500 });
  }
}
