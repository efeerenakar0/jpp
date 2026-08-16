import type {
  BusinessSector,
  ContactIntent,
} from "@/marketing/integrations";

import type { ContactAdapterIntent, ContactRouteContext } from "./types";

export type ContactQueryValue = string | readonly string[] | undefined;

const QUERY_INTENT_MAP: Readonly<Record<string, ContactAdapterIntent>> = Object.freeze({
  "real-estate": "real_estate",
  trial: "real_estate",
  sales: "enterprise_sales",
  demo: "book_demo",
  "founding-partner": "founding_partner",
  real_estate: "real_estate",
  enterprise_sales: "enterprise_sales",
  book_demo: "book_demo",
  founding_partner: "founding_partner",
});

const QUERY_SECTOR_MAP: Readonly<Record<string, BusinessSector>> = Object.freeze({
  "real-estate": "real_estate",
  real_estate: "real_estate",
  hospitality: "hospitality",
  restaurants: "restaurants",
  wholesale: "wholesale",
  construction: "construction",
  other: "other",
});

function readFirstQueryValue(value: ContactQueryValue): string | undefined {
  const firstValue = Array.isArray(value) ? value[0] : value;

  return firstValue?.trim().toLowerCase() || undefined;
}

function readMappedIntent(value: ContactQueryValue): ContactAdapterIntent | undefined {
  const queryValue = readFirstQueryValue(value);

  return queryValue ? QUERY_INTENT_MAP[queryValue] : undefined;
}

export function normalizeContactIntent(value: ContactQueryValue): ContactAdapterIntent {
  return readMappedIntent(value) ?? "book_demo";
}

export function normalizeContactSector(value: ContactQueryValue): BusinessSector {
  const queryValue = readFirstQueryValue(value);

  return queryValue ? (QUERY_SECTOR_MAP[queryValue] ?? "other") : "other";
}

export function normalizeContactContext(
  query: Readonly<Record<string, ContactQueryValue>>,
): ContactRouteContext {
  const sector = normalizeContactSector(query.sector);
  const explicitIntent = readMappedIntent(query.intent);
  const intent = explicitIntent ?? (sector === "real_estate" ? "real_estate" : "book_demo");
  const planValue = readFirstQueryValue(query.plan);
  const plan = planValue === "office" || planValue === "enterprise" ? planValue : undefined;

  return {
    intent,
    sector: intent === "real_estate" ? "real_estate" : sector,
    ...(plan ? { plan } : {}),
  };
}

/**
 * The standalone contact UI preserves its richer conversion intent separately.
 * The current provider contract identifies Real Estate requests through sector +
 * book_demo until the backend adapter gains a dedicated Real Estate intent.
 */
export function toProviderContactIntent(intent: ContactAdapterIntent): ContactIntent {
  const providerIntentMap = {
    real_estate: "book_demo",
    enterprise_sales: "enterprise_sales",
    book_demo: "book_demo",
    founding_partner: "founding_partner",
  } as const satisfies Readonly<Record<ContactAdapterIntent, ContactIntent>>;

  return providerIntentMap[intent];
}
