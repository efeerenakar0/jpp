import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Ham veriyi Gemini'ye gönder
    const prompt = `Sen uzman bir Emlak SEO Uzmanısın. Aşağıdaki ham emlak ilan verisini analiz et.
Bana JSON formatında şu bilgileri üret:
1. "title": Çok dikkat çekici, SEO uyumlu ve profesyonel bir ilan başlığı (Maks 70 karakter).
2. "description": İkna edici, detaylı, emlak terimlerini profesyonelce kullanan, SEO uyumlu bir ilan açıklaması.
3. "seoKeywords": Virgülle ayrılmış en az 5 adet SEO odaklı anahtar kelime.

Ham Veri:
${JSON.stringify(data, null, 2)}

Sadece JSON formatında cevap ver, kod blogu falan ekleme.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    let aiResponse = result.response.text();
    
    // JSON temizliği
    aiResponse = aiResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let seoData;
    try {
        seoData = JSON.parse(aiResponse);
    } catch(e) {
        console.error("AI JSON Parse Hatası:", aiResponse);
        seoData = {
            title: data.title || "Yeni Emlak İlanı",
            description: data.description || "Açıklama bulunamadı.",
            seoKeywords: "emlak, yatırım"
        };
    }

    // Veritabanına kaydet (Project modeline)
    const newProject = await prisma.project.create({
      data: {
        slug: (seoData.title || `proje-${Date.now()}`).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: seoData.title || data.title || "Yeni Proje",
        location: data.location || "Alanya",
        status: "Satışta",
        image: data.image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
        shortDescription: (seoData.description || "").slice(0, 150),
        description: seoData.description || "Açıklama hazırlanıyor.",
        features: ["Lüks Konut", "SEO Uyumlu"],
        deliveryDate: "2026",
        price: data.price || "€100.000",
        published: true
      }
    });

    return NextResponse.json({ success: true, project: newProject });
  } catch (error: any) {
    console.error('Portfolio Add Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
