export type MarketingLocale = "en" | "tr";

export type BusinessSector =
  | "real_estate"
  | "hospitality"
  | "restaurants"
  | "wholesale"
  | "construction"
  | "other";

export type ContactIntent =
  | "general_contact"
  | "book_demo"
  | "founding_partner"
  | "enterprise_sales";

export type IntegrationName = "trial" | "login" | "payment" | "contact";

export type IntegrationUnavailableReason = "not_configured" | "disabled";

export interface IntegrationUnavailableResult {
  readonly status: "unavailable";
  readonly integration: IntegrationName;
  readonly reason: IntegrationUnavailableReason;
}

export type IntegrationFailureCode =
  | "network_error"
  | "provider_error"
  | "invalid_response"
  | "rate_limited";

export interface IntegrationFailureResult {
  readonly status: "error";
  readonly code: IntegrationFailureCode;
  readonly retryable: boolean;
  readonly requestId?: string;
}

export class IntegrationUnavailableError extends Error {
  readonly integration: IntegrationName;
  readonly reason: IntegrationUnavailableReason;

  constructor(
    integration: IntegrationName,
    reason: IntegrationUnavailableReason = "not_configured",
  ) {
    super(`${integration} integration is ${reason.replace("_", " ")}.`);
    this.name = "IntegrationUnavailableError";
    this.integration = integration;
    this.reason = reason;
  }
}

export function integrationUnavailable(
  integration: IntegrationName,
  reason: IntegrationUnavailableReason = "not_configured",
): IntegrationUnavailableResult {
  return Object.freeze({
    status: "unavailable",
    integration,
    reason,
  });
}
