import { describe, expect, it } from 'vitest';

import {
  buildDeedChecklist,
  canTransitionDeedCase,
  reconcileDeedChecklist,
  summarizeDeedChecklist,
} from './deed-tracking';

describe('deed tracking rules', () => {
  it('creates transaction-specific checklists without claiming an official integration', () => {
    const sale = buildDeedChecklist('SALE');
    const mortgage = buildDeedChecklist('MORTGAGE');

    expect(sale.map((item) => item.key)).toContain('title_deed_copy');
    expect(sale.map((item) => item.key)).toContain('dask');
    expect(mortgage.map((item) => item.key)).toContain('bank_approval');
    expect(sale.every((item) => item.completed === false)).toBe(true);
  });

  it('does not allow completing a case while required documents are missing', () => {
    const checklist = buildDeedChecklist('SALE');
    expect(
      canTransitionDeedCase({
        from: 'APPOINTMENT_SCHEDULED',
        to: 'COMPLETED',
        checklist,
      })
    ).toEqual({ allowed: false, reason: 'REQUIRED_DOCUMENTS_MISSING' });

    const completed = checklist.map((item) => ({ ...item, completed: true }));
    expect(
      canTransitionDeedCase({
        from: 'APPOINTMENT_SCHEDULED',
        to: 'COMPLETED',
        checklist: completed,
      })
    ).toEqual({ allowed: true, reason: null });
  });

  it('summarizes missing required documents deterministically', () => {
    const checklist = buildDeedChecklist('SALE').map((item, index) => ({
      ...item,
      completed: index === 0,
    }));
    const summary = summarizeDeedChecklist(checklist);

    expect(summary.completed).toBe(1);
    expect(summary.total).toBe(checklist.length);
    expect(summary.missingRequired).toBeGreaterThan(0);
  });

  it('keeps required document rules canonical when a client tampers with checklist metadata', () => {
    const submitted = buildDeedChecklist('SALE').map((item) => ({
      ...item,
      required: false,
      label: 'Değiştirilmiş alan',
      completed: true,
    }));

    const reconciled = reconcileDeedChecklist('SALE', submitted);

    expect(reconciled).not.toBeNull();
    expect(reconciled?.find((item) => item.key === 'identity')).toMatchObject({
      label: 'Tarafların kimlik belgeleri',
      required: true,
      completed: true,
    });
  });

  it('rejects missing, duplicate or unknown checklist keys', () => {
    const checklist = buildDeedChecklist('SALE');
    expect(reconcileDeedChecklist('SALE', checklist.slice(1))).toBeNull();
    expect(reconcileDeedChecklist('SALE', [...checklist, checklist[0]])).toBeNull();
    expect(
      reconcileDeedChecklist('SALE', [
        ...checklist.slice(1),
        { key: 'unknown', label: 'Bilinmeyen', required: false, completed: true },
      ])
    ).toBeNull();
  });
});
