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
import { HeroFilmVideo } from "@/marketing/components/media/hero-film-video";
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

function ActionLink({ action }: { action: ContentAction }) {
  const variant = action.kind === "primary" ? "primary" : "secondary";

  return (
    <a className={`bceo-button bceo-button--${variant}`} href={action.href}>
      {action.label}
      {action.kind === "primary" ? (
        <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.8} />
      ) : (
        <ArrowRight aria-hidden="true" size={17} strokeWidth={1.8} />
      )}
    </a>
  );
}

export interface HomeWireframeContent {
  readonly faq: FaqContent;
  readonly home: HomeContent;
  readonly industries: IndustriesContent;
  readonly navigation: NavigationContent;
  readonly pricing: PricingContent;
}

export interface HomeWireframeProps {
  readonly content?: HomeWireframeContent;
}

const defaultContent = {
  faq: defaultFaqContent,
  home: defaultHomeContent,
  industries: defaultIndustriesContent,
  navigation: defaultNavigationContent,
  pricing: defaultPricingContent,
} satisfies HomeWireframeContent;

export function HomeWireframe({ content = defaultContent }: HomeWireframeProps = {}) {
  const {
    faq: faqContent,
    home: homeContent,
    industries: industriesContent,
    navigation: navigationContent,
    pricing: pricingContent,
  } = content;
  const [primaryAction, secondaryAction, signInAction] = homeContent.hero.actions;
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
  const industriesNavItem = navigationContent.items.find((item) => item.id === "industries");

  return (
    <AnimeMarketingMotionShell
      className="bceo-site--home"
      data-bceo-theme="light"
      id="top"
      lang={homeContent.locale}
    >
      <a className="bceo-skip-link" href="#main-content">
        {navigationContent.skipToContentLabel}
      </a>
      <MarketingHeader content={navigationContent} />

      <nav
        className="bceo-industry-rail"
        aria-labelledby="industry-rail-title"
        data-industry-rail
      >
        <div className="bceo-container bceo-industry-rail__inner">
          <div className="bceo-industry-rail__intro">
            <span className="bceo-industry-rail__label" id="industry-rail-title">
              {industriesNavItem?.label ?? industriesContent.hero.eyebrow}
            </span>
            <span className="bceo-industry-rail__descriptor">
              {homeContent.industriesPreview.eyebrow}
            </span>
          </div>
          <ul className="bceo-industry-rail__list">
            {orderedIndustries.map((sector, index) => (
              <li
                className={`bceo-industry-rail__item bceo-industry-rail__item--${sector.status}`}
                key={sector.id}
              >
                <a
                  className="bceo-industry-rail__link"
                  data-industry-card={sector.id}
                  data-industry-status={sector.status}
                  href={sector.route}
                >
                  <span className="bceo-industry-rail__meta">
                    <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.7} />
                  </span>
                  <strong>{sector.name}</strong>
                  <span className="bceo-industry-rail__status">{sector.statusLabel}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1}>
        <section className="bceo-hero" aria-labelledby="home-hero-title" data-hero>
          <div className="bceo-container bceo-hero__grid">
            <div className="bceo-hero__copy" data-hero-copy>
              <p className="bceo-eyebrow">{homeContent.hero.eyebrow}</p>
              <h1 id="home-hero-title">{homeContent.hero.title}</h1>
              <p className="bceo-hero__lead">{homeContent.hero.supportingCopy}</p>
              <div className="bceo-hero__actions">
                <ActionLink action={primaryAction} />
                <ActionLink action={secondaryAction} />
              </div>
              <div className="bceo-hero__microcopy">
                <span>{homeContent.industriesPreview.flagshipLabel}</span>
                <a href={signInAction.href}>
                  {signInAction.label} <ArrowUpRight aria-hidden="true" size={13} />
                </a>
              </div>
            </div>

            <figure
              className="bceo-hero__visual bceo-hero-film bceo-theme-dark"
              aria-label={homeContent.presentation.systemFigureLabel}
              data-hero-core
            >
              <HeroFilmVideo />
              <figcaption className="bceo-hero-film__caption">
                <span>{homeContent.presentation.systemModelLabel}</span>
                <span>{homeContent.presentation.humanInLoopLabel}</span>
              </figcaption>
            </figure>
          </div>
          <div className="bceo-container bceo-hero__baseline" aria-hidden="true">
            <span>{homeContent.presentation.heroIndexLabel}</span>
            <span>{homeContent.presentation.heroAudienceLabel}</span>
          </div>
        </section>

        <section
          className="bceo-section bceo-section--dense bceo-manifesto-section bceo-theme-dark"
          id="platform"
          aria-labelledby="manifesto-title"
          data-reveal
        >
          <div className="bceo-container bceo-manifesto">
            <div className="bceo-manifesto__index" aria-hidden="true">02</div>
            <div className="bceo-manifesto__copy">
              <p className="bceo-eyebrow">{homeContent.manifesto.eyebrow}</p>
              <h2 id="manifesto-title">{homeContent.manifesto.title}</h2>
              <p className="bceo-hero__lead">{homeContent.manifesto.body}</p>
            </div>
            <div className="bceo-manifesto__signal" aria-hidden="true">
              {homeContent.presentation.manifestoFlow.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
        </section>

        <section
          className="bceo-section bceo-section--elevated"
          id="how-it-works"
          aria-labelledby="loop-title"
          data-loop
        >
          <div className="bceo-container">
            <div className="bceo-section__header" data-reveal>
              <div>
                <p className="bceo-eyebrow">{homeContent.operationalLoop.eyebrow}</p>
                <h2 id="loop-title">{homeContent.operationalLoop.title}</h2>
              </div>
              <p>{homeContent.operationalLoop.introduction}</p>
            </div>
            <ol className="bceo-loop">
              {homeContent.operationalLoop.steps.map((step, index) => (
                <li className="bceo-loop__step" key={step.id} data-loop-step>
                  <span className="bceo-loop__index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="bceo-loop__node" aria-hidden="true" />
                  <h3>{step.label}</h3>
                  <p>{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bceo-section" id="real-estate" aria-labelledby="flagship-title">
          <div className="bceo-container">
            <div className="bceo-section__header" data-reveal>
              <div>
                <p className="bceo-eyebrow">{homeContent.flagship.eyebrow}</p>
                <h2 id="flagship-title">{homeContent.flagship.title}</h2>
              </div>
              <p>{homeContent.flagship.description}</p>
            </div>
            <div className="bceo-feature-grid">
              {homeContent.flagship.capabilities.map((capability, index) => {
                const Icon = capabilityIcons[capability.id];

                return (
                  <article
                    className={`bceo-feature-card${index === 0 ? " bceo-feature-card--flagship" : ""}`}
                    key={capability.id}
                    data-reveal-card
                  >
                    <div className="bceo-feature-card__topline">
                      <span className="bceo-card-label">
                        {String(index + 1).padStart(2, "0")} · {capability.signalLabel}
                      </span>
                      <Icon aria-hidden="true" size={20} strokeWidth={1.5} />
                    </div>
                    <div className="bceo-feature-card__visual" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div>
                      <h3>{capability.title}</h3>
                      <p>{capability.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="bceo-hero__actions" data-reveal>
              {homeContent.flagship.actions.map((action) => (
                <ActionLink action={action} key={action.label} />
              ))}
            </div>
          </div>
        </section>

        <section
          className="bceo-section bceo-section--dense bceo-proof-section bceo-theme-dark"
          aria-labelledby="proof-title"
        >
          <div className="bceo-container">
            <div className="bceo-section__header" data-reveal>
              <div>
                <p className="bceo-eyebrow">{homeContent.proof.eyebrow}</p>
                <h2 id="proof-title">{homeContent.proof.title}</h2>
              </div>
              <p>{homeContent.proof.disclaimer}</p>
            </div>
            <div className="bceo-metrics">
              {homeContent.proof.metrics.map((metric) => (
                <article className="bceo-metric" key={metric.id} data-reveal-card>
                  <span className="bceo-metric__value">{metric.value}</span>
                  <span className="bceo-metric__label">{metric.statement}</span>
                  <span className="bceo-metric__context">{metric.context}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="bceo-section bceo-section--elevated"
          aria-labelledby="workforce-title"
          data-reveal
        >
          <div className="bceo-container">
            <div className="bceo-section__header">
              <div>
                <p className="bceo-eyebrow">{homeContent.workforce.eyebrow}</p>
                <h2 id="workforce-title">{homeContent.workforce.title}</h2>
              </div>
              <p>{homeContent.workforce.description}</p>
            </div>
            <div className="bceo-workforce" aria-label={homeContent.presentation.workforceMapLabel}>
              <div className="bceo-workforce__spine" aria-hidden="true">
                <span />
              </div>
              {homeContent.workforce.roles.map((role, index) => (
                <article className="bceo-workforce__role" key={role.id} data-reveal-card>
                  <span className="bceo-workforce__index">0{index + 1}</span>
                  <div>
                    <h3>{role.label}</h3>
                    <p>{role.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bceo-section" id="industries" aria-labelledby="industries-title">
          <div className="bceo-container">
            <div className="bceo-section__header" data-reveal>
              <div>
                <p className="bceo-eyebrow">{homeContent.industriesPreview.eyebrow}</p>
                <h2 id="industries-title">{homeContent.industriesPreview.title}</h2>
              </div>
              <p>{homeContent.industriesPreview.description}</p>
            </div>
            <div className="bceo-industries">
              {developingIndustries.map((industry, index) => (
                <article className="bceo-industry" key={industry.id} data-reveal-card>
                  <div className="bceo-industry__topline">
                    <span className="bceo-industry__status">{industry.statusLabel}</span>
                    <span aria-hidden="true">0{index + 2}</span>
                  </div>
                  <Building2 aria-hidden="true" size={24} strokeWidth={1.35} />
                  <h3>{industry.name}</h3>
                  <p>{industry.summary}</p>
                  <a href={industry.actions[0]?.href ?? faqContent.contactPrompt.action.href}>
                    {industry.actions[0]?.label ?? faqContent.contactPrompt.action.label}
                    <ArrowUpRight aria-hidden="true" size={15} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bceo-section bceo-section--elevated" id="pricing" aria-labelledby="pricing-title">
          <div className="bceo-container">
            <div className="bceo-section__header" data-reveal>
              <div>
                <p className="bceo-eyebrow">{homeContent.pricingPreview.eyebrow}</p>
                <h2 id="pricing-title">{homeContent.pricingPreview.title}</h2>
              </div>
              <p>
                {homeContent.pricingPreview.trialLabel}. {homeContent.pricingPreview.noCardLabel}.
              </p>
            </div>
            <div className="bceo-pricing-preview">
              <article className="bceo-plan bceo-plan--office" data-reveal-card>
                <div className="bceo-plan__topline">
                  <span className="bceo-plan__name">{officePlan.name}</span>
                  <span>{homeContent.pricingPreview.trialLabel}</span>
                </div>
                <div className="bceo-plan__price">
                  {officePlan.price.formatted}
                  <span className="bceo-plan__note"> / {officePlan.price.cadenceLabel}</span>
                </div>
                <div className="bceo-plan__note">{officePlan.price.note}</div>
                <ul className="bceo-plan__features">
                  {officePlan.features.slice(0, 5).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <ActionLink action={officePlan.action} />
              </article>
              <article className="bceo-plan" data-reveal-card>
                <div className="bceo-plan__topline">
                  <span className="bceo-plan__name">{enterprisePlan.name}</span>
                  <span>{homeContent.presentation.tailoredOperationsLabel}</span>
                </div>
                <div className="bceo-plan__price">{enterprisePlan.priceLabel}</div>
                <div className="bceo-plan__note">{enterprisePlan.audience}</div>
                <ul className="bceo-plan__features">
                  {enterprisePlan.features.slice(0, 5).map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <ActionLink action={enterprisePlan.action} />
              </article>
            </div>
          </div>
        </section>

        <section className="bceo-section bceo-trust-section" id="about" aria-labelledby="trust-title">
          <div className="bceo-container bceo-trust" data-reveal>
            <div>
              <p className="bceo-eyebrow">{homeContent.trust.eyebrow}</p>
              <h2 id="trust-title">{homeContent.trust.title}</h2>
            </div>
            <div className="bceo-trust__evidence">
              <p>{selectedTrust?.statement}</p>
              <span>{homeContent.ownership.statement}</span>
              <div className="bceo-trust__links">
                <a href={homeContent.ownership.nexFrameLinkedIn} rel="noreferrer" target="_blank">
                  {homeContent.ownership.developerName}{" "}
                  <ArrowUpRight aria-hidden="true" size={14} />
                </a>
                <a href={homeContent.ownership.founderLinkedIn} rel="noreferrer" target="_blank">
                  {homeContent.presentation.founderLinkLabel}{" "}
                  <ArrowUpRight aria-hidden="true" size={14} />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="bceo-section bceo-section--elevated" id="faq" aria-labelledby="faq-title">
          <div className="bceo-container bceo-faq-layout">
            <div className="bceo-faq-layout__intro" data-reveal>
              <p className="bceo-eyebrow">{faqContent.eyebrow}</p>
              <h2 id="faq-title">{faqContent.title}</h2>
              <p>{faqContent.introduction}</p>
              <a href={faqContent.contactPrompt.action.href}>
                {faqContent.contactPrompt.action.label}
                <ArrowUpRight aria-hidden="true" size={15} />
              </a>
            </div>
            <MarketingFaq items={faqContent.groups[0].items.slice(0, 6)} />
          </div>
        </section>

        <section className="bceo-section bceo-section--dense" aria-labelledby="final-title">
          <div className="bceo-container">
            <div className="bceo-final bceo-theme-dark" data-reveal>
              <div className="bceo-final__core" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p className="bceo-eyebrow">{homeContent.finalCta.eyebrow}</p>
              <h2 id="final-title">{homeContent.finalCta.title}</h2>
              <p>{homeContent.finalCta.description}</p>
              <div className="bceo-hero__actions">
                {homeContent.finalCta.actions.map((action) => (
                  <ActionLink action={action} key={action.label} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bceo-footer bceo-theme-dark">
        <div className="bceo-container bceo-footer__inner">
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
