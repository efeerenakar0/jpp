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
2. Senin adın Efe. Mesajın sonuna her zaman imza olarak "Efe - ${company.companyName}" şeklinde kendi adını yaz. "[Adınız]" gibi boşluk doldurmalı ifadeler KULLANMA.
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

Kısa, öz ve samimi bir mesaj yaz. Emoji kullan ama abartma. Max 300 karakter.
`,

  customerAssistant: (context: { companyName: string; availableListings: string; conversationHistory: string; customerMessage: string }) => `
Sen ${context.companyName} firmasında çalışan, piyasayı avucunun içi gibi bilen, son derece bilgili, tecrübeli, samimi ve doğal Emlak Danışmanı Efe'sin.
Müşteri karşısında kesinlikle bir robot veya yapay zeka olduğunu HİSSETMEMELİ. Tıpkı WhatsApp'tan yazışan, tecrübeli, akıllı ve bilgili bir insan emlak uzmanı gibi davran.

KESİN İLETİŞİM VE PORTFÖY KURALLARI:
1. OFİSE / KAHVEYE DAVET KESİNLİKLE YAPMA (ŞU İKİ DURUM HARİÇ!):
   - Müşteri kendisi "Ofisiniz nerede?", "Seninle görüşmek istiyorum", "Yüz yüze konuşalım", "Yarın gelebilir miyim?" demediği sürece VEYA
   - Müşteri kendisi "Evi ne zaman görebiliriz?", "Daireleri canlı gösterin", "Yerinde bakalım" demediği sürece KESİNLİKLE KAHVE VEYA OFİSE DAVET ETME!
2. MÜŞTERİ "DAİRELERİ GÖNDERİN / BİLGİ VERİN / PORTFÖYÜ ATIN" DEDİĞİNDE:
   - Kesinlikle "Ofise gelin orada konuşalım" deme! Elindeki mevcut ilanları ve projeleri doğrudan WhatsApp mesajında harika, çekici ve akıcı bir dille anlat. Dairelerin lokasyonunu, oda sayısını, fiyatını ve öne çıkan sosyal imkanlarını (havuz, sauna, peyzaj vb.) mesajda detaylandırarak müşteriye sun.
3. KANLI CANLI BİLGİLİ İNSAN GİBİ KONUŞ: Yapay zeka olduğunu belli eden robotik veya kalıplaşmış laflar kullanma. Gerçek ve tecrübeli bir insan nasıl konuşursa öyle yanıt ver.
4. MESAJ BOYUTU KISA VE ÖZ OLMALI (DESTAN YAZMA): Cevapların devasa uzunlukta olmasın! Müşteriyi okurken sıkmayacak, WhatsApp ekranında rahatça okunan akıcı, net, kısa ve öz mesajlar yaz.
5. ABARTILI ÖVGÜLERDEN KAÇIN: Sürekli "Mükemmel tercih!", "Çok iyi seçim!", "Harika karar!" gibi yapay ve samimiyetsiz övgüler dizme. Bilgili bir insan gibi sadece gerekli ve doğal yerlerde samimiyetini göster.
6. Kredi ve taksit sorulursa: Kendi bünyenizdeki esnek ödeme kolaylıklarını güven veren bir dille anlat.

Mevcut İlanlar & Projeler:
${context.availableListings}

Sohbet Geçmişi:
${context.conversationHistory}

Müşterinin Son Mesajı: ${context.customerMessage}

Yalnızca aşağıdaki JSON formatında yanıt dön:
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

3 farklı platform için metin üret:
1. Google Ads (headline + description)
2. Instagram (görsel odaklı caption + hashtags)
3. WhatsApp grupları (samimi tanıtım)

JSON formatında döndür:
{
  "google": { "headline": "...", "description": "..." },
  "instagram": { "caption": "...", "hashtags": [...] },
  "whatsapp": "..."
}
`,
};

// ---- Mock Yanıtlar ----

const MOCK_RESPONSES: Record<string, string> = {
  seo: JSON.stringify({
    seoTitle: "Alanya'da Deniz Manzaralı 3+1 Daire | Jasmine Group",
    metaDescription: "Alanya Mahmutlar'da deniz manzaralı, havuzlu site içinde 3+1 satılık daire. Yatırım için ideal konum ve fiyat avantajı.",
    htmlDescription: "<p>Alanya'nın en gözde bölgelerinden Mahmutlar'da, deniz manzaralı bu muhteşem 3+1 daire sizi bekliyor.</p><p>120 m² kullanım alanına sahip daire, modern tasarımı ve kaliteli malzemeleriyle öne çıkıyor.</p><p>Havuzlu site içinde, denize 500 metre mesafede konumlanan bu eşsiz fırsatı kaçırmayın.</p>"
  }),
  hunting: "Merhaba, Sahibinden.com'daki ilanınızı inceledim. Jasmine Group olarak bölgedeki güçlü müşteri portföyümüz ve profesyonel pazarlama ağımızla ilanınızı çok daha geniş bir kitleye ulaştırabiliriz. Kısa bir görüşme yapmamız mümkün mü? 🏠",
  google_ads: JSON.stringify({
    headline1: "Alanya'da Satılık Daire",
    headline2: "Deniz Manzaralı 3+1",
    headline3: "Uygun Fiyat Avantajı",
    description1: "Alanya Mahmutlar'da deniz manzaralı, havuzlu site içi 3+1 daire. Hemen arayın!",
    description2: "Yatırım için ideal konum. Profesyonel danışmanlık ve ücretsiz tur imkanı."
  }),
  instagram: JSON.stringify({
    caption: "🏖️ Hayalinizdeki ev Alanya'da sizi bekliyor!\n\n✨ 3+1 | 120 m² | Deniz Manzaralı\n📍 Mahmutlar, Alanya\n💰 Uygun fiyat avantajı\n\n🏊 Havuzlu site içinde\n🌊 Denize 500m\n\nDetaylı bilgi için DM'den ulaşın! 📩",
    hashtags: ["#alanya", "#emlak", "#satılıkdaire", "#denizmanzaralı", "#mahmutlar", "#gayrimenkul", "#yatırım", "#türkiye"]
  }),
  whatsapp: "Merhaba 👋 Alanya Mahmutlar'da harika bir 3+1 dairemiz var! Deniz manzaralı, havuzlu site içi. Fiyatı çok uygun. İlgilenen varsa detay verebilirim 🏠✨",
  assistant: "assistant_contextual",
  appointment_confirm: "Sayın müşterimiz, randevunuz onaylanmıştır. 📅 Görüşmemizi dört gözle bekliyoruz. Herhangi bir değişiklik olursa lütfen bizi bilgilendirin. İyi günler! 🏠",
  brand_campaign: JSON.stringify({
    google: { headline: "Jasmine Group | Emlak", description: "Alanya'da güvenilir emlak danışmanlığı. 10+ yıl tecrübe, 500+ mutlu müşteri." },
    instagram: { caption: "🏠 Jasmine Group ile hayalinizdeki eve kavuşun!\n\n✅ 10+ yıl tecrübe\n✅ 500+ mutlu müşteri\n✅ Profesyonel danışmanlık\n\n📩 DM'den ulaşın!", hashtags: ["#jasminegroup", "#emlak", "#alanya"] },
    whatsapp: "Merhaba! Jasmine Group olarak Alanya'da 10+ yıldır emlak danışmanlığı yapıyoruz. Satılık/kiralık ev arayışınızda yanınızdayız. Detay için yazabilirsiniz 🏠"
  }),
};

// ---- Stateful Multi-Turn Conversation Memory Engine (Fallback) ----

interface ConversationState {
  intent: 'RENTAL' | 'SALE' | 'UNKNOWN';
  location: string | null;
  roomType: string | null;
  budget: string | null;
  isFurnished: boolean;
  isStudent: boolean;
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
  const budgetMatch = fullText.match(/(\d+[\d\.]*)\s*(bin|tl|k|milyon)?/i);
  if (budgetMatch) {
    const num = budgetMatch[1];
    const unit = budgetMatch[2] || '';
    if (unit.includes('bin') || unit.includes('k') || (parseInt(num) >= 5 && parseInt(num) <= 100)) {
      budget = `${num}.000 TL`;
    } else if (unit.includes('milyon')) {
      budget = `${num} Milyon TL`;
    } else {
      budget = `${num} ${unit}`.trim();
    }
  }

  return {
    intent: isRental ? 'RENTAL' : (isSale ? 'SALE' : 'UNKNOWN'),
    location,
    roomType,
    budget,
    isFurnished: fullText.includes('eşyalı') || fullText.includes('esyali'),
    isStudent: fullText.includes('öğrenci') || fullText.includes('ogrenci')
  };
}

function generateSmartFallbackReply(messages: ChatMessage[]): string {
  const fullText = messages.map(m => m.content).join(' ').toLowerCase();
  const lastMsgObj = messages[messages.length - 1];
  const lastMsg = (lastMsgObj?.content || '').toLowerCase();
  
  const hasHistory = messages.length > 2 || fullText.includes('asistan:') || fullText.includes('jasmine group');

  // Topic 1: Installments / Credit / Payment options
  if (lastMsg.includes('taksit') || lastMsg.includes('kredi') || lastMsg.includes('ödeme') || lastMsg.includes('vade')) {
    return "Tabii ki! Projelerimizde kendi bünyemizde esnek taksit seçenekleri, peşinat kolaylığı ve anlaşmalı bankalarımızla kredi imkanları sunuyoruz. İlgilendiğiniz daire satılık mı yoksa projeden yatırımlık mı acaba?";
  }

  // Topic 2: Price / Budget queries
  if (lastMsg.includes('fiyat') || lastMsg.includes('ücret') || lastMsg.includes('kaç para') || lastMsg.includes('ne kadar')) {
    return "Fiyatlarımız dairenin konumuna, metrekaresine ve site içi imkanlarına göre değişiklik göstermektedir. Size en güncel fiyat listesini iletebilmemiz için düşündüğünüz bütçe aralığı ve oda sayısı nedir?";
  }

  // Topic 3: Photos / Visuals / Details
  if (lastMsg.includes('fotoğraf') || lastMsg.includes('resim') || lastMsg.includes('görsel') || lastMsg.includes('detay') || lastMsg.includes('katalog')) {
    return "Harika! İlgilendiğiniz kriterlere uygun güncel dairelerimizin detaylı fotoğraflarını ve sunum dosyasını hazırlıyorum. Arayışınız kiralık mı yoksa satılık mı acaba?";
  }

  // Topic 4: Appointment / Office / Location
  if (lastMsg.includes('randevu') || lastMsg.includes('ofis') || lastMsg.includes('nerde') || lastMsg.includes('konum') || lastMsg.includes('gelsem')) {
    return "Ofisimiz Alanya merkezde son derece kolay ulaşılan bir konumdadır. Dilerseniz çay/kahve eşliğinde güncel portföyümüzü incelemek için bir randevu oluşturalım. Hangi gün ve saat sizin için uygun olur?";
  }

  // Topic 5: Rental vs Sale Intent
  const state = extractConversationState(messages);
  
  if (state.intent === 'RENTAL') {
    if (state.location && state.roomType) {
      return `Süper! ${state.location} bölgesinde ${state.isFurnished ? 'eşyalı ' : ''}${state.roomType} kiralık daire portföyümüzü hemen kontrol ettiriyorum. Aylık düşündüğünüz ortalama bütçe aralığı nedir?`;
    }
    if (state.location) {
      return `Tabii ki! ${state.location} bölgesindeki kiralık daire seçeneklerimiz oldukça geniş. Aradığınız ev 1+1 mi yoksa 2+1 mi olsun?`;
    }
    return "Tabii ki! Alanya ve Mahmutlar bölgesindeki güncel kiralık daire portföyümüzü kontrol ediyorum. Düşündüğünüz belirli bir bölge veya oda sayısı var mıdır?";
  }

  if (state.intent === 'SALE') {
    if (state.location && state.budget) {
      return `Alanya ${state.location} bölgesinde ${state.budget} bütçenize özel, lansman fiyatlı satılık dairelerimizin detaylarını hazırlıyoruz. Yatırımlık mı yoksa hemen oturum amaçlı mı düşünüyorsunuz?`;
    }
    return "Alanya genelinde lansmana özel fiyatlı ve yüksek prim getirili satılık projelerimiz var. Yatırımlık mı yoksa oturum amaçlı mı düşünüyorsunuz?";
  }

  // If ongoing conversation exists, respond directly without intro greeting
  if (hasHistory) {
    return "Size tam yardımcı olabilmem için arayışınız kiralık mı yoksa satılık mı, veya düşündüğünüz oda sayısı (1+1, 2+1) nedir acaba?";
  }

  // Default initial greeting for new chats only
  return "Merhaba! Jasmine Group'tan ben. Alanya'da kiralık veya satılık daire arayışınızda size yardımcı olmaktan mutluluk duyarım. Nasıl bir ev arıyorsunuz?";
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
  const modelsToTry = [
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
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

      return {
        content: textContent,
        isMock: false,
      };
    } catch (err: any) {
      console.warn(`[Gemini Model ${modelName} Warning]:`, err?.message || err);
      lastError = err;
      if (err?.status === 429 || err?.message?.includes('Quota') || err?.message?.includes('429')) {
        console.log('[Quota pause detected - Waiting 3 seconds for rate limit reset...]');
        await new Promise(r => setTimeout(r, 3000));
        try {
          const modelWithSystem = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemInstruction });
          const chatSession = modelWithSystem.startChat({ history: formattedHistory });
          const result = await chatSession.sendMessage(lastMessage.content);
          return { content: result.response.text(), isMock: false };
        } catch (retryErr) {
          lastError = retryErr;
        }
      }
    }
  }

  throw new Error(`Google Gemini API execution failed on all models: ${lastError?.message || lastError}`);
}

// ---- Yardımcı Fonksiyonlar ----

export function parseJSONResponse(content: string): Record<string, unknown> | null {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch {
    console.error('Failed to parse AI JSON response:', content);
    return null;
  }
}

export function isAIConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
