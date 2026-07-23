import { NextResponse } from 'next/server';
import { callAI } from '@/lib/ai';

const SYSTEM_PROMPT = `Sen Jasmine Group'un IT destek uzmanısın. 
Kullanıcıya domain satın alma, hosting kurulumu ve cPanel üzerinden dosya yükleme işlemlerini adım adım, çok basit bir dille anlat.
Sadece IT, barındırma, sunucu, domain ve web sitesi kurulumu ile ilgili sorulara cevap ver.
Cevaplarını kısa, öz ve Markdown formatında ver.`;

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ reply: 'Merhaba! IT Destek Asistanıyım. Domain, Hosting ve Web Sitenizi canlıya alma konularında yardımcı olabilirim.' });
    }

    try {
      const response = await callAI([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message }
      ], 'it_support');

      if (response && response.content) {
        return NextResponse.json({ reply: response.content });
      }
    } catch (aiErr) {
      console.warn('[IT Support AI Call Warning]: Using fallback response', aiErr);
    }

    const lower = message.toLowerCase();
    let reply = "Merhaba! IT Destek Ekibi olarak web sitenizin cPanel, Domain (Netlify/Vercel) ve SSL ayarlarında size rehberlik etmek için buradayım.";

    if (lower.includes('domain') || lower.includes('alan adı')) {
      reply = "### Domain (Alan Adı) Bağlama Adımları:\n1. Namecheap veya GoDaddy üzerinden domaininizi seçin.\n2. Netlify / Vercel DNS A-Kaydını `75.2.60.5` adresi olarak tanımlayın.\n3. SSL sertifikası otomatik aktifleşecektir.";
    } else if (lower.includes('hosting') || lower.includes('sunucu')) {
      reply = "### Hosting & Yayınlama Rehberi:\n1. Web siteniz Netlify / Vercel bulut sunucusuna bağlıdır.\n2. GitHub 'main' dalına atılan her kod anında canlıya geçer.";
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    return NextResponse.json({ 
      reply: 'Merhaba! Web sitenizin sunucu ve domain kurulumunda size yardımcı olabilirim. Lütfen sormak istediğiniz IT konusunu iletin.' 
    });
  }
}
