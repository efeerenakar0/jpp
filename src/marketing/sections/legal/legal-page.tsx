import { ArrowLeft, ArrowUpRight, FileCheck2, Mail } from "lucide-react";

import { MarketingHeader } from "@/marketing/components/navigation/marketing-header";
import { navigationContent as englishNavigation } from "@/marketing/content/en/navigation";
import { getLegalPageContent, type LegalSlug } from "@/marketing/content/legal";
import { navigationContent as turkishNavigation } from "@/marketing/content/tr/navigation";
import type { Locale, NavigationContent } from "@/marketing/types";

function navigationForLegalPage(locale: Locale, slug: LegalSlug): NavigationContent {
  const source = locale === "tr" ? turkishNavigation : englishNavigation;
  const homePath = locale === "tr" ? "/tr" : "/";
  const alternatePath = locale === "tr" ? `/legal/${slug}` : `/tr/legal/${slug}`;

  return {
    ...source,
    language: { ...source.language, href: alternatePath },
    items: source.items.map((item) => ({ ...item, href: `${homePath}${item.href}` })),
  };
}

export interface LegalPageProps {
  readonly locale: Locale;
  readonly slug: LegalSlug;
}

export function LegalPage({ locale, slug }: LegalPageProps) {
  const content = getLegalPageContent(locale, slug);
  const navigation = navigationForLegalPage(locale, slug);
  const homePath = locale === "tr" ? "/tr" : "/";

  return (
    <div className="bceo-support" lang={locale}>
      <a className="bceo-skip-link" href="#legal-content">
        {navigation.skipToContentLabel}
      </a>
      <MarketingHeader content={navigation} homeHref={homePath} />

      <main className="bceo-support__main" id="legal-content" tabIndex={-1}>
        <div className="bceo-container bceo-support__grid">
          <aside className="bceo-support__rail" aria-label={content.indexLabel}>
            <span>LEGAL / {slug.toUpperCase()}</span>
            <strong>{content.status}</strong>
            <span>{content.updatedLabel}</span>
          </aside>

          <article className="bceo-support__document" aria-labelledby="legal-title">
            <div className="bceo-support__mark" aria-hidden="true">
              <FileCheck2 size={25} strokeWidth={1.35} />
            </div>
            <p className="bceo-eyebrow">{content.eyebrow}</p>
            <h1 id="legal-title">{content.title}</h1>
            <p className="bceo-support__lead">{content.purpose}</p>

            <section className="bceo-support__notice" aria-label={content.status}>
              <span>{content.status}</span>
              <p>{content.notice}</p>
              <p>{content.nextStep}</p>
            </section>

            <div className="bceo-support__actions">
              <a className="bceo-button bceo-button--primary" href="mailto:info@businessceo.ai">
                <Mail aria-hidden="true" size={17} />
                {content.contactLabel}
                <ArrowUpRight aria-hidden="true" size={16} />
              </a>
              <a className="bceo-support__back" href={homePath}>
                <ArrowLeft aria-hidden="true" size={16} />
                {content.backLabel}
              </a>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
