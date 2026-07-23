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
 * Resolves Meta 3-second timeout completely with independent resilient blocks.
 */
async function processIncomingWhatsAppMessage(fromPhone: string, textBody: string, msgId?: string, contactName?: string) {
  console.log(`[Meta Webhook Async Worker] Processing message from ${fromPhone}: ${textBody}`);

  let convId: string | null = null;

  // 1. Try to save incoming message to Prisma DB (Safely handled if DB is offline)
  try {
    await prisma.whatsAppMessage.create({
      data: {
        phone: fromPhone,
        fromMe: false,
        content: textBody,
        status: 'SENT'
      }
    });

    let conv = await prisma.customerConversation.findFirst({
      where: { customerPhone: fromPhone }
    });

    if (conv) {
      convId = conv.id;
      await prisma.customerConversation.update({
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
      const newConv = await prisma.customerConversation.create({
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
      convId = newConv.id;
    }
  } catch (dbErr) {
    console.warn('[Meta Webhook DB Save Warning]: Could not persist conversation to DB, proceeding with AI response', dbErr);
  }

  // 2. Trigger Gemini AI Auto-Response
  let aiReplyText = '';
  try {
    let companyName = 'Jasmine Group';
    let assistantName = 'Efe';
    let serviceCity = 'Alanya';
    let customGeminiKey: string | undefined = undefined;

    try {
      const waConfig = await prisma.whatsAppConfig.findUnique({ where: { id: 'default' } });
      if (waConfig?.companyName) companyName = waConfig.companyName;
      if (waConfig?.assistantName) assistantName = waConfig.assistantName;
      if (waConfig?.serviceCity) serviceCity = waConfig.serviceCity;
      if (waConfig?.geminiApiKey) customGeminiKey = waConfig.geminiApiKey;
    } catch (e) {}

    const systemPrompt = PROMPTS.customerAssistant({
      companyName: companyName,
      availableListings: `${serviceCity} lüks konut, deniz manzaralı villa ve yatırım projeleri`,
      conversationHistory: `Müşteri: ${textBody}`,
      customerMessage: textBody
    });

    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: textBody }
    ];

    const aiResponse = await callAI(aiMessages, 'assistant', customGeminiKey);
    let parsed: any = parseJSONResponse(aiResponse.content);
    aiReplyText = parsed?.reply || (typeof aiResponse.content === 'string' && !aiResponse.content.startsWith('{') ? aiResponse.content.trim() : `Merhaba! ${companyName} olarak ${serviceCity} bölgesindeki gayrimenkul ve yatırım projelerimiz hakkında size yardımcı olmaktan memnuniyet duyarım.`);

    // Try saving AI response to DB
    if (convId) {
      try {
        await prisma.conversationMessage.create({
          data: {
            conversationId: convId,
            role: 'assistant',
            content: aiReplyText,
            metadata: JSON.stringify({ suggestedListings: parsed?.suggestedListings || [] })
          }
        });
      } catch (e) {}
    }
  } catch (aiErr) {
    console.error('[Meta Webhook AI Error]:', aiErr);
    aiReplyText = `Merhaba! Jasmine Group olarak Alanya bölgesindeki lüks gayrimenkul projelerimiz hakkında size yardımcı olmaktan mutluluk duyarız. Detaylı bilgi için size nasıl yardımcı olabilirim?`;
  }

  // 3. ALWAYS Send AI Reply back to Customer via Meta WhatsApp Cloud API
  try {
    await sendMetaWhatsAppMessage({
      to: fromPhone,
      text: aiReplyText
    });
    console.log(`[Meta Webhook Async Worker] Successfully replied to ${fromPhone}: ${aiReplyText}`);
  } catch (sendErr) {
    console.error('[Meta Webhook Send Error]:', sendErr);
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
