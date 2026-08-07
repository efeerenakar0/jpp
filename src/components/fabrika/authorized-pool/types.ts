export type PoolRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type PoolShareStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'REVOKED';

export type AuthorizedPoolListing = {
  id: string;
  propertyId: string;
  ownerCompanyName: string;
  title: string;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  propertyType: string | null;
  imageUrl: string | null;
  authorityExpiresAt: string;
  isOwn: boolean;
  request: {
    id: string;
    status: PoolRequestStatus;
    createdAt: string;
  } | null;
};

export type OwnedPoolShare = {
  id: string;
  status: PoolShareStatus;
  authorityExpiresAt: string;
  property: {
    id: string;
    title: string;
    referenceCode: string;
    status: string;
    authorityExpiresAt: string | null;
  };
  requestCount: number;
};

export type IncomingPoolRequest = {
  id: string;
  status: PoolRequestStatus;
  message: string | null;
  decisionNote: string | null;
  createdAt: string;
  requesterCompanyName: string;
  property: { id: string; title: string };
};

export type AvailablePoolProperty = {
  id: string;
  title: string;
  referenceCode: string;
  location: string | null;
  authorityExpiresAt: string | null;
  share: { id: string; status: PoolShareStatus } | null;
};

export type AuthorizedPoolPayload = {
  listings: AuthorizedPoolListing[];
  management: {
    ownedShares: OwnedPoolShare[];
    incomingRequests: IncomingPoolRequest[];
    availableProperties?: AvailablePoolProperty[];
  };
};

export type PoolFilters = {
  query: string;
  location: string;
  roomCount: string;
  propertyType: string;
  minPrice: string;
  maxPrice: string;
};

export const EMPTY_POOL_FILTERS: PoolFilters = {
  query: '',
  location: '',
  roomCount: '',
  propertyType: '',
  minPrice: '',
  maxPrice: '',
};
