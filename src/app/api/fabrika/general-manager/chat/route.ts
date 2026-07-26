import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI } from '@/lib/ai';
import { requireFabrikaAccount } from '@/lib/fabrika-session';
import { syncLegacyModulesToWorkspace } from '@/lib/fabrika-workspace-sync';

async function getOperationalContext(companyAccountId: string, isJasmineAccount: boolean) {
  const [
    activeProjects,
    huntedListings,
    pendingAppointments,
    activeConversations,
    unreadNotifications,
    crmContacts,
    activeCrmProperties,
    openDeals,
    overdueTasks,
    contacts,
    properties,
    deals,
    tasks,
    matches,
    activities,
    campaigns,
  ] = await Promise.all([
    isJasmineAccount ? prisma.project.count({ where: { published: true } }) : Promise.resolve(0),
    isJasmineAccount ? prisma.huntedListing.count() : Promise.resolve(0),
    isJasmineAccount
      ? prisma.appointmentRequest.count({ where: { status: 'PENDING' } })
      : Promise.resolve(0),
    isJasmineAccount
      ? prisma.customerConversation.count({ where: { isActive: true } })
      : Promise.resolve(0),
    isJasmineAccount ? prisma.notification.count({ where: { read: false } }) : Promise.resolve(0),
    prisma.crmContact.count({ where: { companyAccountId } }),
    prisma.crmProperty.count({
      where: { companyAccountId, status: 'ACTIVE' },
    }),
    prisma.crmDeal.count({
      where: {
        companyAccountId,
        stage: { notIn: ['WON', 'LOST'] },
      },
    }),
    prisma.crmTask.count({
      where: {
        companyAccountId,
        status: 'OPEN',
        dueAt: { lt: new Date() },
      },
    }),
    prisma.crmContact.findMany({
      where: { companyAccountId },
      select: {
        name: true,
        type: true,
        stage: true,
        desiredLocation: true,
        desiredRoomCount: true,
        budgetMin: true,
        budgetMax: true,
        score: true,
        source: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    prisma.crmProperty.findMany({
      where: { companyAccountId },
      select: {
        title: true,
        location: true,
        price: true,
        roomCount: true,
        area: true,
        status: true,
        listingViews: true,
        inquiryCount: true,
        showingCount: true,
        offerCount: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    prisma.crmDeal.findMany({
      where: { companyAccountId },
      include: {
        contact: { select: { name: true } },
        property: { select: { title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 30,
    }),
    prisma.crmTask.findMany({
      where: { companyAccountId, status: 'OPEN' },
      include: {
        contact: { select: { name: true } },
        property: { select: { title: true } },
        deal: { select: { title: true } },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: 30,
    }),
    prisma.crmMatch.findMany({
      where: { companyAccountId },
      include: {
        contact: { select: { name: true } },
        property: { select: { title: true } },
      },
      orderBy: { score: 'desc' },
      take: 20,
    }),
    prisma.crmActivity.findMany({
      where: { companyAccountId },
      select: { type: true, title: true, description: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    }),
    isJasmineAccount
      ? prisma.adCampaign.findMany({
          select: { name: true, type: true, isActive: true, _count: { select: { adCopies: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        })
      : Promise.resolve([]),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      activeProjects,
      huntedListings,
      pendingAppointments,
      activeConversations,
      unreadNotifications,
      crmContacts,
      activeCrmProperties,
      openDeals,
      overdueTasks,
    },
    crm: { contacts, properties, deals, tasks, matches, activities },
    marketing: { campaigns },
    integrations: {
      assistant: isJasmineAccount ? 'Asistan sohbetleri CRM profillerine eşitlenir.' : 'Şirket kapsamlı CRM akışı aktif.',
      hunter: isJasmineAccount ? 'Avcı ilanları portföy ve satıcı profillerine eşitlenir.' : 'Şirket kapsamlı portföy akışı aktif.',
      studio: 'Stüdyo çıktıları seçilen portföyün operasyon geçmişine kaydedilir.',
      website: isJasmineAccount ? 'Yayınlanan Avcı ilanları müşteri sitesine aktarılabilir.' : 'Web sitesi entegrasyonu şirket ayarlarından yapılandırılır.',
    },
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

    const account = await requireFabrikaAccount();
    await syncLegacyModulesToWorkspace(account);
    const context = await getOperationalContext(account.id, account.slug === 'jasmine-group');
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
Sen ${account.companyName} Fabrika Komuta Merkezi'nin Genel Müdür Yardımcısısın.
Müşteri Asistanı ile aynı canlı AI altyapısını kullanıyorsun. Fabrikadaki tüm modüllerin yöneticisi ve açıklayıcısısın.

Bu anlık, doğrulanmış operasyon verisini kullan:
${JSON.stringify(context)}

Kurallar:
- Samimi, kısa ve aksiyon odaklı Türkçe cevap ver.
- CRM, portföy, satış, eşleştirme, takvim, Asistan, Avcı, Pazarlamacı, Stüdyo, Yazılımcı ve müşteri sitesi hakkında soru cevapla.
- Sistemle ilgili sayılar, müşteri isimleri, durumlar ve olaylarda yalnızca yukarıdaki doğrulanmış veriyi kullan; veride bulunmayan sayı, olay veya başarı uydurma.
- Genel bilgi veya nasıl yapılır sorularında normal yardımcı cevap ver; bunun canlı sistem verisi olmadığını açıkça ayır.
- Bir kayıt bulamazsan kesin olmadığını söyle ve ilgili modülü öner.
- Herhangi bir işlemi gerçekten yapmadıysan yapılmış gibi söyleme.
- Kullanıcı bir eylem isterse bunun henüz sadece talep olduğunu ve hangi onayın gerektiğini açıkça belirt.
- Gizli anahtarları, tokenları veya şifreleri asla isteme ya da gösterme.
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
    const account = await requireFabrikaAccount();
    await syncLegacyModulesToWorkspace(account);
    const [messages, context] = await Promise.all([
      prisma.generalManagerMessage.findMany({
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
      getOperationalContext(account.id, account.slug === 'jasmine-group'),
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
