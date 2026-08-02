export type CriticalNotificationInput = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  important?: boolean;
  dedupeKey?: string | null;
  link?: string | null;
};

export type CriticalNotification = CriticalNotificationInput & {
  groupedCount: number;
};

const actionableTypes = new Set([
  'APPOINTMENT_REQUEST',
  'NEW_CUSTOMER_MESSAGE',
  'GREEN_LISTING',
  'WEBSITE_GENERATED',
  'STUDIO_READY',
  'SYSTEM',
]);

function fallbackKey(notification: CriticalNotificationInput) {
  return [
    notification.type,
    notification.title.trim().toLocaleLowerCase('tr-TR'),
    notification.link || '',
  ].join(':');
}

export function compactCriticalNotifications(
  notifications: CriticalNotificationInput[],
  limit = 8
) {
  const grouped = new Map<string, CriticalNotification>();
  const ordered = [...notifications].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  for (const notification of ordered) {
    if (
      notification.important === false ||
      !actionableTypes.has(notification.type)
    ) continue;
    const key = notification.dedupeKey || fallbackKey(notification);
    const existing = grouped.get(key);
    if (existing) {
      existing.groupedCount += 1;
      continue;
    }
    grouped.set(key, { ...notification, groupedCount: 1 });
    if (grouped.size >= limit) break;
  }

  return [...grouped.values()];
}
