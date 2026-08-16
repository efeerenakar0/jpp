import { industriesContent as englishIndustries } from "./en/industries";
import { industriesContent as turkishIndustries } from "./tr/industries";
import type {
  DevelopingIndustryEntry,
  IndustriesContent,
  Locale,
} from "@/marketing/types";

export const DEVELOPING_INDUSTRY_SLUGS = [
  "hospitality",
  "restaurants",
  "wholesale",
  "construction",
] as const satisfies readonly DevelopingIndustryEntry["id"][];

export type DevelopingIndustrySlug = (typeof DEVELOPING_INDUSTRY_SLUGS)[number];

export interface IndustryPagePresentation {
  readonly statusHeading: string;
  readonly developmentNote: string;
  readonly unavailableLabel: string;
  readonly backLabel: string;
  readonly pathLabel: string;
  readonly pathSteps: readonly [string, string, string];
  readonly problemsLabel: string;
  readonly problemsTitle: string;
  readonly modelLabel: string;
  readonly outcomesLabel: string;
  readonly ctaEyebrow: string;
  readonly ctaTitle: string;
  readonly ctaDescription: string;
  readonly homeBreadcrumb: string;
  readonly industriesBreadcrumb: string;
}

export interface IndustryPageContent {
  readonly industries: IndustriesContent;
  readonly sector: DevelopingIndustryEntry;
  readonly presentation: IndustryPagePresentation;
}

const presentationByLocale = {
  en: {
    statusHeading: "Availability",
    developmentNote: "Development brief — not a released product page.",
    unavailableLabel: "Not available as a released product today.",
    backLabel: "Back to the industry overview",
    pathLabel: "Operating path",
    pathSteps: ["Operational problems", "Future operating model", "Planned outcomes"],
    problemsLabel: "Operational reality",
    problemsTitle: "The friction this model is being shaped around.",
    modelLabel: "Development direction",
    outcomesLabel: "Planned outcomes",
    ctaEyebrow: "Development partnership",
    ctaTitle: "Bring real operating context into the model.",
    ctaDescription:
      "Choose a founding-partner conversation or book a demo discussion. These contact paths do not imply that the sector product is released.",
    homeBreadcrumb: "Business CEO AI home",
    industriesBreadcrumb: "Industries",
  },
  tr: {
    statusHeading: "Kullanılabilirlik",
    developmentNote: "Geliştirme özeti — yayınlanmış bir ürün sayfası değildir.",
    unavailableLabel: "Bugün yayınlanmış bir ürün olarak kullanıma sunulmamaktadır.",
    backLabel: "Sektör görünümüne dön",
    pathLabel: "Operasyon yolu",
    pathSteps: ["Operasyon sorunları", "Gelecek işletim modeli", "Planlanan sonuçlar"],
    problemsLabel: "Operasyon gerçeği",
    problemsTitle: "Bu modelin çözmek üzere şekillendirildiği sürtünmeler.",
    modelLabel: "Geliştirme yönü",
    outcomesLabel: "Planlanan sonuçlar",
    ctaEyebrow: "Geliştirme iş ortaklığı",
    ctaTitle: "Gerçek operasyon bağlamını modele taşıyın.",
    ctaDescription:
      "Kurucu iş ortaklığı görüşmesini seçin veya demo görüşmesi talep edin. Bu iletişim yolları sektör ürününün yayınlandığı anlamına gelmez.",
    homeBreadcrumb: "Business CEO AI ana sayfa",
    industriesBreadcrumb: "Sektörler",
  },
} as const satisfies Readonly<Record<Locale, IndustryPagePresentation>>;

export function isDevelopingIndustrySlug(value: string): value is DevelopingIndustrySlug {
  return (DEVELOPING_INDUSTRY_SLUGS as readonly string[]).includes(value);
}

export function getIndustryRoutePath(
  locale: Locale,
  slug: DevelopingIndustrySlug,
): string {
  return locale === "tr" ? `/tr/industries/${slug}` : `/industries/${slug}`;
}

export function getIndustryPageContent(
  locale: Locale,
  slug: string,
): IndustryPageContent | undefined {
  if (!isDevelopingIndustrySlug(slug)) {
    return undefined;
  }

  const industries = locale === "tr" ? turkishIndustries : englishIndustries;
  const sector = industries.sectors.find((entry) => entry.id === slug);

  if (!sector || sector.status !== "in-active-development") {
    return undefined;
  }

  return {
    industries,
    sector,
    presentation: presentationByLocale[locale],
  };
}
