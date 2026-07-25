import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const FABRIKA_SESSION_COOKIE = 'jasmine_fabrika_session';
export const FABRIKA_SESSION_MAX_AGE = 60 * 60 * 12;

type FabrikaSessionPayload = {
  scope: 'fabrika';
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
  return Boolean(
    getRequiredEnv('FABRIKA_ACCESS_KEY') &&
    getRequiredEnv('FABRIKA_VERIFICATION_CODE') &&
    getRequiredEnv('FABRIKA_SESSION_SECRET')
  );
}

export function validateFabrikaCredentials(accessKey: string, verificationCode: string): boolean {
  const expectedAccessKey = getRequiredEnv('FABRIKA_ACCESS_KEY');
  const expectedVerificationCode = getRequiredEnv('FABRIKA_VERIFICATION_CODE');

  if (!expectedAccessKey || !expectedVerificationCode) {
    return false;
  }

  return (
    safeEqual(accessKey.trim(), expectedAccessKey) &&
    safeEqual(verificationCode.trim(), expectedVerificationCode)
  );
}

export function createFabrikaSessionToken(): string {
  const secret = getRequiredEnv('FABRIKA_SESSION_SECRET');

  if (!secret) {
    throw new Error('Fabrika session secret is not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: FabrikaSessionPayload = {
    scope: 'fabrika',
    issuedAt: now,
    expiresAt: now + FABRIKA_SESSION_MAX_AGE,
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyFabrikaSessionToken(token?: string): boolean {
  const secret = getRequiredEnv('FABRIKA_SESSION_SECRET');

  if (!secret || !token) {
    return false;
  }

  const [encodedPayload, providedSignature] = token.split('.');

  if (!encodedPayload || !providedSignature) {
    return false;
  }

  const expectedSignature = sign(encodedPayload, secret);

  if (!safeEqual(providedSignature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as FabrikaSessionPayload;
    const now = Math.floor(Date.now() / 1000);

    return payload.scope === 'fabrika' && payload.expiresAt > now;
  } catch {
    return false;
  }
}
