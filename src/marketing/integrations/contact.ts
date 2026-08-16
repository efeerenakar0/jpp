import {
  integrationUnavailable,
  type BusinessSector,
  type ContactIntent,
  type IntegrationFailureResult,
  type IntegrationUnavailableReason,
  type IntegrationUnavailableResult,
  type MarketingLocale,
} from "./shared";

export type TeamSize = "1" | "2_10" | "11_50" | "51_200" | "201_plus";

export interface ContactInput {
  readonly name: string;
  readonly workEmail: string;
  readonly phoneOrWhatsApp: string;
  readonly company: string;
  readonly sector: BusinessSector;
  readonly teamSize: TeamSize;
  readonly message: string;
  readonly intent: ContactIntent;
  readonly locale: MarketingLocale;
  readonly privacyNoticeAccepted: true;
  readonly marketingConsent: boolean;
}

export interface ContactAcceptedResult {
  readonly status: "accepted";
  readonly submissionId: string;
}

export interface ContactValidationErrorResult {
  readonly status: "validation_error";
  readonly fieldErrors: Readonly<Partial<Record<keyof ContactInput, string>>>;
}

export interface ContactRejectedResult {
  readonly status: "rejected";
  readonly reason: "rate_limited" | "spam_suspected";
  readonly retryAfterSeconds?: number;
}

export type ContactResult =
  | ContactAcceptedResult
  | ContactValidationErrorResult
  | ContactRejectedResult
  | IntegrationUnavailableResult
  | IntegrationFailureResult;

export interface ContactProvider {
  submit(input: Readonly<ContactInput>): Promise<ContactResult>;
}

export function createUnavailableContactProvider(
  reason: IntegrationUnavailableReason = "not_configured",
): ContactProvider {
  return Object.freeze({
    submit: async () => integrationUnavailable("contact", reason),
  });
}

/**
 * Safe standalone default. Form UIs can map the returned reason to localized
 * development copy without claiming that a message was delivered.
 */
export const unavailableContactProvider = createUnavailableContactProvider();
