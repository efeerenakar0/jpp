import type { PoolRequestStatus, PoolShareStatus } from './types';

export const shareStatusLabels: Record<PoolShareStatus, string> = {
  ACTIVE: 'Havuzda yayında',
  PAUSED: 'Duraklatıldı',
  EXPIRED: 'Yetki süresi doldu',
  REVOKED: 'Paylaşım kaldırıldı',
};

export const requestStatusLabels: Record<PoolRequestStatus, string> = {
  PENDING: 'Yanıt bekliyor',
  APPROVED: 'İletişim talebi onaylandı',
  REJECTED: 'Talep reddedildi',
  CANCELLED: 'Talep iptal edildi',
};

export function formatPoolPrice(value: number | null) {
  if (value === null) return 'Fiyat belirtilmedi';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPoolDate(value: string | null) {
  if (!value) return 'Tarih belirtilmedi';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih belirtilmedi';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
