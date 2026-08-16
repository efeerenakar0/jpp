import type { NavigationContent } from "@/marketing/types";

export const navigationContent = {
  locale: "en",
  brandName: "Business CEO AI",
  brandDescriptor: "Operating system",
  homeLabel: "Business CEO AI home",
  mainMenuLabel: "Main menu",
  mobileMenuLabel: "Mobile menu",
  openMenuLabel: "Open navigation menu",
  closeMenuLabel: "Close navigation menu",
  skipToContentLabel: "Skip to main content",
  language: {
    shortLabel: "TR",
    destinationLabel: "Türkçe devam et",
    href: "/tr",
  },
  items: [
    { id: "platform", label: "Platform", href: "#platform" },
    { id: "real-estate", label: "Real Estate", href: "#real-estate" },
    { id: "industries", label: "Industries", href: "#industries" },
    { id: "how-it-works", label: "How It Works", href: "#how-it-works" },
    { id: "pricing", label: "Pricing", href: "#pricing" },
    { id: "about", label: "About", href: "#about" },
  ],
  signIn: { label: "Sign In", href: "/realestate/login", kind: "secondary" },
  startTrial: {
    label: "Start Free Trial",
    href: "/contact?sector=real-estate&intent=trial",
    kind: "primary",
  },
  legalLabel: "Legal",
  legalLinks: [
    { id: "privacy", label: "Privacy", href: "/legal/privacy" },
    { id: "terms", label: "Terms", href: "/legal/terms" },
    { id: "contact", label: "Contact", href: "/contact" },
  ],
} as const satisfies NavigationContent;
