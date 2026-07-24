/**
 * Gemini API Client Wrapper
 * Mock/gerçek mod otomatik geçiş destekli
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

function getGenAI(customApiKey?: string) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || '';
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

  adCopyGoogle: (listing: { title: string; price?: string; location?: string }, targetUrl: string) => `
Google Ads için bir reklam metni yaz. 

İlan: ${listing.title}
${listing.price ? `Fiyat: ${listing.price}` : ''}
${listing.location ? `Konum: ${listing.location}` : ''}
URL: ${targetUrl}

JSON formatında döndür:
{
  "headline1": "... (max 30 karakter)",
  "headline2": "... (max 30 karakter)", 
  "headline3": "... (max 30 karakter)",
  "description1": "... (max 90 karakter)",
  "description2": "... (max 90 karakter)"
}
`,

  adCopyInstagram: (listing: { title: string; price?: string; location?: string; imageUrl?: string }) => `
Instagram için etkileyici bir post metni yaz. Emoji kullan, hashtag ekle, görsel odaklı ol.

İlan: ${listing.title}
${listing.price ? `Fiyat: ${listing.price}` : ''}
${listing.location ? `Konum: ${listing.location}` : ''}

JSON formatında döndür:
{
  "caption": "... (max 2200 karakter, emoji ve hashtag dahil)",
  "hashtags": ["#tag1", "#tag2", ...]
}
`,

  adCopyWhatsApp: (listing: { title: string; price?: string; location?: string }) => `
WhatsApp grupları için samimi bir paylaşım mesajı yaz. Doğal ol, spam gibi görünmesin.

İlan: ${listing.title}
${listing.price ? `Fiyat: ${listing.price}` : ''}
${listing.location ? `Konum: ${listing.location}` : ''}
`,

  customerAssistant: (context: { companyName: string; availableListings: string; conversationHistory: string; customerMessage: string }) => `
Sen ${context.companyName} firmasında çalışan, Alanya emlak piyasasını avucunun içi gibi bilen, tecrübeli, samimi ve iş bitirici Emlak Danışmanı Efe'sin.
Müşteri karşısında robot veya yapay zeka olduğunu HİSSETMEMELİ. Tıpkı WhatsApp'tan yazışan gerçek bir insan emlak uzmanı gibi yanıt ver.

KURALLAR:
1. Müşterinin sorduğu soruya (Kiralık, Satılık, 1+1, 2+1, Fiyat, Bölge) doğrudan odaklanarak yanıt ver.
2. Müşteri "kiralık" dediyse Alanya ve Mahmutlar'daki kiralık portföylerden bahset, bütçesini ve oda tercihini sor.
3. KESİNLİKLE HER MESAJDA AYNI TEKRAR EDEN İLETIŞIM CÜMLESINI YAZMA! Müşterinin spesifik olarak yazdığı kelimelere göre dinamik ve doğal konuş.
4. Mesaj boyutun WhatsApp ekranında rahat okunan kısa, net ve öz olsun.

Mevcut İlanlar & Projeler:
${context.availableListings}

Sohbet Geçmişi:
${context.conversationHistory}

Müşterinin Son Mesajı: ${context.customerMessage}

JSON formatında yanıt dön:
{
  "reply": "Müşteriye gönderilecek insansı WhatsApp mesajı",
  "detectedIntent": "INVESTMENT | RESIDENTIAL | BOTH | UNKNOWN",
  "suggestedListings": [],
  "isAppointmentRequest": false,
  "proposedDate": null,
  "proposedTime": null
}
`,

  appointmentConfirm: (details: { customerName: string; date: string; time: string; companyName: string }) => `
Randevu teyit mesajı üret:
Müşteri: ${details.customerName}
Tarih: ${details.date}
Saat: ${details.time}
Firma: ${details.companyName}

Profesyonel ve sıcak bir teyit mesajı yaz. Max 200 karakter.
`,

  brandCampaign: (company: { companyName: string; strengths: string[]; serviceAreas: string[] }) => `
${company.companyName} emlak firması için marka tanıtım kampanyası metinleri üret.

Güçlü Yanlar: ${company.strengths.join(', ')}
Hizmet Bölgeleri: ${company.serviceAreas.join(', ')}

JSON formatında döndür:
{
  "google": { "headline": "...", "description": "..." },
  "instagram": { "caption": "...", "hashtags": [...] },
  "whatsapp": "..."
}
`,
};

// ---- Stateful Multi-Turn Conversation Memory Engine (Smart Fallback) ----

interface ConversationState {
  intent: 'RENTAL' | 'SALE' | 'UNKNOWN';
  location: string | null;
  roomType: string | null;
  budget: string | null;
  isFurnished: boolean;
}

function extractConversationState(messages: ChatMessage[]): ConversationState {
  const fullText = messages.map(m => m.content).join(' ').toLowerCase();

  const isRental = fullText.includes('kiralık') || fullText.includes('kira') || fullText.includes('kiralayacağım') || fullText.includes('öğrenci');
  const isSale = !isRental && (fullText.includes('satılık') || fullText.includes('satın') || fullText.includes('yatırım'));

  let location: string | null = null;
  if (fullText.includes('mahmutlar')) location = 'Mahmutlar';
  else if (fullText.includes('oba')) location = 'Oba';
  else if (fullText.includes('kargıcak')) location = 'Kargıcak';
  else if (fullText.includes('avsallar')) location = 'Avsallar';
  else if (fullText.includes('kestel')) location = 'Kestel';
  else if (fullText.includes('alanya')) location = 'Alanya';

  let roomType: string | null = null;
  if (fullText.includes('1+1') || fullText.includes('bir artı bir')) roomType = '1+1';
  else if (fullText.includes('2+1') || fullText.includes('iki artı bir')) roomType = '2+1';
  else if (fullText.includes('3+1') || fullText.includes('üç artı bir')) roomType = '3+1';
  else if (fullText.includes('stüdyo') || fullText.includes('studio')) roomType = 'Stüdyo';

  let budget: string | null = null;
  const budgetMatch = fullText.match(/(\d+[\d\.]*)\s*(bin|tl|k|milyon|euro|€)?/i);
  if (budgetMatch) {
    const num = budgetMatch[1];
    const unit = budgetMatch[2] || '';
    budget = `${num} ${unit}`.trim();
  }

  return {
    intent: isRental ? 'RENTAL' : (isSale ? 'SALE' : 'UNKNOWN'),
    location,
    roomType,
    budget,
    isFurnished: fullText.includes('eşyalı') || fullText.includes('esyali'),
  };
}

export function generateSmartFallbackResponse(messages: ChatMessage[]): string {
  const state = extractConversationState(messages);
  const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();

  if (state.intent === 'RENTAL') {
    if (state.location && state.roomType) {
      return JSON.stringify({
        reply: `Tabii ki! ${state.location} bölgesinde ${state.isFurnished ? 'eşyalı ' : ''}${state.roomType} kiralık daire portföyümüz mevcut. Aylık düşündüğünüz ortalama bütçe nedir acaba?`,
        detectedIntent: "RESIDENTIAL",
        suggestedListings: [],
        isAppointmentRequest: false
      });
    }
    if (state.location) {
      return JSON.stringify({
        reply: `Harika! ${state.location} bölgesindeki kiralık daire seçeneklerimiz oldukça geniş. Aradığınız ev 1+1 mi yoksa 2+1 mi olsun?`,
        detectedIntent: "RESIDENTIAL",
        suggestedListings: [],
        isAppointmentRequest: false
      });
    }
    return JSON.stringify({
      reply: "Alanya, Mahmutlar ve Oba bölgesindeki güncel kiralık daire seçeneklerimiz mevcut. Düşündüğünüz belirli bir bölge, oda sayısı (1+1, 2+1) veya bütçe aralığı var mıdır?",
      detectedIntent: "RESIDENTIAL",
      suggestedListings: [],
      isAppointmentRequest: false
    });
  }

  if (state.intent === 'SALE') {
    if (state.location && state.budget) {
      return JSON.stringify({
        reply: `Alanya ${state.location} bölgesinde ${state.budget} bütçenize özel, lansman fiyatlı satılık projelerimizin detaylarını hazırlıyoruz. Yatırımlık mı yoksa hemen oturum amaçlı mı düşünüyorsunuz?`,
        detectedIntent: "INVESTMENT",
        suggestedListings: [],
        isAppointmentRequest: false
      });
    }
    return JSON.stringify({
      reply: "Alanya genelinde lansmana özel fiyatlı ve yüksek prim getirili satılık projelerimiz var. Düşündüğünüz oda sayısı ve bütçe aralığı nedir?",
      detectedIntent: "INVESTMENT",
      suggestedListings: [],
      isAppointmentRequest: false
    });
  }

  if (lastMsg.includes('selam') || lastMsg.includes('merhaba')) {
    return JSON.stringify({
      reply: "Merhaba! Jasmine Group'tan ben Efe. Alanya bölgesindeki kiralık veya satılık daire arayışınızda size yardımcı olmaktan memnuniyet duyarım. Nasıl bir ev bakıyordunuz?",
      detectedIntent: "UNKNOWN",
      suggestedListings: [],
      isAppointmentRequest: false
    });
  }

  return JSON.stringify({
    reply: "Size en uygun portföyü sunabilmem için arayışınız kiralık mı yoksa satılık mı, ve tercih ettiğiniz oda sayısı nedir acaba?",
    detectedIntent: "UNKNOWN",
    suggestedListings: [],
    isAppointmentRequest: false
  });
}

// ---- Ana API Fonksiyonu ----

export async function callAI(messages: ChatMessage[], mockKey?: string, customApiKey?: string): Promise<AIResponse> {
  const conversationMessages = messages.filter(m => m.role !== 'system');
  const systemInstruction = messages.find(m => m.role === 'system')?.content || '';

  const formattedHistory = conversationMessages.slice(0, -1).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const lastMessage = conversationMessages[conversationMessages.length - 1] || { role: 'user', content: 'Merhaba' };

  const genAI = getGenAI(customApiKey);

  // OFFICIAL GOOGLE GEMINI MODEL NAMES
  const modelsToTry = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash-exp"
  ];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const modelWithSystem = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemInstruction 
      });

      const chatSession = modelWithSystem.startChat({
        history: formattedHistory,
      });

      const result = await chatSession.sendMessage(lastMessage.content);
      const textContent = result.response.text();

      if (textContent && textContent.trim().length > 0) {
        return {
          content: textContent,
          isMock: false,
        };
      }
    } catch (err: any) {
      console.warn(`[Gemini Model ${modelName} Warning]:`, err?.message || err);
      lastError = err;
    }
  }

  console.warn(`[Gemini API Fallback Triggered]: All models failed (${lastError?.message}), using smart dynamic response generator`);
  
  return {
    content: generateSmartFallbackResponse(conversationMessages),
    isMock: true
  };
}

// ---- Yardımcı Fonksiyonlar ----

export function parseJSONResponse(content: string): Record<string, unknown> | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    return null;
  }
}
