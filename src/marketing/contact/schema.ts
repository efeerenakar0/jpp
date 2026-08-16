import { z } from "zod";

import type { ContactValidationMessages } from "./types";

export const CONTACT_MINIMUM_SUBMISSION_MS = 1_500;
export const CONTACT_MESSAGE_MAX_LENGTH = 2_000;

const sectorValues = [
  "real_estate",
  "hospitality",
  "restaurants",
  "wholesale",
  "construction",
  "other",
] as const;

const teamSizeValues = ["1", "2_10", "11_50", "51_200", "201_plus"] as const;

export function createContactFormSchema(messages: ContactValidationMessages) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(2, { message: messages.nameRequired })
      .max(100, { message: messages.nameTooLong }),
    workEmail: z
      .string()
      .trim()
      .email({ message: messages.emailInvalid })
      .max(254, { message: messages.emailTooLong }),
    phoneOrWhatsApp: z
      .string()
      .trim()
      .max(40, { message: messages.phoneTooLong })
      .refine((value) => value.length === 0 || value.length >= 7, {
        message: messages.phoneInvalid,
      }),
    company: z
      .string()
      .trim()
      .min(2, { message: messages.companyRequired })
      .max(120, { message: messages.companyTooLong }),
    sector: z.enum(sectorValues, { message: messages.sectorRequired }),
    teamSize: z.enum(teamSizeValues, { message: messages.teamSizeRequired }),
    message: z
      .string()
      .trim()
      .min(20, { message: messages.messageRequired })
      .max(CONTACT_MESSAGE_MAX_LENGTH, { message: messages.messageTooLong }),
    privacyNoticeAccepted: z.boolean().refine((accepted) => accepted, {
      message: messages.privacyRequired,
    }),
    marketingConsent: z.boolean(),
    website: z.string().max(200),
    formStartedAt: z.number().int().positive(),
  });
}
export type ContactFormValues = z.infer<ReturnType<typeof createContactFormSchema>>;

export type ContactSubmissionSignalAssessment =
  | { readonly suspicious: false; readonly elapsedMilliseconds: number }
  | {
      readonly suspicious: true;
      readonly reason: "honeypot_filled" | "submitted_too_quickly" | "invalid_start_time";
      readonly elapsedMilliseconds: number;
    };

export function assessContactSubmissionSignals(
  input: Pick<ContactFormValues, "website" | "formStartedAt">,
  now = Date.now(),
): ContactSubmissionSignalAssessment {
  const elapsedMilliseconds = now - input.formStartedAt;

  if (input.website.trim().length > 0) {
    return { suspicious: true, reason: "honeypot_filled", elapsedMilliseconds };
  }

  if (!Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds < 0) {
    return { suspicious: true, reason: "invalid_start_time", elapsedMilliseconds };
  }

  if (elapsedMilliseconds < CONTACT_MINIMUM_SUBMISSION_MS) {
    return { suspicious: true, reason: "submitted_too_quickly", elapsedMilliseconds };
  }

  return { suspicious: false, elapsedMilliseconds };
}

export function validateContactSubmission(
  input: unknown,
  messages: ContactValidationMessages,
) {
  return createContactFormSchema(messages).safeParse(input);
}
