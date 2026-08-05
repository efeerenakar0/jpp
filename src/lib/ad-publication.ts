export const adPublicationStatuses = [
  'DRAFT',
  'READY_TO_PUBLISH',
  'EXPORTED',
  'MANUALLY_CONFIRMED',
] as const;

export type AdPublicationStatus = (typeof adPublicationStatuses)[number];

export type AdPublicationCopy = {
  approved: boolean;
  platform: string;
  headline: string;
  body: string;
  callToAction: string | null;
  targetUrl: string | null;
};

export type AdPublicationCampaign = {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  audience: string | null;
  posterHeadline: string | null;
  posterSubline: string | null;
  posterCta: string | null;
  property: {
    id: string;
    title: string;
    referenceCode: string | null;
    location: string | null;
    price: number | null;
  } | null;
  adCopies: AdPublicationCopy[];
};

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
  return [evidence.externalUrl, evidence.proofUrl].some((value) => {
    if (!value?.trim()) return false;
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  });
}

export function assertCampaignReadyForPublication(input: {
  posterHeadline: string | null;
  adCopies: AdPublicationCopy[];
}) {
  if (!input.posterHeadline?.trim()) {
    throw new Error('Yayın paketi için önce kampanya posteri hazırlanmalıdır.');
  }
  if (input.adCopies.length === 0) {
    throw new Error('Yayın paketi için en az bir kanal metni gerekir.');
  }
  if (input.adCopies.some((copy) => !copy.approved)) {
    throw new Error('Yayın paketinden önce bütün kanal metinlerini onaylayın.');
  }
}

function campaignSlug(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'kampanya';
}

export function buildAdExportPackage(
  campaign: AdPublicationCampaign,
  now: Date = new Date(),
) {
  assertCampaignReadyForPublication(campaign);
  const slug = campaignSlug(campaign.name);
  const approvedCopies = campaign.adCopies.filter((copy) => copy.approved);

  return {
    version: 1,
    generatedAt: now.toISOString(),
    publicationClaim: 'NOT_PUBLISHED' as const,
    notice:
      'Bu paket dış reklam platformunda otomatik yayın yapmaz. Yayın, platformda manuel olarak tamamlanıp kanıt bağlantısı girilince doğrulanır.',
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      objective: campaign.objective,
      audience: campaign.audience,
    },
    property: campaign.property,
    poster: {
      headline: campaign.posterHeadline,
      subline: campaign.posterSubline,
      callToAction: campaign.posterCta,
    },
    assets: {
      squarePosterUrl: `/api/fabrika/marketing/poster/${campaign.id}?format=square&download=1`,
      storyPosterUrl: `/api/fabrika/marketing/poster/${campaign.id}?format=story&download=1`,
    },
    channels: approvedCopies.map((copy) => ({
      platform: copy.platform,
      headline: copy.headline,
      body: copy.body,
      callToAction: copy.callToAction,
      targetUrl: copy.targetUrl,
    })),
    audienceNotes: campaign.audience || 'Hedef kitleyi dış platformda doğrulayın.',
    budget: {
      currency: 'TRY',
      suggestedDaily: null,
      suggestedTotal: null,
      note:
        'Bütçe, hedef bölge ve güncel platform maliyetleri görülmeden otomatik belirlenmez.',
    },
    schedule: {
      timezone: 'Europe/Istanbul',
      startAt: null,
      endAt: null,
      note: 'Başlangıç ve bitiş tarihini yayın platformunda kontrol edin.',
    },
    utm: {
      source: 'business-ceo-ai',
      medium: 'campaign',
      campaign: slug,
    },
    checklist: [
      'Posterlerdeki fiyat, konum ve portföy bilgilerini son kez doğrulayın.',
      'Her kanal metnini ilgili platformun güncel karakter ve reklam kurallarına göre kontrol edin.',
      'Landing URL ve UTM parametrelerini dış platformda ekleyin.',
      'Bütçe, hedef kitle ve tarih aralığını manuel olarak onaylayın.',
      'Yayın sonrasında dış platform URL’sini veya ekran kanıtını Business CEO AI içine kaydedin.',
    ],
  };
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
