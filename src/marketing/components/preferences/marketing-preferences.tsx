"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  defaultAnalyticsAdapter,
  type AnalyticsAdapter,
} from "@/marketing/analytics";
import type { MarketingLocale } from "@/marketing/integrations/shared";

import { getPreferenceCopy } from "./preference-copy";
import {
  DEFAULT_MARKETING_PREFERENCES,
  MARKETING_PREFERENCES_CHANGED_EVENT,
  MARKETING_PREFERENCES_STORAGE_KEY,
  getAlternateLocalePath,
  hasCompletedConsentChoice,
  inferLocaleFromPath,
  readMarketingPreferences,
  shouldSuggestTurkish,
  withLanguagePreference,
  withOptionalConsent,
  writeMarketingPreferences,
  type MarketingPreferencesEventDetail,
  type MarketingPreferencesState,
} from "./preferences-model";

export interface MarketingPreferencesProps {
  readonly locale?: MarketingLocale;
  readonly pathname?: string;
  readonly analyticsAdapter?: AnalyticsAdapter;
}

interface RuntimeContext {
  readonly locale: MarketingLocale;
  readonly path: string;
  readonly navigatorLanguages: readonly string[];
  readonly timeZone: string | null;
}

function readTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function dispatchPreferencesChanged(
  preferences: Readonly<MarketingPreferencesState>,
): void {
  const detail: MarketingPreferencesEventDetail = Object.freeze({
    version: preferences.version,
    consent: preferences.consent,
    preferredLocale: preferences.language.preferredLocale,
  });

  window.dispatchEvent(
    new CustomEvent<MarketingPreferencesEventDetail>(
      MARKETING_PREFERENCES_CHANGED_EVENT,
      { detail },
    ),
  );
}

export function MarketingPreferences({
  locale,
  pathname,
  analyticsAdapter = defaultAnalyticsAdapter,
}: MarketingPreferencesProps) {
  const [preferences, setPreferences] = useState<
    Readonly<MarketingPreferencesState>
  >(DEFAULT_MARKETING_PREFERENCES);
  const [runtime, setRuntime] = useState<RuntimeContext | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [analyticsDraft, setAnalyticsDraft] = useState(false);
  const [marketingDraft, setMarketingDraft] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogOpenerRef = useRef<HTMLElement | null>(null);
  const firstDialogControlRef = useRef<HTMLInputElement>(null);
  const languagePrimaryRef = useRef<HTMLAnchorElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const languageShownTrackedRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    const browserPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const resolvedPath = pathname ?? browserPath;
    let routePathname = window.location.pathname;

    if (pathname) {
      try {
        routePathname = new URL(pathname, window.location.origin).pathname;
      } catch {
        routePathname = window.location.pathname;
      }
    }

    const routeLocale = inferLocaleFromPath(routePathname);

    // The root layout is intentionally static today. Keep the document language
    // accurate after mount so assistive technology receives the route locale.
    document.documentElement.lang = routeLocale;

    queueMicrotask(() => {
      if (disposed) {
        return;
      }

      setPreferences(readMarketingPreferences(window.localStorage));
      setRuntime({
        locale: locale ?? routeLocale,
        path: resolvedPath,
        navigatorLanguages:
          navigator.languages.length > 0
            ? Array.from(navigator.languages)
            : [navigator.language],
        timeZone: readTimeZone(),
      });
    });

    const syncStoredPreferences = (event: StorageEvent) => {
      if (
        event.storageArea === window.localStorage &&
        event.key === MARKETING_PREFERENCES_STORAGE_KEY
      ) {
        setPreferences(readMarketingPreferences(window.localStorage));
      }
    };

    window.addEventListener("storage", syncStoredPreferences);
    return () => {
      disposed = true;
      window.removeEventListener("storage", syncStoredPreferences);
    };
  }, [locale, pathname]);

  const copy = getPreferenceCopy(runtime?.locale ?? locale ?? "en");
  const needsConsentChoice = !hasCompletedConsentChoice(preferences.consent);
  const suggestTurkish = Boolean(
    runtime &&
      !needsConsentChoice &&
      shouldSuggestTurkish({
        currentLocale: runtime.locale,
        navigatorLanguages: runtime.navigatorLanguages,
        timeZone: runtime.timeZone,
        languagePreference: preferences.language,
      }),
  );
  const turkishPath = useMemo(
    () => (runtime ? getAlternateLocalePath(runtime.path, "tr") : null),
    [runtime],
  );
  const showLanguageSuggestion = suggestTurkish && turkishPath !== null;

  const persistPreferences = useCallback(
    (
      nextPreferences: Readonly<MarketingPreferencesState>,
      message: string,
    ) => {
      setPreferences(nextPreferences);
      writeMarketingPreferences(window.localStorage, nextPreferences);
      dispatchPreferencesChanged(nextPreferences);
      setAnnouncement(message);
    },
    [],
  );

  useEffect(() => {
    if (
      !showLanguageSuggestion ||
      preferences.consent.analytics !== "granted" ||
      languageShownTrackedRef.current
    ) {
      return;
    }

    languageShownTrackedRef.current = true;
    void analyticsAdapter.capture("language_suggestion_shown", {
      suggestedLocale: "tr",
      placement: "language_banner",
    });
  }, [
    analyticsAdapter,
    preferences.consent.analytics,
    showLanguageSuggestion,
  ]);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (manageOpen && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => firstDialogControlRef.current?.focus());
      return;
    }

    if (!manageOpen && dialog.open) {
      dialog.close();
    }
  }, [manageOpen]);

  const openManager = (
    event: ReactMouseEvent<HTMLButtonElement>,
  ): void => {
    dialogOpenerRef.current = event.currentTarget;
    setAnalyticsDraft(preferences.consent.analytics === "granted");
    setMarketingDraft(preferences.consent.marketing === "granted");
    setManageOpen(true);
  };

  const closeManager = (): void => {
    setManageOpen(false);
  };

  const focusAfterConsentChoice = (): void => {
    window.requestAnimationFrame(() => {
      (languagePrimaryRef.current ?? settingsButtonRef.current)?.focus();
    });
  };

  const handleDialogClosed = (): void => {
    setManageOpen(false);

    window.requestAnimationFrame(() => {
      if (dialogOpenerRef.current?.isConnected) {
        dialogOpenerRef.current.focus();
        return;
      }

      (languagePrimaryRef.current ?? settingsButtonRef.current)?.focus();
    });
  };

  const acceptAll = (): void => {
    persistPreferences(
      withOptionalConsent(preferences, {
        analytics: true,
        marketing: true,
      }),
      copy.consent.acceptedAnnouncement,
    );
    focusAfterConsentChoice();
  };

  const rejectOptional = (): void => {
    persistPreferences(
      withOptionalConsent(preferences, {
        analytics: false,
        marketing: false,
      }),
      copy.consent.rejectedAnnouncement,
    );
    focusAfterConsentChoice();
  };

  const saveManagedChoices = (): void => {
    persistPreferences(
      withOptionalConsent(preferences, {
        analytics: analyticsDraft,
        marketing: marketingDraft,
      }),
      copy.consent.savedAnnouncement,
    );
    closeManager();
  };

  const dismissLanguageSuggestion = (): void => {
    persistPreferences(
      withLanguagePreference(preferences, "en"),
      copy.language.dismissedAnnouncement,
    );
  };

  const chooseTurkish = (): void => {
    const nextPreferences = withLanguagePreference(preferences, "tr");
    persistPreferences(nextPreferences, copy.language.switchedAnnouncement);

    if (preferences.consent.analytics === "granted") {
      void analyticsAdapter.capture("language_switched", {
        fromLocale: "en",
        toLocale: "tr",
        source: "language_banner",
      });
    }
  };

  if (!runtime) {
    return null;
  }

  return (
    <div className="bceo-preferences" data-testid="marketing-preferences">
      <p className="bceo-preferences__announcer" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {needsConsentChoice ? (
        <aside
          className="bceo-preferences__rail bceo-preferences__rail--consent"
          aria-label={copy.consent.regionLabel}
        >
          <div className="bceo-preferences__rail-inner">
            <div className="bceo-preferences__message">
              <span className="bceo-preferences__index" aria-hidden="true">
                01
              </span>
              <div>
                <h2>{copy.consent.title}</h2>
                <p>{copy.consent.description}</p>
              </div>
            </div>
            <div className="bceo-preferences__actions" aria-label={copy.consent.regionLabel}>
              <button
                className="bceo-preferences__button bceo-preferences__button--accept"
                type="button"
                onClick={acceptAll}
              >
                {copy.consent.acceptAll}
              </button>
              <button
                className="bceo-preferences__button bceo-preferences__button--reject"
                type="button"
                onClick={rejectOptional}
              >
                {copy.consent.rejectOptional}
              </button>
              <button
                className="bceo-preferences__button bceo-preferences__button--text"
                type="button"
                onClick={openManager}
                aria-haspopup="dialog"
              >
                {copy.consent.manage}
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {showLanguageSuggestion ? (
        <aside
          className="bceo-preferences__rail bceo-preferences__rail--language"
          aria-label={copy.language.regionLabel}
          lang="tr"
        >
          <div className="bceo-preferences__rail-inner">
            <div className="bceo-preferences__message">
              <span className="bceo-preferences__language-mark" aria-hidden="true">
                TR
              </span>
              <div>
                <h2>{copy.language.title}</h2>
                <p>{copy.language.description}</p>
              </div>
            </div>
            <div className="bceo-preferences__actions">
              <a
                ref={languagePrimaryRef}
                className="bceo-preferences__button bceo-preferences__button--accept"
                href={turkishPath ?? "/tr"}
                onClick={chooseTurkish}
                hrefLang="tr"
              >
                {copy.language.continueInTurkish}
              </a>
              <button
                className="bceo-preferences__button bceo-preferences__button--reject"
                type="button"
                onClick={dismissLanguageSuggestion}
              >
                {copy.language.stayInEnglish}
              </button>
            </div>
          </div>
        </aside>
      ) : null}

      {!needsConsentChoice && !showLanguageSuggestion ? (
        <button
          ref={settingsButtonRef}
          className="bceo-preferences__settings"
          type="button"
          onClick={openManager}
          aria-haspopup="dialog"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
            <path d="M3.5 6.5h13M6.5 3.5v6M3.5 13.5h13M13.5 10.5v6" />
          </svg>
          <span>{copy.consent.settingsLabel}</span>
        </button>
      ) : null}

      <dialog
        className="bceo-preferences__dialog"
        ref={dialogRef}
        aria-labelledby="bceo-preferences-title"
        aria-describedby="bceo-preferences-description"
        onCancel={(event) => {
          event.preventDefault();
          closeManager();
        }}
        onClose={handleDialogClosed}
      >
        <div className="bceo-preferences__dialog-header">
          <div>
            <p className="bceo-preferences__dialog-kicker" aria-hidden="true">
              01 / 03
            </p>
            <h2 id="bceo-preferences-title">{copy.dialog.title}</h2>
          </div>
          <button
            className="bceo-preferences__dialog-close"
            type="button"
            onClick={closeManager}
            aria-label={copy.dialog.closeLabel}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
              <path d="m4.5 4.5 11 11m0-11-11 11" />
            </svg>
          </button>
        </div>

        <p id="bceo-preferences-description" className="bceo-preferences__dialog-description">
          {copy.dialog.description}
        </p>

        <fieldset className="bceo-preferences__categories">
          <legend className="bceo-preferences__sr-only">
            {copy.dialog.categoriesLegend}
          </legend>

          <label className="bceo-preferences__category bceo-preferences__category--locked">
            <input type="checkbox" role="switch" checked disabled readOnly />
            <span className="bceo-preferences__switch" aria-hidden="true" />
            <span className="bceo-preferences__category-copy">
              <strong>{copy.dialog.necessaryTitle}</strong>
              <small>{copy.dialog.necessaryDescription}</small>
            </span>
            <span className="bceo-preferences__category-state">
              {copy.dialog.alwaysActive}
            </span>
          </label>

          <label className="bceo-preferences__category">
            <input
              ref={firstDialogControlRef}
              type="checkbox"
              role="switch"
              checked={analyticsDraft}
              onChange={(event) => setAnalyticsDraft(event.target.checked)}
            />
            <span className="bceo-preferences__switch" aria-hidden="true" />
            <span className="bceo-preferences__category-copy">
              <strong>{copy.dialog.analyticsTitle}</strong>
              <small>{copy.dialog.analyticsDescription}</small>
            </span>
          </label>

          <label className="bceo-preferences__category">
            <input
              type="checkbox"
              role="switch"
              checked={marketingDraft}
              onChange={(event) => setMarketingDraft(event.target.checked)}
            />
            <span className="bceo-preferences__switch" aria-hidden="true" />
            <span className="bceo-preferences__category-copy">
              <strong>{copy.dialog.marketingTitle}</strong>
              <small>{copy.dialog.marketingDescription}</small>
            </span>
          </label>
        </fieldset>

        <div className="bceo-preferences__dialog-footer">
          <p>{copy.dialog.note}</p>
          <button
            className="bceo-preferences__button bceo-preferences__button--accept"
            type="button"
            onClick={saveManagedChoices}
          >
            {copy.dialog.save}
          </button>
        </div>
      </dialog>
    </div>
  );
}
