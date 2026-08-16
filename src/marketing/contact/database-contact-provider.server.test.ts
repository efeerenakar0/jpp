import { beforeEach, describe, expect, it, vi } from "vitest";

const { createLead } = vi.hoisted(() => ({
  createLead: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: {
      create: createLead,
    },
  },
}));

import { databaseContactProvider } from "./database-contact-provider.server";

const contactInput = {
  name: "Ada Lovelace",
  workEmail: "ada@example.com",
  phoneOrWhatsApp: "+90 555 111 22 33",
  company: "Analytical Engines",
  sector: "real_estate",
  teamSize: "2_10",
  message: "We need a coordinated operating layer for customer follow-up.",
  intent: "book_demo",
  locale: "en",
  privacyNoticeAccepted: true,
  marketingConsent: false,
} as const;

describe("database contact provider", () => {
  beforeEach(() => {
    createLead.mockReset();
  });

  it("stores a validated public-site brief and returns its submission id", async () => {
    createLead.mockResolvedValue({ id: "lead-1" });

    await expect(databaseContactProvider.submit(contactInput)).resolves.toEqual({
      status: "accepted",
      submissionId: "lead-1",
    });

    expect(createLead).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: contactInput.workEmail,
        message: contactInput.message,
        name: contactInput.name,
        phone: contactInput.phoneOrWhatsApp,
        notes: expect.stringContaining("Source: Business CEO AI public website"),
      }),
      select: { id: true },
    });
  });

  it("fails closed when the lead store is unavailable", async () => {
    createLead.mockRejectedValue(new Error("database unavailable"));

    await expect(databaseContactProvider.submit(contactInput)).resolves.toEqual({
      status: "error",
      code: "provider_error",
      retryable: true,
    });
  });
});
