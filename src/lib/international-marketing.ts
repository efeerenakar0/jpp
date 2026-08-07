import type { MarketingProperty } from '@/lib/marketing-content';

export type InternationalPortal = {
  id: string;
  name: string;
  publishUrl: string;
  pricingUrl: string;
  pricingLabel: string;
  accountType: 'individual' | 'professional' | 'both';
  note: string;
};

function safeHttpsHostname(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.hostname.toLocaleLowerCase('en-US') : null;
  } catch {
    return null;
  }
}

/**
 * Portal links are never accepted from generated text. A link is usable only
 * when its HTTPS host matches one of the two catalog-owned official links.
 */
export function isVerifiedPortalLink(
  portal: Pick<InternationalPortal, 'publishUrl' | 'pricingUrl'>,
  candidate: string
) {
  const candidateHost = safeHttpsHostname(candidate);
  if (!candidateHost) return false;
  const officialHosts = new Set(
    [portal.publishUrl, portal.pricingUrl]
      .map(safeHttpsHostname)
      .filter((host): host is string => Boolean(host))
  );
  return officialHosts.has(candidateHost);
}

export type InternationalMarket = {
  code: string;
  country: string;
  flag: string;
  language: string;
  locale: string;
  portals: InternationalPortal[];
};

export type InternationalPortalCopy = {
  portalId: string;
  portalName: string;
  title: string;
  body: string;
  steps: string[];
  publishUrl: string;
  pricingUrl: string;
  pricingLabel: string;
};

export type InternationalMarketingPlan = {
  countryCode: string;
  countryName: string;
  language: string;
  strategy: string;
  warnings: string[];
  portalCopies: InternationalPortalCopy[];
};

const variablePricing =
  'Ücret ilan türü, süre ve profesyonel pakete göre değişir; yayınlamadan önce güncel fiyatı kontrol edin.';
const professionalPricing =
  'Profesyonel emlakçı üyeliği veya teklif gerekir; güncel ücret için satış ekibine başvurun.';

export const INTERNATIONAL_MARKETS: InternationalMarket[] = [
  {
    code: 'DE',
    country: 'Almanya',
    flag: '🇩🇪',
    language: 'Almanca',
    locale: 'de-DE',
    portals: [
      {
        id: 'kleinanzeigen',
        name: 'Kleinanzeigen',
        publishUrl: 'https://www.kleinanzeigen.de/p-anzeige-aufgeben.html',
        pricingUrl: 'https://themen.kleinanzeigen.de/immobilienprofis/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Genel ilan ve gayrimenkul kategorileri; yurt dışı mülk konumu açıkça belirtilmelidir.',
      },
      {
        id: 'immobilienscout24-de',
        name: 'ImmobilienScout24',
        publishUrl: 'https://www.immobilienscout24.de/immobilie-anbieten/',
        pricingUrl: 'https://www.immobilienscout24.de/immobilie-anbieten/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'İlan türüne göre bireysel veya profesyonel paket sunar.',
      },
      {
        id: 'immowelt',
        name: 'Immowelt',
        publishUrl: 'https://www.immowelt.de/anbieten',
        pricingUrl: 'https://www.immowelt.de/anbieten',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Gayrimenkul ilanı; fiyat ve süre seçim ekranında netleşir.',
      },
    ],
  },
  {
    code: 'GB',
    country: 'İngiltere',
    flag: '🇬🇧',
    language: 'İngilizce',
    locale: 'en-GB',
    portals: [
      {
        id: 'rightmove',
        name: 'Rightmove',
        publishUrl: 'https://www.rightmove.co.uk/estate-agents.html',
        pricingUrl: 'https://www.rightmove.co.uk/estate-agents.html',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Ağırlıklı olarak kayıtlı emlak profesyonelleri üzerinden yayın kabul eder.',
      },
      {
        id: 'zoopla',
        name: 'Zoopla',
        publishUrl: 'https://advantage.zpg.co.uk/',
        pricingUrl: 'https://advantage.zpg.co.uk/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Zoopla Advantage profesyonel üyelik ve ilan beslemesi kullanır.',
      },
      {
        id: 'onthemarket',
        name: 'OnTheMarket',
        publishUrl: 'https://www.onthemarket.com/agents/',
        pricingUrl: 'https://www.onthemarket.com/agents/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Emlak ofisi üyeliği gerektirir.',
      },
    ],
  },
  {
    code: 'ES',
    country: 'İspanya',
    flag: '🇪🇸',
    language: 'İspanyolca',
    locale: 'es-ES',
    portals: [
      {
        id: 'idealista-es',
        name: 'Idealista',
        publishUrl: 'https://www.idealista.com/owners/',
        pricingUrl: 'https://www.idealista.com/owners/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Bireysel ve profesyonel ilan seçenekleri bulunur.',
      },
      {
        id: 'fotocasa',
        name: 'Fotocasa',
        publishUrl: 'https://www.fotocasa.es/es/publicar-anuncio',
        pricingUrl: 'https://www.fotocasa.es/es/publicar-anuncio',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'İlan yayınlama adımında paket ve fiyat görüntülenir.',
      },
    ],
  },
  {
    code: 'FR',
    country: 'Fransa',
    flag: '🇫🇷',
    language: 'Fransızca',
    locale: 'fr-FR',
    portals: [
      {
        id: 'leboncoin',
        name: 'Leboncoin',
        publishUrl: 'https://www.leboncoin.fr/deposer-une-annonce',
        pricingUrl: 'https://www.leboncoin.fr/deposer-une-annonce',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Genel ilan ve gayrimenkul kategorileri bulunur.',
      },
      {
        id: 'seloger',
        name: 'SeLoger',
        publishUrl: 'https://pro.seloger.com/',
        pricingUrl: 'https://pro.seloger.com/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Profesyonel emlak ofisi ürünü olarak çalışır.',
      },
    ],
  },
  {
    code: 'IT',
    country: 'İtalya',
    flag: '🇮🇹',
    language: 'İtalyanca',
    locale: 'it-IT',
    portals: [
      {
        id: 'immobiliare-it',
        name: 'Immobiliare.it',
        publishUrl: 'https://www.immobiliare.it/pubblica-annuncio/',
        pricingUrl: 'https://www.immobiliare.it/pubblica-annuncio/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Bireysel ve profesyonel ilan akışları sunar.',
      },
      {
        id: 'idealista-it',
        name: 'Idealista',
        publishUrl: 'https://www.idealista.it/owners/',
        pricingUrl: 'https://www.idealista.it/owners/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'İtalya pazarı için yerelleştirilmiş ilan akışı.',
      },
    ],
  },
  {
    code: 'PT',
    country: 'Portekiz',
    flag: '🇵🇹',
    language: 'Portekizce',
    locale: 'pt-PT',
    portals: [
      {
        id: 'idealista-pt',
        name: 'Idealista',
        publishUrl: 'https://www.idealista.pt/owners/',
        pricingUrl: 'https://www.idealista.pt/owners/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Portekiz pazarı için bireysel ve profesyonel seçenekler.',
      },
      {
        id: 'imovirtual',
        name: 'Imovirtual',
        publishUrl: 'https://www.imovirtual.com/pt/empresas/',
        pricingUrl: 'https://www.imovirtual.com/pt/empresas/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Profesyonel ilan ve ofis paketleri sunar.',
      },
    ],
  },
  {
    code: 'NL',
    country: 'Hollanda',
    flag: '🇳🇱',
    language: 'Felemenkçe',
    locale: 'nl-NL',
    portals: [
      {
        id: 'funda',
        name: 'Funda',
        publishUrl: 'https://www.funda.nl/makelaar/',
        pricingUrl: 'https://www.funda.nl/makelaar/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'İlanlar çoğunlukla bağlı emlak profesyonelleri üzerinden yayınlanır.',
      },
      {
        id: 'marktplaats',
        name: 'Marktplaats',
        publishUrl: 'https://www.marktplaats.nl/plaats',
        pricingUrl: 'https://www.marktplaats.nl/plaats',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Genel ilan platformu; kategoriye göre ücret değişebilir.',
      },
    ],
  },
  {
    code: 'AE',
    country: 'Dubai / BAE',
    flag: '🇦🇪',
    language: 'İngilizce',
    locale: 'en-AE',
    portals: [
      {
        id: 'bayut',
        name: 'Bayut',
        publishUrl: 'https://www.bayut.com/agentportal/',
        pricingUrl: 'https://www.bayut.com/agentportal/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Doğrulanmış emlak profesyoneli ve ilan paketi gerektirir.',
      },
      {
        id: 'property-finder-ae',
        name: 'Property Finder',
        publishUrl: 'https://www.propertyfinder.ae/en/agent',
        pricingUrl: 'https://www.propertyfinder.ae/en/agent',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Profesyonel emlakçı hesabı ve sözleşme gerektirir.',
      },
      {
        id: 'dubizzle-ae',
        name: 'Dubizzle',
        publishUrl: 'https://dubai.dubizzle.com/place-an-ad/',
        pricingUrl: 'https://dubai.dubizzle.com/place-an-ad/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Genel ilan ve gayrimenkul kategorileri sunar.',
      },
    ],
  },
  {
    code: 'US',
    country: 'ABD',
    flag: '🇺🇸',
    language: 'İngilizce',
    locale: 'en-US',
    portals: [
      {
        id: 'zillow',
        name: 'Zillow',
        publishUrl: 'https://www.zillow.com/for-sale-by-owner/',
        pricingUrl: 'https://www.zillow.com/for-sale-by-owner/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'FSBO ve profesyonel akışlar farklıdır; Türkiye’deki mülk uygunluğu doğrulanmalıdır.',
      },
      {
        id: 'realtor-com',
        name: 'Realtor.com',
        publishUrl: 'https://www.realtor.com/marketing/resources/',
        pricingUrl: 'https://www.realtor.com/marketing/resources/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'MLS ve profesyonel veri ortakları üzerinden çalışır.',
      },
      {
        id: 'redfin',
        name: 'Redfin',
        publishUrl: 'https://www.redfin.com/sell-a-home',
        pricingUrl: 'https://www.redfin.com/sell-a-home',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Redfin hizmet bölgeleri ve temsilci akışıyla sınırlıdır.',
      },
    ],
  },
  {
    code: 'CA',
    country: 'Kanada',
    flag: '🇨🇦',
    language: 'İngilizce',
    locale: 'en-CA',
    portals: [
      {
        id: 'realtor-ca',
        name: 'Realtor.ca',
        publishUrl: 'https://www.realtor.ca/realtors',
        pricingUrl: 'https://www.realtor.ca/realtors',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Kanada emlak kurulları ve REALTOR® üyeleri üzerinden yayınlanır.',
      },
      {
        id: 'kijiji-ca',
        name: 'Kijiji',
        publishUrl: 'https://www.kijiji.ca/p-post-ad.html',
        pricingUrl: 'https://www.kijiji.ca/p-post-ad.html',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Genel ilan platformu; kategori ve öne çıkarma seçenekleri fiyatı değiştirir.',
      },
    ],
  },
  {
    code: 'AU',
    country: 'Avustralya',
    flag: '🇦🇺',
    language: 'İngilizce',
    locale: 'en-AU',
    portals: [
      {
        id: 'realestate-au',
        name: 'realestate.com.au',
        publishUrl: 'https://www.realestate.com.au/advertise/',
        pricingUrl: 'https://www.realestate.com.au/advertise/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Profesyonel ilan ve reklam paketleri sunar.',
      },
      {
        id: 'domain-au',
        name: 'Domain',
        publishUrl: 'https://www.domain.com.au/advertise/',
        pricingUrl: 'https://www.domain.com.au/advertise/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Emlak profesyonellerine yönelik ilan paketleri sunar.',
      },
    ],
  },
  {
    code: 'CH',
    country: 'İsviçre',
    flag: '🇨🇭',
    language: 'Almanca',
    locale: 'de-CH',
    portals: [
      {
        id: 'homegate',
        name: 'Homegate',
        publishUrl: 'https://www.homegate.ch/c/en/advertise',
        pricingUrl: 'https://www.homegate.ch/c/en/advertise',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Bireysel ve ticari ilan paketleri bulunur.',
      },
      {
        id: 'immoscout24-ch',
        name: 'ImmoScout24',
        publishUrl: 'https://www.immoscout24.ch/c/en/advertise',
        pricingUrl: 'https://www.immoscout24.ch/c/en/advertise',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'İlan süresi ve paket seçimine göre ücretlendirilir.',
      },
    ],
  },
  {
    code: 'AT',
    country: 'Avusturya',
    flag: '🇦🇹',
    language: 'Almanca',
    locale: 'de-AT',
    portals: [
      {
        id: 'willhaben',
        name: 'Willhaben',
        publishUrl: 'https://www.willhaben.at/iad/immobilien/immobilien-inserieren',
        pricingUrl: 'https://www.willhaben.at/iad/immobilien/immobilien-inserieren',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Sahibinden benzeri genel ilan ve emlak akışı sunar.',
      },
      {
        id: 'immobilienscout24-at',
        name: 'ImmobilienScout24',
        publishUrl: 'https://www.immobilienscout24.at/immobilie-inserieren/',
        pricingUrl: 'https://www.immobilienscout24.at/immobilie-inserieren/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Bireysel ve profesyonel ilan paketleri bulunur.',
      },
    ],
  },
  {
    code: 'BE',
    country: 'Belçika',
    flag: '🇧🇪',
    language: 'Fransızca',
    locale: 'fr-BE',
    portals: [
      {
        id: 'immoweb',
        name: 'Immoweb',
        publishUrl: 'https://www.immoweb.be/en/post-an-ad',
        pricingUrl: 'https://www.immoweb.be/en/post-an-ad',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Bireysel ve profesyonel gayrimenkul ilanları sunar.',
      },
    ],
  },
  {
    code: 'GR',
    country: 'Yunanistan',
    flag: '🇬🇷',
    language: 'Yunanca',
    locale: 'el-GR',
    portals: [
      {
        id: 'spitogatos',
        name: 'Spitogatos',
        publishUrl: 'https://www.spitogatos.gr/en/advertise',
        pricingUrl: 'https://www.spitogatos.gr/en/advertise',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Yunanistan gayrimenkul ilanı ve profesyonel paketleri sunar.',
      },
    ],
  },
];

function safeText(value: unknown, fallback: string, max: number) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

function verifiedPropertySummary(property: MarketingProperty) {
  return [
    property.title,
    property.location,
    property.roomCount,
    property.area ? `${property.area} m²` : null,
    property.price
      ? new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: 'TRY',
          maximumFractionDigits: 0,
        }).format(property.price)
      : null,
    property.referenceCode ? `Ref: ${property.referenceCode}` : null,
    property.description,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function getInternationalMarket(countryCode: string) {
  return INTERNATIONAL_MARKETS.find((market) => market.code === countryCode);
}

export function buildInternationalFallback(input: {
  companyName: string;
  property: MarketingProperty;
  market: InternationalMarket;
}): InternationalMarketingPlan {
  const { companyName, property, market } = input;
  const summary = verifiedPropertySummary(property);
  return {
    countryCode: market.code,
    countryName: market.country,
    language: market.language,
    strategy: `${market.country} pazarı için ${property.title} portföyünün doğrulanmış bilgilerini kullanan, portal kurallarına göre ayrı ayrı uygulanacak ilan planı.`,
    warnings: [
      'Portalın Türkiye’de bulunan gayrimenkulleri kabul edip etmediğini yayınlamadan önce doğrulayın.',
      'Fiyatlar ve paket koşulları değişebileceği için yalnızca resmi fiyat bağlantısını esas alın.',
      'Vergi, oturum, vatandaşlık veya yatırım getirisi hakkında doğrulanmamış vaat kullanmayın.',
    ],
    portalCopies: market.portals.map((portal) => ({
      portalId: portal.id,
      portalName: portal.name,
      title: `${property.title} | ${property.location || 'Türkiye'}`.slice(0, 100),
      body: `${summary}\n\n${companyName} ile güncel bilgi ve görüntüleme randevusu için iletişime geçin.`.slice(
        0,
        3000
      ),
      steps: [
        `${portal.name} yayın bağlantısını açın.`,
        portal.accountType === 'professional'
          ? 'Profesyonel emlakçı hesabınızla giriş yapın veya üyelik başvurusu oluşturun.'
          : 'Hesabınızla giriş yapın ve gayrimenkul ilanı kategorisini seçin.',
        'Mülkün Türkiye’deki gerçek konumunu, fiyatını ve özelliklerini eksiksiz girin.',
        'Yayınlamadan önce portalın güncel ücretini ve yurt dışı mülk politikasını kontrol edin.',
      ],
      publishUrl: portal.publishUrl,
      pricingUrl: portal.pricingUrl,
      pricingLabel: portal.pricingLabel,
    })),
  };
}

export function parseInternationalPlan(
  rawContent: string,
  fallback: InternationalMarketingPlan,
  market: InternationalMarket
): InternationalMarketingPlan {
  if (!rawContent.trim()) return fallback;
  try {
    const match = rawContent.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] || rawContent) as Record<string, unknown>;
    const rawCopies = Array.isArray(parsed.portalCopies)
      ? parsed.portalCopies
      : [];
    const portalCopies = fallback.portalCopies.map((defaultCopy) => {
      const candidate = rawCopies.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item as Record<string, unknown>).portalId === defaultCopy.portalId
      ) as Record<string, unknown> | undefined;
      if (!candidate) return defaultCopy;
      const rawSteps = Array.isArray(candidate.steps)
        ? candidate.steps
            .filter(
              (item): item is string =>
                typeof item === 'string' && Boolean(item.trim())
            )
            .slice(0, 8)
            .map((item) => item.slice(0, 300))
        : defaultCopy.steps;
      return {
        ...defaultCopy,
        title: safeText(candidate.title, defaultCopy.title, 160),
        body: safeText(candidate.body, defaultCopy.body, 5000),
        steps: rawSteps.length ? rawSteps : defaultCopy.steps,
      };
    });
    return {
      countryCode: market.code,
      countryName: market.country,
      language: market.language,
      strategy: safeText(parsed.strategy, fallback.strategy, 1500),
      warnings: Array.isArray(parsed.warnings)
        ? parsed.warnings
            .filter(
              (item): item is string =>
                typeof item === 'string' && Boolean(item.trim())
            )
            .slice(0, 8)
            .map((item) => item.slice(0, 400))
        : fallback.warnings,
      portalCopies,
    };
  } catch {
    return fallback;
  }
}
