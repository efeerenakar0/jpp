import type { IndustriesContent } from "@/marketing/types";

export const industriesContent = {
  locale: "en",
  metadata: {
    title: "Industries | Business CEO AI",
    description:
      "Explore the active Business CEO AI real estate product and the operating models in development for restaurants, hospitality, construction and wholesale.",
    canonicalPath: "/industries",
  },
  hero: {
    eyebrow: "Industry operating systems",
    title: "One operating brain, shaped around the realities of each business.",
    description:
      "Business CEO AI begins with a working flagship for Real Estate and is expanding through focused operating models developed with industry partners.",
  },
  statusLabels: {
    flagship: "Active flagship",
    "in-active-development": "In active development",
  },
  developmentDisclaimer:
    "Only Real Estate is presented as the active flagship product. Other industry models are in active development and are not described as released features.",
  sectors: [
    {
      id: "real-estate",
      name: "Real Estate",
      route: "/realestate",
      roadmapPriority: 1,
      eyebrow: "Flagship product",
      headline: "Coordinate customer conversations, portfolio opportunities and owner visibility.",
      summary:
        "Business CEO AI for Real Estate connects AI-powered WhatsApp operations, Portfolio Hunter, team handoffs and the AI General Manager.",
      operationalProblems: [
        "Customer messages that lose momentum",
        "Appointments that become disconnected from team action",
        "Sales portfolio opportunities that arrive without enough context",
        "Owners who cannot see the complete operating picture",
      ],
      actions: [
        {
          label: "Explore Real Estate",
          href: "/realestate",
          kind: "primary",
          analyticsEvent: "realestate_explored",
        },
        {
          label: "Start Free Trial",
          href: "/contact?sector=real-estate&intent=trial",
          kind: "secondary",
          analyticsEvent: "trial_started",
        },
      ],
      status: "flagship",
      statusLabel: "Active flagship",
      proof:
        "Typically responds within 15 seconds. 40+ portfolio opportunities identified in 30 days during an internal real estate operation.",
    },
    {
      id: "restaurants",
      name: "Restaurants",
      route: "/industries/restaurants",
      roadmapPriority: 2,
      eyebrow: "Restaurant operations",
      headline: "Connect guest demand, floor coordination and owner visibility.",
      summary:
        "A future operating model for restaurants where timing, team coordination and changing demand meet in one service operation.",
      operationalProblems: [
        "Guest requests split across channels and shifts",
        "Front-of-house and back-of-house context that arrives late",
        "Reservations, service recovery and follow-up without a shared view",
        "Owners learning about recurring issues after the service window",
      ],
      futureOperatingModel: {
        title: "The restaurant operating model being developed",
        description:
          "Business CEO AI is being shaped to help restaurant teams coordinate requests, service context and management visibility. The model is not presented as a released product.",
        plannedOutcomes: [
          "A shared view of guest intent and service context",
          "Clearer coordination between roles and shifts",
          "Faster escalation of issues that need a person",
          "Operational summaries for managers and owners",
        ],
      },
      actions: [
        {
          label: "Become a founding partner",
          href: "/contact?sector=restaurants&intent=founding-partner",
          kind: "primary",
          analyticsEvent: "sector_contact_started",
        },
        {
          label: "Book a Demo",
          href: "/contact?sector=restaurants&intent=demo",
          kind: "secondary",
          analyticsEvent: "sector_contact_started",
        },
      ],
      status: "in-active-development",
      statusLabel: "In active development",
      contactPreset: {
        sector: "restaurants",
        primaryIntent: "founding-partner",
      },
    },
    {
      id: "hospitality",
      name: "Hospitality",
      route: "/industries/hospitality",
      roadmapPriority: 3,
      eyebrow: "Hospitality operations",
      headline: "Carry guest context across requests, teams and the full stay.",
      summary:
        "A future operating model for hospitality businesses managing high-touch service across departments and changing shifts.",
      operationalProblems: [
        "Guest requests that cross departments without shared context",
        "Shift changes that interrupt follow-through",
        "Service issues that reach managers too late",
        "Repeated needs hidden inside separate conversations",
      ],
      futureOperatingModel: {
        title: "The hospitality operating model being developed",
        description:
          "Business CEO AI is being explored as a coordination layer for guest intent, department handoffs and management visibility. These capabilities remain in development.",
        plannedOutcomes: [
          "Continuous guest context across teams",
          "Department handoffs with a clear next action",
          "Human escalation for sensitive service moments",
          "Management visibility across the guest journey",
        ],
      },
      actions: [
        {
          label: "Become a founding partner",
          href: "/contact?sector=hospitality&intent=founding-partner",
          kind: "primary",
          analyticsEvent: "sector_contact_started",
        },
        {
          label: "Book a Demo",
          href: "/contact?sector=hospitality&intent=demo",
          kind: "secondary",
          analyticsEvent: "sector_contact_started",
        },
      ],
      status: "in-active-development",
      statusLabel: "In active development",
      contactPreset: {
        sector: "hospitality",
        primaryIntent: "founding-partner",
      },
    },
    {
      id: "construction",
      name: "Construction",
      route: "/industries/construction",
      roadmapPriority: 4,
      eyebrow: "Construction operations",
      headline: "Make field signals, office decisions and project follow-through visible together.",
      summary:
        "A future operating model for contractors coordinating teams, project signals and management decisions across changing work sites.",
      operationalProblems: [
        "Field updates separated from office decisions",
        "Dependencies discovered only after work is delayed",
        "Questions and approvals without a reliable owner",
        "Management visibility assembled manually from many sources",
      ],
      futureOperatingModel: {
        title: "The construction operating model being developed",
        description:
          "Business CEO AI is being designed to connect field information, team coordination and management attention. It is not yet presented as a live construction product.",
        plannedOutcomes: [
          "Structured field-to-office information flow",
          "Clear ownership of questions and approvals",
          "Earlier visibility into operational blockers",
          "Management summaries grounded in team updates",
        ],
      },
      actions: [
        {
          label: "Become a founding partner",
          href: "/contact?sector=construction&intent=founding-partner",
          kind: "primary",
          analyticsEvent: "sector_contact_started",
        },
        {
          label: "Book a Demo",
          href: "/contact?sector=construction&intent=demo",
          kind: "secondary",
          analyticsEvent: "sector_contact_started",
        },
      ],
      status: "in-active-development",
      statusLabel: "In active development",
      contactPreset: {
        sector: "construction",
        primaryIntent: "founding-partner",
      },
    },
    {
      id: "wholesale",
      name: "Wholesale",
      route: "/industries/wholesale",
      roadmapPriority: 5,
      eyebrow: "Wholesale operations",
      headline: "Coordinate buyer requests, team knowledge and commercial follow-through.",
      summary:
        "A future operating model for wholesalers handling recurring buyers, fast-moving requests and knowledge distributed across the team.",
      operationalProblems: [
        "Buyer requests split across conversations and salespeople",
        "Availability and commercial context that becomes outdated",
        "Follow-up depending on individual memory",
        "Owners lacking a current view of active demand",
      ],
      futureOperatingModel: {
        title: "The wholesale operating model being developed",
        description:
          "Business CEO AI is being explored as a layer for buyer intent, employee coordination and owner visibility. No unreleased capability is presented as available today.",
        plannedOutcomes: [
          "Structured buyer needs and commercial context",
          "Consistent handoffs between sales roles",
          "Visible follow-up and unresolved requests",
          "A clearer operating picture for owners",
        ],
      },
      actions: [
        {
          label: "Become a founding partner",
          href: "/contact?sector=wholesale&intent=founding-partner",
          kind: "primary",
          analyticsEvent: "sector_contact_started",
        },
        {
          label: "Book a Demo",
          href: "/contact?sector=wholesale&intent=demo",
          kind: "secondary",
          analyticsEvent: "sector_contact_started",
        },
      ],
      status: "in-active-development",
      statusLabel: "In active development",
      contactPreset: {
        sector: "wholesale",
        primaryIntent: "founding-partner",
      },
    },
  ],
} as const satisfies IndustriesContent;
