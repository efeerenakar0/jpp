import { describe, expect, it } from 'vitest';

import {
  canTransitionTask,
  createOperationIdempotencyKey,
  dueCommitmentDecision,
  summarizeVerifiedFacts,
} from './workflow';

describe('digital manager workflow guarantees', () => {
  it('does not complete a task from vague “ilgilendim” wording', () => {
    expect(canTransitionTask('IN_PROGRESS', 'COMPLETED', 'İlgilendim')).toEqual({
      allowed: false,
      clarificationQuestion:
        'Görüşmenin somut sonucu ne oldu? Randevu oluştu mu, müşteri dönüş mü yapacak?',
    });
  });

  it('allows completion when a concrete verified outcome is present', () => {
    expect(
      canTransitionTask(
        'IN_PROGRESS',
        'COMPLETED',
        'Müşteriyle görüştüm, satış yetki sözleşmesi imzalandı.'
      ).allowed
    ).toBe(true);
  });

  it('rejects backwards or skipped workflow transitions', () => {
    expect(
      canTransitionTask(
        'IN_PROGRESS',
        'DELIVERED',
        'Mesaj teslim edildi.'
      ).allowed
    ).toBe(false);
    expect(
      canTransitionTask('CREATED', 'COMPLETED', 'Satış tamamlandı.').allowed
    ).toBe(false);
  });

  it('creates one stable idempotency key for the same authorization event', () => {
    const first = createOperationIdempotencyKey({
      companyAccountId: 'company-1',
      eventType: 'AUTHORIZATION_INTEREST',
      sourceMessageId: 'provider-1',
      entityId: 'listing-1',
    });
    const second = createOperationIdempotencyKey({
      companyAccountId: 'company-1',
      eventType: 'AUTHORIZATION_INTEREST',
      sourceMessageId: 'provider-1',
      entityId: 'listing-1',
    });
    expect(first).toBe(second);
  });

  it('emits only one reminder decision for the same overdue commitment', () => {
    expect(
      dueCommitmentDecision({
        dueAt: '2026-07-28T10:00:00.000Z',
        now: '2026-07-28T12:00:00.000Z',
        reminderCount: 0,
        lastReminderAt: null,
        status: 'OPEN',
      })
    ).toBe('REMIND_EMPLOYEE');
    expect(
      dueCommitmentDecision({
        dueAt: '2026-07-28T10:00:00.000Z',
        now: '2026-07-28T12:00:00.000Z',
        reminderCount: 1,
        lastReminderAt: '2026-07-28T11:00:00.000Z',
        status: 'OPEN',
      })
    ).toBe('NO_ACTION');
  });

  it('builds a manager summary only from provided verified facts', () => {
    const summary = summarizeVerifiedFacts({
      newCustomers: 12,
      hotCustomers: 4,
      newProperties: 1,
      authorizationInterests: 2,
      confirmedViewings: 3,
      openTasks: 5,
      completedTasks: 4,
      overdueCommitments: 1,
      deliveryFailures: 0,
      pendingApprovals: 2,
      evidenceIds: ['event-1', 'event-2'],
    });
    expect(summary.text).toContain('12 yeni müşteri');
    expect(summary.text).toContain('3 gösterim');
    expect(summary.text).not.toContain('Mehmet');
    expect(summary.evidenceIds).toEqual(['event-1', 'event-2']);
  });
});
