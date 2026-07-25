import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI } from '@/lib/ai';

async function getOperationalContext() {
  const [
    activeProjects,
    huntedListings,
    pendingAppointments,
    activeConversations,
    unreadNotifications,
  ] = await Promise.all([
    prisma.project.count({ where: { published: true } }),
    prisma.huntedListing.count(),
    prisma.appointmentRequest.count({ where: { status: 'PENDING' } }),
    prisma.customerConversation.count({ where: { isActive: true } }),
    prisma.notification.count({ where: { read: false } }),
  ]);

  return {
    activeProjects,
    huntedListings,
    pendingAppointments,
    activeConversations,
    unreadNotifications,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: string };
    const message = body.message?.trim();

    if (!message) {
      return NextResponse.json(
        { error: 'Mesaj boş olamaz.' },
        { status: 400 }
      );
    }

    const context = await getOperationalContext();
    const recentMessages = await prisma.generalManagerMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const history = recentMessages
      .reverse()
      .map((item) => ({
        role: item.role === 'patron' ? ('user' as const) : ('assistant' as const),
        content: item.content,
      }));

    const systemPrompt = `
Sen Jasmine Group Komuta Merkezi operasyon asistanısın.
Yalnızca aşağıdaki doğrulanmış sistem verilerini kullan:
${JSON.stringify(context)}

Kurallar:
- Samimi, kısa ve aksiyon odaklı Türkçe cevap ver.
- Veride bulunmayan sayı, olay veya başarı uydurma.
- Herhangi bir işlemi gerçekten yapmadıysan yapılmış gibi söyleme.
- Kullanıcı bir eylem isterse bunun henüz sadece talep olduğunu ve hangi onayın gerektiğini açıkça belirt.
`;

    const aiResponse = await callAI([
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ]);

    const [patronMessage, assistantMessage] = await prisma.$transaction([
      prisma.generalManagerMessage.create({
        data: { role: 'patron', content: message },
      }),
      prisma.generalManagerMessage.create({
        data: { role: 'asistan', content: aiResponse.content },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      requestMessageId: patronMessage.id,
      context,
    });
  } catch (error) {
    console.error('[General Manager POST Error]:', error);
    return NextResponse.json(
      { error: 'Komuta Merkezi şu anda doğrulanmış bir yanıt üretemedi.' },
      { status: 502 }
    );
  }
}

export async function GET() {
  try {
    const [messages, context] = await Promise.all([
      prisma.generalManagerMessage.findMany({
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      getOperationalContext(),
    ]);

    return NextResponse.json({ success: true, messages, context });
  } catch (error) {
    console.error('[General Manager GET Error]:', error);
    return NextResponse.json(
      { error: 'Komuta Merkezi geçmişi alınamadı.' },
      { status: 503 }
    );
  }
}
