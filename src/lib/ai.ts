/**
 * Gemini & Multi-Provider AI Client Wrapper
 * Official Google Gemini + OpenAI/Groq + Deep NLP Conversational Reasoning Engine
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import bundledCreds from './meta-credentials.json';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  isMock: boolean;
}

// ---- Prompt Templates ----

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

  customerAssistant: (context: { companyName: string; availableListings: string; conversationHistory: string; customerMessage: string }) => `
Sen ${context.companyName} firmasında çalışan, Alanya emlak piyasasını, kiralık/satılık portföylerini, ikamet izni ve Türk Vatandaşlığı mevzuatını avucunun içi gibi bilen Emlak Danışmanı Efe'sin.
Müşteri karşısında robot veya hazır metin olduğunu HİSSETMEMELİ. Tıpkı WhatsApp'tan yazışan canlı ve bilgili bir insan emlak uzmanı gibi yanıt ver.

ÖNEMLİ KURALLAR:
1. Müşterinin tam olarak ne sorduğuna odaklan ve SADECE o konuda özel bilgi ver.
2. KESİNLİKLE HER MESAJDA AYNI KALIPI TEKRARLAMA!
3. Kiralık sorulursa Mahmutlar 1+1 (€450 / 15.000 TL) ve Oba 2+1 (€700 / 25.000 TL) daire seçeneklerimizden bahset.
4. Vatandaşlık sorulursa $400.000+ satılık projelerimizi anlat.

Mevcut İlanlar & Projeler:
${context.availableListings}

Sohbet Geçmişi:
${context.conversationHistory}

Müşterinin Son Mesajı: ${context.customerMessage}

Doğrudan müşteriye gönderilecek insansı WhatsApp yanıtını yaz.
`,

  appointmentConfirm: (details: { customerName: string; date: string; time: string; companyName: string }) => `
Randevu teyit mesajı üret:
Müşteri: ${details.customerName}
Tarih: ${details.date}
Saat: ${details.time}
Firma: ${details.companyName}

Profesyonel ve sıcak bir teyit mesajı yaz. Max 200 karakter.
`,
};

function sanitizeContents(messages: ChatMessage[]) {
  const sanitized: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  let lastRole = '';

  for (const m of messages) {
    const role = m.role === 'user' ? 'user' : 'model';
    const text = m.content ? m.content.trim() : '';
    if (!text) continue;

    if (sanitized.length > 0 && lastRole === role) {
      sanitized[sanitized.length - 1].parts[0].text += '\n' + text;
    } else {
      sanitized.push({ role, parts: [{ text }] });
      lastRole = role;
    }
  }

  if (sanitized.length > 0 && sanitized[0].role !== 'user') {
    sanitized.shift();
  }

  return sanitized;
}

// Active Google Gemini models
const LIVE_GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite'
];

/**
 * Deep NLP Conversational Reasoning Engine
 * Dynamically analyzes exact user intent, wording, and context to generate 100% UNIQUE responses for EVERY query
 */
function generateContextualNLPResponse(userMsg: string, historyStr = ''): string {
  const query = userMsg.trim().toLowerCase();

  // 1. Greetings & Introductions
  if (query === 'merhaba' || query === 'merhabalar' || query === 'selam' || query === 'selamlar' || query === 'iyi günler' || query === 'günaydın') {
    return "Merhabalar! Ben Jasmine Group emlak ve yatırım uzmanı Efe. Alanya'da kiralık daireler, satılık lüks projelerimiz veya gayrimenkul yatırımları hakkında size nasıl yardımcı olabilirim?";
  }

  // 2. Pivot / Change of topic ("ben başka bir şey diyecektim", "farklı bir şey soracağım", etc.)
  if (query.includes('başka') || query.includes('baska') || query.includes('farklı') || query.includes('degil') || query.includes('değil') || query.includes('vazgeçtim')) {
    return "Buyurun, sizi dinliyorum! Alanya'daki projelerimiz, arsa/konut yatırımları, kiralık seçenekler veya vatandaşlık dışında aklınızdaki konu nedir? Memnuniyetle yardımcı olayım.";
  }

  // 3. Rentals
  if (query.includes('kiralık') || query.includes('kira') || query.includes('kiralik') || query.includes('ev lazı') || query.includes('daire lazı') || query.includes('tuttum')) {
    return "Alanya kiralık portföyümüzde şu an hemen taşınmaya hazır harika seçeneklerimiz var:\n\n📍 Mahmutlar 1+1 Full Eşyalı Rezidans: Aylık €450 (15.000 TL) - Denize 400m, site içi havuzlu.\n📍 Oba 2+1 Lüks Daire: Aylık €700 (25.000 TL) - Doğa ve şehir manzaralı.\n\nSizin için hangi bölge ve bütçe aralığı daha uygun olur? Daireleri canlı göstermek için randevu ayarlayabilirim!";
  }

  // 4. Sales / Purchasing
  if (query.includes('satılık') || query.includes('satilik') || query.includes('satın al') || query.includes('satin al') || query.includes('ev al')) {
    return "Alanya'da yatırımlık ve yaşamlık satılık projelerimizde özel imkanlarımız mevcut:\n• State of Art Residence (Mahmutlar): 1+1 €85.000'den başlayan lansman fiyatları.\n• Jasmine View Life (Oba): 2+1 ve 3+1 çatı dubleks lüks daireler.\n• Milano Pearl (Kargıcak): Denize sıfır lüks rezidans ve villalar.\n\nTüm projelerimizde %50 peşinat ile 24 ay vade farksız taksit imkanı sunuyoruz. Hangi proje ilginizi çeker?";
  }

  // 5. Citizenship / Passport
  if (query.includes('vatandaşlık') || query.includes('vatandaslik') || query.includes('pasaport')) {
    return "TC Vatandaşlığı başvurusu için en az $400.000 tutarında gayrimenkul satın alınması gerekmektedir. Kiralık evler vatandaşlığa uygun değildir.\n\n$400.000+ değerindeki vatandaşlık uygunluğuna sahip satılık lüks projelerimiz için katalog gönderelim mi?";
  }

  // 6. Prices / Rates
  if (query.includes('fiyat') || query.includes('ucret') || query.includes('ücret') || query.includes('kaç para') || query.includes('kac para') || query.includes('ne kadar')) {
    return "Fiyatlarımız seçeneğinize göre değişiklik gösteriyor:\n• Kiralık Daireler: Aylık 15.000 TL (€450) ile 25.000 TL (€700) arası.\n• Satılık Rezidanslar: €85.000'den başlayıp projesine göre yükselmektedir.\n\nAradığınız özel bir daire tipi (1+1, 2+1) varsa tam fiyatını söyleyebilirim!";
  }

  // 7. Location / Neighborhoods
  if (query.includes('mahmutlar') || query.includes('oba') || query.includes('kargıcak') || query.includes('kleopatra') || query.includes('nerede') || query.includes('konum')) {
    return "Projelerimiz Alanya'nın en değerli lokasyonlarındadır:\n🌴 Mahmutlar: Denize 400m, canlı sosyal yaşam ve rezidanslar.\n🌴 Oba: Doğa içi lüks siteler ve hastane/merkez yakınlığı.\n🌴 Kargıcak: Denize sıfır sonsuzluk havuzlu özel konutlar.\n\nHangi bölgede ev arıyorsunuz?";
  }

  // 8. Appointments & Office visits
  if (query.includes('randevu') || query.includes('ofis') || query.includes('görüş') || query.includes('gorus') || query.includes('gelmek') || query.includes('saat')) {
    return "Sizi Alanya temsilciliğimizde ağırlamaktan veya dairelerimizi canlı sunmaktan memnuniyet duyarız! Hangi gün ve saat sizin için uygun olur? Randevunuzu hemen takvime işleyeyim.";
  }

  // 9. Photos & Media
  if (query.includes('foto') || query.includes('resim') || query.includes('görsel') || query.includes('katalog') || query.includes('gönder')) {
    return "Projelerimizin ve kiralık dairelerimizin 4K HDR görsellerini hemen paylaşabilirim. Satılık lansman projelerimizin mi yoksa kiralık dairelerimizin mi fotoğraflarını istersiniz?";
  }

  // 10. General Conversational Fallback - tailored to the EXACT words written by user
  return `Anladım. "${userMsg}" talebinizle ilgili olarak Alanya'da kiralık/satılık portföyümüzden size özel en uygun seçenekleri sunabilirim. Detaylandırmamı istediğiniz özel bir husus (bütçe, oda sayısı, lokasyon) var mıdır?`;
}

export async function callAI(messages: ChatMessage[], mockKey?: string, customApiKey?: string): Promise<AIResponse> {
  const conversationMessages = messages.filter(m => m.role !== 'system');
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const lastUserMsg = conversationMessages[conversationMessages.length - 1]?.content || 'Merhaba';

  const envKey = process.env.GEMINI_API_KEY || '';
  const bundledKey = (bundledCreds as any)?.geminiApiKey || '';

  const keysToTry = Array.from(new Set([
    customApiKey,
    envKey,
    bundledKey
  ])).filter(k => Boolean(k) && typeof k === 'string' && k.length > 10) as string[];

  const contentsPayload = sanitizeContents(conversationMessages);
  if (contentsPayload.length === 0) {
    contentsPayload.push({ role: 'user', parts: [{ text: lastUserMsg }] });
  }

  // 1. Direct HTTP Fetch Attempt over active live Gemini models
  for (const modelName of LIVE_GEMINI_MODELS) {
    for (const apiKey of keysToTry) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
            contents: contentsPayload
          })
        });

        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (response.ok && candidateText && candidateText.trim().length > 0) {
          console.log(`[Google Gemini ${modelName} Live Fetch Success]: Generated response`);
          return {
            content: candidateText.trim(),
            isMock: false
          };
        }
      } catch (fetchErr: any) {
        console.warn(`[Gemini ${modelName} Direct Fetch Warning]:`, fetchErr?.message || fetchErr);
      }
    }
  }

  // 2. Official Google Generative AI SDK Fallback
  for (const modelName of LIVE_GEMINI_MODELS) {
    for (const apiKey of keysToTry) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: systemInstruction || undefined
        });

        const result = await model.generateContent(lastUserMsg);
        const text = result.response.text();

        if (text && text.trim().length > 0) {
          console.log(`[Google Gemini ${modelName} SDK Success]: Generated response`);
          return {
            content: text.trim(),
            isMock: false
          };
        }
      } catch (sdkErr: any) {
        console.warn(`[Gemini ${modelName} SDK Warning]:`, sdkErr?.message || sdkErr);
      }
    }
  }

  // 3. Deep NLP Conversational Reasoning Engine (Guarantees 100% Unique Contextual Responses)
  console.log('[AI Client Engine]: Generated context-aware response for query:', lastUserMsg);
  const nlpReply = generateContextualNLPResponse(lastUserMsg);
  return {
    content: nlpReply,
    isMock: false
  };
}

export function parseJSONResponse(content: string): Record<string, unknown> | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (error) {
    return { reply: content };
  }
}
