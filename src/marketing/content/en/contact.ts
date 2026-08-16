import type { ContactContent } from "@/marketing/contact";

export const contactContent = {
  locale: "en",
  metadata: {
    title: "Contact the team",
    description:
      "Prepare a Real Estate trial request, book a product demo, speak with sales or explore a founding partnership with Business CEO AI.",
    canonicalPath: "/contact",
  },
  routeLabel: "Contact / qualified brief",
  hero: {
    real_estate: {
      title: "Prepare your Real Estate trial conversation.",
      description:
        "Tell us how your office handles leads, listings and team follow-up today. This step prepares a human review; it does not create an account or start a trial automatically.",
      contextLabel: "Real Estate · trial readiness",
    },
    enterprise_sales: {
      title: "Design an operating model for a larger network.",
      description:
        "Share the offices, connections and migration constraints behind your operation. We will use the brief to frame an Enterprise conversation without inventing a public price or SLA.",
      contextLabel: "Enterprise · operating scope",
    },
    book_demo: {
      title: "See where one operating layer could remove friction.",
      description:
        "Describe the customer, employee or operational handoffs that slow the business down. We will use that context to shape a focused product conversation.",
      contextLabel: "Product demo · operating fit",
    },
    founding_partner: {
      title: "Help shape the next industry operating model.",
      description:
        "Business CEO AI is actively developing new sector models. Share the workflow knowledge, constraints and collaboration scope you could bring as a founding partner.",
      contextLabel: "Founding partner · sector design",
    },
  },
  introduction: {
    title: "Start with the real operating context.",
    description:
      "A concise brief helps the team understand fit before a call. Do not include passwords, payment details, private WhatsApp conversations or other sensitive information.",
    responseNote:
      "The form sends your brief directly into human review. You can also use the email link as an alternative contact path.",
    emailLabel: "Email the team",
  },
  process: [
    {
      title: "Frame the operation",
      description: "Share the business, team size and workflow that needs attention.",
    },
    {
      title: "Review the fit",
      description: "The team evaluates scope, readiness and the right next conversation.",
    },
    {
      title: "Continue with a human",
      description: "A person—not an automated success screen—owns the next step.",
    },
  ],
  provider: {
    statusLabel: "Delivery status",
    readyTitle: "Secure delivery is active",
    readyDescription:
      "Your brief is saved to the Business CEO AI review queue and used only to respond to your request.",
    submittedUnavailableTitle: "Your request has not been delivered yet",
    submittedUnavailableDescription:
      "The delivery service did not confirm the request and no submission was created. Please try again or email info@businessceo.ai.",
    genericErrorTitle: "The request could not be processed",
    genericErrorDescription:
      "No submission was created. Review the form or use the direct email path below.",
    acceptedTitle: "Request received",
    acceptedDescription:
      "The contact service accepted your request. The team will review the operating context you shared.",
  },
  form: {
    title: "Build the brief",
    description: "Fields marked required must be complete before the request can be checked.",
    requiredLabel: "Required",
    optionalLabel: "Optional",
    selectPlaceholder: "Select an option",
    nameLabel: "Name",
    namePlaceholder: "Your full name",
    workEmailLabel: "Work email",
    workEmailPlaceholder: "name@company.com",
    phoneLabel: "Phone / WhatsApp",
    phonePlaceholder: "+90 5xx xxx xx xx",
    companyLabel: "Company",
    companyPlaceholder: "Company name",
    sectorLabel: "Sector",
    teamSizeLabel: "Team size",
    messageLabel: "Message",
    messagePlaceholder:
      "What is the operating problem, who is involved and what would a useful next conversation cover?",
    privacyPrefix: "I acknowledge the",
    privacyLinkLabel: "Privacy Notice",
    privacySuffix: "and how my information is handled when I send this request.",
    privacyHref: "/legal/privacy",
    consentGroupLabel: "Privacy and communication choices",
    marketingConsentLabel: "Send me occasional product and launch updates. Optional.",
    submitLabels: {
      real_estate: "Send trial request",
      enterprise_sales: "Send sales brief",
      book_demo: "Send demo request",
      founding_partner: "Send partner request",
    },
    submittingLabel: "Sending request securely…",
    summaryTitle: "Review the highlighted fields",
    summaryDescription: "The request has not been sent. Correct the following items:",
    directEmailLabel: "Email info@businessceo.ai instead",
    noAccountNotice:
      "This request does not automatically create an account or activate a trial; a real team member owns the next step.",
    characterLimitLabel: "2,000 character limit",
  },
  sectors: [
    { value: "real_estate", label: "Real Estate" },
    { value: "hospitality", label: "Hospitality" },
    { value: "restaurants", label: "Restaurants" },
    { value: "wholesale", label: "Wholesale" },
    { value: "construction", label: "Construction" },
    { value: "other", label: "Other" },
  ],
  teamSizes: [
    { value: "1", label: "1 person" },
    { value: "2_10", label: "2–10 people" },
    { value: "11_50", label: "11–50 people" },
    { value: "51_200", label: "51–200 people" },
    { value: "201_plus", label: "201+ people" },
  ],
  validation: {
    nameRequired: "Enter your name using at least 2 characters.",
    nameTooLong: "Keep your name under 100 characters.",
    emailInvalid: "Enter a valid work email address.",
    emailTooLong: "Keep the email address under 254 characters.",
    phoneInvalid: "Enter at least 7 characters or leave this optional field empty.",
    phoneTooLong: "Keep the phone or WhatsApp number under 40 characters.",
    companyRequired: "Enter your company name using at least 2 characters.",
    companyTooLong: "Keep the company name under 120 characters.",
    sectorRequired: "Select a sector.",
    teamSizeRequired: "Select a team size.",
    messageRequired: "Describe the operating context using at least 20 characters.",
    messageTooLong: "Keep the message under 2,000 characters.",
    privacyRequired: "Acknowledge the Privacy Notice to continue.",
  },
} as const satisfies ContactContent;
