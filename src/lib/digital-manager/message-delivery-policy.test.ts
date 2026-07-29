import { describe, expect, it } from 'vitest';

import {
  clientDeliveryStatus,
  isMonotonicDeliveryTransition,
  projectionPatchForDelivery,
} from './message-delivery-policy';

describe('message delivery policy', () => {
  it('never presents queued or processing work as delivered', () => {
    expect(clientDeliveryStatus('QUEUED')).toBe('QUEUED');
    expect(clientDeliveryStatus('PROCESSING')).toBe('QUEUED');
    expect(clientDeliveryStatus('SENDING')).toBe('QUEUED');
  });

  it('keeps provider accepted, delivered and read states distinct', () => {
    expect(clientDeliveryStatus('SENT')).toBe('SENT');
    expect(clientDeliveryStatus('DELIVERED')).toBe('DELIVERED');
    expect(clientDeliveryStatus('READ')).toBe('READ');
    expect(clientDeliveryStatus('FAILED')).toBe('FAILED');
  });

  it('allows forward progress and blocks stale acknowledgements', () => {
    expect(isMonotonicDeliveryTransition('QUEUED', 'SENT')).toBe(true);
    expect(isMonotonicDeliveryTransition('SENT', 'DELIVERED')).toBe(true);
    expect(isMonotonicDeliveryTransition('DELIVERED', 'READ')).toBe(true);
    expect(isMonotonicDeliveryTransition('READ', 'DELIVERED')).toBe(false);
    expect(isMonotonicDeliveryTransition('DELIVERED', 'SENT')).toBe(false);
    expect(isMonotonicDeliveryTransition('FAILED', 'SENT')).toBe(false);
  });

  it('does not replace a confirmed delivery with a late failure', () => {
    expect(isMonotonicDeliveryTransition('SENT', 'FAILED')).toBe(true);
    expect(isMonotonicDeliveryTransition('DELIVERED', 'FAILED')).toBe(false);
    expect(isMonotonicDeliveryTransition('READ', 'FAILED')).toBe(false);
  });

  it('builds terminal failure patches for every delivery projection', () => {
    const failedAt = new Date('2026-07-28T12:00:00.000Z');
    expect(
      projectionPatchForDelivery('FAILED', failedAt, 'Gateway timeout')
    ).toEqual({
      outbox: {
        status: 'FAILED',
        failedAt,
        lockedAt: null,
        lastError: 'Gateway timeout',
      },
      conversation: {
        deliveryStatus: 'FAILED',
        failedAt,
        errorMessage: 'Gateway timeout',
      },
      whatsapp: {
        status: 'FAILED',
      },
    });
  });

  it('does not overwrite the real delivered timestamp when read arrives later', () => {
    const readAt = new Date('2026-07-28T12:00:00.000Z');
    const patch = projectionPatchForDelivery('READ', readAt);
    expect(patch.outbox).not.toHaveProperty('deliveredAt');
    expect(patch.conversation).toEqual(
      expect.objectContaining({
        deliveryStatus: 'READ',
        readAt,
      })
    );
    expect(patch.conversation).not.toHaveProperty('deliveredAt');
  });
});
