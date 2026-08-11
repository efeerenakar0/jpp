import { describe, expect, it } from 'vitest';

import {
  DEED_OPERATION_STAGES,
  DEED_PROCESS_CATEGORIES,
  DEED_PROCESS_GUIDES,
  DEED_QUICK_TYPES,
  deedProcessCategoryLabels,
  getDeedProcessGuide,
} from './process-catalog';

const supportedCaseTypes = new Set([
  'SALE',
  'PURCHASE',
  'MORTGAGE',
  'INHERITANCE',
  'CORRECTION',
  'OTHER',
]);

describe('deed process catalog', () => {
  it('keeps the universal workflow at six ordered, unique stages', () => {
    expect(DEED_OPERATION_STAGES).toHaveLength(6);
    expect(DEED_OPERATION_STAGES.map((stage) => stage.number)).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
    ]);
    expect(new Set(DEED_OPERATION_STAGES.map((stage) => stage.id)).size).toBe(6);

    for (const stage of DEED_OPERATION_STAGES) {
      expect(stage.title.trim().length).toBeGreaterThan(0);
      expect(stage.description.trim().length).toBeGreaterThan(20);
    }
  });

  it('provides a broad, internally consistent operation guide catalog', () => {
    expect(DEED_PROCESS_GUIDES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(DEED_PROCESS_GUIDES.map((guide) => guide.id)).size).toBe(
      DEED_PROCESS_GUIDES.length
    );

    for (const guide of DEED_PROCESS_GUIDES) {
      expect(DEED_PROCESS_CATEGORIES).toContain(guide.category);
      expect(supportedCaseTypes.has(guide.caseType)).toBe(true);
      expect(guide.title.trim().length).toBeGreaterThan(3);
      expect(guide.description.trim().length).toBeGreaterThan(30);
      expect(guide.steps.length).toBeGreaterThanOrEqual(4);
      expect(guide.documents.length).toBeGreaterThanOrEqual(3);
      expect(guide.risks.length).toBeGreaterThanOrEqual(3);
      expect(guide.officialAction.trim().length).toBeGreaterThan(25);
    }
  });

  it('exposes every category and every persisted case type through simple choices', () => {
    expect(Object.keys(deedProcessCategoryLabels).sort()).toEqual(
      [...DEED_PROCESS_CATEGORIES].sort()
    );
    expect(new Set(DEED_QUICK_TYPES.map((item) => item.type))).toEqual(
      supportedCaseTypes
    );
    expect(new Set(DEED_QUICK_TYPES.map((item) => item.id)).size).toBe(
      DEED_QUICK_TYPES.length
    );
  });

  it('looks guides up safely', () => {
    expect(getDeedProcessGuide('standard-sale')?.caseType).toBe('SALE');
    expect(getDeedProcessGuide('missing-guide')).toBeNull();
    expect(getDeedProcessGuide(null)).toBeNull();
  });
});
