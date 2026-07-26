import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const PLATFORM_ADMIN_SESSION_COOKIE =
  'jasmine_platform_admin_session';
export const PLATFORM_ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

export type PlatformAdminSessionPayload = {
  scope: 'platform-admin';
  username: string;
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
  return createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
}

export function isPlatformAdminConfigured(): boolean {
  return Boolean(
    getRequiredEnv('PLATFORM_ADMIN_USERNAME') &&
      getRequiredEnv('PLATFORM_ADMIN_PASSWORD') &&
      getRequiredEnv('PLATFORM_ADMIN_SESSION_SECRET')
  );
}

export function validatePlatformAdminCredentials(
  username: string,
  password: string
): boolean {
  const expectedUsername = getRequiredEnv('PLATFORM_ADMIN_USERNAME');
  const expectedPassword = getRequiredEnv('PLATFORM_ADMIN_PASSWORD');

  if (!expectedUsername || !expectedPassword) {
    return false;
  }

  return (
    safeEqual(
      username.trim().toLocaleLowerCase('tr-TR'),
      expectedUsername.toLocaleLowerCase('tr-TR')
    ) &&
    safeEqual(password, expectedPassword)
  );
}

export function createPlatformAdminSessionToken(username: string): string {
  const secret = getRequiredEnv('PLATFORM_ADMIN_SESSION_SECRET');

  if (!secret) {
    throw new Error('Platform admin session secret is not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: PlatformAdminSessionPayload = {
    scope: 'platform-admin',
    username: username.trim(),
    issuedAt: now,
    expiresAt: now + PLATFORM_ADMIN_SESSION_MAX_AGE,
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url'
  );

  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function readPlatformAdminSessionToken(
  token?: string
): PlatformAdminSessionPayload | null {
  const secret = getRequiredEnv('PLATFORM_ADMIN_SESSION_SECRET');

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
    ) as PlatformAdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.scope !== 'platform-admin' ||
      !payload.username ||
      payload.expiresAt <= now
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function verifyPlatformAdminSessionToken(token?: string): boolean {
  return Boolean(readPlatformAdminSessionToken(token));
}

export function createPlatformAdminAttemptKey(
  clientIdentifier: string,
  username: string
): string {
  const secret = getRequiredEnv('PLATFORM_ADMIN_SESSION_SECRET');

  if (!secret) {
    throw new Error('Platform admin session secret is not configured');
  }

  return createHmac('sha256', secret)
    .update(
      `${clientIdentifier.trim()}|${username
        .trim()
        .toLocaleLowerCase('tr-TR')}`
    )
    .digest('hex');
}
