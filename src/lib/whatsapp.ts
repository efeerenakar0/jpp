import prisma from '@/lib/prisma';

export interface SendTextMessageParams {
  to: string; // Recipient phone number with country code (e.g. 905321234567)
  text: string;
}

export interface SendTemplateMessageParams {
  to: string;
  templateName: string;
  languageCode: string;
  bodyText: string;
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

export function updateCredentialsCache(creds: Partial<{ token: string; phoneNumberId: string; businessAccountId: string; geminiApiKey?: string }>) {
  if (creds.token || creds.phoneNumberId) {
    const existing = globalWhatsAppStore.globalCredentials || { token: '', phoneNumberId: '', businessAccountId: '' };
    const merged = { ...existing, ...creds };
    globalWhatsAppStore.globalCredentials = merged;
  }
}

/**
 * Get active Meta WhatsApp API Credentials
 */
export async function getActiveWhatsAppCredentials(): Promise<{
  token: string;
  phoneNumberId: string;
  businessAccountId: string;
  geminiApiKey?: string;
}> {
  // 1. Check the process cache first
  if (globalWhatsAppStore.globalCredentials?.token && globalWhatsAppStore.globalCredentials?.phoneNumberId) {
    return globalWhatsAppStore.globalCredentials;
  }

  // 2. Check the database
  try {
    if (process.env.DATABASE_URL) {
      const config = await prisma.whatsAppConfig.findUnique({
        where: { id: 'default' }
      });

      if (config && config.token && config.phoneNumberId) {
        const creds = {
          token: config.token,
          phoneNumberId: config.phoneNumberId,
          businessAccountId: config.businessAccountId || '',
          geminiApiKey: config.geminiApiKey || undefined
        };
        globalWhatsAppStore.globalCredentials = creds;
        return creds;
      }
    }
  } catch (dbErr) {
    console.warn('[WhatsApp Config DB Warning]:', dbErr);
  }

  // 3. Environment Variables
  const envToken = process.env.WHATSAPP_TOKEN;
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const envBusinessId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const envGeminiKey = process.env.GEMINI_API_KEY;

  if (envToken && envPhoneId) {
    const creds = {
      token: envToken,
      phoneNumberId: envPhoneId,
      businessAccountId: envBusinessId || '',
      geminiApiKey: envGeminiKey
    };
    globalWhatsAppStore.globalCredentials = creds;
    return creds;
  }

  throw new Error('Meta WhatsApp credentials are not configured');
}

export const getWhatsAppCredentials = getActiveWhatsAppCredentials;

export async function testMetaWhatsAppConnection(
  phoneOrCreds?: { token?: string; phoneNumberId?: string },
  token?: string,
  phoneId?: string
): Promise<boolean> {
  try {
    let activeToken = token;
    let activePhoneId = phoneId;
    if (typeof phoneOrCreds === 'object' && phoneOrCreds !== null) {
      activeToken = phoneOrCreds.token;
      activePhoneId = phoneOrCreds.phoneNumberId;
    }
    if (!activeToken || !activePhoneId) {
      const active = await getActiveWhatsAppCredentials();
      activeToken = activeToken || active.token;
      activePhoneId = activePhoneId || active.phoneNumberId;
    }
    if (!activeToken || !activePhoneId) return false;
    const res = await fetch(`https://graph.facebook.com/v21.0/${activePhoneId}`, {
      headers: { 'Authorization': `Bearer ${activeToken}` }
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send Text Message via Meta WhatsApp Cloud API (Graph API v21.0)
 */
export async function sendMetaWhatsAppMessage(params: SendTextMessageParams): Promise<MetaWhatsAppResponse> {
  const creds = await getActiveWhatsAppCredentials();

  if (!creds.token || !creds.phoneNumberId) {
    throw new Error('Meta WhatsApp Cloud API credentials missing (Token or Phone Number ID not configured)');
  }

  const cleanPhone = params.to.replace(/[^0-9]/g, '');
  if (!cleanPhone) {
    throw new Error('Invalid recipient phone number');
  }

  const endpoint = `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`;

  console.log(`[Meta WhatsApp Cloud API] Sending message to ${cleanPhone} via Phone ID: ${creds.phoneNumberId}...`);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${creds.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: params.text
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[Meta WhatsApp API HTTP Error]:', response.status, data);
    const errorMsg = data?.error?.message || `Meta API Error (${response.status})`;
    throw new Error(errorMsg);
  }

  console.log('[Meta WhatsApp API Success]:', data);
  return data as MetaWhatsAppResponse;
}

/**
 * Send an approved Meta template outside the 24-hour customer service window.
 * The configured template must contain one text variable in its body.
 */
export async function sendMetaWhatsAppTemplate(
  params: SendTemplateMessageParams
): Promise<MetaWhatsAppResponse> {
  const creds = await getActiveWhatsAppCredentials();
  const cleanPhone = params.to.replace(/[^0-9]/g, '');
  const templateName = params.templateName.trim();
  const languageCode = params.languageCode.trim() || 'tr';

  if (!cleanPhone) {
    throw new Error('Geçersiz alıcı telefon numarası.');
  }
  if (!templateName) {
    throw new Error('Meta WhatsApp şablon adı yapılandırılmamış.');
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: params.bodyText }],
            },
          ],
        },
      }),
    }
  );
  const data = await response.json();

  if (!response.ok) {
    console.error('[Meta WhatsApp Template Error]:', response.status, data);
    throw new Error(
      data?.error?.message || `Meta şablon API hatası (${response.status})`
    );
  }

  return data as MetaWhatsAppResponse;
}
