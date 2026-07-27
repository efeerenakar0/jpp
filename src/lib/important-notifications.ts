import { NotificationType } from '@prisma/client';

const criticalSystemTitles = new Set([
  'WhatsApp Asistan Hatası',
  'Randevu Hatırlatması Gönderilemedi',
  'Randevu Bildirimi Gönderilemedi',
  'Stüdyo İşleme Hatası',
  'Kritik Entegrasyon Hatası',
  'Geciken Yüksek Öncelikli Görev',
]);

/**
 * Önemli sekmesi yalnızca bir kişinin kararını veya hızlı müdahalesini
 * gerektiren olayları gösterir. Rutin üretim ve durum logları burada yer almaz.
 */
export function isImportantNotification(input: {
  type: NotificationType;
  title: string;
  important?: boolean;
}): boolean {
  if (typeof input.important === 'boolean') {
    return input.important;
  }

  if (
    input.type === NotificationType.APPOINTMENT_REQUEST ||
    input.type === NotificationType.GREEN_LISTING
  ) {
    return true;
  }

  if (
    input.type === NotificationType.NEW_CUSTOMER_MESSAGE &&
    input.title.toLocaleLowerCase('tr-TR').includes('sıcak müşteri')
  ) {
    return true;
  }

  return (
    input.type === NotificationType.SYSTEM &&
    criticalSystemTitles.has(input.title)
  );
}
