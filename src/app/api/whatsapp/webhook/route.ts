import { after, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp';
import { callAI, PROMPTS } from '@/lib/ai';
import {
  extractAppointmentSignal,
  needsCustomerReplyRepair,
  type AppointmentSignal,
} from '@/lib/customer-message';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const processedMessageIds = new Set<string>();

async function saveAppointmentRequest(
  conversation: {
    id: string;
    customerName: string;
    customerPhone: string | null;
  },
  signal: AppointmentSignal
) {
  if (!signal.requested) {
    return null;
  }

  const existingRequest = await prisma.appointmentRequest.findFirst({
    where: {
      conversationId: conversation.id,
      status: 'PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existingRequest) {
    return prisma.appointmentRequest.update({
      where: { id: existingRequest.id },
      data: {
        proposedDate: signal.proposedDate || existingRequest.proposedDate,
        proposedTime: signal.proposedTime || existingRequest.proposedTime,
      },
    });
  }

  const appointment = await prisma.appointmentRequest.create({
    data: {
      conversationId: conversation.id,
      customerName: conversation.customerName,
      customerPhone: conversation.customerPhone,
      proposedDate: signal.proposedDate,
      proposedTime: signal.proposedTime,
    },
  });

  const appointmentDescription = [
    signal.proposedDate
      ? signal.proposedDate.toLocaleDateString('tr-TR', {
          timeZone: 'Europe/Istanbul',
        })
      : 'Tarih belirtilmedi',
    signal.proposedTime || 'Saat belirtilmedi',
  ].join(' · ');

  await prisma.notification.create({
    data: {
      type: 'APPOINTMENT_REQUEST',
      title: 'Yeni WhatsApp Randevu Talebi',
      message: `${conversation.customerName}: ${appointmentDescription}`,
      link: '/fabrika/asistan',
      metadata: JSON.stringify({
        appointmentRequestId: appointment.id,
        conversationId: conversation.id,
      }),
    },
  });

  return appointment;
}

async function repairCustomerReply(content: string): Promise<string> {
  if (!needsCustomerReplyRepair(content)) {
    return content.trim();
  }

  try {
    const repaired = await callAI(
      [
        {
          role: 'system',
          content: `Bir WhatsApp emlak danışmanı yanıtını dil ve karakter bakımından düzelt.
Yalnızca Türkçe ve Latin alfabesi kullan.
Yeni fiyat, portföy, uygunluk veya özellik ekleme.
Anlamı değiştirme, en fazla 500 karakter yaz ve yalnızca düzeltilmiş mesajı döndür.`,
        },
        { role: 'user', content },
      ],
      'customer_reply_repair'
    );

    if (!needsCustomerReplyRepair(repaired.content)) {
      return repaired.content.trim();
    }
  } catch (error) {
    console.error('[WhatsApp Reply Repair Error]:', error);
  }

  return 'Mesajınızı ve kriterlerinizi aldım. Ekibimiz doğrulanmış portföyleri kontrol edip randevu talebinizle birlikte size dönüş yapacak.';
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    return NextResponse.json(
      { error: 'Webhook verification is not configured' },
      { status: 503 }
    );
  }

  if (mode === 'subscribe' && token === expectedToken && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body?.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' });
    }

    const value = body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) {
      return NextResponse.json({ status: 'no_messages' });
    }

    const messageId = String(message.id || '');
    if (messageId && processedMessageIds.has(messageId)) {
      return NextResponse.json({ status: 'duplicate' });
    }
    if (messageId) {
      processedMessageIds.add(messageId);
    }

    const fromPhone = String(message.from || '');
    const contactName =
      String(contact?.profile?.name || '').trim() || `WhatsApp ${fromPhone.slice(-4)}`;
    const messageType = String(message.type || 'unknown');
    const text =
      messageType === 'text'
        ? String(message.text?.body || '')
        : messageType === 'image'
          ? String(message.image?.caption || 'Müşteri bir görsel gönderdi.')
          : `[${messageType} mesajı alındı]`;

    if (!fromPhone || !text) {
      return NextResponse.json({ status: 'invalid_message' }, { status: 400 });
    }

    after(async () => {
      await processIncomingMessage({
        fromPhone,
        contactName,
        text,
        messageId,
        messageType,
      });
    });

    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  } catch (error) {
    console.error('[WhatsApp Webhook Parse Error]:', error);
    return NextResponse.json({ status: 'invalid_payload' }, { status: 400 });
  }
}

async function processIncomingMessage(input: {
  fromPhone: string;
  contactName: string;
  text: string;
  messageId: string;
  messageType: string;
}) {
  try {
    let conversation = await prisma.customerConversation.findFirst({
      where: {
        customerPhone: input.fromPhone,
        channel: 'WHATSAPP',
        isActive: true,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 30,
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.customerConversation.create({
        data: {
          customerName: input.contactName,
          customerPhone: input.fromPhone,
          channel: 'WHATSAPP',
        },
        include: { messages: true },
      });
    }

    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'customer',
        content: input.text,
        metadata: JSON.stringify({
          provider: 'meta',
          providerMessageId: input.messageId || null,
          messageType: input.messageType,
        }),
      },
    });

    const appointmentSignal = extractAppointmentSignal(input.text);
    const appointment = await saveAppointmentRequest(
      {
        id: conversation.id,
        customerName: conversation.customerName,
        customerPhone: conversation.customerPhone,
      },
      appointmentSignal
    );

    const [config, projects] = await Promise.all([
      prisma.whatsAppConfig.findUnique({ where: { id: 'default' } }),
      prisma.project.findMany({
        where: { published: true },
        select: {
          slug: true,
          name: true,
          location: true,
          price: true,
          shortDescription: true,
          units: {
            select: {
              type: true,
              area: true,
              price: true,
            },
          },
        },
        take: 12,
      }),
    ]);
    const companyName = config?.companyName || 'Jasmine Group';
    const history = conversation.messages
      .map((item) => `${item.role}: ${item.content}`)
      .join('\n');
    const customerMessage =
      input.messageType === 'image'
        ? `${input.text} Görselin ulaştığını söyle; incelenmeden işlendiğini veya iyileştirildiğini iddia etme.`
        : input.text;
    const systemPrompt = PROMPTS.customerAssistant({
      companyName,
      availableListings: JSON.stringify(projects),
      conversationHistory: history,
      customerMessage,
      assistantName: config?.assistantName || 'Efe',
      serviceCity: config?.serviceCity || 'Alanya',
      appointmentStatus: appointment
        ? `Randevu talebi PENDING olarak kaydedildi. Önerilen tarih: ${
            appointment.proposedDate
              ? appointment.proposedDate.toLocaleDateString('tr-TR', {
                  timeZone: 'Europe/Istanbul',
                })
              : 'belirtilmedi'
          }, saat: ${appointment.proposedTime || 'belirtilmedi'}. Kesin onay verme.`
        : undefined,
    });
    const aiResponse = await callAI([
      { role: 'system', content: systemPrompt },
      ...conversation.messages.map((item) => ({
        role:
          item.role === 'assistant'
            ? ('assistant' as const)
            : ('user' as const),
        content: item.content,
      })),
      { role: 'user', content: customerMessage },
    ]);
    const customerReply = await repairCustomerReply(aiResponse.content);
    const metaResponse = await sendMetaWhatsAppMessage({
      to: input.fromPhone,
      text: customerReply,
    });

    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: customerReply,
        metadata: JSON.stringify({
          provider: 'meta',
          providerMessageId: metaResponse.messages?.[0]?.id || null,
          deliveryRequested: true,
        }),
      },
    });
  } catch (error) {
    console.error('[WhatsApp Webhook Worker Error]:', error);
    await prisma.notification
      .create({
        data: {
          type: 'SYSTEM',
          title: 'WhatsApp Asistan Hatası',
          message: `${input.fromPhone.slice(-4)} ile biten numaranın mesajı otomatik yanıtlanamadı.`,
          link: '/fabrika/asistan',
        },
      })
      .catch((notificationError) => {
        console.error('[WhatsApp Error Notification Failed]:', notificationError);
      });
  }
}
