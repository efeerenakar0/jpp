import type { Metadata } from "next";

import "@/styles/spatial-home.css";

import { homeContent } from "@/marketing/content/en/home";
import { absoluteSiteUrl } from "@/marketing/seo/site";
import { SpatialHomePage } from "@/marketing/sections/home/spatial-home-page";

export const metadata: Metadata = {
  title: homeContent.metadata.title,
  description: homeContent.metadata.description,
  alternates: {
    canonical: "/",
    languages: { en: "/", tr: "/tr", "x-default": "/" },
  },
  openGraph: {
    type: "website",
    url: "/",
    title: homeContent.metadata.title,
    description: homeContent.metadata.description,
    locale: "en_US",
    alternateLocale: ["tr_TR"],
    images: [{ url: "/og.png", width: 1200, height: 630, alt: homeContent.metadata.title }],
  },
  twitter: {
    card: "summary_large_image",
    title: homeContent.metadata.title,
    description: homeContent.metadata.description,
    images: ["/og.png"],
  },
};

const websiteStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: homeContent.brand.name,
  description: homeContent.metadata.description,
  inLanguage: "en",
  url: absoluteSiteUrl("/"),
} as const;

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(websiteStructuredData).replace(/</g, "\\u003c"),
        }}
      />
      <SpatialHomePage />
    </>
  );
}
