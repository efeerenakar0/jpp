import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

type ChatMessage = {
  fromMe: boolean;
  content: string;
};

export async function POST(req: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { phone, chatHistory } = (await req.json()) as {
      phone?: string;
      chatHistory?: ChatMessage[];
    };

    if (!phone || !Array.isArray(chatHistory)) {
      return NextResponse.json({ error: 'Eksik veri' }, { status: 400 });
    }

    // Telefon numarasından ilgili ilanı bul (Bağlam kurabilmek için)
    const listings = await prisma.huntedListing.findMany({
      where: { companyAccountId: principal.account.id },
    });
    const matchingListing = listings.find(l => {
        if (!l.ownerPhone) return false;
        const cleanListingPhone = l.ownerPhone.replace(/\\D/g, '');
        const cleanIncomingPhone = phone.replace(/\\D/g, '');
        return cleanListingPhone === cleanIncomingPhone || 
               cleanListingPhone.endsWith(cleanIncomingPhone) || 
               cleanIncomingPhone.endsWith(cleanListingPhone);
    });

    let listingContext = '';
    if (matchingListing) {
        listingContext = `
Konuşulan İlanın Bilgileri:
- Başlık: ${matchingListing.title}
- Fiyat: ${matchingListing.price}
- Sahibi: ${matchingListing.ownerName || 'Bilinmiyor'}
- Ham Veri/Notlar: ${matchingListing.rawData || matchingListing.notes || 'Yok'}
`;
    }

    // Gemini Sistem Komutu
    const systemPrompt = `Sen profesyonel, samimi ve ikna edici bir emlak asistanısın. Görevin, müşteriyle olan WhatsApp sohbet geçmişine bakarak, müşterinin son mesajına en uygun cevabı yazmak.
Cevabın kesinlikle:
1. Çok kısa ve WhatsApp formatına uygun olmalı.
2. Mümkünse müşteriyi ofise davet etmeli veya randevu koparmaya çalışmalı.
3. Asla "Merhaba, ben bir yapay zekayım" gibi robotik ifadeler içermemeli.

${listingContext}

İşte o ana kadarki konuşma geçmişi (Sırasıyla eskiden yeniye):
${chatHistory.map((msg) => `[${msg.fromMe ? 'Sen' : 'Müşteri'}]: ${msg.content}`).join('\\n')}

Sadece müşteriye göndereceğim metni yaz. Ekstra hiçbir yorum yapma.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(systemPrompt);
    const aiReply = result.response.text().trim();

    return NextResponse.json({ reply: aiReply });
  } catch (error: unknown) {
    console.error('WhatsApp AI Reply Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI yanıtı üretilemedi.' },
      { status: 500 }
    );
  }
}
