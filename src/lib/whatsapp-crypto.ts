import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';

function encryptionKey() {
  const secret =
    process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY ||
    process.env.COMPANY_CREDENTIAL_SECRET ||
    process.env.FABRIKA_SESSION_SECRET;

  if (!secret || secret.length < 24) {
    throw new Error(
      'WHATSAPP_CREDENTIAL_ENCRYPTION_KEY en az 24 karakter olarak yapılandırılmalıdır.'
    );
  }

  return createHash('sha256').update(secret).digest();
}

export function isEncryptedSecret(value: string | null | undefined) {
  return Boolean(value?.startsWith(ENCRYPTED_PREFIX));
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}.${authTag.toString(
    'base64url'
  )}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string) {
  if (!isEncryptedSecret(value)) {
    // Eski kayıtlara yalnızca geçiş uyumluluğu sağlar. Yeni kayıtlar şifrelenir.
    return value;
  }

  const payload = value.slice(ENCRYPTED_PREFIX.length);
  const [ivText, tagText, encryptedText] = payload.split('.');

  if (!ivText || !tagText || !encryptedText) {
    throw new Error('Şifreli WhatsApp kimlik bilgisi geçersiz.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivText, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function generateWebhookSecret() {
  return randomBytes(32).toString('base64url');
}

export function hashWebhookSecret(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function verifyWebhookSecret(
  candidate: string | null,
  expectedHash: string | null
) {
  if (!candidate || !expectedHash) {
    return false;
  }

  const actual = Buffer.from(hashWebhookSecret(candidate), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

export function maskSecret(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const plain = isEncryptedSecret(value) ? 'configured-secret' : value;
  return plain.length > 12
    ? `${plain.slice(0, 4)}…${plain.slice(-4)}`
    : '••••••••';
}
