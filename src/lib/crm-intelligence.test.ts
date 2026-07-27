import { describe, expect, it } from 'vitest';
import { calculateRuleBasedCrmScore, type CrmScoreInput } from './crm-intelligence';

function input(overrides: Partial<CrmScoreInput> = {}): CrmScoreInput {
  return {
    type: 'BUYER',
    stage: 'NEW',
    source: null,
    desiredLocation: null,
    desiredRoomCount: null,
    budgetMin: null,
    budgetMax: null,
    notes: null,
    tags: [],
    nextActionAt: null,
    updatedAt: new Date(),
    deals: [],
    tasks: [],
    activities: [],
    ...overrides,
  };
}

describe('calculateRuleBasedCrmScore', () => {
  it('nitelikli, ayrıntılı ve aktif müşteriyi daha yüksek puanlar', () => {
    const result = calculateRuleBasedCrmScore(
      input({
        stage: 'QUALIFIED',
        desiredLocation: 'Kestel',
        desiredRoomCount: '2+1',
        budgetMin: 3_000_000,
        budgetMax: 5_000_000,
        nextActionAt: new Date(Date.now() + 86_400_000),
        deals: [{ stage: 'OFFER', probability: 80, estimatedValue: 4_500_000 }],
        activities: [{ type: 'CONTACT_NOTE', createdAt: new Date() }],
      })
    );

    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.reasons).toContain('Arama kriterleri ayrıntılı');
    expect(result.source).toBe('RULES');
  });

  it('kaybedilmiş ve etkileşimsiz müşteriyi düşük tutar', () => {
    const result = calculateRuleBasedCrmScore(input({ stage: 'LOST' }));

    expect(result.score).toBe(5);
    expect(result.reasons).toContain('Satış süreci kaybedildi olarak işaretli');
  });

  it('puanı 5-99 aralığında sınırlar', () => {
    const result = calculateRuleBasedCrmScore(
      input({
        stage: 'WON',
        desiredLocation: 'Alanya',
        desiredRoomCount: '4+1',
        budgetMin: 10_000_000,
        budgetMax: 30_000_000,
        nextActionAt: new Date(),
        deals: [{ stage: 'WON', probability: 100, estimatedValue: 20_000_000 }],
        tasks: [{ status: 'OPEN', priority: 3, dueAt: new Date() }],
        activities: [{ type: 'DEAL_CREATED', createdAt: new Date() }],
      })
    );

    expect(result.score).toBe(99);
  });
});
