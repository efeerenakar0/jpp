import 'server-only';

import prisma from '@/lib/prisma';
import { publicationEligibilityWhere } from '@/lib/property-publication';

import { resolvePropertyCandidates } from './property-resolution';

export async function resolveViewingPropertyForMessage(input: {
  companyAccountId: string;
  message: string;
  now?: Date;
}) {
  const properties = await prisma.crmProperty.findMany({
    where: publicationEligibilityWhere(
      input.companyAccountId,
      input.now || new Date()
    ),
    select: {
      id: true,
      referenceCode: true,
      title: true,
      location: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  return resolvePropertyCandidates(input.message, properties);
}
