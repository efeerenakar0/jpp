import { ArrowUpRight } from "lucide-react";

import type { ContactContent, ContactRouteContext } from "@/marketing/contact";
import { ContactForm } from "@/marketing/components/forms/contact-form";
import { MarketingHeader } from "@/marketing/components/navigation/marketing-header";
import { navigationContent as englishNavigation } from "@/marketing/content/en/navigation";
import { navigationContent as turkishNavigation } from "@/marketing/content/tr/navigation";
import type { NavigationContent } from "@/marketing/types";

const CONTACT_EMAIL = "info@businessceo.ai";

export interface ContactPageProps {
  readonly content: ContactContent;
  readonly context: ContactRouteContext;
}

function createContactNavigation(content: ContactContent): NavigationContent {
  const source = content.locale === "en" ? englishNavigation : turkishNavigation;
  const homePath = content.locale === "en" ? "/" : "/tr";
  const alternateContactPath = content.locale === "en" ? "/tr/contact" : "/contact";

  return {
    ...source,
    language: {
      ...source.language,
      href: alternateContactPath,
    },
    items: source.items.map((item) => ({
      ...item,
      href: `${homePath}${item.href}`,
    })),
  };
}

export function ContactPage({ content, context }: ContactPageProps) {
  const hero = content.hero[context.intent];
  const navigation = createContactNavigation(content);
  const homePath = content.locale === "en" ? "/" : "/tr";

  return (
    <div
      className="bceo-site bceo-contact-site"
      data-intent={context.intent}
      id="top"
      lang={content.locale}
    >
      <a className="bceo-skip-link" href="#main-content">
        {navigation.skipToContentLabel}
      </a>
      <MarketingHeader content={navigation} homeHref={homePath} />

      <main id="main-content" tabIndex={-1}>
        <section className="bceo-contact-hero" aria-labelledby="contact-title">
          <div className="bceo-container bceo-contact-hero__grid">
            <div className="bceo-contact-hero__copy">
              <p className="bceo-contact-route-label">{content.routeLabel}</p>
              <h1 id="contact-title">{hero.title}</h1>
              <p className="bceo-contact-hero__lead">{hero.description}</p>
            </div>

            <aside className="bceo-contact-hero__context" aria-label={hero.contextLabel}>
              <span>{hero.contextLabel}</span>
              <ol>
                {content.process.map((step, index) => (
                  <li key={step.title}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        </section>

        <section className="bceo-contact-workspace" aria-labelledby="contact-workspace-title">
          <div className="bceo-container bceo-contact-workspace__grid">
            <div className="bceo-contact-introduction">
              <div>
                <h2 id="contact-workspace-title">{content.introduction.title}</h2>
                <p>{content.introduction.description}</p>
              </div>

              <div className="bceo-contact-direct">
                <p>{content.introduction.responseNote}</p>
                <a href={`mailto:${CONTACT_EMAIL}`}>
                  <span>
                    <small>{content.introduction.emailLabel}</small>
                    {CONTACT_EMAIL}
                  </span>
                  <ArrowUpRight aria-hidden="true" size={21} strokeWidth={1.65} />
                </a>
              </div>
            </div>

            <ContactForm content={content} context={context} />
          </div>
        </section>
      </main>

      <footer className="bceo-contact-footer">
        <div className="bceo-container bceo-contact-footer__inner">
          <div>
            <strong>{navigation.brandName}</strong>
            <span>{navigation.brandDescriptor}</span>
          </div>
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          <nav aria-label={navigation.legalLabel}>
            {navigation.legalLinks.map((link) => (
              <a href={link.href} key={link.id}>
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
