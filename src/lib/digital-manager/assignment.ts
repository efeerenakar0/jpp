import { prisma } from '@/lib/prisma';

import { chooseAssignmentCandidate } from './assignment-policy';

export async function selectAvailableCompanyMember(input: {
  companyAccountId: string;
  region?: string | null;
  now?: Date;
}) {
  const members = await prisma.companyMember.findMany({
    where: {
      companyAccountId: input.companyAccountId,
      active: true,
      availability: 'AVAILABLE',
      role: { in: ['MANAGER', 'AGENT'] },
    },
    select: {
      id: true,
      name: true,
      role: true,
      active: true,
      availability: true,
      workHours: true,
      specialtyRegions: true,
      specialties: true,
      maxActiveTaskCapacity: true,
      lastAssignedAt: true,
      phoneNormalized: true,
      canReceiveWhatsAppTasks: true,
      allowAutomaticInternalMessages: true,
    },
    take: 100,
  });
  if (members.length === 0) return null;
  const counts = await prisma.crmTask.groupBy({
    by: ['assignedMemberId'],
    where: {
      companyAccountId: input.companyAccountId,
      assignedMemberId: { in: members.map(({ id }) => id) },
      status: 'OPEN',
      workflowStatus: {
        notIn: ['COMPLETED', 'CANCELLED', 'FAILED'],
      },
    },
    _count: { _all: true },
  });
  const countByMember = new Map(
    counts.map((entry) => [
      entry.assignedMemberId,
      entry._count._all,
    ])
  );
  return chooseAssignmentCandidate(
    members.map((member) => ({
      ...member,
      activeTaskCount: countByMember.get(member.id) || 0,
    })),
    { region: input.region, now: input.now }
  );
}
