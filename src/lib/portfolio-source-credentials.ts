import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

function encryptionKey() {
  const secret =
    process.env.PORTFOLIO_SOURCE_ENCRYPTION_KEY?.trim() ||
    process.env.COMPANY_CREDENTIAL_SECRET?.trim() ||
    process.env.FABRIKA_SESSION_SECRET?.trim();
  if (!secret || secret.length < 24) {
    throw new Error(
      'Portföy kaynak anahtarları için sunucu güvenlik anahtarı yapılandırılmamış.'
    );
  }
  return createHash('sha256')
    .update(`jasmine-portfolio-source:${secret}`)
    .digest();
}

export function encryptPortfolioCredential(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value.trim(), 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptPortfolioCredential(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Kayıtlı portföy kaynak anahtarı okunamadı.');
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

export function portfolioCredentialHint(value: string) {
  const normalized = value.trim();
  if (normalized.length < 10) return '••••••';
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}
