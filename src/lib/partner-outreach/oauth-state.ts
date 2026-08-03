import { randomBytes, timingSafeEqual } from 'node:crypto';
import { partnerSecurityHmac } from './crypto';

export type PartnerOAuthState = {
  accountId: string;
  principalId: string;
  csrfToken: string;
  nonce: string;
  expiresAt: number;
};

export function createPartnerOAuthState(input: {
  accountId: string;
  principalId: string;
  csrfToken: string;
  now?: number;
}) {
  const payload: PartnerOAuthState = {
    accountId: input.accountId,
    principalId: input.principalId,
    csrfToken: input.csrfToken,
    nonce: randomBytes(18).toString('base64url'),
    expiresAt: (input.now ?? Date.now()) + 10 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${partnerSecurityHmac('partner-oauth', encoded)}`;
}

export function readPartnerOAuthState(
  value: string | null | undefined,
  now = Date.now()
): PartnerOAuthState | null {
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;
  const expected = Buffer.from(partnerSecurityHmac('partner-oauth', encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as PartnerOAuthState;
    if (
      !payload.accountId ||
      !payload.principalId ||
      !payload.csrfToken ||
      !payload.nonce ||
      payload.expiresAt < now
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
