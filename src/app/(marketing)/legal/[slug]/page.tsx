import type { Metadata } from "next";
import { notFound } from "next/navigation";

import "@/styles/support.css";

import {
  getLegalPageContent,
  isLegalSlug,
  LEGAL_SLUGS,
} from "@/marketing/content/legal";
import { LegalPage } from "@/marketing/sections/legal/legal-page";

export const dynamicParams = false;

export function generateStaticParams() {
  return LEGAL_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;

  if (!isLegalSlug(slug)) {
    return {};
  }

  const content = getLegalPageContent("en", slug);

  return {
    title: content.title,
    description: content.purpose,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `/legal/${slug}`,
      languages: { en: `/legal/${slug}`, tr: `/tr/legal/${slug}`, "x-default": `/legal/${slug}` },
    },
    openGraph: {
      type: "website",
      url: `/legal/${slug}`,
      title: content.title,
      description: content.purpose,
      locale: "en_US",
    },
  };
}

export default async function EnglishLegalRoute({ params }: PageProps<"/legal/[slug]">) {
  const { slug } = await params;

  if (!isLegalSlug(slug)) {
    notFound();
  }

  return <LegalPage locale="en" slug={slug} />;
}
