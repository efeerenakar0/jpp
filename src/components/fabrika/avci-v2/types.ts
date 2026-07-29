export type HuntJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED'
  | 'CANCELLED'
  | 'SOURCE_CHALLENGE';

export type HuntJobSummary = {
  id: string;
  provider: 'SAHIBINDEN' | 'FIXTURE';
  searchUrl: string;
  status: HuntJobStatus;
  totalDiscovered: number;
  totalCompleted: number;
  totalPartial: number;
  totalFailed: number;
  errorSummary: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContactPolicySummary = {
  allowed: boolean;
  reasonCodes: string[];
  evaluatedAt: string;
};

export type HuntingContactSummary = {
  id: string;
  maskedPhone: string;
  subjectRole?: string;
  sourceType: string;
  purpose?: string;
  sourcePurposeAllowed?: boolean | null;
  verificationStatus: string;
  legalBasisStatus?: string;
  retentionUntil?: string | null;
  quarantinedAt?: string | null;
  quarantineReason?: string | null;
  doNotContactAt: string | null;
  consents?: Array<{
    status: string;
    iysStatus: string | null;
    updatedAt: string;
  }>;
  approvals?: Array<{
    approvedAt: string;
    revokedAt: string | null;
  }>;
  policyDecisions: ContactPolicySummary[];
};

export type HuntingListingSummary = {
  id: string;
  huntJobId: string | null;
  sourceProvider: 'SAHIBINDEN' | 'FIXTURE' | null;
  sourceListingId: string | null;
  title: string;
  price: string | null;
  priceAmount: string | number | null;
  currency: string | null;
  province: string | null;
  district: string | null;
  neighborhood: string | null;
  addressPrecision: string;
  acquisitionStatus: string;
  completenessScore: number;
  imageUrl: string | null;
  lastSeenAt: string;
  images: Array<{ sourceUrl: string; storageKey: string | null }>;
  contacts: HuntingContactSummary[];
};

export type HuntingListingDetail = Omit<
  HuntingListingSummary,
  'images' | 'contacts'
> & {
  sourceUrl: string;
  listingPublishedAt: string | null;
  category: string | null;
  subcategory: string | null;
  sellerType: string | null;
  descriptionText: string | null;
  sanitizedDescriptionHtml: string | null;
  street: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  attributesJson: Record<string, unknown> | null;
  firstSeenAt: string;
  removedAt: string | null;
  images: Array<{
    id: string;
    order: number;
    sourceUrl: string;
    storageKey: string | null;
    checksum: string | null;
    mimeType: string | null;
    width: number | null;
    height: number | null;
    byteSize: number | null;
  }>;
  contacts: HuntingContactSummary[];
};

export type HuntingListingsResponse = {
  items: HuntingListingSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
