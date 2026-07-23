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

    // Load conversation and history
    const conversation = await prisma.customerConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const customerPhone = conversation.customerPhone;

    // REAL WHATSAPP DIRECT MESSAGE: Send via Meta WhatsApp Cloud API if recipient phone exists
    if (customerPhone && customerPhone.replace(/[^0-9]/g, '').length >= 10) {
      console.log(`[Assistant Direct Chat] Sending real WhatsApp API message to ${customerPhone}: ${message}`);
      
      // 1. Send via Meta Cloud API
      let metaResult: any = null;
      try {
        metaResult = await sendMetaWhatsAppMessage({
          to: customerPhone,
          text: message
        });
      } catch (metaErr: any) {
        console.error('[Assistant Direct Chat Meta Error]:', metaErr);
        // Continue saving to DB even if Meta credentials are not configured yet
      }

      // 2. Save Outgoing Assistant Message to DB (ConversationMessage)
      const assistantMessage = await prisma.conversationMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: message,
          metadata: JSON.stringify({ sentViaMetaApi: true, metaResult })
        }
      });

      // 3. Also Save to WhatsAppMessage table (CRM sync)
      await prisma.whatsAppMessage.create({
        data: {
          phone: customerPhone,
          fromMe: true,
          content: message,
          status: 'SENT'
        }
      });

      // 4. Update Conversation Summary & Timestamp
      await prisma.customerConversation.update({
        where: { id: conversationId },
        data: {
          summary: `Gönderilen: ${message.substring(0, 60)}...`,
          updatedAt: new Date()
        }
      });

      return NextResponse.json({
        success: true,
        sentToWhatsApp: true,
        messageRecord: assistantMessage
      });
    }

    // SIMULATION / TEST CHAT: If no phone number is attached, run Gemini AI test simulation
    console.log(`[Assistant Chat Simulation] Running test simulation for ${conversation.customerName}`);

    // Save customer test message
    await prisma.conversationMessage.create({
      data: {
        conversationId,
        role: 'customer',
        content: message
      }
    });

    // Load active projects for AI context
    const activeProjects = await prisma.project.findMany({
      where: { published: true },
      select: { id: true, name: true, location: true, price: true, shortDescription: true }
    });

    const listingsContext = activeProjects.map(p => 
      `ID: ${p.id} | Proje: ${p.name} | Konum: ${p.location} | Fiyat: ${p.price}\nDetay: ${p.shortDescription}`
    ).join('\n\n');

    const historyContext = conversation.messages.map(m => 
      `${m.role === 'customer' ? 'Müşteri' : 'Asistan'}: ${m.content}`
    ).join('\n');

    // Load dynamic AI & Company Settings from database
    const waConfig = await prisma.whatsAppConfig.findUnique({ where: { id: 'default' } });
    const companyName = waConfig?.companyName || 'Jasmine Group';
    const customGeminiKey = waConfig?.geminiApiKey || undefined;

    const systemPrompt = PROMPTS.customerAssistant({
      companyName: companyName,
      availableListings: listingsContext || 'Şu an aktif ilan bulunmuyor.',
      conversationHistory: historyContext,
      customerMessage: message
    });

    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: message }
    ];

    const aiResponse = await callAI(aiMessages, 'assistant', customGeminiKey);
    
    let parsed: any = null;
    if (!aiResponse.isMock) {
      parsed = parseJSONResponse(aiResponse.content);
    } else {
      parsed = JSON.parse(aiResponse.content);
    }

    if (!parsed) {
      parsed = {
        reply: `Harika! ${companyName} olarak size Alanya bölgesindeki dairelerimiz hakkında yardımcı olmaktan mutluluk duyarım.`,
        detectedIntent: "UNKNOWN",
        suggestedListings: [],
        isAppointmentRequest: false
      };
    }

    // Save AI message
    const assistantMessage = await prisma.conversationMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content: parsed.reply,
        metadata: JSON.stringify({ suggestedListings: parsed.suggestedListings })
      }
    });

    // Update conversation intent and summary
    if (parsed.detectedIntent && parsed.detectedIntent !== conversation.intent) {
      await prisma.customerConversation.update({
        where: { id: conversationId },
        data: { 
          intent: parsed.detectedIntent as any,
          summary: `Son mesaj: ${message.substring(0, 50)}...` 
        }
      });
    }

    return NextResponse.json({
      success: true,
      sentToWhatsApp: false,
      reply: parsed.reply,
      intent: parsed.detectedIntent,
      suggestedListings: parsed.suggestedListings,
      isAppointmentRequest: parsed.isAppointmentRequest,
      messageRecord: assistantMessage
    });

  } catch (error) {
    console.error('Error in chat route:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
