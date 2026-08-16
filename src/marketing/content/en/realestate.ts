import type { RealEstateContent } from "@/marketing/types";

export const realEstateContent = {
  locale: "en",
  metadata: {
    title: "Business CEO AI for Real Estate",
    description:
      "Coordinate customer conversations, team handoffs, portfolio opportunities and owner visibility through one AI operating layer.",
    canonicalPath: "/realestate",
  },
  hero: {
    eyebrow: "Business CEO AI for Real Estate",
    selectedHeadlineId: "coordinated-action",
    headlineAlternatives: [
      {
        id: "coordinated-action",
        title: "Turn every real estate signal into coordinated action.",
        rationale: "Leads with the operating outcome and positions the product beyond a single automation.",
      },
      {
        id: "owner-visibility",
        title: "From first message to owner visibility—one operating brain.",
        rationale: "Makes the end-to-end customer, employee and owner loop explicit.",
      },
    ],
    supportingCopy:
      "Bring customer conversations, appointments, sales portfolio opportunities and team knowledge into one coordinated operating layer—without removing people from the moments that need them.",
    actions: [
      {
        label: "Request Your 14-Day Free Trial",
        href: "/contact?sector=real-estate&intent=trial",
        kind: "primary",
        analyticsEvent: "trial_started",
      },
      {
        label: "Sign In",
        href: "/realestate/login",
        kind: "secondary",
        analyticsEvent: "login_clicked",
      },
    ],
    noCardLabel: "No credit card required",
    proofSummary:
      "Typically responds within 15 seconds. 40+ portfolio opportunities identified in 30 days during an internal real estate operation.",
  },
  problemSequence: {
    eyebrow: "Where momentum gets lost",
    title: "One missed signal can disconnect the rest of the operation.",
    introduction:
      "The issue is rarely one message. It is the chain of context that disappears when messages, appointments, portfolios and team knowledge live apart.",
    stages: [
      { id: "late-message", label: "Delayed message" },
      { id: "lost-customer", label: "Lost customer momentum" },
      { id: "untracked-appointment", label: "Untracked appointment" },
      { id: "portfolio-gap", label: "Insufficient sales portfolio" },
      { id: "visibility-gap", label: "Owner visibility gap" },
    ],
    transition:
      "Business CEO AI reconnects those signals and moves each qualified moment to the next operational step.",
  },
  whatsappOperations: {
    eyebrow: "Customer operations",
    title: "AI-powered WhatsApp operations that know when people should take over.",
    description:
      "Understand incoming needs, move conversations toward a meeting or appointment, notify the right employee and carry the result into owner visibility.",
    approvedDescriptor: "AI-powered WhatsApp operations",
    aiDisclosure:
      "You’re speaking with Business CEO AI’s virtual assistant. A team member can take over at any time.",
    flow: [
      {
        id: "incoming-message",
        label: "Incoming message",
        description: "A customer starts with a property need, question or viewing intent.",
      },
      {
        id: "ai-disclosure",
        label: "AI disclosure",
        description: "The assistant clearly identifies itself and keeps human takeover available.",
      },
      {
        id: "response",
        label: "Response",
        description: "The workflow responds and keeps the conversation moving.",
      },
      {
        id: "qualification",
        label: "Qualification",
        description: "It gathers the need and relevant operating context.",
      },
      {
        id: "appointment-intent",
        label: "Appointment intent",
        description: "A viewing or meeting request is identified.",
      },
      {
        id: "employee-handoff",
        label: "Employee handoff",
        description: "The appropriate team member receives the qualified context.",
      },
      {
        id: "owner-visibility",
        label: "Owner visibility",
        description: "Operational information becomes available to the business owner.",
      },
    ],
    capabilities: [
      "Automatic responses to incoming customer messages",
      "Typically responds within 15 seconds",
      "Need discovery and qualification",
      "Progression toward a meeting or appointment",
      "Employee notification when a customer wants to view a property",
      "Information collection from employees",
      "Operational context carried to the owner",
      "Natural-language operational questions from the owner",
      "Google connections",
      "Human handoff",
    ],
  },
  portfolioHunter: {
    eyebrow: "New portfolio opportunities",
    title: "Portfolio Hunter",
    description:
      "Research sales-focused property marketplace signals, help progress an owner conversation and notify an employee when an authorization opportunity reaches the right stage.",
    scopeNote:
      "Portfolio Hunter is focused on for-sale portfolio opportunities. It does not claim affiliation with any property marketplace.",
    flow: [
      {
        id: "marketplace-signal",
        label: "Marketplace signal",
        description: "A relevant for-sale property signal enters the research workflow.",
      },
      {
        id: "opportunity-score",
        label: "Opportunity analysis",
        description: "The signal is assessed for a potential sales authorization opportunity.",
      },
      {
        id: "owner-conversation",
        label: "Owner conversation",
        description: "The conversation with the listing owner is progressed with clear context.",
      },
      {
        id: "authorization-stage",
        label: "Authorization stage",
        description: "The workflow recognizes when human involvement becomes relevant.",
      },
      {
        id: "employee-notification",
        label: "Employee notification",
        description: "A team member receives the opportunity and its collected context.",
      },
    ],
    capabilities: [
      "Research focused on for-sale portfolio opportunities",
      "Property marketplace signal analysis",
      "Progression of the listing-owner conversation",
      "Employee notification at the authorization stage",
    ],
  },
  generalManager: {
    eyebrow: "Owner intelligence",
    title: "AI General Manager",
    description:
      "Bring customer, employee and operational signals into a shared owner view so the business can be understood without chasing context across disconnected conversations.",
    capabilities: [
      "Customer, employee and manager coordination",
      "Information collection from employees",
      "Owner updates",
      "Operational visibility",
    ],
    exampleOwnerQuestion: "Which appointments need attention today, and what is each team member waiting on?",
  },
  humanHandoff: {
    eyebrow: "Human judgment stays in the loop",
    title: "AI coordinates the work. Your team owns the moments that matter.",
    description:
      "Business CEO AI is designed to bring a person in with useful context—not remove them from customer relationships or business decisions.",
    steps: [
      "AI recognizes intent and gathers relevant context.",
      "The appropriate employee is notified at the handoff point.",
      "The employee takes over with the conversation history and next-step context.",
      "The owner retains visibility into the operational outcome.",
    ],
  },
  proof: {
    eyebrow: "Operational evidence",
    title: "Two measured signals. No invented conversion claims.",
    disclaimer:
      "The figures below describe typical product behavior and a specific internal operation; they do not guarantee business outcomes.",
    metrics: [
      {
        id: "response-speed",
        value: "~15 sec",
        statement: "Typically responds within 15 seconds.",
        context: "Typical response behavior; timing can vary with connectivity and workflow conditions.",
        evidenceBasis: "typical-product-behavior",
      },
      {
        id: "portfolio-opportunities",
        value: "40+",
        statement:
          "40+ portfolio opportunities identified in 30 days during an internal real estate operation.",
        context: "Observed in one 30-day internal real estate operation; results vary by market and input quality.",
        evidenceBasis: "internal-real-estate-operation",
      },
    ],
    internationalTestingStatement: "Tested with selected international real estate businesses.",
  },
  productFilms: {
    eyebrow: "See the operating flows",
    title: "Two short product films, built around the work itself.",
    description:
      "Synthetic interface scenes explain each workflow without using real customer data or unfinished product screenshots.",
    films: [
      {
        id: "whatsapp-operations",
        title: "WhatsApp Operations",
        description:
          "From incoming message and visible AI disclosure to qualification, employee handoff and owner visibility.",
        durationLabel: "20–30 seconds",
        captionsRequired: true,
      },
      {
        id: "portfolio-hunter",
        title: "Portfolio Hunter",
        description:
          "From a marketplace signal to opportunity analysis, owner conversation, authorization stage and employee notification.",
        durationLabel: "20–30 seconds",
        captionsRequired: true,
      },
    ],
  },
  security: {
    eyebrow: "Data principles",
    title: "Keep the useful operating context—not a permanent raw-message archive.",
    description:
      "The product is designed around explicit retention boundaries, isolated tenant data and encryption without making unsupported certification claims.",
    principles: [
      {
        id: "raw-message-deletion",
        title: "Raw messages",
        description: "Raw WhatsApp messages are deleted immediately.",
      },
      {
        id: "structured-crm-retention",
        title: "Structured operating context",
        description:
          "Names, needs, appointments and CRM summaries may be retained while the account is active.",
      },
      {
        id: "account-closure",
        title: "Account closure",
        description:
          "When an account closes, structured CRM information is not retained in active systems.",
      },
      {
        id: "no-model-training",
        title: "No model training",
        description: "Customer data is not used to train models.",
      },
      {
        id: "tenant-isolation",
        title: "Tenant isolation",
        description: "Tenant data is isolated.",
      },
      {
        id: "encryption-in-transit",
        title: "In transit",
        description: "Data is encrypted in transit.",
      },
      {
        id: "encryption-at-rest",
        title: "In the database",
        description: "Data is encrypted in the database.",
      },
    ],
    certificationNote: "No unverified certification or security-superlative claim is made.",
  },
  pricingReference: {
    title: "Start with Office. Scale through Enterprise.",
    description:
      "Office includes the current AI workforce and a 14-day free trial. Enterprise supports multi-office and custom operating needs.",
    officePrice: "₺11.350",
    cadence: "/ month",
    enterpriseLabel: "Contact Sales",
    action: {
      label: "Compare Plans",
      href: "#pricing",
      kind: "primary",
      analyticsEvent: "pricing_plan_selected",
    },
  },
  finalCta: {
    eyebrow: "14 days to see the operating loop",
    title: "Start with the real estate work your team handles every day.",
    description:
      "Try the Office experience for 14 days. No credit card is required, and a team member can take over AI-assisted conversations at any time.",
    actions: [
      {
        label: "Request Your 14-Day Free Trial",
        href: "/contact?sector=real-estate&intent=trial",
        kind: "primary",
        analyticsEvent: "trial_started",
      },
      {
        label: "Sign In",
        href: "/realestate/login",
        kind: "secondary",
        analyticsEvent: "login_clicked",
      },
    ],
  },
} as const satisfies RealEstateContent;
