import { ConversationChannel } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function isConversationChannel(value: unknown): value is ConversationChannel {
  return value === 'WHATSAPP' || value === 'EMAIL' || value === 'WEB_CHAT';
}

export async function GET() {
  try {
    const conversations = await prisma.customerConversation.findMany({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('[Conversations GET Error]:', error);
    return NextResponse.json(
      { error: 'Sohbetler veritabanından alınamadı.' },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      channel?: ConversationChannel;
    };
    const customerName = body.customerName?.trim();

    if (!customerName) {
      return NextResponse.json(
        { error: 'Müşteri adı gerekli.' },
        { status: 400 }
      );
    }

    const conversation = await prisma.customerConversation.create({
      data: {
        customerName,
        customerPhone: body.customerPhone?.trim() || null,
        customerEmail: body.customerEmail?.trim() || null,
        channel: isConversationChannel(body.channel) ? body.channel : 'WHATSAPP',
      },
      include: {
        messages: true,
        _count: { select: { messages: true } },
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('[Conversations POST Error]:', error);
    return NextResponse.json(
      { error: 'Sohbet oluşturulamadı.' },
      { status: 503 }
    );
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Sohbet ID’si gerekli.' },
      { status: 400 }
    );
  }

  try {
    await prisma.customerConversation.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Sohbet arşivlendi.',
    });
  } catch (error) {
    console.error('[Conversations DELETE Error]:', error);
    return NextResponse.json(
      { error: 'Sohbet arşivlenemedi.' },
      { status: 503 }
    );
  }
}
