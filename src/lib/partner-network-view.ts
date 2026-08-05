export type PartnerQueueTab = 'candidates' | 'approval' | 'pipeline' | 'active';

export type PartnerQueueRecord = {
  stage: string;
  contacts: Array<{
    active: boolean;
    verificationStatus: string;
  }>;
};

const CANDIDATE_STAGES = new Set(['DISCOVERED', 'QUALIFIED']);
const PIPELINE_STAGES = new Set(['CONTACTED', 'ENGAGED', 'MEETING', 'REVIEW', 'AGREEMENT']);

export function hasPendingContactVerification(partner: PartnerQueueRecord) {
  return partner.contacts.some(
    (contact) => contact.active && contact.verificationStatus === 'UNVERIFIED',
  );
}

export function getPartnerQueue(partner: PartnerQueueRecord): PartnerQueueTab | null {
  if (partner.stage === 'ACTIVE') return 'active';
  if (hasPendingContactVerification(partner)) return 'approval';
  if (CANDIDATE_STAGES.has(partner.stage)) return 'candidates';
  if (PIPELINE_STAGES.has(partner.stage)) return 'pipeline';
  return null;
}

export function filterPartnersForQueue<T extends PartnerQueueRecord>(
  partners: T[],
  tab: PartnerQueueTab,
) {
  return partners.filter((partner) => getPartnerQueue(partner) === tab);
}

export function getPartnerQueueMetrics(partners: PartnerQueueRecord[]) {
  return partners.reduce(
    (metrics, partner) => {
      const queue = getPartnerQueue(partner);
      if (queue) metrics[queue] += 1;
      return metrics;
    },
    { candidates: 0, approval: 0, pipeline: 0, active: 0 },
  );
}

export function getPartnerIdFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const value = searchParams.partner;
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(normalized) ? normalized : null;
}
