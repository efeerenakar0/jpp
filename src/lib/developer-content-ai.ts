import 'server-only';

import {
  developerSiteContentSchema,
  type DeveloperSiteContent,
} from './developer-site';

export const DEVELOPER_CONTENT_AI_MODELS = [
  'deepseek/deepseek-v4-flash:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openrouter/free',
] as const;

export const DEVELOPER_CONTENT_SECTIONS = [
  'hero',
  'about',
  'services',
  'blog',
  'faq',
  'contact',
] as const;

export type DeveloperContentSection =
  (typeof DEVELOPER_CONTENT_SECTIONS)[number];

export class DeveloperContentAIError extends Error {
  constructor(
    readonly code:
      | 'NOT_CONFIGURED'
      | 'PROVIDER_ERROR'
      | 'INVALID_RESPONSE',
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = 'DeveloperContentAIError';
  }
}

function extractJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || value;
  const firstBrace = source.indexOf('{');
  const lastBrace = source.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(source.slice(firstBrace, lastBrace + 1)) as unknown;
  } catch {
    return null;
  }
}

export async function generateDeveloperSiteSection(input: {
  brandName: string;
  section: DeveloperContentSection;
  instruction: string;
  currentContent: DeveloperSiteContent;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}) {
  const apiKey = input.apiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new DeveloperContentAIError(
      'NOT_CONFIGURED',
      'Yapay zekâ anahtarı sunucuda henüz yapılandırılmamış.',
      503,
    );
  }

  const sectionSchema = developerSiteContentSchema.shape[input.section];
  const currentSection = input.currentContent[input.section];
  const systemPrompt = [
    'Sen Business CEO AI içindeki kıdemli Türkçe web sitesi metin yazarısın.',
    'Gayrimenkul şirketleri için açık, güven veren, doğal ve özgün içerik yaz.',
    'Kullanıcının vermediği yıl, sayı, ödül, satış adedi veya hukuki garanti uydurma.',
    'Mevcut JSON yapısını ve bütün alan adlarını eksiksiz koru.',
    'enabled, id gibi teknik alanları değiştirme; yalnızca metinleri iyileştir.',
    'Yanıtın yalnızca geçerli JSON nesnesi olsun. Markdown veya açıklama ekleme.',
  ].join('\n');
  const userPrompt = [
    `Marka: ${input.brandName}`,
    `Düzenlenen bölüm: ${input.section}`,
    `Kullanıcının isteği: ${input.instruction.trim()}`,
    'Mevcut bölüm JSON verisi:',
    JSON.stringify(currentSection),
    'Aynı yapıda, Türkçe ve yayına hazır yeni bölüm JSON verisini döndür.',
  ].join('\n');

  let response: Response;
  try {
    response = await (input.fetchImpl ?? fetch)(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            process.env.NEXT_PUBLIC_APP_URL?.trim() ||
            'https://jpp-ufeb.vercel.app',
          'X-OpenRouter-Title': 'Business CEO AI Yazılımcı',
        },
        body: JSON.stringify({
          models: DEVELOPER_CONTENT_AI_MODELS,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.65,
          max_tokens: 1_400,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(35_000),
      },
    );
  } catch {
    throw new DeveloperContentAIError(
      'PROVIDER_ERROR',
      'Yapay zekâ servisine şu anda ulaşılamıyor. Biraz sonra yeniden deneyin.',
      503,
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      }
    | null;
  if (!response.ok) {
    const isRateLimited = response.status === 429;
    throw new DeveloperContentAIError(
      'PROVIDER_ERROR',
      isRateLimited
        ? 'Ücretsiz yapay zekâ kotası şu anda dolu. Biraz sonra yeniden deneyin.'
        : 'Yapay zekâ metni hazırlayamadı. Biraz sonra yeniden deneyin.',
      isRateLimited ? 429 : 502,
    );
  }

  const raw = payload?.choices?.[0]?.message?.content?.trim();
  const candidate = raw ? extractJson(raw) : null;
  const parsed = sectionSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new DeveloperContentAIError(
      'INVALID_RESPONSE',
      'Yapay zekâ metni beklenen biçimde hazırlayamadı. Yeniden deneyin.',
    );
  }

  return {
    content: parsed.data,
    model: payload?.model || DEVELOPER_CONTENT_AI_MODELS[0],
  };
}
