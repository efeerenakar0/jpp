import "server-only";

import { prisma } from "@/lib/prisma";
import type { ContactInput, ContactProvider } from "@/marketing/integrations";

function buildSubmissionNotes(input: Readonly<ContactInput>): string {
  return [
    "Source: Business CEO AI public website",
    `Company: ${input.company}`,
    `Sector: ${input.sector}`,
    `Team size: ${input.teamSize}`,
    `Intent: ${input.intent}`,
    `Locale: ${input.locale}`,
    `Marketing consent: ${input.marketingConsent ? "yes" : "no"}`,
  ].join("\n");
}

export const databaseContactProvider: ContactProvider = {
  async submit(input) {
    try {
      const submission = await prisma.lead.create({
        data: {
          email: input.workEmail,
          message: input.message,
          name: input.name,
          notes: buildSubmissionNotes(input),
          phone: input.phoneOrWhatsApp,
        },
        select: { id: true },
      });

      return {
        status: "accepted",
        submissionId: submission.id,
      };
    } catch {
      return {
        status: "error",
        code: "provider_error",
        retryable: true,
      };
    }
  },
};
