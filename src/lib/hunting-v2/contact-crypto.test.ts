import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  decryptContactPhone,
  encryptContactPhone,
  maskContactPhone,
  phoneHmac,
} from './contact-crypto';
import { encryptSecret } from '../whatsapp-crypto';

describe('Avcı v2 telefon koruması', () => {
  const previousEncryptionKey =
    process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY;
  const previousContactEncryptionKey =
    process.env.HUNTING_CONTACT_ENCRYPTION_KEY;
  const previousHmacKey = process.env.HUNTING_CONTACT_HMAC_KEY;

  beforeEach(() => {
    process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY =
      'test-only-encryption-key-at-least-32-chars';
    process.env.HUNTING_CONTACT_ENCRYPTION_KEY =
      'test-only-contact-encryption-key-at-least-32-chars';
    process.env.HUNTING_CONTACT_HMAC_KEY =
      'test-only-contact-hmac-key-at-least-32-chars';
  });

  afterEach(() => {
    process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY = previousEncryptionKey;
    process.env.HUNTING_CONTACT_ENCRYPTION_KEY =
      previousContactEncryptionKey;
    process.env.HUNTING_CONTACT_HMAC_KEY = previousHmacKey;
  });

  it('telefonu şifreler, HMAC ile tekilleştirir ve maskeler', () => {
    const encrypted = encryptContactPhone('+90 532 111 22 33');

    expect(encrypted).toMatch(/^contact:v1:/);
    expect(encrypted).not.toContain('5321112233');
    expect(decryptContactPhone(encrypted)).toBe('905321112233');
    expect(phoneHmac('+90 532 111 22 33')).toBe(
      phoneHmac('0 (532) 111 22 33')
    );
    expect(maskContactPhone('+90 532 111 22 33')).toBe('+90 5•• ••• 22 33');
  });

  it('yeni telefonları WhatsApp anahtarından bağımsız şifreler', () => {
    delete process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.COMPANY_CREDENTIAL_SECRET;
    delete process.env.FABRIKA_SESSION_SECRET;

    const encrypted = encryptContactPhone('+90 532 111 22 33');

    expect(decryptContactPhone(encrypted)).toBe('905321112233');
  });

  it('eski WhatsApp anahtarıyla şifrelenmiş telefonları okumaya devam eder', () => {
    const legacyEncrypted = encryptSecret('905321112233');

    expect(decryptContactPhone(legacyEncrypted)).toBe('905321112233');
  });

  it('Avcı şifreleme anahtarı eksikse fail-closed davranır', () => {
    delete process.env.HUNTING_CONTACT_ENCRYPTION_KEY;

    expect(() => encryptContactPhone('+90 532 111 22 33')).toThrow(
      'HUNTING_CONTACT_ENCRYPTION_KEY'
    );
  });

  it('değiştirilmiş şifreli telefon verisini reddeder', () => {
    const encrypted = encryptContactPhone('+90 532 111 22 33');
    const tampered = `${encrypted.slice(0, -1)}${
      encrypted.endsWith('A') ? 'B' : 'A'
    }`;

    expect(() => decryptContactPhone(tampered)).toThrow(
      'Şifreli Avcı telefon verisi geçersiz'
    );
  });

  it('geçersiz telefonu reddeder', () => {
    expect(() => encryptContactPhone('123')).toThrow(
      'Geçerli bir telefon numarası gerekli'
    );
  });
});
