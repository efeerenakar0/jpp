export const MEMBER_WORK_DAYS = [
  { value: 'MONDAY', label: 'Pazartesi' },
  { value: 'TUESDAY', label: 'Salı' },
  { value: 'WEDNESDAY', label: 'Çarşamba' },
  { value: 'THURSDAY', label: 'Perşembe' },
  { value: 'FRIDAY', label: 'Cuma' },
  { value: 'SATURDAY', label: 'Cumartesi' },
  { value: 'SUNDAY', label: 'Pazar' },
] as const;

export type MemberWorkDay = (typeof MEMBER_WORK_DAYS)[number]['value'];
export type MemberAvailabilityValue =
  | 'AVAILABLE'
  | 'BUSY'
  | 'ON_LEAVE'
  | 'OFFLINE';
export type MemberRoleValue = 'MANAGER' | 'AGENT' | 'VIEWER';

export type MemberWorkHoursValue = {
  timezone: string;
  days: Array<{
    day: MemberWorkDay;
    enabled: true;
    start: string;
    end: string;
  }>;
};

export type MemberOperationalPayload = {
  role: MemberRoleValue;
  canReceiveWhatsAppTasks: boolean;
  allowAutomaticInternalMessages: boolean;
  preferredLanguage: string;
  workHours: MemberWorkHoursValue | null;
  availability: MemberAvailabilityValue;
  specialtyRegions: string[];
  specialties: string[];
  maxActiveTaskCapacity: number;
};

type FormValue = FormDataEntryValue | null | undefined;
type MemberFormValues = Record<string, FormValue>;

function stringValue(value: FormValue): string {
  return typeof value === 'string' ? value.trim() : '';
}

function checked(value: FormValue): boolean {
  return stringValue(value) !== '';
}

function allowedValue<T extends string>(
  value: FormValue,
  allowed: readonly T[],
  fallback: T
): T {
  const candidate = stringValue(value) as T;
  return allowed.includes(candidate) ? candidate : fallback;
}

export function parseMemberList(value: FormValue): string[] {
  return [
    ...new Set(
      stringValue(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

export function buildMemberOperationalPayload(
  values: MemberFormValues
): MemberOperationalPayload {
  const phone = stringValue(values.phone);
  const canReceiveWhatsAppTasks =
    Boolean(phone) && checked(values.canReceiveWhatsAppTasks);
  const requestedCapacity = Number(
    stringValue(values.maxActiveTaskCapacity) || '10'
  );
  const maxActiveTaskCapacity =
    Number.isInteger(requestedCapacity) &&
    requestedCapacity >= 1 &&
    requestedCapacity <= 100
      ? requestedCapacity
      : 10;

  let workHours: MemberWorkHoursValue | null = null;
  if (checked(values.workHoursEnabled)) {
    const defaultStart = stringValue(values.workHoursStart) || '09:00';
    const defaultEnd = stringValue(values.workHoursEnd) || '18:00';
    workHours = {
      timezone:
        stringValue(values.workHoursTimezone) || 'Europe/Istanbul',
      days: MEMBER_WORK_DAYS.filter(({ value }) =>
        checked(values[`workDay_${value}`])
      ).map(({ value }) => ({
        day: value,
        enabled: true as const,
        start:
          stringValue(values[`workHoursStart_${value}`]) || defaultStart,
        end: stringValue(values[`workHoursEnd_${value}`]) || defaultEnd,
      })),
    };
  }

  return {
    role: allowedValue(
      values.role,
      ['MANAGER', 'AGENT', 'VIEWER'] as const,
      'AGENT'
    ),
    canReceiveWhatsAppTasks,
    allowAutomaticInternalMessages:
      canReceiveWhatsAppTasks &&
      checked(values.allowAutomaticInternalMessages),
    preferredLanguage: stringValue(values.preferredLanguage) || 'tr',
    workHours,
    availability: allowedValue(
      values.availability,
      ['AVAILABLE', 'BUSY', 'ON_LEAVE', 'OFFLINE'] as const,
      'AVAILABLE'
    ),
    specialtyRegions: parseMemberList(values.specialtyRegions),
    specialties: parseMemberList(values.specialties),
    maxActiveTaskCapacity,
  };
}
