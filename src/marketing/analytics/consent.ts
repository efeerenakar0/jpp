export type OptionalConsentDecision = "granted" | "denied" | "unset";

export interface ConsentState {
  readonly necessary: "granted";
  readonly analytics: OptionalConsentDecision;
  readonly marketing: OptionalConsentDecision;
}

export type ConsentReader = () => Readonly<ConsentState>;

export const DEFAULT_CONSENT_STATE: Readonly<ConsentState> = Object.freeze({
  necessary: "granted",
  analytics: "unset",
  marketing: "unset",
});

export function hasAnalyticsConsent(
  consent: Readonly<ConsentState>,
): boolean {
  return consent.analytics === "granted";
}
