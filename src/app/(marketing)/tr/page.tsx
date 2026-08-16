import type { Metadata } from "next";

import "@/styles/spatial-home.css";

import { faqContent } from "@/marketing/content/tr/faq";
import { homeContent } from "@/marketing/content/tr/home";
import { industriesContent } from "@/marketing/content/tr/industries";
import { navigationContent } from "@/marketing/content/tr/navigation";
import { pricingContent } from "@/marketing/content/tr/pricing";
import { absoluteSiteUrl } from "@/marketing/seo/site";
import {
  SpatialHomePage,
  type SpatialHomePageContent,
} from "@/marketing/sections/home/spatial-home-page";

const pageUrl = absoluteSiteUrl(homeContent.metadata.canonicalPath);
const organizationUrl = absoluteSiteUrl("/#organization");

export const metadata: Metadata = {
  title: homeContent.metadata.title,
  description: homeContent.metadata.description,
  alternates: {
    canonical: homeContent.metadata.canonicalPath,
    languages: {
      en: "/",
      tr: homeContent.metadata.canonicalPath,
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    url: homeContent.metadata.canonicalPath,
    title: homeContent.metadata.title,
    description: homeContent.metadata.description,
    locale: "tr_TR",
    alternateLocale: ["en_US"],
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: homeContent.metadata.title,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: homeContent.metadata.title,
    description: homeContent.metadata.description,
    images: ["/og.png"],
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@id": organizationUrl,
    "@type": "Organization",
    name: homeContent.brand.name,
    url: absoluteSiteUrl("/"),
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: homeContent.brand.name,
    description: homeContent.metadata.description,
    inLanguage: "tr-TR",
    publisher: { "@id": organizationUrl },
    url: pageUrl,
  },
] as const;

const pageContent = {
  faq: faqContent,
  home: homeContent,
  industries: industriesContent,
  navigation: navigationContent,
  pricing: pricingContent,
} satisfies SpatialHomePageContent;

export default function TurkishHomeRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <SpatialHomePage content={pageContent} />
    </>
  );
}
