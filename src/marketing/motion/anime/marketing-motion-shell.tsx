"use client";

import { animate } from "animejs/animation";
import { onScroll } from "animejs/events";
import { createScope } from "animejs/scope";
import { createTimeline } from "animejs/timeline";
import { cleanInlineStyles, stagger } from "animejs/utils";
import type { HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";

import {
  groupByParent,
  markMotionReady,
  motionMediaQueries,
  revealProgressOnScroll,
  revealOnScroll,
  selectUnique,
  type MotionMatches,
} from "./core";

const selectors = {
  heroCopyGroup: '[data-motion="hero-copy"], [data-hero-copy]',
  heroCopyItem: '[data-motion="hero-copy-item"]',
  heroParallax: "[data-hero-parallax]",
  heroVisual: '[data-motion="hero-visual"], [data-hero-core], .bceo-hero__visual',
  industryCard: "[data-industry-card]",
  operationalLoop: '[data-motion="operational-loop"], [data-loop], .bceo-loop',
  operationalLoopProgress: '[data-motion="loop-progress"], .bceo-loop__progress',
  operationalLoopStep: '[data-motion="loop-step"], [data-loop-step], .bceo-loop__step',
  sectionReveal: '[data-motion="section-reveal"], [data-reveal]',
  sectionRevealCard: '[data-motion="reveal-card"], [data-reveal-card]',
  sectionRevealFallback: [
    ".bceo-manifesto__copy",
    ".bceo-section__header",
    ".bceo-feature-grid",
    ".bceo-metrics",
    ".bceo-industries",
    ".bceo-pricing-preview",
    ".bceo-final",
  ].join(", "),
} as const;

type AnimeMarketingMotionShellProps = HTMLAttributes<HTMLDivElement> & {
  readonly children: ReactNode;
};

function selectHeroSupportingCopy(scope: HTMLElement): HTMLElement[] {
  const authoredItems = selectUnique(scope, selectors.heroCopyItem);
  const items =
    authoredItems.length > 0
      ? authoredItems
      : selectUnique(scope, selectors.heroCopyGroup).flatMap((group) =>
          Array.from(group.children).filter(
            (child): child is HTMLElement => child instanceof HTMLElement,
          ),
        );

  return items.filter(
    (item) => item.tagName !== "H1" && !item.hasAttribute("data-motion-lcp"),
  );
}

/**
 * Anime.js v4 motion layer for the marketing homepage. The server-rendered
 * document is never pre-hidden; all entrance states are progressive enhancement.
 */
export function AnimeMarketingMotionShell({
  children,
  className,
  ...rootProps
}: AnimeMarketingMotionShellProps) {
  const scopeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scopeRef.current;

    if (!root) {
      return;
    }

    const animeScope = createScope({
      mediaQueries: motionMediaQueries,
      root: scopeRef,
    }).add((currentScope) => {
      if (!currentScope) {
        return;
      }

      const { isDesktop, reduceMotion } = currentScope.matches as MotionMatches;
      const clearReadyMarker = markMotionReady(root, reduceMotion ? "reduced" : "full");

      if (reduceMotion) {
        return clearReadyMarker;
      }

      const industryCards = selectUnique(root, selectors.industryCard);
      const heroSupportingCopy = selectHeroSupportingCopy(root);
      const heroVisual = selectUnique(root, selectors.heroVisual);
      const heroParallax = selectUnique(root, selectors.heroParallax);
      const entranceTargets = [...industryCards, ...heroSupportingCopy, ...heroVisual];

      if (entranceTargets.length > 0) {
        const entranceTimeline = createTimeline({
          defaults: { ease: "out(4)" },
          onComplete: (timeline) => cleanInlineStyles(timeline),
        });

        if (industryCards.length > 0) {
          entranceTimeline.add(
            industryCards,
            {
              delay: stagger(isDesktop ? 42 : 30),
              duration: isDesktop ? 430 : 340,
              y: { from: isDesktop ? 9 : 6, to: 0 },
            },
            20,
          );
        }

        if (heroSupportingCopy.length > 0) {
          entranceTimeline.add(
            heroSupportingCopy,
            {
              delay: stagger(isDesktop ? 58 : 42),
              duration: isDesktop ? 520 : 410,
              y: { from: isDesktop ? 18 : 12, to: 0 },
            },
            isDesktop ? 150 : 100,
          );
        }

        if (heroVisual.length > 0) {
          entranceTimeline.add(
            heroVisual,
            {
              duration: isDesktop ? 760 : 560,
              scale: { from: isDesktop ? 0.975 : 0.99, to: 1 },
              y: { from: isDesktop ? 18 : 10, to: 0 },
            },
            isDesktop ? 230 : 160,
          );
        }
      }

      if (isDesktop && heroParallax.length > 0 && heroVisual.length > 0) {
        animate(heroParallax, {
          autoplay: onScroll({
            enter: { container: "top", target: "top" },
            leave: { container: "top", target: "bottom" },
            sync: 0.24,
            target: heroVisual[0],
          }),
          ease: "linear",
          y: { from: 0, to: "-4%" },
        });
      }

      const authoredRevealTargets = selectUnique(root, selectors.sectionReveal);
      const revealTargets =
        authoredRevealTargets.length > 0
          ? authoredRevealTargets
          : selectUnique(root, selectors.sectionRevealFallback);

      revealTargets.forEach((target) => {
        revealOnScroll({
          distance: isDesktop ? 18 : 12,
          duration: isDesktop ? 500 : 390,
          enter: isDesktop ? "84%" : "91%",
          targets: [target],
        });
      });

      const revealCards = selectUnique(root, selectors.sectionRevealCard);
      groupByParent(revealCards, root).forEach((cards, group) => {
        revealOnScroll({
          distance: isDesktop ? 16 : 10,
          duration: isDesktop ? 440 : 360,
          enter: isDesktop ? "87%" : "92%",
          scaleFrom: isDesktop ? 0.99 : 0.995,
          staggerMs: isDesktop ? 65 : 42,
          targets: cards,
          trigger: group,
        });
      });

      const operationalLoop = selectUnique(root, selectors.operationalLoop)[0];

      if (operationalLoop) {
        const loopSteps = selectUnique(operationalLoop, selectors.operationalLoopStep);
        const loopProgress = selectUnique(operationalLoop, selectors.operationalLoopProgress);

        if (isDesktop) {
          const scrollSettings = onScroll({
            enter: { container: "82%", target: "top" },
            leave: { container: "54%", target: "bottom" },
            sync: 0.28,
            target: operationalLoop,
          });

          if (loopProgress.length > 0) {
            animate(loopProgress, {
              autoplay: scrollSettings,
              ease: "linear",
              scaleX: { from: 0, to: 1 },
            });
          } else {
            animate(operationalLoop, {
              "--bceo-loop-progress": { from: 0, to: 1 },
              autoplay: scrollSettings,
              ease: "linear",
            });
          }

          if (loopSteps.length > 0) {
            animate(loopSteps, {
              autoplay: onScroll({
                enter: { container: "82%", target: "top" },
                leave: { container: "54%", target: "bottom" },
                sync: 0.28,
                target: operationalLoop,
              }),
              delay: stagger(70),
              ease: "out(3)",
              y: { from: 16, to: 0 },
            });
          }
        } else {
          if (loopProgress.length > 0) {
            revealProgressOnScroll({
              duration: 520,
              enter: "90%",
              targets: loopProgress,
              trigger: operationalLoop,
            });
          } else {
            const observer = onScroll({
              enter: { container: "90%", target: "top" },
              repeat: false,
              sync: "play",
              target: operationalLoop,
            });

            animate(operationalLoop, {
              "--bceo-loop-progress": { from: 0, to: 1 },
              autoplay: observer,
              duration: 520,
              ease: "out(3)",
              onComplete: () => {
                operationalLoop.style.removeProperty("--bceo-loop-progress");
                observer.revert();
              },
            });
          }

          revealOnScroll({
            distance: 10,
            duration: 380,
            enter: "91%",
            staggerMs: 52,
            targets: loopSteps,
            trigger: operationalLoop,
          });
        }
      }

      return clearReadyMarker;
    });

    return () => animeScope.revert();
  }, []);

  const rootClassName = className ? `bceo-site ${className}` : "bceo-site";

  return (
    <div {...rootProps} className={rootClassName} ref={scopeRef}>
      {children}
    </div>
  );
}
