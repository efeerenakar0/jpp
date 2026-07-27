import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

function securitySecret() {
  const secret =
    process.env.CALENDAR_TOKEN_ENCRYPTION_KEY?.trim() ||
    process.env.COMPANY_CREDENTIAL_SECRET?.trim() ||
    process.env.FABRIKA_SESSION_SECRET?.trim();
  if (!secret || secret.length < 24) {
    throw new Error(
      'Google Calendar belirteçleri için sunucu güvenlik anahtarı yapılandırılmamış.'
    );
  }
  return secret;
}

function encryptionKey() {
  return createHash('sha256')
    .update(`jasmine-calendar:${securitySecret()}`)
    .digest();
}

export function encryptCalendarToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptCalendarToken(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Google Calendar bağlantı belirteci okunamadı.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivValue, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export type CalendarOAuthState = {
  accountId: string;
  principalId: string;
  expiresAt: number;
  nonce: string;
};

function sign(payload: string) {
  return createHmac('sha256', securitySecret())
    .update(`calendar-oauth:${payload}`)
    .digest('base64url');
}

export function createCalendarOAuthState(input: {
  accountId: string;
  principalId: string;
  now?: number;
}) {
  const payload: CalendarOAuthState = {
    accountId: input.accountId,
    principalId: input.principalId,
    expiresAt: (input.now ?? Date.now()) + 10 * 60 * 1000,
    nonce: randomBytes(16).toString('base64url'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function readCalendarOAuthState(
  value: string | null | undefined,
  now = Date.now()
): CalendarOAuthState | null {
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature) return null;
  const expected = Buffer.from(sign(encoded));
  const actual = Buffer.from(signature);
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as CalendarOAuthState;
    if (
      !payload.accountId ||
      !payload.principalId ||
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
