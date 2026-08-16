import {
  integrationUnavailable,
  type IntegrationFailureResult,
  type IntegrationUnavailableReason,
  type IntegrationUnavailableResult,
  type MarketingLocale,
} from "./shared";

export interface TrialInput {
  readonly companyName: string;
  readonly workEmail: string;
  readonly phoneOrWhatsApp: string;
  readonly locale: MarketingLocale;
  readonly plan: "office";
  readonly termsAccepted: true;
  readonly privacyNoticeAccepted: true;
}

export interface TrialStartedResult {
  readonly status: "started";
  readonly trialId: string;
  readonly startsAt: string;
  readonly endsAt: string;
}

export interface TrialIneligibleResult {
  readonly status: "ineligible";
  readonly reason:
    | "already_used"
    | "company_verification_failed"
    | "abuse_suspected";
}

export interface TrialValidationErrorResult {
  readonly status: "validation_error";
  readonly fieldErrors: Readonly<Partial<Record<keyof TrialInput, string>>>;
}

export type TrialResult =
  | TrialStartedResult
  | TrialIneligibleResult
  | TrialValidationErrorResult
  | IntegrationUnavailableResult
  | IntegrationFailureResult;

export interface TrialProvider {
  startTrial(input: Readonly<TrialInput>): Promise<TrialResult>;
}

export function createUnavailableTrialProvider(
  reason: IntegrationUnavailableReason = "not_configured",
): TrialProvider {
  return Object.freeze({
    startTrial: async () => integrationUnavailable("trial", reason),
  });
}

/**
 * Safe standalone default. It never creates an account or reports a successful
 * trial while the real trial backend is absent.
 */
export const unavailableTrialProvider = createUnavailableTrialProvider();
