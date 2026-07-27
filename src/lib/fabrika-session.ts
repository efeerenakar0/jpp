import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import {
  FABRIKA_SESSION_COOKIE,
  readFabrikaSessionToken,
} from '@/lib/fabrika-auth';

export class FabrikaSessionError extends Error {
  constructor() {
    super('Fabrika oturumu bulunamadı.');
    this.name = 'FabrikaSessionError';
  }
}

export class FabrikaForbiddenError extends Error {
  constructor(message = 'Bu işlem yalnızca şirket patronuna açıktır.') {
    super(message);
    this.name = 'FabrikaForbiddenError';
  }
}

export async function requireFabrikaPrincipal() {
  const cookieStore = await cookies();
  const token = cookieStore.get(FABRIKA_SESSION_COOKIE)?.value;
  const session = readFabrikaSessionToken(token);

  if (!session) {
    throw new FabrikaSessionError();
  }

  const account = await prisma.companyAccount.findUnique({
    where: { id: session.accountId },
  });

  if (
    !account ||
    account.status !== 'ACTIVE' ||
    !account.workspaceEnabled ||
    account.sessionVersion !== session.accountSessionVersion
  ) {
    throw new FabrikaSessionError();
  }

  if (session.principalType === 'OWNER') {
    if (
      session.principalId !== account.id ||
      session.principalSessionVersion !== account.sessionVersion
    ) {
      throw new FabrikaSessionError();
    }

    return {
      account,
      type: 'OWNER' as const,
      member: null,
      displayName: account.ownerName,
      permissions: {
        canManageTeam: true,
        canManageSecrets: true,
        canViewSubscription: true,
        canEditReports: true,
      },
    };
  }

  const member = await prisma.companyMember.findFirst({
    where: {
      id: session.principalId,
      companyAccountId: account.id,
    },
  });

  if (
    !member ||
    !member.active ||
    member.sessionVersion !== session.principalSessionVersion
  ) {
    throw new FabrikaSessionError();
  }

  return {
    account,
    type: 'EMPLOYEE' as const,
    member,
    displayName: member.name,
    permissions: {
      canManageTeam: false,
      canManageSecrets: false,
      canViewSubscription: false,
      canEditReports: false,
    },
  };
}

export async function requireFabrikaAccount() {
  return (await requireFabrikaPrincipal()).account;
}

export async function requireFabrikaOwner() {
  const principal = await requireFabrikaPrincipal();

  if (principal.type !== 'OWNER') {
    throw new FabrikaForbiddenError();
  }

  return principal;
}
