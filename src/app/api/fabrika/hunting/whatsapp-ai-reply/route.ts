import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const { phone, chatHistory } = await req.json();

    if (!phone || !chatHistory) {
      return NextResponse.json({ error: 'Eksik veri' }, { status: 400 });
    }

    // Telefon numarasından ilgili ilanı bul (Bağlam kurabilmek için)
    const listings = await prisma.huntedListing.findMany();
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
${chatHistory.map((msg: any) => `[${msg.fromMe ? 'Sen' : 'Müşteri'}]: ${msg.content}`).join('\\n')}

Sadece müşteriye göndereceğim metni yaz. Ekstra hiçbir yorum yapma.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(systemPrompt);
    const aiReply = result.response.text().trim();

    return NextResponse.json({ reply: aiReply });
  } catch (error: any) {
    console.error('WhatsApp AI Reply Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
