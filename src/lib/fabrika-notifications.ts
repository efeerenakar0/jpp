import { NotificationType, type Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { isImportantNotification } from '@/lib/important-notifications';

export type NotificationPrincipal = {
  accountId: string;
  type: 'OWNER' | 'EMPLOYEE';
  memberId?: string | null;
};

type CreateNotificationInput = {
  companyAccountId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  metadata?: unknown;
  important?: boolean;
  dedupeKey?: string | null;
};

function serializedMetadata(metadata: unknown): string | null {
  return metadata === undefined ? null : JSON.stringify(metadata);
}

export function notificationRecipientKey(
  principal: Pick<NotificationPrincipal, 'type' | 'memberId'>
): string {
  return principal.type === 'OWNER'
    ? 'OWNER'
    : `MEMBER:${principal.memberId || 'UNKNOWN'}`;
}

function notificationData(
  input: CreateNotificationInput,
  recipient: { key: string; memberId: string | null }
): Prisma.NotificationUncheckedCreateInput {
  return {
    companyAccountId: input.companyAccountId,
    recipientMemberId: recipient.memberId,
    recipientKey: recipient.key,
    type: input.type,
    title: input.title,
    message: input.message,
    link: input.link || null,
    important: isImportantNotification({
      type: input.type,
      title: input.title,
      important: input.important,
    }),
    dedupeKey: input.dedupeKey || null,
    metadata: serializedMetadata(input.metadata),
  };
}

export async function createNotificationForPrincipal(
  principal: NotificationPrincipal,
  input: Omit<CreateNotificationInput, 'companyAccountId'>
) {
  const recipient = {
    key: notificationRecipientKey(principal),
    memberId: principal.type === 'EMPLOYEE' ? principal.memberId || null : null,
  };
  const data = notificationData(
    { ...input, companyAccountId: principal.accountId },
    recipient
  );

  if (data.dedupeKey) {
    return prisma.notification.upsert({
      where: {
        companyAccountId_recipientKey_dedupeKey: {
          companyAccountId: principal.accountId,
          recipientKey: recipient.key,
          dedupeKey: data.dedupeKey,
        },
      },
      create: data,
      update: {},
    });
  }

  return prisma.notification.create({ data });
}

export async function createCompanyNotification(
  input: CreateNotificationInput
) {
  const members = await prisma.companyMember.findMany({
    where: {
      companyAccountId: input.companyAccountId,
      active: true,
    },
    select: { id: true },
  });
  const recipients = [
    { key: 'OWNER', memberId: null },
    ...members.map((member) => ({
      key: `MEMBER:${member.id}`,
      memberId: member.id,
    })),
  ];

  return prisma.notification.createMany({
    data: recipients.map((recipient) => notificationData(input, recipient)),
    skipDuplicates: true,
  });
}

export async function ensureOperationalNotifications(
  principal: NotificationPrincipal
) {
  const now = new Date();
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const recentPortfolioThreshold = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000
  );
  const accountFilter = { companyAccountId: principal.accountId };

  const [hotContacts, recentProperties, overdueTasks, upcomingAppointments] =
    await Promise.all([
      prisma.crmContact.findMany({
        where: {
          ...accountFilter,
          score: { gte: 80 },
          stage: { notIn: ['WON', 'LOST'] },
        },
        select: { id: true, name: true, score: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.crmProperty.findMany({
        where: {
          ...accountFilter,
          status: 'ACTIVE',
          createdAt: { gte: recentPortfolioThreshold },
        },
        select: { id: true, title: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.crmTask.findMany({
        where: {
          ...accountFilter,
          status: 'OPEN',
          priority: 3,
          dueAt: { lt: now },
        },
        select: { id: true, title: true, type: true, dueAt: true },
        orderBy: { dueAt: 'asc' },
        take: 10,
      }),
      prisma.crmTask.findMany({
        where: {
          ...accountFilter,
          status: 'OPEN',
          type: { in: ['MEETING', 'VIEWING'] },
          dueAt: { gte: now, lte: nextDay },
        },
        select: { id: true, title: true, type: true, dueAt: true },
        orderBy: { dueAt: 'asc' },
        take: 10,
      }),
    ]);

  const recipient = {
    key: notificationRecipientKey(principal),
    memberId: principal.type === 'EMPLOYEE' ? principal.memberId || null : null,
  };
  const operationalNotifications: Array<
    Omit<CreateNotificationInput, 'companyAccountId'>
  > = [
    ...hotContacts.map((contact) => ({
        type: NotificationType.NEW_CUSTOMER_MESSAGE,
        title: 'Sıcak Müşteri Takibi',
        message: `${contact.name}, ${contact.score}/100 puanla hızlı takip bekliyor.`,
        link: '/fabrika/crm',
        important: true,
        dedupeKey: `hot-contact:${contact.id}`,
        metadata: { contactId: contact.id },
      })),
    ...recentProperties.map((property) => ({
        type: NotificationType.GREEN_LISTING,
        title: 'Yeni Aktif Portföy',
        message: `${property.title} aktif portföylere katıldı.`,
        link: '/fabrika/portfoyler',
        important: true,
        dedupeKey: `active-property:${property.id}`,
        metadata: { propertyId: property.id },
      })),
    ...overdueTasks.map((task) => ({
        type: NotificationType.SYSTEM,
        title: 'Geciken Yüksek Öncelikli Görev',
        message: `${task.title} tamamlanmadı ve müdahale bekliyor.`,
        link: '/fabrika/takvim',
        important: true,
        dedupeKey: `overdue-priority-task:${task.id}`,
        metadata: { taskId: task.id, dueAt: task.dueAt },
      })),
    ...upcomingAppointments.map((task) => ({
        type: NotificationType.APPOINTMENT_REQUEST,
        title: task.type === 'VIEWING' ? 'Yaklaşan Portföy Gösterimi' : 'Yaklaşan Randevu',
        message: `${task.title} önümüzdeki 24 saat içinde gerçekleşecek.`,
        link: '/fabrika/takvim',
        important: true,
        dedupeKey: `upcoming-appointment:${task.id}`,
        metadata: { taskId: task.id, dueAt: task.dueAt },
      })),
  ];

  if (operationalNotifications.length > 0) {
    await prisma.notification.createMany({
      data: operationalNotifications.map((notification) =>
        notificationData(
          { ...notification, companyAccountId: principal.accountId },
          recipient
        )
      ),
      skipDuplicates: true,
    });
  }
}
