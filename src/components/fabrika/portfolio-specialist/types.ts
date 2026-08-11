export type HuntingStatus = 'YELLOW' | 'AUTHORIZED' | 'GREEN' | 'RED';

export type HuntingListing = {
  id: string;
  title: string;
  price?: string | null;
  location?: string | null;
  ownerName?: string | null;
  sourceUrl: string;
  sourceProvider?: string | null;
  acquisitionStatus?: string | null;
  completenessScore?: number;
  createdAt?: string;
  lastSeenAt?: string;
  updatedAt?: string;
  status: HuntingStatus;
  authorizationNote?: string | null;
  eliminationReason?: string | null;
  eliminationSummary?: string | null;
  portfolioImport?: {
    id: string;
    status: string;
    propertyId: string | null;
    reviewNote: string | null;
    property?: {
      id: string;
      status: PropertyStatus;
      assignedMember: { id: string; name: string } | null;
    } | null;
  } | null;
  contacts?: Array<{
    verificationStatus: string;
    legalBasisStatus: string;
    doNotContactAt: string | null;
    policyDecisions: Array<{
      allowed: boolean;
      reasonCodes: string[];
      evaluatedAt: string;
    }>;
  }>;
};

export type PropertyStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'RESERVED'
  | 'SOLD'
  | 'RENTED'
  | 'ARCHIVED';

export type WorkspaceProperty = {
  id: string;
  title: string;
  referenceCode: string | null;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  status: PropertyStatus;
  imageUrl: string | null;
  assignedMember: { id: string; name: string } | null;
  updatedAt?: string;
};

export type WorkspaceTask = {
  id: string;
  dueAt: string | null;
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  property: { id: string; title: string } | null;
};

export type WorkspacePayload = {
  properties: WorkspaceProperty[];
  tasks: WorkspaceTask[];
};

export type PortfolioFilter =
  | 'all'
  | 'negotiation'
  | 'authorized'
  | 'joined'
  | 'eliminated'
  | 'published';

export type PortfolioRow = {
  key: string;
  title: string;
  location: string | null;
  price: string | null;
  imageUrl: string | null;
  listing: HuntingListing | null;
  property: WorkspaceProperty | null;
  stage: HuntingStatus | 'PORTFOLIO';
  assignedMember: { id: string; name: string } | null;
  nextActionAt: string | null;
  updatedAt: string | null;
};
