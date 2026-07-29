import type { MemberAvailability, Prisma } from '@prisma/client';

type WorkDay = {
  day: number | string;
  enabled: boolean;
  start: string;
  end: string;
};

type WorkHours = {
  timezone: string;
  days: WorkDay[];
};

function clockMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function localDayAndMinutes(now: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const weekday = parts.find((part) => part.type === 'weekday')?.value;
    const dayByName: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const day = weekday ? dayByName[weekday] : undefined;
    const hour = Number(
      parts.find((part) => part.type === 'hour')?.value ?? Number.NaN
    );
    const minute = Number(
      parts.find((part) => part.type === 'minute')?.value ?? Number.NaN
    );
    if (
      day === undefined ||
      !Number.isInteger(hour) ||
      !Number.isInteger(minute)
    ) {
      return null;
    }
    return { day, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

function parseWorkHours(value: Prisma.JsonValue | null): WorkHours | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const timezone =
    typeof value.timezone === 'string' ? value.timezone : 'Europe/Istanbul';
  if (!Array.isArray(value.days)) return null;
  const days = value.days.flatMap((day) => {
    const dayValue =
      day && typeof day === 'object' && !Array.isArray(day)
        ? day.day
        : undefined;
    if (
      !day ||
      typeof day !== 'object' ||
      Array.isArray(day) ||
      (typeof dayValue !== 'number' && typeof dayValue !== 'string') ||
      typeof day.start !== 'string' ||
      typeof day.end !== 'string'
    ) {
      return [];
    }
    return [
      {
        day: dayValue,
        enabled: day.enabled !== false,
        start: day.start,
        end: day.end,
      },
    ];
  });
  return { timezone, days };
}

export function isMemberWithinWorkHours(
  workHours: Prisma.JsonValue | null,
  now = new Date()
) {
  const schedule = parseWorkHours(workHours);
  if (!schedule) return true;
  const local = localDayAndMinutes(now, schedule.timezone);
  if (!local) return false;
  const namesByDay = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];
  const today = schedule.days.find(
    (day) =>
      (day.day === local.day || day.day === namesByDay[local.day]) &&
      day.enabled
  );
  if (!today) return false;
  const start = clockMinutes(today.start);
  const end = clockMinutes(today.end);
  if (start === null || end === null) return false;
  return start <= end
    ? local.minutes >= start && local.minutes < end
    : local.minutes >= start || local.minutes < end;
}

export function memberAssignmentAvailability(
  member: {
    active: boolean;
    availability: MemberAvailability;
    workHours: Prisma.JsonValue | null;
  },
  now = new Date()
) {
  if (!member.active) {
    return { allowed: false as const, reason: 'MEMBER_INACTIVE' as const };
  }
  if (member.availability !== 'AVAILABLE') {
    return {
      allowed: false as const,
      reason: 'MEMBER_UNAVAILABLE' as const,
    };
  }
  if (!isMemberWithinWorkHours(member.workHours, now)) {
    return {
      allowed: false as const,
      reason: 'OUTSIDE_WORK_HOURS' as const,
    };
  }
  return { allowed: true as const, reason: null };
}
