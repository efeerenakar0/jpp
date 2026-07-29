export type WhatsAppDispatchFailureDisposition =
  | 'RETRY'
  | 'TERMINAL'
  | 'AMBIGUOUS_TERMINAL';

export type StaleWhatsAppDispatchDisposition =
  | 'NONE'
  | 'REQUEUE_SAFE'
  | 'AMBIGUOUS_TERMINAL';

const STALE_DISPATCH_MS = 5 * 60_000;

export function classifyWhatsAppDispatchFailure(input: {
  sendAttempted: boolean;
  attemptCount: number;
  maxAttempts: number;
}): WhatsAppDispatchFailureDisposition {
  if (input.sendAttempted) return 'AMBIGUOUS_TERMINAL';
  if (input.attemptCount >= input.maxAttempts) return 'TERMINAL';
  return 'RETRY';
}

export function classifyStaleWhatsAppDispatch(
  message: {
    status: string;
    lockedAt: Date | null;
  },
  now = new Date()
): StaleWhatsAppDispatchDisposition {
  const stale =
    (message.status === 'PROCESSING' || message.status === 'SENDING') &&
    Boolean(
      message.lockedAt &&
        message.lockedAt.getTime() < now.getTime() - STALE_DISPATCH_MS
    );
  if (!stale) return 'NONE';
  return message.status === 'SENDING'
    ? 'AMBIGUOUS_TERMINAL'
    : 'REQUEUE_SAFE';
}
