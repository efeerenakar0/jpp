import type { MarketingProperty } from '@/lib/marketing-content';

export type InternationalPortal = {
  id: string;
  name: string;
  publishUrl: string;
  pricingUrl: string;
  pricingLabel: string;
  accountType: 'individual' | 'professional' | 'both';
  note: string;
  eligibilityNote?: string;
  lastVerifiedAt?: string;
  requiredFields?: string[];
  imageGuidance?: string;
  titleLimit?: number;
  descriptionLimit?: number;
  eligibility?: 'direct' | 'membership' | 'campaign_only' | 'verify' | 'unsupported';
  publishMode?: 'manual' | 'feed' | 'membership' | 'partner' | 'landing_page';
  listingOrder?: string[];
  mediaRules?: string[];
  officialSourceUrl?: string;
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
  currency?: string;
  timezone?: string;
  measurementSystem?: string;
  buyerFocus?: string;
  socialChannels?: string[];
  portals: InternationalPortal[];
};

export type InternationalPortalCopy = {
  portalId: string;
  portalName: string;
  title: string;
  body: string;
  titleTr?: string;
  bodyTr?: string;
  steps: string[];
  publishUrl: string;
  pricingUrl: string;
  pricingLabel: string;
};

export type InternationalSocialChannelPlan = {
  channel: string;
  objective: string;
  format: string;
  contentAngle: string;
  localCta: string;
  publishingWindow: string;
};

export type InternationalSocialPlan = {
  channels: InternationalSocialChannelPlan[];
  complianceNotes: string[];
};

export type InternationalMarketingPlan = {
  countryCode: string;
  countryName: string;
  language: string;
  strategy: string;
  warnings: string[];
  portalCopies: InternationalPortalCopy[];
  socialPlan?: InternationalSocialPlan;
};

const variablePricing =
  'Ücret ilan türü, süre ve profesyonel pakete göre değişir; yayınlamadan önce güncel fiyatı kontrol edin.';
const professionalPricing =
  'Profesyonel emlakçı üyeliği veya teklif gerekir; güncel ücret için satış ekibine başvurun.';

type MarketPlaybook = Pick<
  InternationalMarket,
  | 'currency'
  | 'timezone'
  | 'measurementSystem'
  | 'buyerFocus'
  | 'socialChannels'
>;

const MARKET_PLAYBOOKS: Record<string, MarketPlaybook> = {
  DE: {
    currency: 'EUR (€)',
    timezone: 'Europe/Berlin',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Konum, enerji durumu, toplam maliyet ve doğrulanmış teknik özellikleri başta gösterin.',
    socialChannels: ['Google Ads', 'Instagram', 'Facebook', 'YouTube', 'LinkedIn'],
  },
  GB: {
    currency: 'GBP (£)',
    timezone: 'Europe/London',
    measurementSystem: 'sq ft + m² birlikte',
    buyerFocus:
      'Overseas alıcı için bölge erişimi, kullanım amacı, bakım giderleri ve satın alma sürecini açık anlatın.',
    socialChannels: ['Google Ads', 'Instagram', 'Facebook', 'YouTube', 'Pinterest'],
  },
  ES: {
    currency: 'EUR (€)',
    timezone: 'Europe/Madrid',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Yaşam tarzı görsellerini net konum, m², masraf ve gerçek portföy bilgileriyle dengeleyin.',
    socialChannels: ['Instagram', 'Facebook', 'TikTok', 'YouTube', 'WhatsApp'],
  },
  FR: {
    currency: 'EUR (€)',
    timezone: 'Europe/Paris',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Sade başlık, gerçek posta konumu, enerji ve yapı bilgileri ile fotoğraf sırasına öncelik verin.',
    socialChannels: ['Facebook', 'Instagram', 'Google Ads', 'YouTube', 'Pinterest'],
  },
  IT: {
    currency: 'EUR (€)',
    timezone: 'Europe/Rome',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Mimari karakter, kullanım alanı, erişim ve bakım durumunu doğrulanabilir ayrıntılarla anlatın.',
    socialChannels: ['Instagram', 'Facebook', 'Google Ads', 'YouTube', 'WhatsApp'],
  },
  PT: {
    currency: 'EUR (€)',
    timezone: 'Europe/Lisbon',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Konum, güneş/cephe, dış alanlar ve toplam sahip olma maliyetini ölçülü bir dille öne çıkarın.',
    socialChannels: ['Instagram', 'Facebook', 'Google Ads', 'YouTube', 'WhatsApp'],
  },
  NL: {
    currency: 'EUR (€)',
    timezone: 'Europe/Amsterdam',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Enerji, plan, net kullanım alanı ve ulaşım bilgisini kısa, karşılaştırılabilir bloklarla verin.',
    socialChannels: ['Facebook', 'Instagram', 'Google Ads', 'LinkedIn', 'YouTube'],
  },
  AE: {
    currency: 'AED (د.إ)',
    timezone: 'Asia/Dubai',
    measurementSystem: 'sq ft + m² birlikte',
    buyerFocus:
      'Lisans, ilan izni, proje/teslim durumu, aidat ve konumu açıkça gösterin; getiri vaadini doğrulamadan kullanmayın.',
    socialChannels: ['Instagram', 'TikTok', 'YouTube', 'LinkedIn', 'WhatsApp'],
  },
  US: {
    currency: 'USD ($)',
    timezone: 'Hedef eyalet/saat dilimi',
    measurementSystem: 'sq ft + m² birlikte',
    buyerFocus:
      'Overseas mülk uygunluğunu önce doğrulayın; erişim, toplam maliyet ve inceleme sürecini açık anlatın.',
    socialChannels: ['Google Ads', 'Instagram', 'Facebook', 'YouTube', 'Pinterest'],
  },
  CA: {
    currency: 'CAD (C$)',
    timezone: 'Hedef eyalet/saat dilimi',
    measurementSystem: 'sq ft + m² birlikte',
    buyerFocus:
      'Uluslararası alıcı için konum, iklim/kullanım dönemi ve gerçek toplam maliyetleri şeffaf biçimde verin.',
    socialChannels: ['Google Ads', 'Instagram', 'Facebook', 'YouTube', 'LinkedIn'],
  },
  AU: {
    currency: 'AUD (A$)',
    timezone: 'Hedef eyalet/saat dilimi',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Yurt dışı portföy kabulünü doğrulayın; plan, dış alan, erişim ve kullanım senaryosunu görselleştirin.',
    socialChannels: ['Instagram', 'Facebook', 'Google Ads', 'YouTube', 'Pinterest'],
  },
  CH: {
    currency: 'CHF',
    timezone: 'Europe/Zurich',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Hedef kantonun dilini seçin; kalite, teknik durum ve maliyetleri kısa ve kesin ifadelerle verin.',
    socialChannels: ['Google Ads', 'Instagram', 'Facebook', 'LinkedIn', 'YouTube'],
  },
  AT: {
    currency: 'EUR (€)',
    timezone: 'Europe/Vienna',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Enerji, plan, kat, dış alan ve ulaşım bilgisini doğrulanmış alanlarla öne çıkarın.',
    socialChannels: ['Google Ads', 'Instagram', 'Facebook', 'YouTube', 'LinkedIn'],
  },
  BE: {
    currency: 'EUR (€)',
    timezone: 'Europe/Brussels',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Bölgeye göre Fransızca veya Felemenkçe seçin; enerji ve toplam maliyeti netleştirin.',
    socialChannels: ['Facebook', 'Instagram', 'Google Ads', 'LinkedIn', 'Pinterest'],
  },
  GR: {
    currency: 'EUR (€)',
    timezone: 'Europe/Athens',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'Konum, denize/ulaşıma erişim, yapı durumu ve masrafları doğrulanabilir biçimde öne çıkarın.',
    socialChannels: ['Instagram', 'Facebook', 'Google Ads', 'YouTube', 'WhatsApp'],
  },
  RU: {
    currency: 'Portalda yaygın EUR / RUB gösterimi',
    timezone: 'Europe/Moscow',
    measurementSystem: 'm² · oda/yatak odası ayrı',
    buyerFocus:
      'Kaynak fiyatı TRY olarak koruyun; kıyı, havaalanı, market ve plaj mesafelerini yalnız doğrulanmışsa öne çıkarın.',
    socialChannels: ['VK', 'Telegram', 'YouTube', 'Instagram', 'WhatsApp'],
  },
  SE: {
    currency: 'EUR (€) · yaklaşık SEK',
    timezone: 'Europe/Stockholm',
    measurementSystem: 'm² · metrik sistem',
    buyerFocus:
      'İlan yerine İsveççe ofis profili ve Türkiye portföy sayfası hazırlayın; satın alma sürecini sade anlatın.',
    socialChannels: ['Facebook', 'Instagram', 'Google Ads', 'YouTube', 'LinkedIn'],
  },
  NO: {
    currency: 'EUR (€) veya NOK',
    timezone: 'Europe/Oslo',
    measurementSystem: 'm² · yatak odası ayrı',
    buyerFocus:
      'Fiyat ve aidatı başta; manzara, balkon, otopark, güvenlik ve ulaşımı doğrulanmış alanlarla gösterin.',
    socialChannels: ['Facebook', 'Instagram', 'Google Ads', 'YouTube', 'LinkedIn'],
  },
  SA: {
    currency: 'EUR (€) · yaklaşık SAR',
    timezone: 'Asia/Riyadh',
    measurementSystem: 'm² · yatak/banyo ayrı',
    buyerFocus:
      'Portal ilanı vaat etmeyin; Arapça öncelikli kampanya, proje durumu, teslim ve ödeme bilgilerini doğrulayarak sunun.',
    socialChannels: ['Snapchat', 'Instagram', 'TikTok', 'YouTube', 'WhatsApp'],
  },
  QA: {
    currency: 'EUR (€) · yaklaşık QAR',
    timezone: 'Asia/Qatar',
    measurementSystem: 'm² + ft² birlikte',
    buyerFocus:
      'Hesap uygunluğunu elle doğrulayın; İngilizce ve Arapça içerikte konum, fiyat ve gerçek fotoğrafları öne çıkarın.',
    socialChannels: ['Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'WhatsApp'],
  },
};

const DEFAULT_REQUIRED_FIELDS = [
  'İşlem türü ve taşınmaz kategorisi',
  'Gerçek konum ve adres biçimi',
  'Fiyat ve para birimi',
  'Alan, oda ve temel özellikler',
  'Yetkili satıcı/işletme bilgisi',
  'Yüksek çözünürlüklü fotoğraflar',
];

const PORTAL_PLAYBOOKS: Partial<
  Record<string, Partial<InternationalPortal>>
> = {
  'immobilienscout24-de': {
    eligibility: 'direct',
    publishMode: 'manual',
    officialSourceUrl:
      'https://www.immobilienscout24.de/Suche/tr/auslandsimmobilien',
    eligibilityNote:
      'ImmoScout24 üzerinde Türkiye’deki yurt dışı gayrimenkuller için aktif arama ve ilan akışı bulunur; hesap koşulunu yayın öncesi doğrulayın.',
    listingOrder: [
      'Başlık, tam adres ve fiyat',
      'Toplam oda, yatak odası ve m²',
      'Maliyet ve aidat',
      'Yapı ve enerji bilgileri',
      'Objektbeschreibung, Ausstattung ve Lage',
      'Kat planı ve belgeler',
    ],
    requiredFields: [
      'Tam adres ve harita konumu',
      'Satış fiyatı ve para birimi',
      'Toplam oda, yatak odası ve m²',
      'Aidat ve bilinen ek maliyetler',
      'Bina yaşı ve varsa enerji belgesi',
      'Gerçek fotoğraflar ve okunabilir kat planı',
    ],
    imageGuidance:
      'Ana görselde mülkün en güçlü gerçek alanını kullanın; ardından iç mekân, dış alan, manzara ve okunabilir kat planını sıralayın.',
  },
  rightmove: {
    eligibility: 'membership',
    publishMode: 'feed',
    officialSourceUrl:
      'https://www.rightmove.co.uk/overseas-property/advertise/estate-agent',
    eligibilityNote:
      'Türkiye’deki taşınmazlar için Rightmove Overseas üyeliği veya özel satıcı akışı kullanılmalıdır.',
    descriptionLimit: 32000,
    listingOrder: [
      'Referans ve gerçek adres',
      'Şehir, bölge ve ülke kodu',
      'İlk 5 doğrulanmış özellik',
      'Kısa özet ve ayrıntılı açıklama',
      'Yatak odası, fiyat ve mülk türü',
      'Fotoğraf, plan, broşür ve sanal tur',
    ],
    requiredFields: [
      'Overseas üyelik türü',
      'Taşınmaz türü ve gerçek ülke/konum',
      'Fiyat ve temel özellikler',
      'Fotoğraf, plan, broşür ve varsa sanal tur',
      'Pazarlama yetkisi ve iletişim bilgileri',
    ],
    imageGuidance:
      'Fotoğraf, kat planı, broşür ve sanal tur desteklenir; ilk görseli portföyün en güçlü dış/yaşam alanından seçin.',
  },
  'idealista-es': {
    eligibility: 'verify',
    publishMode: 'manual',
    officialSourceUrl:
      'https://www.idealista.com/ayuda/articulos/what-information-should-a-listing-have/?lang=en',
    eligibilityNote:
      'Mülkün gerçek konumu ve yayın yetkisi zorunludur; aynı portföyü farklı hesaplarla çoğaltmayın.',
    imageGuidance:
      'Aynı taşınmazı yinelenen ilanlarla yayınlamayın; çevre fotoğraflarını portföy görsellerinden ayrı tutun.',
    mediaRules: [
      'Filigran, logo, metin, çerçeve ve fotoğraf kolajı kullanmayın.',
      'Yapay zekâ ile değiştirilmiş görseli açıkça belirtin ve gerçek fotoğrafla birlikte sunun.',
      'Aynı fotoğrafı tekrarlamayın; çevre fotoğrafını en fazla üç adet tutun.',
    ],
  },
  'idealista-it': {
    eligibilityNote:
      'Türkiye’deki portföyün ilgili ülke ürününde yayınlanabilirliğini portal desteğiyle doğrulayın.',
  },
  'idealista-pt': {
    eligibilityNote:
      'Türkiye’deki portföyün ilgili ülke ürününde yayınlanabilirliğini portal desteğiyle doğrulayın.',
  },
  seloger: {
    eligibilityNote:
      'Gerçek belediye/posta konumu kullanılmalı; Türkiye’deki portföy kabulünü yayın öncesi doğrulayın.',
    imageGuidance:
      'Bireysel yayın akışında fotoğraf kotası pakete göre değişebilir; güncel yükleme ekranını esas alın.',
  },
  bayut: {
    eligibility: 'campaign_only',
    publishMode: 'landing_page',
    officialSourceUrl: 'https://www.bayut.com/agentportal/',
    eligibilityNote:
      'BAE ilanlarında geçerli emlak lisansı ve ilgili ilan izinleri gerekir. Türkiye portföyü için uygunluğu Bayut ile doğrulayın.',
    requiredFields: [
      'Amaç, kategori ve konum',
      'Tamamlanma ve eşya durumu',
      'Başlık ve en az açıklayıcı bir metin',
      'Alan, yatak/banyo ve olanaklar',
      'Referans, ilan/izin numarası ve fiyat',
      'Fotoğraf, video ve varsa kat planı',
    ],
    imageGuidance:
      'Yüksek kaliteli fotoğraflar, doğru kat planı, video ve 360° tur görünürlüğü artırır.',
  },
  'property-finder-ae': {
    eligibility: 'campaign_only',
    publishMode: 'landing_page',
    titleLimit: 50,
    descriptionLimit: 2000,
    officialSourceUrl:
      'https://support.propertyfinder.ae/hc/en-us/articles/23314960066834-What-is-Listing-Quality-Score',
    eligibilityNote:
      'BAE içi ilanlarda güncel broker/agent lisansı gerekir; Türkiye portföyünün kabulünü satış ekibiyle doğrulayın.',
    mediaRules: [
      'Yatak odası sayısına göre en az 4–10 gerçek fotoğraf hazırlayın.',
      'En az 800×600 çözünürlük kullanın; kolaj ve tekrarlı görsel kullanmayın.',
      'En fazla 30 fotoğraf hazırlayın.',
    ],
  },
  'dubizzle-ae': {
    eligibility: 'campaign_only',
    publishMode: 'landing_page',
    eligibilityNote:
      'Yerel ilan izinleri geçerli olabilir; Türkiye’deki mülk için kategori ve ülke uygunluğunu doğrulayın.',
  },
  zillow: {
    eligibility: 'unsupported',
    publishMode: 'partner',
    eligibilityNote:
      'ABD dışındaki taşınmazların ve Türkiye portföylerinin uygunluğu sınırlı olabilir; yayınlamadan önce doğrulayın.',
  },
  'realtor-com': {
    eligibility: 'membership',
    publishMode: 'partner',
    officialSourceUrl: 'https://www.realtor.com/international/',
    eligibilityNote:
      'İlanlar çoğunlukla MLS ve profesyonel veri ortaklarından gelir; Türkiye portföyü için doğrudan yayın varsaymayın.',
  },
  redfin: {
    eligibility: 'unsupported',
    publishMode: 'partner',
    eligibilityNote:
      'Hizmet bölgesi ve yerel listeleme ağıyla sınırlıdır; Türkiye portföyü için uygun bir dağıtım kanalı olmayabilir.',
  },
  'realtor-ca': {
    eligibilityNote:
      'Kanada emlak kurulları ve REALTOR® veri akışına dayanır; Türkiye portföyü için doğrudan yayın varsaymayın.',
  },
  funda: {
    eligibility: 'membership',
    publishMode: 'partner',
    officialSourceUrl: 'https://www.funda.nl/en/voormakelaars/wonen/registreren/',
    eligibilityNote:
      'Türkiye ilan örnekleri bulunur; yayın için onaylı giriş ortağı veya profesyonel hesap gerekir.',
    listingOrder: [
      'Başlık, fiyat, m² ve oda',
      'Açıklama',
      'Overdracht ve Bouw',
      'Alan, hacim ve Indeling',
      'Enerji, dış alan ve park',
      'VvE bilgileri',
    ],
  },
  prian: {
    eligibility: 'direct',
    publishMode: 'membership',
    officialSourceUrl: 'https://prian.ru/about/subscription/',
    eligibilityNote:
      'Prian, Türkiye dahil yurt dışı emlak ilanlarını kabul eden profesyonel bir dağıtım portalıdır.',
    listingOrder: [
      'Fiyat, tür ve konum',
      'm², oda, yatak ve banyo',
      'Doğrulanmış özellik rozetleri',
      'Ayrıntılı Rusça açıklama',
      'Dış cephe, manzara ve iç mekân fotoğrafları',
    ],
    imageGuidance:
      'Fotoğrafları dış cephe, manzara ve iç mekân sırasıyla hazırlayın; doğrulanmamış rozet veya vaat kullanmayın.',
  },
  'hemnet-utland': {
    eligibility: 'campaign_only',
    publishMode: 'landing_page',
    officialSourceUrl:
      'https://www.hemnet.se/kundservice/maklare/alla%20kategorier-category-all-categories/vilka-moejligheter-har-jag-att-marknadsfoera-bostaeder-i-utlandet-document-54420c2c-d543-412b-a2fe-e5ca557f9a46',
    eligibilityNote:
      'Hemnet yabancı konutu kendi ilan kartında yayınlamaz; ofis profilinden sizin İsveççe portföy sayfanıza yönlendirir.',
  },
  'finn-abroad': {
    eligibility: 'direct',
    publishMode: 'manual',
    officialSourceUrl:
      'https://www.finn.no/realestate/abroad/search.html?leisure_situation=2&location=1.25002.-53',
    eligibilityNote:
      'FINN’in yurt dışı gayrimenkul bölümünde Türkiye ilanları için doğrudan kategori bulunur.',
    listingOrder: [
      'Fiyat ve aidat',
      'Temel bilgiler ve alan',
      'Olanaklar ve gösterim',
      'Konum, iç mekân ve standart',
      'Çevre ve ulaşım',
    ],
  },
  'bayut-sa': {
    eligibility: 'campaign_only',
    publishMode: 'landing_page',
    officialSourceUrl: 'https://www.bayut.sa/blog/en/bayut-academy/profolio/',
    eligibilityNote:
      'Bayut KSA yerel reklam ruhsatı ve kimlik/şirket doğrulaması ister; Türkiye stoğu için yalnız Arapça kampanya ve açılış sayfası hazırlayın.',
  },
  'qatar-living': {
    eligibility: 'verify',
    publishMode: 'manual',
    officialSourceUrl: 'https://www.qatarliving.com/en/page/rules-for-advertising',
    eligibilityNote:
      'Uluslararası emlak bölümü Türkiye’yi gösterse de genel kurallar Katar telefonu ve QAR ister; hesap uygunluğunu elle doğrulayın.',
    mediaRules: [
      'En az beş yatay ve yüksek kaliteli gerçek fotoğraf hazırlayın.',
      'Grafik, tekrar ve ağır filigran kullanmayın.',
      'Başlıkta emoji ve tekrarlı işaret; açıklamada telefon/e-posta kullanmayın.',
    ],
  },
  'realestate-au': {
    eligibilityNote:
      'Profesyonel üyelik ve desteklenen veri akışı gerekir; Türkiye portföyü için uygunluğu doğrulayın.',
  },
  'domain-au': {
    eligibilityNote:
      'Profesyonel ilan paketi gerekir; Türkiye portföyünün kabulünü satış ekibiyle doğrulayın.',
  },
};

const BASE_INTERNATIONAL_MARKETS: InternationalMarket[] = [
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
  {
    code: 'RU',
    country: 'Rusya',
    flag: '🇷🇺',
    language: 'Rusça',
    locale: 'ru-RU',
    portals: [
      {
        id: 'prian',
        name: 'Prian.ru',
        publishUrl: 'https://prian.ru/about/subscription/',
        pricingUrl: 'https://prian.ru/about/subscription/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Türkiye dahil yurt dışı emlak için profesyonel ilan üyeliği sunar.',
      },
    ],
  },
  {
    code: 'SE',
    country: 'İsveç',
    flag: '🇸🇪',
    language: 'İsveççe',
    locale: 'sv-SE',
    portals: [
      {
        id: 'hemnet-utland',
        name: 'Hemnet Utland',
        publishUrl: 'https://www.hemnet.se/utland/turkiet',
        pricingUrl: 'https://www.hemnet.se/utland/turkiet',
        pricingLabel: 'Yabancı ilan yerine ofis ve web sitesi yönlendirme modeli kullanılır.',
        accountType: 'professional',
        note: 'İsveççe ofis profili ve kendi web sitenizdeki Türkiye portföy sayfasına yönlendirme gerekir.',
      },
    ],
  },
  {
    code: 'NO',
    country: 'Norveç',
    flag: '🇳🇴',
    language: 'Norveççe',
    locale: 'nb-NO',
    portals: [
      {
        id: 'finn-abroad',
        name: 'FINN Utland',
        publishUrl: 'https://www.finn.no/realestate/abroad/search.html?leisure_situation=2&location=1.25002.-53',
        pricingUrl: 'https://www.finn.no/realestate/abroad/',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Yurt dışı gayrimenkul bölümünde Türkiye için doğrudan ilan kategorisi bulunur.',
      },
    ],
  },
  {
    code: 'SA',
    country: 'Suudi Arabistan',
    flag: '🇸🇦',
    language: 'Arapça',
    locale: 'ar-SA',
    portals: [
      {
        id: 'bayut-sa',
        name: 'Bayut KSA',
        publishUrl: 'https://www.bayut.sa/blog/en/bayut-academy/profolio/',
        pricingUrl: 'https://www.bayut.sa/blog/en/bayut-academy/profolio/',
        pricingLabel: professionalPricing,
        accountType: 'professional',
        note: 'Yerel kimlik, şirket ve reklam ruhsatı gerektirir; Türkiye stoğu için kampanya modu kullanılmalıdır.',
      },
    ],
  },
  {
    code: 'QA',
    country: 'Katar',
    flag: '🇶🇦',
    language: 'İngilizce / Arapça',
    locale: 'en-QA',
    portals: [
      {
        id: 'qatar-living',
        name: 'Qatar Living International',
        publishUrl: 'https://www.qatarliving.com/en/properties',
        pricingUrl: 'https://www.qatarliving.com/en/page/rules-for-advertising',
        pricingLabel: variablePricing,
        accountType: 'both',
        note: 'Türkiye bölümü görünür ancak hesap ve yayın uygunluğu elle doğrulanmalıdır.',
      },
    ],
  },
];

export const INTERNATIONAL_MARKETS: InternationalMarket[] =
  BASE_INTERNATIONAL_MARKETS.map((market) => ({
    ...market,
    ...MARKET_PLAYBOOKS[market.code],
    portals: market.portals.map((portal) => ({
      ...portal,
      eligibilityNote:
        'Türkiye’deki taşınmazların kabulünü ve doğru hesap türünü yayınlamadan önce portalın resmî ekibiyle doğrulayın.',
      lastVerifiedAt: PORTAL_PLAYBOOKS[portal.id]?.officialSourceUrl
        ? '2026-08-13'
        : undefined,
      requiredFields: DEFAULT_REQUIRED_FIELDS,
      imageGuidance:
        'İlk sıraya güçlü ana görseli, ardından salon, mutfak, odalar, dış alan, manzara ve planı yerleştirin.',
      ...PORTAL_PLAYBOOKS[portal.id],
    })),
  }));

function safeText(value: unknown, fallback: string, max: number) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, max)
    : fallback;
}

function verifiedPropertyFacts(property: MarketingProperty) {
  return [
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
  ]
    .filter(Boolean)
    .join(' · ');
}

const FOREIGN_MONEY_AMOUNT =
  /(?:(?:€|£|\$|₽|¥|₣|C\$|A\$|USD|EUR|EURO|GBP|POUND|AED|SAR|QAR|RUB|NOK|SEK|CHF|CAD|AUD)\s*[\d.,]+|[\d.,]+\s*(?:€|£|\$|₽|¥|₣|C\$|A\$|USD|EUR|EURO|GBP|POUND|AED|SAR|QAR|RUB|NOK|SEK|CHF|CAD|AUD))/i;

const TRY_MONEY_AMOUNT =
  /(?:(?:₺|TRY|TL)\s*([\d.,]+)|([\d.,]+)\s*(?:₺|TRY|TL))/gi;

function containsWrongTryAmount(value: string, sourcePrice?: number | null) {
  if (!sourcePrice) return false;
  const expected = String(Math.round(sourcePrice));
  TRY_MONEY_AMOUNT.lastIndex = 0;
  for (const match of value.matchAll(TRY_MONEY_AMOUNT)) {
    const amount = (match[1] || match[2] || '').replace(/\D/g, '');
    if (amount && amount !== expected) return true;
  }
  return false;
}

function safeGeneratedText(
  value: unknown,
  fallback: string,
  max: number,
  sourcePrice?: number | null,
) {
  const candidate = safeText(value, fallback, max);
  return FOREIGN_MONEY_AMOUNT.test(candidate) ||
    containsWrongTryAmount(candidate, sourcePrice)
    ? fallback
    : candidate;
}

function mergeSafeGeneratedNotes(
  value: unknown,
  required: string[],
  limit: number,
  sourcePrice?: number | null,
) {
  const generated = Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === 'string' &&
            Boolean(item.trim()) &&
            !FOREIGN_MONEY_AMOUNT.test(item) &&
            !containsWrongTryAmount(item, sourcePrice),
        )
        .map((item) => item.trim().slice(0, 400))
    : [];
  return Array.from(new Set([...required, ...generated])).slice(0, limit);
}

type LocalizedFallback = {
  title: (location: string) => string;
  intro: string;
  contact: (companyName: string) => string;
};

const LOCALIZED_FALLBACKS: Record<string, LocalizedFallback> = {
  de: {
    title: (location) => `Immobilie in ${location}`,
    intro: 'Verifizierte Objektdaten',
    contact: (companyName) =>
      `Kontaktieren Sie ${companyName} für aktuelle Informationen und einen Besichtigungstermin.`,
  },
  en: {
    title: (location) => `Property in ${location}`,
    intro: 'Verified property details',
    contact: (companyName) =>
      `Contact ${companyName} for current information and a viewing appointment.`,
  },
  es: {
    title: (location) => `Propiedad en ${location}`,
    intro: 'Datos verificados de la propiedad',
    contact: (companyName) =>
      `Contacte con ${companyName} para obtener información actualizada y concertar una visita.`,
  },
  fr: {
    title: (location) => `Bien immobilier à ${location}`,
    intro: 'Informations vérifiées sur le bien',
    contact: (companyName) =>
      `Contactez ${companyName} pour obtenir les informations à jour et organiser une visite.`,
  },
  it: {
    title: (location) => `Immobile a ${location}`,
    intro: "Dati verificati dell'immobile",
    contact: (companyName) =>
      `Contatta ${companyName} per informazioni aggiornate e per organizzare una visita.`,
  },
  pt: {
    title: (location) => `Imóvel em ${location}`,
    intro: 'Dados verificados do imóvel',
    contact: (companyName) =>
      `Contacte ${companyName} para informações atualizadas e para agendar uma visita.`,
  },
  nl: {
    title: (location) => `Woning in ${location}`,
    intro: 'Geverifieerde woninggegevens',
    contact: (companyName) =>
      `Neem contact op met ${companyName} voor actuele informatie en een bezichtiging.`,
  },
  ru: {
    title: (location) => `Недвижимость в ${location}`,
    intro: 'Проверенные данные об объекте',
    contact: (companyName) =>
      `Свяжитесь с ${companyName}, чтобы получить актуальную информацию и договориться о просмотре.`,
  },
  sv: {
    title: (location) => `Bostad i ${location}`,
    intro: 'Verifierade bostadsuppgifter',
    contact: (companyName) =>
      `Kontakta ${companyName} för aktuell information och en visning.`,
  },
  nb: {
    title: (location) => `Eiendom i ${location}`,
    intro: 'Verifiserte eiendomsopplysninger',
    contact: (companyName) =>
      `Kontakt ${companyName} for oppdatert informasjon og visning.`,
  },
  ar: {
    title: (location) => `عقار في ${location}`,
    intro: 'تفاصيل عقارية موثقة',
    contact: (companyName) =>
      `تواصل مع ${companyName} للحصول على المعلومات الحالية وترتيب المعاينة.`,
  },
  el: {
    title: (location) => `Ακίνητο στην περιοχή ${location}`,
    intro: 'Επαληθευμένα στοιχεία ακινήτου',
    contact: (companyName) =>
      `Επικοινωνήστε με την ${companyName} για ενημερωμένες πληροφορίες και ραντεβού επίσκεψης.`,
  },
};

function localizedFallbackFor(locale: string) {
  return LOCALIZED_FALLBACKS[locale.split('-')[0]] || LOCALIZED_FALLBACKS.en;
}

function socialFormat(channel: string) {
  if (channel === 'Instagram') return '4:5 gönderi + 9:16 Reels/Hikâye';
  if (channel === 'TikTok') return '9:16 kısa video';
  if (channel === 'YouTube') return '16:9 video + 9:16 Shorts';
  if (channel === 'Pinterest') return '2:3 Pin';
  if (channel === 'Google Ads') return 'Arama metni + 1:1 ve 1.91:1 görsel';
  if (channel === 'LinkedIn') return '1.91:1 tek görsel + kısa profesyonel metin';
  if (channel === 'WhatsApp') return '1:1 paylaşım kapağı + izinli kısa mesaj';
  return '1:1 ve 4:5 sosyal gönderi';
}

function buildFallbackSocialPlan(
  market: InternationalMarket,
  companyName: string,
): InternationalSocialPlan {
  const channels = market.socialChannels?.length
    ? market.socialChannels
    : ['Instagram', 'Facebook', 'Google Ads'];
  return {
    channels: channels.map((channel) => ({
      channel,
      objective:
        channel === 'Google Ads'
          ? 'Aktif arama yapan alıcıya ulaşma'
          : channel === 'WhatsApp'
            ? 'İzinli ve doğrudan görüşme başlatma'
            : 'Portföyü keşif ve güven odağında tanıtma',
      format: socialFormat(channel),
      contentAngle:
        market.buyerFocus ||
        'Doğrulanmış konum, özellik ve maliyet bilgilerini açıkça gösterin.',
      localCta: localizedFallbackFor(market.locale).contact(companyName),
      publishingWindow:
        'Hedef ülkenin yerel saatinde test edin; başlangıç için 18:00–21:00 aralığını A/B testine alın.',
    })),
    complianceNotes: [
      'Konut reklamlarında yaş, cinsiyet, etnik köken ve benzeri korunan özelliklere göre ayrımcı hedefleme yapmayın.',
      'Platformun konut reklamı kategorisini ve ülkeye özel reklam politikalarını yayınlamadan önce kontrol edin.',
      'Vergi, oturum, vatandaşlık veya yatırım getirisi konusunda doğrulanmamış vaat kullanmayın.',
    ],
  };
}

export function getInternationalMarket(countryCode: string) {
  return INTERNATIONAL_MARKETS.find((market) => market.code === countryCode);
}

export function getInternationalPortal(
  market: InternationalMarket,
  portalId: string,
) {
  return market.portals.find((portal) => portal.id === portalId);
}

const PORTAL_RECOMMENDATION_SCORE: Record<
  NonNullable<InternationalPortal['eligibility']>,
  number
> = {
  direct: 0,
  membership: 1,
  campaign_only: 2,
  verify: 3,
  unsupported: 4,
};

/**
 * The catalog order is editorial, not a recommendation. Prefer a portal with
 * a proven Turkey/overseas route and keep unsupported portals at the end.
 */
export function recommendInternationalPortal(market: InternationalMarket) {
  return [...market.portals].sort((left, right) => {
    const leftScore = PORTAL_RECOMMENDATION_SCORE[left.eligibility || 'verify'];
    const rightScore = PORTAL_RECOMMENDATION_SCORE[right.eligibility || 'verify'];
    if (leftScore !== rightScore) return leftScore - rightScore;
    const leftHasSource = left.officialSourceUrl ? 0 : 1;
    const rightHasSource = right.officialSourceUrl ? 0 : 1;
    return leftHasSource - rightHasSource;
  })[0];
}

export function buildInternationalFallback(input: {
  companyName: string;
  property: MarketingProperty;
  market: InternationalMarket;
  portal?: InternationalPortal;
}): InternationalMarketingPlan {
  const { companyName, property, market } = input;
  const portals = input.portal ? [input.portal] : market.portals;
  const facts = verifiedPropertyFacts(property);
  const location = property.location || 'Türkiye';
  const localized = localizedFallbackFor(market.locale);
  const campaignOnly = input.portal?.eligibility === 'campaign_only';
  const unsupported = input.portal?.eligibility === 'unsupported';
  return {
    countryCode: market.code,
    countryName: market.country,
    language: market.language,
    strategy: `${market.country} pazarı için ${property.title} portföyünün doğrulanmış bilgilerini kullanan${input.portal ? `, yalnız ${input.portal.name} kurallarına göre hazırlanmış` : ', portal kurallarına göre ayrı ayrı uygulanacak'} ilan planı.`,
    warnings: [
      'Portalın Türkiye’de bulunan gayrimenkulleri kabul edip etmediğini yayınlamadan önce doğrulayın.',
      'Fiyatlar ve paket koşulları değişebileceği için yalnızca resmi fiyat bağlantısını esas alın.',
      'Vergi, oturum, vatandaşlık veya yatırım getirisi hakkında doğrulanmamış vaat kullanmayın.',
    ],
    socialPlan: buildFallbackSocialPlan(market, companyName),
    portalCopies: portals.map((portal) => ({
      portalId: portal.id,
      portalName: portal.name,
      title: localized.title(location).slice(0, 100),
      body: `${localized.intro}: ${facts}\n\n${localized.contact(companyName)}`.slice(
        0,
        3000,
      ),
      titleTr: `${location} konumunda gayrimenkul`.slice(0, 160),
      bodyTr: `Doğrulanmış portföy bilgileri: ${facts}\n\nGüncel bilgi ve görüntüleme randevusu için ${companyName} ile iletişime geçin.`.slice(
        0,
        3000,
      ),
      steps: [
        ...(unsupported
          ? [
              `${portal.name} Türkiye portföyü için uygun kanal değildir; bu portala ilan girmeyin.`,
              'Bu ülke için uygun bir uluslararası portal veya profesyonel dağıtım ortağı seçin.',
            ]
          : campaignOnly
            ? [
                `${market.country} alıcıları için yerel dilde bir açılış sayfası ve reklam paketi hazırlayın.`,
                `${portal.name} reklam veya hesap uygunluğunu resmî ekipten doğrulayın; doğrulanmadan portal ilanı vaat etmeyin.`,
                'Kaynak fiyatı TRY olarak, portföy bilgilerini gerçek kayıtla aynı biçimde koruyun.',
              ]
            : [
                `${portal.name} yayın bağlantısını açın.`,
                portal.accountType === 'professional'
                  ? 'Profesyonel emlakçı hesabınızla giriş yapın veya üyelik başvurusu oluşturun.'
                  : 'Hesabınızla giriş yapın ve gayrimenkul ilanı kategorisini seçin.',
                'Mülkün Türkiye’deki gerçek konumunu, fiyatını ve özelliklerini eksiksiz girin.',
                'Yayınlamadan önce portalın güncel ücretini ve yurt dışı mülk politikasını kontrol edin.',
              ]),
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
  market: InternationalMarket,
  portal?: InternationalPortal,
  sourcePrice?: number | null,
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
        title: safeGeneratedText(
          candidate.title,
          defaultCopy.title,
          portal?.titleLimit || 160,
          sourcePrice,
        ),
        body: safeGeneratedText(
          candidate.body,
          defaultCopy.body,
          portal?.descriptionLimit || 5000,
          sourcePrice,
        ),
        titleTr: safeGeneratedText(
          candidate.titleTr,
          defaultCopy.titleTr || defaultCopy.title,
          220,
          sourcePrice,
        ),
        bodyTr: safeGeneratedText(
          candidate.bodyTr,
          defaultCopy.bodyTr || defaultCopy.body,
          5000,
          sourcePrice,
        ),
        steps:
          rawSteps.length &&
          rawSteps.every(
            (item) =>
              !FOREIGN_MONEY_AMOUNT.test(item) &&
              !containsWrongTryAmount(item, sourcePrice),
          ) &&
          portal?.eligibility !== 'campaign_only' &&
          portal?.eligibility !== 'unsupported'
            ? rawSteps
            : defaultCopy.steps,
      };
    });
    const rawSocialPlan =
      parsed.socialPlan && typeof parsed.socialPlan === 'object'
        ? (parsed.socialPlan as Record<string, unknown>)
        : null;
    const rawSocialChannels = Array.isArray(rawSocialPlan?.channels)
      ? rawSocialPlan.channels
      : [];
    const fallbackSocial = fallback.socialPlan ||
      buildFallbackSocialPlan(market, 'ekibimiz');
    const socialChannels = fallbackSocial.channels.map((defaultChannel) => {
      const candidate = rawSocialChannels.find(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item as Record<string, unknown>).channel === defaultChannel.channel,
      ) as Record<string, unknown> | undefined;
      if (!candidate) return defaultChannel;
      return {
        channel: defaultChannel.channel,
        objective: safeGeneratedText(
          candidate.objective,
          defaultChannel.objective,
          300,
          sourcePrice,
        ),
        format: safeGeneratedText(
          candidate.format,
          defaultChannel.format,
          180,
          sourcePrice,
        ),
        contentAngle: safeGeneratedText(
          candidate.contentAngle,
          defaultChannel.contentAngle,
          500,
          sourcePrice,
        ),
        localCta: safeGeneratedText(
          candidate.localCta,
          defaultChannel.localCta,
          300,
          sourcePrice,
        ),
        publishingWindow: safeGeneratedText(
          candidate.publishingWindow,
          defaultChannel.publishingWindow,
          240,
          sourcePrice,
        ),
      };
    });
    const complianceNotes = mergeSafeGeneratedNotes(
      rawSocialPlan?.complianceNotes,
      fallbackSocial.complianceNotes,
      10,
      sourcePrice,
    );
    return {
      countryCode: market.code,
      countryName: market.country,
      language: market.language,
      strategy: safeGeneratedText(
        parsed.strategy,
        fallback.strategy,
        1500,
        sourcePrice,
      ),
      warnings: mergeSafeGeneratedNotes(
        parsed.warnings,
        fallback.warnings,
        10,
        sourcePrice,
      ),
      portalCopies,
      socialPlan: { channels: socialChannels, complianceNotes },
    };
  } catch {
    return fallback;
  }
}
