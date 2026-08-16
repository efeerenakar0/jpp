import { describe, expect, it } from "vitest";

import { contactContent } from "../content/en/contact";

import {
  normalizeContactContext,
  normalizeContactIntent,
  toProviderContactIntent,
} from "./intent";
import {
  assessContactSubmissionSignals,
  CONTACT_MINIMUM_SUBMISSION_MS,
  createContactFormSchema,
} from "./schema";

const validSubmission = {
  name: "Ada Lovelace",
  workEmail: "ada@example.com",
  phoneOrWhatsApp: "",
  company: "Analytical Engines",
  sector: "real_estate" as const,
  teamSize: "2_10" as const,
  message: "We want to coordinate lead response and team follow-up.",
  privacyNoticeAccepted: true,
  marketingConsent: false,
  website: "",
  formStartedAt: 10_000,
};

describe("contact query normalization", () => {
  it.each([
    ["real-estate", "real_estate"],
    ["trial", "real_estate"],
    ["sales", "enterprise_sales"],
    ["demo", "book_demo"],
    ["founding-partner", "founding_partner"],
  ] as const)("maps %s to the canonical adapter intent %s", (queryValue, expected) => {
    expect(normalizeContactIntent(queryValue)).toBe(expected);
  });

  it("uses the first query value and safely defaults unknown values", () => {
    expect(normalizeContactIntent(["sales", "demo"])).toBe("enterprise_sales");
    expect(normalizeContactIntent("unexpected-value")).toBe("book_demo");
  });

  it("preselects Real Estate for trial requests and preserves approved plans", () => {
    expect(
      normalizeContactContext({
        sector: "real-estate",
        intent: "trial",
        plan: "office",
      }),
    ).toEqual({ intent: "real_estate", sector: "real_estate", plan: "office" });
  });

  it("keeps Real Estate identifiable when crossing the current provider seam", () => {
    expect(toProviderContactIntent("real_estate")).toBe("book_demo");
    expect(normalizeContactContext({ intent: "trial" }).sector).toBe("real_estate");
  });
});

describe("contact submission validation", () => {
  const schema = createContactFormSchema(contactContent.validation);

  it("accepts a complete brief without optional phone or marketing consent", () => {
    expect(schema.safeParse(validSubmission).success).toBe(true);
  });

  it("requires a valid work email, meaningful message and privacy acknowledgment", () => {
    const result = schema.safeParse({
      ...validSubmission,
      workEmail: "not-an-email",
      message: "Too short",
      privacyNoticeAccepted: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.workEmail).toBeDefined();
      expect(result.error.flatten().fieldErrors.message).toBeDefined();
      expect(result.error.flatten().fieldErrors.privacyNoticeAccepted).toBeDefined();
    }
  });

  it("normalizes surrounding whitespace before data reaches a provider", () => {
    const result = schema.safeParse({
      ...validSubmission,
      name: "  Ada Lovelace  ",
      workEmail: "  ada@example.com  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Ada Lovelace");
      expect(result.data.workEmail).toBe("ada@example.com");
    }
  });
});

describe("contact anti-abuse signal contract", () => {
  it("flags the honeypot before provider submission", () => {
    expect(
      assessContactSubmissionSignals(
        { website: "https://spam.example", formStartedAt: 10_000 },
        20_000,
      ),
    ).toMatchObject({ suspicious: true, reason: "honeypot_filled" });
  });

  it("flags an implausibly fast request and allows an elapsed human request", () => {
    expect(
      assessContactSubmissionSignals(
        { website: "", formStartedAt: 10_000 },
        10_000 + CONTACT_MINIMUM_SUBMISSION_MS - 1,
      ),
    ).toMatchObject({ suspicious: true, reason: "submitted_too_quickly" });

    expect(
      assessContactSubmissionSignals(
        { website: "", formStartedAt: 10_000 },
        10_000 + CONTACT_MINIMUM_SUBMISSION_MS,
      ),
    ).toMatchObject({ suspicious: false });
  });
});
