/**
 * Universal Multi-Provider AI Client Wrapper
 * Primary AI Engine: Groq Cloud Llama 3.3 70B Ultra-fast AI
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  isMock: boolean;
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

/**
 * Groq Cloud API Call (Ultra-fast 800+ tokens/sec Free AI Engine)
 */
async function callGroqAPI(apiKey: string, systemPrompt: string, conversationMessages: ChatMessage[]): Promise<string | null> {
  try {
    const validSystemPrompt = systemPrompt && systemPrompt.trim().length > 0
      ? systemPrompt.trim()
      : "Sen Jasmine Group emlak kıdemli danışmanı Efe'sin. Alanya kiralık ve satılık gayrimenkul portföyleri hakkında müşterilere WhatsApp üzerinden samimi, bilgili ve yardımsever yanıtlar ver.";

    const formattedMessages = [
      { role: "system", content: validSystemPrompt }
    ];

    for (const m of conversationMessages) {
      if (!m.content || !m.content.trim()) continue;
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      formattedMessages.push({ role, content: m.content.trim() });
    }

    if (formattedMessages.length === 1) {
      formattedMessages.push({ role: "user", content: "Merhaba" });
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: formattedMessages
      })
    });

    const data = await res.json();
    if (res.ok && data?.choices?.[0]?.message?.content) {
      console.log('[Groq AI Llama 3.3 70B LIVE SUCCESS]: Generated response');
      return data.choices[0].message.content.trim();
    } else if (data?.error?.message) {
      console.warn('[Groq AI Error]:', data.error.message);
    }
  } catch (error: unknown) {
    console.warn(
      '[Groq AI Call Exception]:',
      error instanceof Error ? error.message : String(error)
    );
  }
  return null;
}

export async function callAI(messages: ChatMessage[], _requestType?: string, customApiKey?: string): Promise<AIResponse> {
  const conversationMessages = messages.filter(m => m.role !== 'system');
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const envKey = process.env.GROQ_API_KEY || '';

  const keysToTry = Array.from(new Set([
    customApiKey,
    envKey
  ])).filter(k => Boolean(k) && typeof k === 'string' && k.length > 5) as string[];

  // 1. Primary AI Engine: Groq Cloud Llama 3.3 70B (Ultra-fast live AI)
  for (const apiKey of keysToTry) {
    if (apiKey.startsWith('gsk_')) {
      const groqReply = await callGroqAPI(apiKey, systemInstruction, conversationMessages);
      if (groqReply) return { content: groqReply, isMock: false };
    }
  }

  throw new Error(
    keysToTry.length === 0
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
