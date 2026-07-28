import 'server-only';

import prisma from './prisma';

export type ManagerPrincipal = {
  accountId: string;
  companyName: string;
  accountSlug: string;
  type: 'OWNER' | 'EMPLOYEE';
  memberId: string | null;
  displayName: string;
};

export type ManagerPriority = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  href: string;
};

function recipientKey(principal: ManagerPrincipal) {
  return principal.type === 'OWNER'
    ? 'OWNER'
    : `MEMBER:${principal.memberId || 'UNKNOWN'}`;
}

export async function getGeneralManagerContext(principal: ManagerPrincipal) {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const isJasmineAccount = principal.accountSlug === 'jasmine-group';
  const accountId = principal.accountId;

  const [
    activeProjects,
    huntedListings,
    authorizedListings,
    pendingAppointments,
    activeConversations,
    unreadNotifications,
    crmContacts,
    activeCrmProperties,
    openDeals,
    overdueTasks,
    upcomingTasks,
    contacts,
    properties,
    deals,
    tasks,
    matches,
    activities,
    campaigns,
    websiteAnalyses,
    importantNotifications,
    calendarConnection,
  ] = await Promise.all([
    isJasmineAccount
      ? prisma.project.count({ where: { published: true } })
      : Promise.resolve(0),
    prisma.huntedListing.count({ where: { companyAccountId: accountId } }),
    prisma.huntedListing.count({
      where: { companyAccountId: accountId, status: 'AUTHORIZED' },
    }),
    isJasmineAccount
      ? prisma.appointmentRequest.count({ where: { status: 'PENDING' } })
      : Promise.resolve(0),
    isJasmineAccount
      ? prisma.customerConversation.count({ where: { isActive: true } })
      : Promise.resolve(0),
    prisma.notification.count({
      where: {
        companyAccountId: accountId,
        recipientKey: recipientKey(principal),
        read: false,
      },
    }),
    prisma.crmContact.count({ where: { companyAccountId: accountId } }),
    prisma.crmProperty.count({
      where: { companyAccountId: accountId, status: 'ACTIVE' },
    }),
    prisma.crmDeal.count({
      where: {
        companyAccountId: accountId,
        stage: { notIn: ['WON', 'LOST'] },
      },
    }),
    prisma.crmTask.count({
      where: {
        companyAccountId: accountId,
        status: 'OPEN',
        dueAt: { lt: now },
      },
    }),
    prisma.crmTask.count({
      where: {
        companyAccountId: accountId,
        status: 'OPEN',
        dueAt: { gte: now, lte: nextWeek },
      },
    }),
    prisma.crmContact.findMany({
      where: { companyAccountId: accountId },
      select: {
        id: true,
        name: true,
        phone: true,
        type: true,
        stage: true,
        desiredLocation: true,
        desiredRoomCount: true,
        budgetMin: true,
        budgetMax: true,
        score: true,
        source: true,
        nextActionAt: true,
        notes: true,
        updatedAt: true,
        assignedMember: { select: { name: true } },
      },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
      take: 25,
    }),
    prisma.crmProperty.findMany({
      where: { companyAccountId: accountId },
      select: {
        id: true,
        title: true,
        referenceCode: true,
        location: true,
        price: true,
        roomCount: true,
        area: true,
        status: true,
        listingViews: true,
        inquiryCount: true,
        showingCount: true,
        offerCount: true,
        assignedMember: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 25,
    }),
    prisma.crmDeal.findMany({
      where: { companyAccountId: accountId },
      select: {
        id: true,
        title: true,
        stage: true,
        estimatedValue: true,
        probability: true,
        nextAction: true,
        expectedCloseAt: true,
        contact: { select: { name: true, phone: true } },
        property: { select: { title: true, referenceCode: true } },
        assignedMember: { select: { name: true } },
      },
      orderBy: [{ probability: 'desc' }, { updatedAt: 'desc' }],
      take: 20,
    }),
    prisma.crmTask.findMany({
      where: { companyAccountId: accountId, status: 'OPEN' },
      select: {
        id: true,
        title: true,
        type: true,
        priority: true,
        dueAt: true,
        calendarSource: true,
        contact: { select: { name: true } },
        property: { select: { title: true } },
        deal: { select: { title: true } },
        assignedMember: { select: { name: true } },
      },
      orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }],
      take: 25,
    }),
    prisma.crmMatch.findMany({
      where: { companyAccountId: accountId },
      select: {
        id: true,
        score: true,
        reasons: true,
        status: true,
        contact: { select: { name: true, phone: true } },
        property: { select: { title: true, referenceCode: true } },
      },
      orderBy: { score: 'desc' },
      take: 20,
    }),
    prisma.crmActivity.findMany({
      where: { companyAccountId: accountId },
      select: {
        type: true,
        title: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.adCampaign.findMany({
      where: { companyAccountId: accountId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        isActive: true,
        generatedBy: true,
        createdAt: true,
        property: { select: { title: true, referenceCode: true } },
        adCopies: { select: { platform: true, approved: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    }),
    prisma.marketingWebsiteAnalysis.findMany({
      where: { companyAccountId: accountId },
      select: {
        domain: true,
        summary: true,
        generatedBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.notification.findMany({
      where: {
        companyAccountId: accountId,
        recipientKey: recipientKey(principal),
        important: true,
        read: false,
      },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.googleCalendarConnection.findUnique({
      where: { companyAccountId: accountId },
      select: {
        email: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
      },
    }),
  ]);

  const priorities: ManagerPriority[] = [];
  tasks
    .filter((task) => task.dueAt && task.dueAt < now)
    .slice(0, 4)
    .forEach((task) =>
      priorities.push({
        id: `task:${task.id}`,
        severity: task.priority >= 3 ? 'critical' : 'warning',
        title: `Geciken görev · ${task.title}`,
        detail: task.assignedMember?.name
          ? `${task.assignedMember.name} sorumlu`
          : 'Sorumlu atanmamış',
        href: '/fabrika/takvim',
      })
    );
  tasks
    .filter((task) => task.dueAt && task.dueAt >= now && task.dueAt <= nextWeek)
    .slice(0, 3)
    .forEach((task) =>
      priorities.push({
        id: `upcoming:${task.id}`,
        severity: 'info',
        title: `Yaklaşan ${task.type === 'VIEWING' ? 'gösterim' : 'görev'} · ${task.title}`,
        detail: task.dueAt!.toLocaleString('tr-TR', {
          timeZone: 'Europe/Istanbul',
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        href: '/fabrika/takvim',
      })
    );
  contacts
    .filter((contact) => contact.score >= 80 && !['WON', 'LOST'].includes(contact.stage))
    .slice(0, 3)
    .forEach((contact) =>
      priorities.push({
        id: `contact:${contact.id}`,
        severity: 'warning',
        title: `Sıcak müşteri · ${contact.name}`,
        detail: `${contact.score}/100 puan · ${contact.assignedMember?.name || 'Sorumlu atanmamış'}`,
        href: '/fabrika/crm',
      })
    );
  if (authorizedListings > 0) {
    priorities.push({
      id: 'authorized-listings',
      severity: 'critical',
      title: `${authorizedListings} portföy satış yetkisi onay bekliyor`,
      detail: 'Avcı kayıtlarını kontrol edip portföye aktarın.',
      href: '/fabrika/avci',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    company: {
      name: principal.companyName,
      principalName: principal.displayName,
      principalType: principal.type,
    },
    metrics: {
      activeProjects,
      huntedListings,
      authorizedListings,
      pendingAppointments,
      activeConversations,
      unreadNotifications,
      crmContacts,
      activeCrmProperties,
      openDeals,
      overdueTasks,
      upcomingTasks,
      campaigns: campaigns.length,
      approvedCampaignCopies: campaigns.reduce(
        (total, campaign) =>
          total + campaign.adCopies.filter((copy) => copy.approved).length,
        0
      ),
    },
    priorities: priorities.slice(0, 10),
    crm: { contacts },
    portfolio: { properties },
    sales: { deals, matches },
    calendar: {
      tasks,
      google: calendarConnection
        ? {
            connected: true,
            email: calendarConnection.email,
            lastSyncedAt: calendarConnection.lastSyncedAt,
            status: calendarConnection.lastSyncStatus,
          }
        : { connected: false },
    },
    marketing: { campaigns, websiteAnalyses },
    activity: activities,
    notifications: importantNotifications,
    modules: [
      { name: 'Merkezi CRM', href: '/fabrika/crm', scope: 'Müşteriler ve notlar' },
      { name: 'Portföyler', href: '/fabrika/portfoyler', scope: 'Aktif portföy ve performans' },
      { name: 'Satış', href: '/fabrika/satis', scope: 'Fırsatlar ve kapanışlar' },
      { name: 'Takvim', href: '/fabrika/takvim', scope: 'Görev, randevu ve Google Takvim' },
      { name: 'Asistan', href: '/fabrika/asistan', scope: 'Müşteri görüşmeleri' },
      { name: 'Avcı', href: '/fabrika/avci', scope: 'Portföy yetkisi kazanımı' },
      { name: 'Pazarlamacı', href: '/fabrika/pazarlamaci', scope: 'Kampanya ve web reklam planı' },
      { name: 'Stüdyo', href: '/fabrika/studyo', scope: 'Görsel iyileştirme' },
    ],
  };
}

export type GeneralManagerContext = Awaited<
  ReturnType<typeof getGeneralManagerContext>
>;

export function publicGeneralManagerContext(context: GeneralManagerContext) {
  return {
    generatedAt: context.generatedAt,
    company: context.company,
    metrics: context.metrics,
    priorities: context.priorities,
    modules: context.modules,
    calendar: {
      google: context.calendar.google,
    },
  };
}

export function generalManagerSuggestions(context: GeneralManagerContext) {
  const suggestions = [
    {
      label: 'Bugünün öncelikleri',
      prompt: 'Bugün ilk olarak hangi işlere odaklanmalıyım? Verilere göre sırala.',
    },
    {
      label: 'Sıcak müşteriler',
      prompt: 'En sıcak müşterileri, puanlarını ve takip önerilerini listele.',
    },
    {
      label: 'Satış fırsatları',
      prompt: 'Açık satış fırsatlarını kapanma olasılığına göre özetle.',
    },
    {
      label: 'Kampanya durumu',
      prompt: 'Pazarlamacı kampanyalarının ve onay bekleyen metinlerin durumunu anlat.',
    },
  ];
  if (context.metrics.overdueTasks > 0) {
    suggestions.unshift({
      label: 'Geciken görevler',
      prompt: 'Geciken görevleri sorumluları ve tarihleriyle birlikte listele.',
    });
  }
  return suggestions.slice(0, 5);
}

export function fallbackGeneralManagerAnswer(
  question: string,
  context: GeneralManagerContext
) {
  const normalized = question.toLocaleLowerCase('tr-TR');
  const metrics = context.metrics;
  if (/gecik|görev|takvim|randevu|bugün/.test(normalized)) {
    const priorityLines = context.priorities
      .slice(0, 6)
      .map((priority, index) => `${index + 1}. ${priority.title} — ${priority.detail}`);
    return priorityLines.length
      ? `Doğrulanmış operasyon öncelikleri:\n${priorityLines.join('\n')}\n\nDetaylar için Takvim ve CRM ekranlarını açabilirsin.`
      : 'Şu anda doğrulanmış geciken veya yaklaşan kritik görev görünmüyor.';
  }
  if (/müşteri|crm|sıcak/.test(normalized)) {
    const contacts = context.crm.contacts.slice(0, 6);
    return contacts.length
      ? `CRM’de ${metrics.crmContacts} müşteri var. En yüksek puanlı kayıtlar:\n${contacts
          .map((contact) => `• ${contact.name}: ${contact.score}/100 · ${contact.stage}`)
          .join('\n')}`
      : 'CRM’de doğrulanmış müşteri kaydı bulunmuyor.';
  }
  if (/portföy|ilan|avcı/.test(normalized)) {
    return `Şirkette ${metrics.activeCrmProperties} aktif portföy ve Avcı’da ${metrics.huntedListings} kayıt var. Satış yetkisi onayı bekleyen kayıt sayısı ${metrics.authorizedListings}.`;
  }
  if (/satış|fırsat|teklif|kapan/.test(normalized)) {
    return `Şu anda ${metrics.openDeals} açık satış fırsatı var. En güçlü fırsatlar:\n${context.sales.deals
      .slice(0, 5)
      .map((deal) => `• ${deal.title}: %${deal.probability} · ${deal.stage}`)
      .join('\n') || 'Henüz ayrıntılı fırsat kaydı yok.'}`;
  }
  if (/kampanya|pazarlama|reklam/.test(normalized)) {
    return `${metrics.campaigns} kampanya ve ${metrics.approvedCampaignCopies} onaylı kanal metni var. Ayrıntılar için Pazarlamacı ekranını açabilirsin.`;
  }
  return `Anlık özet: ${metrics.crmContacts} CRM müşterisi, ${metrics.activeCrmProperties} aktif portföy, ${metrics.openDeals} açık fırsat, ${metrics.overdueTasks} geciken görev ve ${metrics.upcomingTasks} yaklaşan görev bulunuyor. AI sağlayıcısı yanıt veremediği için yalnızca doğrulanmış operasyon özetini paylaşıyorum.`;
}
