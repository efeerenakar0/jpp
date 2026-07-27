import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { callAI, PROMPTS } from '@/lib/ai';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';

const schema = z.object({
  message: z.string().trim().min(1).max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Geçersiz test mesajı.' }, { status: 400 });
    }
    const message =
      parsed.data.message ||
      'Merhaba, güncel portföyleriniz hakkında bilgi alabilir miyim?';
    const [config, properties] = await Promise.all([
      prisma.whatsAppConfig.findUnique({
        where: { companyAccountId: principal.account.id },
      }),
      prisma.crmProperty.findMany({
        where: {
          companyAccountId: principal.account.id,
          status: 'ACTIVE',
        },
        select: {
          title: true,
          price: true,
          location: true,
          roomCount: true,
          area: true,
        },
        take: 20,
      }),
    ]);
    const systemPrompt = PROMPTS.customerAssistant({
      companyName: config?.companyName || principal.account.companyName,
      availableListings: JSON.stringify(properties),
      conversationHistory: `Müşteri: ${message}`,
      customerMessage: message,
      assistantName: config?.assistantName || 'Efe',
      serviceCity: config?.serviceCity || 'Alanya',
    });
    const aiResponse = await callAI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      'whatsapp-simulation'
    );
    return NextResponse.json({
      success: true,
      sentToWhatsApp: false,
      reply: aiResponse.content,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Simülasyon hatası.' },
      { status: 500 }
    );
  }
}
