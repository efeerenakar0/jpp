import { describe, expect, it } from 'vitest';

import { deedChecklistSummary, nextDeedStatuses, toIsoOrNull } from './format';

describe('deed tracking UI helpers', () => {
  it('summarizes required missing documents separately', () => {
    expect(
      deedChecklistSummary([
        { key: 'id', label: 'Kimlik', required: true, completed: false },
        { key: 'note', label: 'Not', required: false, completed: false },
        { key: 'deed', label: 'Tapu', required: true, completed: true },
      ])
    ).toEqual({ completed: 1, total: 3, missingRequired: 1 });
  });

  it('keeps terminal states closed and converts valid dates for the API', () => {
    expect(nextDeedStatuses.COMPLETED).toEqual([]);
    expect(nextDeedStatuses.CANCELLED).toEqual([]);
    expect(toIsoOrNull('')).toBeNull();
    expect(toIsoOrNull('2026-08-06T12:00')).toMatch(/^2026-08-06T/);
  });
});
