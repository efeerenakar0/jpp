"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import Image from "next/image";
import { Dialog } from "radix-ui";

import type { NavigationContent } from "@/marketing/types";

export interface MarketingHeaderProps {
  readonly content: NavigationContent;
  readonly homeHref?: string;
}

function BrandWordmarkImage({ brandName }: { readonly brandName: string }) {
  return (
    <span className="bceo-brand-wordmark" role="img" aria-label={brandName}>
      <Image
        alt=""
        aria-hidden="true"
        className="bceo-brand-wordmark__image bceo-brand-wordmark__image--on-light"
        height={887}
        priority
        sizes="(max-width: 767px) 148px, 184px"
        src="/brand/business-ceo-ai-wordmark-transparent.png"
        width={1774}
      />
      <Image
        alt=""
        aria-hidden="true"
        className="bceo-brand-wordmark__image bceo-brand-wordmark__image--on-dark"
        height={887}
        priority
        sizes="(max-width: 767px) 148px, 184px"
        src="/brand/business-ceo-ai-wordmark-transparent-dark-cyan.png"
        width={1774}
      />
    </span>
  );
}

export function MarketingHeader({ content, homeHref = "#top" }: MarketingHeaderProps) {
  const destinationLanguage = content.locale === "en" ? "tr" : "en";

  return (
    <header className="bceo-nav">
      <div className="bceo-container bceo-nav__inner">
        <a className="bceo-wordmark" href={homeHref}>
          <BrandWordmarkImage brandName={content.brandName} />
        </a>

        <nav aria-label={content.mainMenuLabel}>
          <ul className="bceo-nav__links">
            {content.items.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="bceo-nav__actions">
          <a className="bceo-nav__language" href={content.language.href} lang={destinationLanguage}>
            {content.language.shortLabel}
          </a>
          <a className="bceo-nav__signin" href={content.signIn.href}>
            {content.signIn.label}
          </a>
          <a className="bceo-button bceo-button--primary" href={content.startTrial.href}>
            {content.startTrial.label}
            <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.8} />
          </a>

          <Dialog.Root>
            <Dialog.Trigger asChild>
              <button className="bceo-mobile-menu" type="button" aria-label={content.openMenuLabel}>
                <Menu aria-hidden="true" size={21} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="bceo-mobile-nav__overlay" />
              <Dialog.Content className="bceo-mobile-nav__content" aria-describedby={undefined}>
                <div className="bceo-mobile-nav__topline">
                  <Dialog.Title className="bceo-mobile-nav__brand">
                    <BrandWordmarkImage brandName={content.brandName} />
                  </Dialog.Title>
                  <Dialog.Close asChild>
                    <button type="button" aria-label={content.closeMenuLabel}>
                      <X aria-hidden="true" size={22} />
                    </button>
                  </Dialog.Close>
                </div>
                <nav aria-label={content.mobileMenuLabel}>
                  <ul className="bceo-mobile-nav__links">
                    {content.items.map((item, index) => (
                      <li key={item.href}>
                        <Dialog.Close asChild>
                          <a href={item.href}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            {item.label}
                          </a>
                        </Dialog.Close>
                      </li>
                    ))}
                  </ul>
                </nav>
                <div className="bceo-mobile-nav__actions">
                  <a className="bceo-button bceo-button--primary" href={content.startTrial.href}>
                    {content.startTrial.label}
                  </a>
                  <a className="bceo-button bceo-button--secondary" href={content.signIn.href}>
                    {content.signIn.label}
                  </a>
                  <a
                    className="bceo-mobile-nav__language"
                    href={content.language.href}
                    lang={destinationLanguage}
                  >
                    {content.language.destinationLabel}
                  </a>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
