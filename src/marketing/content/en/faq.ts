import type { FaqContent } from "@/marketing/types";

export const faqContent = {
  locale: "en",
  metadata: {
    title: "Frequently Asked Questions | Business CEO AI",
    description:
      "Answers about Business CEO AI, the Real Estate product, trials, pricing, human handoff and data principles.",
    canonicalPath: "/#faq",
  },
  eyebrow: "Questions, answered clearly",
  title: "What businesses and teams need to know.",
  introduction:
    "Business CEO AI is an operating system for coordinated work—not a generic chatbot, an invented promise or a replacement for human judgment.",
  groups: [
    {
      id: "general",
      title: "Business CEO AI",
      description: "The platform, company and direction behind the flagship real estate product.",
      items: [
        {
          id: "what-is-business-ceo-ai",
          question: "What is Business CEO AI?",
          answer:
            "Business CEO AI is an AI Business Operating System. It is designed to coordinate customer communication, employee knowledge, sales activity, appointments, opportunities and owner visibility through one intelligent operating layer.",
        },
        {
          id: "is-it-a-chatbot",
          question: "Is Business CEO AI a chatbot?",
          answer:
            "No. Conversation can be one interface, but the product is positioned as the operating brain between customers, employees and owners. It coordinates multiple workflows and carries context toward action and reporting.",
        },
        {
          id: "which-industries",
          question: "Is Business CEO AI only for real estate?",
          answer:
            "No. Real Estate is the active flagship product. Restaurant, hospitality, construction and wholesale operating models are in active development and are not presented as released products.",
        },
        {
          id: "does-ai-replace-team",
          question: "Does the AI replace employees?",
          answer:
            "The operating model keeps people in the loop. AI handles routine understanding and coordination, then brings in the appropriate employee when judgment, relationship ownership or a decision is needed.",
        },
        {
          id: "who-builds-it",
          question: "Who develops Business CEO AI?",
          answer:
            "Business CEO AI is developed by NexFrame AI in collaboration with KatEXtrema AI.",
        },
        {
          id: "where-starting",
          question: "Where is Business CEO AI launching first?",
          answer:
            "The first market is Türkiye. The website and product story support English and Turkish, with English as the default global language.",
        },
        {
          id: "start-other-industry",
          question: "How can a business in another industry get involved?",
          answer:
            "Select your industry and request a demo or apply to become a founding partner. The contact form keeps the sector selected so the conversation can begin with relevant operating context.",
        },
      ],
    },
    {
      id: "real-estate",
      title: "Business CEO AI for Real Estate",
      description: "Product scope, evidence, trial terms, pricing and data handling.",
      items: [
        {
          id: "what-real-estate-coordinates",
          question: "What does the Real Estate product coordinate?",
          answer:
            "It connects AI-powered WhatsApp operations, need discovery, appointment intent, employee handoff, Portfolio Hunter signals and owner visibility through the AI General Manager.",
        },
        {
          id: "response-time",
          question: "How quickly does it respond to an incoming message?",
          answer:
            "It typically responds within 15 seconds. This describes typical behavior rather than a guaranteed service level; timing can vary with connectivity and workflow conditions.",
        },
        {
          id: "whatsapp-status",
          question: "Does this claim an official provider partnership?",
          answer:
            "No provider partnership or official integration status is claimed. The accurate description is AI-powered WhatsApp operations or intelligent WhatsApp workflows.",
        },
        {
          id: "portfolio-hunter",
          question: "What is Portfolio Hunter?",
          answer:
            "Portfolio Hunter researches for-sale property marketplace signals, helps progress owner conversations and notifies an employee at the authorization stage. It is sales-focused and does not claim affiliation with a named marketplace.",
        },
        {
          id: "human-takeover",
          question: "Can a team member take over a conversation?",
          answer:
            "Yes. The approved disclosure is: “You’re speaking with Business CEO AI’s virtual assistant. A team member can take over at any time.” The handoff is a visible part of the operating flow.",
        },
        {
          id: "trial-terms",
          question: "How does the 14-day trial work?",
          answer:
            "The trial includes Office features for 14 days and requires no credit card. If payment is not completed after the trial, the account is closed or suspended. A trial is intended to be available once per company.",
        },
        {
          id: "pricing",
          question: "What does Business CEO AI for Real Estate cost?",
          answer:
            "Office is ₺11.350 / month under Türkiye launch pricing. Enterprise is Contact Sales. Proposed six- and twelve-month totals are not public because they remain pending approval.",
        },
        {
          id: "data-handling",
          question: "How is conversation data handled?",
          answer:
            "Raw WhatsApp messages are deleted immediately. Structured details such as a name, need, appointment and CRM summary may be retained while an account is active; they are not retained in active systems after account closure. Data is not used for model training, tenant data is isolated, and data is encrypted in transit and in the database.",
        },
      ],
    },
  ],
  contactPrompt: {
    text: "Still deciding whether the operating model fits your business?",
    action: {
      label: "Contact the Team",
      href: "mailto:info@businessceo.ai",
      kind: "secondary",
    },
  },
} as const satisfies FaqContent;
