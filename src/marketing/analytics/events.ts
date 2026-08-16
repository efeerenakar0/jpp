import type {
  BusinessSector,
  ContactIntent,
  MarketingLocale,
} from "../integrations/shared";

export type AnalyticsSurface =
  | "navigation"
  | "hero"
  | "platform"
  | "real_estate"
  | "industries"
  | "pricing"
  | "contact"
  | "final_cta"
  | "footer"
  | "video";

export type PrimaryCta =
  | "start_free_trial"
  | "book_demo"
  | "become_founding_partner"
  | "contact_sales";

export type ProductVideo =
  | "business_ceo_hero"
  | "whatsapp_operations"
  | "portfolio_hunter";

/**
 * This is the analytics allow-list. Keep values categorical and non-identifying:
 * email, phone, company, form copy, chat content, free text, and user IDs do not
 * belong in this map.
 */
export interface AnalyticsEventProperties {
  readonly language_suggestion_shown: {
    readonly suggestedLocale: "tr";
    readonly placement: "language_banner";
  };
  readonly language_switched: {
    readonly fromLocale: MarketingLocale;
    readonly toLocale: MarketingLocale;
    readonly source: "navigation" | "language_banner";
  };
  readonly primary_cta_clicked: {
    readonly cta: PrimaryCta;
    readonly surface: AnalyticsSurface;
    readonly locale: MarketingLocale;
  };
  readonly realestate_explored: {
    readonly surface: AnalyticsSurface;
    readonly locale: MarketingLocale;
  };
  readonly sector_contact_started: {
    readonly sector: BusinessSector;
    readonly intent: "book_demo" | "founding_partner";
    readonly locale: MarketingLocale;
  };
  readonly contact_submitted: {
    readonly sector: BusinessSector;
    readonly intent: ContactIntent;
    readonly locale: MarketingLocale;
  };
  readonly trial_started: {
    readonly plan: "office";
    readonly surface: AnalyticsSurface;
    readonly locale: MarketingLocale;
  };
  readonly login_clicked: {
    readonly destination: "real_estate";
    readonly surface: AnalyticsSurface;
    readonly locale: MarketingLocale;
  };
  readonly pricing_plan_selected: {
    readonly plan: "office" | "enterprise";
    readonly billingPeriod:
      | "monthly"
      | "six_months"
      | "twelve_months"
      | "contact_sales";
    readonly locale: MarketingLocale;
  };
  readonly video_started: {
    readonly video: ProductVideo;
    readonly surface: AnalyticsSurface;
    readonly locale: MarketingLocale;
  };
  readonly video_completed: {
    readonly video: ProductVideo;
    readonly surface: AnalyticsSurface;
    readonly locale: MarketingLocale;
  };
}

export const ANALYTICS_EVENT_NAMES = [
  "language_suggestion_shown",
  "language_switched",
  "primary_cta_clicked",
  "realestate_explored",
  "sector_contact_started",
  "contact_submitted",
  "trial_started",
  "login_clicked",
  "pricing_plan_selected",
  "video_started",
  "video_completed",
] as const satisfies readonly (keyof AnalyticsEventProperties)[];

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const ANALYTICS_EVENT_PROPERTY_KEYS = {
  language_suggestion_shown: ["suggestedLocale", "placement"],
  language_switched: ["fromLocale", "toLocale", "source"],
  primary_cta_clicked: ["cta", "surface", "locale"],
  realestate_explored: ["surface", "locale"],
  sector_contact_started: ["sector", "intent", "locale"],
  contact_submitted: ["sector", "intent", "locale"],
  trial_started: ["plan", "surface", "locale"],
  login_clicked: ["destination", "surface", "locale"],
  pricing_plan_selected: ["plan", "billingPeriod", "locale"],
  video_started: ["video", "surface", "locale"],
  video_completed: ["video", "surface", "locale"],
} as const satisfies {
  readonly [Name in AnalyticsEventName]: readonly (
    keyof AnalyticsEventProperties[Name]
  )[];
};

/**
 * Copies only allow-listed keys. This runtime boundary prevents accidental extra
 * properties from reaching a provider even if an untyped caller bypasses the
 * compile-time event contract.
 */
export function sanitizeAnalyticsProperties<Name extends AnalyticsEventName>(
  name: Name,
  properties: Readonly<AnalyticsEventProperties[Name]>,
): Readonly<AnalyticsEventProperties[Name]> {
  const keys = ANALYTICS_EVENT_PROPERTY_KEYS[name] as unknown as readonly (
    keyof AnalyticsEventProperties[Name]
  )[];
  const entries = keys.map((key) => [key, properties[key]] as const);

  return Object.freeze(
    Object.fromEntries(entries),
  ) as Readonly<AnalyticsEventProperties[Name]>;
}

export type AnalyticsEvent<
  Name extends AnalyticsEventName = AnalyticsEventName,
> = Name extends AnalyticsEventName
  ? Readonly<{
      name: Name;
      properties: Readonly<AnalyticsEventProperties[Name]>;
    }>
  : never;
