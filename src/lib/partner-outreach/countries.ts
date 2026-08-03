export const PARTNER_COUNTRIES = [
  ['DE', 'Almanya', 'de'],
  ['GB', 'Birleşik Krallık', 'en'],
  ['ES', 'İspanya', 'es'],
  ['FR', 'Fransa', 'fr'],
  ['IT', 'İtalya', 'it'],
  ['PT', 'Portekiz', 'pt'],
  ['NL', 'Hollanda', 'nl'],
  ['AE', 'Birleşik Arap Emirlikleri', 'en'],
  ['US', 'Amerika Birleşik Devletleri', 'en'],
  ['CA', 'Kanada', 'en'],
  ['AU', 'Avustralya', 'en'],
  ['CH', 'İsviçre', 'de'],
  ['AT', 'Avusturya', 'de'],
  ['BE', 'Belçika', 'fr'],
  ['GR', 'Yunanistan', 'el'],
  ['TR', 'Türkiye', 'tr'],
] as const;

export function partnerCountry(code: string) {
  const normalized = code.trim().toUpperCase();
  const country = PARTNER_COUNTRIES.find(([candidate]) => candidate === normalized);
  return country
    ? { code: country[0], name: country[1], language: country[2] }
    : null;
}
