import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { normalizePartnerEmail } from './normalization';

function secret() {
  const value = process.env.PARTNER_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!value || value.length < 32) {
    throw new Error('Partner bağlantı güvenlik anahtarı yapılandırılmamış.');
  }
  return value;
}

function key() {
  return createHash('sha256').update(`partner-credentials:${secret()}`).digest();
}

export function encryptPartnerCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptPartnerCredential(value: string) {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Partner bağlantısı okunamadı.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key(),
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function emailSuppressionHmac(value: string) {
  const normalized = normalizePartnerEmail(value);
  if (!normalized) throw new Error('Geçerli bir kurumsal e-posta gerekli.');
  return createHmac('sha256', secret())
    .update(`partner-email:${normalized}`)
    .digest('hex');
}

export function maskPartnerEmail(value: string) {
  const normalized = normalizePartnerEmail(value);
  if (!normalized) return '***';
  const [local, domain] = normalized.split('@');
  if (!local || !domain) return '***';
  const masked =
    local.length <= 2
      ? `${local[0] ?? '*'}*`
      : `${local[0]}***${local[local.length - 1]}`;
  return `${masked}@${domain}`;
}

export function partnerSecurityHmac(namespace: string, value: string) {
  return createHmac('sha256', secret())
    .update(`${namespace}:${value}`)
    .digest('base64url');
}
