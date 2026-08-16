import {
  DEFAULT_CONSENT_STATE,
  hasAnalyticsConsent,
  type ConsentReader,
} from "./consent";
import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
} from "./events";
import { sanitizeAnalyticsProperties } from "./events";

export type AnalyticsSkipReason =
  | "consent_not_granted"
  | "not_configured"
  | "disabled";

export type AnalyticsDispatchResult =
  | Readonly<{ status: "sent" }>
  | Readonly<{ status: "skipped"; reason: AnalyticsSkipReason }>
  | Readonly<{ status: "failed"; reason: "adapter_error" }>;

export interface AnalyticsAdapter {
  readonly id: string;
  readonly isConfigured: boolean;
  capture<Name extends AnalyticsEventName>(
    name: Name,
    properties: Readonly<AnalyticsEventProperties[Name]>,
  ): Promise<AnalyticsDispatchResult>;
}

export interface NoopAnalyticsAdapterOptions {
  readonly id?: string;
  readonly reason?: "not_configured" | "disabled";
}

export function createNoopAnalyticsAdapter(
  options: NoopAnalyticsAdapterOptions = {},
): AnalyticsAdapter {
  const reason = options.reason ?? "not_configured";

  return Object.freeze({
    id: options.id ?? "noop",
    isConfigured: false,
    capture: async (): Promise<AnalyticsDispatchResult> => ({
      status: "skipped",
      reason,
    }),
  });
}

export interface ConsentGatedAnalyticsAdapterOptions {
  readonly adapter: AnalyticsAdapter;
  readonly readConsent: ConsentReader;
}

export function createConsentGatedAnalyticsAdapter(
  options: ConsentGatedAnalyticsAdapterOptions,
): AnalyticsAdapter {
  return Object.freeze({
    id: `consent-gated:${options.adapter.id}`,
    get isConfigured() {
      return options.adapter.isConfigured;
    },
    async capture<Name extends AnalyticsEventName>(
      name: Name,
      properties: Readonly<AnalyticsEventProperties[Name]>,
    ): Promise<AnalyticsDispatchResult> {
      let analyticsAllowed = false;

      try {
        analyticsAllowed = hasAnalyticsConsent(options.readConsent());
      } catch {
        // Consent lookup fails closed: no provider call and no network traffic.
        return { status: "skipped", reason: "consent_not_granted" };
      }

      if (!analyticsAllowed) {
        return { status: "skipped", reason: "consent_not_granted" };
      }

      try {
        return await options.adapter.capture(
          name,
          sanitizeAnalyticsProperties(name, properties),
        );
      } catch {
        return { status: "failed", reason: "adapter_error" };
      }
    },
  });
}

export interface DefaultAnalyticsAdapterOptions {
  readonly adapter?: AnalyticsAdapter;
  readonly readConsent?: ConsentReader;
}

export function createDefaultAnalyticsAdapter(
  options: DefaultAnalyticsAdapterOptions = {},
): AnalyticsAdapter {
  return createConsentGatedAnalyticsAdapter({
    adapter: options.adapter ?? createNoopAnalyticsAdapter(),
    readConsent: options.readConsent ?? (() => DEFAULT_CONSENT_STATE),
  });
}

/**
 * Safe standalone default: consent is unset and no third-party implementation is
 * configured, so this adapter cannot emit network traffic.
 */
export const defaultAnalyticsAdapter = createDefaultAnalyticsAdapter();
