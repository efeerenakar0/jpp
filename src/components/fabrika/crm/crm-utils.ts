import type {
  CrmActivity,
  CrmContact,
  CrmDeal,
  CrmDealStage,
  CrmTask,
  FinanceEntry,
  FinanceEntryKind,
} from './crm-types';

export const contactTypeLabels: Record<CrmContact['type'], string> = {
  BUYER: 'Alıcı',
  SELLER: 'Satıcı',
  INVESTOR: 'Yatırımcı',
  TENANT: 'Kiracı',
  OTHER: 'Diğer',
};

export const contactStageLabels: Record<CrmContact['stage'], string> = {
  NEW: 'Yeni müşteri',
  CONTACTED: 'İlk temas',
  QUALIFIED: 'Nitelikli',
  VIEWING: 'Yer gösterimi',
  OFFER: 'Teklif',
  WON: 'Kazanıldı',
  LOST: 'Kaybedildi',
};

export const dealStageLabels: Record<CrmDealStage, string> = {
  NEW: 'Yeni',
  CONTACTED: 'İletişimde',
  QUALIFIED: 'Nitelikli',
  MATCHED: 'Eşleşti',
  VIEWING: 'Gösterim',
  OFFER: 'Teklif',
  CONTRACT: 'Sözleşme',
  WON: 'Kazanıldı',
  LOST: 'Kaybedildi',
};

export const dealStageOrder: CrmDealStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'MATCHED',
  'VIEWING',
  'OFFER',
  'CONTRACT',
  'WON',
  'LOST',
];

export const financeKindLabels: Record<FinanceEntryKind, string> = {
  DEBIT: 'Borç',
  PAYMENT: 'Tahsilat',
  DEPOSIT: 'Kapora',
  COMMISSION: 'Komisyon',
  EXPENSE: 'Masraf',
  REFUND: 'İade',
};

export function formatMoney(
  value: number | null | undefined,
  currency: FinanceEntry['currency'] = 'TRY'
) {
  if (value == null) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return 'Tarih yok';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' as const } : {}),
  }).format(new Date(value));
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
}

export function contactTemperature(score: number) {
  if (score >= 80) return { label: 'Çok sıcak', tone: 'hot' as const };
  if (score >= 60) return { label: 'Sıcak', tone: 'warm' as const };
  if (score >= 35) return { label: 'Ilık', tone: 'mild' as const };
  return { label: 'Soğuk', tone: 'cold' as const };
}

type FinanceMetadata = Omit<FinanceEntry, 'activityId' | 'contactName' | 'reversed' | 'createdAt'> & {
  version: 1;
};

type FinanceReversalMetadata = {
  version: 1;
  reversesActivityId: string;
  reason: string | null;
};

function parseMetadata<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function financeEntriesFromActivities(activities: CrmActivity[]): FinanceEntry[] {
  const reversedIds = new Set(
    activities
      .filter((activity) => activity.type === 'CRM_FINANCE_REVERSAL')
      .map((activity) => parseMetadata<FinanceReversalMetadata>(activity.metadata)?.reversesActivityId)
      .filter((value): value is string => Boolean(value))
  );

  return activities
    .filter((activity) => activity.type === 'CRM_FINANCE_ENTRY' && activity.contact)
    .flatMap((activity): FinanceEntry[] => {
      const metadata = parseMetadata<FinanceMetadata>(activity.metadata);
      if (!metadata || !activity.contact) return [];
      return [{
        ...metadata,
        activityId: activity.id,
        contactName: activity.contact.name,
        reversed: reversedIds.has(activity.id),
        createdAt: activity.createdAt,
      }];
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

export function calculateFinanceSummary(entries: FinanceEntry[]) {
  const active = entries.filter((entry) => !entry.reversed && entry.status !== 'CANCELLED');
  const receivable = active
    .filter((entry) => ['DEBIT', 'COMMISSION', 'EXPENSE'].includes(entry.kind))
    .reduce((sum, entry) => sum + entry.amount, 0);
  const collected = active
    .filter((entry) => ['PAYMENT', 'DEPOSIT'].includes(entry.kind) && entry.status === 'PAID')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const refunds = active
    .filter((entry) => entry.kind === 'REFUND')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const overdue = active
    .filter(
      (entry) =>
        entry.status === 'OVERDUE' ||
        (entry.status === 'PLANNED' && entry.dueAt && new Date(entry.dueAt).getTime() < Date.now())
    )
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    receivable,
    collected,
    refunds,
    balance: receivable - collected + refunds,
    overdue,
  };
}

export function tasksForContact(tasks: CrmTask[], contactId: string) {
  return tasks.filter((task) => task.contact?.id === contactId);
}

export function dealsForContact(deals: CrmDeal[], contactId: string) {
  return deals.filter((deal) => deal.contact.id === contactId);
}

export function isTaskOverdue(task: CrmTask, now = Date.now()) {
  return task.status === 'OPEN' && Boolean(task.dueAt) && new Date(task.dueAt!).getTime() < now;
}

export function nextDealStage(stage: CrmDealStage) {
  const index = dealStageOrder.indexOf(stage);
  if (index < 0 || index >= dealStageOrder.length - 3) return null;
  return dealStageOrder[index + 1];
}
