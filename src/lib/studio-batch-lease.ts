export const STUDIO_ITEM_LEASE_MS = 15 * 60 * 1_000;
export const STUDIO_ITEM_MAX_ATTEMPTS = 3;

const RETRY_DELAYS_MS = [30_000, 2 * 60_000] as const;

export function studioItemLeaseExpiry(now: Date) {
  return new Date(now.getTime() + STUDIO_ITEM_LEASE_MS);
}

export function studioItemFailureTransition(input: {
  attemptCount: number;
  now: Date;
  message: string;
}) {
  const exhausted = input.attemptCount >= STUDIO_ITEM_MAX_ATTEMPTS;
  const retryDelay =
    RETRY_DELAYS_MS[
      Math.min(Math.max(input.attemptCount - 1, 0), RETRY_DELAYS_MS.length - 1)
    ];

  return {
    status: exhausted ? ('FAILED' as const) : ('PENDING' as const),
    errorMessage: input.message.slice(0, 2_000),
    leaseOwner: null,
    leaseExpiresAt: null,
    nextAttemptAt: exhausted
      ? null
      : new Date(input.now.getTime() + retryDelay),
  };
}
