import 'server-only';

import { createHmac } from 'node:crypto';
import { decryptSecret, encryptSecret } from '../whatsapp-crypto';

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
  return encryptSecret(normalizeContactPhone(value));
}

export function decryptContactPhone(value: string) {
  return normalizeContactPhone(decryptSecret(value));
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
