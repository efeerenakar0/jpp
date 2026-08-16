import type { Metadata } from "next";

import "@/styles/realestate.css";

import { faqContent } from "@/marketing/content/tr/faq";
import { homeContent } from "@/marketing/content/tr/home";
import { navigationContent } from "@/marketing/content/tr/navigation";
import { pricingContent } from "@/marketing/content/tr/pricing";
import { realEstateContent } from "@/marketing/content/tr/realestate";
import { absoluteSiteUrl } from "@/marketing/seo/site";
import {
  RealEstatePage,
  type RealEstatePageContent,
} from "@/marketing/sections/realestate/realestate-page";

const pageUrl = absoluteSiteUrl(realEstateContent.metadata.canonicalPath);
const organizationUrl = absoluteSiteUrl("/#organization");

export const metadata: Metadata = {
  title: realEstateContent.metadata.title,
  description: realEstateContent.metadata.description,
  alternates: {
    canonical: realEstateContent.metadata.canonicalPath,
    languages: {
      en: "/realestate",
      tr: realEstateContent.metadata.canonicalPath,
      "x-default": "/realestate",
    },
  },
  openGraph: {
    type: "website",
    url: realEstateContent.metadata.canonicalPath,
    title: realEstateContent.metadata.title,
    description: realEstateContent.metadata.description,
    locale: "tr_TR",
    alternateLocale: ["en_US"],
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: realEstateContent.metadata.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: realEstateContent.metadata.title,
    description: realEstateContent.metadata.description,
    images: ["/og.png"],
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: realEstateContent.hero.eyebrow,
    description: realEstateContent.metadata.description,
    applicationCategory: "BusinessApplication",
    inLanguage: "tr-TR",
    operatingSystem: "Web",
    url: pageUrl,
    publisher: {
      "@id": organizationUrl,
      "@type": "Organization",
      name: homeContent.brand.name,
      url: absoluteSiteUrl("/"),
    },
    offers: {
      "@type": "Offer",
      price: pricingContent.plans[0].price.amount,
      priceCurrency: pricingContent.plans[0].price.currency,
      url: absoluteSiteUrl(pricingContent.plans[0].action.href),
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Business CEO AI ana sayfa",
        item: absoluteSiteUrl("/tr"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: realEstateContent.hero.eyebrow,
        item: pageUrl,
      },
    ],
  },
] as const;

const pageContent = {
  faq: faqContent,
  home: homeContent,
  navigation: navigationContent,
  pricing: pricingContent,
  realEstate: realEstateContent,
} satisfies RealEstatePageContent;

export default function TurkishRealEstateRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <RealEstatePage content={pageContent} />
    </>
  );
}
