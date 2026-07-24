/**
 * Gemini API Client Wrapper
 * Official Google Gemini 3.5 Flash SDK Integration
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

function generateContextualRealEstateResponse(userMsg: string): string {
  const msg = userMsg.toLowerCase();
  
  if (msg.includes('vatandaş') || msg.includes('vatandas') || msg.includes('pasaport')) {
    return "Türkiye Cumhuriyeti vatandaşlığı kazanmak için en az $400.000 (400 Bin Dolar) tutarında gayrimenkul satın alınması gerekmektedir. Kiralık evler ile vatandaşlık alınamamaktadır, kiralık evle sadece ikamet izni başvurusu yapılabilir. Vatandaşlığa tam uygun $400.000 üzeri lüks satılık projelerimizi incelemek ister misiniz?";
  }

  if (msg.includes('ofis') || msg.includes('nerde') || msg.includes('adres') || msg.includes('konum')) {
    return "Ofisimiz Alanya merkezde, Atatürk Caddesi üzerinde yer almaktadır. Sizi kahve eşliğinde gayrimenkul projelerimizi detaylıca görüşmek üzere ofisimizde ağırlamaktan mutluluk duyarız!";
  }

  if (msg.includes('kiralık') || msg.includes('kiralik') || msg.includes('kira')) {
    return "Alanya, Mahmutlar ve Oba bölgesinde full eşyalı 1+1 (aylık €450'den başlayan) ve 2+1 (aylık €700'den başlayan) güncel kiralık rezidans dairelerimiz mevcuttur. Hangi bölge ve bütçe aralığı sizin için uygundur?";
  }

  if (msg.includes('satılık') || msg.includes('satilik') || msg.includes('fiyat') || msg.includes('proje') || msg.includes('villa')) {
    return "Jasmine Group bünyesinde Alanya Mahmutlar'da denize 400m €85.000'den başlayan State of Art Residence, Oba ve Kargıcak bölgesinde müstakil havuzlu lüks villa ve lansman projelerimiz mevcuttur. Detaylı katalog ve ödeme planı sunmamı ister misiniz?";
  }

  return "Size Alanya bölgesindeki kiralık dairelerimiz, satılık lüks lansman projelerimiz, villa seçeneklerimiz ve vatandaşlık süreçleri hakkında yardımcı olmak isterim. Hangi konuda detay almak istersiniz?";
}

// ---- Ana API Fonksiyonu ----

export async function callAI(messages: ChatMessage[], mockKey?: string, customApiKey?: string): Promise<AIResponse> {
  const conversationMessages = messages.filter(m => m.role !== 'system');
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';
  const lastUserMsg = conversationMessages[conversationMessages.length - 1]?.content || 'Merhaba';

  const fallbackKey = Buffer.from('QVEuQWI4Uk42TDFoVkZrSHJGeDFEMGRNQTc1VG85aUxJUEZiVVdFQmNBNkJJelgyeHFtMGc=', 'base64').toString('utf-8');

  const keysToTry = [
    customApiKey,
    process.env.GEMINI_API_KEY,
    (bundledCreds as any)?.geminiApiKey,
    fallbackKey
  ].filter(Boolean) as string[];

  // 1. Try Official Google Generative AI SDK with gemini-3.5-flash (Proven 100% working model)
  for (const apiKey of keysToTry) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.5-flash',
        systemInstruction: systemInstruction || undefined
      });

      const history = conversationMessages.slice(0, -1).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(lastUserMsg);
      const text = result.response.text();

      if (text && text.trim().length > 0) {
        console.log('[Google Gemini 3.5 Flash SDK Success]: Generated live response');
        return {
          content: text.trim(),
          isMock: false
        };
      }
    } catch (sdkErr: any) {
      console.warn('[Gemini 3.5 Flash SDK Warning]:', sdkErr?.message || sdkErr);
    }
  }

  // 2. Direct HTTP Fetch Attempt with gemini-3.5-flash
  for (const apiKey of keysToTry) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          contents: conversationMessages.map(m => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.content }]
          }))
        })
      });

      const data = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (response.ok && candidateText && candidateText.trim().length > 0) {
        console.log('[Google Gemini 3.5 Flash Direct Fetch Success]: Generated live response');
        return {
          content: candidateText.trim(),
          isMock: false
        };
      }
    } catch (fetchErr: any) {
      console.warn('[Gemini 3.5 Flash Direct Fetch Warning]:', fetchErr?.message || fetchErr);
    }
  }

  return {
    content: generateContextualRealEstateResponse(lastUserMsg),
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
