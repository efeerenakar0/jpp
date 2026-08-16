import "server-only";

import {
  unavailableContactProvider,
  type ContactInput,
  type ContactResult,
} from "@/marketing/integrations";

import { toProviderContactIntent } from "./intent";
import {
  assessContactSubmissionSignals,
  validateContactSubmission,
  type ContactFormValues,
} from "./schema";
import type {
  ContactAdapterIntent,
  ContactValidationMessages,
} from "./types";

export interface SubmitContactRequest {
  readonly values: ContactFormValues;
  readonly intent: ContactAdapterIntent;
  readonly locale: "en" | "tr";
  readonly validationMessages: ContactValidationMessages;
}

export type ContactFormSubmissionResult =
  | ContactResult
  | { readonly status: "spam_suspected" }
  | { readonly status: "local_validation_error" };

export function toContactProviderInput(
  values: ContactFormValues,
  intent: ContactAdapterIntent,
  locale: "en" | "tr",
): ContactInput {
  return {
    name: values.name,
    workEmail: values.workEmail,
    phoneOrWhatsApp: values.phoneOrWhatsApp,
    company: values.company,
    sector: values.sector,
    teamSize: values.teamSize,
    message: values.message,
    intent: toProviderContactIntent(intent),
    locale,
    privacyNoticeAccepted: true,
    marketingConsent: values.marketingConsent,
  };
}

/**
 * One replacement seam for the future DB-first contact pipeline. It always
 * validates before reaching the provider and fails closed while unconfigured.
 */
export async function submitContactRequest({
  values,
  intent,
  locale,
  validationMessages,
}: SubmitContactRequest): Promise<ContactFormSubmissionResult> {
  const validated = validateContactSubmission(values, validationMessages);

  if (!validated.success) {
    return { status: "local_validation_error" };
  }

  if (assessContactSubmissionSignals(validated.data).suspicious) {
    return { status: "spam_suspected" };
  }

  return unavailableContactProvider.submit(
    toContactProviderInput(validated.data, intent, locale),
  );
}
