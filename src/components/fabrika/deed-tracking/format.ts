import type { DeedCase, DeedCaseStatus, DeedCaseType, DeedChecklistItem } from './types';

export const deedTypeLabels: Record<DeedCaseType, string> = {
  SALE: 'Satış',
  PURCHASE: 'Satın alma',
  MORTGAGE: 'İpotek / kredi',
  INHERITANCE: 'Miras / intikal',
  CORRECTION: 'Tapu düzeltme',
  OTHER: 'Diğer işlem',
};

export const deedStatusLabels: Record<DeedCaseStatus, string> = {
  DRAFT: 'Taslak',
  PREPARING: 'Belgeler hazırlanıyor',
  DOCUMENTS_MISSING: 'Eksik belge var',
  READY_FOR_APPOINTMENT: 'Randevuya hazır',
  APPOINTMENT_SCHEDULED: 'Randevu planlandı',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal edildi',
};

export const nextDeedStatuses: Record<DeedCaseStatus, DeedCaseStatus[]> = {
  DRAFT: ['PREPARING', 'CANCELLED'],
  PREPARING: ['DOCUMENTS_MISSING', 'READY_FOR_APPOINTMENT', 'CANCELLED'],
  DOCUMENTS_MISSING: ['PREPARING', 'READY_FOR_APPOINTMENT', 'CANCELLED'],
  READY_FOR_APPOINTMENT: ['APPOINTMENT_SCHEDULED', 'PREPARING', 'CANCELLED'],
  APPOINTMENT_SCHEDULED: ['COMPLETED', 'PREPARING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function deedChecklistSummary(checklist: DeedChecklistItem[]) {
  return {
    completed: checklist.filter((item) => item.completed).length,
    total: checklist.length,
    missingRequired: checklist.filter((item) => item.required && !item.completed).length,
  };
}

export function deedCaseDraft(deedCase: DeedCase) {
  return {
    checklist: deedCase.checklist.map((item) => ({ ...item })),
    status: deedCase.status,
    assignedMemberId: deedCase.assignedMember?.id || '',
    appointmentAt: toDateTimeLocal(deedCase.appointmentAt),
    dueAt: toDateTimeLocal(deedCase.dueAt),
    notes: deedCase.notes || '',
  };
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toIsoOrNull(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatDeedDate(value: string | null, includeTime = true) {
  if (!value) return 'Belirtilmedi';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Belirtilmedi';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}
