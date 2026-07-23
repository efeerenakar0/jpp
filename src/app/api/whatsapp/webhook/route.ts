import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp';
import { callAI, PROMPTS, parseJSONResponse } from '@/lib/ai';
import { addIncomingCustomerMessage, addAssistantMessageToStore } from '@/lib/conversation-store';

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
 * Synchronous Worker for Incoming WhatsApp Messages
 * MUST be awaited synchronously in Serverless environments (Netlify/Vercel) so Node process is not frozen before API execution.
 */
async function processIncomingWhatsAppMessage(fromPhone: string, textBody: string, msgId?: string, contactName?: string) {
  console.log(`[Meta Webhook Worker] Processing message from ${fromPhone}: ${textBody}`);

  // 1. Add to shared conversation store for CRM UI instant display
  const conv = addIncomingCustomerMessage(fromPhone, textBody, contactName);

  // Try saving to Prisma DB if database is connected
  try {
    await prisma.whatsAppMessage.create({
      data: {
        phone: fromPhone,
        fromMe: false,
        content: textBody,
        status: 'SENT'
      }
    });

    let dbConv = await prisma.customerConversation.findFirst({
      where: { customerPhone: fromPhone }
    });

    if (dbConv) {
      await prisma.customerConversation.update({
        where: { id: dbConv.id },
        data: { summary: textBody, updatedAt: new Date() }
      });
      await prisma.conversationMessage.create({
        data: { conversationId: dbConv.id, role: 'customer', content: textBody }
      });
    } else {
      await prisma.customerConversation.create({
        data: {
          customerName: contactName || fromPhone,
          customerPhone: fromPhone,
          channel: 'WHATSAPP',
          summary: textBody,
          messages: { create: { role: 'customer', content: textBody } }
        }
      });
    }
  } catch (dbErr) {
    console.warn('[Meta Webhook DB Save Warning]: Could not persist to DB, saved to shared store', dbErr);
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
      availableListings: `${serviceCity} deniz manzaralı lüks daire ve villa projeleri`,
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
  } catch (aiErr) {
    console.error('[Meta Webhook AI Error]:', aiErr);
    aiReplyText = `Merhaba! Jasmine Group olarak Alanya bölgesindeki lüks gayrimenkul projelerimiz hakkında size yardımcı olmaktan mutluluk duyarız. Detaylı bilgi için size nasıl yardımcı olabilirim?`;
  }

  // Add AI reply to shared conversation store for CRM UI
  addAssistantMessageToStore(conv.id, aiReplyText);

  // Try saving AI response to Prisma DB
  try {
    await prisma.conversationMessage.create({
      data: {
        conversationId: conv.id,
        role: 'assistant',
        content: aiReplyText
      }
    });
  } catch (e) {}

  // 3. ALWAYS Send AI Reply back to Customer via Meta WhatsApp Cloud API
  try {
    console.log(`[Meta Webhook Worker] Sending WhatsApp Cloud API response to ${fromPhone}...`);
    const metaRes = await sendMetaWhatsAppMessage({
      to: fromPhone,
      text: aiReplyText
    });
    console.log(`[Meta Webhook Worker] Successfully sent response to ${fromPhone}:`, metaRes);
  } catch (sendErr: any) {
    console.error('[Meta Webhook Send Error]:', sendErr?.message || sendErr);
  }
}

/**
 * Meta Incoming Messages & Events Handler (POST)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[Meta Webhook Incoming POST Payload]:', JSON.stringify(body));

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

              // AWAIT SYNCHRONOUSLY to prevent Netlify Serverless Function from freezing before completion!
              await processIncomingWhatsAppMessage(fromPhone, textBody, msgId, contactName);
            }
          }
        }
      }

      // Return HTTP 200 OK Response to Meta Webhook Server
      return NextResponse.json({ status: 'EVENT_RECEIVED' }, { status: 200 });
    }

    return NextResponse.json({ error: 'Not a WhatsApp event' }, { status: 404 });
  } catch (error: any) {
    console.error('[Meta Webhook Error]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
