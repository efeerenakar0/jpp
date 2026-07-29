import { describe, expect, it } from 'vitest';

import {
  isMemberWithinWorkHours,
  memberAssignmentAvailability,
} from './member-availability';

const mondayAt1000Istanbul = new Date('2026-07-27T07:00:00.000Z');

describe('digital manager member availability', () => {
  it('accepts available members during configured local work hours', () => {
    expect(
      memberAssignmentAvailability(
        {
          active: true,
          availability: 'AVAILABLE',
          workHours: {
            timezone: 'Europe/Istanbul',
            days: [
              {
                day: 'MONDAY',
                enabled: true,
                start: '09:00',
                end: '18:00',
              },
            ],
          },
        },
        mondayAt1000Istanbul
      )
    ).toEqual({ allowed: true, reason: null });
  });

  it('rejects busy members even during work hours', () => {
    expect(
      memberAssignmentAvailability(
        {
          active: true,
          availability: 'BUSY',
          workHours: null,
        },
        mondayAt1000Istanbul
      ).reason
    ).toBe('MEMBER_UNAVAILABLE');
  });

  it('rejects automatic assignment outside the configured schedule', () => {
    expect(
      isMemberWithinWorkHours(
        {
          timezone: 'Europe/Istanbul',
          days: [
            {
              day: 'MONDAY',
              enabled: true,
              start: '11:00',
              end: '18:00',
            },
          ],
        },
        mondayAt1000Istanbul
      )
    ).toBe(false);
  });

  it('supports work windows that cross midnight', () => {
    const mondayAt2330Istanbul = new Date('2026-07-27T20:30:00.000Z');
    expect(
      isMemberWithinWorkHours(
        {
          timezone: 'Europe/Istanbul',
          days: [
            {
              day: 'MONDAY',
              enabled: true,
              start: '22:00',
              end: '06:00',
            },
          ],
        },
        mondayAt2330Istanbul
      )
    ).toBe(true);
  });

  it('treats a missing schedule as unrestricted', () => {
    expect(isMemberWithinWorkHours(null, mondayAt1000Istanbul)).toBe(true);
  });
});
