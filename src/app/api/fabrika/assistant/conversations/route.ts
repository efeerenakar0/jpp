import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Fallback in-memory conversations for Netlify when DB is not configured
let inMemoryConversations: any[] = [
  {
    id: 'demo_conv_1',
    customerName: 'Ahmet Yılmaz (Örnek Müşteri)',
    customerPhone: '905321234567',
    customerEmail: 'ahmet@example.com',
    channel: 'WHATSAPP',
    intent: 'INVESTMENT',
    summary: 'Alanya Mahmutlar bölgesinde deniz manzaralı 2+1 yatırım projesi sorguladı.',
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    messages: [
      {
        id: 'msg_1',
        conversationId: 'demo_conv_1',
        role: 'customer',
        content: 'Merhaba, Alanya Mahmutlar projenizde 2+1 daire fiyatları nedir?',
        createdAt: new Date(Date.now() - 3600000).toISOString()
      },
      {
        id: 'msg_2',
        conversationId: 'demo_conv_1',
        role: 'assistant',
        content: 'Merhaba Ahmet Bey! Jasmine View Life projemizde deniz manzaralı 2+1 dairelerimiz €145.000\'den başlamaktadır. Size detaylı sunum dosyasını aktarmamı ister misiniz?',
        createdAt: new Date(Date.now() - 3500000).toISOString()
      }
    ],
    _count: { messages: 2 }
  }
];

export async function GET() {
  try {
    const conversations = await prisma.customerConversation.findMany({
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

    if (conversations && conversations.length > 0) {
      return NextResponse.json(conversations);
    }

    return NextResponse.json(inMemoryConversations);
  } catch (error) {
    console.warn('[Conversations GET DB Warning]: Falling back to memory store', error);
    return NextResponse.json(inMemoryConversations);
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
    } catch (dbErr) {
      console.warn('[Conversations POST DB Warning]: Saving to in-memory fallback', dbErr);
    }

    if (!conversation) {
      conversation = {
        id: `conv_${Date.now()}`,
        customerName,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        channel: channel || 'WHATSAPP',
        intent: 'UNKNOWN',
        summary: 'Yeni sohbet başlatıldı',
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        messages: [],
        _count: { messages: 0 }
      };
      inMemoryConversations.unshift(conversation);
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
    } catch (dbErr) {
      console.warn('[Conversations DELETE DB Warning]: Removing from memory store', dbErr);
    }

    inMemoryConversations = inMemoryConversations.filter(c => c.id !== id);

    return NextResponse.json({ success: true, message: 'Sohbet ve tüm geçmişi silindi!' });
  } catch (error: any) {
    return NextResponse.json({ success: true, message: 'Sohbet hafızadan silindi' });
  }
}
