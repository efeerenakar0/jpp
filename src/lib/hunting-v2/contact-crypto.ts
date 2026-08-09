import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { decryptSecret } from '../whatsapp-crypto';

const CONTACT_ENCRYPTED_PREFIX = 'contact:v1:';

export function normalizeContactPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `90${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('5')) digits = `90${digits}`;
  if (!/^90[1-9]\d{9}$/.test(digits)) {
    throw new Error('Geçerli bir telefon numarası gerekli.');
  }
  return digits;
}

export function encryptContactPhone(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', contactEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalizeContactPhone(value), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${CONTACT_ENCRYPTED_PREFIX}${iv.toString(
    'base64url'
  )}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptContactPhone(value: string) {
  if (!value.startsWith(CONTACT_ENCRYPTED_PREFIX)) {
    return normalizeContactPhone(decryptSecret(value));
  }

  const key = contactEncryptionKey();
  try {
    const [ivText, tagText, encryptedText] = value
      .slice(CONTACT_ENCRYPTED_PREFIX.length)
      .split('.');
    if (!ivText || !tagText || !encryptedText) {
      throw new Error('Geçersiz şifreli telefon verisi.');
    }

    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivText, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return normalizeContactPhone(
      Buffer.concat([
        decipher.update(Buffer.from(encryptedText, 'base64url')),
        decipher.final(),
      ]).toString('utf8')
    );
  } catch {
    throw new Error('Şifreli Avcı telefon verisi geçersiz.');
  }
}

function contactEncryptionKey() {
  const secret = process.env.HUNTING_CONTACT_ENCRYPTION_KEY;
  if (!secret || secret.length < 24) {
    throw new Error(
      'HUNTING_CONTACT_ENCRYPTION_KEY en az 24 karakter olarak yapılandırılmalıdır.'
    );
  }
  return createHash('sha256').update(secret).digest();
}

function hmacKey() {
  const key = process.env.HUNTING_CONTACT_HMAC_KEY;
  if (!key || key.length < 24) {
    throw new Error(
      'HUNTING_CONTACT_HMAC_KEY en az 24 karakter olarak yapılandırılmalıdır.'
    );
  }
  return key;
}

export function phoneHmac(value: string) {
  return createHmac('sha256', hmacKey())
    .update(normalizeContactPhone(value))
    .digest('hex');
}

export function maskContactPhone(value: string) {
  const digits = normalizeContactPhone(value);
  return `+${digits.slice(0, 2)} ${digits.slice(2, 3)}•• ••• ${digits.slice(
    -4,
    -2
  )} ${digits.slice(-2)}`;
}
