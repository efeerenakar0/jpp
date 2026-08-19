import { describe, expect, it } from 'vitest';

import {
  calculateBinary,
  formatExchangeRateFetchedAt,
} from './FinanceCalculatorPopover';

describe('finance calculator arithmetic', () => {
  it('calculates supported operations without evaluating text', () => {
    expect(calculateBinary(10, 5, '+')).toBe(15);
    expect(calculateBinary(10, 5, '-')).toBe(5);
    expect(calculateBinary(10, 5, '×')).toBe(50);
    expect(calculateBinary(10, 5, '÷')).toBe(2);
  });

  it('refuses division by zero', () => {
    expect(calculateBinary(10, 0, '÷')).toBeNull();
  });
});

describe('exchange rate fetched time', () => {
  it('formats the last successful fetch time in Istanbul time', () => {
    expect(formatExchangeRateFetchedAt('2026-08-19T09:05:00.000Z')).toBe(
      '19.08.2026 12:05'
    );
  });

  it('omits missing or invalid fetch times', () => {
    expect(formatExchangeRateFetchedAt(null)).toBeNull();
    expect(formatExchangeRateFetchedAt('not-a-date')).toBeNull();
  });
});
