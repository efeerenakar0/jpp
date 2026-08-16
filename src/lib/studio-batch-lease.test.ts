import { describe, expect, it } from 'vitest';

import {
  STUDIO_ITEM_MAX_ATTEMPTS,
  studioItemFailureTransition,
  studioItemLeaseExpiry,
} from './studio-batch-lease';

describe('studio batch worker lease rules', () => {
  const now = new Date('2026-08-04T12:00:00.000Z');

  it('creates a finite lease from the injected clock', () => {
    expect(studioItemLeaseExpiry(now).toISOString()).toBe(
      '2026-08-04T12:15:00.000Z'
    );
  });

  it('requeues retryable failures with deterministic backoff', () => {
    expect(
      studioItemFailureTransition({
        attemptCount: 1,
        now,
        message: 'Geçici sağlayıcı hatası',
      })
    ).toMatchObject({
      status: 'PENDING',
      errorMessage: 'Geçici sağlayıcı hatası',
      leaseOwner: null,
      leaseExpiresAt: null,
      nextAttemptAt: new Date('2026-08-04T12:00:30.000Z'),
    });
  });

  it('stops retrying at the configured maximum', () => {
    expect(
      studioItemFailureTransition({
        attemptCount: STUDIO_ITEM_MAX_ATTEMPTS,
        now,
        message: 'Kalıcı hata',
      })
    ).toMatchObject({
      status: 'FAILED',
      nextAttemptAt: null,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
  });

  it('does not retry a provider result that was rejected after generation', () => {
    expect(
      studioItemFailureTransition({
        attemptCount: 1,
        now,
        message: 'Kadraj guvenlik kontrolunden gecmedi.',
        retryable: false,
      })
    ).toMatchObject({
      status: 'FAILED',
      nextAttemptAt: null,
      leaseOwner: null,
      leaseExpiresAt: null,
    });
  });
});
