/**
 * Gemini API Client Wrapper
 * Official Google Gemini 3.5 & 2.5 Flash Model Integration
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import bundledCreds from './meta-credentials.json';

function getGenAI(customApiKey?: string) {
  let apiKey = customApiKey || process.env.GEMINI_API_KEY || (bundledCreds as any)?.geminiApiKey || '';
  if (!apiKey && (bundledCreds as any)?.geminiApiKeyBase64) {
    try {
      apiKey = Buffer.from((bundledCreds as any).geminiApiKeyBase64, 'base64').toString('utf-8');
    } catch (e) {}
  }
  return new GoogleGenerativeAI(apiKey);
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  isMock: boolean;
}

// ---- Prompt Şablonları ----

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
1. Kesinlikle ama kesinlikle ilan sahibinin adını kullanma veya tahmin etme (örn: "Ahmet Bey", "Ayşe Hanım", "Sayın İlan Sahibi" gibi ifadeler YAZMA). Sadece doğrudan "Merhaba," diye başla.
2. Senin adın Efe. Mesajın sonuna her zaman imza olarak "Efe - ${company.companyName}" şeklinde kendi adını yaz.
3. Mesaj WhatsApp üzerinden gönderilecek, bu yüzden kısa ve etkili olsun (max 500 karakter).
`,

  customerAssistant: (context: { companyName: string; availableListings: string; conversationHistory: string; customerMessage: string }) => `
Sen ${context.companyName} firmasında çalışan, Alanya emlak piyasasını, yatırım kanunlarını, ikamet izni ve Türk Vatandaşlığı mevzuatını avucunun içi gibi bilen, son derece bilgili, tecrübeli, samimi ve iş bitirici Emlak Danışmanı Efe'sin.
Müşteri karşısında robot veya yapay zeka olduğunu HİSSETMEMELİ. Tıpkı WhatsApp'tan yazışan gerçek ve bilgili bir insan emlak uzmanı gibi yanıt ver.

ÖNEMLİ KURALLAR:
1. Müşteri ne sorarsa sorsun (Vatandaşlık, İkamet izni, Kiralık daire, Satılık proje, Fiyatlar, Taksit imkanları, Alanya lokasyonları) doğrudan müşterinin özel sorusuna bilgili, uzman bir insan gibi detaylı yanıt ver.
2. TÜRK VATANDAŞLIĞI SORULURSA:
   - En az $400.000 (400 bin Dolar) tutarında gayrimenkul SATIN ALINMASI gerektiğini açıkla.
   - Kiralık ev ile KESİNLİKLE vatandaşlık ALINAMAYACAĞINI, kiralık evle sadece kısa dönem ikamet izni başvurusu yapılabileceğini belirt.
   - Vatandaşlığa tam uygun $400.000+ satılık projelerimizden bahset.
3. KESİNLİKLE HAZIR KALIPI ÇÜMLELERİ TEKRARLAMA! Her mesaja özel, o anki soruya özel orijinal yanıt üret.
4. Mesaj boyutun WhatsApp'ta rahat okunan akıcı, net, samimi ve öz olsun.

Mevcut İlanlar & Projeler:
${context.availableListings}

Sohbet Geçmişi:
${context.conversationHistory}

Müşterinin Son Mesajı: ${context.customerMessage}

Doğrudan müşteriye gönderilecek insansı WhatsApp yanıtını yaz (Gereksiz açıklama yazma, sadece müşteriye atılacak mesajı ver).
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

// ---- Ana API Fonksiyonu ----

export async function callAI(messages: ChatMessage[], mockKey?: string, customApiKey?: string): Promise<AIResponse> {
  const conversationMessages = messages.filter(m => m.role !== 'system');
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

  let apiKey = customApiKey || process.env.GEMINI_API_KEY || (bundledCreds as any)?.geminiApiKey || '';
  if (!apiKey && (bundledCreds as any)?.geminiApiKeyBase64) {
    try {
      apiKey = Buffer.from((bundledCreds as any).geminiApiKeyBase64, 'base64').toString('utf-8');
    } catch (e) {}
  }

  if (!apiKey) {
    return {
      content: "⚠️ [Yapay Zeka Uyarısı]: Gemini API Anahtarı bulunamadı. Lütfen Asistan panelindeki Meta & AI Ayarları butonundan Gemini API Anahtarınızı kaydedin.",
      isMock: true
    };
  }

  const modelsToTry = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-2.0-flash",
    "gemini-flash-latest"
  ];

  const contentsPayload = conversationMessages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const isBearer = apiKey.startsWith('AQ') || apiKey.length > 50;

  for (const modelName of modelsToTry) {
    try {
      const endpoint = isBearer 
        ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`
        : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isBearer) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          contents: contentsPayload
        })
      });

      const data = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (response.ok && candidateText && candidateText.trim().length > 0) {
        console.log(`[Google Gemini ${modelName} Live Success]: Generated response`);
        return {
          content: candidateText.trim(),
          isMock: false
        };
      }

      if (data?.error?.message) {
        console.warn(`[Google Gemini ${modelName} API Error]:`, data.error.message);
      }
    } catch (err: any) {
      console.warn(`[Google Gemini ${modelName} Fetch Exception]:`, err?.message || err);
    }
  }

  // Fallback to Generative AI SDK
  try {
    const genAI = getGenAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash', systemInstruction });
    const chatSession = model.startChat({
      history: conversationMessages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }))
    });
    const lastMsg = conversationMessages[conversationMessages.length - 1]?.content || 'Merhaba';
    const result = await chatSession.sendMessage(lastMsg);
    const text = result.response.text();
    if (text && text.trim().length > 0) {
      return { content: text.trim(), isMock: false };
    }
  } catch (sdkErr: any) {
    console.warn('[Gemini SDK Fallback Error]:', sdkErr?.message || sdkErr);
  }

  return {
    content: "⚠️ [Yapay Zeka Uyarısı]: Google Gemini API Anahtarınız (aistudio.google.com) yetkisiz veya engellenmiş olabilir (API_KEY_SERVICE_BLOCKED). Lütfen aistudio.google.com adresinden yeni bir Gemini API Anahtarı alıp kaydedin.",
    isMock: true
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
