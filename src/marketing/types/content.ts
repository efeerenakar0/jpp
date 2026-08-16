export const SUPPORTED_LOCALES = ["en", "tr"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type LocalizedContentMap<T> = Readonly<Record<Locale, T>>;

export type AnalyticsEventName =
  | "language_suggestion_shown"
  | "language_switched"
  | "primary_cta_clicked"
  | "realestate_explored"
  | "sector_contact_started"
  | "contact_submitted"
  | "trial_started"
  | "login_clicked"
  | "pricing_plan_selected"
  | "video_started"
  | "video_completed";

export type ActionKind = "primary" | "secondary" | "tertiary" | "text";

export interface ContentAction {
  readonly label: string;
  readonly href: string;
  readonly kind: ActionKind;
  readonly analyticsEvent?: AnalyticsEventName;
}

export interface PageMetadataContent {
  readonly title: string;
  readonly description: string;
  readonly canonicalPath: string;
}

export interface NavigationContent {
  readonly locale: Locale;
  readonly brandName: "Business CEO AI";
  readonly brandDescriptor: string;
  readonly homeLabel: string;
  readonly mainMenuLabel: string;
  readonly mobileMenuLabel: string;
  readonly openMenuLabel: string;
  readonly closeMenuLabel: string;
  readonly skipToContentLabel: string;
  readonly language: {
    readonly shortLabel: string;
    readonly destinationLabel: string;
    readonly href: string;
  };
  readonly items: readonly {
    readonly id: "platform" | "real-estate" | "industries" | "how-it-works" | "pricing" | "about";
    readonly label: string;
    readonly href: string;
  }[];
  readonly signIn: ContentAction;
  readonly startTrial: ContentAction;
  readonly legalLabel: string;
  readonly legalLinks: readonly {
    readonly id: "privacy" | "terms" | "contact";
    readonly label: string;
    readonly href: string;
  }[];
}

export type MetricId = "response-speed" | "portfolio-opportunities";

export interface ProofMetricContent {
  readonly id: MetricId;
  readonly value: string;
  readonly statement: string;
  readonly context: string;
  readonly evidenceBasis: "typical-product-behavior" | "internal-real-estate-operation";
}

export interface OwnershipContent {
  readonly statement: string;
  readonly developerName: "NexFrame AI";
  readonly collaboratorName: "KatEXtrema AI";
  readonly nexFrameLinkedIn: "https://www.linkedin.com/company/139593914";
  readonly founderLinkedIn: "https://www.linkedin.com/in/efeerenakar0";
  readonly founderTitle: "Co-Founder & CTO at NexFrame AI and Business CEO AI";
}

export interface TrustVariantContent {
  readonly id: "anonymous" | "named";
  readonly isDefault: boolean;
  readonly statement: string;
  readonly organizations: readonly string[];
}

export interface OperationalStepContent {
  readonly id: "listen" | "understand" | "coordinate" | "act" | "report";
  readonly label: string;
  readonly description: string;
}

export interface HomeFlagshipCapabilityContent {
  readonly id:
    | "whatsapp-operations"
    | "portfolio-hunter"
    | "general-manager"
    | "human-handoff";
  readonly title: string;
  readonly description: string;
  readonly signalLabel: string;
}

export interface HomeContent {
  readonly locale: Locale;
  readonly metadata: PageMetadataContent;
  readonly brand: {
    readonly name: "Business CEO AI";
    readonly category: "AI Business Operating System";
    readonly tagline: string;
  };
  readonly presentation: {
    readonly productStatusLabel: string;
    readonly systemFigureLabel: string;
    readonly systemModelLabel: string;
    readonly humanInLoopLabel: string;
    readonly coreLabel: string;
    readonly coreStatus: string;
    readonly signalNodes: readonly [
      { readonly stage: string; readonly label: string },
      { readonly stage: string; readonly label: string },
      { readonly stage: string; readonly label: string },
      { readonly stage: string; readonly label: string },
      { readonly stage: string; readonly label: string },
    ];
    readonly readout: readonly [string, string, string];
    readonly heroIndexLabel: string;
    readonly heroAudienceLabel: string;
    readonly manifestoFlow: readonly [string, string, string, string];
    readonly workforceMapLabel: string;
    readonly tailoredOperationsLabel: string;
    readonly founderLinkLabel: string;
  };
  readonly hero: {
    readonly eyebrow: "AI Business Operating System";
    readonly title: string;
    readonly supportingCopy: string;
    readonly actions: readonly ContentAction[];
  };
  readonly manifesto: {
    readonly eyebrow: string;
    readonly title: string;
    readonly body: string;
  };
  readonly operationalLoop: {
    readonly eyebrow: string;
    readonly title: string;
    readonly introduction: string;
    readonly steps: readonly OperationalStepContent[];
  };
  readonly flagship: {
    readonly eyebrow: string;
    readonly title: "Business CEO AI for Real Estate";
    readonly description: string;
    readonly capabilities: readonly HomeFlagshipCapabilityContent[];
    readonly actions: readonly ContentAction[];
  };
  readonly proof: {
    readonly eyebrow: string;
    readonly title: string;
    readonly disclaimer: string;
    readonly metrics: readonly ProofMetricContent[];
  };
  readonly workforce: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly roles: readonly {
      readonly id: "customer" | "ai-operations" | "team-member" | "owner";
      readonly label: string;
      readonly description: string;
    }[];
  };
  readonly industriesPreview: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly flagshipLabel: string;
    readonly developmentLabel: string;
  };
  readonly ownership: OwnershipContent;
  readonly pricingPreview: {
    readonly eyebrow: string;
    readonly title: string;
    readonly office: {
      readonly name: "Office";
      readonly price: "₺11.350";
      readonly cadence: string;
      readonly note: "Türkiye launch pricing" | "Türkiye lansman fiyatı";
    };
    readonly enterprise: {
      readonly name: "Enterprise";
      readonly priceLabel: string;
    };
    readonly trialLabel: string;
    readonly noCardLabel: string;
    readonly action: ContentAction;
  };
  readonly trust: {
    readonly eyebrow: string;
    readonly title: string;
    readonly selectedVariant: "anonymous";
    readonly variants: readonly TrustVariantContent[];
  };
  readonly finalCta: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly actions: readonly ContentAction[];
  };
}

export interface RealEstateHeroHeadlineAlternative {
  readonly id: "coordinated-action" | "owner-visibility";
  readonly title: string;
  readonly rationale: string;
}

export interface ProductFlowStepContent {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface ProductFilmContent {
  readonly id: "whatsapp-operations" | "portfolio-hunter";
  readonly title: string;
  readonly description: string;
  readonly durationLabel: string;
  readonly captionsRequired: true;
}

export interface SecurityPrincipleContent {
  readonly id:
    | "raw-message-deletion"
    | "structured-crm-retention"
    | "account-closure"
    | "no-model-training"
    | "tenant-isolation"
    | "encryption-in-transit"
    | "encryption-at-rest";
  readonly title: string;
  readonly description: string;
}

export interface RealEstateContent {
  readonly locale: Locale;
  readonly metadata: PageMetadataContent;
  readonly hero: {
    readonly eyebrow: "Business CEO AI for Real Estate";
    readonly selectedHeadlineId: "coordinated-action";
    readonly headlineAlternatives: readonly [
      RealEstateHeroHeadlineAlternative,
      RealEstateHeroHeadlineAlternative,
    ];
    readonly supportingCopy: string;
    readonly actions: readonly ContentAction[];
    readonly noCardLabel: string;
    readonly proofSummary: string;
  };
  readonly problemSequence: {
    readonly eyebrow: string;
    readonly title: string;
    readonly introduction: string;
    readonly stages: readonly {
      readonly id: "late-message" | "lost-customer" | "untracked-appointment" | "portfolio-gap" | "visibility-gap";
      readonly label: string;
    }[];
    readonly transition: string;
  };
  readonly whatsappOperations: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly approvedDescriptor: string;
    readonly aiDisclosure: string;
    readonly flow: readonly ProductFlowStepContent[];
    readonly capabilities: readonly string[];
  };
  readonly portfolioHunter: {
    readonly eyebrow: string;
    readonly title: "Portfolio Hunter";
    readonly description: string;
    readonly scopeNote: string;
    readonly flow: readonly ProductFlowStepContent[];
    readonly capabilities: readonly string[];
  };
  readonly generalManager: {
    readonly eyebrow: string;
    readonly title: "AI General Manager";
    readonly description: string;
    readonly capabilities: readonly string[];
    readonly exampleOwnerQuestion: string;
  };
  readonly humanHandoff: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly steps: readonly string[];
  };
  readonly proof: {
    readonly eyebrow: string;
    readonly title: string;
    readonly disclaimer: string;
    readonly metrics: readonly ProofMetricContent[];
    readonly internationalTestingStatement: string;
  };
  readonly productFilms: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly films: readonly ProductFilmContent[];
  };
  readonly security: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly principles: readonly SecurityPrincipleContent[];
    readonly certificationNote: string;
  };
  readonly pricingReference: {
    readonly title: string;
    readonly description: string;
    readonly officePrice: "₺11.350";
    readonly cadence: string;
    readonly enterpriseLabel: string;
    readonly action: ContentAction;
  };
  readonly finalCta: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly actions: readonly ContentAction[];
  };
}

export type IndustryId =
  | "real-estate"
  | "restaurants"
  | "hospitality"
  | "construction"
  | "wholesale";

export type IndustryStatus = "flagship" | "in-active-development";

interface IndustryEntryBase {
  readonly id: IndustryId;
  readonly name: string;
  readonly route: string;
  readonly roadmapPriority: 1 | 2 | 3 | 4 | 5;
  readonly eyebrow: string;
  readonly headline: string;
  readonly summary: string;
  readonly operationalProblems: readonly string[];
  readonly actions: readonly ContentAction[];
}

export interface FlagshipIndustryEntry extends IndustryEntryBase {
  readonly id: "real-estate";
  readonly status: "flagship";
  readonly statusLabel: string;
  readonly roadmapPriority: 1;
  readonly proof: string;
}

export interface DevelopingIndustryEntry extends IndustryEntryBase {
  readonly id: Exclude<IndustryId, "real-estate">;
  readonly status: "in-active-development";
  readonly statusLabel: string;
  readonly roadmapPriority: 2 | 3 | 4 | 5;
  readonly futureOperatingModel: {
    readonly title: string;
    readonly description: string;
    readonly plannedOutcomes: readonly string[];
  };
  readonly contactPreset: {
    readonly sector: Exclude<IndustryId, "real-estate">;
    readonly primaryIntent: "founding-partner";
  };
}

export type IndustryEntry = FlagshipIndustryEntry | DevelopingIndustryEntry;

export interface IndustriesContent {
  readonly locale: Locale;
  readonly metadata: PageMetadataContent;
  readonly hero: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
  };
  readonly statusLabels: Readonly<Record<IndustryStatus, string>>;
  readonly developmentDisclaimer: string;
  readonly sectors: readonly IndustryEntry[];
}

export interface ApprovedMonthlyPriceContent {
  readonly currency: "TRY";
  readonly amount: 11350;
  readonly formatted: "₺11.350";
  readonly display: string;
  readonly cadence: "month";
  readonly cadenceLabel: string;
  readonly note: "Türkiye launch pricing" | "Türkiye lansman fiyatı";
  readonly pendingApproval: false;
  readonly isPublic: true;
}

export interface PendingPricingOptionContent {
  readonly id: "office-six-month" | "office-twelve-month";
  readonly durationMonths: 6 | 12;
  readonly currency: "TRY";
  readonly proposedTotal: 61290 | 108960;
  readonly formatted: "₺61.290" | "₺108.960";
  readonly pendingApproval: true;
  readonly isPublic: false;
  readonly internalLabel: string;
  readonly refundPolicy: string;
}

export interface OfficePricingPlanContent {
  readonly id: "office";
  readonly name: "Office";
  readonly audience: string;
  readonly description: string;
  readonly price: ApprovedMonthlyPriceContent;
  readonly features: readonly string[];
  readonly supportResponse: string;
  readonly action: ContentAction;
}

export interface EnterprisePricingPlanContent {
  readonly id: "enterprise";
  readonly name: "Enterprise";
  readonly audience: string;
  readonly description: string;
  readonly priceLabel: string;
  readonly features: readonly string[];
  readonly supportResponse: string;
  readonly action: ContentAction;
}

export interface PricingContent {
  readonly locale: Locale;
  readonly metadata: PageMetadataContent;
  readonly hero: {
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
  };
  readonly trial: {
    readonly durationDays: 14;
    readonly title: string;
    readonly description: string;
    readonly noCardRequired: true;
    readonly noCardLabel: string;
    readonly includes: string;
    readonly afterTrialWithoutPayment: string;
  };
  readonly plans: readonly [OfficePricingPlanContent, EnterprisePricingPlanContent];
  readonly pendingOptions: readonly PendingPricingOptionContent[];
  readonly disclosure: string;
}

export type FaqAudience = "general" | "real-estate";

export interface FaqItemContent {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
}

export interface FaqGroupContent {
  readonly id: FaqAudience;
  readonly title: string;
  readonly description: string;
  readonly items: readonly FaqItemContent[];
}

export interface FaqContent {
  readonly locale: Locale;
  readonly metadata: PageMetadataContent;
  readonly eyebrow: string;
  readonly title: string;
  readonly introduction: string;
  readonly groups: readonly FaqGroupContent[];
  readonly contactPrompt: {
    readonly text: string;
    readonly action: ContentAction;
  };
}

export interface LocaleContentBundle {
  readonly home: HomeContent;
  readonly realEstate: RealEstateContent;
  readonly industries: IndustriesContent;
  readonly pricing: PricingContent;
  readonly faq: FaqContent;
}
