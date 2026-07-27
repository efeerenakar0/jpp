import type { MessageDeliveryStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  sendMetaWhatsAppMessage,
  sendMetaWhatsAppTemplate,
} from '@/lib/whatsapp';
import { queueCompanyWhatsAppMessage } from '@/lib/company-whatsapp';

export const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type AssistantDelivery = {
  providerMessageId: string;
  deliveryStatus: MessageDeliveryStatus;
  messageType: 'TEXT' | 'TEMPLATE';
  metadata: string;
};

export class WhatsAppTemplateRequiredError extends Error {
  constructor() {
    super(
      'Son müşteri mesajının üzerinden 24 saat geçti. Meta ayarlarından onaylı şablon adını kaydedin.'
    );
    this.name = 'WhatsAppTemplateRequiredError';
  }
}

export function hasOpenCustomerServiceWindow(
  lastCustomerMessageAt: Date | null | undefined,
  referenceDate = new Date()
) {
  if (!lastCustomerMessageAt) {
    return false;
  }

  const elapsed = referenceDate.getTime() - lastCustomerMessageAt.getTime();
  return elapsed >= 0 && elapsed < CUSTOMER_SERVICE_WINDOW_MS;
}

export function mapMetaDeliveryStatus(
  status: string
): MessageDeliveryStatus | null {
  switch (status.toLowerCase()) {
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'read':
      // Okundu olaylarını işlemiyoruz; yalnızca teslim ve hata durumları tutulur.
      return null;
    case 'failed':
      return 'FAILED';
    default:
      return null;
  }
}

export function parseMetaTimestamp(value: unknown): Date {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000)
    : new Date();
}

export async function sendAssistantWhatsAppMessage(input: {
  companyAccountId: string;
  to: string;
  text: string;
  lastCustomerMessageAt: Date | null;
  conversationId?: string;
  createdByType?: string;
  createdById?: string;
}): Promise<AssistantDelivery> {
  const config = await prisma.whatsAppConfig.findUnique({
    where: { companyAccountId: input.companyAccountId },
    select: {
      provider: true,
      fallbackTemplateName: true,
      templateLanguage: true,
    },
  });
  const provider = config?.provider === 'META' ? 'META' : 'EVOLUTION';

  if (provider === 'EVOLUTION') {
    const result = await queueCompanyWhatsAppMessage({
      companyAccountId: input.companyAccountId,
      to: input.to,
      text: input.text,
      conversationId: input.conversationId,
      createdByType: input.createdByType,
      createdById: input.createdById,
    });
    return {
      providerMessageId: result.providerMessageId,
      deliveryStatus: result.deliveryStatus,
      messageType: 'TEXT',
      metadata: JSON.stringify({
        provider: 'evolution',
        providerMessageId: result.providerMessageId,
        outboxId: result.outboxId,
        channel: 'whatsapp',
        status: result.deliveryStatus,
        queued: result.queued,
        sentAt: result.queued ? null : new Date().toISOString(),
      }),
    };
  }

  const useFreeform = hasOpenCustomerServiceWindow(
    input.lastCustomerMessageAt
  );
  const metaResponse = useFreeform
    ? await sendMetaWhatsAppMessage({
        companyAccountId: input.companyAccountId,
        to: input.to,
        text: input.text,
      })
    : config?.fallbackTemplateName
      ? await sendMetaWhatsAppTemplate({
          companyAccountId: input.companyAccountId,
          to: input.to,
          templateName: config.fallbackTemplateName,
          languageCode: config.templateLanguage || 'tr',
          bodyText: input.text,
        })
      : (() => {
          throw new WhatsAppTemplateRequiredError();
        })();
  const providerMessageId = metaResponse.messages?.[0]?.id;

  if (!providerMessageId) {
    throw new Error('Meta WhatsApp mesaj kimliği döndürmedi.');
  }

  const messageType = useFreeform ? 'TEXT' : 'TEMPLATE';
  return {
    providerMessageId,
    deliveryStatus: 'SENT',
    messageType,
    metadata: JSON.stringify({
      provider: 'meta',
      providerMessageId,
      channel: 'whatsapp',
      status: 'SENT',
      messageType,
      sentAt: new Date().toISOString(),
    }),
  };
}

export async function saveOutgoingConversationMessage(input: {
  conversationId: string;
  content: string;
  delivery: AssistantDelivery;
  role?: 'assistant' | 'patron';
}) {
  return prisma.conversationMessage.create({
    data: {
      conversationId: input.conversationId,
      role: input.role || 'assistant',
      content: input.content,
      metadata: input.delivery.metadata,
      providerMessageId: input.delivery.providerMessageId,
      deliveryStatus: input.delivery.deliveryStatus,
      messageType: input.delivery.messageType,
    },
  });
}
