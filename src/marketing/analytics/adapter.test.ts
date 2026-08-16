import { describe, expect, it, vi } from "vitest";

import {
  createConsentGatedAnalyticsAdapter,
  createDefaultAnalyticsAdapter,
  type AnalyticsAdapter,
} from "./adapter";

const safeEvent = {
  cta: "start_free_trial",
  surface: "hero",
  locale: "en",
} as const;

describe("consent-gated analytics", () => {
  it("fails closed before an analytics choice is granted", async () => {
    const capture = vi.fn<AnalyticsAdapter["capture"]>();
    const adapter = createConsentGatedAnalyticsAdapter({
      adapter: { id: "test", isConfigured: true, capture },
      readConsent: () => ({ necessary: "granted", analytics: "unset", marketing: "unset" }),
    });

    await expect(adapter.capture("primary_cta_clicked", safeEvent)).resolves.toEqual({
      status: "skipped",
      reason: "consent_not_granted",
    });
    expect(capture).not.toHaveBeenCalled();
  });

  it("dispatches only allow-listed properties after consent", async () => {
    const capture = vi.fn(async () => ({ status: "sent" as const }));
    const adapter = createConsentGatedAnalyticsAdapter({
      adapter: { id: "test", isConfigured: true, capture },
      readConsent: () => ({ necessary: "granted", analytics: "granted", marketing: "denied" }),
    });
    const unsafeInput = { ...safeEvent, email: "must-not-leave@example.com" };

    await expect(
      adapter.capture("primary_cta_clicked", unsafeInput),
    ).resolves.toEqual({ status: "sent" });
    expect(capture).toHaveBeenCalledWith("primary_cta_clicked", safeEvent);
  });

  it("keeps the standalone default network-inert", async () => {
    const adapter = createDefaultAnalyticsAdapter();

    await expect(adapter.capture("primary_cta_clicked", safeEvent)).resolves.toEqual({
      status: "skipped",
      reason: "consent_not_granted",
    });
  });
});
