export const websiteDeliveryStatuses = [
  'SUBMITTED',
  'IN_PROGRESS',
  'READY_FOR_QA',
  'CHANGES_REQUESTED',
  'APPROVED',
  'DELIVERED',
  'FAILED',
] as const;

export type WebsiteDeliveryStatus =
  (typeof websiteDeliveryStatuses)[number];

export const websiteDeliveryTransitions: Record<
  WebsiteDeliveryStatus,
  readonly WebsiteDeliveryStatus[]
> = {
  SUBMITTED: ['IN_PROGRESS', 'FAILED'],
  IN_PROGRESS: ['READY_FOR_QA', 'FAILED'],
  READY_FOR_QA: ['CHANGES_REQUESTED', 'APPROVED', 'FAILED'],
  CHANGES_REQUESTED: ['IN_PROGRESS', 'FAILED'],
  APPROVED: ['DELIVERED', 'CHANGES_REQUESTED', 'FAILED'],
  DELIVERED: [],
  FAILED: ['IN_PROGRESS'],
};

export function assertWebsiteDeliveryTransition(
  from: WebsiteDeliveryStatus,
  to: WebsiteDeliveryStatus
) {
  if (from === to) return;
  if (!websiteDeliveryTransitions[from].includes(to)) {
    throw new Error(`Geçersiz site teslim durumu geçişi: ${from} -> ${to}`);
  }
}

export function canCustomerAccessWebsiteDelivery(
  status: WebsiteDeliveryStatus
) {
  return status === 'APPROVED' || status === 'DELIVERED';
}

export function canAdminUploadWebsiteResult(status: WebsiteDeliveryStatus) {
  return (
    status === 'IN_PROGRESS' ||
    status === 'CHANGES_REQUESTED' ||
    status === 'FAILED'
  );
}
