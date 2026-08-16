import type { Metadata } from "next";

import "@/styles/realestate.css";

import { realEstateContent } from "@/marketing/content/en/realestate";
import { pricingContent } from "@/marketing/content/en/pricing";
import { absoluteSiteUrl, siteOrigin } from "@/marketing/seo/site";
import { RealEstatePage } from "@/marketing/sections/realestate/realestate-page";

const pageUrl = absoluteSiteUrl(realEstateContent.metadata.canonicalPath);

export const metadata: Metadata = {
  title: realEstateContent.metadata.title,
  description: realEstateContent.metadata.description,
  alternates: {
    canonical: realEstateContent.metadata.canonicalPath,
    languages: {
      en: realEstateContent.metadata.canonicalPath,
      tr: "/tr/realestate",
      "x-default": realEstateContent.metadata.canonicalPath,
    },
  },
  openGraph: {
    type: "website",
    url: realEstateContent.metadata.canonicalPath,
    title: realEstateContent.metadata.title,
    description: realEstateContent.metadata.description,
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
    operatingSystem: "Web",
    url: pageUrl,
    publisher: {
      "@type": "Organization",
      name: "Business CEO AI",
      url: siteOrigin.origin,
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
        name: "Business CEO AI",
        item: absoluteSiteUrl("/"),
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

export default function RealEstateRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <RealEstatePage />
    </>
  );
}
