import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  decryptContactPhone,
  encryptContactPhone,
  maskContactPhone,
  phoneHmac,
} from './contact-crypto';

describe('Avcı v2 telefon koruması', () => {
  const previousEncryptionKey =
    process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY;
  const previousHmacKey = process.env.HUNTING_CONTACT_HMAC_KEY;

  beforeEach(() => {
    process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY =
      'test-only-encryption-key-at-least-32-chars';
    process.env.HUNTING_CONTACT_HMAC_KEY =
      'test-only-contact-hmac-key-at-least-32-chars';
  });

  afterEach(() => {
    process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY = previousEncryptionKey;
    process.env.HUNTING_CONTACT_HMAC_KEY = previousHmacKey;
  });

  it('telefonu şifreler, HMAC ile tekilleştirir ve maskeler', () => {
    const encrypted = encryptContactPhone('+90 532 111 22 33');

    expect(encrypted).not.toContain('5321112233');
    expect(decryptContactPhone(encrypted)).toBe('905321112233');
    expect(phoneHmac('+90 532 111 22 33')).toBe(
      phoneHmac('0 (532) 111 22 33')
    );
    expect(maskContactPhone('+90 532 111 22 33')).toBe('+90 5•• ••• 22 33');
  });

  it('geçersiz telefonu reddeder', () => {
    expect(() => encryptContactPhone('123')).toThrow(
      'Geçerli bir telefon numarası gerekli'
    );
  });
});
