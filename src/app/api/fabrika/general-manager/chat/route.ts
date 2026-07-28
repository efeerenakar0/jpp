import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { callAI, sharedAssistantAIStatus } from '@/lib/ai';
import {
  fallbackGeneralManagerAnswer,
  generalManagerSuggestions,
  getGeneralManagerContext,
  publicGeneralManagerContext,
  type ManagerPrincipal,
} from '@/lib/general-manager-context';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { syncLegacyModulesToWorkspace } from '@/lib/fabrika-workspace-sync';

const messageSchema = z.object({
  message: z.string().trim().min(1, 'Mesaj boş olamaz.').max(2000, 'Mesaj en fazla 2.000 karakter olabilir.'),
});

function managerPrincipal(
  principal: Awaited<ReturnType<typeof requireFabrikaPrincipal>>
): ManagerPrincipal {
  return {
    accountId: principal.account.id,
    companyName: principal.account.companyName,
    accountSlug: principal.account.slug,
    type: principal.type,
    memberId: principal.member?.id || null,
    displayName: principal.displayName,
  };
}

function sessionError(error: unknown) {
  return error instanceof FabrikaSessionError
    ? NextResponse.json({ error: error.message }, { status: 401 })
    : null;
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = messageSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Mesaj geçersiz.' },
        { status: 400 }
      );
    }

    const manager = managerPrincipal(principal);
    await syncLegacyModulesToWorkspace(principal.account);
    const [context, recentMessages] = await Promise.all([
      getGeneralManagerContext(manager),
      prisma.generalManagerMessage.findMany({
        where: { companyAccountId: principal.account.id },
        orderBy: { createdAt: 'desc' },
        take: 14,
      }),
    ]);
    const history = recentMessages
      .reverse()
      .map((item) => ({
        role: item.role === 'patron' ? ('user' as const) : ('assistant' as const),
        content: item.content,
      }));
    const systemPrompt = `Sen ${principal.account.companyName} Fabrika Komuta Merkezi'nin Genel Müdür Yardımcısısın.
Müşteri Asistanı ile aynı canlı AI altyapısını kullanıyorsun. Görevin şirketin doğrulanmış operasyon verisini açıklamak, önceliklendirmek ve doğru modüle yönlendirmektir.

ANLIK DOĞRULANMIŞ ŞİRKET BAĞLAMI:
${JSON.stringify(context)}

KURALLAR:
- Türkçe, açık, kısa ve aksiyon odaklı yanıt ver. Gerekli olduğunda maddeler kullan.
- CRM, müşteri telefonları, notlar, portföyler, satış, görevler, randevular, Google Takvim, Asistan, Avcı, Pazarlamacı ve Stüdyo sorularını yukarıdaki veriden cevapla.
- Bir sayı, isim, tarih, durum veya olay söylerken yalnızca doğrulanmış bağlamı kullan. Eksik veriyi tahmin etme.
- Cevabın sonunda uygun olduğunda ilgili Fabrika sayfasını düz metin olarak belirt.
- Genel bilgi sorusunu cevaplayabilirsin ancak bunun şirketin canlı verisi olmadığını ayır.
- Kullanıcı bir kayıt değiştirme, mesaj gönderme, onaylama veya silme isterse işlemi yapılmış gibi gösterme. Bunun bir öneri olduğunu ve hangi sayfadan/onayla yapılacağını söyle.
- Gizli anahtar, şifre, token veya kimlik doğrulama kodu isteme ve gösterme.
- Kullanıcının şirketi dışındaki hiçbir veriye sahip olduğunu iddia etme.`;

    let answer: string;
    let provider = 'RULE_ENGINE';
    try {
      const aiResponse = await callAI([
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: parsed.data.message },
      ]);
      answer = aiResponse.content;
      provider = aiResponse.provider || 'GROQ';
    } catch (error) {
      console.warn(
        '[General Manager AI Fallback]:',
        error instanceof Error ? error.message : String(error)
      );
      answer = fallbackGeneralManagerAnswer(parsed.data.message, context);
    }

    const [requestMessage, assistantMessage] = await prisma.$transaction([
      prisma.generalManagerMessage.create({
        data: {
          companyAccountId: principal.account.id,
          authorId: principal.type === 'OWNER' ? principal.account.id : principal.member!.id,
          authorName: principal.displayName,
          authorType: principal.type,
          role: 'patron',
          content: parsed.data.message,
        },
      }),
      prisma.generalManagerMessage.create({
        data: {
          companyAccountId: principal.account.id,
          authorName: 'Genel Müdür Yardımcısı',
          authorType: 'AI',
          role: 'asistan',
          content: answer,
          provider,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: assistantMessage,
      requestMessageId: requestMessage.id,
      context: publicGeneralManagerContext(context),
      provider: {
        ...sharedAssistantAIStatus(),
        activeProvider: provider,
        sharedWithAssistant: true,
      },
    });
  } catch (error) {
    const response = sessionError(error);
    if (response) return response;
    console.error('[General Manager POST Error]:', error);
    return NextResponse.json(
      { error: 'Komuta Merkezi şu anda doğrulanmış bir yanıt üretemedi.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const manager = managerPrincipal(principal);
    await syncLegacyModulesToWorkspace(principal.account);
    const [messages, context] = await Promise.all([
      prisma.generalManagerMessage.findMany({
        where: { companyAccountId: principal.account.id },
        select: {
          id: true,
          role: true,
          content: true,
          authorName: true,
          authorType: true,
          provider: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 60,
      }),
      getGeneralManagerContext(manager),
    ]);

    return NextResponse.json({
      success: true,
      messages,
      context: publicGeneralManagerContext(context),
      suggestions: generalManagerSuggestions(context),
      provider: {
        ...sharedAssistantAIStatus(),
        activeProvider: sharedAssistantAIStatus().configured ? 'GROQ' : 'RULE_ENGINE',
        sharedWithAssistant: true,
      },
    });
  } catch (error) {
    const response = sessionError(error);
    if (response) return response;
    console.error('[General Manager GET Error]:', error);
    return NextResponse.json(
      { error: 'Komuta Merkezi geçmişi alınamadı.' },
      { status: 500 }
    );
  }
}
