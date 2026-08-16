export { MarketingPreferences } from "./marketing-preferences";
export type { MarketingPreferencesProps } from "./marketing-preferences";
export {
  DEFAULT_MARKETING_PREFERENCES,
  MARKETING_PREFERENCES_CHANGED_EVENT,
  MARKETING_PREFERENCES_STORAGE_KEY,
  MARKETING_PREFERENCES_STORAGE_VERSION,
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
} from "./preferences-model";
export type {
  LanguagePreferenceState,
  MarketingPreferencesEventDetail,
  MarketingPreferencesState,
  PreferenceStorage,
  TurkishSuggestionContext,
} from "./preferences-model";
