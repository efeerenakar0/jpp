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

export async function requireFabrikaAccount() {
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
    account.sessionVersion !== session.sessionVersion
  ) {
    throw new FabrikaSessionError();
  }

  return account;
}
