import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp';
import { callAI, PROMPTS, parseJSONResponse } from '@/lib/ai';

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

    let aiResponse: any = null;
    let parsed: any = null;

    try {
      aiResponse = await callAI(aiMessages, 'assistant', customGeminiKey);
      parsed = parseJSONResponse(aiResponse.content);
    } catch (e) {
      console.error('[Chat Route AI Call Warning]:', e);
    }

    if (!parsed || !parsed.reply) {
      parsed = {
        reply: `Harika! ${companyName} olarak size Alanya bölgesindeki lüks projelerimiz hakkında bilgi vermekten mutluluk duyarım. Hangi tip bir gayrimenkul (1+1, 2+1 veya Villa) düşünüyorsunuz?`,
        detectedIntent: "INVESTMENT",
        suggestedListings: [],
        isAppointmentRequest: false
      };
    }

    const assistantMsgRecord = {
      id: `msg_ai_${Date.now()}`,
      conversationId,
      role: 'assistant',
      content: parsed.reply,
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
          content: parsed.reply,
          metadata: JSON.stringify({ suggestedListings: parsed.suggestedListings })
        }
      });
    } catch (e) {}

    return NextResponse.json({
      success: true,
      sentToWhatsApp: false,
      reply: parsed.reply,
      intent: parsed.detectedIntent || 'INVESTMENT',
      suggestedListings: parsed.suggestedListings || [],
      isAppointmentRequest: parsed.isAppointmentRequest || false,
      messageRecord: assistantMsgRecord
    });

  } catch (error: any) {
    console.error('Error in chat route:', error);
    return NextResponse.json({
      success: true,
      reply: 'Merhaba! Jasmine Group olarak Alanya gayrimenkul projelerimiz hakkında size yardımcı olmaktan memnuniyet duyarız.',
      messageRecord: {
        id: `msg_fallback_${Date.now()}`,
        role: 'assistant',
        content: 'Merhaba! Jasmine Group olarak Alanya gayrimenkul projelerimiz hakkında size yardımcı olmaktan memnuniyet duyarız.',
        createdAt: new Date().toISOString()
      }
    });
  }
}
