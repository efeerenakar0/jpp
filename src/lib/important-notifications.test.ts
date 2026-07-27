import { NotificationType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { isImportantNotification } from './important-notifications';

describe('isImportantNotification', () => {
  it('randevu ve yeni aktif portföyleri önemli sayar', () => {
    expect(
      isImportantNotification({
        type: NotificationType.APPOINTMENT_REQUEST,
        title: 'Yaklaşan Randevu',
      })
    ).toBe(true);
    expect(
      isImportantNotification({
        type: NotificationType.GREEN_LISTING,
        title: 'Yeni Aktif Portföy',
      })
    ).toBe(true);
  });

  it('yalnızca sıcak müşteri mesajlarını önemli sayar', () => {
    expect(
      isImportantNotification({
        type: NotificationType.NEW_CUSTOMER_MESSAGE,
        title: 'Sıcak Müşteri Takibi',
      })
    ).toBe(true);
    expect(
      isImportantNotification({
        type: NotificationType.NEW_CUSTOMER_MESSAGE,
        title: 'Yeni WhatsApp Mesajı',
      })
    ).toBe(false);
  });

  it('kritik entegrasyon ve gecikmiş görev hatalarını önemli sayar', () => {
    expect(
      isImportantNotification({
        type: NotificationType.SYSTEM,
        title: 'Kritik Entegrasyon Hatası',
      })
    ).toBe(true);
    expect(
      isImportantNotification({
        type: NotificationType.SYSTEM,
        title: 'Geciken Yüksek Öncelikli Görev',
      })
    ).toBe(true);
  });

  it('rutin üretim bildirimlerini Tümü kapsamına bırakır', () => {
    expect(
      isImportantNotification({
        type: NotificationType.AD_COPY_READY,
        title: 'Reklam Taslakları Hazır',
      })
    ).toBe(false);
    expect(
      isImportantNotification({
        type: NotificationType.WEBSITE_GENERATED,
        title: 'Web Sitesi Hazır',
      })
    ).toBe(false);
  });

  it('açık önem kararına öncelik verir', () => {
    expect(
      isImportantNotification({
        type: NotificationType.SYSTEM,
        title: 'Bilgilendirme',
        important: true,
      })
    ).toBe(true);
  });
});
