export type AuthorizedPoolShareStatus =
  | 'ACTIVE'
  | 'PAUSED'
  | 'EXPIRED'
  | 'REVOKED';

export type AuthorizedPoolPropertyStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'RESERVED'
  | 'SOLD'
  | 'RENTED'
  | 'ARCHIVED';

export type AuthorizedPoolEligibilityReason =
  | 'SHARE_NOT_ACTIVE'
  | 'SHARING_PERMISSION_MISSING'
  | 'AUTHORITY_NOT_VERIFIED'
  | 'AUTHORITY_EXPIRED'
  | 'PROPERTY_NOT_PUBLISHABLE';

export type AuthorizedPoolEligibilityInput = {
  shareStatus: AuthorizedPoolShareStatus;
  sharePermissionGrantedAt: Date | null;
  authorityDocumentVerifiedAt: Date | null;
  authorityExpiresAt: Date | null;
  propertyStatus: AuthorizedPoolPropertyStatus;
};

export function authorizedPoolEligibility(
  input: AuthorizedPoolEligibilityInput,
  now: Date
): { eligible: boolean; reason: AuthorizedPoolEligibilityReason | null } {
  if (input.shareStatus !== 'ACTIVE') {
    return { eligible: false, reason: 'SHARE_NOT_ACTIVE' };
  }
  if (!input.sharePermissionGrantedAt) {
    return { eligible: false, reason: 'SHARING_PERMISSION_MISSING' };
  }
  if (!input.authorityDocumentVerifiedAt) {
    return { eligible: false, reason: 'AUTHORITY_NOT_VERIFIED' };
  }
  if (!input.authorityExpiresAt || input.authorityExpiresAt <= now) {
    return { eligible: false, reason: 'AUTHORITY_EXPIRED' };
  }
  if (!['ACTIVE', 'RESERVED'].includes(input.propertyStatus)) {
    return { eligible: false, reason: 'PROPERTY_NOT_PUBLISHABLE' };
  }
  return { eligible: true, reason: null };
}

type AuthorizedPoolListingInput = {
  id: string;
  propertyId: string;
  ownerCompanyId: string;
  ownerCompanyName: string;
  title: string;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  propertyType: string | null;
  imageUrl: string | null;
  authorityExpiresAt: Date;
  ownerPhone?: string | null;
  ownerDocumentUrl?: string | null;
  privateNotes?: string | null;
};

export function sanitizeAuthorizedPoolListing(input: AuthorizedPoolListingInput) {
  return {
    id: input.id,
    propertyId: input.propertyId,
    ownerCompanyName: input.ownerCompanyName,
    title: input.title,
    location: input.location,
    price: input.price,
    roomCount: input.roomCount,
    area: input.area,
    propertyType: input.propertyType,
    imageUrl: input.imageUrl,
    authorityExpiresAt: input.authorityExpiresAt.toISOString(),
  };
}
