import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI, PROMPTS, parseJSONResponse } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const { listingId, type, companyName } = await req.json();

    if (type === 'listing') {
      if (!listingId) {
        return NextResponse.json({ error: 'Listing ID required' }, { status: 400 });
      }

      const listing = await prisma.huntedListing.findUnique({
        where: { id: listingId }
      });

      if (!listing) {
        return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
      }

      const campaignName = `${listing.title.substring(0, 30)}... Kampanyası`;

      // Null -> undefined dönüşümü (Prisma null döner, PROMPTS undefined bekler)
      const listingData = {
        title: listing.title,
        price: listing.price ?? undefined,
        location: listing.location ?? undefined,
        imageUrl: listing.imageUrl ?? undefined,
      };

      // 1. Google Ads
      const googleRes = await callAI([
        { role: 'system', content: PROMPTS.adCopyGoogle(listingData, `https://jasmine.com/ilan/${listing.id}`) }
      ], 'google_ads');
      const googleData = parseJSONResponse(googleRes.content) || { headline1: listing.title, description1: 'Detaylar için tıklayın.' };

      // 2. Instagram
      const instaRes = await callAI([
        { role: 'system', content: PROMPTS.adCopyInstagram(listingData) }
      ], 'instagram');
      const instaData = parseJSONResponse(instaRes.content) || { caption: listing.title, hashtags: ['#emlak'] };

      // 3. WhatsApp
      const waRes = await callAI([
        { role: 'system', content: PROMPTS.adCopyWhatsApp(listingData) }
      ], 'whatsapp');
      const waData = waRes.content;

      // DB'ye kaydet
      const campaign = await prisma.adCampaign.create({
        data: {
          name: campaignName,
          type: 'listing',
          description: 'Otomatik üretilen ilan reklam seti',
          adCopies: {
            create: [
              {
                listingId: listing.id,
                platform: 'GOOGLE_ADS',
                headline: JSON.stringify({
                  headline1: googleData.headline1,
                  headline2: googleData.headline2,
                  headline3: googleData.headline3
                }),
                body: JSON.stringify({
                  description1: googleData.description1,
                  description2: googleData.description2
                }),
                targetUrl: `https://jasmine.com/ilan/${listing.id}`
              },
              {
                listingId: listing.id,
                platform: 'INSTAGRAM',
                headline: 'Instagram Post',
                body: JSON.stringify(instaData)
              },
              {
                listingId: listing.id,
                platform: 'WHATSAPP',
                headline: 'WhatsApp Mesajı',
                body: waData
              }
            ]
          }
        },
        include: { adCopies: true }
      });

      await prisma.notification.create({
        data: {
          type: 'AD_COPY_READY',
          title: 'Reklam Metinleri Hazır',
          message: `${campaignName} için Google Ads, Instagram ve WhatsApp reklam metinleri başarıyla üretildi.`,
          link: '/fabrika/pazarlamaci'
        }
      });

      return NextResponse.json(campaign);
    }

    if (type === 'brand') {
      const actualCompanyName = companyName || 'Jasmine Group';
      
      const company = await prisma.companyProfile.findFirst();
      const companyData = company || {
        companyName: actualCompanyName,
        strengths: ['10 yıllık tecrübe', 'Müşteri memnuniyeti'],
        serviceAreas: ['İstanbul', 'Antalya']
      };

      const res = await callAI([
        { role: 'system', content: PROMPTS.brandCampaign(companyData) }
      ], 'brand_campaign');
      
      const parsedData = parseJSONResponse(res.content) || {
        google: { headline: actualCompanyName, description: 'Kurumsal emlak danışmanlığı' },
        instagram: { caption: `${actualCompanyName} ile tanışın.`, hashtags: ['#emlak'] },
        whatsapp: `Merhaba! ${actualCompanyName} olarak hizmetinizdeyiz.`
      };

      const campaign = await prisma.adCampaign.create({
        data: {
          name: `${actualCompanyName} Marka Kampanyası`,
          type: 'brand',
          description: 'Otomatik üretilen marka reklam seti',
          adCopies: {
            create: [
              {
                platform: 'GOOGLE_ADS',
                headline: JSON.stringify({ headline1: (parsedData as any).google?.headline }),
                body: JSON.stringify({ description1: (parsedData as any).google?.description }),
                targetUrl: 'https://jasmine.com'
              },
              {
                platform: 'INSTAGRAM',
                headline: 'Instagram Post',
                body: JSON.stringify({ caption: (parsedData as any).instagram?.caption, hashtags: (parsedData as any).instagram?.hashtags })
              },
              {
                platform: 'WHATSAPP',
                headline: 'WhatsApp Mesajı',
                body: (parsedData as any).whatsapp || 'Merhaba!'
              }
            ]
          }
        },
        include: { adCopies: true }
      });

      await prisma.notification.create({
        data: {
          type: 'AD_COPY_READY',
          title: 'Marka Reklam Metinleri Hazır',
          message: 'Marka kampanyası için reklam metinleri başarıyla üretildi.',
          link: '/fabrika/pazarlamaci'
        }
      });

      return NextResponse.json(campaign);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error generating ad copy:', error);
    return NextResponse.json({ error: 'Failed to generate ad copies' }, { status: 500 });
  }
}
