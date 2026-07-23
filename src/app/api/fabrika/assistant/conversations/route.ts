import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

    return NextResponse.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerName, customerPhone, customerEmail, channel } = body;

    if (!customerName) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const conversation = await prisma.customerConversation.create({
      data: {
        customerName,
        customerPhone,
        customerEmail,
        channel: channel || 'WEB_CHAT',
      }
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    // Delete related messages first
    await prisma.conversationMessage.deleteMany({
      where: { conversationId: id }
    });

    // Delete related appointment requests if any
    await prisma.appointmentRequest.deleteMany({
      where: { conversationId: id }
    });

    // Delete conversation record
    await prisma.customerConversation.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'Sohbet ve tüm geçmişi başarıyla silindi!' });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Sohbet silinemedi: ' + error.message }, { status: 500 });
  }
}
