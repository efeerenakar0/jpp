import {
  integrationUnavailable,
  type IntegrationFailureResult,
  type IntegrationUnavailableReason,
  type IntegrationUnavailableResult,
  type MarketingLocale,
} from "./shared";

export type CheckoutBillingPeriod =
  | "monthly"
  | "six_months"
  | "twelve_months";

export interface CheckoutInput {
  readonly plan: "office";
  readonly billingPeriod: CheckoutBillingPeriod;
  readonly currency: "TRY";
  readonly locale: MarketingLocale;
  readonly companyName: string;
  readonly workEmail: string;
  readonly termsAccepted: true;
  readonly refundPolicyAccepted: true;
}

export interface CheckoutCreatedResult {
  readonly status: "created";
  readonly sessionId: string;
  readonly checkoutUrl: string;
  readonly expiresAt?: string;
}

export interface CheckoutValidationErrorResult {
  readonly status: "validation_error";
  readonly fieldErrors: Readonly<Partial<Record<keyof CheckoutInput, string>>>;
}

export type CheckoutResult =
  | CheckoutCreatedResult
  | CheckoutValidationErrorResult
  | IntegrationUnavailableResult
  | IntegrationFailureResult;

export interface PaymentProvider {
  createCheckoutSession(
    input: Readonly<CheckoutInput>,
  ): Promise<CheckoutResult>;
}

export function createUnavailablePaymentProvider(
  reason: IntegrationUnavailableReason = "not_configured",
): PaymentProvider {
  return Object.freeze({
    createCheckoutSession: async () => integrationUnavailable("payment", reason),
  });
}

/**
 * Safe standalone default. It performs no payment request and never returns a
 * checkout URL until a real, server-side provider is supplied.
 */
export const unavailablePaymentProvider = createUnavailablePaymentProvider();
