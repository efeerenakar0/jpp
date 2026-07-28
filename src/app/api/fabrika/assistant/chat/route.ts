import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  saveOutgoingConversationMessage,
  sendAssistantWhatsAppMessage,
} from '@/lib/assistant-messaging';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
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

    const conversation = await prisma.customerConversation.findFirst({
      where: {
        id: conversationId,
        companyAccountId: principal.account.id,
      },
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
          companyAccountId: principal.account.id,
          to: customerPhone,
          text: message,
          lastCustomerMessageAt: conversation.lastCustomerMessageAt,
          conversationId,
          createdByType: principal.type,
          createdById:
            principal.type === 'EMPLOYEE' ? principal.member.id : principal.account.id,
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
          sentToWhatsApp: delivery.deliveryStatus === 'SENT',
          queued: delivery.deliveryStatus === 'QUEUED',
          messageRecord: savedMessage,
        });
      } catch (error) {
        console.error('[Assistant WhatsApp Send Error]:', error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : 'Mesaj WhatsApp’a gönderilemedi.',
          },
          { status: 502 }
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
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('[Assistant Chat Error]:', error);
    return NextResponse.json(
      { error: 'Asistan mesajı işleyemedi.' },
      { status: 502 }
    );
  }
}
