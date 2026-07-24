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

  customerAssistant: (context: { companyName: string; availableListings: string; conversationHistory: string; customerMessage: string }) => `
Sen ${context.companyName} firmasında çalışan, Alanya emlak piyasasını, yatırım kanunlarını, ikamet izni ve Türk Vatandaşlığı mevzuatını avucunun içi gibi bilen, son derece bilgili, tecrübeli, samimi ve iş bitirici Emlak Danışmanı Efe'sin.
Müşteri karşısında robot veya yapay zeka olduğunu HİSSETMEMELİ. Tıpkı WhatsApp'tan yazışan gerçek ve bilgili bir insan emlak uzmanı gibi yanıt ver.

ÖNEMLİ UZMANLIK VE İLETİŞİM KURALLARI:
1. TÜRK VATANDAŞLIĞI VE İKAMET İZNİ SORULURSA:
   - Türk Vatandaşlığı kazanabilmek için en az $400.000 (400 bin Dolar) tutarında gayrimenkul SATIN ALINMASI gerekmektedir.
   - Kiralık ev ile KESİNLİKLE Türk Vatandaşı OLUNAMAZ. Kiralık evle sadece geçici turistik ikamet izni başvurusu yapılabileceğini ancak vatandaşlık hakkı vermediğini açıkça belirt.
   - Vatandaşlığa uygun $400.000+ değerindeki satılık lüks projelerimiz hakkında bilgi vermek istediğini söyle.
2. MÜŞTERİNİN SPESİFİK SORUSUNA DOĞRUDAN CEVAP VER:
   - Müşteri ne soruyorsa (Vatandaşlık, Kiralık, Satılık, 1+1, Fiyat, Lokasyon) doğrudan o soruya cevap ver. 
   - Kesinlikle her mesajda hazır kalıplaşmış "Size en uygun portföyü sunabilmem için..." veya "Alanya Mahmutlar bölgesindeki kiralık..." gibi sabit cümleleri TEKRARLAMA!
3. MESAJ BOYUTU:
   - WhatsApp mesajları kısa, öz, anlaşılır ve samimi olmalıdır.

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
};

// ---- Stateful Multi-Turn Conversation Memory Engine (Smart Dynamic Fallback) ----

interface ConversationState {
  intent: 'RENTAL' | 'SALE' | 'CITIZENSHIP' | 'UNKNOWN';
  location: string | null;
  roomType: string | null;
  budget: string | null;
  isFurnished: boolean;
}

function extractConversationState(messages: ChatMessage[]): ConversationState {
  const fullText = messages.map(m => m.content).join(' ').toLowerCase();

  const isCitizenship = fullText.includes('vatandaş') || fullText.includes('citizenship') || fullText.includes('pasaport') || fullText.includes('ikamet');
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
  const budgetMatch = fullText.match(/(\d+[\d\.]*)\s*(bin|tl|k|milyon|euro|€|\$|dolar)?/i);
  if (budgetMatch) {
    const num = budgetMatch[1];
    const unit = budgetMatch[2] || '';
    budget = `${num} ${unit}`.trim();
  }

  return {
    intent: isCitizenship ? 'CITIZENSHIP' : (isRental ? 'RENTAL' : (isSale ? 'SALE' : 'UNKNOWN')),
    location,
    roomType,
    budget,
    isFurnished: fullText.includes('eşyalı') || fullText.includes('esyali'),
  };
}

export function generateSmartFallbackResponse(messages: ChatMessage[]): string {
  const state = extractConversationState(messages);
  const lastMsg = (messages[messages.length - 1]?.content || '').toLowerCase();

  // Handle Citizenship & Passport Queries
  if (lastMsg.includes('vatandaş') || lastMsg.includes('citizenship') || lastMsg.includes('ikamet')) {
    if (lastMsg.includes('kiralık') || lastMsg.includes('kira')) {
      return JSON.stringify({
        reply: "Kiralık ev ile maalesef Türk Vatandaşlığı alınamamaktadır. Türk Vatandaşlığı hakkı kazanmak için en az $400.000 tutarında gayrimenkul SATIN ALMANIZ gerekmektedir. Vatandaşlığa uygun $400.000+ satılık lüks projelerimiz hakkında bilgi vermek ister misiniz?",
        detectedIntent: "INVESTMENT",
        suggestedListings: [],
        isAppointmentRequest: false
      });
    }
    return JSON.stringify({
      reply: "Türk Vatandaşlığı başvurusu için Türkiye'de en az $400.000 değerinde gayrimenkul satın almanız gerekmektedir. Jasmine Group olarak vatandaşlığa tam uygun lansman projelerimiz mevcuttur. Detaylı katalog iletmemi ister misiniz?",
      detectedIntent: "INVESTMENT",
      suggestedListings: [],
      isAppointmentRequest: false
    });
  }

  if (state.intent === 'RENTAL') {
    if (state.location && state.roomType) {
      return JSON.stringify({
        reply: `Tabii ki! ${state.location} bölgesinde ${state.isFurnished ? 'eşyalı ' : ''}${state.roomType} kiralık daire portföyümüz mevcut. Aylık düşündüğünüz bütçe nedir acaba?`,
        detectedIntent: "RESIDENTIAL",
        suggestedListings: [],
        isAppointmentRequest: false
      });
    }
    return JSON.stringify({
      reply: "Alanya, Mahmutlar ve Oba bölgesindeki kiralık daire seçeneklerimiz mevcut. Düşündüğünüz belirli bir bölge veya oda sayısı (1+1, 2+1) var mıdır?",
      detectedIntent: "RESIDENTIAL",
      suggestedListings: [],
      isAppointmentRequest: false
    });
  }

  if (state.intent === 'SALE') {
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
    reply: "Size tam yardımcı olabilmem için arayışınız kiralık mı yoksa satılık mı, veya bilgi almak istediğiniz özel bir konu var mıdır?",
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

  // OFFICIAL GOOGLE GEMINI MODEL NAMES (INCLUDES LATEST GEMINI 2.0 & 1.5 MODELS)
  const modelsToTry = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-flash-latest"
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
