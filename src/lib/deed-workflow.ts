import type {
  DeedCaseStatus,
  DeedCaseType,
  DeedChecklistItem,
} from '@/components/fabrika/deed-tracking/types';

export const DEED_APPLICATION_STATUSES = [
  'NOT_STARTED',
  'PREPARING',
  'SUBMITTED',
  'UNDER_REVIEW',
  'FEES_DUE',
  'APPOINTMENT_READY',
  'SIGNED',
  'REGISTERED',
  'RETURNED',
] as const;

export type DeedApplicationStatus =
  (typeof DEED_APPLICATION_STATUSES)[number];

export const DEED_PAYMENT_STATUSES = [
  'NOT_STARTED',
  'WAITING',
  'PAID',
  'NOT_APPLICABLE',
] as const;

export type DeedPaymentStatus = (typeof DEED_PAYMENT_STATUSES)[number];

export type DeedWorkflow = {
  identityVerified: boolean;
  authorityVerified: boolean;
  titleRecordVerified: boolean;
  encumbranceVerified: boolean;
  daskVerified: boolean;
  municipalValueVerified: boolean;
  paymentPlanVerified: boolean;
  applicationNumber: string;
  applicationStatus: DeedApplicationStatus;
  eCollectionNumber: string;
  deedFeeStatus: DeedPaymentStatus;
  revolvingFundStatus: DeedPaymentStatus;
  declaredValue: string;
  municipalValue: string;
  daskPolicyNumber: string;
  daskExpiresAt: string;
  paymentOwner: string;
  securePaymentReference: string;
  securePaymentStatus: DeedPaymentStatus;
  appointmentConfirmed: boolean;
  signaturesCompleted: boolean;
  registrationVerified: boolean;
  deedDocumentReceived: boolean;
  keyDelivered: boolean;
  clientInformed: boolean;
  originalsReturned: boolean;
};

export const EMPTY_DEED_WORKFLOW: DeedWorkflow = {
  identityVerified: false,
  authorityVerified: false,
  titleRecordVerified: false,
  encumbranceVerified: false,
  daskVerified: false,
  municipalValueVerified: false,
  paymentPlanVerified: false,
  applicationNumber: '',
  applicationStatus: 'NOT_STARTED',
  eCollectionNumber: '',
  deedFeeStatus: 'NOT_STARTED',
  revolvingFundStatus: 'NOT_STARTED',
  declaredValue: '',
  municipalValue: '',
  daskPolicyNumber: '',
  daskExpiresAt: '',
  paymentOwner: '',
  securePaymentReference: '',
  securePaymentStatus: 'NOT_STARTED',
  appointmentConfirmed: false,
  signaturesCompleted: false,
  registrationVerified: false,
  deedDocumentReceived: false,
  keyDelivered: false,
  clientInformed: false,
  originalsReturned: false,
};

export const deedApplicationStatusLabels: Record<
  DeedApplicationStatus,
  string
> = {
  NOT_STARTED: 'Başvuru başlamadı',
  PREPARING: 'Başvuru hazırlanıyor',
  SUBMITTED: 'Başvuru gönderildi',
  UNDER_REVIEW: 'Müdürlük inceliyor',
  FEES_DUE: 'Harç bildirildi',
  APPOINTMENT_READY: 'Randevu / imza bekleniyor',
  SIGNED: 'İmzalar tamamlandı',
  REGISTERED: 'Tescil tamamlandı',
  RETURNED: 'Düzeltme için iade edildi',
};

export const deedPaymentStatusLabels: Record<DeedPaymentStatus, string> = {
  NOT_STARTED: 'Başlamadı',
  WAITING: 'Ödeme bekleniyor',
  PAID: 'Ödendi',
  NOT_APPLICABLE: 'Uygulanmıyor',
};

export type DeedWorkflowCheckKey =
  | 'identityVerified'
  | 'authorityVerified'
  | 'titleRecordVerified'
  | 'encumbranceVerified'
  | 'daskVerified'
  | 'municipalValueVerified'
  | 'paymentPlanVerified';

export const deedWorkflowChecks: Array<{
  key: DeedWorkflowCheckKey;
  label: string;
  description: string;
}> = [
  {
    key: 'identityVerified',
    label: 'Kimlikler eşleşiyor',
    description: 'Tarafların kimliği ve iletişim bilgisi dosyayla karşılaştırıldı.',
  },
  {
    key: 'authorityVerified',
    label: 'Yetki kapsamı doğrulandı',
    description: 'Malik, temsilci ve varsa vekâlet kapsamı kontrol edildi.',
  },
  {
    key: 'titleRecordVerified',
    label: 'Güncel tapu kaydı kontrol edildi',
    description: 'Taşınmaz, pay, adres ve malik bilgileri resmî kaynaktan görüldü.',
  },
  {
    key: 'encumbranceVerified',
    label: 'Takyidat kontrol edildi',
    description: 'İpotek, haciz, şerh, intifa ve diğer kısıtlar değerlendirildi.',
  },
  {
    key: 'daskVerified',
    label: 'DASK doğrulandı',
    description: 'Poliçe numarası, taşınmaz ve geçerlilik tarihi kontrol edildi.',
  },
  {
    key: 'municipalValueVerified',
    label: 'Belediye değeri doğrulandı',
    description: 'Güncel emlak vergisi değeri dosyaya işlendi.',
  },
  {
    key: 'paymentPlanVerified',
    label: 'Bedel ve ödeme sahibi teyit edildi',
    description: 'Beyan değeri, ödeme planı ve hesabın sahibi taraflarla teyit edildi.',
  },
];

export function requiredDeedWorkflowChecks(
  type: DeedCaseType
): DeedWorkflowCheckKey[] {
  const common: DeedWorkflowCheckKey[] = [
    'identityVerified',
    'authorityVerified',
    'titleRecordVerified',
    'encumbranceVerified',
  ];

  if (type === 'SALE' || type === 'PURCHASE') {
    return [
      ...common,
      'daskVerified',
      'municipalValueVerified',
      'paymentPlanVerified',
    ];
  }
  if (type === 'MORTGAGE') return [...common, 'daskVerified'];
  if (type === 'INHERITANCE') {
    return ['identityVerified', 'authorityVerified', 'titleRecordVerified'];
  }
  return common;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeDeedWorkflow(value: unknown): DeedWorkflow {
  if (!isRecord(value)) return { ...EMPTY_DEED_WORKFLOW };
  const normalized = { ...EMPTY_DEED_WORKFLOW } as Record<string, unknown>;

  for (const key of Object.keys(EMPTY_DEED_WORKFLOW)) {
    const fallback = EMPTY_DEED_WORKFLOW[key as keyof DeedWorkflow];
    const candidate = value[key];
    if (typeof fallback === 'boolean' && typeof candidate === 'boolean') {
      normalized[key] = candidate;
    } else if (typeof fallback === 'string' && typeof candidate === 'string') {
      normalized[key] = candidate;
    }
  }

  if (!DEED_APPLICATION_STATUSES.includes(normalized.applicationStatus as DeedApplicationStatus)) {
    normalized.applicationStatus = 'NOT_STARTED';
  }
  for (const key of [
    'deedFeeStatus',
    'revolvingFundStatus',
    'securePaymentStatus',
  ] as const) {
    if (!DEED_PAYMENT_STATUSES.includes(normalized[key] as DeedPaymentStatus)) {
      normalized[key] = 'NOT_STARTED';
    }
  }

  return normalized as DeedWorkflow;
}

export function deedOperationalSummary(
  type: DeedCaseType,
  workflowValue: unknown
) {
  const workflow = normalizeDeedWorkflow(workflowValue);
  const required = requiredDeedWorkflowChecks(type);
  const completed = required.filter((key) => workflow[key]).length;
  return {
    completed,
    total: required.length,
    missing: required.filter((key) => !workflow[key]),
  };
}

export function deedClosingSummary(
  workflowValue: unknown,
  type?: DeedCaseType
) {
  const workflow = normalizeDeedWorkflow(workflowValue);
  const keys: Array<
    | 'appointmentConfirmed'
    | 'signaturesCompleted'
    | 'registrationVerified'
    | 'deedDocumentReceived'
    | 'keyDelivered'
    | 'clientInformed'
    | 'originalsReturned'
  > = [
    'appointmentConfirmed',
    'signaturesCompleted',
    'registrationVerified',
    'deedDocumentReceived',
    'clientInformed',
    'originalsReturned',
  ];
  if (type === 'SALE' || type === 'PURCHASE') keys.push('keyDelivered');
  return {
    completed: keys.filter((key) => workflow[key]).length,
    total: keys.length,
    missing: keys.filter((key) => !workflow[key]),
  };
}

export function nextDeedAction(input: {
  type: DeedCaseType;
  status: DeedCaseStatus;
  checklist: DeedChecklistItem[];
  workflow: unknown;
  appointmentAt: string | null;
}) {
  const workflow = normalizeDeedWorkflow(input.workflow);
  const operational = deedOperationalSummary(input.type, workflow);
  const missingDocuments = input.checklist.filter(
    (item) => item.required && !item.completed
  );

  if (input.status === 'COMPLETED') {
    return { title: 'Dosya tamamlandı', detail: 'İşlem geçmişi ve kapanış kayıtları arşivlenebilir.', tone: 'success' as const };
  }
  if (input.status === 'CANCELLED') {
    return { title: 'Dosya iptal edildi', detail: 'İptal nedeni ve teslim edilen asıl evrakların iadesini kontrol edin.', tone: 'muted' as const };
  }
  if (operational.missing.length) {
    const definition = deedWorkflowChecks.find(
      (item) => item.key === operational.missing[0]
    );
    return {
      title: definition?.label || 'Temel kontrolleri tamamlayın',
      detail: definition?.description || 'Dosyanın temel doğrulamalarını tamamlayın.',
      tone: 'warning' as const,
    };
  }
  if (missingDocuments.length) {
    return {
      title: `${missingDocuments.length} zorunlu evrakı tamamlayın`,
      detail: `İlk beklenen: ${missingDocuments[0].label}`,
      tone: 'danger' as const,
    };
  }
  if (!workflow.applicationNumber) {
    return {
      title: 'Web Tapu başvuru numarasını kaydedin',
      detail: 'Başvuru taraf veya yetkili temsilci tarafından yapıldıktan sonra resmî numarayı dosyaya ekleyin.',
      tone: 'info' as const,
    };
  }
  if (workflow.deedFeeStatus === 'WAITING' || workflow.revolvingFundStatus === 'WAITING') {
    return {
      title: 'Harç ve döner sermaye ödemesini takip edin',
      detail: 'E-tahsilat numarası ve ödeme teyidini taraflarla doğrulayın.',
      tone: 'warning' as const,
    };
  }
  if (!input.appointmentAt || !workflow.appointmentConfirmed) {
    return {
      title: 'Randevuyu teyit edin',
      detail: 'SMS ile bildirilen tarih ve saati taraflarla kesinleştirin.',
      tone: 'info' as const,
    };
  }
  if (!workflow.signaturesCompleted) {
    return {
      title: 'İmza aşamasını tamamlayın',
      detail: 'Kimlik asılları, ödeme ve hazır bulunacak tarafları son kez kontrol edin.',
      tone: 'warning' as const,
    };
  }
  if (!workflow.registrationVerified || !workflow.deedDocumentReceived) {
    return {
      title: 'Tescil sonucunu doğrulayın',
      detail: 'Yeni kayıt ve tapu belgesini resmî kaynaktan kontrol ederek dosyaya işleyin.',
      tone: 'info' as const,
    };
  }
  if (!workflow.clientInformed || !workflow.originalsReturned) {
    return {
      title: 'Müşteri bilgilendirme ve evrak iadesini kapatın',
      detail: 'Sonuç bilgisini paylaşın; teslim alınan asıl belgeleri tutanakla iade edin.',
      tone: 'info' as const,
    };
  }
  return {
    title: 'Dosya kapanışa hazır',
    detail: 'Son kontrolü yapıp süreci tamamlandı durumuna alın.',
    tone: 'success' as const,
  };
}
