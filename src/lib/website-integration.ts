import { createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';
export {
  MAX_SITE_SOURCE_BYTES,
  MAX_SITE_SOURCE_FILES,
  safeWebsiteArchiveName,
  shouldIncludeWebsiteFile,
} from './website-source-files';

export const websiteIntegrationStatuses = [
  'PENDING',
  'READY',
  'DELIVERED',
  'SUSPENDED',
] as const;

export type WebsiteIntegrationStatus =
  (typeof websiteIntegrationStatuses)[number];

const httpUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Yalnızca http veya https adresleri kullanılabilir.');

const optionalHttpUrl = z.union([httpUrl, z.literal('')]).optional();

export const websiteIntegrationMetadataSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  websiteUrl: httpUrl,
  framework: z.string().trim().min(2).max(100),
  hostingProvider: z.string().trim().min(2).max(100),
  portfolioPath: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine((value) => value.startsWith('/'), 'Sayfa yolu / ile başlamalıdır.'),
  technicalContactEmail: z.string().trim().email().max(160),
  repositoryUrl: optionalHttpUrl,
  notes: z.string().trim().max(3000).optional().default(''),
});

export type WebsiteIntegrationMetadata = z.infer<
  typeof websiteIntegrationMetadataSchema
>;

const nullableText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const nullableNonNegativeNumber = z
  .union([z.number().finite().nonnegative(), z.null()])
  .optional();

const propertyStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'RESERVED',
  'SOLD',
  'RENTED',
  'ARCHIVED',
]);

const portfolioFields = {
  title: z.string().trim().min(2).max(180),
  externalId: nullableText(160),
  referenceCode: nullableText(80),
  location: nullableText(240),
  price: nullableNonNegativeNumber,
  roomCount: nullableText(40),
  area: nullableNonNegativeNumber,
  status: propertyStatusSchema.optional().default('ACTIVE'),
  description: nullableText(10_000),
  imageUrl: z.union([httpUrl, z.literal(''), z.null()]).optional(),
};

export const portfolioCreateSchema = z.object(portfolioFields);

export const portfolioUpdateSchema = z
  .object({
    ...portfolioFields,
    status: propertyStatusSchema.optional(),
  })
  .omit({ externalId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'En az bir alan güncellenmelidir.',
  });

export type PortfolioCreateInput = z.input<typeof portfolioCreateSchema>;
export type PortfolioUpdateInput = z.input<typeof portfolioUpdateSchema>;

function websiteCredentialSecret() {
  const secret =
    process.env.WEBSITE_API_KEY_SECRET?.trim() ||
    process.env.COMPANY_CREDENTIAL_SECRET?.trim() ||
    process.env.FABRIKA_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error('Web sitesi API güvenlik anahtarı yapılandırılmamış.');
  }

  return secret;
}

export function generateWebsiteApiKey() {
  return `jpp_site_${randomBytes(32).toString('base64url')}`;
}

export function createWebsiteApiKeyLookup(apiKey: string) {
  return createHmac('sha256', websiteCredentialSecret())
    .update(apiKey.trim())
    .digest('hex');
}

export function websiteApiKeyHint(apiKey: string) {
  const normalized = apiKey.trim();
  return `${normalized.slice(0, 12)}••••${normalized.slice(-6)}`;
}

export function apiKeyFromRequest(request: Request) {
  const authorization = request.headers.get('authorization')?.trim() || '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return request.headers.get('x-api-key')?.trim() || null;
}

export function normalizeWebsiteOrigin(websiteUrl: string) {
  return new URL(websiteUrl).origin.toLocaleLowerCase('en-US');
}

export class WebsiteApiRateLimiter {
  private readonly requests = new Map<string, number[]>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}

  check(identifier: string, now = Date.now()) {
    const recent = (this.requests.get(identifier) || []).filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    if (recent.length >= this.maxRequests) {
      this.requests.set(identifier, recent);
      return false;
    }
    recent.push(now);
    this.requests.set(identifier, recent);
    return true;
  }
}

export function buildWebsiteIntegrationPrompt(input: {
  companyName: string;
  apiBaseUrl: string;
  apiKey?: string;
}) {
  const baseUrl = input.apiBaseUrl.replace(/\/+$/, '');
  const apiKey = input.apiKey || '[TEK_SEFERLIK_API_ANAHTARI]';

  return `Aşağıdaki mevcut web sitesini Jasmine Fabrikası portföy API'sine bağla.

Şirket: ${input.companyName}
API ana adresi: ${baseUrl}
API anahtarı: ${apiKey}

Güvenlik kuralları:
- API anahtarını yalnızca sunucu ortam değişkeni JASMINE_PORTFOLIO_API_KEY içinde tut.
- Anahtarı istemci tarafına, NEXT_PUBLIC_ değişkenine, tarayıcı paketine veya git deposuna kesinlikle yazma.
- Tarayıcı isteklerini sitenin kendi sunucu route/action katmanından geçir.
- Sunucu isteklerinde Authorization: Bearer \${process.env.JASMINE_PORTFOLIO_API_KEY} başlığını kullan.
- Hata yanıtlarında anahtarı veya dahili ayrıntıları loglama.

Kullanılacak uçlar:
- GET ${baseUrl}/api/site/v1/portfolio
  Aktif portföyleri listeler. Yönetim görünümü için ?scope=all kullan.
- POST ${baseUrl}/api/site/v1/portfolio
  Yeni portföy ekler.
- GET ${baseUrl}/api/site/v1/portfolio/{id}
  Tek bir portföyü getirir.
- PATCH ${baseUrl}/api/site/v1/portfolio/{id}
  Mevcut portföyü düzenler.
- DELETE ${baseUrl}/api/site/v1/portfolio/{id}
  Portföyü güvenli biçimde arşivler.

Portföy veri alanları:
{
  "title": "zorunlu metin",
  "externalId": "sitedeki benzersiz kayıt kimliği",
  "referenceCode": "ilan referansı",
  "location": "konum",
  "price": 250000,
  "roomCount": "2+1",
  "area": 110,
  "status": "DRAFT | ACTIVE | RESERVED | SOLD | RENTED | ARCHIVED",
  "description": "ilan açıklaması",
  "imageUrl": "https://..."
}

Yapılacaklar:
1. Önce proje yapısını ve kullanılan framework'ü incele.
2. Sunucu tarafında tip güvenli bir Jasmine API istemcisi oluştur.
3. Mevcut portföy listeleme ve detay sayfalarını GET uçlarına bağla.
4. Yönetim paneline portföy ekleme, düzenleme ve arşivleme formları ekle.
5. Formları doğrula; yükleniyor, boş durum, hata ve başarı durumlarını tamamla.
6. Mevcut tasarım dilini ve mobil uyumu koru.
7. API anahtarının istemci paketine girmediğini kontrol eden test ekle.
8. Uçtan uca portföy ekleme → listeleme → düzenleme → arşivleme akışını test et.
9. Değişen dosyaları ve gerekli JASMINE_PORTFOLIO_API_KEY ortam değişkenini README'de açıkça belgeleyip çalışır halde teslim et.`;
}
