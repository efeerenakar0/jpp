import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { phone, message, messageId } = await req.json();

    if (!phone || !message) {
      return NextResponse.json({ error: 'Phone and message are required' }, { status: 400 });
    }

    // Clean up phone number
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Send via Meta WhatsApp Cloud API
    const metaResponse = await sendMetaWhatsAppMessage({
      to: cleanPhone,
      text: message
    });

    // If approving an existing DRAFT message, update its status
    if (messageId) {
      const updatedDraft = await prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: {
          status: 'SENT',
          content: message
        }
      });
      return NextResponse.json({ success: true, message: updatedDraft, metaResponse });
    }

    // Otherwise, create a new SENT message record in DB
    const newMessage = await prisma.whatsAppMessage.create({
      data: {
        phone: cleanPhone,
        fromMe: true,
        content: message,
        status: 'SENT'
      }
    });

    return NextResponse.json({ success: true, message: newMessage, metaResponse });
  } catch (error: any) {
    console.error('[WhatsApp Send Route Error]:', error);
    return NextResponse.json({ error: error.message || 'Failed to send message' }, { status: 500 });
  }
}
