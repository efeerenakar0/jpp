import { animate } from "animejs/animation";
import { onScroll } from "animejs/events";
import { cleanInlineStyles, stagger } from "animejs/utils";

export const motionMediaQueries = {
  isDesktop: "(min-width: 960px)",
  isMobile: "(max-width: 959px)",
  reduceMotion: "(prefers-reduced-motion: reduce)",
} as const;

export type MotionMatches = {
  readonly isDesktop: boolean;
  readonly isMobile: boolean;
  readonly reduceMotion: boolean;
};

export type ScrollRevealOptions = {
  readonly distance: number;
  readonly duration: number;
  readonly enter?: string;
  readonly scaleFrom?: number;
  readonly staggerMs?: number;
  readonly targets: readonly HTMLElement[];
  readonly trigger?: HTMLElement;
};

export type ProgressRevealOptions = {
  readonly duration: number;
  readonly enter?: string;
  readonly staggerMs?: number;
  readonly targets: readonly HTMLElement[];
  readonly trigger: HTMLElement;
};

export function selectUnique(scope: ParentNode, selector: string): HTMLElement[] {
  return Array.from(new Set(scope.querySelectorAll<HTMLElement>(selector)));
}

export function groupByParent(
  targets: readonly HTMLElement[],
  fallbackParent: HTMLElement,
): Map<HTMLElement, HTMLElement[]> {
  const groups = new Map<HTMLElement, HTMLElement[]>();

  targets.forEach((target) => {
    const parent = target.parentElement ?? fallbackParent;
    groups.set(parent, [...(groups.get(parent) ?? []), target]);
  });

  return groups;
}

export function markMotionReady(root: HTMLElement, mode: "full" | "reduced") {
  root.dataset.motionEngine = "anime-v4";
  root.dataset.motionMode = mode;
  root.dataset.motionReady = "true";

  return () => {
    delete root.dataset.motionEngine;
    delete root.dataset.motionMode;
    delete root.dataset.motionReady;
  };
}

export function revealOnScroll({
  distance,
  duration,
  enter = "86%",
  scaleFrom = 1,
  staggerMs = 0,
  targets,
  trigger = targets[0],
}: ScrollRevealOptions) {
  if (targets.length === 0 || !trigger) {
    return;
  }

  const observer = onScroll({
    enter: { container: enter, target: "top" },
    leave: { container: "top", target: "bottom" },
    repeat: false,
    sync: "play",
    target: trigger,
  });

  return animate([...targets], {
    delay: staggerMs > 0 && targets.length > 1 ? stagger(staggerMs) : 0,
    duration,
    ease: "out(4)",
    ...(scaleFrom === 1 ? {} : { scale: { from: scaleFrom, to: 1 } }),
    y: { from: distance, to: 0 },
    autoplay: observer,
    onComplete: (animation) => {
      cleanInlineStyles(animation);
      observer.revert();
    },
  });
}

export function revealProgressOnScroll({
  duration,
  enter = "90%",
  staggerMs = 0,
  targets,
  trigger,
}: ProgressRevealOptions) {
  if (targets.length === 0) {
    return;
  }

  const observer = onScroll({
    enter: { container: enter, target: "top" },
    repeat: false,
    sync: "play",
    target: trigger,
  });

  return animate([...targets], {
    autoplay: observer,
    delay: staggerMs > 0 && targets.length > 1 ? stagger(staggerMs) : 0,
    duration,
    ease: "out(3)",
    scaleX: { from: 0, to: 1 },
    onComplete: (animation) => {
      cleanInlineStyles(animation);
      observer.revert();
    },
  });
}
