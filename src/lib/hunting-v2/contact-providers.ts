import { z } from 'zod';
import {
  CONTACT_SUBJECT_ROLES,
  type ContactSourceType,
  type ContactVerificationStatus,
} from './types';

export const CONTACT_PROVIDER_NAMES = [
  'PARTNER_FEED',
  'BANA_EMLAKCI_BUL',
  'FIRST_PARTY_FORM',
  'MANUAL_VERIFIED',
  'EXISTING_CRM',
] as const;

export type ContactProviderName = (typeof CONTACT_PROVIDER_NAMES)[number];

export const contactProviderImportSchema = z
  .object({
    listingId: z.string().min(1).max(160),
    phone: z.string().min(10).max(32),
    subjectRole: z.enum(CONTACT_SUBJECT_ROLES),
    purpose: z.literal('SALES_AUTHORITY_DISCUSSION'),
    sourceReference: z.string().min(3).max(500),
    sourcePurposeAllowed: z.boolean(),
    legalBasisStatus: z.enum([
      'UNKNOWN',
      'CONFIRMED',
      'REJECTED',
      'EXPIRED',
    ]),
    retentionUntil: z.string().datetime(),
    verificationEvidence: z.string().min(3).max(1000),
  })
  .strict();

export type ContactProviderImport = z.infer<
  typeof contactProviderImportSchema
>;

export type ResolvedContact = ContactProviderImport & {
  sourceType: Exclude<ContactSourceType, 'LEGACY_UNVERIFIED'>;
  verificationStatus: ContactVerificationStatus;
  verificationMethod: string;
  verifiedAt: Date;
};

export class ContactProviderError extends Error {
  constructor(
    public readonly code:
      | 'PROVIDER_DISABLED'
      | 'INVALID_PAYLOAD'
      | 'EVIDENCE_REQUIRED',
    message: string
  ) {
    super(message);
    this.name = 'ContactProviderError';
  }
}

export interface ContactProvider {
  readonly name: ContactProviderName;
  readonly enabled: boolean;
  resolve(payload: unknown): Promise<ResolvedContact>;
}

function parsePayload(payload: unknown) {
  const parsed = contactProviderImportSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ContactProviderError(
      'INVALID_PAYLOAD',
      'ContactProvider verisi doğrulanamadı.'
    );
  }
  return parsed.data;
}

abstract class CredentialContactProvider implements ContactProvider {
  abstract readonly name: ContactProviderName;
  abstract readonly sourceType: ResolvedContact['sourceType'];
  protected abstract readonly method: string;

  constructor(private readonly credential?: string) {}

  get enabled() {
    return Boolean(this.credential);
  }

  async resolve(payload: unknown): Promise<ResolvedContact> {
    if (!this.enabled) {
      throw new ContactProviderError(
        'PROVIDER_DISABLED',
        `${this.name} sağlayıcısı yapılandırılmamış.`
      );
    }
    const data = parsePayload(payload);
    return {
      ...data,
      sourceType: this.sourceType,
      verificationStatus: 'PARTNER_VERIFIED',
      verificationMethod: this.method,
      verifiedAt: new Date(),
    };
  }
}

export class PartnerFeedContactProvider extends CredentialContactProvider {
  readonly name = 'PARTNER_FEED' as const;
  readonly sourceType = 'PARTNER_FEED' as const;
  protected readonly method = 'partner-signed-feed';
}

export class BanaEmlakciBulContactProvider extends CredentialContactProvider {
  readonly name = 'BANA_EMLAKCI_BUL' as const;
  readonly sourceType = 'BANA_EMLAKCI_BUL' as const;
  protected readonly method = 'provider-authorized-lead';
}

export class FirstPartyOptInContactProvider extends CredentialContactProvider {
  readonly name = 'FIRST_PARTY_FORM' as const;
  readonly sourceType = 'FIRST_PARTY_FORM' as const;
  protected readonly method = 'first-party-opt-in';
}

export class ExistingCrmContactProvider extends CredentialContactProvider {
  readonly name = 'EXISTING_CRM' as const;
  readonly sourceType = 'EXISTING_CRM' as const;
  protected readonly method = 'existing-crm-evidence';
}

export class ManualVerifiedContactProvider implements ContactProvider {
  readonly name = 'MANUAL_VERIFIED' as const;
  readonly enabled = true;

  async resolve(payload: unknown): Promise<ResolvedContact> {
    const data = parsePayload(payload);
    if (!data.verificationEvidence.trim()) {
      throw new ContactProviderError(
        'EVIDENCE_REQUIRED',
        'Manuel doğrulama kanıtı gerekli.'
      );
    }
    return {
      ...data,
      sourceType: 'MANUAL_VERIFIED',
      verificationStatus: 'MANUALLY_VERIFIED',
      verificationMethod: 'human-evidence',
      verifiedAt: new Date(),
    };
  }
}

export function getContactProvider(name: ContactProviderName): ContactProvider {
  switch (name) {
    case 'PARTNER_FEED':
      return new PartnerFeedContactProvider(
        process.env.HUNTING_PARTNER_FEED_TOKEN
      );
    case 'BANA_EMLAKCI_BUL':
      return new BanaEmlakciBulContactProvider(
        process.env.HUNTING_BANA_EMLAKCI_BUL_TOKEN
      );
    case 'FIRST_PARTY_FORM':
      return new FirstPartyOptInContactProvider(
        process.env.HUNTING_FIRST_PARTY_SIGNING_SECRET
      );
    case 'EXISTING_CRM':
      return new ExistingCrmContactProvider(
        process.env.HUNTING_CRM_PROVIDER_SECRET
      );
    case 'MANUAL_VERIFIED':
      return new ManualVerifiedContactProvider();
    default:
      throw new ContactProviderError(
        'PROVIDER_DISABLED',
        'ContactProvider desteklenmiyor.'
      );
  }
}
