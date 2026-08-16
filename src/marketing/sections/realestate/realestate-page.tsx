import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Database,
  LockKeyhole,
  Network,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

import { MarketingFaq } from "@/marketing/components/feedback/marketing-faq";
import { ProductFilm } from "@/marketing/components/media/product-film";
import { MarketingHeader } from "@/marketing/components/navigation/marketing-header";
import {
  GeneralManagerDemo,
  PortfolioHunterDemo,
  WhatsAppOperationsDemo,
} from "@/marketing/components/product/realestate-product-demos";
import { faqContent as defaultFaqContent } from "@/marketing/content/en/faq";
import { homeContent as defaultHomeContent } from "@/marketing/content/en/home";
import { navigationContent as defaultNavigationContent } from "@/marketing/content/en/navigation";
import { pricingContent as defaultPricingContent } from "@/marketing/content/en/pricing";
import { realEstateContent as defaultRealEstateContent } from "@/marketing/content/en/realestate";
import { AnimeRealEstateMotionShell } from "@/marketing/motion/anime/realestate-motion-shell";
import type {
  ContentAction,
  FaqContent,
  HomeContent,
  NavigationContent,
  PricingContent,
  RealEstateContent,
} from "@/marketing/types";

function ActionLink({ action }: { readonly action: ContentAction }) {
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

function createRealEstateNavigationContent(content: NavigationContent): NavigationContent {
  const homePath = content.locale === "tr" ? "/tr" : "/";
  const realEstatePath = content.locale === "tr" ? "/tr/realestate" : "/realestate";
  const alternateRealEstatePath = content.locale === "tr" ? "/realestate" : "/tr/realestate";

  return {
    ...content,
    language: {
      ...content.language,
      href: alternateRealEstatePath,
    },
    items: content.items.map((item) => {
      if (item.id === "real-estate") {
        return { ...item, href: realEstatePath };
      }

      if (item.id === "pricing") {
        return { ...item, href: "#pricing" };
      }

      return { ...item, href: `${homePath}${item.href}` };
    }),
  };
}

const productFilmMedia = {
  "whatsapp-operations": {
    poster: "/posters/business-ceo-whatsapp-operations.webp",
    sources: [
      { src: "/media/videos/business-ceo-whatsapp-operations.webm", type: "video/webm" },
      { src: "/media/videos/business-ceo-whatsapp-operations.mp4", type: "video/mp4" },
    ],
    captions: [
      {
        src: "/media/captions/business-ceo-whatsapp-operations.en.vtt",
        srcLang: "en",
        label: "English",
        default: true,
      },
      {
        src: "/media/captions/business-ceo-whatsapp-operations.tr.vtt",
        srcLang: "tr",
        label: "Türkçe",
      },
    ],
  },
  "portfolio-hunter": {
    poster: "/posters/business-ceo-portfolio-hunter.webp",
    sources: [
      { src: "/media/videos/business-ceo-portfolio-hunter.webm", type: "video/webm" },
      { src: "/media/videos/business-ceo-portfolio-hunter.mp4", type: "video/mp4" },
    ],
    captions: [
      {
        src: "/media/captions/business-ceo-portfolio-hunter.en.vtt",
        srcLang: "en",
        label: "English",
        default: true,
      },
      {
        src: "/media/captions/business-ceo-portfolio-hunter.tr.vtt",
        srcLang: "tr",
        label: "Türkçe",
      },
    ],
  },
} as const;

export interface RealEstatePageContent {
  readonly faq: FaqContent;
  readonly home: HomeContent;
  readonly navigation: NavigationContent;
  readonly pricing: PricingContent;
  readonly realEstate: RealEstateContent;
}

export interface RealEstatePageProps {
  readonly content?: RealEstatePageContent;
}

const defaultContent = {
  faq: defaultFaqContent,
  home: defaultHomeContent,
  navigation: defaultNavigationContent,
  pricing: defaultPricingContent,
  realEstate: defaultRealEstateContent,
} satisfies RealEstatePageContent;

export function RealEstatePage({ content = defaultContent }: RealEstatePageProps = {}) {
  const {
    faq: faqContent,
    home: homeContent,
    navigation: navigationContent,
    pricing: pricingContent,
    realEstate: realEstateContent,
  } = content;
  const realEstateNavigationContent = createRealEstateNavigationContent(navigationContent);
  const homePath = navigationContent.locale === "tr" ? "/tr" : "/";
  const selectedHeadline = realEstateContent.hero.headlineAlternatives.find(
    (headline) => headline.id === realEstateContent.hero.selectedHeadlineId,
  ) ?? realEstateContent.hero.headlineAlternatives[0];
  const realEstateFaq = faqContent.groups.find((group) => group.id === "real-estate");
  const [primaryAction, secondaryAction] = realEstateContent.hero.actions;
  const [officePlan, enterprisePlan] = pricingContent.plans;

  return (
    <AnimeRealEstateMotionShell
      className="bceo-site bceo-site--realestate"
      data-bceo-theme="light"
      id="top"
      lang={realEstateContent.locale}
    >
      <a className="bceo-skip-link" href="#main-content">
        {navigationContent.skipToContentLabel}
      </a>
      <MarketingHeader content={realEstateNavigationContent} />

      <nav className="bceo-re-productbar" aria-label={realEstateContent.hero.eyebrow}>
        <div className="bceo-container bceo-re-productbar__inner">
          <Link href={homePath}>
            <ArrowLeft aria-hidden="true" size={14} />
            {navigationContent.brandName}
          </Link>
          <span>{realEstateContent.hero.eyebrow}</span>
          <a href={primaryAction.href}>{primaryAction.label}</a>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1}>
        <section className="bceo-re-hero" aria-labelledby="realestate-hero-title">
          <div className="bceo-container bceo-re-hero__grid">
            <div className="bceo-re-hero__copy" data-re-hero-copy>
              <p className="bceo-eyebrow">{realEstateContent.hero.eyebrow}</p>
              <h1 id="realestate-hero-title">{selectedHeadline.title}</h1>
              <p className="bceo-re-hero__lead">{realEstateContent.hero.supportingCopy}</p>
              <div className="bceo-hero__actions">
                <ActionLink action={primaryAction} />
                <ActionLink action={secondaryAction} />
              </div>
              <div className="bceo-re-hero__assurance">
                <span>
                  <Check aria-hidden="true" size={15} />
                  {realEstateContent.hero.noCardLabel}
                </span>
                <p>{realEstateContent.hero.proofSummary}</p>
              </div>
            </div>

            <figure
              className="bceo-re-hero-system"
              aria-label={realEstateContent.hero.supportingCopy}
              data-re-hero-system
            >
              <figcaption>
                <span>{realEstateContent.whatsappOperations.eyebrow}</span>
                <span>{realEstateContent.generalManager.eyebrow}</span>
              </figcaption>
              <span className="bceo-re-hero-system__axis bceo-re-hero-system__axis--x" aria-hidden="true" />
              <span className="bceo-re-hero-system__axis bceo-re-hero-system__axis--y" aria-hidden="true" />
              <span className="bceo-re-hero-system__line bceo-re-hero-system__line--one" aria-hidden="true" />
              <span className="bceo-re-hero-system__line bceo-re-hero-system__line--two" aria-hidden="true" />
              <span className="bceo-re-hero-system__line bceo-re-hero-system__line--three" aria-hidden="true" />
              <div className="bceo-re-hero-system__core" aria-hidden="true">
                <span />
                <strong>{realEstateContent.hero.eyebrow}</strong>
              </div>
              <div className="bceo-re-hero-system__signal bceo-re-hero-system__signal--customer" data-re-signal>
                <small>{realEstateContent.whatsappOperations.eyebrow}</small>
                <strong>{realEstateContent.whatsappOperations.approvedDescriptor}</strong>
              </div>
              <div className="bceo-re-hero-system__signal bceo-re-hero-system__signal--portfolio" data-re-signal>
                <small>{realEstateContent.portfolioHunter.eyebrow}</small>
                <strong>{realEstateContent.portfolioHunter.title}</strong>
              </div>
              <div className="bceo-re-hero-system__signal bceo-re-hero-system__signal--manager" data-re-signal>
                <small>{realEstateContent.generalManager.eyebrow}</small>
                <strong>{realEstateContent.generalManager.title}</strong>
              </div>
              <blockquote className="bceo-re-hero-system__question" data-re-signal>
                {realEstateContent.generalManager.exampleOwnerQuestion}
              </blockquote>
            </figure>
          </div>
        </section>

        <section className="bceo-re-problem" aria-labelledby="problem-title" data-re-sequence>
          <div className="bceo-container">
            <div className="bceo-re-section-head" data-re-reveal>
              <div>
                <p className="bceo-eyebrow">{realEstateContent.problemSequence.eyebrow}</p>
                <h2 id="problem-title">{realEstateContent.problemSequence.title}</h2>
              </div>
              <p>{realEstateContent.problemSequence.introduction}</p>
            </div>
            <div className="bceo-re-problem__chain">
              <span className="bceo-re-problem__progress" data-re-progress aria-hidden="true" />
              <ol>
                {realEstateContent.problemSequence.stages.map((stage, index) => (
                  <li key={stage.id} data-re-sequence-step>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{stage.label}</strong>
                  </li>
                ))}
              </ol>
            </div>
            <p className="bceo-re-problem__transition" data-re-reveal>
              {realEstateContent.problemSequence.transition}
            </p>
          </div>
        </section>

        <section className="bceo-re-product bceo-re-product--operations" aria-labelledby="operations-title">
          <div className="bceo-container">
            <div className="bceo-re-section-head bceo-re-section-head--product" data-re-reveal>
              <div>
                <p className="bceo-eyebrow">{realEstateContent.whatsappOperations.eyebrow}</p>
                <h2 id="operations-title">{realEstateContent.whatsappOperations.title}</h2>
              </div>
              <p>{realEstateContent.whatsappOperations.description}</p>
            </div>
            <div>
              <WhatsAppOperationsDemo content={realEstateContent.whatsappOperations} />
            </div>
          </div>
        </section>

        <section className="bceo-re-handoff" aria-labelledby="handoff-title">
          <div className="bceo-container bceo-re-handoff__grid">
            <div className="bceo-re-handoff__copy" data-re-reveal>
              <p className="bceo-eyebrow">{realEstateContent.humanHandoff.eyebrow}</p>
              <h2 id="handoff-title">{realEstateContent.humanHandoff.title}</h2>
              <p>{realEstateContent.humanHandoff.description}</p>
            </div>
            <ol className="bceo-re-handoff__steps">
              {realEstateContent.humanHandoff.steps.map((step, index) => (
                <li key={step} data-re-card>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bceo-re-product bceo-re-product--portfolio" aria-labelledby="portfolio-title">
          <div className="bceo-container">
            <div className="bceo-re-section-head bceo-re-section-head--product" data-re-reveal>
              <div>
                <p className="bceo-eyebrow">{realEstateContent.portfolioHunter.eyebrow}</p>
                <h2 id="portfolio-title">{realEstateContent.portfolioHunter.title}</h2>
              </div>
              <p>{realEstateContent.portfolioHunter.description}</p>
            </div>
            <div>
              <PortfolioHunterDemo content={realEstateContent.portfolioHunter} />
            </div>
          </div>
        </section>

        <section className="bceo-re-manager" aria-labelledby="manager-title">
          <div className="bceo-container">
            <div className="bceo-re-section-head" data-re-reveal>
              <div>
                <p className="bceo-eyebrow">{realEstateContent.generalManager.eyebrow}</p>
                <h2 id="manager-title">{realEstateContent.generalManager.title}</h2>
              </div>
              <p>{realEstateContent.generalManager.description}</p>
            </div>
            <div>
              <GeneralManagerDemo content={realEstateContent.generalManager} />
            </div>
          </div>
        </section>

        <section className="bceo-re-proof" aria-labelledby="proof-title">
          <div className="bceo-container">
            <div className="bceo-re-section-head" data-re-reveal>
              <div>
                <p className="bceo-eyebrow">{realEstateContent.proof.eyebrow}</p>
                <h2 id="proof-title">{realEstateContent.proof.title}</h2>
              </div>
              <p>{realEstateContent.proof.disclaimer}</p>
            </div>
            <div className="bceo-re-proof__grid">
              {realEstateContent.proof.metrics.map((metric) => (
                <article key={metric.id} data-re-card>
                  <strong>{metric.value}</strong>
                  <h3>{metric.statement}</h3>
                  <p>{metric.context}</p>
                </article>
              ))}
            </div>
            <p className="bceo-re-proof__testing">{realEstateContent.proof.internationalTestingStatement}</p>
          </div>
        </section>

        <section className="bceo-re-films" aria-labelledby="films-title">
          <div className="bceo-container">
            <div className="bceo-re-section-head" data-re-reveal>
              <div>
                <p className="bceo-eyebrow">{realEstateContent.productFilms.eyebrow}</p>
                <h2 id="films-title">{realEstateContent.productFilms.title}</h2>
              </div>
              <p>{realEstateContent.productFilms.description}</p>
            </div>
            <div className="bceo-re-films__grid">
              {realEstateContent.productFilms.films.map((film) => (
                <article className="bceo-re-film" key={film.id} data-re-card>
                  <ProductFilm
                    captions={productFilmMedia[film.id].captions}
                    description={film.description}
                    locale={realEstateContent.locale}
                    poster={productFilmMedia[film.id].poster}
                    sources={productFilmMedia[film.id].sources}
                    title={film.title}
                  />
                  <div className="bceo-re-film__copy">
                    <span>{film.durationLabel}</span>
                    <h3>{film.title}</h3>
                    <p>{film.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bceo-re-pricing" id="pricing" aria-labelledby="pricing-title">
          <div className="bceo-container">
            <div className="bceo-re-section-head" data-re-reveal>
              <div>
                <p className="bceo-eyebrow">{pricingContent.hero.eyebrow}</p>
                <h2 id="pricing-title">{realEstateContent.pricingReference.title}</h2>
              </div>
              <p>{realEstateContent.pricingReference.description}</p>
            </div>
            <div className="bceo-re-pricing__grid">
              <article className="bceo-re-plan bceo-re-plan--office" data-re-card>
                <div className="bceo-re-plan__topline">
                  <h3>{officePlan.name}</h3>
                  <span>{pricingContent.trial.title}</span>
                </div>
                <p className="bceo-re-plan__audience">{officePlan.audience}</p>
                <div className="bceo-re-plan__price">
                  {officePlan.price.formatted}
                  <span>{officePlan.price.cadenceLabel}</span>
                </div>
                <p className="bceo-re-plan__note">{officePlan.price.note}</p>
                <ul>
                  {officePlan.features.map((feature) => (
                    <li key={feature}>
                      <Check aria-hidden="true" size={15} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="bceo-re-plan__support">{officePlan.supportResponse}</p>
                <ActionLink action={officePlan.action} />
                <small>{pricingContent.trial.afterTrialWithoutPayment}</small>
              </article>
              <article className="bceo-re-plan" data-re-card>
                <div className="bceo-re-plan__topline">
                  <h3>{enterprisePlan.name}</h3>
                  <span>{enterprisePlan.priceLabel}</span>
                </div>
                <p className="bceo-re-plan__audience">{enterprisePlan.audience}</p>
                <div className="bceo-re-plan__price bceo-re-plan__price--contact">
                  {enterprisePlan.priceLabel}
                </div>
                <p className="bceo-re-plan__note">{enterprisePlan.description}</p>
                <ul>
                  {enterprisePlan.features.map((feature) => (
                    <li key={feature}>
                      <Check aria-hidden="true" size={15} />
                      {feature}
                    </li>
                  ))}
                </ul>
                <p className="bceo-re-plan__support">{enterprisePlan.supportResponse}</p>
                <ActionLink action={enterprisePlan.action} />
              </article>
            </div>
          </div>
        </section>

        <section className="bceo-re-security" aria-labelledby="security-title">
          <div className="bceo-container">
            <div className="bceo-re-section-head" data-re-reveal>
              <div>
                <p className="bceo-eyebrow">{realEstateContent.security.eyebrow}</p>
                <h2 id="security-title">{realEstateContent.security.title}</h2>
              </div>
              <p>{realEstateContent.security.description}</p>
            </div>
            <div className="bceo-re-security__grid">
              {realEstateContent.security.principles.map((principle, index) => {
                const Icon = index % 3 === 0 ? Database : index % 3 === 1 ? LockKeyhole : ShieldCheck;

                return (
                  <article key={principle.id} data-re-card>
                    <Icon aria-hidden="true" size={19} strokeWidth={1.5} />
                    <h3>{principle.title}</h3>
                    <p>{principle.description}</p>
                  </article>
                );
              })}
            </div>
            <p className="bceo-re-security__note">{realEstateContent.security.certificationNote}</p>
          </div>
        </section>

        <section className="bceo-re-faq" aria-labelledby="realestate-faq-title">
          <div className="bceo-container bceo-faq-layout">
            <div className="bceo-faq-layout__intro" data-re-reveal>
              <p className="bceo-eyebrow">{faqContent.eyebrow}</p>
              <h2 id="realestate-faq-title">{realEstateFaq?.title}</h2>
              <p>{realEstateFaq?.description}</p>
              <a href={faqContent.contactPrompt.action.href}>
                {faqContent.contactPrompt.action.label}
                <ArrowUpRight aria-hidden="true" size={15} />
              </a>
            </div>
            <MarketingFaq items={realEstateFaq?.items ?? []} />
          </div>
        </section>

        <section className="bceo-re-final" aria-labelledby="realestate-final-title">
          <div className="bceo-container">
            <div className="bceo-re-final__panel" data-re-reveal>
              <div className="bceo-re-final__mark" aria-hidden="true">
                <Network size={28} strokeWidth={1.2} />
                <UserRoundCheck size={22} strokeWidth={1.3} />
              </div>
              <p className="bceo-eyebrow">{realEstateContent.finalCta.eyebrow}</p>
              <h2 id="realestate-final-title">{realEstateContent.finalCta.title}</h2>
              <p>{realEstateContent.finalCta.description}</p>
              <div className="bceo-hero__actions">
                {realEstateContent.finalCta.actions.map((action) => (
                  <ActionLink action={action} key={action.label} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bceo-footer">
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
    </AnimeRealEstateMotionShell>
  );
}
