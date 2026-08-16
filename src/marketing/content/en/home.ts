import type { HomeContent } from "@/marketing/types";

export const homeContent = {
  locale: "en",
  metadata: {
    title: "Business CEO AI | The operating brain for your business",
    description:
      "An AI Business Operating System that coordinates customers, employees and operations—starting with real estate.",
    canonicalPath: "/",
  },
  brand: {
    name: "Business CEO AI",
    category: "AI Business Operating System",
    tagline: "The operating brain for your business.",
  },
  presentation: {
    productStatusLabel: "Product status",
    systemFigureLabel: "Signals moving through the Business CEO AI operating core",
    systemModelLabel: "Operating system model",
    humanInLoopLabel: "Human in the loop",
    coreLabel: "Business operating brain",
    coreStatus: "Listen · coordinate · act",
    signalNodes: [
      { stage: "Listen", label: "Customer intent" },
      { stage: "Understand", label: "Team knowledge" },
      { stage: "Act", label: "Sales signal" },
      { stage: "Report", label: "Owner visibility" },
      { stage: "Coordinate", label: "Appointment action" },
    ],
    readout: ["Signal", "Context", "Action"],
    heroIndexLabel: "01 / Operating brain",
    heroAudienceLabel: "Customers · employees · owners",
    manifestoFlow: ["Signal", "Context", "Decision", "Action"],
    workforceMapLabel: "Customer, AI, team and owner coordination map",
    tailoredOperationsLabel: "Tailored operations",
    founderLinkLabel: "Founder",
  },
  hero: {
    eyebrow: "AI Business Operating System",
    title: "The operating brain for your business.",
    supportingCopy:
      "Business CEO AI coordinates customers, employees and operations through one intelligent operating layer—built for real estate today and designed for the businesses of tomorrow.",
    actions: [
      {
        label: "Explore Business CEO AI",
        href: "#platform",
        kind: "primary",
        analyticsEvent: "primary_cta_clicked",
      },
      {
        label: "Business CEO AI for Real Estate",
        href: "/realestate",
        kind: "secondary",
        analyticsEvent: "realestate_explored",
      },
      {
        label: "Sign In",
        href: "/realestate/login",
        kind: "tertiary",
        analyticsEvent: "login_clicked",
      },
    ],
  },
  manifesto: {
    eyebrow: "From signals to action",
    title: "A business generates hundreds of signals. Most remain disconnected.",
    body:
      "Business CEO AI turns customer intent, team knowledge and operational events into coordinated action—then carries the outcome back to the people who need to see it.",
  },
  operationalLoop: {
    eyebrow: "The operating loop",
    title: "One continuous system for understanding and moving work forward.",
    introduction:
      "Instead of leaving each message, appointment and opportunity in a separate tool, Business CEO AI keeps the operating context moving through a shared loop.",
    steps: [
      {
        id: "listen",
        label: "Listen",
        description: "Capture the signals arriving from customers, employees and active operations.",
      },
      {
        id: "understand",
        label: "Understand",
        description: "Identify intent, urgency and the operational context behind each signal.",
      },
      {
        id: "coordinate",
        label: "Coordinate",
        description: "Connect the right information, AI workflow and human team member.",
      },
      {
        id: "act",
        label: "Act",
        description: "Move the conversation, appointment or opportunity to its next useful step.",
      },
      {
        id: "report",
        label: "Report",
        description: "Give owners a clear view of what happened and what requires attention.",
      },
    ],
  },
  flagship: {
    eyebrow: "Flagship product",
    title: "Business CEO AI for Real Estate",
    description:
      "A coordinated operating layer for customer conversations, team handoffs, portfolio opportunities and owner visibility.",
    capabilities: [
      {
        id: "whatsapp-operations",
        title: "AI-powered WhatsApp operations",
        description:
          "Respond, qualify and move customer intent toward the right human handoff.",
        signalLabel: "Customer operations",
      },
      {
        id: "portfolio-hunter",
        title: "Portfolio Hunter",
        description:
          "Turn property marketplace signals into sales portfolio opportunities ready for human review.",
        signalLabel: "Opportunity intelligence",
      },
      {
        id: "general-manager",
        title: "AI General Manager",
        description:
          "Collect team signals and give owners a natural-language view of operations.",
        signalLabel: "Owner visibility",
      },
      {
        id: "human-handoff",
        title: "Human handoff",
        description:
          "Bring a team member in with the context needed to continue without losing momentum.",
        signalLabel: "Human in the loop",
      },
    ],
    actions: [
      {
        label: "Explore Real Estate",
        href: "/realestate",
        kind: "secondary",
        analyticsEvent: "realestate_explored",
      },
      {
        label: "Request Your 14-Day Free Trial",
        href: "/contact?sector=real-estate&intent=trial",
        kind: "primary",
        analyticsEvent: "trial_started",
      },
    ],
  },
  proof: {
    eyebrow: "Evidence, with context",
    title: "Measured signals from real estate operations.",
    disclaimer:
      "These figures describe the stated product behavior and one internal operating period; they are not guarantees of future results.",
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
        context: "Observed during one 30-day internal real estate operation; outcomes vary by market and input quality.",
        evidenceBasis: "internal-real-estate-operation",
      },
    ],
  },
  workforce: {
    eyebrow: "Coordinated AI workforce",
    title: "Keep the customer, the team and the owner in the same operating context.",
    description:
      "AI moves routine coordination forward while people remain visible, informed and ready to take over at the right moment.",
    roles: [
      {
        id: "customer",
        label: "Customer",
        description: "Shares a need, question or appointment intent.",
      },
      {
        id: "ai-operations",
        label: "AI operations layer",
        description: "Understands the signal and coordinates the next step.",
      },
      {
        id: "team-member",
        label: "Team member",
        description: "Receives qualified context and takes over when human judgment matters.",
      },
      {
        id: "owner",
        label: "Business owner",
        description: "Sees operational progress, gaps and decisions that require attention.",
      },
    ],
  },
  industriesPreview: {
    eyebrow: "One operating system, multiple industries",
    title: "Built to expand wherever operations depend on people, timing and context.",
    description:
      "Real Estate is the active flagship. Restaurant, hospitality, construction and wholesale operating models are in active development.",
    flagshipLabel: "Active flagship",
    developmentLabel: "In active development",
  },
  ownership: {
    statement: "Business CEO AI is developed by NexFrame AI in collaboration with KatEXtrema AI.",
    developerName: "NexFrame AI",
    collaboratorName: "KatEXtrema AI",
    nexFrameLinkedIn: "https://www.linkedin.com/company/139593914",
    founderLinkedIn: "https://www.linkedin.com/in/efeerenakar0",
    founderTitle: "Co-Founder & CTO at NexFrame AI and Business CEO AI",
  },
  pricingPreview: {
    eyebrow: "Türkiye launch offer",
    title: "Start with the complete Office experience.",
    office: {
      name: "Office",
      price: "₺11.350",
      cadence: "/ month",
      note: "Türkiye launch pricing",
    },
    enterprise: {
      name: "Enterprise",
      priceLabel: "Contact Sales",
    },
    trialLabel: "14-day free trial",
    noCardLabel: "No credit card required",
    action: {
      label: "View Pricing",
      href: "/realestate#pricing",
      kind: "primary",
      analyticsEvent: "pricing_plan_selected",
    },
  },
  trust: {
    eyebrow: "Operating evidence",
    title: "A working model designed for real business workflows.",
    selectedVariant: "anonymous",
    variants: [
      {
        id: "anonymous",
        isDefault: true,
        statement:
          "Built around measurable, traceable operating loops that keep human approval in control.",
        organizations: [],
      },
    ],
  },
  finalCta: {
    eyebrow: "Start with Real Estate",
    title: "Give your operation a brain that keeps the next action moving.",
    description:
      "Explore the flagship product or request a 14-day Office trial with no credit card required.",
    actions: [
      {
        label: "Request Free Trial",
        href: "/contact?sector=real-estate&intent=trial",
        kind: "primary",
        analyticsEvent: "trial_started",
      },
      {
        label: "Explore Real Estate",
        href: "/realestate",
        kind: "secondary",
        analyticsEvent: "realestate_explored",
      },
    ],
  },
} as const satisfies HomeContent;
