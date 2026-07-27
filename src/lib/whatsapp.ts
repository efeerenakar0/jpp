import 'server-only';

import prisma from '@/lib/prisma';
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from '@/lib/whatsapp-crypto';

export interface SendTextMessageParams {
  companyAccountId: string;
  to: string;
  text: string;
}

export interface SendTemplateMessageParams {
  companyAccountId: string;
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

export async function getActiveWhatsAppCredentials(
  companyAccountId: string
): Promise<{
  token: string;
  phoneNumberId: string;
  businessAccountId: string;
  geminiApiKey?: string;
}> {
  const [config, account] = await Promise.all([
    prisma.whatsAppConfig.findUnique({ where: { companyAccountId } }),
    prisma.companyAccount.findUnique({
      where: { id: companyAccountId },
      select: { slug: true },
    }),
  ]);

  if (config?.token && config.phoneNumberId) {
    const token = decryptSecret(config.token);
    const geminiApiKey = config.geminiApiKey
      ? decryptSecret(config.geminiApiKey)
      : undefined;
    if (
      !isEncryptedSecret(config.token) ||
      (config.geminiApiKey && !isEncryptedSecret(config.geminiApiKey))
    ) {
      try {
        await prisma.whatsAppConfig.update({
          where: { id: config.id },
          data: {
            ...(!isEncryptedSecret(config.token)
              ? { token: encryptSecret(token) }
              : {}),
            ...(config.geminiApiKey &&
            geminiApiKey &&
            !isEncryptedSecret(config.geminiApiKey)
              ? { geminiApiKey: encryptSecret(geminiApiKey) }
              : {}),
          },
        });
      } catch (error) {
        console.warn(
          '[WhatsApp Config] Eski kimlik bilgisi şifrelenemedi:',
          error instanceof Error ? error.message : 'bilinmeyen hata'
        );
      }
    }
    return {
      token,
      phoneNumberId: config.phoneNumberId,
      businessAccountId: config.businessAccountId || '',
      geminiApiKey,
    };
  }

  // Eski Jasmine kurulumunu kesintisiz taşımak için yalnızca ana şirket env
  // değişkenlerini kullanabilir. Diğer şirketler kendi kimlik bilgilerini girer.
  if (account?.slug === 'jasmine-group') {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (token && phoneNumberId) {
      return {
        token,
        phoneNumberId,
        businessAccountId:
          process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
        geminiApiKey: process.env.GEMINI_API_KEY,
      };
    }
  }

  throw new Error('Meta WhatsApp kimlik bilgileri yapılandırılmamış.');
}

export const getWhatsAppCredentials = getActiveWhatsAppCredentials;

export async function testMetaWhatsAppConnection(input: {
  companyAccountId?: string;
  token?: string;
  phoneNumberId?: string;
}): Promise<boolean> {
  try {
    let token = input.token;
    let phoneNumberId = input.phoneNumberId;
    if ((!token || !phoneNumberId) && input.companyAccountId) {
      const active = await getActiveWhatsAppCredentials(input.companyAccountId);
      token ||= active.token;
      phoneNumberId ||= active.phoneNumberId;
    }
    if (!token || !phoneNumberId) return false;
    const response = await fetch(
      `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendMetaWhatsAppMessage(
  params: SendTextMessageParams
): Promise<MetaWhatsAppResponse> {
  const credentials = await getActiveWhatsAppCredentials(
    params.companyAccountId
  );
  const phone = params.to.replace(/\D/g, '');
  if (!phone) throw new Error('Geçersiz alıcı telefon numarası.');

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { preview_url: false, body: params.text },
      }),
    }
  );
  const data = (await response.json()) as MetaWhatsAppResponse;
  if (!response.ok) {
    throw new Error(
      data.error?.message || `Meta API hatası (${response.status}).`
    );
  }
  return data;
}

export async function sendMetaWhatsAppTemplate(
  params: SendTemplateMessageParams
): Promise<MetaWhatsAppResponse> {
  const credentials = await getActiveWhatsAppCredentials(
    params.companyAccountId
  );
  const phone = params.to.replace(/\D/g, '');
  if (!phone) throw new Error('Geçersiz alıcı telefon numarası.');
  if (!params.templateName.trim()) {
    throw new Error('Meta WhatsApp şablon adı yapılandırılmamış.');
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'template',
        template: {
          name: params.templateName.trim(),
          language: { code: params.languageCode.trim() || 'tr' },
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
  const data = (await response.json()) as MetaWhatsAppResponse;
  if (!response.ok) {
    throw new Error(
      data.error?.message || `Meta şablon API hatası (${response.status}).`
    );
  }
  return data;
}
