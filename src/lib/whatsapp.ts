import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import bundledCreds from './meta-credentials.json';

export interface SendTextMessageParams {
  to: string; // Recipient phone number with country code (e.g. 905321234567)
  text: string;
}

export interface MetaWhatsAppResponse {
  messaging_product: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
  error?: {
    message: string;
    type: string;
    code: number;
    fbtrace_id: string;
  };
}

const globalWhatsAppStore = globalThis as unknown as {
  globalCredentials: { token: string; phoneNumberId: string; businessAccountId: string; geminiApiKey?: string } | null;
};

const TMP_CONFIG_PATH = '/tmp/jasmine_whatsapp_config.json';

export function updateCredentialsCache(creds: { token: string; phoneNumberId: string; businessAccountId: string; geminiApiKey?: string }) {
  if (creds.token && creds.phoneNumberId) {
    globalWhatsAppStore.globalCredentials = creds;
    (globalThis as any).globalMetaConfig = creds;
    try {
      fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(creds));
    } catch (e) {}
  }
}

/**
 * Get active Meta WhatsApp API credentials (Global memory -> /tmp file -> bundled JSON -> DB -> ENV)
 */
export async function getWhatsAppCredentials() {
  if (globalWhatsAppStore.globalCredentials?.token && globalWhatsAppStore.globalCredentials?.phoneNumberId) {
    return globalWhatsAppStore.globalCredentials;
  }

  const globalMeta = (globalThis as any).globalMetaConfig;
  if (globalMeta?.token && globalMeta?.phoneNumberId) {
    globalWhatsAppStore.globalCredentials = globalMeta;
    return globalMeta;
  }

  // Try reading /tmp file fallback
  try {
    if (fs.existsSync(TMP_CONFIG_PATH)) {
      const fileData = fs.readFileSync(TMP_CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(fileData);
      if (parsed.token && parsed.phoneNumberId) {
        globalWhatsAppStore.globalCredentials = parsed;
        return parsed;
      }
    }
  } catch (e) {}

  // Fallback to bundled meta-credentials.json
  if (bundledCreds && (bundledCreds as any).token && (bundledCreds as any).phoneNumberId) {
    const creds = {
      token: (bundledCreds as any).token,
      phoneNumberId: (bundledCreds as any).phoneNumberId,
      businessAccountId: (bundledCreds as any).businessAccountId || '',
      geminiApiKey: (bundledCreds as any).geminiApiKey || process.env.GEMINI_API_KEY || ''
    };
    globalWhatsAppStore.globalCredentials = creds;
    return creds;
  }

  try {
    const config = await prisma.whatsAppConfig.findUnique({
      where: { id: 'default' }
    });

    const token = config?.token || process.env.WHATSAPP_TOKEN || '';
    const phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const businessAccountId = config?.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';
    const geminiApiKey = config?.geminiApiKey || (bundledCreds as any)?.geminiApiKey || process.env.GEMINI_API_KEY || '';

    if (token && phoneNumberId) {
      const creds = { token, phoneNumberId, businessAccountId, geminiApiKey };
      globalWhatsAppStore.globalCredentials = creds;
      try { fs.writeFileSync(TMP_CONFIG_PATH, JSON.stringify(creds)); } catch (e) {}
    }

    return { token, phoneNumberId, businessAccountId, geminiApiKey };
  } catch (e) {
    return globalWhatsAppStore.globalCredentials || globalMeta || {
      token: (bundledCreds as any)?.token || process.env.WHATSAPP_TOKEN || '',
      phoneNumberId: (bundledCreds as any)?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: (bundledCreds as any)?.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      geminiApiKey: (bundledCreds as any)?.geminiApiKey || process.env.GEMINI_API_KEY || ''
    };
  }
}

export async function testMetaWhatsAppConnection(testPhone: string, testToken: string, testPhoneId: string) {
  let cleanPhone = testPhone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10 && cleanPhone.startsWith('5')) {
    cleanPhone = `90${cleanPhone}`;
  }

  const url = `https://graph.facebook.com/v21.0/${testPhoneId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanPhone,
    type: 'text',
    text: {
      body: `🔔 Jasmine Group Meta WhatsApp Cloud API Test Mesajıdır. Bağlantınız %100 Başarılıdır! (Saat: ${new Date().toLocaleTimeString('tr-TR')})`
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok && !data.error) {
      updateCredentialsCache({ token: testToken, phoneNumberId: testPhoneId, businessAccountId: '' });
    }
    return { ok: response.ok, status: response.status, data };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message || 'Meta Cloud API bağlantı hatası' };
  }
}

export async function sendMetaWhatsAppMessage({ to, text }: SendTextMessageParams): Promise<MetaWhatsAppResponse> {
  const { token, phoneNumberId } = await getWhatsAppCredentials();

  let cleanPhone = to.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10 && cleanPhone.startsWith('5')) {
    cleanPhone = `90${cleanPhone}`;
  }

  if (!token || !phoneNumberId) {
    console.error('[WhatsApp Cloud API Failure]: Meta Access Token or Phone Number ID is missing on Netlify server');
    throw new Error('Meta WhatsApp Jetonu veya Telefon ID eksik! Lütfen Asistan panelindeki Meta & AI Ayarları butonuna basıp Jetonunuzu kaydedin.');
  }

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: cleanPhone,
    type: 'text',
    text: {
      body: text
    }
  };

  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data: MetaWhatsAppResponse = await response.json();

      if (response.ok && !data.error) {
        console.log(`[WhatsApp Cloud API Success] Message sent to ${cleanPhone}:`, data);
        return data;
      }

      console.warn(`[WhatsApp Cloud API Attempt ${attempt} Failed]:`, data.error || data);
      lastError = data.error?.message || 'Meta Cloud API request failed';

      if (data.error?.code === 190) {
        throw new Error('Meta API Access Token süresi doldu veya geçersiz. Lütfen Meta Ayarlarından yeni Jeton yapıştırın.');
      }
    } catch (err: any) {
      lastError = err.message || err;
      if (err.message?.includes('süresi doldu') || err.message?.includes('eksik')) {
        throw err;
      }
    }

    if (attempt < 3) {
      await new Promise(res => setTimeout(res, attempt * 1000));
    }
  }

  throw new Error(`WhatsApp mesaj iletimi başarısız: ${lastError}`);
}
