import type { PricingContent } from "@/marketing/types";

export const pricingContent = {
  locale: "en",
  metadata: {
    title: "Real Estate Pricing | Business CEO AI",
    description:
      "Start Business CEO AI for Real Estate with Office at ₺11.350 per month, or contact sales for an Enterprise operating model.",
    canonicalPath: "/realestate#pricing",
  },
  hero: {
    eyebrow: "Türkiye launch offer",
    title: "A complete Office plan. An Enterprise path for larger operations.",
    description:
      "Begin with a 14-day Office trial and no credit card, or speak with the team about multiple offices and custom operating requirements.",
  },
  trial: {
    durationDays: 14,
    title: "14-day free trial",
    description:
      "Explore the Office feature set for 14 days. No charge is made during the trial because no credit card is required.",
    noCardRequired: true,
    noCardLabel: "No credit card required",
    includes: "Includes Office features",
    afterTrialWithoutPayment:
      "If payment is not completed at the end of the trial, the account is closed or suspended.",
  },
  plans: [
    {
      id: "office",
      name: "Office",
      audience: "For a real estate office ready to run its customer and team operations through one system.",
      description:
        "The launch plan for one office, one WhatsApp connection and the complete currently available AI workforce.",
      price: {
        currency: "TRY",
        amount: 11350,
        formatted: "₺11.350",
        display: "₺11.350 / month",
        cadence: "month",
        cadenceLabel: "/ month",
        note: "Türkiye launch pricing",
        pendingApproval: false,
        isPublic: true,
      },
      features: [
        "1 office",
        "1 WhatsApp connection",
        "Up to 10 users",
        "All currently available AI workers",
        "Standard onboarding",
        "Standard email support",
      ],
      supportResponse: "Initial response within one business day",
      action: {
        label: "Request Free Trial",
        href: "/contact?sector=real-estate&intent=trial&plan=office",
        kind: "primary",
        analyticsEvent: "pricing_plan_selected",
      },
    },
    {
      id: "enterprise",
      name: "Enterprise",
      audience: "For multi-office businesses and operations that need tailored limits, migration or configuration.",
      description:
        "A configurable operating model with priority onboarding, support and an escalation path. No public Enterprise price is claimed.",
      priceLabel: "Contact Sales",
      features: [
        "Multiple offices",
        "Multiple WhatsApp connections",
        "Custom limits",
        "Priority onboarding",
        "Migration assistance",
        "Custom configuration",
        "Priority support",
        "Periodic operational review",
        "Escalation contact",
      ],
      supportResponse: "Initial response within two business hours during business hours",
      action: {
        label: "Contact Sales",
        href: "/contact?sector=real-estate&intent=sales&plan=enterprise",
        kind: "secondary",
        analyticsEvent: "pricing_plan_selected",
      },
    },
  ],
  pendingOptions: [
    {
      id: "office-six-month",
      durationMonths: 6,
      currency: "TRY",
      proposedTotal: 61290,
      formatted: "₺61.290",
      pendingApproval: true,
      isPublic: false,
      internalLabel: "Six-month Office proposal — do not publish without explicit approval",
      refundPolicy:
        "If approved and purchased, early cancellation of the six-month plan would not be refundable.",
    },
    {
      id: "office-twelve-month",
      durationMonths: 12,
      currency: "TRY",
      proposedTotal: 108960,
      formatted: "₺108.960",
      pendingApproval: true,
      isPublic: false,
      internalLabel: "Twelve-month Office proposal — do not publish without explicit approval",
      refundPolicy:
        "If approved and purchased, early cancellation of the twelve-month plan would not be refundable.",
    },
  ],
  disclosure:
    "Only the monthly Office price is approved for public display. Six- and twelve-month totals remain hidden pending explicit approval. Enterprise pricing is available only through Contact Sales.",
} as const satisfies PricingContent;
