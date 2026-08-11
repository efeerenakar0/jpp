export type TurkeyBuyerMarket = {
  code: string;
  name: string;
  language: string;
  priority: number;
  demandSignal: string;
};

/**
 * TÜİK'in yayımladığı yabancılara konut satışı verilerindeki ilk 20 uyruk
 * grubu ve 2025 yıl sonu / 2026 ilk yarı eğilimi esas alınarak hazırlanmış
 * odak pazar kataloğu. Sıra, ürün içindeki çalışma önceliğini belirtir.
 */
export const TURKEY_PROPERTY_BUYER_MARKETS: TurkeyBuyerMarket[] = [
  { code: 'RU', name: 'Rusya Federasyonu', language: 'ru', priority: 1, demandSignal: '2025 lideri · 2026 Haziran lideri' },
  { code: 'IR', name: 'İran', language: 'fa', priority: 2, demandSignal: '2025 ikinci · 2026 ilk yarıda güçlü' },
  { code: 'UA', name: 'Ukrayna', language: 'uk', priority: 3, demandSignal: '2025 üçüncü · 2026 Haziran ilk 3' },
  { code: 'DE', name: 'Almanya', language: 'de', priority: 4, demandSignal: '2026 döneminde öne çıkan pazar' },
  { code: 'IQ', name: 'Irak', language: 'ar', priority: 5, demandSignal: '2026 döneminde öne çıkan pazar' },
  { code: 'AZ', name: 'Azerbaycan', language: 'az', priority: 6, demandSignal: 'Türkiye için güçlü yakın pazar' },
  { code: 'CN', name: 'Çin', language: 'zh', priority: 7, demandSignal: '2026 döneminde yükselen pazar' },
  { code: 'KZ', name: 'Kazakistan', language: 'kk', priority: 8, demandSignal: 'Türkiye için güçlü yakın pazar' },
  { code: 'AF', name: 'Afganistan', language: 'fa', priority: 9, demandSignal: 'İlk 20 yabancı alıcı pazarı' },
  { code: 'GB', name: 'Birleşik Krallık', language: 'en', priority: 10, demandSignal: 'İlk 20 yabancı alıcı pazarı' },
  { code: 'US', name: 'Amerika Birleşik Devletleri', language: 'en', priority: 11, demandSignal: 'İlk 20 yabancı alıcı pazarı' },
  { code: 'SA', name: 'Suudi Arabistan', language: 'ar', priority: 12, demandSignal: 'Körfez odak pazarı' },
  { code: 'KW', name: 'Kuveyt', language: 'ar', priority: 13, demandSignal: 'Körfez odak pazarı' },
  { code: 'EG', name: 'Mısır', language: 'ar', priority: 14, demandSignal: 'İlk 20 yabancı alıcı pazarı' },
  { code: 'PK', name: 'Pakistan', language: 'ur', priority: 15, demandSignal: 'İlk 20 yabancı alıcı pazarı' },
  { code: 'JO', name: 'Ürdün', language: 'ar', priority: 16, demandSignal: 'Orta Doğu odak pazarı' },
  { code: 'UZ', name: 'Özbekistan', language: 'uz', priority: 17, demandSignal: 'Türkiye için gelişen yakın pazar' },
  { code: 'CA', name: 'Kanada', language: 'en', priority: 18, demandSignal: 'İlk 20 yabancı alıcı pazarı' },
  { code: 'LB', name: 'Lübnan', language: 'ar', priority: 19, demandSignal: 'Orta Doğu odak pazarı' },
  { code: 'YE', name: 'Yemen', language: 'ar', priority: 20, demandSignal: 'İlk 20 yabancı alıcı pazarı' },
];

export type PartnerCountry = readonly [code: string, name: string, language: string];

export const PARTNER_COUNTRIES: PartnerCountry[] = TURKEY_PROPERTY_BUYER_MARKETS.map(
  ({ code, name, language }) => [code, name, language] as const,
);

export function partnerCountry(code: string) {
  const normalized = code.trim().toUpperCase();
  const country = TURKEY_PROPERTY_BUYER_MARKETS.find(
    (candidate) => candidate.code === normalized,
  );
  return country ? { ...country } : null;
}
