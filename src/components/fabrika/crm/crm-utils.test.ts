import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CrmActivity } from './crm-types';
import {
  calculateFinanceSummary,
  financeEntriesFromActivities,
  nextDealStage,
} from './crm-utils';

function financeActivity(
  id: string,
  overrides: Partial<{
    kind: 'DEBIT' | 'PAYMENT' | 'DEPOSIT' | 'COMMISSION' | 'EXPENSE' | 'REFUND';
    status: 'PLANNED' | 'PAID' | 'OVERDUE';
    amount: number;
    dueAt: string | null;
  }> = {}
): CrmActivity {
  return {
    id,
    type: 'CRM_FINANCE_ENTRY',
    title: 'Cari hareket',
    description: null,
    metadata: JSON.stringify({
      version: 1,
      contactId: 'contact-a',
      dealId: null,
      propertyId: null,
      kind: overrides.kind || 'DEBIT',
      status: overrides.status || 'PLANNED',
      amount: overrides.amount ?? 100_000,
      currency: 'TRY',
      occurredAt: '2026-08-01T10:00:00.000Z',
      dueAt: overrides.dueAt ?? '2026-08-10T10:00:00.000Z',
      method: null,
      reference: null,
      description: null,
    }),
    contact: { id: 'contact-a', name: 'Ada Müşteri' },
    property: null,
    deal: null,
    actorMember: null,
    createdAt: '2026-08-01T10:00:00.000Z',
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('CRM finance ledger', () => {
  it('builds an auditable ledger and marks reversed movements without deleting them', () => {
    const original = financeActivity('entry-a');
    const reversal: CrmActivity = {
      ...original,
      id: 'reversal-a',
      type: 'CRM_FINANCE_REVERSAL',
      metadata: JSON.stringify({
        version: 1,
        reversesActivityId: 'entry-a',
        reason: 'Yanlış giriş',
      }),
    };

    const entries = financeEntriesFromActivities([reversal, original]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      activityId: 'entry-a',
      contactId: 'contact-a',
      contactName: 'Ada Müşteri',
      amount: 100_000,
      reversed: true,
    });
  });

  it('calculates receivable, collection, balance and overdue totals', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'));
    const entries = financeEntriesFromActivities([
      financeActivity('debit', { kind: 'DEBIT', amount: 200_000 }),
      financeActivity('commission', { kind: 'COMMISSION', amount: 30_000 }),
      financeActivity('payment', { kind: 'PAYMENT', status: 'PAID', amount: 80_000 }),
      financeActivity('refund', { kind: 'REFUND', status: 'PAID', amount: 5_000 }),
    ]);

    expect(calculateFinanceSummary(entries)).toEqual({
      receivable: 230_000,
      collected: 80_000,
      refunds: 5_000,
      balance: 155_000,
      overdue: 230_000,
    });
  });
});

describe('CRM pipeline progression', () => {
  it('advances open stages but never auto-advances contract, won or lost records', () => {
    expect(nextDealStage('NEW')).toBe('CONTACTED');
    expect(nextDealStage('OFFER')).toBe('CONTRACT');
    expect(nextDealStage('CONTRACT')).toBeNull();
    expect(nextDealStage('WON')).toBeNull();
    expect(nextDealStage('LOST')).toBeNull();
  });
});
