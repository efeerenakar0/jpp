import { AdPlatform } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI, parseJSONResponse } from '@/lib/ai';

type GeneratedAd = {
  platform?: string;
  headline?: string;
  body?: string;
  callToAction?: string;
  targetUrl?: string;
};

function isAdPlatform(value?: string): value is AdPlatform {
  return value === 'GOOGLE_ADS' || value === 'INSTAGRAM' || value === 'WHATSAPP';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      listingId?: string;
      type?: 'listing' | 'brand';
      companyName?: string;
    };
    const campaignType = body.type || 'brand';
    const companyName = body.companyName?.trim() || 'Jasmine Group';
    const listing = body.listingId
      ? await prisma.huntedListing.findUnique({ where: { id: body.listingId } })
      : null;

    if (campaignType === 'listing' && !listing) {
      return NextResponse.json(
        { error: 'Reklam üretilecek portföy bulunamadı.' },
        { status: 404 }
      );
    }

    const prompt = `
${companyName} için gayrimenkul reklam kampanyası üret.
Kampanya tipi: ${campaignType}
Portföy: ${listing ? JSON.stringify({
  title: listing.title,
  price: listing.price,
  location: listing.location,
  roomCount: listing.roomCount,
  area: listing.area,
  sourceUrl: listing.sourceUrl,
}) : 'Kurumsal marka kampanyası'}

Yalnızca şu JSON yapısını döndür:
{
  "name": "kampanya adı",
  "description": "kısa açıklama",
  "adCopies": [
    { "platform": "GOOGLE_ADS", "headline": "...", "body": "...", "callToAction": "...", "targetUrl": "..." },
    { "platform": "INSTAGRAM", "headline": "...", "body": "...", "callToAction": "...", "targetUrl": "..." },
    { "platform": "WHATSAPP", "headline": "...", "body": "...", "callToAction": "...", "targetUrl": "..." }
  ]
}
Gerçek olmayan fiyat, kampanya avantajı veya teslim tarihi uydurma.
`;
    const aiResponse = await callAI([{ role: 'user', content: prompt }]);
    const generated = parseJSONResponse(aiResponse.content) as {
      name?: string;
      description?: string;
      adCopies?: GeneratedAd[];
    } | null;
    const validAds = generated?.adCopies?.filter(
      (ad) => isAdPlatform(ad.platform) && ad.headline?.trim() && ad.body?.trim()
    );

    if (!generated?.name?.trim() || !validAds?.length) {
      return NextResponse.json(
        { error: 'AI geçerli bir reklam seti oluşturamadı.' },
        { status: 502 }
      );
    }

    const campaign = await prisma.adCampaign.create({
      data: {
        name: generated.name.trim(),
        description: generated.description?.trim(),
        type: campaignType,
        adCopies: {
          create: validAds.map((ad) => ({
            platform: ad.platform as AdPlatform,
            headline: ad.headline!.trim(),
            body: ad.body!.trim(),
            callToAction: ad.callToAction?.trim(),
            targetUrl: ad.targetUrl?.trim(),
            listingId: listing?.id,
          })),
        },
      },
      include: { adCopies: true },
    });

    await prisma.notification.create({
      data: {
        type: 'AD_COPY_READY',
        title: 'Reklam Taslakları Hazır',
        message: `${campaign.name} için ${campaign.adCopies.length} reklam taslağı üretildi.`,
        link: '/fabrika/pazarlamaci',
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    console.error('[Marketing Generate Error]:', error);
    return NextResponse.json(
      { error: 'Reklam kampanyası üretilemedi.' },
      { status: 502 }
    );
  }
}
