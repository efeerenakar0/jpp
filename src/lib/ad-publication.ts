export const adPublicationStatuses = [
  'DRAFT',
  'READY_TO_PUBLISH',
  'EXPORTED',
  'MANUALLY_CONFIRMED',
] as const;

export type AdPublicationStatus = (typeof adPublicationStatuses)[number];

const transitions: Record<AdPublicationStatus, readonly AdPublicationStatus[]> = {
  DRAFT: ['READY_TO_PUBLISH'],
  READY_TO_PUBLISH: ['DRAFT', 'EXPORTED'],
  EXPORTED: ['READY_TO_PUBLISH', 'MANUALLY_CONFIRMED'],
  MANUALLY_CONFIRMED: [],
};

export function canClaimManualPublication(evidence: {
  externalUrl: string | null;
  proofUrl: string | null;
}) {
  return Boolean(evidence.externalUrl?.trim() || evidence.proofUrl?.trim());
}

export function assertAdPublicationTransition(
  from: AdPublicationStatus,
  to: AdPublicationStatus,
  evidence: { externalUrl: string | null; proofUrl: string | null } = {
    externalUrl: null,
    proofUrl: null,
  }
) {
  if (from === to) return;
  if (!transitions[from].includes(to)) {
    throw new Error(`Geçersiz reklam yayın durumu geçişi: ${from} -> ${to}`);
  }
  if (to === 'MANUALLY_CONFIRMED' && !canClaimManualPublication(evidence)) {
    throw new Error('Manuel yayın doğrulaması için dış platform kanıtı gerekir.');
  }
}

export interface AdPublisherAdapter {
  readonly provider: string;
  readonly configured: boolean;
  publish(input: { campaignId: string }): Promise<{ externalId: string }>;
}

export const unconfiguredAdPublisherAdapter: AdPublisherAdapter = {
  provider: 'UNCONFIGURED',
  configured: false,
  async publish() {
    throw new Error('Resmî reklam yayın sağlayıcısı yapılandırılmamış.');
  },
};
