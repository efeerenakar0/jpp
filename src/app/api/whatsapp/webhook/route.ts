import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMetaWhatsAppMessage } from '@/lib/whatsapp';
import { callAI, PROMPTS, parseJSONResponse, generateSmartFallbackResponse } from '@/lib/ai';
import { addIncomingCustomerMessage, addAssistantMessageToStore } from '@/lib/conversation-store';

// Set to keep track of processed message IDs to prevent duplicates
const processedMsgIds = new Set<string>();

const REAL_ESTATE_CONTEXT = `
JASMINE GROUP ALANYA GÜNCEL PORTFÖY LİSTESİ:
1. State of Art Residence (Mahmutlar / SATILIK & İNŞAAT PROJESİ):
   - Tip: 1+1 (55m²) ve 2+1 (90m²)
   - Özellikler: Denize 400m, Açık/Kapalı Havuz, Sauna, Fitness, Türk Hamamı, 7/24 Güvenlik
   - Fiyat: 1+1 €85.000'den başlayan lansman fiyatları.

2. Jasmine View Life (Oba / LÜKS SATILIK):
   - Tip: 2+1 ve 3+1 Çatı Dubleks
   - Özellikler: Doğa Manzaralı, Özel Garaj, Yetişkin Havuzu, Çocuk Oyun Alanı
   - Fiyat: €140.000 - €250.000

3. Milano Pearl Residence (Kargıcak / DENİZE SIFIR PROJE):
   - Tip: 1+1, 2+1 ve 4+1 Villa
   - Özellikler: Özel Plaj Alanı, Sonsuzluk Havuzu, Spa Merkezi
   - Fiyat: €110.000'den başlayan fiyatlar.

4. GÜNCEL KİRALIK DAİRELERİMİZ (Mahmutlar & Oba):
   - Mahmutlar 1+1 Full Eşyalı Rezidans Daire: Aylık €450 (veya 15.000 TL)
   - Oba 2+1 Site İçi Lüks Kiralık Daire: Aylık €700 (veya 25.000 TL)
   - Sezonluk ve Yıllık kiralama seçenekleri mevcuttur.
`;

/**
 * Meta WhatsApp Webhook Verification (GET)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    let expectedVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'jasmine_secret_verify_token';

    try {
      const waConfig = await prisma.whatsAppConfig.findUnique({ where: { id: 'default' } });
      if (waConfig?.verifyToken) {
        expectedVerifyToken = waConfig.verifyToken;
      }
    } catch (dbErr) {}

    if (mode === 'subscribe' && token === expectedVerifyToken) {
      console.log('[Meta Webhook Verified Successfully]');
      return new Response(challenge, { status: 200 });
    }

    console.warn('[Meta Webhook Verification Failed]: Token mismatch', { received: token, expected: expectedVerifyToken });
    return new Response('Verification failed', { status: 403 });
  } catch (error: any) {
    return new Response('Internal Server Error: ' + error.message, { status: 500 });
  }
}

async function processIncomingWhatsAppMessage(fromPhone: string, textBody: string, contactName: string) {
  console.log(`[Meta Webhook Worker] Processing message from ${fromPhone} (${contactName}): "${textBody}"`);

  // 1. Add customer message to shared conversation store for instant CRM UI rendering
  const conv = addIncomingCustomerMessage(fromPhone, textBody, contactName);

  // Try saving customer message to Prisma DB if connected
  try {
    let dbConv = await prisma.customerConversation.findFirst({
      where: { customerPhone: fromPhone }
    });

    if (!dbConv) {
      dbConv = await prisma.customerConversation.create({
        data: {
          customerName: contactName,
          customerPhone: fromPhone,
          channel: 'WHATSAPP',
          intent: 'INVESTMENT'
        }
      });
    }

    if (dbConv) {
      await prisma.conversationMessage.create({
        data: {
          conversationId: dbConv.id,
          role: 'customer',
          content: textBody
        }
      });

      await prisma.customerConversation.update({
        where: { id: dbConv.id },
        data: {
          summary: textBody,
          updatedAt: new Date()
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

    const historyStr = (conv.messages || []).map(m => `${m.role === 'customer' ? 'Müşteri' : 'Efe'}: ${m.content}`).join('\n');

    const systemPrompt = PROMPTS.customerAssistant({
      companyName: companyName,
      availableListings: REAL_ESTATE_CONTEXT,
      conversationHistory: historyStr,
      customerMessage: textBody
    });

    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: textBody }
    ];

    const aiResponse = await callAI(aiMessages, 'assistant', customGeminiKey);
    let parsed: any = parseJSONResponse(aiResponse.content);
    aiReplyText = parsed?.reply || (typeof aiResponse.content === 'string' && !aiResponse.content.startsWith('{') ? aiResponse.content.trim() : '');

    if (!aiReplyText || aiReplyText.trim().length === 0) {
      const fallbackJSON = generateSmartFallbackResponse(aiMessages);
      const parsedFallback = parseJSONResponse(fallbackJSON);
      aiReplyText = (parsedFallback?.reply as string) || `Merhaba! Alanya, Mahmutlar ve Oba bölgesindeki güncel kiralık ve satılık daire portföylerimizi kontrol ediyorum. Nasıl bir ev bakıyordunuz?`;
    }
  } catch (aiErr) {
    console.error('[Meta Webhook AI Error]:', aiErr);
    const fallbackJSON = generateSmartFallbackResponse([{ role: 'user', content: textBody }]);
    const parsedFallback = parseJSONResponse(fallbackJSON);
    aiReplyText = (parsedFallback?.reply as string) || `Merhaba! Alanya bölgesindeki kiralık ve satılık portföy seçeneklerimiz mevcuttur. Aradığınız ev kiralık mı satılık mı acaba?`;
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
              await processIncomingWhatsAppMessage(fromPhone, textBody, contactName);
            }
          }
        }
      }
      return NextResponse.json({ status: 'success' }, { status: 200 });
    }

    return NextResponse.json({ status: 'not a whatsapp event' }, { status: 404 });
  } catch (error: any) {
    console.error('[Meta Webhook POST Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
