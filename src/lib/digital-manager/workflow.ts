import { createHash } from 'node:crypto';

import type { TaskWorkflowState } from './domain';

const concreteOutcomePattern =
  /(imzalandı|imzalandi|randevu (oluştu|olustu|kesinleşti|kesinlesti)|satış (tamamlandı|tamamlandi)|kiralama (tamamlandı|tamamlandi)|ödeme alındı|odeme alindi|müşteri reddetti|musteri reddetti|yetki alındı|yetki alindi)/i;

const allowedTaskTransitions: Record<
  TaskWorkflowState,
  TaskWorkflowState[]
> = {
  CREATED: [
    'ASSIGNED',
    'APPOINTMENT_PROPOSED',
    'APPOINTMENT_CONFIRMED',
    'CANCELLED',
    'FAILED',
  ],
  ASSIGNED: [
    'MESSAGE_QUEUED',
    'DELIVERED',
    'ACCEPTED',
    'REJECTED',
    'REASSIGNMENT_REQUIRED',
    'CANCELLED',
    'FAILED',
  ],
  MESSAGE_QUEUED: [
    'DELIVERED',
    'ACCEPTED',
    'REJECTED',
    'REASSIGNMENT_REQUIRED',
    'CANCELLED',
    'FAILED',
  ],
  DELIVERED: [
    'ACCEPTED',
    'IN_PROGRESS',
    'WAITING_CUSTOMER',
    'APPOINTMENT_PROPOSED',
    'APPOINTMENT_CONFIRMED',
    'REJECTED',
    'REASSIGNMENT_REQUIRED',
    'CANCELLED',
    'FAILED',
  ],
  ACCEPTED: [
    'IN_PROGRESS',
    'WAITING_CUSTOMER',
    'APPOINTMENT_PROPOSED',
    'APPOINTMENT_CONFIRMED',
    'COMPLETED',
    'REJECTED',
    'REASSIGNMENT_REQUIRED',
    'CANCELLED',
    'FAILED',
  ],
  IN_PROGRESS: [
    'WAITING_CUSTOMER',
    'APPOINTMENT_PROPOSED',
    'APPOINTMENT_CONFIRMED',
    'COMPLETED',
    'REASSIGNMENT_REQUIRED',
    'CANCELLED',
    'FAILED',
  ],
  WAITING_CUSTOMER: [
    'IN_PROGRESS',
    'APPOINTMENT_PROPOSED',
    'APPOINTMENT_CONFIRMED',
    'COMPLETED',
    'REASSIGNMENT_REQUIRED',
    'CANCELLED',
    'FAILED',
  ],
  APPOINTMENT_PROPOSED: [
    'APPOINTMENT_CONFIRMED',
    'IN_PROGRESS',
    'WAITING_CUSTOMER',
    'REASSIGNMENT_REQUIRED',
    'CANCELLED',
    'FAILED',
  ],
  APPOINTMENT_CONFIRMED: [
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'FAILED',
  ],
  COMPLETED: [],
  REJECTED: ['REASSIGNMENT_REQUIRED', 'CANCELLED'],
  REASSIGNMENT_REQUIRED: ['ASSIGNED', 'CANCELLED', 'FAILED'],
  CANCELLED: [],
  FAILED: [],
};

export function canTransitionTask(
  from: TaskWorkflowState,
  to: TaskWorkflowState,
  evidenceText: string
) {
  if (to === 'COMPLETED' && !concreteOutcomePattern.test(evidenceText)) {
    return {
      allowed: false,
      clarificationQuestion:
        'Görüşmenin somut sonucu ne oldu? Randevu oluştu mu, müşteri dönüş mü yapacak?',
    };
  }
  if (!allowedTaskTransitions[from].includes(to)) {
    return {
      allowed: false,
      clarificationQuestion:
        ['COMPLETED', 'CANCELLED', 'FAILED'].includes(from)
          ? 'Bu görev kapanmış görünüyor. Yeniden açılması gerekiyorsa patron onayı istenmeli.'
          : `Görev ${from} durumundan doğrudan ${to} durumuna geçirilemez; önce ara adım doğrulanmalı.`,
    };
  }
  return { allowed: true, clarificationQuestion: null };
}

export function createOperationIdempotencyKey(input: {
  companyAccountId: string;
  eventType: string;
  sourceMessageId?: string | null;
  entityId?: string | null;
}) {
  return createHash('sha256')
    .update(
      [
        input.companyAccountId,
        input.eventType,
        input.sourceMessageId || '-',
        input.entityId || '-',
      ].join(':')
    )
    .digest('hex');
}

export function dueCommitmentDecision(input: {
  dueAt: string;
  now: string;
  reminderCount: number;
  lastReminderAt: string | null;
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
}) {
  if (input.status === 'COMPLETED' || input.status === 'CANCELLED') {
    return 'NO_ACTION' as const;
  }
  if (new Date(input.dueAt) > new Date(input.now)) {
    return 'NO_ACTION' as const;
  }
  if (input.reminderCount === 0) return 'REMIND_EMPLOYEE' as const;
  const lastReminder = input.lastReminderAt
    ? new Date(input.lastReminderAt).getTime()
    : 0;
  const elapsed = new Date(input.now).getTime() - lastReminder;
  if (input.reminderCount === 1 && elapsed >= 4 * 60 * 60 * 1000) {
    return 'ESCALATE_OWNER' as const;
  }
  return 'NO_ACTION' as const;
}

export type VerifiedManagerFacts = {
  newCustomers: number;
  hotCustomers: number;
  newProperties: number;
  authorizationInterests: number;
  confirmedViewings: number;
  openTasks: number;
  completedTasks: number;
  overdueCommitments: number;
  deliveryFailures: number;
  pendingApprovals: number;
  employeeStatuses?: Array<{
    name: string;
    availability: string;
    openTasks: number;
  }>;
  nextActions?: string[];
  evidenceIds: string[];
};

export function summarizeVerifiedFacts(facts: VerifiedManagerFacts) {
  const availabilityLabels: Record<string, string> = {
    AVAILABLE: 'müsait',
    BUSY: 'meşgul',
    OFFLINE: 'çevrim dışı',
    ON_LEAVE: 'izinli',
  };
  const sentences = [
    `Bugün ${facts.newCustomers} yeni müşteri geldi; ${facts.hotCustomers} müşteri sıcak temas aşamasında.`,
    `${facts.newProperties} yeni portföy ve ${facts.authorizationInterests} yetki görüşmesi kaydedildi.`,
    `${facts.confirmedViewings} gösterim kesinleşti.`,
    `${facts.completedTasks} görev tamamlandı; ${facts.openTasks} görev açık.`,
  ];
  if (facts.overdueCommitments > 0) {
    sentences.push(
      `${facts.overdueCommitments} süresi geçen taahhüt müdahale bekliyor.`
    );
  }
  if (facts.deliveryFailures > 0) {
    sentences.push(
      `${facts.deliveryFailures} WhatsApp gönderimi başarısız oldu.`
    );
  }
  if (facts.pendingApprovals > 0) {
    sentences.push(
      `${facts.pendingApprovals} konu patron onayı bekliyor.`
    );
  }
  if ((facts.employeeStatuses?.length || 0) > 0) {
    sentences.push(
      `Ekip durumu: ${facts.employeeStatuses!
        .map(
          (employee) =>
            `${employee.name} ${
              availabilityLabels[employee.availability] ||
              employee.availability.toLocaleLowerCase('tr-TR')
            }, ${employee.openTasks} açık görev`
        )
        .join('; ')}.`
    );
  }
  if ((facts.nextActions?.length || 0) > 0) {
    sentences.push(
      `Önerilen sonraki adımlar: ${facts.nextActions!
        .map((action, index) => `${index + 1}) ${action}`)
        .join(' ')}`
    );
  }
  return {
    text: sentences.join(' '),
    evidenceIds: [...facts.evidenceIds],
  };
}
