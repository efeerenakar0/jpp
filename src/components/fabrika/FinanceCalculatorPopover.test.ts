import { describe, expect, it } from 'vitest';

import { calculateBinary } from './FinanceCalculatorPopover';

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
