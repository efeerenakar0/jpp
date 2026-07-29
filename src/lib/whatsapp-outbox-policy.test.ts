import { describe, expect, it } from 'vitest';

import {
  classifyStaleWhatsAppDispatch,
  classifyWhatsAppDispatchFailure,
} from './whatsapp-outbox-policy';

describe('WhatsApp outbox dispatch policy', () => {
  it('never retries an ambiguous failure after the provider call started', () => {
    expect(
      classifyWhatsAppDispatchFailure({
        sendAttempted: true,
        attemptCount: 1,
        maxAttempts: 5,
      })
    ).toBe('AMBIGUOUS_TERMINAL');
  });

  it('retries preflight failures until the configured attempt limit', () => {
    expect(
      classifyWhatsAppDispatchFailure({
        sendAttempted: false,
        attemptCount: 2,
        maxAttempts: 5,
      })
    ).toBe('RETRY');
    expect(
      classifyWhatsAppDispatchFailure({
        sendAttempted: false,
        attemptCount: 5,
        maxAttempts: 5,
      })
    ).toBe('TERMINAL');
  });

  it('quarantines stale processing rows instead of sending them twice', () => {
    const now = new Date('2026-07-29T10:10:00.000Z');
    expect(
      classifyStaleWhatsAppDispatch(
        {
          status: 'SENDING',
          lockedAt: new Date('2026-07-29T10:04:59.000Z'),
        },
        now
      )
    ).toBe('AMBIGUOUS_TERMINAL');
    expect(
      classifyStaleWhatsAppDispatch(
        {
          status: 'PROCESSING',
          lockedAt: new Date('2026-07-29T10:09:00.000Z'),
        },
        now
      )
    ).toBe('NONE');
  });

  it('safely releases stale rows that crashed before the provider call', () => {
    expect(
      classifyStaleWhatsAppDispatch(
        {
          status: 'PROCESSING',
          lockedAt: new Date('2026-07-29T10:04:59.000Z'),
        },
        new Date('2026-07-29T10:10:00.000Z')
      )
    ).toBe('REQUEUE_SAFE');
  });
});
