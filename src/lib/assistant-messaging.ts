import type { MessageDeliveryStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { queueCompanyWhatsAppMessage } from '@/lib/company-whatsapp';

export type AssistantDelivery = {
  providerMessageId: string;
  deliveryStatus: MessageDeliveryStatus;
  messageType: 'TEXT' | 'TEMPLATE';
  metadata: string;
};

export async function sendAssistantWhatsAppMessage(input: {
  companyAccountId: string;
  to: string;
  text: string;
  lastCustomerMessageAt: Date | null;
  conversationId?: string;
  createdByType?: string;
  createdById?: string;
}): Promise<AssistantDelivery> {
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
      provider: 'waha',
      providerMessageId: result.providerMessageId,
      outboxId: result.outboxId,
      channel: 'whatsapp',
      status: result.deliveryStatus,
      queued: result.queued,
      sentAt: result.queued ? null : new Date().toISOString(),
    }),
  };
}

export async function saveOutgoingConversationMessage(input: {
  conversationId: string;
  content: string;
  delivery: AssistantDelivery;
  role?: 'assistant' | 'patron';
}) {
  const message = await prisma.conversationMessage.create({
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
  const conversation = await prisma.customerConversation.findUnique({
    where: { id: input.conversationId },
    select: { companyAccountId: true, customerPhone: true },
  });
  if (conversation?.customerPhone) {
    await prisma.whatsAppMessage.create({
      data: {
        companyAccountId: conversation.companyAccountId,
        phone: conversation.customerPhone,
        fromMe: true,
        content: input.content,
        status: input.delivery.deliveryStatus,
        providerMessageId: input.delivery.providerMessageId,
      },
    });
  }
  return message;
}
