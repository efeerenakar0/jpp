import { NotificationType, Prisma } from '@prisma/client';

const importantNotificationTypes = [
  NotificationType.APPOINTMENT_REQUEST,
  NotificationType.NEW_CUSTOMER_MESSAGE,
  NotificationType.GREEN_LISTING,
];

const importantSystemTitles = [
  'WhatsApp Asistan Hatası',
  'Randevu Hatırlatması Gönderilemedi',
  'Randevu Bildirimi Gönderilemedi',
  'Stüdyo İşleme Hatası',
];

/** Events that require an operator decision or prompt intervention. */
export const importantNotificationWhere: Prisma.NotificationWhereInput = {
  OR: [
    { type: { in: importantNotificationTypes } },
    {
      type: NotificationType.SYSTEM,
      title: { in: importantSystemTitles },
    },
  ],
};
