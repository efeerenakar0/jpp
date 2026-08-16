import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Handshake,
  MessageSquareText,
  Network,
  Radar,
} from "lucide-react";

import { MarketingFaq } from "@/marketing/components/feedback/marketing-faq";
import { SpatialCapabilityField } from "@/marketing/components/media/spatial-capability-field";
import { SpatialOperatingCore } from "@/marketing/components/media/spatial-operating-core";
import { MarketingHeader } from "@/marketing/components/navigation/marketing-header";
import { faqContent as defaultFaqContent } from "@/marketing/content/en/faq";
import { homeContent as defaultHomeContent } from "@/marketing/content/en/home";
import { industriesContent as defaultIndustriesContent } from "@/marketing/content/en/industries";
import { navigationContent as defaultNavigationContent } from "@/marketing/content/en/navigation";
import { pricingContent as defaultPricingContent } from "@/marketing/content/en/pricing";
import { AnimeMarketingMotionShell } from "@/marketing/motion/anime/marketing-motion-shell";
import type {
  ContentAction,
  FaqContent,
  HomeContent,
  IndustriesContent,
  NavigationContent,
  PricingContent,
} from "@/marketing/types";

const capabilityIcons = {
  "whatsapp-operations": MessageSquareText,
  "portfolio-hunter": Radar,
  "general-manager": Network,
  "human-handoff": Handshake,
} as const;

type LinkAction = Pick<ContentAction, "href" | "label"> & {
  readonly kind?: ContentAction["kind"];
};

function SpatialActionLink({ action }: { readonly action: LinkAction }) {
  const variant = action.kind && action.kind !== "primary" ? "secondary" : "primary";

  return (
    <a className={`bceo-spatial-button bceo-spatial-button--${variant}`} href={action.href}>
      {action.label}
      {variant === "primary" ? (
        <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} />
      ) : (
        <ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} />
      )}
    </a>
  );
}

export interface SpatialHomePageContent {
  readonly faq: FaqContent;
  readonly home: HomeContent;
  readonly industries: IndustriesContent;
  readonly navigation: NavigationContent;
  readonly pricing: PricingContent;
}

export interface SpatialHomePageProps {
  readonly content?: SpatialHomePageContent;
}

const defaultContent = {
  faq: defaultFaqContent,
  home: defaultHomeContent,
  industries: defaultIndustriesContent,
  navigation: defaultNavigationContent,
  pricing: defaultPricingContent,
} satisfies SpatialHomePageContent;

export function SpatialHomePage({ content = defaultContent }: SpatialHomePageProps = {}) {
  const {
    faq: faqContent,
    home: homeContent,
    industries: industriesContent,
    navigation: navigationContent,
    pricing: pricingContent,
  } = content;
  const [, secondaryAction, signInAction] = homeContent.hero.actions;
  const officePlan = pricingContent.plans[0];
  const enterprisePlan = pricingContent.plans[1];
  const developingIndustries = industriesContent.sectors.filter(
    (sector) => sector.status === "in-active-development",
  );
  const orderedIndustries = [...industriesContent.sectors].sort(
    (first, second) => first.roadmapPriority - second.roadmapPriority,
  );
  const selectedTrust = homeContent.trust.variants.find(
    (variant) => variant.id === homeContent.trust.selectedVariant,
  );
  const signalLabels = homeContent.operationalLoop.steps.map((step) => step.label);
  const industriesNavItem = navigationContent.items.find((item) => item.id === "industries");

  return (
    <AnimeMarketingMotionShell
      className="bceo-site--home bceo-site--spatial-home"
      data-bceo-theme="spatial"
      id="top"
      lang={homeContent.locale}
    >
      <a className="bceo-skip-link" href="#main-content">
        {navigationContent.skipToContentLabel}
      </a>
      <MarketingHeader content={navigationContent} />

      <nav
        aria-labelledby="industry-rail-title"
        className="bceo-industry-rail bceo-spatial-industry-rail"
        data-industry-rail
      >
        <div className="bceo-container bceo-spatial-industry-rail__inner">
          <div className="bceo-spatial-industry-rail__intro">
            <span id="industry-rail-title">
              {industriesNavItem?.label ?? industriesContent.hero.eyebrow}
            </span>
            <small>{homeContent.industriesPreview.flagshipLabel}</small>
          </div>
          <ul>
            {orderedIndustries.map((sector, index) => (
              <li key={sector.id}>
                <a
                  data-industry-card={sector.id}
                  data-industry-status={sector.status}
                  href={sector.route}
                >
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <strong>{sector.name}</strong>
                  <small>{sector.statusLabel}</small>
                  <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.6} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1}>
        <section className="bceo-spatial-hero" aria-labelledby="home-hero-title" data-hero>
          <div className="bceo-container bceo-spatial-hero__grid">
            <div className="bceo-spatial-hero__copy" data-hero-copy>
              <p className="bceo-spatial-kicker">{homeContent.presentation.heroIndexLabel}</p>
              <h1 id="home-hero-title">{homeContent.hero.title}</h1>
              <p className="bceo-spatial-hero__lead">{homeContent.hero.supportingCopy}</p>
              <div className="bceo-spatial-actions">
                <SpatialActionLink
                  action={{
                    href: navigationContent.startTrial.href,
                    label: navigationContent.startTrial.label,
                  }}
                />
                <SpatialActionLink action={{ ...secondaryAction, kind: "secondary" }} />
              </div>
              <div className="bceo-spatial-hero__trustline">
                <span>{homeContent.pricingPreview.trialLabel}</span>
                <span>{homeContent.pricingPreview.noCardLabel}</span>
                <a href={signInAction.href}>{signInAction.label}</a>
              </div>
            </div>

            <figure className="bceo-spatial-hero__stage" data-hero-core>
              <div data-hero-parallax>
                <SpatialOperatingCore
                  ariaLabel={homeContent.presentation.systemFigureLabel}
                  signalLabels={signalLabels}
                />
              </div>
              <figcaption>
                <span>{homeContent.presentation.systemModelLabel}</span>
                <span>{homeContent.presentation.humanInLoopLabel}</span>
              </figcaption>
            </figure>
          </div>
          <div className="bceo-container bceo-spatial-hero__footer" aria-hidden="true">
            <span>{homeContent.presentation.heroAudienceLabel}</span>
            <span>
              {homeContent.locale === "tr"
                ? "Mekânsal operasyon alanı · 01"
                : "Spatial operating field · 01"}
            </span>
          </div>
        </section>

        <section
          className="bceo-spatial-platform"
          id="platform"
          aria-labelledby="manifesto-title"
        >
          <div className="bceo-container">
            <div className="bceo-spatial-statement" data-reveal>
              <div>
                <p className="bceo-spatial-kicker">{homeContent.manifesto.eyebrow}</p>
                <h2 id="manifesto-title">{homeContent.manifesto.title}</h2>
              </div>
              <p>{homeContent.manifesto.body}</p>
            </div>

            <div
              className="bceo-spatial-loop"
              id="how-it-works"
              aria-labelledby="loop-title"
              data-loop
            >
              <div className="bceo-spatial-loop__header" data-reveal>
                <p className="bceo-spatial-kicker">{homeContent.operationalLoop.eyebrow}</p>
                <h2 id="loop-title">{homeContent.operationalLoop.title}</h2>
                <p>{homeContent.operationalLoop.introduction}</p>
              </div>
              <ol>
                {homeContent.operationalLoop.steps.map((step, index) => (
                  <li data-loop-step key={step.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <i aria-hidden="true" />
                    <div>
                      <h3>{step.label}</h3>
                      <p>{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section
          className="bceo-spatial-product"
          id="real-estate"
          aria-labelledby="flagship-title"
        >
          <div className="bceo-container">
            <header className="bceo-spatial-section-head" data-reveal>
              <div>
                <p className="bceo-spatial-kicker">{homeContent.flagship.eyebrow}</p>
                <h2 id="flagship-title">{homeContent.flagship.title}</h2>
              </div>
              <div>
                <p>{homeContent.flagship.description}</p>
                <div className="bceo-spatial-actions">
                  {homeContent.flagship.actions.map((action) => (
                    <SpatialActionLink action={action} key={action.label} />
                  ))}
                </div>
              </div>
            </header>

            <SpatialCapabilityField>
              {homeContent.flagship.capabilities.map((capability, index) => {
                const Icon = capabilityIcons[capability.id];

                return (
                  <article data-reveal-card key={capability.id}>
                    <div>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <Icon aria-hidden="true" size={19} strokeWidth={1.45} />
                    </div>
                    <p>{capability.signalLabel}</p>
                    <h3>{capability.title}</h3>
                    <p>{capability.description}</p>
                  </article>
                );
              })}
            </SpatialCapabilityField>

            <div className="bceo-spatial-workforce" data-reveal>
              <div>
                <p className="bceo-spatial-kicker">{homeContent.workforce.eyebrow}</p>
                <h2>{homeContent.workforce.title}</h2>
              </div>
              <ol aria-label={homeContent.presentation.workforceMapLabel}>
                {homeContent.workforce.roles.map((role, index) => (
                  <li key={role.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{role.label}</h3>
                      <p>{role.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="bceo-spatial-proof" aria-labelledby="proof-title">
          <div className="bceo-container">
            <header className="bceo-spatial-section-head" data-reveal>
              <div>
                <p className="bceo-spatial-kicker">{homeContent.proof.eyebrow}</p>
                <h2 id="proof-title">{homeContent.proof.title}</h2>
              </div>
              <p>{homeContent.proof.disclaimer}</p>
            </header>
            <div className="bceo-spatial-proof__metrics">
              {homeContent.proof.metrics.map((metric, index) => (
                <article data-reveal-card key={metric.id}>
                  <span>0{index + 1}</span>
                  <strong>{metric.value}</strong>
                  <h3>{metric.statement}</h3>
                  <p>{metric.context}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="bceo-spatial-industries"
          id="industries"
          aria-labelledby="industries-title"
        >
          <div className="bceo-container">
            <header className="bceo-spatial-section-head" data-reveal>
              <div>
                <p className="bceo-spatial-kicker">{homeContent.industriesPreview.eyebrow}</p>
                <h2 id="industries-title">{homeContent.industriesPreview.title}</h2>
              </div>
              <p>{homeContent.industriesPreview.description}</p>
            </header>
            <ol>
              {developingIndustries.map((industry, index) => (
                <li data-reveal-card key={industry.id}>
                  <span>{String(index + 2).padStart(2, "0")}</span>
                  <Building2 aria-hidden="true" size={20} strokeWidth={1.4} />
                  <div>
                    <small>{industry.statusLabel}</small>
                    <h3>{industry.name}</h3>
                    <p>{industry.summary}</p>
                  </div>
                  <a href={industry.actions[0]?.href ?? faqContent.contactPrompt.action.href}>
                    {industry.actions[0]?.label ?? faqContent.contactPrompt.action.label}
                    <ArrowUpRight aria-hidden="true" size={16} />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          className="bceo-spatial-pricing"
          id="pricing"
          aria-labelledby="pricing-title"
        >
          <div className="bceo-container">
            <header className="bceo-spatial-section-head" data-reveal>
              <div>
                <p className="bceo-spatial-kicker">{homeContent.pricingPreview.eyebrow}</p>
                <h2 id="pricing-title">{homeContent.pricingPreview.title}</h2>
              </div>
              <p>
                {homeContent.pricingPreview.trialLabel}. {homeContent.pricingPreview.noCardLabel}.
              </p>
            </header>
            <div className="bceo-spatial-pricing__grid">
              <article data-reveal-card>
                <div className="bceo-spatial-pricing__topline">
                  <span>{officePlan.name}</span>
                  <small>{homeContent.pricingPreview.trialLabel}</small>
                </div>
                <strong>
                  {officePlan.price.formatted}
                  <small> {officePlan.price.cadenceLabel}</small>
                </strong>
                <p>{officePlan.audience}</p>
                <ul>
                  {officePlan.features.slice(0, 5).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <SpatialActionLink action={officePlan.action} />
              </article>
              <article data-reveal-card>
                <div className="bceo-spatial-pricing__topline">
                  <span>{enterprisePlan.name}</span>
                  <small>{homeContent.presentation.tailoredOperationsLabel}</small>
                </div>
                <strong>{enterprisePlan.priceLabel}</strong>
                <p>{enterprisePlan.audience}</p>
                <ul>
                  {enterprisePlan.features.slice(0, 5).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <SpatialActionLink action={{ ...enterprisePlan.action, kind: "secondary" }} />
              </article>
            </div>
          </div>
        </section>

        <section className="bceo-spatial-evidence" id="about" aria-labelledby="trust-title">
          <div className="bceo-container">
            <div className="bceo-spatial-evidence__grid" data-reveal>
              <div>
                <p className="bceo-spatial-kicker">{homeContent.trust.eyebrow}</p>
                <h2 id="trust-title">{homeContent.trust.title}</h2>
              </div>
              <div className="bceo-spatial-evidence__copy">
                <p>{selectedTrust?.statement}</p>
                <span>{homeContent.ownership.statement}</span>
                <div>
                  <a href={homeContent.ownership.nexFrameLinkedIn} rel="noreferrer" target="_blank">
                    {homeContent.ownership.developerName}
                    <ArrowUpRight aria-hidden="true" size={14} />
                  </a>
                  <a href={homeContent.ownership.founderLinkedIn} rel="noreferrer" target="_blank">
                    {homeContent.presentation.founderLinkLabel}
                    <ArrowUpRight aria-hidden="true" size={14} />
                  </a>
                </div>
              </div>
            </div>

            <div className="bceo-spatial-faq" id="faq">
              <div data-reveal>
                <p className="bceo-spatial-kicker">{faqContent.eyebrow}</p>
                <h2>{faqContent.title}</h2>
                <p>{faqContent.introduction}</p>
              </div>
              <MarketingFaq items={faqContent.groups[0].items.slice(0, 5)} />
            </div>
          </div>
        </section>

        <section className="bceo-spatial-final" aria-labelledby="final-title">
          <div className="bceo-container bceo-spatial-final__inner" data-reveal>
            <div className="bceo-spatial-final__orb" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="bceo-spatial-kicker">{homeContent.finalCta.eyebrow}</p>
            <h2 id="final-title">{homeContent.finalCta.title}</h2>
            <p>{homeContent.finalCta.description}</p>
            <div className="bceo-spatial-actions">
              {homeContent.finalCta.actions.map((action) => (
                <SpatialActionLink action={action} key={action.label} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bceo-spatial-footer">
        <div className="bceo-container">
          <div>
            <strong>{navigationContent.brandName}</strong>
            <span>{homeContent.brand.tagline}</span>
          </div>
          <p>{homeContent.ownership.statement}</p>
          <nav aria-label={navigationContent.legalLabel}>
            {navigationContent.legalLinks.map((item) => (
              <a href={item.href} key={item.id}>
                {item.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </AnimeMarketingMotionShell>
  );
}
