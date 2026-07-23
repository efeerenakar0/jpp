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
5. Eğer patron senden bir şey yapmanı isterse (Örn: "Avcı'daki ilana filtre uygulayıp siteye at"), "Tamamdır patron, hallettim" gibi cevaplar ver (aksiyon tespiti arka planda JSON ile yapılacak, sen sadece doğal konuş).
6. Cevaplarını olabildiğince kısa, net ve aksiyon odaklı tut.
`;

export async function POST(request: Request) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Mesaj boş olamaz' }, { status: 400 });
    }

    // 1. Patronun mesajını kaydet
    await prisma.generalManagerMessage.create({
      data: { role: 'patron', content: message }
    });

    // 2. Basit Komut Algılama (Action Parsing)
    // Eğer mesaj belirli kelimeleri içeriyorsa, sistemde sahte (mock) bildirim oluşturarak "köprü" mekanizmasını simüle et.
    const lowerMsg = message.toLowerCase();
    let actionTaken = false;

    if (lowerMsg.includes('filtre') && lowerMsg.includes('site')) {
      // Örnek: "Avcı'daki ilana filtre uygulayıp siteye at"
      await prisma.notification.create({
        data: {
          type: 'STUDIO_READY',
          title: 'Asistan Otonom İşlemi',
          message: 'Genel Müdür Asistanı, seçili ilana Fotoğraf Stüdyosunda Ferah Filtre uyguladı ve Modül 1 üzerinden siteye aktardı.',
          link: '/fabrika/studyo'
        }
      });
      actionTaken = true;
    } else if (lowerMsg.includes('reklam') && lowerMsg.includes('bas')) {
      // Örnek: "Tüm ilanlara reklam bas"
      await prisma.notification.create({
        data: {
          type: 'AD_COPY_READY',
          title: 'Asistan Otonom İşlemi',
          message: 'Genel Müdür Asistanı, yeni portföylere Pazarlamacı modülü üzerinden Google Ads kampanyası başlattı.',
          link: '/fabrika/pazarlamaci'
        }
      });
      actionTaken = true;
    }

    // 3. Geçmiş sohbetleri getir
    const history = await prisma.generalManagerMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const formattedHistory = history.reverse().map(msg => ({
      role: (msg.role === 'patron' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content
    }));

    // 4. OpenAI veya Mock Response
    let aiResponseText = "";
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-real-api-key-here') {
      try {
        const response = await callAI([
          { role: 'system', content: SYSTEM_PROMPT },
          ...formattedHistory,
        ]);
        aiResponseText = response.content;
      } catch (err) {
        console.error('OpenAI çağrısı başarısız, mock metoda düşülüyor.');
      }
    } 
    
    // Fallback / Mock Modu
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

    // 5. AI cevabını kaydet
    const asistanMsg = await prisma.generalManagerMessage.create({
      data: { role: 'asistan', content: aiResponseText }
    });

    return NextResponse.json({ 
      success: true, 
      message: asistanMsg
    });
  } catch (error) {
    console.error('General Manager Chat Error:', error);
    return NextResponse.json({ error: 'Sohbet işlenirken bir hata oluştu' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const history = await prisma.generalManagerMessage.findMany({
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return NextResponse.json({ success: true, messages: history });
  } catch (error) {
    return NextResponse.json({ error: 'Geçmiş yüklenemedi' }, { status: 500 });
  }
}
