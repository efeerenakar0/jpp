import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `Sen Jasmine Group'un IT destek uzmanısın. 
Kullanıcıya domain satın alma, hosting kurulumu ve cPanel üzerinden dosya yükleme işlemlerini adım adım, çok basit bir dille anlat.
Sadece IT, barındırma, sunucu, domain ve web sitesi kurulumu ile ilgili sorulara cevap ver.
Emisyon, emlak satışı gibi konulara girme; bu konularda destek vermediğini ve sadece teknik IT desteği sunduğunu belirt.
Cevaplarını kısa, öz ve Markdown formatında ver.`;

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    // Geçmiş mesajları Gemini formatına çevir
    const formattedHistory = history ? history.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    })) : [];

    // Sohbet oturumunu başlat
    const chat = model.startChat({
        history: [
            { role: 'user', parts: [{ text: "Sistem Talimatı: " + SYSTEM_PROMPT }] },
            { role: 'model', parts: [{ text: "Anlaşıldı. Ben Jasmine Group IT Destek Uzmanıyım." }] },
            ...formattedHistory
        ]
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return NextResponse.json({ reply: responseText });
  } catch (error: any) {
    console.error('IT Support Chat Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
