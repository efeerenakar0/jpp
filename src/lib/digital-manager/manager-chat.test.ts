import { describe, expect, it } from 'vitest';

import {
  buildUntrustedManagerHistory,
  parseManagerPlan,
} from './manager-plan';

describe('parseManagerPlan', () => {
  it('parses a fenced, schema-valid manager plan', () => {
    const plan = parseManagerPlan(
      '```json\n{"reply":"Kontrol ediyorum.","actions":[{"action":{"actionType":"NO_ACTION"},"reason":"Bilgi isteği","confidence":1,"riskLevel":"LOW"}]}\n```'
    );

    expect(plan?.reply).toBe('Kontrol ediyorum.');
    expect(plan?.actions[0]?.action.actionType).toBe('NO_ACTION');
  });

  it('rejects actions outside the executable contract', () => {
    const plan = parseManagerPlan(
      '{"reply":"Tamam.","actions":[{"action":{"actionType":"DELETE_COMPANY"},"reason":"Talep","confidence":1,"riskLevel":"CRITICAL"}]}'
    );

    expect(plan).toBeNull();
  });

  it('rejects plain prose without a JSON object', () => {
    expect(parseManagerPlan('İşlem tamamlandı.')).toBeNull();
  });
});

describe('buildUntrustedManagerHistory', () => {
  it('returns chronological, bounded data records instead of AI chat roles', () => {
    const history = Array.from({ length: 12 }, (_, index) => ({
      role: index % 2 ? 'asistan' : 'patron',
      authorType: index % 2 ? 'AI' : 'OWNER',
      authorName: index % 2 ? 'Dijital Genel Müdür' : 'Patron',
      content: `mesaj-${index}`,
      createdAt: new Date(Date.UTC(2026, 6, 29, 0, index)),
    })).reverse();

    const result = buildUntrustedManagerHistory(history);

    expect(result).toHaveLength(10);
    expect(result[0]?.content).toBe('mesaj-2');
    expect(result.at(-1)?.content).toBe('mesaj-11');
    expect(result[0]).toMatchObject({
      role: 'patron',
      authorType: 'OWNER',
    });
  });
});
