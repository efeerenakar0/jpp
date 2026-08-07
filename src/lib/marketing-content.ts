import { AdPlatform } from '@prisma/client';
import {
  DEFAULT_MARKETING_CHANNELS,
  marketingChannelLabel,
} from './marketing-channels';

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

function hasChannelPayloadShape(platform: AdPlatform, body: string) {
  if (
    platform !== AdPlatform.INSTAGRAM &&
    platform !== AdPlatform.GOOGLE_ADS
  ) {
    return true;
  }
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (platform === AdPlatform.INSTAGRAM) {
      return (
        typeof parsed.caption === 'string' &&
        Array.isArray(parsed.hashtags)
      );
    }
    return (
      typeof parsed.description1 === 'string' &&
      typeof parsed.description2 === 'string'
    );
  } catch {
    return false;
  }
}

export function deterministicCampaign(input: {
  companyName: string;
  property: MarketingProperty | null;
  objective: string;
  audience: string;
  tone: string;
  targetUrl?: string | null;
  channels?: AdPlatform[];
}): GeneratedMarketingCampaign {
  const { companyName, property, objective, audience, targetUrl } = input;
  const channels = input.channels?.length ? input.channels : DEFAULT_MARKETING_CHANNELS;
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

  const genericBody = property
    ? `${title}\n${location}${details ? ` · ${details}` : ''}\n\n${baseDescription}\n\nGüncel bilgi ve randevu için iletişime geçin.`
    : `${companyName}\n\n${baseDescription}\n\nGayrimenkul ihtiyacınızı paylaşmak için iletişime geçin.`;
  const adCopies = channels.map((platform) => {
    if (platform === AdPlatform.GOOGLE_ADS) {
      return {
        platform,
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
      };
    }
    if (platform === AdPlatform.INSTAGRAM) {
      return {
        platform,
        headline: title,
        body: JSON.stringify({
          caption: instagramCaption,
          hashtags: ['#gayrimenkul', '#emlak', '#yatırım', '#satılık'],
        }),
        callToAction: 'Bilgi Al',
        targetUrl: targetUrl || null,
      };
    }
    if (platform === AdPlatform.WHATSAPP || platform === AdPlatform.SMS) {
      return {
        platform,
        headline: property ? `${title} hakkında bilgi` : `${companyName} portföy danışmanlığı`,
        body: platform === AdPlatform.SMS ? whatsappBody.slice(0, 320) : whatsappBody,
        callToAction: 'Yanıtla',
        targetUrl: targetUrl || null,
      };
    }
    if (platform === AdPlatform.EMAIL) {
      return {
        platform,
        headline: property ? `${title} | ${location}` : `${companyName} gayrimenkul danışmanlığı`,
        body: `Merhaba,\n\n${genericBody}\n\nSaygılarımızla,\n${companyName}`,
        callToAction: 'Detayları incele',
        targetUrl: targetUrl || null,
      };
    }
    if (platform === AdPlatform.FACEBOOK) {
      return {
        platform,
        headline: title,
        body: `${genericBody}\n\nSorularınızı mesajla iletin; güncel bilgileri danışmanımızla birlikte doğrulayın.`,
        callToAction: 'Daha fazla bilgi al',
        targetUrl: targetUrl || null,
      };
    }
    if (platform === AdPlatform.TIKTOK) {
      return {
        platform,
        headline: `${title} için hızlı tur`.slice(0, 120),
        body: `${location} bölgesindeki bu portföyü kısa turla keşfedin.${details ? ` ${details}.` : ''} Güncel bilgi ve randevu için bize yazın.`,
        callToAction: 'Profili ziyaret et',
        targetUrl: targetUrl || null,
      };
    }
    if (platform === AdPlatform.X) {
      return {
        platform,
        headline: title.slice(0, 120),
        body: `${title} · ${location}${details ? ` · ${details}` : ''}. Güncel detay ve randevu için iletişime geçin.`.slice(0, 500),
        callToAction: 'Detayları incele',
        targetUrl: targetUrl || null,
      };
    }
    if (platform === AdPlatform.SAHIBINDEN) {
      return {
        platform,
        headline: `${location} ${property?.roomCount || ''} ${title}`.trim().slice(0, 120),
        body: `${property?.description || baseDescription}\n\n${details || 'Detaylar için iletişime geçin.'}\n\nRandevu ve güncel bilgiler için ilan üzerinden iletişim kurabilirsiniz.`,
        callToAction: 'İlanı incele',
        targetUrl: targetUrl || null,
      };
    }
    return {
      platform,
      headline: `${title} · ${marketingChannelLabel(platform)}`.slice(0, 120),
      body: genericBody,
      callToAction: 'Detayları incele',
      targetUrl: targetUrl || null,
    };
  });

  return {
    name: campaignName,
    description: `${baseDescription} Amaç: ${objective}.`,
    posterHeadline: property ? title : 'Doğru yatırım, doğru danışmanlık',
    posterSubline: details || location,
    posterCta: property ? 'DETAYLAR VE RANDEVU' : 'PORTFÖYLERİ KEŞFEDİN',
    adCopies,
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
    const seenBodies = new Set<string>();
    const copies = fallback.adCopies.map((defaultCopy) => {
      const candidate = rawCopies.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          isPlatform((item as Record<string, unknown>).platform) &&
          (item as Record<string, unknown>).platform === defaultCopy.platform
      ) as Record<string, unknown> | undefined;
      if (!candidate) {
        seenBodies.add(defaultCopy.body.trim().toLocaleLowerCase('tr-TR'));
        return defaultCopy;
      }
      const candidateCopy = {
        platform: defaultCopy.platform,
        headline: cleanText(candidate.headline, defaultCopy.headline, 500),
        body: cleanText(candidate.body, defaultCopy.body, 2400),
        callToAction: cleanText(candidate.callToAction, defaultCopy.callToAction, 80),
        targetUrl:
          typeof candidate.targetUrl === 'string'
            ? candidate.targetUrl.slice(0, 1000)
            : defaultCopy.targetUrl,
      };
      if (!hasChannelPayloadShape(defaultCopy.platform, candidateCopy.body)) {
        seenBodies.add(defaultCopy.body.trim().toLocaleLowerCase('tr-TR'));
        return defaultCopy;
      }
      const bodyKey = candidateCopy.body.trim().toLocaleLowerCase('tr-TR');
      if (seenBodies.has(bodyKey)) {
        seenBodies.add(defaultCopy.body.trim().toLocaleLowerCase('tr-TR'));
        return defaultCopy;
      }
      seenBodies.add(bodyKey);
      return candidateCopy;
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
