import { describe, expect, it } from 'vitest';

import {
  EMPTY_DEED_WORKFLOW,
  deedClosingSummary,
  deedOperationalSummary,
  nextDeedAction,
  normalizeDeedWorkflow,
} from './deed-workflow';

describe('deed operational workflow', () => {
  it('normalizes legacy cases without workflow data', () => {
    expect(normalizeDeedWorkflow(null)).toEqual(EMPTY_DEED_WORKFLOW);
    expect(
      normalizeDeedWorkflow({ identityVerified: true, applicationStatus: 'INVALID' })
    ).toMatchObject({ identityVerified: true, applicationStatus: 'NOT_STARTED' });
  });

  it('requires sale controls and the key handover before closing', () => {
    expect(deedOperationalSummary('SALE', EMPTY_DEED_WORKFLOW).total).toBe(7);
    expect(deedClosingSummary(EMPTY_DEED_WORKFLOW, 'SALE').total).toBe(7);
    expect(deedClosingSummary(EMPTY_DEED_WORKFLOW, 'MORTGAGE').total).toBe(6);
  });

  it('selects one concrete next action instead of exposing the whole workflow', () => {
    const action = nextDeedAction({
      type: 'SALE',
      status: 'PREPARING',
      checklist: [
        { key: 'identity', label: 'Kimlik', required: true, completed: false },
      ],
      workflow: EMPTY_DEED_WORKFLOW,
      appointmentAt: null,
    });

    expect(action.title).toBe('Kimlikler eşleşiyor');
    expect(action.tone).toBe('warning');
  });
});
