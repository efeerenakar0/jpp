import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { decryptContactPhone } from './contact-crypto';
import { buildAuthorizedSourceContact } from './authorized-source-contact';

describe('Yetkili kaynak sayfası iletişim kaydı', () => {
  const previousEncryptionKey = process.env.HUNTING_CONTACT_ENCRYPTION_KEY;
  const previousHmacKey = process.env.HUNTING_CONTACT_HMAC_KEY;
  const previousRetention = process.env.AVCI_CONTACT_RETENTION_DAYS;

  beforeEach(() => {
    process.env.HUNTING_CONTACT_ENCRYPTION_KEY =
      'test-only-encryption-key-at-least-32-chars';
    process.env.HUNTING_CONTACT_HMAC_KEY =
      'test-only-contact-hmac-key-at-least-32-chars';
    process.env.AVCI_CONTACT_RETENTION_DAYS = '90';
  });

  afterEach(() => {
    process.env.HUNTING_CONTACT_ENCRYPTION_KEY = previousEncryptionKey;
    process.env.HUNTING_CONTACT_HMAC_KEY = previousHmacKey;
    process.env.AVCI_CONTACT_RETENTION_DAYS = previousRetention;
  });

  it('telefonu düz metin saklamadan kaynağa ve ilana bağlar', () => {
    const record = buildAuthorizedSourceContact({
      phone: '0 (555) 111 22 33',
      sourceUrl: 'https://www.sahibinden.com/ilan/123/detay',
      now: new Date('2026-08-09T12:00:00.000Z'),
      authorizationExpiresAt: null,
    });

    expect(record).toMatchObject({
      maskedPhone: '+90 5•• ••• 22 33',
      subjectRole: 'OWNER',
      sourceType: 'AUTHORIZED_SOURCE',
      purpose: 'PORTFOLIO_DISCOVERY',
      sourcePurposeAllowed: false,
      verificationStatus: 'UNVERIFIED',
      legalBasisStatus: 'CONFIRMED',
    });
    expect(record.phoneCiphertext).not.toContain('5551112233');
    expect(decryptContactPhone(record.phoneCiphertext)).toBe('905551112233');
    expect(record.retentionUntil.toISOString()).toBe(
      '2026-11-07T12:00:00.000Z'
    );
  });

  it('kaynak yetkisi daha erken bitiyorsa iletişim saklamayı o tarihte keser', () => {
    const record = buildAuthorizedSourceContact({
      phone: '+90 555 111 22 33',
      sourceUrl: 'https://www.sahibinden.com/ilan/123/detay',
      now: new Date('2026-08-09T12:00:00.000Z'),
      authorizationExpiresAt: new Date('2026-08-20T00:00:00.000Z'),
    });

    expect(record.retentionUntil.toISOString()).toBe(
      '2026-08-20T00:00:00.000Z'
    );
  });
});
