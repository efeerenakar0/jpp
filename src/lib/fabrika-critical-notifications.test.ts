import { describe, expect, it } from 'vitest';

import { compactCriticalNotifications } from './fabrika-critical-notifications';

describe('compactCriticalNotifications', () => {
  it('keeps the newest actionable notification and groups duplicate events', () => {
    const result = compactCriticalNotifications([
      {
        id: 'older',
        type: 'APPOINTMENT_REQUEST',
        title: 'Randevu onayı bekliyor',
        message: 'Efe için randevu onayı gerekiyor.',
        createdAt: '2026-08-02T08:00:00.000Z',
        read: false,
        important: true,
        dedupeKey: 'appointment:efe',
        link: '/fabrika/takvim?taskId=1',
      },
      {
        id: 'newer',
        type: 'APPOINTMENT_REQUEST',
        title: 'Randevu onayı bekliyor',
        message: 'Efe için randevu onayı gerekiyor.',
        createdAt: '2026-08-02T09:00:00.000Z',
        read: false,
        important: true,
        dedupeKey: 'appointment:efe',
        link: '/fabrika/takvim?taskId=1',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'newer', groupedCount: 2 });
  });

  it('drops non-important and non-actionable activity noise', () => {
    const result = compactCriticalNotifications([
      {
        id: 'noise',
        type: 'AD_COPY_READY',
        title: 'Metin hazır',
        message: 'Kampanya metni oluşturuldu.',
        createdAt: '2026-08-02T09:00:00.000Z',
        read: false,
        important: false,
        link: '/fabrika/pazarlamaci',
      },
    ]);

    expect(result).toEqual([]);
  });
});
