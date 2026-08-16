import type {
  BusinessSector,
  MarketingLocale,
  TeamSize,
} from "@/marketing/integrations";
import type { PageMetadataContent } from "@/marketing/types";

export const CONTACT_ADAPTER_INTENTS = [
  "real_estate",
  "enterprise_sales",
  "book_demo",
  "founding_partner",
] as const;

export type ContactAdapterIntent = (typeof CONTACT_ADAPTER_INTENTS)[number];

export interface ContactRouteContext {
  readonly intent: ContactAdapterIntent;
  readonly sector: BusinessSector;
  readonly plan?: "office" | "enterprise";
}

export interface ContactValidationMessages {
  readonly nameRequired: string;
  readonly nameTooLong: string;
  readonly emailInvalid: string;
  readonly emailTooLong: string;
  readonly phoneInvalid: string;
  readonly phoneTooLong: string;
  readonly companyRequired: string;
  readonly companyTooLong: string;
  readonly sectorRequired: string;
  readonly teamSizeRequired: string;
  readonly messageRequired: string;
  readonly messageTooLong: string;
  readonly privacyRequired: string;
}

export interface ContactContent {
  readonly locale: MarketingLocale;
  readonly metadata: PageMetadataContent;
  readonly routeLabel: string;
  readonly hero: Readonly<
    Record<
      ContactAdapterIntent,
      {
        readonly title: string;
        readonly description: string;
        readonly contextLabel: string;
      }
    >
  >;
  readonly introduction: {
    readonly title: string;
    readonly description: string;
    readonly responseNote: string;
    readonly emailLabel: string;
  };
  readonly process: readonly {
    readonly title: string;
    readonly description: string;
  }[];
  readonly provider: {
    readonly statusLabel: string;
    readonly readyTitle: string;
    readonly readyDescription: string;
    readonly submittedUnavailableTitle: string;
    readonly submittedUnavailableDescription: string;
    readonly genericErrorTitle: string;
    readonly genericErrorDescription: string;
    readonly acceptedTitle: string;
    readonly acceptedDescription: string;
  };
  readonly form: {
    readonly title: string;
    readonly description: string;
    readonly requiredLabel: string;
    readonly optionalLabel: string;
    readonly selectPlaceholder: string;
    readonly nameLabel: string;
    readonly namePlaceholder: string;
    readonly workEmailLabel: string;
    readonly workEmailPlaceholder: string;
    readonly phoneLabel: string;
    readonly phonePlaceholder: string;
    readonly companyLabel: string;
    readonly companyPlaceholder: string;
    readonly sectorLabel: string;
    readonly teamSizeLabel: string;
    readonly messageLabel: string;
    readonly messagePlaceholder: string;
    readonly privacyPrefix: string;
    readonly privacyLinkLabel: string;
    readonly privacySuffix: string;
    readonly privacyHref: string;
    readonly consentGroupLabel: string;
    readonly marketingConsentLabel: string;
    readonly submitLabels: Readonly<Record<ContactAdapterIntent, string>>;
    readonly submittingLabel: string;
    readonly summaryTitle: string;
    readonly summaryDescription: string;
    readonly directEmailLabel: string;
    readonly noAccountNotice: string;
    readonly characterLimitLabel: string;
  };
  readonly sectors: readonly {
    readonly value: BusinessSector;
    readonly label: string;
  }[];
  readonly teamSizes: readonly {
    readonly value: TeamSize;
    readonly label: string;
  }[];
  readonly validation: ContactValidationMessages;
}
