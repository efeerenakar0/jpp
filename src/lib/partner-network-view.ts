export type PartnerQueueTab = 'candidates' | 'approval' | 'pipeline' | 'active';

export type PartnerQueueRecord = {
  stage: string;
  contacts: Array<{
    active: boolean;
    verificationStatus: string;
  }>;
};

export type PartnerDirectoryRecord = PartnerQueueRecord & {
  displayName: string;
  countryCode: string;
  countryName: string;
  city: string | null;
  languages: string[];
  specialties: string[];
};

export type PartnerDirectoryFilters = {
  search: string;
  countryCode: string;
  city: string;
  language: string;
  specialty: string;
};

const PARTNER_STAGE_LABELS: Record<string, string> = {
  DISCOVERED: 'Keşfedildi',
  QUALIFIED: 'Nitelikli',
  CONTACTED: 'İletişim kuruldu',
  MEETING: 'Görüşme',
  REVIEW: 'İnceleme',
  AGREEMENT: 'Sözleşme',
  ACTIVE: 'Aktif',
  DISQUALIFIED: 'Uygun değil',
  NOT_INTERESTED: 'İlgilenmiyor',
  DO_NOT_CONTACT: 'İletişim kurma',
  ARCHIVED: 'Arşiv',
};

const PARTNER_MESSAGE_STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Kuyrukta',
  RETRY: 'Yeniden denenecek',
  PROCESSING: 'Hazırlanıyor',
  SENT: 'Gönderildi · yanıt durumu bilinmiyor',
  DELIVERED: 'Teslim edildi · yanıt durumu bilinmiyor',
  FAILED: 'Gönderilemedi',
  CANCELLED: 'Durduruldu',
};

export function getPartnerStageLabel(
  stage: string,
  { inboxSynchronized = false }: { inboxSynchronized?: boolean } = {},
) {
  if (stage === 'ENGAGED') {
    return inboxSynchronized ? 'Yanıt alındı' : 'Yanıt kaydedildi (manuel)';
  }
  return PARTNER_STAGE_LABELS[stage] || stage;
}

export function getPartnerMessageStatusLabel(status: string) {
  return PARTNER_MESSAGE_STATUS_LABELS[status] || status;
}

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

function normalizedDirectoryValue(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR');
}

export function filterPartnerDirectory<T extends PartnerDirectoryRecord>(
  partners: T[],
  filters: PartnerDirectoryFilters,
) {
  const search = normalizedDirectoryValue(filters.search);
  const city = normalizedDirectoryValue(filters.city);
  const language = normalizedDirectoryValue(filters.language);
  const specialty = normalizedDirectoryValue(filters.specialty);

  return partners.filter((partner) => {
    const searchable = normalizedDirectoryValue(
      [
        partner.displayName,
        partner.city || '',
        partner.countryName,
        ...partner.languages,
        ...partner.specialties,
      ].join(' '),
    );

    return (
      (!filters.countryCode || partner.countryCode === filters.countryCode) &&
      (!city || normalizedDirectoryValue(partner.city || '') === city) &&
      (!language || partner.languages.some((item) => normalizedDirectoryValue(item) === language)) &&
      (!specialty || partner.specialties.some((item) => normalizedDirectoryValue(item) === specialty)) &&
      (!search || searchable.includes(search))
    );
  });
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
