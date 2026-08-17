import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { normalizeWhatsAppRecipientType } from './company-whatsapp';

describe('WhatsApp outbox recipient normalization', () => {
  it('uses the Prisma UNKNOWN default when callers omit recipient type', () => {
    expect(normalizeWhatsAppRecipientType(undefined)).toBe('UNKNOWN');
  });

  it('preserves an explicit recipient type', () => {
    expect(normalizeWhatsAppRecipientType('CRM_CONTACT')).toBe('CRM_CONTACT');
  });
});
