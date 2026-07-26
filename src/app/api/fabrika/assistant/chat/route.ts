import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  saveOutgoingConversationMessage,
  sendAssistantWhatsAppMessage,
  WhatsAppTemplateRequiredError,
} from '@/lib/assistant-messaging';

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
      try {
        const delivery = await sendAssistantWhatsAppMessage({
          to: customerPhone,
          text: message,
          lastCustomerMessageAt: conversation.lastCustomerMessageAt,
        });
        const savedMessage = await saveOutgoingConversationMessage({
          conversationId,
          content: message,
          delivery,
          role: 'patron',
        },
        );
        await prisma.customerConversation.update({
          where: { id: conversationId },
          data: { summary: message },
        });

        return NextResponse.json({
          success: true,
          sentToWhatsApp: true,
          messageRecord: savedMessage,
        });
      } catch (error) {
        console.error('[Assistant WhatsApp Send Error]:', error);
        return NextResponse.json(
          {
            error:
              error instanceof WhatsAppTemplateRequiredError ||
              error instanceof Error
                ? error.message
                : 'Mesaj WhatsApp’a gönderilemedi.',
          },
          { status: error instanceof WhatsAppTemplateRequiredError ? 409 : 502 }
        );
      }
    }

    const [savedMessage] = await prisma.$transaction([
      prisma.conversationMessage.create({
        data: {
          conversationId,
          role: 'patron',
          content: message,
          deliveryStatus: 'NOT_APPLICABLE',
        },
      }),
      prisma.customerConversation.update({
        where: { id: conversationId },
        data: { summary: message },
      }),
    ]);

    return NextResponse.json({
      success: true,
      sentToWhatsApp: false,
      messageRecord: savedMessage,
    });
  } catch (error) {
    console.error('[Assistant Chat Error]:', error);
    return NextResponse.json(
      { error: 'Asistan mesajı işleyemedi.' },
      { status: 502 }
    );
  }
}
