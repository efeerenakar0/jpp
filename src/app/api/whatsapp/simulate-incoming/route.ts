import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Simulate an incoming Meta WhatsApp Message for instant UI testing
 */
export async function POST(req: Request) {
  try {
    const { phone = '905321234567', name = 'Test Müşteri', message = 'Merhaba, Alanya projeleri hakkında bilgi alabilir miyim?' } = await req.json();

    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // 1. Save to WhatsAppMessage (CRM Avcı)
    const waMsg = await prisma.whatsAppMessage.create({
      data: {
        phone: cleanPhone,
        fromMe: false,
        content: message,
        status: 'SENT'
      }
    });

    // 2. Create or update CustomerConversation (Asistan CRM)
    let conv = await prisma.customerConversation.findFirst({
      where: { customerPhone: cleanPhone }
    });

    if (conv) {
      conv = await prisma.customerConversation.update({
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
      conv = await prisma.customerConversation.create({
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
    }

    // 3. Trigger Gemini AI Auto-Response
    let aiReplyText = "Merhaba! Size Alanya ve Mahmutlar kiralık/satılık ilanlarımız hakkında nasıl yardımcı olabilirim?";
    try {
      const { callAI, PROMPTS, parseJSONResponse } = await import('@/lib/ai');
      const { sendMetaWhatsAppMessage } = await import('@/lib/whatsapp');

      const conversationWithHistory = await prisma.customerConversation.findUnique({
        where: { id: conv.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } }
      });

      const activeProjects = await prisma.project.findMany({
        where: { published: true },
        select: { id: true, name: true, location: true, price: true, shortDescription: true }
      });

      const listingsContext = activeProjects.map(p => 
        `ID: ${p.id} | Proje: ${p.name} | Konum: ${p.location} | Fiyat: ${p.price}\nDetay: ${p.shortDescription}`
      ).join('\n\n');

      const historyContext = (conversationWithHistory?.messages || []).map(m => 
        `${m.role === 'customer' ? 'Müşteri' : 'Asistan'}: ${m.content}`
      ).join('\n');

      const systemPrompt = PROMPTS.customerAssistant({
        companyName: 'Jasmine Group',
        availableListings: listingsContext || 'Alanya lüks konut ve kiralık/satılık gayrimenkul projeleri',
        conversationHistory: historyContext,
        customerMessage: message
      });

      const aiMessages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: message }
      ];

      const aiResponse = await callAI(aiMessages, 'assistant');
      let parsed: any = parseJSONResponse(aiResponse.content);
      aiReplyText = parsed?.reply || (typeof aiResponse.content === 'string' && !aiResponse.content.startsWith('{') ? aiResponse.content : aiReplyText);

      // Save AI Assistant Response to Database
      await prisma.conversationMessage.create({
        data: {
          conversationId: conv.id,
          role: 'assistant',
          content: aiReplyText,
          metadata: JSON.stringify({ suggestedListings: parsed?.suggestedListings || [] })
        }
      });

      // Send to real WhatsApp phone
      if (cleanPhone.length >= 10) {
        await sendMetaWhatsAppMessage({
          to: cleanPhone,
          text: aiReplyText
        }).catch(err => console.error('[Simulate Send Error]:', err));
      }
    } catch (aiErr) {
      console.error('[Simulate AI Error]:', aiErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Test mesajı ve Yapay Zeka yanıtı başarıyla işlendi ve WhatsApp\'a iletildi!',
      conversation: conv,
      whatsAppMessage: waMsg,
      aiReply: aiReplyText
    });
  } catch (error: any) {
    console.error('Simulate incoming error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
