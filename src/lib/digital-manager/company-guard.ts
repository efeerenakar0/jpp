import type { Prisma } from '@prisma/client';

import { isSubscriptionAllowed } from '@/lib/company-accounts';
import { prisma } from '@/lib/prisma';

type CompanyDb = Prisma.TransactionClient | typeof prisma;

export async function getCompanyOperationalStatus(
  companyAccountId: string,
  db: CompanyDb = prisma,
  now = new Date()
) {
  const account = await db.companyAccount.findUnique({
    where: { id: companyAccountId },
    select: {
      status: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      workspaceEnabled: true,
    },
  });
  if (!account) {
    return { allowed: false as const, reason: 'ACCOUNT_NOT_FOUND' as const };
  }
  if (account.status !== 'ACTIVE') {
    return { allowed: false as const, reason: 'ACCOUNT_INACTIVE' as const };
  }
  if (
    !isSubscriptionAllowed(account.subscriptionStatus) ||
    (account.subscriptionEndsAt &&
      account.subscriptionEndsAt.getTime() <= now.getTime())
  ) {
    return {
      allowed: false as const,
      reason: 'SUBSCRIPTION_INACTIVE' as const,
    };
  }
  if (!account.workspaceEnabled) {
    return {
      allowed: false as const,
      reason: 'WORKSPACE_DISABLED' as const,
    };
  }
  return { allowed: true as const, reason: null };
}
