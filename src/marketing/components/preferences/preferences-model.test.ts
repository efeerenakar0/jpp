import { describe, expect, it } from "vitest";

import {
  DEFAULT_MARKETING_PREFERENCES,
  MARKETING_PREFERENCES_STORAGE_KEY,
  getAlternateLocalePath,
  hasCompletedConsentChoice,
  inferLocaleFromPath,
  isTurkishBrowserContext,
  parseMarketingPreferences,
  readMarketingPreferences,
  shouldSuggestTurkish,
  withLanguagePreference,
  withOptionalConsent,
  writeMarketingPreferences,
  type PreferenceStorage,
} from "./preferences-model";

function createMemoryStorage(initialValue: string | null = null): PreferenceStorage & {
  readonly values: Map<string, string>;
} {
  const values = new Map<string, string>();

  if (initialValue !== null) {
    values.set(MARKETING_PREFERENCES_STORAGE_KEY, initialValue);
  }

  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("marketing preference persistence", () => {
  it("fails closed when no valid versioned state exists", () => {
    expect(parseMarketingPreferences(null)).toBe(DEFAULT_MARKETING_PREFERENCES);
    expect(parseMarketingPreferences("not-json")).toBe(
      DEFAULT_MARKETING_PREFERENCES,
    );
    expect(parseMarketingPreferences('{"version":2}')).toBe(
      DEFAULT_MARKETING_PREFERENCES,
    );
    expect(DEFAULT_MARKETING_PREFERENCES.consent).toEqual({
      necessary: "granted",
      analytics: "unset",
      marketing: "unset",
    });
  });

  it("never trusts a persisted attempt to disable necessary storage", () => {
    const parsed = parseMarketingPreferences(
      JSON.stringify({
        version: 1,
        consent: {
          necessary: "denied",
          analytics: "granted",
          marketing: "denied",
        },
        language: { dismissed: false, preferredLocale: null },
      }),
    );

    expect(parsed.consent).toEqual({
      necessary: "granted",
      analytics: "granted",
      marketing: "denied",
    });
  });

  it("stores separate analytics and marketing choices with the schema version", () => {
    const storage = createMemoryStorage();
    const next = withOptionalConsent(DEFAULT_MARKETING_PREFERENCES, {
      analytics: true,
      marketing: false,
    });

    expect(writeMarketingPreferences(storage, next)).toBe(true);
    expect(readMarketingPreferences(storage)).toEqual(next);
    expect(
      JSON.parse(storage.values.get(MARKETING_PREFERENCES_STORAGE_KEY) ?? "{}"),
    ).toMatchObject({
      version: 1,
      consent: {
        necessary: "granted",
        analytics: "granted",
        marketing: "denied",
      },
    });
    expect(hasCompletedConsentChoice(next.consent)).toBe(true);
  });

  it("remains fail-closed if browser storage throws", () => {
    const unavailableStorage: PreferenceStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };

    expect(readMarketingPreferences(unavailableStorage)).toBe(
      DEFAULT_MARKETING_PREFERENCES,
    );
    expect(
      writeMarketingPreferences(
        unavailableStorage,
        DEFAULT_MARKETING_PREFERENCES,
      ),
    ).toBe(false);
  });
});
describe("Turkish language suggestion", () => {
  it("recognizes either a Turkish browser language or Istanbul time zone", () => {
    expect(isTurkishBrowserContext(["tr-TR", "en-US"], "UTC")).toBe(true);
    expect(isTurkishBrowserContext(["en-US"], "Europe/Istanbul")).toBe(true);
    expect(isTurkishBrowserContext(["en-US"], "Europe/London")).toBe(false);
  });

  it("only suggests Turkish on English pages and remembers dismissal", () => {
    const context = {
      currentLocale: "en" as const,
      navigatorLanguages: ["tr-TR"],
      timeZone: "Europe/Istanbul",
      languagePreference: DEFAULT_MARKETING_PREFERENCES.language,
    };

    expect(shouldSuggestTurkish(context)).toBe(true);
    expect(
      shouldSuggestTurkish({ ...context, currentLocale: "tr" }),
    ).toBe(false);

    const dismissed = withLanguagePreference(
      DEFAULT_MARKETING_PREFERENCES,
      "en",
    );
    expect(
      shouldSuggestTurkish({
        ...context,
        languagePreference: dismissed.language,
      }),
    ).toBe(false);
  });
});

describe("safe alternate locale paths", () => {
  it("maps home and nested routes in both directions", () => {
    expect(getAlternateLocalePath("/", "tr")).toBe("/tr");
    expect(getAlternateLocalePath("/realestate", "tr")).toBe(
      "/tr/realestate",
    );
    expect(getAlternateLocalePath("/tr", "en")).toBe("/");
    expect(getAlternateLocalePath("/tr/realestate", "en")).toBe(
      "/realestate",
    );
  });

  it("preserves query and hash fragments", () => {
    expect(
      getAlternateLocalePath("/realestate?source=home#trial", "tr"),
    ).toBe("/tr/realestate?source=home#trial");
  });

  it("rejects absolute, protocol-relative, and backslash destinations", () => {
    expect(getAlternateLocalePath("https://example.com", "tr")).toBeNull();
    expect(getAlternateLocalePath("//example.com/path", "tr")).toBeNull();
    expect(getAlternateLocalePath("/\\example.com/path", "tr")).toBeNull();
  });

  it("infers locale only from the exact Turkish route segment", () => {
    expect(inferLocaleFromPath("/tr")).toBe("tr");
    expect(inferLocaleFromPath("/tr/contact")).toBe("tr");
    expect(inferLocaleFromPath("/travel")).toBe("en");
  });
});
