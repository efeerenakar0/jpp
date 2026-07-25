import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI, PROMPTS } from '@/lib/ai';

/**
 * Simulate an incoming Meta WhatsApp Message for instant UI testing
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message || 'Merhaba, Alanya projeleri hakkında bilgi alabilir miyim?';

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

    let listings = 'Mahmutlar 1+1, Oba 2+1, Kestel 1+1';
    listings += `\n\nEK FİRMA BİLGİLERİ (Yapay zeka bunu aklında tutmalı ve müşteriler sorduğunda kullanmalı):\n`;
    if (companyAddress) listings += `- Şirket/Ofis Adresi: ${companyAddress}\n`;
    if (websiteUrl) listings += `- Web Sitesi Adresi (URL): ${websiteUrl}\n`;
    if (instagramUrl) listings += `- Instagram Sayfası (URL): ${instagramUrl}\n`;
    if (languages) listings += `- Hizmet Verdiğimiz Diller: ${languages}\n`;
    if (companyDetails) listings += `- Ek Firma Notları & Kuralları: ${companyDetails}\n`;

    // 1. Trigger Groq AI Auto-Response
    const systemPrompt = PROMPTS.customerAssistant({
      companyName: companyName,
      availableListings: listings,
      conversationHistory: `Müşteri: ${message}`,
      customerMessage: message
    });

    const aiResponse = await callAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ]);

    const replyText = aiResponse.content;

    return NextResponse.json({
      success: true,
      sentToWhatsApp: false,
      reply: replyText,
      conversationId: `conv_sim_${Date.now()}`
    });

  } catch (error: any) {
    console.error('[Simulate Incoming Error]:', error);
    return NextResponse.json({
      error: error?.message || 'Simulation error'
    }, { status: 500 });
  }
}
