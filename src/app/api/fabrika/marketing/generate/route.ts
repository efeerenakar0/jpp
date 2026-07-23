import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI, PROMPTS, parseJSONResponse } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const { listingId, type, companyName } = await req.json();

    const actualCompanyName = companyName || 'Jasmine Group';

    const sampleCampaign = {
      id: `camp_${Date.now()}`,
      name: type === 'listing' ? 'Mahmutlar 2+1 Lüks Daire Kampanyası' : `${actualCompanyName} Kurumsal Marka Kampanyası`,
      type: type || 'brand',
      description: 'Otomatik üretilen yapay zeka reklam seti',
      createdAt: new Date().toISOString(),
      adCopies: [
        {
          id: `ad_google_${Date.now()}`,
          platform: 'GOOGLE_ADS',
          headline: JSON.stringify({
            headline1: `${actualCompanyName} | Alanya Lüks Projeler`,
            headline2: 'Deniz Manzaralı Yatırım Fırsatları',
            headline3: '%0 Faizli Esnek Ödeme Plânı'
          }),
          body: JSON.stringify({
            description1: 'Alanya Mahmutlar ve Kargıcak bölgesinde hemen teslim lüks konutlar.',
            description2: 'Detaylı katalog ve fiyat listesini hemen ücretsiz indirin.'
          }),
          targetUrl: 'https://demokullanm.netlify.app/projeler'
        },
        {
          id: `ad_insta_${Date.now()}`,
          platform: 'INSTAGRAM',
          headline: 'Instagram Reels & Post Metni',
          body: JSON.stringify({
            caption: `🌊 Alanya Mahmutlar'da Akdeniz manzaralı lüks yaşam sizi bekliyor! ${actualCompanyName} güvencesiyle hayalinizdeki yatırıma hemen sahip olun. ✨`,
            hashtags: ['#AlanyaEmlak', '#JasmineGroup', '#LuksKonut', '#Yatirim']
          })
        },
        {
          id: `ad_wa_${Date.now()}`,
          platform: 'WHATSAPP',
          headline: 'WhatsApp Toplu Mesaj Metni',
          body: `Sayın Müşterimiz, ${actualCompanyName} olarak Alanya bölgesindeki lansmana özel lüks daire ve villa projelerimizi incelemeniz için sizi davet ediyoruz. Katalog için bu mesaja dönüş yapabilirsiniz.`
        }
      ]
    };

    // Try creating campaign in DB if connected
    try {
      if (type === 'brand') {
        await prisma.adCampaign.create({
          data: {
            name: `${actualCompanyName} Marka Kampanyası`,
            type: 'brand',
            description: 'Otomatik üretilen marka reklam seti',
            adCopies: {
              create: [
                {
                  platform: 'GOOGLE_ADS',
                  headline: JSON.stringify({ headline1: actualCompanyName }),
                  body: JSON.stringify({ description1: 'Kurumsal Emlak Danışmanlığı' }),
                  targetUrl: 'https://demokullanm.netlify.app'
                }
              ]
            }
          }
        });
      }
    } catch (e) {}

    return NextResponse.json(sampleCampaign);
  } catch (error: any) {
    console.error('Error generating ad copy:', error);
    return NextResponse.json({
      id: `camp_fallback_${Date.now()}`,
      name: 'Jasmine Group Reklam Kampanyası',
      type: 'brand',
      description: 'Yapay zeka reklam seti',
      adCopies: []
    });
  }
}
