import { AdPlatform } from '@prisma/client';

export type MarketingProperty = {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  description: string | null;
  imageUrl: string | null;
  referenceCode: string | null;
};

export type GeneratedMarketingCampaign = {
  name: string;
  description: string;
  posterHeadline: string;
  posterSubline: string;
  posterCta: string;
  adCopies: Array<{
    platform: AdPlatform;
    headline: string;
    body: string;
    callToAction: string;
    targetUrl: string | null;
  }>;
};

function priceLabel(price: number | null) {
  if (!price) return 'Fiyat ve detaylar için iletişime geçin';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(price);
}

function cleanText(value: unknown, fallback: string, max = 1200) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

function isPlatform(value: unknown): value is AdPlatform {
  return Object.values(AdPlatform).includes(value as AdPlatform);
}

export function deterministicCampaign(input: {
  companyName: string;
  property: MarketingProperty | null;
  objective: string;
  audience: string;
  tone: string;
  targetUrl?: string | null;
}): GeneratedMarketingCampaign {
  const { companyName, property, objective, audience, targetUrl } = input;
  const title = property?.title || `${companyName} ile doğru gayrimenkul kararı`;
  const location = property?.location || 'Bölgenin seçkin gayrimenkulleri';
  const details = [
    property?.roomCount,
    property?.area ? `${property.area} m²` : null,
    property?.price ? priceLabel(property.price) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const campaignName = property ? `${title} · Çok kanallı tanıtım` : `${companyName} · Marka güveni`;
  const baseDescription = property
    ? `${location} konumundaki ${title} için ${audience.toLocaleLowerCase('tr-TR')} odaklı, güven veren bir tanıtım seti.`
    : `${companyName} için güven, yerel uzmanlık ve hızlı geri dönüş odağında marka kampanyası.`;
  const instagramCaption = property
    ? `${title}\n\n${location}${details ? ` · ${details}` : ''}\n\nBu portföyün güncel detaylarını öğrenmek ve yerinde görmek için bizimle iletişime geçin.`
    : `${companyName} ile aradığınız gayrimenkule daha güvenli ve planlı ulaşın. Bölge bilgisi, doğru portföy ve şeffaf danışmanlık tek yerde.`;
  const whatsappBody = property
    ? `Merhaba, ${location} bölgesindeki “${title}” portföyümüzü sizinle paylaşmak isteriz.${details ? ` ${details}.` : ''} Güncel detay ve randevu için bu mesaja yanıt verebilirsiniz.`
    : `Merhaba, ${companyName} olarak gayrimenkul ihtiyaçlarınız için doğru portföyleri tek tek değerlendiriyor, süreci şeffaf biçimde yönetiyoruz. Aradığınız özellikleri yazmanız yeterli.`;
  const googleHeadlines = property
    ? [title.slice(0, 30), `${location} Gayrimenkul`.slice(0, 30), 'Detayları Hemen İnceleyin']
    : [`${companyName} Gayrimenkul`.slice(0, 30), 'Doğru Portföyü Birlikte Bulun', 'Uzman Danışmanlık'];

  return {
    name: campaignName,
    description: `${baseDescription} Amaç: ${objective}.`,
    posterHeadline: property ? title : 'Doğru yatırım, doğru danışmanlık',
    posterSubline: details || location,
    posterCta: property ? 'DETAYLAR VE RANDEVU' : 'PORTFÖYLERİ KEŞFEDİN',
    adCopies: [
      {
        platform: AdPlatform.GOOGLE_ADS,
        headline: JSON.stringify({
          headline1: googleHeadlines[0],
          headline2: googleHeadlines[1],
          headline3: googleHeadlines[2],
        }),
        body: JSON.stringify({
          description1: baseDescription.slice(0, 90),
          description2: 'Güncel bilgi ve uzman danışmanlık için şimdi iletişime geçin.'.slice(0, 90),
        }),
        callToAction: 'İncele',
        targetUrl: targetUrl || null,
      },
      {
        platform: AdPlatform.INSTAGRAM,
        headline: title,
        body: JSON.stringify({
          caption: instagramCaption,
          hashtags: ['#gayrimenkul', '#emlak', '#yatırım', '#satılık'],
        }),
        callToAction: 'Bilgi Al',
        targetUrl: targetUrl || null,
      },
      {
        platform: AdPlatform.WHATSAPP,
        headline: property ? `${title} hakkında bilgi` : `${companyName} portföy danışmanlığı`,
        body: whatsappBody,
        callToAction: 'Yanıtla',
        targetUrl: targetUrl || null,
      },
    ],
  };
}

export function parseGeneratedCampaign(
  rawContent: string,
  fallback: GeneratedMarketingCampaign
) {
  if (!rawContent.trim()) return fallback;
  try {
    const match = rawContent.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] || rawContent) as Record<string, unknown>;
    const rawCopies = Array.isArray(parsed.adCopies) ? parsed.adCopies : [];
    const copies = fallback.adCopies.map((defaultCopy) => {
      const candidate = rawCopies.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          isPlatform((item as Record<string, unknown>).platform) &&
          (item as Record<string, unknown>).platform === defaultCopy.platform
      ) as Record<string, unknown> | undefined;
      if (!candidate) return defaultCopy;
      return {
        platform: defaultCopy.platform,
        headline: cleanText(candidate.headline, defaultCopy.headline, 500),
        body: cleanText(candidate.body, defaultCopy.body, 2400),
        callToAction: cleanText(candidate.callToAction, defaultCopy.callToAction, 80),
        targetUrl:
          typeof candidate.targetUrl === 'string'
            ? candidate.targetUrl.slice(0, 1000)
            : defaultCopy.targetUrl,
      };
    });
    return {
      name: cleanText(parsed.name, fallback.name, 180),
      description: cleanText(parsed.description, fallback.description, 1200),
      posterHeadline: cleanText(parsed.posterHeadline, fallback.posterHeadline, 90),
      posterSubline: cleanText(parsed.posterSubline, fallback.posterSubline, 120),
      posterCta: cleanText(parsed.posterCta, fallback.posterCta, 50),
      adCopies: copies,
    };
  } catch {
    return fallback;
  }
}
