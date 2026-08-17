import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  normalizeWhatsAppRecipientAddress,
  normalizeWhatsAppRecipientType,
} from './company-whatsapp';

describe('WhatsApp outbox recipient normalization', () => {
  it('uses the Prisma UNKNOWN default when callers omit recipient type', () => {
    expect(normalizeWhatsAppRecipientType(undefined)).toBe('UNKNOWN');
  });

  it('preserves an explicit recipient type', () => {
    expect(normalizeWhatsAppRecipientType('CRM_CONTACT')).toBe('CRM_CONTACT');
  });

  it('preserves a privacy-safe LID address for direct replies', () => {
    expect(normalizeWhatsAppRecipientAddress('69879839371315@lid')).toEqual({
      digits: '69879839371315',
      address: '69879839371315@lid',
    });
  });

  it('stores ordinary phone recipients as digits', () => {
    expect(normalizeWhatsAppRecipientAddress('+90 555 111 22 33')).toEqual({
      digits: '905551112233',
      address: '905551112233',
    });
  });
});
