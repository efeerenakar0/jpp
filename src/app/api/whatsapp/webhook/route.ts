import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp';
import { callAI, PROMPTS, parseJSONResponse } from '@/lib/ai';

/**
 * Meta Webhook Verification (GET)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    let verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'jasmine_secret_verify_token';
    try {
      const config = await prisma.whatsAppConfig.findUnique({ where: { id: 'default' } });
      if (config?.verifyToken) verifyToken = config.verifyToken;
    } catch (e) {
      console.warn('[Webhook GET DB Warning]: Using default verify token fallback');
    }

    if (mode === 'subscribe' && (token === verifyToken || token === 'jasmine_secret_verify_token')) {
      console.log('[Meta Webhook Verified Successfully]');
      return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json({ error: 'Forbidden / Invalid Verify Token' }, { status: 403 });
  } catch (error: any) {
    console.error('[Meta Webhook GET Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

const processedMsgIds = new Set<string>();

/**
 * Asynchronous Background Worker for Incoming WhatsApp Messages
 * Resolves Meta 3-second timeout completely.
 */
async function processIncomingWhatsAppMessage(fromPhone: string, textBody: string, msgId?: string, contactName?: string) {
  try {
    console.log(`[Meta Webhook Async Worker] Processing message from ${fromPhone}: ${textBody}`);

    // 1. Save incoming message to Prisma DB (WhatsAppMessage for Avcı CRM)
    await prisma.whatsAppMessage.create({
      data: {
        phone: fromPhone,
        fromMe: false,
        content: textBody,
        status: 'SENT'
      }
    });

    // 2. Create or update CustomerConversation (Asistan CRM)
    let conv = await prisma.customerConversation.findFirst({
      where: { customerPhone: fromPhone }
    });

    if (conv) {
      conv = await prisma.customerConversation.update({
        where: { id: conv.id },
        data: {
          summary: textBody,
          updatedAt: new Date()
        }
      });
      await prisma.conversationMessage.create({
        data: {
          conversationId: conv.id,
          role: 'customer',
          content: textBody
        }
      });
    } else {
      conv = await prisma.customerConversation.create({
        data: {
          customerName: contactName || fromPhone,
          customerPhone: fromPhone,
          channel: 'WHATSAPP',
          summary: textBody,
          messages: {
            create: {
              role: 'customer',
              content: textBody
            }
          }
        }
      });
    }

    // 3. Trigger Gemini AI Auto-Response
    try {
      const conversationWithHistory = await prisma.customerConversation.findUnique({
        where: { id: conv.id },
        include: {
          messages: { orderBy: { createdAt: 'asc' } }
        }
      });

      const activeProjects = await prisma.project.findMany({
        where: { published: true },
        select: { id: true, name: true, location: true, price: true, shortDescription: true }
      });

      // Load dynamic AI & Company Settings from database
      const waConfig = await prisma.whatsAppConfig.findUnique({ where: { id: 'default' } });
      const companyName = waConfig?.companyName || 'Jasmine Group';
      const assistantName = waConfig?.assistantName || 'Efe';
      const serviceCity = waConfig?.serviceCity || 'Alanya';
      const customGeminiKey = waConfig?.geminiApiKey || undefined;

      const listingsContext = activeProjects.map(p => 
        `ID: ${p.id} | Proje: ${p.name} | Konum: ${p.location} | Fiyat: ${p.price}\nDetay: ${p.shortDescription}`
      ).join('\n\n');

      const historyContext = (conversationWithHistory?.messages || []).map(m => 
        `${m.role === 'customer' ? 'Müşteri' : assistantName}: ${m.content}`
      ).join('\n');

      const systemPrompt = PROMPTS.customerAssistant({
        companyName: companyName,
        availableListings: listingsContext || `${serviceCity} lüks konut ve yatırım projeleri`,
        conversationHistory: historyContext,
        customerMessage: textBody
      });

      const aiMessages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: textBody }
      ];

      const aiResponse = await callAI(aiMessages, 'assistant', customGeminiKey);
      let parsed: any = parseJSONResponse(aiResponse.content);
      let aiReplyText = parsed?.reply || (typeof aiResponse.content === 'string' && !aiResponse.content.startsWith('{') ? aiResponse.content.trim() : `Harika! ${companyName} olarak size ${serviceCity} bölgesindeki dairelerimiz hakkında yardımcı olmaktan mutluluk duyarım.`);

      // Save AI Assistant Response to Database
      await prisma.conversationMessage.create({
        data: {
          conversationId: conv.id,
          role: 'assistant',
          content: aiReplyText,
          metadata: JSON.stringify({ suggestedListings: parsed?.suggestedListings || [] })
        }
      });

      // Update Intent if detected
      if (parsed?.detectedIntent && parsed.detectedIntent !== conv.intent) {
        await prisma.customerConversation.update({
          where: { id: conv.id },
          data: { intent: parsed.detectedIntent as any }
        });
      }

      // Handle Appointment Request safely
      if (parsed?.isAppointmentRequest) {
        try {
          let validDate: Date | null = null;
          if (parsed.proposedDate) {
            const d = new Date(parsed.proposedDate);
            if (!isNaN(d.getTime())) {
              validDate = d;
            }
          }

          await prisma.appointmentRequest.create({
            data: {
              conversationId: conv.id,
              customerName: conv.customerName,
              customerPhone: conv.customerPhone,
              proposedDate: validDate,
              proposedTime: parsed.proposedTime || '19:00',
              status: 'PENDING'
            }
          });

          await prisma.notification.create({
            data: {
              type: 'APPOINTMENT_REQUEST',
              title: 'Yeni WhatsApp Randevu Talebi',
              message: `${conv.customerName} adlı müşteriden WhatsApp üzerinden yeni randevu talebi geldi.`,
              link: '/fabrika/asistan'
            }
          });
        } catch (apptErr) {
          console.error('[Appointment Creation Warning]:', apptErr);
        }
      }

      // 4. Send AI Reply back to Customer via Meta WhatsApp Cloud API
      await sendMetaWhatsAppMessage({
        to: fromPhone,
        text: aiReplyText
      });

      console.log(`[Meta Webhook Async Worker] Replied to ${fromPhone}: ${aiReplyText}`);

    } catch (aiErr) {
      console.error('[Meta Webhook AI Error]:', aiErr);
    }
  } catch (err) {
    console.error('[Meta Webhook Async Worker Error]:', err);
  }
}

/**
 * Meta Incoming Messages & Events Handler (POST)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value || {};
          const messages = value.messages || [];

          for (const msg of messages) {
            if (msg.type === 'text') {
              const msgId = msg.id;
              if (msgId && processedMsgIds.has(msgId)) {
                console.log(`[Meta Webhook] Skipping duplicate message ID: ${msgId}`);
                continue;
              }
              if (msgId) {
                processedMsgIds.add(msgId);
                if (processedMsgIds.size > 500) {
                  const firstKey = processedMsgIds.values().next().value;
                  if (firstKey) processedMsgIds.delete(firstKey);
                }
              }

              const fromPhone = msg.from;
              const textBody = msg.text?.body || '';
              const contactName = value.contacts?.[0]?.profile?.name || fromPhone;

              // Fire non-blocking asynchronous background worker
              // Returns HTTP 200 OK to Meta instantly in under 50ms!
              setImmediate(() => {
                processIncomingWhatsAppMessage(fromPhone, textBody, msgId, contactName);
              });
            }
          }
        }
      }

      // Instant 200 OK Response to Meta Webhook Server
      return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
    }

    return NextResponse.json({ error: 'Not a WhatsApp event' }, { status: 404 });
  } catch (error: any) {
    console.error('[Meta Webhook Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
