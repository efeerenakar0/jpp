import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { MarketingHeader } from "@/marketing/components/navigation/marketing-header";
import type { IndustryPageContent } from "@/marketing/content/industry-page";
import { navigationContent as englishNavigation } from "@/marketing/content/en/navigation";
import { navigationContent as turkishNavigation } from "@/marketing/content/tr/navigation";
import type { ContentAction, NavigationContent } from "@/marketing/types";

function createIndustryNavigation(content: IndustryPageContent): NavigationContent {
  const { sector } = content;
  const source = content.industries.locale === "tr" ? turkishNavigation : englishNavigation;
  const homePath = source.locale === "tr" ? "/tr" : "/";
  const alternatePath =
    source.locale === "tr"
      ? `/industries/${sector.id}`
      : `/tr/industries/${sector.id}`;

  return {
    ...source,
    language: { ...source.language, href: alternatePath },
    items: source.items.map((item) => ({ ...item, href: `${homePath}${item.href}` })),
  };
}

function ActionLink({ action }: { readonly action: ContentAction }) {
  const isPrimary = action.kind === "primary";

  return (
    <Link
      className={`bceo-button bceo-button--${isPrimary ? "primary" : "secondary"}`}
      href={action.href}
    >
      {action.label}
      {isPrimary ? (
        <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} />
      ) : (
        <ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} />
      )}
    </Link>
  );
}

export interface IndustryPageProps {
  readonly content: IndustryPageContent;
}

export function IndustryPage({ content }: IndustryPageProps) {
  const { industries, presentation, sector } = content;
  const navigation = createIndustryNavigation(content);
  const homePath = industries.locale === "tr" ? "/tr" : "/";
  const [foundingPartnerAction, demoAction] = sector.actions;

  return (
    <div
      className="bceo-site bceo-site--industry"
      data-industry-status={sector.status}
      id="top"
      lang={industries.locale}
    >
      <a className="bceo-skip-link" href="#industry-main">
        {navigation.skipToContentLabel}
      </a>
      <MarketingHeader content={navigation} homeHref={homePath} />

      <div className="bceo-industry-bar">
        <div className="bceo-container bceo-industry-bar__inner">
          <Link href={`${homePath}#industries`}>
            <ArrowLeft aria-hidden="true" size={15} strokeWidth={1.8} />
            {presentation.backLabel}
          </Link>
          <span>{sector.name}</span>
          <span className="bceo-industry-bar__status">
            <i aria-hidden="true" />
            {sector.statusLabel}
          </span>
        </div>
      </div>

      <main id="industry-main" tabIndex={-1}>
        <section className="bceo-industry-hero" aria-labelledby="industry-title">
          <div className="bceo-container bceo-industry-hero__grid">
            <div className="bceo-industry-hero__index" aria-hidden="true">
              <span>{String(sector.roadmapPriority).padStart(2, "0")}</span>
              <i />
              <span>05</span>
            </div>

            <div className="bceo-industry-hero__copy">
              <p className="bceo-industry-kicker">{sector.eyebrow}</p>
              <h1 id="industry-title">{sector.headline}</h1>
              <p className="bceo-industry-hero__summary">{sector.summary}</p>
              <Link className="bceo-industry-hero__action" href={foundingPartnerAction.href}>
                {foundingPartnerAction.label}
                <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.7} />
              </Link>
            </div>

            <nav className="bceo-industry-path" aria-label={presentation.pathLabel}>
              <span>{presentation.pathLabel}</span>
              <ol>
                <li>
                  <a href="#operational-problems">
                    <span>01</span>
                    {presentation.pathSteps[0]}
                  </a>
                </li>
                <li>
                  <a href="#future-operating-model">
                    <span>02</span>
                    {presentation.pathSteps[1]}
                  </a>
                </li>
                <li>
                  <a href="#planned-outcomes">
                    <span>03</span>
                    {presentation.pathSteps[2]}
                  </a>
                </li>
              </ol>
            </nav>
          </div>
        </section>

        <aside
          className="bceo-industry-disclosure"
          aria-labelledby="industry-availability-title"
          id="industry-development-disclaimer"
        >
          <div className="bceo-container bceo-industry-disclosure__grid">
            <div>
              <span>{presentation.statusHeading}</span>
              <h2 id="industry-availability-title">{presentation.developmentNote}</h2>
            </div>
            <div>
              <strong>{presentation.unavailableLabel}</strong>
              <p>{industries.developmentDisclaimer}</p>
            </div>
          </div>
        </aside>

        <section
          className="bceo-industry-problems"
          id="operational-problems"
          aria-labelledby="industry-problems-title"
        >
          <div className="bceo-container bceo-industry-problems__grid">
            <header>
              <p>{presentation.problemsLabel}</p>
              <h2 id="industry-problems-title">{presentation.problemsTitle}</h2>
            </header>

            <ol>
              {sector.operationalProblems.map((problem, index) => (
                <li key={problem}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{problem}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="bceo-industry-model"
          id="future-operating-model"
          aria-labelledby="industry-model-title"
        >
          <div className="bceo-container bceo-industry-model__grid">
            <header>
              <p>{presentation.modelLabel}</p>
              <h2 id="industry-model-title">{sector.futureOperatingModel.title}</h2>
              <p>{sector.futureOperatingModel.description}</p>
            </header>

            <div className="bceo-industry-outcomes" id="planned-outcomes">
              <h3>{presentation.outcomesLabel}</h3>
              <ol>
                {sector.futureOperatingModel.plannedOutcomes.map((outcome, index) => (
                  <li key={outcome}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{outcome}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="bceo-industry-cta" aria-labelledby="industry-cta-title">
          <div className="bceo-container bceo-industry-cta__grid">
            <p>{presentation.ctaEyebrow}</p>
            <div>
              <h2 id="industry-cta-title">{presentation.ctaTitle}</h2>
              <p>{presentation.ctaDescription}</p>
              <div className="bceo-industry-cta__actions">
                <ActionLink action={foundingPartnerAction} />
                <ActionLink action={demoAction} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bceo-footer">
        <div className="bceo-container bceo-footer__inner">
          <div>
            <strong>{navigation.brandName}</strong>
            <span>{navigation.brandDescriptor}</span>
          </div>
          <p>{industries.developmentDisclaimer}</p>
          <nav aria-label={navigation.legalLabel}>
            {navigation.legalLinks.map((item) => (
              <a href={item.href} key={item.id}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
