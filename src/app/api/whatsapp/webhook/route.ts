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
   - Sezonluk ve Yıllık kiralama seçenekleri mevcultur.
`;

/**
 * Meta WhatsApp Webhook Verification (GET)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const EXPECTED_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'jasmine_secret_verify_token';

  if (mode === 'subscribe' && token === EXPECTED_VERIFY_TOKEN) {
    console.log('[Meta Webhook Verified Successfully]');
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * Meta WhatsApp Webhook Listener (POST)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Check if this is a Meta WhatsApp event
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value || !value.messages || value.messages.length === 0) {
      return NextResponse.json({ status: 'no_messages' }, { status: 200 });
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];

    const messageId = message.id;
    if (processedMsgIds.has(messageId)) {
      console.log(`[Meta Webhook] Duplicate message ID skipped: ${messageId}`);
      return NextResponse.json({ status: 'duplicate_skipped' }, { status: 200 });
    }
    processedMsgIds.add(messageId);
    if (processedMsgIds.size > 1000) {
      const firstKey = processedMsgIds.keys().next().value;
      if (firstKey) processedMsgIds.delete(firstKey);
    }

    const fromPhone = message.from; // Customer phone e.g. "905321234567"
    const contactName = contact?.profile?.name || 'Müşteri';
    const messageType = message.type;

    let textBody = '';
    let isImage = false;

    if (messageType === 'text') {
      textBody = message.text?.body || '';
    } else if (messageType === 'image') {
      isImage = true;
      textBody = message.image?.caption || 'Müşteri bir daire fotoğrafı gönderdi.';
    } else if (messageType === 'document') {
      textBody = `[Doküman Gönderildi]: ${message.document?.filename || 'Dosya'}`;
    } else if (messageType === 'location') {
      textBody = `[Konum Gönderildi]: Enlem ${message.location?.latitude}, Boylam ${message.location?.longitude}`;
    } else if (messageType === 'audio' || messageType === 'voice') {
      textBody = '[Sesli Mesaj Gönderildi]';
    } else {
      textBody = `[${messageType} mesajı alındı]`;
    }

    console.log(`[Meta Webhook Received] From: ${contactName} (${fromPhone}) Type: ${messageType} Body: ${textBody}`);

    // Update credentials cache from Meta payload if available
    const metadata = value.metadata;
    if (metadata?.phone_number_id) {
      updateCredentialsCache({ phoneNumberId: metadata.phone_number_id });
    }

    // Async worker processing to prevent blocking Meta HTTP 200 response
    processIncomingWhatsAppMessage(fromPhone, contactName, textBody, isImage).catch(err => {
      console.error('[Meta Webhook Async Worker Error]:', err);
    });

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    console.error('[Meta Webhook Error]:', error);
    return NextResponse.json({ status: 'error', message: error?.message }, { status: 200 });
  }
}

/**
 * Worker Function to Process Incoming WhatsApp Messages and Auto-Reply via Groq AI
 */
async function processIncomingWhatsAppMessage(fromPhone: string, contactName: string, textBody: string, isImage: boolean) {
  // Sync image to Stüdyo session if an image was sent
  if (isImage) {
    try {
      const studio = getOrCreateSession('default_session');
      const photoName = `whatsapp_photo_${Date.now()}.jpg`;
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

  // 2. Build FULL conversation history array for Groq AI memory
  let aiReplyText = '';
  try {
    let companyName = 'Jasmine Group';
    let companyAddress = '';
    let companyDetails = '';
    let websiteUrl = '';
    let instagramUrl = '';
    let languages = 'Türkçe';

    const hasValidDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql'));
    if (hasValidDb) {
      try {
        const waConfig = await prisma.whatsAppConfig.findUnique({ where: { id: 'default' } });
        if (waConfig?.companyName) companyName = waConfig.companyName;
        if (waConfig?.companyAddress) companyAddress = waConfig.companyAddress;
        if (waConfig?.companyDetails) companyDetails = waConfig.companyDetails;
        if (waConfig?.websiteUrl) websiteUrl = waConfig.websiteUrl;
        if (waConfig?.instagramUrl) instagramUrl = waConfig.instagramUrl;
        if (waConfig?.languages) languages = waConfig.languages;
      } catch (e) {}
    }

    const historyStr = (conv.messages || []).map(m => `${m.role === 'customer' ? 'Müşteri' : 'Efe'}: ${m.content}`).join('\n');

    const promptMessage = isImage 
      ? `Müşteri WhatsApp üzerinden bir daire/fotoğraf görseli gönderdi. Notu: "${textBody}". Görselin alındığını ve Stüdyo modülünde profesyonel 4K HDR işlemeye alındığını belirterek samimi bir yanıt ver.`
      : textBody;

    // Enhance real estate context with address, details, website, instagram, and languages
    let enhancedContext = REAL_ESTATE_CONTEXT;
    enhancedContext += `\n\nEK FİRMA BİLGİLERİ (Yapay zeka bunu aklında tutmalı ve müşteriler sorduğunda kullanmalı):\n`;
    if (companyAddress) enhancedContext += `- Şirket/Ofis Adresi: ${companyAddress}\n`;
    if (websiteUrl) enhancedContext += `- Web Sitesi Adresi (URL): ${websiteUrl}\n`;
    if (instagramUrl) enhancedContext += `- Instagram Sayfası (URL): ${instagramUrl}\n`;
    if (languages) enhancedContext += `- Hizmet Verdiğimiz Diller: ${languages}\n`;
    if (companyDetails) enhancedContext += `- Ek Firma Notları & Kuralları: ${companyDetails}\n`;

    const systemPrompt = PROMPTS.customerAssistant({
      companyName: companyName,
      availableListings: enhancedContext,
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

    const aiResponse = await callAI(aiMessages, 'assistant');
    if (aiResponse?.content && typeof aiResponse.content === 'string' && aiResponse.content.trim().length > 0) {
      aiReplyText = aiResponse.content.trim();
    } else {
      aiReplyText = "Merhabalar! Ben Jasmine Group emlak uzmanı Efe. Size Alanya projelerimiz ve kiralık daire seçeneklerimiz hakkında nasıl yardımcı olabilirim?";
    }
  } catch (aiErr: any) {
    console.error('[Meta Webhook AI Error]:', aiErr);
    aiReplyText = "Merhabalar! Ben Jasmine Group emlak uzmanı Efe. Alanya kiralık ve satılık portföyümüz hakkında detaylı bilgi almak ister misiniz?";
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
}
