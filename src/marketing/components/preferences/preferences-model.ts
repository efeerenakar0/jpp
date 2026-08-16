import type {
  ConsentState,
  OptionalConsentDecision,
} from "../../analytics";
import { DEFAULT_CONSENT_STATE } from "../../analytics";
import type { MarketingLocale } from "../../integrations/shared";

export const MARKETING_PREFERENCES_STORAGE_VERSION = 1 as const;
export const MARKETING_PREFERENCES_STORAGE_KEY =
  "business-ceo-ai:marketing-preferences:v1";
export const MARKETING_PREFERENCES_CHANGED_EVENT =
  "business-ceo-ai:marketing-preferences-changed";

export interface LanguagePreferenceState {
  readonly dismissed: boolean;
  readonly preferredLocale: MarketingLocale | null;
}

export interface MarketingPreferencesState {
  readonly version: typeof MARKETING_PREFERENCES_STORAGE_VERSION;
  readonly consent: Readonly<ConsentState>;
  readonly language: Readonly<LanguagePreferenceState>;
}

export interface MarketingPreferencesEventDetail {
  readonly version: typeof MARKETING_PREFERENCES_STORAGE_VERSION;
  readonly consent: Readonly<ConsentState>;
  readonly preferredLocale: MarketingLocale | null;
}

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_MARKETING_PREFERENCES: Readonly<MarketingPreferencesState> =
  Object.freeze({
    version: MARKETING_PREFERENCES_STORAGE_VERSION,
    consent: DEFAULT_CONSENT_STATE,
    language: Object.freeze({
      dismissed: false,
      preferredLocale: null,
    }),
  });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalConsentDecision(
  value: unknown,
): value is OptionalConsentDecision {
  return value === "granted" || value === "denied" || value === "unset";
}

function isMarketingLocale(value: unknown): value is MarketingLocale {
  return value === "en" || value === "tr";
}

function normalizeConsent(value: unknown): Readonly<ConsentState> {
  if (!isRecord(value)) {
    return DEFAULT_CONSENT_STATE;
  }

  return Object.freeze({
    // Necessary storage is never user-disableable or trusted from persisted data.
    necessary: "granted" as const,
    analytics: isOptionalConsentDecision(value.analytics)
      ? value.analytics
      : "unset",
    marketing: isOptionalConsentDecision(value.marketing)
      ? value.marketing
      : "unset",
  });
}

function normalizeLanguagePreference(
  value: unknown,
): Readonly<LanguagePreferenceState> {
  if (!isRecord(value)) {
    return DEFAULT_MARKETING_PREFERENCES.language;
  }

  return Object.freeze({
    dismissed: value.dismissed === true,
    preferredLocale: isMarketingLocale(value.preferredLocale)
      ? value.preferredLocale
      : null,
  });
}

export function parseMarketingPreferences(
  rawValue: string | null,
): Readonly<MarketingPreferencesState> {
  if (!rawValue) {
    return DEFAULT_MARKETING_PREFERENCES;
  }

  try {
    const candidate: unknown = JSON.parse(rawValue);

    if (
      !isRecord(candidate) ||
      candidate.version !== MARKETING_PREFERENCES_STORAGE_VERSION
    ) {
      return DEFAULT_MARKETING_PREFERENCES;
    }

    return Object.freeze({
      version: MARKETING_PREFERENCES_STORAGE_VERSION,
      consent: normalizeConsent(candidate.consent),
      language: normalizeLanguagePreference(candidate.language),
    });
  } catch {
    return DEFAULT_MARKETING_PREFERENCES;
  }
}

export function readMarketingPreferences(
  storage: PreferenceStorage,
): Readonly<MarketingPreferencesState> {
  try {
    return parseMarketingPreferences(
      storage.getItem(MARKETING_PREFERENCES_STORAGE_KEY),
    );
  } catch {
    // Storage can be unavailable in privacy modes. Optional consent fails closed.
    return DEFAULT_MARKETING_PREFERENCES;
  }
}

export function writeMarketingPreferences(
  storage: PreferenceStorage,
  preferences: Readonly<MarketingPreferencesState>,
): boolean {
  const normalized = Object.freeze({
    version: MARKETING_PREFERENCES_STORAGE_VERSION,
    consent: normalizeConsent(preferences.consent),
    language: normalizeLanguagePreference(preferences.language),
  });

  try {
    storage.setItem(
      MARKETING_PREFERENCES_STORAGE_KEY,
      JSON.stringify(normalized),
    );
    return true;
  } catch {
    return false;
  }
}

export function hasCompletedConsentChoice(
  consent: Readonly<ConsentState>,
): boolean {
  return consent.analytics !== "unset" && consent.marketing !== "unset";
}

export function withOptionalConsent(
  preferences: Readonly<MarketingPreferencesState>,
  optionalConsent: Readonly<{
    analytics: boolean;
    marketing: boolean;
  }>,
): Readonly<MarketingPreferencesState> {
  return Object.freeze({
    ...preferences,
    version: MARKETING_PREFERENCES_STORAGE_VERSION,
    consent: Object.freeze({
      necessary: "granted" as const,
      analytics: optionalConsent.analytics ? "granted" : "denied",
      marketing: optionalConsent.marketing ? "granted" : "denied",
    }),
  });
}

export function withLanguagePreference(
  preferences: Readonly<MarketingPreferencesState>,
  preferredLocale: MarketingLocale,
): Readonly<MarketingPreferencesState> {
  return Object.freeze({
    ...preferences,
    version: MARKETING_PREFERENCES_STORAGE_VERSION,
    language: Object.freeze({
      dismissed: true,
      preferredLocale,
    }),
  });
}

export function inferLocaleFromPath(pathname: string): MarketingLocale {
  return pathname === "/tr" || pathname.startsWith("/tr/") ? "tr" : "en";
}

export function isTurkishBrowserContext(
  navigatorLanguages: readonly string[],
  timeZone: string | null | undefined,
): boolean {
  const hasTurkishLanguage = navigatorLanguages.some((language) => {
    const primarySubtag = language.trim().toLowerCase().split(/[-_]/u)[0];
    return primarySubtag === "tr";
  });

  return (
    hasTurkishLanguage ||
    timeZone?.trim().toLowerCase() === "europe/istanbul"
  );
}

export interface TurkishSuggestionContext {
  readonly currentLocale: MarketingLocale;
  readonly navigatorLanguages: readonly string[];
  readonly timeZone?: string | null;
  readonly languagePreference: Readonly<LanguagePreferenceState>;
}

export function shouldSuggestTurkish(
  context: Readonly<TurkishSuggestionContext>,
): boolean {
  if (context.currentLocale !== "en") {
    return false;
  }

  if (
    context.languagePreference.dismissed ||
    context.languagePreference.preferredLocale !== null
  ) {
    return false;
  }

  return isTurkishBrowserContext(
    context.navigatorLanguages,
    context.timeZone,
  );
}

/**
 * Maps an internal marketing URL to its alternate locale without accepting an
 * absolute or protocol-relative destination. Search parameters and hashes are
 * preserved, while locale-prefix changes remain same-origin by construction.
 */
export function getAlternateLocalePath(
  currentPath: string,
  targetLocale: MarketingLocale,
): string | null {
  if (
    !currentPath.startsWith("/") ||
    currentPath.startsWith("//") ||
    currentPath.includes("\\") ||
    currentPath.includes("\0")
  ) {
    return null;
  }

  try {
    const parsed = new URL(currentPath, "https://business-ceo-ai.local");

    if (parsed.origin !== "https://business-ceo-ai.local") {
      return null;
    }

    const { pathname, search, hash } = parsed;
    const isTurkishPath = pathname === "/tr" || pathname.startsWith("/tr/");
    let alternatePathname = pathname;

    if (targetLocale === "tr" && !isTurkishPath) {
      alternatePathname = pathname === "/" ? "/tr" : `/tr${pathname}`;
    }

    if (targetLocale === "en" && isTurkishPath) {
      alternatePathname = pathname === "/tr" ? "/" : pathname.slice(3);
    }

    return `${alternatePathname}${search}${hash}`;
  } catch {
    return null;
  }
}
