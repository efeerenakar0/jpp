import { describe, expect, it } from 'vitest';
import {
  normalizeFabrikaSearchQuery,
  normalizeSearchPhone,
  safeSearchLimit,
} from './fabrika-search';

describe('Fabrika search helpers', () => {
  it('normalizes whitespace without accepting unbounded input', () => {
    expect(normalizeFabrikaSearchQuery('  Efe   Eren  ')).toBe('Efe Eren');
    expect(normalizeFabrikaSearchQuery('x'.repeat(200))).toHaveLength(120);
  });

  it('normalizes phone fragments for tenant-scoped lookup', () => {
    expect(normalizeSearchPhone('+90 (543) 572 07 69')).toBe('905435720769');
    expect(normalizeSearchPhone('12')).toBe('');
  });

  it('caps page size', () => {
    expect(safeSearchLimit('50')).toBe(10);
    expect(safeSearchLimit('0')).toBe(1);
    expect(safeSearchLimit('bad')).toBe(6);
  });
});
