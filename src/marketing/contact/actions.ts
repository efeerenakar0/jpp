"use server";

import { contactContent as englishContactContent } from "@/marketing/content/en/contact";
import { contactContent as turkishContactContent } from "@/marketing/content/tr/contact";

import type { ContactFormValues } from "./schema";
import { submitContactRequest } from "./submit";
import type { ContactAdapterIntent } from "./types";

export async function submitContactAction(input: {
  readonly values: ContactFormValues;
  readonly intent: ContactAdapterIntent;
  readonly locale: "en" | "tr";
}) {
  const validationMessages =
    input.locale === "tr"
      ? turkishContactContent.validation
      : englishContactContent.validation;

  return submitContactRequest({
    values: input.values,
    intent: input.intent,
    locale: input.locale,
    validationMessages,
  });
}
