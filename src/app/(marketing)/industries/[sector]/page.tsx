import type { Metadata } from "next";
import { notFound } from "next/navigation";

import "@/styles/industries.css";

import {
  DEVELOPING_INDUSTRY_SLUGS,
  getIndustryPageContent,
  getIndustryRoutePath,
} from "@/marketing/content/industry-page";
import { IndustryPage } from "@/marketing/sections/industries/industry-page";
import { absoluteSiteUrl } from "@/marketing/seo/site";

interface IndustryRouteProps {
  readonly params: Promise<{ readonly sector: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return DEVELOPING_INDUSTRY_SLUGS.map((sector) => ({ sector }));
}

export async function generateMetadata({ params }: IndustryRouteProps): Promise<Metadata> {
  const { sector: slug } = await params;
  const content = getIndustryPageContent("en", slug);

  if (!content) {
    return {};
  }

  const canonicalPath = getIndustryRoutePath("en", content.sector.id);
  const turkishPath = getIndustryRoutePath("tr", content.sector.id);
  const title = `${content.sector.name} — In active development | Business CEO AI`;
  const description = content.sector.futureOperatingModel.description;

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: canonicalPath,
      languages: { en: canonicalPath, tr: turkishPath, "x-default": canonicalPath },
    },
    openGraph: {
      type: "website",
      url: canonicalPath,
      title,
      description,
      locale: "en_US",
      alternateLocale: ["tr_TR"],
      images: [{ url: "/og.png", width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

export default async function EnglishIndustryRoute({ params }: IndustryRouteProps) {
  const { sector: slug } = await params;
  const content = getIndustryPageContent("en", slug);

  if (!content) {
    notFound();
  }

  const canonicalPath = getIndustryRoutePath("en", content.sector.id);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: content.presentation.homeBreadcrumb,
        item: absoluteSiteUrl("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: content.presentation.industriesBreadcrumb,
        item: absoluteSiteUrl("/#industries"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: content.sector.name,
        item: absoluteSiteUrl(canonicalPath),
      },
    ],
  } as const;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <IndustryPage content={content} />
    </>
  );
}
