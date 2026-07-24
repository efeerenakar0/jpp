import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI, PROMPTS } from '@/lib/ai';

/**
 * Simulate an incoming Meta WhatsApp Message for instant UI testing
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = body.phone || body.customerPhone || '905321234567';
    const name = body.name || body.customerName || 'Test Müşteri';
    const message = body.message || 'Merhaba, Alanya projeleri hakkında bilgi alabilir miyim?';

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const hasValidDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql'));

    // 1. Save to WhatsAppMessage (CRM Avcı) if DB is connected
    if (hasValidDb) {
      try {
        await prisma.whatsAppMessage.create({
          data: {
            phone: cleanPhone,
            fromMe: false,
            content: message,
            status: 'SENT'
          }
        });
      } catch (e) {}
    }

    // 2. Create or update CustomerConversation (Asistan CRM)
    let convId = `conv_sim_${Date.now()}`;
    if (hasValidDb) {
      try {
        let conv = await prisma.customerConversation.findFirst({
          where: { customerPhone: cleanPhone }
        });

        if (conv) {
          convId = conv.id;
          await prisma.customerConversation.update({
            where: { id: conv.id },
            data: {
              summary: message,
              updatedAt: new Date()
            }
          });
          await prisma.conversationMessage.create({
            data: {
              conversationId: conv.id,
              role: 'customer',
              content: message
            }
          });
        } else {
          const newConv = await prisma.customerConversation.create({
            data: {
              customerName: name,
              customerPhone: cleanPhone,
              channel: 'WHATSAPP',
              summary: message,
              messages: {
                create: {
                  role: 'customer',
                  content: message
                }
              }
            }
          });
          convId = newConv.id;
        }
      } catch (e) {}
    }

    // 3. Trigger Groq AI Auto-Response
    const systemPrompt = PROMPTS.customerAssistant({
      companyName: 'Jasmine Group',
      availableListings: 'Mahmutlar 1+1, Oba 2+1, Kestel 1+1',
      conversationHistory: `Müşteri: ${message}`,
      customerMessage: message
    });

    const aiResponse = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]);

    const replyText = aiResponse.content;

    // Save AI reply to DB if connected
    if (hasValidDb) {
      try {
        await prisma.conversationMessage.create({
          data: {
            conversationId: convId,
            role: 'assistant',
            content: replyText
          }
        });
      } catch (e) {}
    }

    return NextResponse.json({
      success: true,
      sentToWhatsApp: false,
      reply: replyText,
      conversationId: convId
    });

  } catch (error: any) {
    console.error('[Simulate Incoming Error]:', error);
    return NextResponse.json({
      error: error?.message || 'Simulation error'
    }, { status: 500 });
  }
}
