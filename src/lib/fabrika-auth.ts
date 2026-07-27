import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const FABRIKA_SESSION_COOKIE = 'jasmine_fabrika_session';
export const FABRIKA_SESSION_MAX_AGE = 60 * 60 * 12;

export type FabrikaPrincipalType = 'OWNER' | 'EMPLOYEE';

export type FabrikaSessionPayload = {
  scope: 'fabrika';
  accountId: string;
  companyName: string;
  accountSessionVersion: number;
  principalType: FabrikaPrincipalType;
  principalId: string;
  principalName: string;
  principalSessionVersion: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function getRequiredEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function isFabrikaAuthConfigured(): boolean {
  return Boolean(getRequiredEnv('FABRIKA_SESSION_SECRET'));
}

export function createFabrikaSessionToken(input: {
  account: {
    id: string;
    companyName: string;
    sessionVersion: number;
  };
  principal: {
    type: FabrikaPrincipalType;
    id: string;
    name: string;
    sessionVersion: number;
  };
}): string {
  const secret = getRequiredEnv('FABRIKA_SESSION_SECRET');

  if (!secret) {
    throw new Error('Fabrika session secret is not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: FabrikaSessionPayload = {
    scope: 'fabrika',
    accountId: input.account.id,
    companyName: input.account.companyName,
    accountSessionVersion: input.account.sessionVersion,
    principalType: input.principal.type,
    principalId: input.principal.id,
    principalName: input.principal.name,
    principalSessionVersion: input.principal.sessionVersion,
    issuedAt: now,
    expiresAt: now + FABRIKA_SESSION_MAX_AGE,
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function readFabrikaSessionToken(
  token?: string
): FabrikaSessionPayload | null {
  const secret = getRequiredEnv('FABRIKA_SESSION_SECRET');

  if (!secret || !token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split('.');

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, secret);

  if (!safeEqual(providedSignature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as FabrikaSessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.scope !== 'fabrika' ||
      !payload.accountId ||
      !payload.companyName ||
      !Number.isInteger(payload.accountSessionVersion) ||
      !['OWNER', 'EMPLOYEE'].includes(payload.principalType) ||
      !payload.principalId ||
      !payload.principalName ||
      !Number.isInteger(payload.principalSessionVersion) ||
      payload.expiresAt <= now
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyFabrikaSessionToken(token?: string): boolean {
  return Boolean(readFabrikaSessionToken(token));
}
