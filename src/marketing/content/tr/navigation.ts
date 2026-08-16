import type { NavigationContent } from "@/marketing/types";

export const navigationContent = {
  locale: "tr",
  brandName: "Business CEO AI",
  brandDescriptor: "İşletim sistemi",
  homeLabel: "Business CEO AI ana sayfa",
  mainMenuLabel: "Ana menü",
  mobileMenuLabel: "Mobil menü",
  openMenuLabel: "Navigasyon menüsünü aç",
  closeMenuLabel: "Navigasyon menüsünü kapat",
  skipToContentLabel: "Ana içeriğe geç",
  language: {
    shortLabel: "EN",
    destinationLabel: "Continue in English",
    href: "/",
  },
  items: [
    { id: "platform", label: "Platform", href: "#platform" },
    { id: "real-estate", label: "Emlak", href: "#real-estate" },
    { id: "industries", label: "Sektörler", href: "#industries" },
    { id: "how-it-works", label: "Nasıl Çalışır", href: "#how-it-works" },
    { id: "pricing", label: "Fiyatlandırma", href: "#pricing" },
    { id: "about", label: "Hakkımızda", href: "#about" },
  ],
  signIn: { label: "Giriş Yap", href: "/realestate/login", kind: "secondary" },
  startTrial: {
    label: "Ücretsiz Denemeyi Başlat",
    href: "/tr/contact?sector=real-estate&intent=trial",
    kind: "primary",
  },
  legalLabel: "Yasal",
  legalLinks: [
    { id: "privacy", label: "Gizlilik", href: "/tr/legal/privacy" },
    { id: "terms", label: "Koşullar", href: "/tr/legal/terms" },
    { id: "contact", label: "İletişim", href: "/tr/contact" },
  ],
} as const satisfies NavigationContent;
