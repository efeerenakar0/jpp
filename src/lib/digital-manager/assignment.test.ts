import { describe, expect, it } from 'vitest';

import {
  chooseAssignmentCandidate,
  type AssignmentCandidate,
} from './assignment-policy';

const now = new Date('2026-07-27T07:00:00.000Z');

function candidate(
  overrides: Partial<AssignmentCandidate>
): AssignmentCandidate {
  return {
    id: 'member-1',
    name: 'Ayşe',
    role: 'AGENT',
    active: true,
    availability: 'AVAILABLE',
    workHours: null,
    specialtyRegions: [],
    specialties: [],
    maxActiveTaskCapacity: 10,
    activeTaskCount: 0,
    lastAssignedAt: null,
    phoneNormalized: '+905551112233',
    canReceiveWhatsAppTasks: true,
    allowAutomaticInternalMessages: true,
    ...overrides,
  };
}

describe('digital manager assignment selection', () => {
  it('prefers a region specialist with available capacity', () => {
    const selected = chooseAssignmentCandidate(
      [
        candidate({ id: 'general', activeTaskCount: 0 }),
        candidate({
          id: 'mahmutlar',
          specialtyRegions: ['Alanya / Mahmutlar'],
          activeTaskCount: 1,
        }),
      ],
      { region: 'Mahmutlar', now }
    );
    expect(selected?.id).toBe('mahmutlar');
  });

  it('never selects busy, viewer or full-capacity members', () => {
    const selected = chooseAssignmentCandidate(
      [
        candidate({ id: 'busy', availability: 'BUSY' }),
        candidate({ id: 'viewer', role: 'VIEWER' }),
        candidate({
          id: 'full',
          activeTaskCount: 10,
          maxActiveTaskCapacity: 10,
        }),
      ],
      { now }
    );
    expect(selected).toBeNull();
  });

  it('balances equally qualified members by active task load', () => {
    const selected = chooseAssignmentCandidate(
      [
        candidate({ id: 'loaded', activeTaskCount: 4 }),
        candidate({ id: 'free', activeTaskCount: 1 }),
      ],
      { now }
    );
    expect(selected?.id).toBe('free');
  });

  it('uses a saved WhatsApp number without requiring an OTP status', () => {
    const selected = chooseAssignmentCandidate(
      [
        candidate({
          id: 'saved-number',
          canReceiveWhatsAppTasks: true,
        }),
        candidate({
          id: 'no-number',
          phoneNormalized: null,
          canReceiveWhatsAppTasks: true,
        }),
      ],
      { now }
    );

    expect(selected?.id).toBe('saved-number');
  });
});
