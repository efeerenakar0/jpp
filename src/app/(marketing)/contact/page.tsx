import type { Metadata } from "next";

import "@/styles/contact.css";

import { normalizeContactContext, type ContactQueryValue } from "@/marketing/contact";
import { contactContent } from "@/marketing/content/en/contact";
import { ContactPage } from "@/marketing/sections/contact/contact-page";

const socialTitle = `${contactContent.metadata.title} | Business CEO AI`;

export const metadata: Metadata = {
  title: contactContent.metadata.title,
  description: contactContent.metadata.description,
  alternates: {
    canonical: contactContent.metadata.canonicalPath,
    languages: {
      en: "/contact",
      tr: "/tr/contact",
      "x-default": "/contact",
    },
  },
  openGraph: {
    type: "website",
    url: contactContent.metadata.canonicalPath,
    title: socialTitle,
    description: contactContent.metadata.description,
    locale: "en_US",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: socialTitle,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: socialTitle,
    description: contactContent.metadata.description,
    images: ["/og.png"],
  },
};

interface ContactRouteProps {
  readonly searchParams: Promise<Readonly<Record<string, ContactQueryValue>>>;
}

export default async function ContactRoute({ searchParams }: ContactRouteProps) {
  const context = normalizeContactContext(await searchParams);

  return <ContactPage content={contactContent} context={context} />;
}
