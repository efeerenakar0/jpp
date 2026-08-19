import 'server-only';

/**
 * Business CEO AI Router
 * OpenRouter is the shared primary gateway. Groq and Cloudflare Workers AI
 * remain independent fallbacks while the production migration is observed.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  isMock: boolean;
  provider: 'OPENROUTER' | 'GROQ' | 'CLOUDFLARE';
  model: string;
}

export function sharedAssistantAIStatus() {
  const openrouter = Boolean(
    process.env.OPENROUTER_API_KEY?.trim() ||
      process.env.OPENROUTER_WHATSAPP_API_KEY?.trim()
  );
  const groq = Boolean(process.env.GROQ_API_KEY?.trim());
  const cloudflare = Boolean(
    process.env.CLOUDFLARE_API_TOKEN?.trim() &&
      process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  );
  return {
    configured: openrouter || groq || cloudflare,
    provider: 'Business CEO AI Router',
    model: 'OpenRouter GPT-OSS 120B · Groq · Cloudflare Qwen3',
    providers: { openrouter, groq, cloudflare },
  };
}

export const PROMPTS = {
  seoGenerator: (listing: { title: string; location?: string; price?: string; roomCount?: string; area?: string }) => `
Sen uzman bir emlak SEO yazarısın. Aşağıdaki ilan bilgilerini kullanarak:
- SEO uyumlu bir başlık (max 60 karakter)
- Meta açıklama (max 160 karakter)  
- Detaylı HTML açıklama (3-4 paragraf)
üret.

İlan Bilgileri:
Başlık: ${listing.title}
${listing.location ? `Konum: ${listing.location}` : ''}
${listing.price ? `Fiyat: ${listing.price}` : ''}
${listing.roomCount ? `Oda Sayısı: ${listing.roomCount}` : ''}
${listing.area ? `Alan: ${listing.area}` : ''}

JSON formatında döndür: { "seoTitle": "...", "metaDescription": "...", "htmlDescription": "..." }
`,

  huntingMessage: (listing: { title: string; price?: string; location?: string }, company: { companyName: string; strengths: string[]; uniquePoints: string[] }, tone: string) => `
Sen profesyonel bir emlak danışmanısın. Bir ilanın sahibini, senin firmana satış yetkisi vermeye ikna edecek bir mesaj yaz.

Firman:
Ad: ${company.companyName}
Güçlü Yanlar: ${company.strengths.join(', ')}
Benzersiz Noktalar: ${company.uniquePoints.join(', ')}

İlan:
Başlık: ${listing.title}
${listing.price ? `Fiyat: ${listing.price}` : ''}
${listing.location ? `Konum: ${listing.location}` : ''}

Ton: ${tone === 'resmi' ? 'Resmi ve profesyonel' : tone === 'samimi' ? 'Samimi ve sıcak' : 'Acil ve ikna edici'}

ÖNEMLİ KURALLAR:
1. Kesinlikle ama kesinlikle ilan sahibinin adını kullanma veya tahmin etme. Sadece doğrudan "Merhaba," diye başla.
2. Senin adın Efe. Mesajın sonuna her zaman imza olarak "Efe - ${company.companyName}" şeklinde kendi adını yaz.
3. Mesaj WhatsApp üzerinden gönderilecek, bu yüzden kısa ve etkili olsun (max 500 karakter).
`,

  customerAssistant: (context: { 
    companyName: string; 
    availableListings: string; 
    conversationHistory: string; 
    customerMessage: string;
    assistantName?: string;
    serviceCity?: string;
    appointmentStatus?: string;
  }) => {
    const name = context.assistantName || 'Efe';
    const city = context.serviceCity || 'Alanya';
    return `
Sen ${context.companyName} firmasında çalışan Emlak Danışmanı ${name}'sin.
Müşteri karşısında robot veya hazır metin olduğunu HİSSETMEMELİ. Tıpkı WhatsApp'tan yazışan canlı ve bilgili bir insan emlak uzmanı gibi yanıt ver.
ASLA VE KESİNLİKLE HİÇBİR MESAJIN SONUNA İMZASAL OLARAK İSİM, FİRMA ADI VEYA KARTVİZİT BİLGİSİ EKLEME. Normal bir insanın WhatsApp yazışması gibi, cümleni doğal bir şekilde bitir. Sadece eğer müşteri adını sorarsa kendini ${name} olarak tanıt.

ÖNEMLİ KURALLAR:
1. Müşterinin tam olarak ne sorduğuna odaklan ve SADECE o konuda özel bilgi ver.
2. KESİNLİKLE HER MESAJDA AYNI KALIPI TEKRARLAMA!
3. Fiyat, oda tipi, konum, uygunluk, teslim tarihi veya proje özelliği konusunda yalnızca aşağıdaki "Doğrulanmış Portföy Verileri" bölümündeki bilgileri kullan.
4. Verilerde olmayan hiçbir portföyü, fiyatı veya özelliği tahmin etme ve uydurma.
5. Müşterinin kriterlerine doğrulanmış bir eşleşme yoksa bunu açıkça söyle ve ekibin güncel portföyleri kontrol ederek dönüş yapacağını belirt.
6. Randevu talebi kaydedilmişse talebin alındığını ve ekip tarafından onaylanacağını söyle. Kesinleşmiş gibi saat veya müsaitlik garantisi verme.
7. Hukuki, vatandaşlık veya ikamet konularında kesin hüküm verme; güncel koşulların uzman tarafından teyit edileceğini söyle.
8. Müşterinin dilinde, temiz ve doğal yaz. Türkçe yanıt veriyorsan yalnızca Türkçe kullan; İngilizce kelimeler veya CJK/Asya karakterleri karıştırma.
9. Yanıtı kısa tut: en fazla 500 karakter.

Doğrulanmış Portföy Verileri (${city}):
${context.availableListings}

Randevu Durumu:
${context.appointmentStatus || 'Bu mesaj için kaydedilmiş bir randevu talebi yok.'}

Sohbet Geçmişi:
${context.conversationHistory}

Müşterinin Son Mesajı: ${context.customerMessage}

Doğrudan müşteriye gönderilecek insansı WhatsApp yanıtını yaz.
`;
  },

  appointmentConfirm: (details: { customerName: string; date: string; time: string; companyName: string }) => `
Randevu teyit mesajı üret:
Müşteri: ${details.customerName}
Tarih: ${details.date}
Saat: ${details.time}
Firma: ${details.companyName}

Profesyonel ve sıcak bir teyit mesajı yaz. Max 200 karakter.
`,
};

const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b';
const GROQ_MARKETING_MODEL = 'qwen/qwen3.6-27b';
const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-oss-120b';
const OPENROUTER_MARKETING_MODEL = 'qwen/qwen3.6-flash';
const OPENROUTER_POSTER_TEXT_MODEL = 'qwen/qwen3.7-flash';
const CLOUDFLARE_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const AI_TIMEOUT_MS = 30_000;

function modelOrder(requestType = '') {
  const contentFocused =
    requestType.includes('marketing') ||
    requestType.includes('seo') ||
    requestType.includes('website');
  return contentFocused
    ? [GROQ_MARKETING_MODEL, GROQ_DEFAULT_MODEL]
    : [GROQ_DEFAULT_MODEL, GROQ_MARKETING_MODEL];
}

function openRouterModel(requestType = '') {
  if (requestType.includes('poster-marketing')) {
    return (
      process.env.OPENROUTER_POSTER_TEXT_MODEL?.trim() ||
      OPENROUTER_POSTER_TEXT_MODEL
    );
  }
  const configured = process.env.OPENROUTER_TEXT_MODEL?.trim();
  if (configured) return configured;
  const contentFocused =
    requestType.includes('marketing') ||
    requestType.includes('seo') ||
    requestType.includes('website');
  return contentFocused
    ? OPENROUTER_MARKETING_MODEL
    : OPENROUTER_DEFAULT_MODEL;
}

function formatMessages(
  systemPrompt: string,
  conversationMessages: ChatMessage[]
) {
  const validSystemPrompt =
    systemPrompt && systemPrompt.trim().length > 0
      ? systemPrompt.trim()
      : "Sen Business CEO AI emlak kıdemli danışmanısın. Yalnızca doğrulanmış portföy bilgilerini kullanarak doğal ve yardımsever yanıtlar ver.";
  const formattedMessages: ChatMessage[] = [
    { role: 'system', content: validSystemPrompt },
    ...conversationMessages
      .filter((message) => Boolean(message.content?.trim()))
      .map((message) => ({
        role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: message.content.trim(),
      })),
  ];
  if (formattedMessages.length === 1) {
    formattedMessages.push({ role: 'user', content: 'Merhaba' });
  }
  return formattedMessages;
}

async function callGroqAPI(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string | null> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: model === GROQ_MARKETING_MODEL ? 0.65 : 0.35,
        max_completion_tokens: 2200,
        reasoning_effort: model === GROQ_MARKETING_MODEL ? 'none' : 'low',
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (response.ok && content) {
      return content;
    }
  } catch {
    // The next provider/model in the router handles transient failures.
  }
  return null;
}

async function callOpenRouterAPI(
  apiKey: string,
  model: string,
  messages: ChatMessage[]
): Promise<string | null> {
  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            process.env.NEXT_PUBLIC_APP_URL?.trim() ||
            'https://jpp-ufeb.vercel.app',
          'X-OpenRouter-Title': 'Business CEO AI',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: model === OPENROUTER_MARKETING_MODEL ? 0.65 : 0.35,
          max_tokens: 2200,
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      }
    );
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return response.ok && content ? content : null;
  } catch {
    return null;
  }
}

async function callCloudflareAPI(messages: ChatMessage[]) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) return null;
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
        accountId
      )}/ai/run/${CLOUDFLARE_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          temperature: 0.45,
          max_tokens: 2200,
        }),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      }
    );
    const data = (await response.json()) as {
      success?: boolean;
      result?: {
        response?: unknown;
        choices?: Array<{ message?: { content?: string } }>;
      };
    };
    const structuredResponse = data.result?.response;
    const content =
      (typeof structuredResponse === 'string'
        ? structuredResponse.trim()
        : structuredResponse && typeof structuredResponse === 'object'
          ? JSON.stringify(structuredResponse)
          : '') || data.result?.choices?.[0]?.message?.content?.trim();
    return response.ok && data.success !== false && content ? content : null;
  } catch {
    return null;
  }
}

export async function callAI(
  messages: ChatMessage[],
  requestType = '',
  customApiKey?: string
): Promise<AIResponse> {
  const conversationMessages = messages.filter(
    (message) => message.role !== 'system'
  );
  const systemInstruction =
    messages.find((message) => message.role === 'system')?.content || '';
  const formattedMessages = formatMessages(
    systemInstruction,
    conversationMessages
  );
  const openrouterKey =
    (requestType === 'whatsapp-customer-assistant'
      ? process.env.OPENROUTER_WHATSAPP_API_KEY?.trim()
      : undefined) || process.env.OPENROUTER_API_KEY?.trim();
  if (openrouterKey) {
    const model = openRouterModel(requestType);
    const content = await callOpenRouterAPI(
      openrouterKey,
      model,
      formattedMessages
    );
    if (content) {
      return { content, isMock: false, provider: 'OPENROUTER', model };
    }
  }
  const keysToTry = Array.from(
    new Set([customApiKey?.trim(), process.env.GROQ_API_KEY?.trim()])
  ).filter(
    (key): key is string =>
      typeof key === 'string' && key.startsWith('gsk_') && key.length > 10
  );

  for (const apiKey of keysToTry) {
    for (const model of modelOrder(requestType)) {
      const content = await callGroqAPI(apiKey, model, formattedMessages);
      if (content) {
        return { content, isMock: false, provider: 'GROQ', model };
      }
    }
  }

  const cloudflareReply = await callCloudflareAPI(formattedMessages);
  if (cloudflareReply) {
    return {
      content: cloudflareReply,
      isMock: false,
      provider: 'CLOUDFLARE',
      model: CLOUDFLARE_MODEL,
    };
  }

  throw new Error(
    !openrouterKey &&
      keysToTry.length === 0 &&
      !process.env.CLOUDFLARE_API_TOKEN &&
      !process.env.CLOUDFLARE_ACCOUNT_ID
      ? 'AI provider is not configured'
      : 'AI provider did not return a valid response'
  );
}

export function parseJSONResponse(content: string): Record<string, unknown> | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch {
    return { reply: content };
  }
}
