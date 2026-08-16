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
  revealOnScroll,
  revealProgressOnScroll,
  selectUnique,
  type MotionMatches,
} from "./core";

const selectors = {
  card: "[data-re-card]",
  demo: "[data-re-demo]",
  heroCopy: "[data-re-hero-copy]",
  heroSystem: "[data-re-hero-system]",
  progress: "[data-re-progress]",
  reveal: "[data-re-reveal]",
  sequence: "[data-re-sequence]",
  sequenceStep: "[data-re-sequence-step]",
  signal: "[data-re-signal]",
} as const;

type AnimeRealEstateMotionShellProps = HTMLAttributes<HTMLDivElement> & {
  readonly children: ReactNode;
};

function selectHeroSupportingCopy(scope: HTMLElement): HTMLElement[] {
  return selectUnique(scope, selectors.heroCopy).flatMap((group) =>
    Array.from(group.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.tagName !== "H1" &&
        !child.hasAttribute("data-motion-lcp"),
    ),
  );
}

/**
 * Anime.js v4 motion layer for the Real Estate product page. It keeps the H1
 * and all SSR content readable while progressively enhancing operational flows.
 */
export function AnimeRealEstateMotionShell({
  children,
  className,
  ...rootProps
}: AnimeRealEstateMotionShellProps) {
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

      const heroCopy = selectHeroSupportingCopy(root);
      const heroSystems = selectUnique(root, selectors.heroSystem);
      const heroSignals = selectUnique(root, selectors.signal);
      const entranceTargets = [...heroCopy, ...heroSystems, ...heroSignals];

      if (entranceTargets.length > 0) {
        const heroTimeline = createTimeline({
          defaults: { ease: "out(4)" },
          onComplete: (timeline) => cleanInlineStyles(timeline),
        });

        if (heroCopy.length > 0) {
          heroTimeline.add(
            heroCopy,
            {
              delay: stagger(isDesktop ? 56 : 42),
              duration: isDesktop ? 520 : 410,
              opacity: { from: 0, to: 1 },
              y: { from: isDesktop ? 18 : 12, to: 0 },
            },
            50,
          );
        }

        if (heroSystems.length > 0) {
          heroTimeline.add(
            heroSystems,
            {
              duration: isDesktop ? 760 : 560,
              opacity: { from: 0, to: 1 },
              scale: { from: isDesktop ? 0.975 : 0.99, to: 1 },
              y: { from: isDesktop ? 16 : 9, to: 0 },
            },
            isDesktop ? 170 : 130,
          );
        }

        if (heroSignals.length > 0) {
          heroTimeline.add(
            heroSignals,
            {
              delay: stagger(isDesktop ? 48 : 34),
              duration: isDesktop ? 430 : 340,
              opacity: { from: 0, to: 1 },
              y: { from: isDesktop ? 8 : 5, to: 0 },
            },
            isDesktop ? 430 : 330,
          );
        }

        if (heroSystems.length > 0) {
          heroTimeline
            .add(
              heroSystems,
              {
                duration: 320,
                ease: "inOut(2)",
                scale: { from: 1, to: 1.008 },
              },
              1_050,
            )
            .add(
              heroSystems,
              {
                duration: 320,
                ease: "inOut(2)",
                scale: { from: 1.008, to: 1 },
              },
              1_370,
            );
        }
      }

      const cardTargets = selectUnique(root, selectors.card);
      const cardSet = new Set(cardTargets);
      const revealTargets = selectUnique(root, selectors.reveal).filter(
        (target) => !cardSet.has(target),
      );

      revealTargets.forEach((target) => {
        revealOnScroll({
          distance: isDesktop ? 18 : 12,
          duration: isDesktop ? 480 : 380,
          enter: isDesktop ? "85%" : "91%",
          targets: [target],
        });
      });

      groupByParent(cardTargets, root).forEach((cards, group) => {
        revealOnScroll({
          distance: isDesktop ? 15 : 10,
          duration: isDesktop ? 420 : 350,
          enter: isDesktop ? "87%" : "92%",
          scaleFrom: isDesktop ? 0.992 : 0.996,
          staggerMs: cards.length > 8 ? 28 : isDesktop ? 58 : 40,
          targets: cards,
          trigger: group,
        });
      });

      const sequences = selectUnique(root, selectors.sequence);

      sequences.forEach((sequence) => {
        const steps = selectUnique(sequence, selectors.sequenceStep);
        const progress = selectUnique(sequence, selectors.progress);

        if (isDesktop) {
          if (progress.length > 0) {
            animate(progress, {
              autoplay: onScroll({
                enter: { container: "82%", target: "top" },
                leave: { container: "48%", target: "bottom" },
                sync: 0.3,
                target: sequence,
              }),
              ease: "linear",
              scaleX: { from: 0, to: 1 },
            });
          }

          if (steps.length > 0) {
            animate(steps, {
              autoplay: onScroll({
                enter: { container: "82%", target: "top" },
                leave: { container: "48%", target: "bottom" },
                sync: 0.3,
                target: sequence,
              }),
              delay: stagger(steps.length > 8 ? 24 : 58),
              ease: "out(3)",
              y: { from: 14, to: 0 },
            });
          }
        } else {
          revealProgressOnScroll({
            duration: 480,
            enter: "90%",
            staggerMs: 36,
            targets: progress,
            trigger: sequence,
          });
          revealOnScroll({
            distance: 9,
            duration: 350,
            enter: "91%",
            staggerMs: steps.length > 8 ? 25 : 45,
            targets: steps,
            trigger: sequence,
          });
        }
      });

      const demos = selectUnique(root, selectors.demo);

      demos.forEach((demo) => {
        revealOnScroll({
          distance: isDesktop ? 17 : 10,
          duration: isDesktop ? 500 : 390,
          enter: isDesktop ? "86%" : "91%",
          scaleFrom: isDesktop ? 0.993 : 0.997,
          targets: [demo],
        });

        revealProgressOnScroll({
          duration: 470,
          enter: isDesktop ? "84%" : "90%",
          staggerMs: 35,
          targets: selectUnique(demo, selectors.progress),
          trigger: demo,
        });
      });

      const standaloneProgress = selectUnique(root, selectors.progress).filter(
        (progress) =>
          !progress.closest(selectors.sequence) && !progress.closest(selectors.demo),
      );

      standaloneProgress.forEach((progress) => {
        revealProgressOnScroll({
          duration: 470,
          enter: "92%",
          targets: [progress],
          trigger: progress,
        });
      });

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
