import type { MessageDeliveryStatus } from '@prisma/client';

export type DeliveryRuntimeStatus =
  | MessageDeliveryStatus
  | 'PROCESSING'
  | 'SENDING';

export type DeliveryTransitionStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED';

const DELIVERY_RANK: Record<
  Exclude<DeliveryRuntimeStatus, 'FAILED' | 'NOT_APPLICABLE' | 'RECEIVED'>,
  number
> = {
  QUEUED: 0,
  PROCESSING: 1,
  SENDING: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
};

export function clientDeliveryStatus(
  status: DeliveryRuntimeStatus
): MessageDeliveryStatus {
  switch (status) {
    case 'SENT':
    case 'DELIVERED':
    case 'READ':
    case 'FAILED':
      return status;
    case 'NOT_APPLICABLE':
    case 'RECEIVED':
      return status;
    default:
      return 'QUEUED';
  }
}

export function isMonotonicDeliveryTransition(
  current: DeliveryRuntimeStatus,
  next: DeliveryTransitionStatus
) {
  if (current === next) return true;
  if (
    current === 'FAILED' ||
    current === 'READ' ||
    current === 'NOT_APPLICABLE' ||
    current === 'RECEIVED'
  ) {
    return false;
  }
  if (next === 'FAILED') {
    return DELIVERY_RANK[current] <= DELIVERY_RANK.SENT;
  }
  if (current === 'PROCESSING' || current === 'SENDING') {
    return DELIVERY_RANK[next] >= DELIVERY_RANK.SENT;
  }
  return DELIVERY_RANK[next] >= DELIVERY_RANK[current];
}

export function projectionPatchForDelivery(
  status: DeliveryTransitionStatus,
  occurredAt: Date,
  errorMessage?: string | null
) {
  const failureMessage = errorMessage?.slice(0, 500) || null;
  switch (status) {
    case 'SENT':
      return {
        outbox: {
          status,
          sentAt: occurredAt,
          lockedAt: null,
          lastError: null,
        },
        conversation: {
          deliveryStatus: status,
          errorMessage: null,
        },
        whatsapp: { status },
      } as const;
    case 'DELIVERED':
      return {
        outbox: {
          status,
          deliveredAt: occurredAt,
          lockedAt: null,
          lastError: null,
        },
        conversation: {
          deliveryStatus: status,
          deliveredAt: occurredAt,
          errorMessage: null,
        },
        whatsapp: { status },
      } as const;
    case 'READ':
      return {
        outbox: {
          status,
          lockedAt: null,
          lastError: null,
        },
        conversation: {
          deliveryStatus: status,
          readAt: occurredAt,
          errorMessage: null,
        },
        whatsapp: { status },
      } as const;
    case 'FAILED':
      return {
        outbox: {
          status,
          failedAt: occurredAt,
          lockedAt: null,
          lastError: failureMessage,
        },
        conversation: {
          deliveryStatus: status,
          failedAt: occurredAt,
          errorMessage: failureMessage,
        },
        whatsapp: { status },
      } as const;
    case 'QUEUED':
      return {
        outbox: {
          status,
          lockedAt: null,
        },
        conversation: {
          deliveryStatus: status,
        },
        whatsapp: { status },
      } as const;
  }
}
