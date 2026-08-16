import { getDeedProcessGuide } from '@/components/fabrika/deed-tracking/process-catalog';
import {
  deedClosingSummary,
  deedOperationalSummary,
  type DeedWorkflow,
} from '@/lib/deed-workflow';

export type DeedCaseType =
  | 'SALE'
  | 'PURCHASE'
  | 'MORTGAGE'
  | 'INHERITANCE'
  | 'CORRECTION'
  | 'OTHER';

export type DeedCaseStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'DOCUMENTS_MISSING'
  | 'READY_FOR_APPOINTMENT'
  | 'APPOINTMENT_SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED';

export type DeedChecklistItem = {
  key: string;
  label: string;
  required: boolean;
  completed: boolean;
};

const commonChecklist: Omit<DeedChecklistItem, 'completed'>[] = [
  { key: 'identity', label: 'Tarafların kimlik belgeleri', required: true },
  { key: 'title_deed_copy', label: 'Tapu senedi veya taşınmaz bilgileri', required: true },
  { key: 'municipal_value', label: 'Belediye rayiç değer belgesi', required: true },
  { key: 'dask', label: 'Geçerli DASK poliçesi', required: true },
  { key: 'power_of_attorney', label: 'Varsa vekâletname', required: false },
];

const typeSpecificChecklist: Record<
  DeedCaseType,
  Omit<DeedChecklistItem, 'completed'>[]
> = {
  SALE: [
    { key: 'seller_authority', label: 'Satış yetkisi ve malik onayı', required: true },
    { key: 'payment_plan', label: 'Ödeme ve kapora mutabakatı', required: false },
  ],
  PURCHASE: [
    { key: 'buyer_offer', label: 'Satın alma teklifi ve kabul kaydı', required: true },
    { key: 'payment_plan', label: 'Ödeme planı', required: true },
  ],
  MORTGAGE: [
    { key: 'bank_approval', label: 'Banka kredi/onay yazısı', required: true },
    { key: 'appraisal_report', label: 'Ekspertiz raporu', required: true },
  ],
  INHERITANCE: [
    { key: 'inheritance_certificate', label: 'Veraset ilamı', required: true },
    { key: 'tax_clearance', label: 'Veraset ve intikal vergi ilişik kesme belgesi', required: true },
  ],
  CORRECTION: [
    { key: 'correction_evidence', label: 'Düzeltme talebini destekleyen belgeler', required: true },
  ],
  OTHER: [
    { key: 'supporting_documents', label: 'İşleme ilişkin destekleyici belgeler', required: true },
  ],
};

function guideChecklist(
  type: DeedCaseType,
  guideId?: string | null
): Omit<DeedChecklistItem, 'completed'>[] | null {
  const guide = guideId ? getDeedProcessGuide(guideId) : null;
  if (!guide || guide.caseType !== type) return null;

  const baseline = [
    { key: 'identity', label: 'Tarafların kimlik belgeleri', required: true },
    { key: 'title_deed_copy', label: 'Güncel tapu kaydı ve taşınmaz bilgileri', required: true },
    { key: 'power_of_attorney', label: 'Varsa temsil veya vekâlet belgesi', required: false },
  ];
  return [
    ...baseline,
    ...guide.documents.map((label, index) => ({
      key: `guide_${guide.id}_${index + 1}`,
      label,
      required: true,
    })),
  ];
}

export function buildDeedChecklist(
  type: DeedCaseType,
  guideId?: string | null
): DeedChecklistItem[] {
  const specialized = guideChecklist(type, guideId);
  return (specialized || [...commonChecklist, ...typeSpecificChecklist[type]]).map((item) => ({
    ...item,
    completed: false,
  }));
}

export function reconcileDeedChecklist(
  type: DeedCaseType,
  submitted: DeedChecklistItem[],
  guideId?: string | null
): DeedChecklistItem[] | null {
  const canonical = buildDeedChecklist(type, guideId);
  const submittedByKey = new Map<string, DeedChecklistItem>();

  for (const item of submitted) {
    if (submittedByKey.has(item.key)) return null;
    submittedByKey.set(item.key, item);
  }
  if (
    submittedByKey.size !== canonical.length ||
    canonical.some((item) => !submittedByKey.has(item.key))
  ) {
    return null;
  }

  return canonical.map((item) => ({
    ...item,
    completed: submittedByKey.get(item.key)?.completed === true,
  }));
}

export function summarizeDeedChecklist(checklist: DeedChecklistItem[]) {
  return {
    completed: checklist.filter((item) => item.completed).length,
    total: checklist.length,
    missingRequired: checklist.filter((item) => item.required && !item.completed)
      .length,
  };
}

const allowedTransitions: Record<DeedCaseStatus, DeedCaseStatus[]> = {
  DRAFT: ['PREPARING', 'CANCELLED'],
  PREPARING: ['DOCUMENTS_MISSING', 'READY_FOR_APPOINTMENT', 'CANCELLED'],
  DOCUMENTS_MISSING: ['PREPARING', 'READY_FOR_APPOINTMENT', 'CANCELLED'],
  READY_FOR_APPOINTMENT: ['APPOINTMENT_SCHEDULED', 'PREPARING', 'CANCELLED'],
  APPOINTMENT_SCHEDULED: ['COMPLETED', 'PREPARING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionDeedCase(input: {
  from: DeedCaseStatus;
  to: DeedCaseStatus;
  checklist: DeedChecklistItem[];
  type?: DeedCaseType;
  workflow?: DeedWorkflow;
}): { allowed: boolean; reason: string | null } {
  if (!allowedTransitions[input.from].includes(input.to)) {
    return { allowed: false, reason: 'INVALID_STATUS_TRANSITION' };
  }
  if (
    ['READY_FOR_APPOINTMENT', 'APPOINTMENT_SCHEDULED', 'COMPLETED'].includes(
      input.to
    ) &&
    summarizeDeedChecklist(input.checklist).missingRequired > 0
  ) {
    return { allowed: false, reason: 'REQUIRED_DOCUMENTS_MISSING' };
  }
  if (
    input.type &&
    input.workflow &&
    ['READY_FOR_APPOINTMENT', 'APPOINTMENT_SCHEDULED', 'COMPLETED'].includes(
      input.to
    ) &&
    deedOperationalSummary(input.type, input.workflow).missing.length > 0
  ) {
    return { allowed: false, reason: 'REQUIRED_CONTROLS_MISSING' };
  }
  if (
    input.workflow &&
    input.to === 'COMPLETED' &&
    deedClosingSummary(input.workflow, input.type).missing.length > 0
  ) {
    return { allowed: false, reason: 'CLOSING_CHECKS_MISSING' };
  }
  return { allowed: true, reason: null };
}
