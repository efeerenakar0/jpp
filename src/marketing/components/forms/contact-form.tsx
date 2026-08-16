"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, CircleCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type FieldErrors,
  type FieldPath,
  useForm,
  useWatch,
} from "react-hook-form";

import {
  CONTACT_MESSAGE_MAX_LENGTH,
  createContactFormSchema,
  type ContactContent,
  type ContactFormValues,
  type ContactRouteContext,
} from "@/marketing/contact";
import { submitContactAction } from "@/marketing/contact/actions";

const CONTACT_EMAIL = "info@businessceo.ai";

type VisibleFieldName = Exclude<
  FieldPath<ContactFormValues>,
  "website" | "formStartedAt" | "marketingConsent"
>;

type SubmissionFeedback = {
  readonly tone: "error" | "success";
  readonly title: string;
  readonly description: string;
} | null;

export interface ContactFormProps {
  readonly content: ContactContent;
  readonly context: ContactRouteContext;
}

function InlineError({ id, message }: { readonly id: string; readonly message?: string }) {
  if (!message) {
    return null;
  }

  return (
    <p className="bceo-contact-field__error" id={id} role="alert">
      {message}
    </p>
  );
}

function focusAfterRender(elementId: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => document.getElementById(elementId)?.focus());
  });
}

export function ContactForm({ content, context }: ContactFormProps) {
  const schema = useMemo(
    () => createContactFormSchema(content.validation),
    [content.validation],
  );
  const [feedback, setFeedback] = useState<SubmissionFeedback>(null);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
  } = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    reValidateMode: "onChange",
    shouldFocusError: false,
    defaultValues: {
      name: "",
      workEmail: "",
      phoneOrWhatsApp: "",
      company: "",
      sector: context.sector,
      teamSize: undefined,
      message: "",
      privacyNoticeAccepted: false,
      marketingConsent: false,
      website: "",
      formStartedAt: 1,
    },
  });

  useEffect(() => {
    setValue("formStartedAt", Date.now(), { shouldDirty: false });
  }, [setValue]);

  const message = useWatch({ control, name: "message" }) ?? "";

  const fieldLabels: Readonly<Record<VisibleFieldName, string>> = {
    name: content.form.nameLabel,
    workEmail: content.form.workEmailLabel,
    phoneOrWhatsApp: content.form.phoneLabel,
    company: content.form.companyLabel,
    sector: content.form.sectorLabel,
    teamSize: content.form.teamSizeLabel,
    message: content.form.messageLabel,
    privacyNoticeAccepted: content.form.privacyLinkLabel,
  };

  const errorEntries = (
    Object.entries(errors) as [FieldPath<ContactFormValues>, FieldErrors<ContactFormValues>[keyof ContactFormValues]][]
  ).filter(
    ([fieldName, error]) =>
      fieldName !== "website" &&
      fieldName !== "formStartedAt" &&
      fieldName !== "marketingConsent" &&
      typeof error?.message === "string",
  ) as [VisibleFieldName, { readonly message: string }][];

  const onValid = async (values: ContactFormValues) => {
    setFeedback(null);

    const result = await submitContactAction({
      values,
      intent: context.intent,
      locale: content.locale,
    });

    if (result.status === "accepted") {
      setFeedback({
        tone: "success",
        title: content.provider.acceptedTitle,
        description: content.provider.acceptedDescription,
      });
    } else if (result.status === "unavailable") {
      setFeedback({
        tone: "error",
        title: content.provider.submittedUnavailableTitle,
        description: content.provider.submittedUnavailableDescription,
      });
    } else {
      setFeedback({
        tone: "error",
        title: content.provider.genericErrorTitle,
        description: content.provider.genericErrorDescription,
      });
    }

    focusAfterRender("contact-submission-status");
  };

  const onInvalid = () => {
    setFeedback(null);
    focusAfterRender("contact-error-summary");
  };

  const requiredText = (label: string) => (
    <span className="bceo-contact-field__requirement">
      <span aria-hidden="true">*</span>
      <span className="bceo-contact-sr-only"> {label}</span>
    </span>
  );

  return (
    <div className="bceo-contact-form-shell">
      <div className="bceo-contact-form-shell__heading">
        <div>
          <p>{content.routeLabel}</p>
          <h2 id="contact-form-title">{content.form.title}</h2>
        </div>
        <p>{content.form.description}</p>
      </div>

      <div className="bceo-contact-provider" data-tone="ready" role="status">
        <span>{content.provider.statusLabel}</span>
        <div>
          <strong>
            <CircleCheck aria-hidden="true" size={17} strokeWidth={1.8} />
            {content.provider.readyTitle}
          </strong>
          <p>{content.provider.readyDescription}</p>
        </div>
        <a href={`mailto:${CONTACT_EMAIL}`}>
          {content.form.directEmailLabel}
          <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} />
        </a>
      </div>

      {errorEntries.length > 0 ? (
        <div
          className="bceo-contact-summary"
          id="contact-error-summary"
          role="alert"
          tabIndex={-1}
        >
          <strong>{content.form.summaryTitle}</strong>
          <p>{content.form.summaryDescription}</p>
          <ul>
            {errorEntries.map(([fieldName, error]) => (
              <li key={fieldName}>
                <a href={`#contact-${fieldName}`}>
                  {fieldLabels[fieldName]}: {error.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {feedback ? (
        <div
          className="bceo-contact-submission-status"
          data-tone={feedback.tone}
          id="contact-submission-status"
          role={feedback.tone === "error" ? "alert" : "status"}
          tabIndex={-1}
        >
          <strong>{feedback.title}</strong>
          <p>{feedback.description}</p>
          {feedback.tone === "error" ? (
            <a href={`mailto:${CONTACT_EMAIL}`}>{content.form.directEmailLabel}</a>
          ) : null}
        </div>
      ) : null}

      <form
        aria-labelledby="contact-form-title"
        className="bceo-contact-form"
        noValidate
        onSubmit={handleSubmit(onValid, onInvalid)}
      >
        <div className="bceo-contact-honeypot" aria-hidden="true">
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            tabIndex={-1}
            autoComplete="off"
            {...register("website")}
          />
        </div>
        <input type="hidden" {...register("formStartedAt", { valueAsNumber: true })} />

        <div className="bceo-contact-field">
          <label htmlFor="contact-name">
            {content.form.nameLabel}
            {requiredText(content.form.requiredLabel)}
          </label>
          <input
            id="contact-name"
            type="text"
            autoComplete="name"
            placeholder={content.form.namePlaceholder}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "contact-name-error" : undefined}
            {...register("name")}
          />
          <InlineError id="contact-name-error" message={errors.name?.message} />
        </div>

        <div className="bceo-contact-field">
          <label htmlFor="contact-workEmail">
            {content.form.workEmailLabel}
            {requiredText(content.form.requiredLabel)}
          </label>
          <input
            id="contact-workEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={content.form.workEmailPlaceholder}
            aria-invalid={Boolean(errors.workEmail)}
            aria-describedby={errors.workEmail ? "contact-workEmail-error" : undefined}
            {...register("workEmail")}
          />
          <InlineError id="contact-workEmail-error" message={errors.workEmail?.message} />
        </div>

        <div className="bceo-contact-field">
          <label htmlFor="contact-phoneOrWhatsApp">
            {content.form.phoneLabel}
            <span className="bceo-contact-field__optional">{content.form.optionalLabel}</span>
          </label>
          <input
            id="contact-phoneOrWhatsApp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={content.form.phonePlaceholder}
            aria-invalid={Boolean(errors.phoneOrWhatsApp)}
            aria-describedby={
              errors.phoneOrWhatsApp ? "contact-phoneOrWhatsApp-error" : undefined
            }
            {...register("phoneOrWhatsApp")}
          />
          <InlineError
            id="contact-phoneOrWhatsApp-error"
            message={errors.phoneOrWhatsApp?.message}
          />
        </div>

        <div className="bceo-contact-field">
          <label htmlFor="contact-company">
            {content.form.companyLabel}
            {requiredText(content.form.requiredLabel)}
          </label>
          <input
            id="contact-company"
            type="text"
            autoComplete="organization"
            placeholder={content.form.companyPlaceholder}
            aria-invalid={Boolean(errors.company)}
            aria-describedby={errors.company ? "contact-company-error" : undefined}
            {...register("company")}
          />
          <InlineError id="contact-company-error" message={errors.company?.message} />
        </div>

        <div className="bceo-contact-field">
          <label htmlFor="contact-sector">
            {content.form.sectorLabel}
            {requiredText(content.form.requiredLabel)}
          </label>
          <select
            id="contact-sector"
            aria-invalid={Boolean(errors.sector)}
            aria-describedby={errors.sector ? "contact-sector-error" : undefined}
            {...register("sector")}
          >
            <option value="" disabled>
              {content.form.selectPlaceholder}
            </option>
            {content.sectors.map((sector) => (
              <option key={sector.value} value={sector.value}>
                {sector.label}
              </option>
            ))}
          </select>
          <InlineError id="contact-sector-error" message={errors.sector?.message} />
        </div>

        <div className="bceo-contact-field">
          <label htmlFor="contact-teamSize">
            {content.form.teamSizeLabel}
            {requiredText(content.form.requiredLabel)}
          </label>
          <select
            id="contact-teamSize"
            aria-invalid={Boolean(errors.teamSize)}
            aria-describedby={errors.teamSize ? "contact-teamSize-error" : undefined}
            {...register("teamSize")}
          >
            <option value="">{content.form.selectPlaceholder}</option>
            {content.teamSizes.map((teamSize) => (
              <option key={teamSize.value} value={teamSize.value}>
                {teamSize.label}
              </option>
            ))}
          </select>
          <InlineError id="contact-teamSize-error" message={errors.teamSize?.message} />
        </div>

        <div className="bceo-contact-field bceo-contact-field--message">
          <div className="bceo-contact-field__label-row">
            <label htmlFor="contact-message">
              {content.form.messageLabel}
              {requiredText(content.form.requiredLabel)}
            </label>
            <span>
              {message.length.toLocaleString(content.locale)} /{" "}
              {CONTACT_MESSAGE_MAX_LENGTH.toLocaleString(content.locale)}
            </span>
          </div>
          <textarea
            id="contact-message"
            rows={7}
            maxLength={CONTACT_MESSAGE_MAX_LENGTH}
            placeholder={content.form.messagePlaceholder}
            aria-invalid={Boolean(errors.message)}
            aria-describedby="contact-message-limit contact-message-error"
            {...register("message")}
          />
          <span className="bceo-contact-sr-only" id="contact-message-limit">
            {content.form.characterLimitLabel}
          </span>
          <InlineError id="contact-message-error" message={errors.message?.message} />
        </div>

        <fieldset className="bceo-contact-consent">
          <legend className="bceo-contact-sr-only">{content.form.consentGroupLabel}</legend>
          <div className="bceo-contact-checkbox" data-invalid={Boolean(errors.privacyNoticeAccepted)}>
            <input
              id="contact-privacyNoticeAccepted"
              type="checkbox"
              aria-invalid={Boolean(errors.privacyNoticeAccepted)}
              aria-describedby={
                errors.privacyNoticeAccepted ? "contact-privacyNoticeAccepted-error" : undefined
              }
              {...register("privacyNoticeAccepted")}
            />
            <label htmlFor="contact-privacyNoticeAccepted">
              {content.form.privacyPrefix}{" "}
              <a href={content.form.privacyHref}>{content.form.privacyLinkLabel}</a>{" "}
              {content.form.privacySuffix}
              {requiredText(content.form.requiredLabel)}
            </label>
          </div>
          <InlineError
            id="contact-privacyNoticeAccepted-error"
            message={errors.privacyNoticeAccepted?.message}
          />

          <div className="bceo-contact-checkbox">
            <input
              id="contact-marketingConsent"
              type="checkbox"
              {...register("marketingConsent")}
            />
            <label htmlFor="contact-marketingConsent">
              {content.form.marketingConsentLabel}
            </label>
          </div>
        </fieldset>

        <div className="bceo-contact-form__action">
          <button className="bceo-button bceo-button--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? content.form.submittingLabel
              : content.form.submitLabels[context.intent]}
            {!isSubmitting ? (
              <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} />
            ) : null}
          </button>
          <p>{content.form.noAccountNotice}</p>
        </div>
      </form>
    </div>
  );
}
