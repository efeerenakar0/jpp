import type {
  CompanyMemberRole,
  MemberAvailability,
  Prisma,
} from '@prisma/client';

import { memberAssignmentAvailability } from './member-availability';

export type AssignmentCandidate = {
  id: string;
  name: string;
  role: CompanyMemberRole;
  active: boolean;
  availability: MemberAvailability;
  workHours: Prisma.JsonValue | null;
  specialtyRegions: string[];
  specialties: string[];
  maxActiveTaskCapacity: number;
  activeTaskCount: number;
  lastAssignedAt: Date | null;
  phoneNormalized: string | null;
  canReceiveWhatsAppTasks: boolean;
  allowAutomaticInternalMessages: boolean;
};

function normalized(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function regionScore(candidate: AssignmentCandidate, region?: string | null) {
  if (!region) return 0;
  const needle = normalized(region);
  return candidate.specialtyRegions.some((item) => {
    const haystack = normalized(item);
    return haystack.includes(needle) || needle.includes(haystack);
  })
    ? 1
    : 0;
}

export function chooseAssignmentCandidate(
  candidates: AssignmentCandidate[],
  options: { region?: string | null; now?: Date } = {}
) {
  const eligible = candidates.filter((candidate) => {
    const available = memberAssignmentAvailability(
      candidate,
      options.now || new Date()
    );
    return (
      available.allowed &&
      candidate.role !== 'VIEWER' &&
      candidate.activeTaskCount < candidate.maxActiveTaskCapacity
    );
  });
  return (
    eligible.sort((left, right) => {
      const regionDifference =
        regionScore(right, options.region) -
        regionScore(left, options.region);
      if (regionDifference !== 0) return regionDifference;
      const phoneDifference =
        Number(
          Boolean(right.phoneNormalized) &&
            right.canReceiveWhatsAppTasks
        ) -
        Number(
          Boolean(left.phoneNormalized) &&
            left.canReceiveWhatsAppTasks
        );
      if (phoneDifference !== 0) return phoneDifference;
      if (left.activeTaskCount !== right.activeTaskCount) {
        return left.activeTaskCount - right.activeTaskCount;
      }
      return (
        (left.lastAssignedAt?.getTime() || 0) -
        (right.lastAssignedAt?.getTime() || 0)
      );
    })[0] || null
  );
}
