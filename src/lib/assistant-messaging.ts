import type { MessageDeliveryStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  sendMetaWhatsAppMessage,
  sendMetaWhatsAppTemplate,
} from '@/lib/whatsapp';

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
      return 'READ';
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
  to: string;
  text: string;
  lastCustomerMessageAt: Date | null;
}): Promise<AssistantDelivery> {
  const config = await prisma.whatsAppConfig.findUnique({
    where: { id: 'default' },
    select: {
      fallbackTemplateName: true,
      templateLanguage: true,
    },
  });
  const useFreeform = hasOpenCustomerServiceWindow(
    input.lastCustomerMessageAt
  );
  const metaResponse = useFreeform
    ? await sendMetaWhatsAppMessage({
        to: input.to,
        text: input.text,
      })
    : config?.fallbackTemplateName
      ? await sendMetaWhatsAppTemplate({
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
