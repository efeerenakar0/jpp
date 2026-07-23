import prisma from '@/lib/prisma';

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
  globalCredentials: { token: string; phoneNumberId: string; businessAccountId: string } | null;
};

export function updateCredentialsCache(creds: { token: string; phoneNumberId: string; businessAccountId: string }) {
  if (creds.token && creds.phoneNumberId) {
    globalWhatsAppStore.globalCredentials = creds;
  }
}

/**
 * Get active Meta WhatsApp API credentials (Global memory first, DB second, ENV third)
 */
export async function getWhatsAppCredentials() {
  if (globalWhatsAppStore.globalCredentials?.token && globalWhatsAppStore.globalCredentials?.phoneNumberId) {
    return globalWhatsAppStore.globalCredentials;
  }

  try {
    const config = await prisma.whatsAppConfig.findUnique({
      where: { id: 'default' }
    });

    const token = config?.token || process.env.WHATSAPP_TOKEN || '';
    const phoneNumberId = config?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const businessAccountId = config?.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

    if (token && phoneNumberId) {
      globalWhatsAppStore.globalCredentials = { token, phoneNumberId, businessAccountId };
    }

    return { token, phoneNumberId, businessAccountId };
  } catch (e) {
    return globalWhatsAppStore.globalCredentials || {
      token: process.env.WHATSAPP_TOKEN || '',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ''
    };
  }
}

export async function sendMetaWhatsAppMessage({ to, text }: SendTextMessageParams): Promise<MetaWhatsAppResponse> {
  const { token, phoneNumberId } = await getWhatsAppCredentials();

  let cleanPhone = to.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10 && cleanPhone.startsWith('5')) {
    cleanPhone = `90${cleanPhone}`;
  }

  if (!token || !phoneNumberId) {
    console.warn('[WhatsApp Cloud API Warning] Meta Token or Phone Number ID is missing on server');
    return {
      messaging_product: 'whatsapp',
      contacts: [{ input: cleanPhone, wa_id: cleanPhone }],
      messages: [{ id: `mock_msg_${Date.now()}` }]
    };
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
      if (err.message?.includes('süresi doldu')) {
        throw err;
      }
    }

    if (attempt < 3) {
      await new Promise(res => setTimeout(res, attempt * 1000));
    }
  }

  throw new Error(`WhatsApp mesaj iletimi başarısız: ${lastError}`);
}
