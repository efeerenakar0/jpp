export const SOURCE_PROVIDERS = ['SAHIBINDEN', 'FIXTURE'] as const;
export type SourceProvider = (typeof SOURCE_PROVIDERS)[number];

export const SOURCE_SCOPES = [
  'SEARCH_READ',
  'DETAIL_READ',
  'MEDIA_READ',
  'MEDIA_COPY',
  'CONTACT_READ',
] as const;
export type SourceScope = (typeof SOURCE_SCOPES)[number];

export const ADDRESS_PRECISIONS = [
  'CITY',
  'DISTRICT',
  'NEIGHBORHOOD',
  'STREET',
  'EXACT',
  'UNKNOWN',
] as const;
export type AddressPrecision = (typeof ADDRESS_PRECISIONS)[number];

export const CONTACT_SUBJECT_ROLES = [
  'OWNER',
  'AUTHORIZED_REPRESENTATIVE',
  'AGENT',
  'UNKNOWN',
] as const;
export type ContactSubjectRole = (typeof CONTACT_SUBJECT_ROLES)[number];

export const CONTACT_SOURCE_TYPES = [
  'PARTNER_FEED',
  'BANA_EMLAKCI_BUL',
  'FIRST_PARTY_FORM',
  'EXISTING_CRM',
  'MANUAL_VERIFIED',
  'AUTHORIZED_SOURCE',
  'LEGACY_UNVERIFIED',
] as const;
export type ContactSourceType = (typeof CONTACT_SOURCE_TYPES)[number];

export const CONTACT_VERIFICATION_STATUSES = [
  'UNVERIFIED',
  'OTP_VERIFIED',
  'PARTNER_VERIFIED',
  'MANUALLY_VERIFIED',
  'REJECTED',
] as const;
export type ContactVerificationStatus =
  (typeof CONTACT_VERIFICATION_STATUSES)[number];

export const CONTACT_CONSENT_STATUSES = [
  'UNKNOWN',
  'GRANTED',
  'REJECTED',
  'REVOKED',
  'EXPIRED',
] as const;
export type ContactConsentStatus =
  (typeof CONTACT_CONSENT_STATUSES)[number];

export const CONTACT_CHANNELS = [
  'VOICE',
  'WHATSAPP',
  'SMS',
  'EMAIL',
] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export type ParsedSearchListing = {
  sourceListingId: string;
  sourceUrl: string;
  title: string;
  priceText: string | null;
  locationText: string | null;
};

export type ParsedSearchPage = {
  listings: ParsedSearchListing[];
  nextPageUrl: string | null;
  reportedTotal: number | null;
};

export type ParsedListingImage = {
  order: number;
  sourceUrl: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
};

export type ParsedListingDetail = {
  sourceListingId: string;
  sourceUrl: string;
  title: string;
  priceText: string | null;
  priceAmount: number | null;
  currency: string | null;
  listingPublishedAt: Date | null;
  category: string | null;
  subcategory: string | null;
  sellerType: string | null;
  sellerName: string | null;
  phones: string[];
  descriptionText: string | null;
  sanitizedDescriptionHtml: string | null;
  province: string | null;
  district: string | null;
  neighborhood: string | null;
  street: string | null;
  latitude: number | null;
  longitude: number | null;
  addressPrecision: AddressPrecision;
  attributes: Record<string, string>;
  images: ParsedListingImage[];
  completenessScore: number;
};
