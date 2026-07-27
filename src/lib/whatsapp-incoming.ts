import 'server-only';

import prisma from '@/lib/prisma';
import { callAI, PROMPTS } from '@/lib/ai';
import {
  saveOutgoingConversationMessage,
  sendAssistantWhatsAppMessage,
} from '@/lib/assistant-messaging';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import { extractAppointmentSignal } from '@/lib/customer-message';

export type IncomingWhatsAppMessage = {
  companyAccountId: string;
  provider: 'WAHA' | 'EVOLUTION' | 'META';
  fromPhone: string;
  contactName: string;
  text: string;
  providerMessageId: string;
  messageType: string;
};

function cleanPhone(value: string) {
  return value.replace(/@.+$/, '').replace(/\D/g, '');
}

export async function processIncomingWhatsAppMessage(
  input: IncomingWhatsAppMessage
) {
  const phone = cleanPhone(input.fromPhone);
  if (!phone || !input.text.trim()) {
    throw new Error('Gelen WhatsApp mesajında telefon veya içerik eksik.');
  }

  if (input.providerMessageId) {
    const duplicate = await prisma.conversationMessage.findUnique({
      where: { providerMessageId: input.providerMessageId },
      select: { id: true },
    });
    if (duplicate) return { duplicate: true, conversationId: null };
  }

  let conversation = await prisma.customerConversation.findFirst({
    where: {
      companyAccountId: input.companyAccountId,
      customerPhone: phone,
      channel: 'WHATSAPP',
      isActive: true,
    },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 30 },
    },
  });

  if (!conversation) {
    conversation = await prisma.customerConversation.create({
      data: {
        companyAccountId: input.companyAccountId,
        customerName: input.contactName || `WhatsApp ${phone.slice(-4)}`,
        customerPhone: phone,
        channel: 'WHATSAPP',
      },
      include: { messages: true },
    });
  }

  const receivedAt = new Date();
  await prisma.$transaction([
    prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'customer',
        content: input.text.trim(),
        metadata: JSON.stringify({
          provider: input.provider.toLowerCase(),
          providerMessageId: input.providerMessageId || null,
          messageType: input.messageType,
          status: 'RECEIVED',
        }),
        providerMessageId: input.providerMessageId || null,
        deliveryStatus: 'RECEIVED',
        messageType: input.messageType.toUpperCase(),
      },
    }),
    prisma.customerConversation.update({
      where: { id: conversation.id },
      data: {
        customerName: input.contactName || conversation.customerName,
        summary: input.text.trim(),
        lastCustomerMessageAt: receivedAt,
      },
    }),
    prisma.whatsAppMessage.create({
      data: {
        companyAccountId: input.companyAccountId,
        phone,
        fromMe: false,
        content: input.text.trim(),
        status: 'RECEIVED',
        providerMessageId: input.providerMessageId || null,
      },
    }),
    prisma.crmContact.upsert({
      where: {
        companyAccountId_sourceConversationId: {
          companyAccountId: input.companyAccountId,
          sourceConversationId: conversation.id,
        },
      },
      update: {
        name: input.contactName || conversation.customerName,
        phone,
        source: 'WHATSAPP',
        stage: 'CONTACTED',
      },
      create: {
        companyAccountId: input.companyAccountId,
        sourceConversationId: conversation.id,
        name: input.contactName || conversation.customerName,
        phone,
        source: 'WHATSAPP',
        stage: 'CONTACTED',
        type: 'BUYER',
      },
    }),
  ]);

  const appointmentSignal = extractAppointmentSignal(input.text);
  if (appointmentSignal.requested) {
    const pending = await prisma.appointmentRequest.findFirst({
      where: { conversationId: conversation.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    const appointment = pending
      ? await prisma.appointmentRequest.update({
          where: { id: pending.id },
          data: {
            proposedDate:
              appointmentSignal.proposedDate || pending.proposedDate,
            proposedTime:
              appointmentSignal.proposedTime || pending.proposedTime,
          },
        })
      : await prisma.appointmentRequest.create({
          data: {
            conversationId: conversation.id,
            customerName: conversation.customerName,
            customerPhone: phone,
            proposedDate: appointmentSignal.proposedDate,
            proposedTime: appointmentSignal.proposedTime,
          },
        });
    await createCompanyNotification({
      companyAccountId: input.companyAccountId,
      type: 'APPOINTMENT_REQUEST',
      title: 'Yeni WhatsApp Randevu Talebi',
      message: `${conversation.customerName} randevu onayı bekliyor.`,
      link: '/fabrika/asistan',
      important: true,
      dedupeKey: `whatsapp-appointment:${appointment.id}`,
      metadata: {
        appointmentRequestId: appointment.id,
        conversationId: conversation.id,
      },
    });
  }

  const config = await prisma.whatsAppConfig.findUnique({
    where: { companyAccountId: input.companyAccountId },
  });
  if (!conversation.aiEnabled || config?.autoReplyEnabled === false) {
    await createCompanyNotification({
      companyAccountId: input.companyAccountId,
      type: 'NEW_CUSTOMER_MESSAGE',
      title: 'İnsan Yanıtı Bekleyen WhatsApp Mesajı',
      message: `${conversation.customerName}: ${input.text.slice(0, 160)}`,
      link: '/fabrika/asistan',
      important: true,
      dedupeKey: `whatsapp-handoff:${input.providerMessageId}`,
      metadata: { conversationId: conversation.id, handoff: true },
    });
    return { duplicate: false, conversationId: conversation.id };
  }

  const properties = await prisma.crmProperty.findMany({
    where: {
      companyAccountId: input.companyAccountId,
      status: 'ACTIVE',
    },
    select: {
      title: true,
      referenceCode: true,
      location: true,
      price: true,
      roomCount: true,
      area: true,
      description: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  const systemPrompt = PROMPTS.customerAssistant({
    companyName: config?.companyName || 'Jasmine Group',
    availableListings: JSON.stringify(properties),
    conversationHistory: conversation.messages
      .map((message) => `${message.role}: ${message.content}`)
      .join('\n'),
    customerMessage: input.text,
    assistantName: config?.assistantName || 'Efe',
    serviceCity: config?.serviceCity || 'Alanya',
    appointmentStatus: appointmentSignal.requested
      ? 'Randevu talebi kaydedildi ancak henüz şirket tarafından onaylanmadı.'
      : undefined,
  });
  const ai = await callAI(
    [
      { role: 'system', content: systemPrompt },
      ...conversation.messages.map((message) => ({
        role:
          message.role === 'assistant'
            ? ('assistant' as const)
            : ('user' as const),
        content: message.content,
      })),
      { role: 'user', content: input.text },
    ],
    'whatsapp-customer-assistant'
  );
  const reply = ai.content.trim().slice(0, 1000);
  const delivery = await sendAssistantWhatsAppMessage({
    companyAccountId: input.companyAccountId,
    to: phone,
    text: reply,
    lastCustomerMessageAt: receivedAt,
    conversationId: conversation.id,
    createdByType: 'AI',
  });
  await saveOutgoingConversationMessage({
    conversationId: conversation.id,
    content: reply,
    delivery,
  });

  return { duplicate: false, conversationId: conversation.id };
}
