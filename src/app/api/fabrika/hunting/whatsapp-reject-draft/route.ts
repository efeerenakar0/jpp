import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { messageId } = await req.json();
    if (!messageId) return NextResponse.json({ error: 'Message ID required' }, { status: 400 });

    await prisma.whatsAppMessage.delete({
      where: { id: messageId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Draft cancel error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
