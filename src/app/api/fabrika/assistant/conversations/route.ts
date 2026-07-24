import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateCredentialsCache } from '@/lib/whatsapp';
import { getConversationsStore, addIncomingCustomerMessage, deleteConversationFromStore, isBannedConversation } from '@/lib/conversation-store';

export async function GET(req: Request) {
  try {
    const headerToken = req.headers.get('x-meta-token');
    const headerPhoneId = req.headers.get('x-meta-phone-id');
    if (headerToken && headerPhoneId) {
      updateCredentialsCache({ token: headerToken, phoneNumberId: headerPhoneId, businessAccountId: '' });
    }

    let dbConversations: any[] = [];
    try {
      dbConversations = await prisma.customerConversation.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { messages: true }
          }
        }
      });
    } catch (e) {}

    const memoryConversations = getConversationsStore();

    const mergedMap = new Map<string, any>();
    if (dbConversations && dbConversations.length > 0) {
      dbConversations.filter(c => !isBannedConversation(c)).forEach(c => mergedMap.set(c.id, c));
    }

    memoryConversations.filter(c => !isBannedConversation(c)).forEach(c => {
      if (!mergedMap.has(c.id)) {
        mergedMap.set(c.id, c);
      }
    });

    const result = Array.from(mergedMap.values()).filter(c => !isBannedConversation(c));

    return NextResponse.json(result);
  } catch (error) {
    console.warn('[Conversations GET Warning]: Returning shared memory store', error);
    const fallback = getConversationsStore().filter(c => !isBannedConversation(c));
    return NextResponse.json(fallback);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerName, customerPhone, customerEmail, channel } = body;

    if (!customerName) {
      return NextResponse.json({ error: 'Müşteri adı gereklidir' }, { status: 400 });
    }

    let conversation = null;
    try {
      conversation = await prisma.customerConversation.create({
        data: {
          customerName,
          customerPhone: customerPhone || null,
          customerEmail: customerEmail || null,
          channel: channel || 'WHATSAPP',
        }
      });
    } catch (dbErr) {}

    if (!conversation) {
      conversation = addIncomingCustomerMessage(customerPhone || `90555${Math.floor(1000000 + Math.random() * 9000000)}`, 'Yeni sohbet başlatıldı', customerName);
    }

    return NextResponse.json(conversation);
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Sohbet oluşturulamadı: ' + error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Sohbet ID gereklidir' }, { status: 400 });
    }

    try {
      await prisma.conversationMessage.deleteMany({ where: { conversationId: id } });
      await prisma.appointmentRequest.deleteMany({ where: { conversationId: id } });
      await prisma.customerConversation.delete({ where: { id } });
    } catch (dbErr) {}

    deleteConversationFromStore(id);

    return NextResponse.json({ success: true, message: 'Sohbet ve tüm geçmişi silindi!' });
  } catch (error: any) {
    return NextResponse.json({ success: true, message: 'Sohbet silindi' });
  }
}
