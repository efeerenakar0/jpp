import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { assertSafePartnerSourceUrl } from './ssrf';
import { normalizeDomain } from './normalization';

export const providerOrganizationSchema = z.object({
  externalId: z.string().trim().max(200).optional(),
  legalName: z.string().trim().min(2).max(300),
  displayName: z.string().trim().min(2).max(300),
  websiteUrl: z.string().url().max(2_000).optional(),
  logoUrl: z.string().url().max(2_000).optional(),
  countryCode: z.string().trim().length(2).transform((v) => v.toUpperCase()),
  countryName: z.string().trim().min(2).max(120),
  city: z.string().trim().max(160).optional(),
  registrationNumber: z.string().trim().max(160).optional(),
  licenseNumber: z.string().trim().max(160).optional(),
  languages: z.array(z.string().trim().min(2).max(40)).max(20).default([]),
  specialties: z.array(z.string().trim().min(2).max(100)).max(30).default([]),
  internationalExperience: z.boolean().default(false),
  reviewAverage: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().min(0).optional(),
  corporateEmail: z.string().email().max(320).optional(),
  sourceUrl: z.string().url().max(2_000),
  observedAt: z.coerce.date(),
});

export type ProviderOrganization = z.infer<typeof providerOrganizationSchema>;

export interface PartnerDiscoveryProvider {
  key: string;
  searchCountry(input: { countryCode: string; limit: number }): Promise<ProviderOrganization[]>;
  searchRegion(input: { countryCode: string; city: string; limit: number }): Promise<ProviderOrganization[]>;
  fetchOrganization(externalId: string): Promise<ProviderOrganization | null>;
  enrichOrganization(input: ProviderOrganization): Promise<ProviderOrganization>;
  verifyOrganization(input: ProviderOrganization): Promise<{ verified: boolean; notes: string[] }>;
  healthCheck(): Promise<{ ok: boolean; message: string }>;
}

export class DisabledPartnerProvider implements PartnerDiscoveryProvider {
  key = 'disabled';
  async searchCountry(input: { countryCode: string; limit: number }): Promise<ProviderOrganization[]> { void input; throw new Error('Canlı partner veri sağlayıcısı yapılandırılmamış. CSV veya imzalı partner akışı kullanın.'); }
  async searchRegion(input: { countryCode: string; city: string; limit: number }): Promise<ProviderOrganization[]> { void input; throw new Error('Canlı partner veri sağlayıcısı yapılandırılmamış. CSV veya imzalı partner akışı kullanın.'); }
  async fetchOrganization() { return null; }
  async enrichOrganization(input: ProviderOrganization) { return input; }
  async verifyOrganization() { return { verified: false, notes: ['Canlı doğrulama sağlayıcısı yok.'] }; }
  async healthCheck() { return { ok: false, message: 'Canlı sağlayıcı kapalı; sahte sonuç üretilmez.' }; }
}

export class TestPartnerProvider implements PartnerDiscoveryProvider {
  key = 'test';
  constructor(private readonly fixtures: ProviderOrganization[]) {}
  async searchCountry(input: { countryCode: string; limit: number }) {
    return this.fixtures.filter((item) => item.countryCode === input.countryCode).slice(0, input.limit);
  }
  async searchRegion(input: { countryCode: string; city: string; limit: number }) {
    return (await this.searchCountry(input)).filter((item) => item.city?.toLocaleLowerCase() === input.city.toLocaleLowerCase());
  }
  async fetchOrganization(externalId: string) { return this.fixtures.find((item) => item.externalId === externalId) ?? null; }
  async enrichOrganization(input: ProviderOrganization) { return input; }
  async verifyOrganization() { return { verified: true, notes: ['Test fixture doğrulaması.'] }; }
  async healthCheck() { return { ok: true, message: 'Test sağlayıcısı hazır.' }; }
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(current.trim()); current = ''; }
    else current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parsePartnerCsv(value: string) {
  const lines = value.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (lines.length < 2 || lines.length > 501) throw new Error('CSV dosyası 1-500 kayıt içermelidir.');
  const headers = parseCsvLine(lines[0]).map((value) => value.toLowerCase());
  return lines.slice(1).map((line, index) => {
    const row = Object.fromEntries(headers.map((header, column) => [header, parseCsvLine(line)[column] || undefined]));
    const parsed = providerOrganizationSchema.safeParse({
      externalId: row.externalid,
      legalName: row.legalname || row.name,
      displayName: row.displayname || row.name,
      websiteUrl: row.websiteurl,
      logoUrl: row.logourl,
      countryCode: row.countrycode,
      countryName: row.countryname,
      city: row.city,
      registrationNumber: row.registrationnumber,
      licenseNumber: row.licensenumber,
      languages: row.languages?.split('|').filter(Boolean) || [],
      specialties: row.specialties?.split('|').filter(Boolean) || [],
      internationalExperience: row.internationalexperience === 'true',
      reviewAverage: row.reviewaverage ? Number(row.reviewaverage) : undefined,
      reviewCount: row.reviewcount ? Number(row.reviewcount) : undefined,
      corporateEmail: row.corporateemail,
      sourceUrl: row.sourceurl,
      observedAt: row.observedat || new Date(),
    });
    if (!parsed.success) throw new Error(`CSV ${index + 2}. satır geçersiz: ${parsed.error.issues[0]?.message}`);
    return { ...parsed.data, domain: normalizeDomain(parsed.data.websiteUrl) };
  });
}

function feedSecret() {
  const secret = process.env.PARTNER_FEED_SIGNING_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error('İmzalı partner akışı güvenlik anahtarı yapılandırılmamış.');
  return secret;
}

export function verifyPartnerFeed(body: string, signature: string) {
  const expected = Buffer.from(createHmac('sha256', feedSecret()).update(body).digest('hex'));
  const actual = Buffer.from(signature.trim().toLowerCase());
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function fetchSignedPartnerFeed(urlValue: string, signature: string) {
  let url = await assertSafePartnerSourceUrl(urlValue);
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8_000), headers: { Accept: 'application/json' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirects === 2) throw new Error('Partner akışı çok fazla yönlendirme yaptı.');
      url = await assertSafePartnerSourceUrl(new URL(location, url).toString());
      continue;
    }
    const type = response.headers.get('content-type') || '';
    if (!response.ok || !type.includes('application/json')) throw new Error('Partner akışı geçerli JSON döndürmedi.');
    const body = await response.text();
    if (Buffer.byteLength(body) > 2_000_000) throw new Error('Partner akışı izin verilen boyutu aşıyor.');
    if (!verifyPartnerFeed(body, signature)) throw new Error('Partner akışı imzası doğrulanamadı.');
    const parsed = z.array(providerOrganizationSchema).max(500).parse(JSON.parse(body));
    return { items: parsed, bodyHash: createHash('sha256').update(body).digest('hex') };
  }
  throw new Error('Partner akışı alınamadı.');
}
