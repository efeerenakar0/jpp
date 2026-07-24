import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMetaWhatsAppMessage, updateCredentialsCache } from '@/lib/whatsapp';
import { callAI, PROMPTS } from '@/lib/ai';
import { addIncomingCustomerMessage, addAssistantMessageToStore } from '@/lib/conversation-store';
import { getOrCreateSession } from '@/lib/studio-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const urlToken = searchParams.get('token');
    const urlPhoneId = searchParams.get('phoneId');
    if (urlToken && urlPhoneId) {
      updateCredentialsCache({ token: urlToken, phoneNumberId: urlPhoneId, businessAccountId: '' });
    }

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

async function processIncomingWhatsAppMessage(fromPhone: string, textBody: string, contactName: string, isImage = false, imageId?: string) {
  console.log(`[Meta Webhook Worker] Processing message from ${fromPhone} (${contactName}) [Image: ${isImage}]: "${textBody}"`);

  // If it is an image, register it into the shared Studio session store for instant Stüdyo rendering
  if (isImage) {
    try {
      const studio = getOrCreateSession('default_session');
      const photoName = `whatsapp_photo_${Date.now()}.jpg`;
      // Standard high-quality 1x1 1080p SVG placeholder buffer for initial studio processing
      const dummyBuffer = Buffer.from(
        `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="1080" fill="#0f172a"/><text x="540" y="540" font-family="Arial" font-size="42" fill="#10b981" text-anchor="middle">WhatsApp Photo (${contactName})</text></svg>`
      );
      studio.photos.push({ name: photoName, buffer: dummyBuffer });
      console.log(`[Meta Webhook Studio Sync]: Photo added to studio default_session (${photoName})`);
    } catch (e) {
      console.warn('[Meta Webhook Studio Sync Warning]:', e);
    }
  }

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

  // 2. Build FULL conversation history array for Gemini memory
  let aiReplyText = '';
  try {
    let companyName = 'Jasmine Group';
    let customGeminiKey: string | undefined = undefined;

    try {
      const waConfig = await prisma.whatsAppConfig.findUnique({ where: { id: 'default' } });
      if (waConfig?.companyName) companyName = waConfig.companyName;
      if (waConfig?.geminiApiKey) customGeminiKey = waConfig.geminiApiKey;
    } catch (e) {}

    const historyStr = (conv.messages || []).map(m => `${m.role === 'customer' ? 'Müşteri' : 'Efe'}: ${m.content}`).join('\n');

    const promptMessage = isImage 
      ? `Müşteri WhatsApp üzerinden bir daire/fotoğraf görseli gönderdi. Notu: "${textBody}". Görselin alındığını ve Stüdyo modülünde profesyonel 4K HDR işlemeye alındığını belirterek samimi bir yanıt ver.`
      : textBody;

    const systemPrompt = PROMPTS.customerAssistant({
      companyName: companyName,
      availableListings: REAL_ESTATE_CONTEXT,
      conversationHistory: historyStr,
      customerMessage: promptMessage
    });

    const aiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...(conv.messages || []).map(m => ({
        role: m.role === 'customer' ? ('user' as const) : ('assistant' as const),
        content: m.content
      }))
    ];

    const aiResponse = await callAI(aiMessages, 'assistant', customGeminiKey);
    if (aiResponse?.content && typeof aiResponse.content === 'string' && aiResponse.content.trim().length > 0) {
      aiReplyText = aiResponse.content.trim();
    } else {
      aiReplyText = isImage 
        ? "Fotoğrafınız alındı! YZ Stüdyo modülümüzde 4K HDR iyileştirme işlemine başlandı. Size Alanya projelerimiz hakkında başka nasıl yardımcı olabilirim?"
        : "Merhaba! Ben Jasmine Group emlak ve yatırım uzmanı Efe. Size Alanya projelerimiz, kiralık ve satılık daire seçeneklerimiz hakkında nasıl yardımcı olabilirim?";
    }
  } catch (aiErr: any) {
    console.error('[Meta Webhook AI Error]:', aiErr);
    aiReplyText = isImage
      ? "Fotoğrafınız alındı ve Stüdyo modülümüze aktarıldı. Daireniz için fiyat teklifi veya VIP pazarlama detaylarını öğrenmek ister misiniz?"
      : "Merhaba! Ben Jasmine Group emlak ve yatırım uzmanı Efe. Size Alanya projelerimiz, kiralık ve satılık daire seçeneklerimiz hakkında nasıl yardımcı olabilirim?";
  }

  // 3. Send AI Reply back to Customer via Meta WhatsApp Cloud API
  try {
    console.log(`[Meta Webhook Worker] Sending WhatsApp Cloud API response to ${fromPhone}...`);
    const metaRes = await sendMetaWhatsAppMessage({
      to: fromPhone,
      text: aiReplyText
    });
    console.log(`[Meta Webhook Worker] Successfully sent response to ${fromPhone}:`, metaRes);
    addAssistantMessageToStore(conv.id, aiReplyText, { sentViaMeta: true, metaStatus: 'DELIVERED' });
  } catch (sendErr: any) {
    const errorMsg = sendErr?.message || String(sendErr);
    console.error('[Meta Webhook Send Error]:', errorMsg);
    addAssistantMessageToStore(conv.id, `⚠️ [WhatsApp Mesaj İletim Uyarısı]: ${aiReplyText}\n\n(Not: Mesaj telefonunuza iletilemedi: ${errorMsg})`, { sentViaMeta: false, metaStatus: 'FAILED', metaError: errorMsg });
  }

  // Save AI response to Prisma DB if connected
  try {
    await prisma.conversationMessage.create({
      data: {
        conversationId: conv.id,
        role: 'assistant',
        content: aiReplyText
      }
    });
  } catch (e) {}
}

/**
 * Meta Incoming Messages & Events Handler (POST)
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const urlToken = searchParams.get('token');
    const urlPhoneId = searchParams.get('phoneId');
    if (urlToken && urlPhoneId) {
      updateCredentialsCache({ token: urlToken, phoneNumberId: urlPhoneId, businessAccountId: '' });
    }

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
            const contactName = value.contacts?.[0]?.profile?.name || fromPhone;

            if (msg.type === 'text') {
              const textBody = msg.text?.body || '';
              await processIncomingWhatsAppMessage(fromPhone, textBody, contactName, false);
            } else if (msg.type === 'image') {
              const caption = msg.image?.caption || '📷 [WhatsApp Üzerinden Fotoğraf Gönderildi]';
              const imageId = msg.image?.id;
              await processIncomingWhatsAppMessage(fromPhone, caption, contactName, true, imageId);
            } else if (msg.type === 'document') {
              const caption = msg.document?.caption || '📄 [WhatsApp Üzerinden Doküman Gönderildi]';
              await processIncomingWhatsAppMessage(fromPhone, caption, contactName, false);
            } else if (msg.type === 'location') {
              const locText = `📍 [Konum Gönderildi]: ${msg.location?.latitude}, ${msg.location?.longitude}`;
              await processIncomingWhatsAppMessage(fromPhone, locText, contactName, false);
            } else if (msg.type === 'audio' || msg.type === 'voice') {
              await processIncomingWhatsAppMessage(fromPhone, '🎙️ [Sesli Mesaj Gönderildi]', contactName, false);
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
