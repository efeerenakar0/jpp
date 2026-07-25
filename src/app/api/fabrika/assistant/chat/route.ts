import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp';
import { callAI, PROMPTS } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      conversationId?: string;
      message?: string;
    };
    const conversationId = body.conversationId?.trim();
    const message = body.message?.trim();

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: 'Sohbet ID’si ve mesaj gerekli.' },
        { status: 400 }
      );
    }

    const conversation = await prisma.customerConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 30,
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Sohbet bulunamadı.' },
        { status: 404 }
      );
    }

    const customerPhone = conversation.customerPhone?.replace(/[^0-9]/g, '') || '';

    if (customerPhone.length >= 10) {
      let metaResponse;
      try {
        metaResponse = await sendMetaWhatsAppMessage({
          to: customerPhone,
          text: message,
        });
      } catch (error) {
        console.error('[Assistant WhatsApp Send Error]:', error);
        return NextResponse.json(
          { error: 'Mesaj WhatsApp’a gönderilemedi.' },
          { status: 502 }
        );
      }

      const savedMessage = await prisma.conversationMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: message,
          metadata: JSON.stringify({
            sentViaMetaApi: true,
            metaMessageId: metaResponse.messages?.[0]?.id || null,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        sentToWhatsApp: true,
        messageRecord: savedMessage,
      });
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { id: 'default' },
    });
    const companyName = config?.companyName || 'Jasmine Group';
    const history = conversation.messages
      .map((item) => `${item.role}: ${item.content}`)
      .join('\n');
    const systemPrompt = PROMPTS.customerAssistant({
      companyName,
      availableListings: 'Alanya portföy veritabanındaki güncel projeler',
      conversationHistory: history,
      customerMessage: message,
      assistantName: config?.assistantName || 'Efe',
      serviceCity: config?.serviceCity || 'Alanya',
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
      { role: 'user', content: message },
    ]);

    const [customerMessage, assistantMessage] = await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId,
          role: 'customer',
          content: message,
        },
      }),
      prisma.conversationMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: aiResponse.content,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      sentToWhatsApp: false,
      reply: aiResponse.content,
      messageRecord: assistantMessage,
      requestMessageId: customerMessage.id,
    });
  } catch (error) {
    console.error('[Assistant Chat Error]:', error);
    return NextResponse.json(
      { error: 'Asistan mesajı işleyemedi.' },
      { status: 502 }
    );
  }
}
