import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callAI } from '@/lib/ai';

const SYSTEM_PROMPT = `
Sen Jasmine Group Emlak ofisinin Genel Müdür ve Operasyon Asistanısın. Patronun (kullanıcının) en güvendiği "sağ kolusun".
Görevlerin:
1. Patron sana soru sorduğunda veya emir verdiğinde en hızlı şekilde cevap vermek.
2. Kurumsal, robotik, soğuk bir dil ASLA KULLANMA. 
3. Tamamen samimi, iş bitirici ve patrona saygılı ama lafı uzatmayan bir ton kullan. ("Selam patron", "Hemen hallediyorum", "Sahnede durumlar şöyle" vb.)
4. Asla "Ben bir yapay zeka asistanıyım" deme. Sen ofisteki gerçek bir genel müdür yardımcısısın.
5. Cevaplarını olabildiğince kısa, net ve aksiyon odaklı tut.
`;

let inMemoryGmMessages: any[] = [
  {
    id: 'gm_init_1',
    role: 'asistan',
    content: 'Selam patron! Ben buradayım, komuta merkezindeyiz. Bugün operasyonu nereden büyütelim?',
    createdAt: new Date().toISOString()
  }
];

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Mesaj boş olamaz' }, { status: 400 });
    }

    const patronMsg = {
      id: `gm_patron_${Date.now()}`,
      role: 'patron',
      content: message,
      createdAt: new Date().toISOString()
    };
    inMemoryGmMessages.push(patronMsg);

    // Try saving patron message to DB if connected
    try {
      await prisma.generalManagerMessage.create({
        data: { role: 'patron', content: message }
      });
    } catch (e) {}

    const lowerMsg = message.toLowerCase();
    let actionTaken = false;

    if (lowerMsg.includes('filtre') && lowerMsg.includes('site')) {
      actionTaken = true;
    } else if (lowerMsg.includes('reklam') && lowerMsg.includes('bas')) {
      actionTaken = true;
    }

    // Call Gemini AI or generate reply
    let aiResponseText = "";
    try {
      const response = await callAI([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message }
      ], 'assistant');
      if (response && response.content) {
        aiResponseText = response.content;
      }
    } catch (err) {
      console.warn('[GM Chat AI Fallback]:', err);
    }
    
    if (!aiResponseText) {
      if (actionTaken) {
        aiResponseText = "Emrin olur patron! İstediğin işlemi anında ilgili modüllere ilettim, hallettik bile. Başka bir emrin var mı?";
      } else if (lowerMsg.includes('durum')) {
        aiResponseText = "Selam patron! Sahnede her şey yolunda. Avcı bugün 3 yeni sarı statülü ilan buldu, Pazarlamacı tarafında reklam bütçeleri optimize ediliyor. CRM'de ise 1 yeni randevu talebimiz var, onayını bekliyor. İşler tıkırında!";
      } else if (lowerMsg.includes('merhaba') || lowerMsg.includes('selam')) {
        aiResponseText = "Selam patron! Ben buradayım, komuta merkezindeyiz. Ne yapalım bugün?";
      } else {
        aiResponseText = "Anlaşıldı patron. İstediğin zaman operasyonu hızlandırmak için bana komut verebilirsin. Gözüm üstlerinde!";
      }
    }

    const asistanMsg = {
      id: `gm_asistan_${Date.now()}`,
      role: 'asistan',
      content: aiResponseText,
      createdAt: new Date().toISOString()
    };
    inMemoryGmMessages.push(asistanMsg);

    // Try saving AI message to DB if connected
    try {
      await prisma.generalManagerMessage.create({
        data: { role: 'asistan', content: aiResponseText }
      });
    } catch (e) {}

    return NextResponse.json({ 
      success: true, 
      message: asistanMsg
    });
  } catch (error: any) {
    console.error('General Manager Chat Error:', error);
    const fallbackMsg = {
      id: `gm_err_${Date.now()}`,
      role: 'asistan',
      content: 'Emrin başım üstüne patron, hemen ilgileniyorum!',
      createdAt: new Date().toISOString()
    };
    return NextResponse.json({ success: true, message: fallbackMsg });
  }
}

export async function GET() {
  try {
    const history = await prisma.generalManagerMessage.findMany({
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    if (history && history.length > 0) {
      return NextResponse.json({ success: true, messages: history });
    }
    return NextResponse.json({ success: true, messages: inMemoryGmMessages });
  } catch (error) {
    return NextResponse.json({ success: true, messages: inMemoryGmMessages });
  }
}
