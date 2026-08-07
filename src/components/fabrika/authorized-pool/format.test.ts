import { describe, expect, it } from 'vitest';

import { formatPoolDate, formatPoolPrice, requestStatusLabels, shareStatusLabels } from './format';

describe('authorized pool UI formatting', () => {
  it('uses clear Turkish labels for every pool state', () => {
    expect(shareStatusLabels.ACTIVE).toBe('Havuzda yayında');
    expect(shareStatusLabels.EXPIRED).toContain('süresi doldu');
    expect(requestStatusLabels.PENDING).toBe('Yanıt bekliyor');
    expect(requestStatusLabels.APPROVED).toContain('onaylandı');
  });

  it('formats safe public price and date fields without throwing', () => {
    expect(formatPoolPrice(5_850_000)).toContain('5.850.000');
    expect(formatPoolPrice(null)).toBe('Fiyat belirtilmedi');
    expect(formatPoolDate('not-a-date')).toBe('Tarih belirtilmedi');
  });
});
