import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
  hashWebhookSecret,
  isEncryptedSecret,
  verifyWebhookSecret,
} from './whatsapp-crypto';

describe('WhatsApp credential security', () => {
  const previousKey = process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY =
      'test-only-key-with-more-than-thirty-two-characters';
  });

  afterEach(() => {
    if (previousKey === undefined) {
      delete process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY;
    } else {
      process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY = previousKey;
    }
  });

  it('encrypts secrets with authenticated encryption', () => {
    const encrypted = encryptSecret('meta-secret-token');

    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain('meta-secret-token');
    expect(decryptSecret(encrypted)).toBe('meta-secret-token');
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptSecret('meta-secret-token');
    expect(() => decryptSecret(`${encrypted}x`)).toThrow();
  });

  it('accepts only the matching high-entropy webhook token', () => {
    const secret = generateWebhookSecret();
    const hash = hashWebhookSecret(secret);

    expect(verifyWebhookSecret(secret, hash)).toBe(true);
    expect(verifyWebhookSecret(`${secret}x`, hash)).toBe(false);
    expect(verifyWebhookSecret(null, hash)).toBe(false);
  });
});
