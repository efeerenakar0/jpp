import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp';
import { callAI, PROMPTS } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { conversationId, message } = body;

    if (!conversationId || !message) {
      return NextResponse.json({ error: 'Conversation ID and message are required' }, { status: 400 });
    }

    let conversation: any = null;
    try {
      conversation = await prisma.customerConversation.findUnique({
        where: { id: conversationId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });
    } catch (e) {
      console.warn('[Assistant Chat DB Warning]: DB not connected, using fallback mode');
    }

    const customerPhone = conversation?.customerPhone || '';

    // 1. Send via Meta WhatsApp Cloud API if phone is attached
    if (customerPhone && customerPhone.replace(/[^0-9]/g, '').length >= 10) {
      console.log(`[Assistant Direct Chat] Sending real WhatsApp API message to ${customerPhone}: ${message}`);
      
      let metaResult: any = null;
      try {
        metaResult = await sendMetaWhatsAppMessage({
          to: customerPhone,
          text: message
        });
      } catch (metaErr: any) {
        console.error('[Assistant Direct Chat Meta Error]:', metaErr);
      }

      const assistantMsgRecord = {
        id: `msg_sent_${Date.now()}`,
        conversationId,
        role: 'assistant',
        content: message,
        createdAt: new Date().toISOString()
      };

      // Try saving to DB if connected
      try {
        await prisma.conversationMessage.create({
          data: {
            conversationId,
            role: 'assistant',
            content: message,
            metadata: JSON.stringify({ sentViaMetaApi: true, metaResult })
          }
        });
      } catch (e) {}

      return NextResponse.json({
        success: true,
        sentToWhatsApp: true,
        messageRecord: assistantMsgRecord
      });
    }

    // 2. SIMULATION / TEST CHAT: Run Gemini AI
    let companyName = 'Jasmine Group';
    let customGeminiKey: string | undefined = undefined;

    try {
      const waConfig = await prisma.whatsAppConfig.findUnique({ where: { id: 'default' } });
      if (waConfig?.companyName) companyName = waConfig.companyName;
      if (waConfig?.geminiApiKey) customGeminiKey = waConfig.geminiApiKey;
    } catch (e) {}

    const systemPrompt = PROMPTS.customerAssistant({
      companyName: companyName,
      availableListings: 'Alanya Mahmutlar, Kargıcak ve Kleopatra projeleri',
      conversationHistory: `Müşteri: ${message}`,
      customerMessage: message
    });

    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: message }
    ];

    let replyText = '';

    try {
      const aiResponse = await callAI(aiMessages, 'assistant', customGeminiKey);
      if (aiResponse?.content && typeof aiResponse.content === 'string' && aiResponse.content.trim().length > 0) {
        replyText = aiResponse.content.trim();
      }
    } catch (e: any) {
      console.error('[Chat Route AI Call Warning]:', e);
      replyText = "Merhaba! Ben Jasmine Group emlak ve yatırım uzmanı Efe. Size Alanya projelerimiz, kiralık ve satılık daire seçeneklerimiz hakkında nasıl yardımcı olabilirim?";
    }

    if (!replyText || replyText.trim().length === 0) {
      replyText = "Merhaba! Ben Jasmine Group emlak ve yatırım uzmanı Efe. Size Alanya projelerimiz, kiralık ve satılık daire seçeneklerimiz hakkında nasıl yardımcı olabilirim?";
    }

    const assistantMsgRecord = {
      id: `msg_ai_${Date.now()}`,
      conversationId,
      role: 'assistant',
      content: replyText,
      createdAt: new Date().toISOString()
    };

    // Try saving AI message to DB if connected
    try {
      await prisma.conversationMessage.create({
        data: {
          conversationId,
          role: 'customer',
          content: message
        }
      });

      await prisma.conversationMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: replyText
        }
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      sentToWhatsApp: false,
      reply: replyText,
      intent: 'INVESTMENT',
      suggestedListings: [],
      isAppointmentRequest: false,
      messageRecord: assistantMsgRecord
    });

  } catch (error: any) {
    console.error('Error in chat route:', error);
    return NextResponse.json({
      success: true,
      reply: `⚠️ [Sistem Uyarısı]: İstek işlenirken hata oluştu: ${error.message}`,
      messageRecord: {
        id: `msg_fallback_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ [Sistem Uyarısı]: ${error.message}`,
        createdAt: new Date().toISOString()
      }
    });
  }
}
