import {
  portfolioVideoScenePlanSchema,
  type PortfolioVideoScenePlan,
} from './scene-plan';

function stablePlanShape(plan: PortfolioVideoScenePlan) {
  return JSON.stringify({
    seed: plan.seed,
    palette: plan.palette,
    typography: plan.typography,
    scenes: plan.scenes.map((scene) => ({
      type: scene.type,
      durationInFrames: scene.durationInFrames,
      photoIndices: scene.photoIndices,
      layout: scene.layout,
      transition: scene.transition,
      photoMotion: scene.photoMotion,
      overlays: scene.overlays.map((overlay) => ({
        type: overlay.type,
        animation: overlay.animation,
        position: overlay.position,
        revealAtFrame: overlay.revealAtFrame,
      })),
    })),
  });
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createPortfolioVideoPlanFingerprint(plan: PortfolioVideoScenePlan) {
  const validated = portfolioVideoScenePlanSchema.parse(plan);
  return `video-plan:${fnv1a(stablePlanShape(validated))}`;
}

const PALETTES: PortfolioVideoScenePlan['palette'][] = [
  'MIDNIGHT_CYAN',
  'EDITORIAL_GOLD',
  'WARM_SAND',
  'CLEAN_WHITE',
  'BOLD_CORAL',
];

const TYPOGRAPHIES: PortfolioVideoScenePlan['typography'][] = [
  'MODERN',
  'EDITORIAL',
  'FRIENDLY',
  'MINIMAL',
];

export function ensureDistinctPortfolioVideoPlan(input: {
  plan: PortfolioVideoScenePlan;
  previousFingerprints: string[];
  seed: number;
}) {
  const previous = new Set(input.previousFingerprints.slice(-12));
  const original = portfolioVideoScenePlanSchema.parse(input.plan);
  const originalFingerprint = createPortfolioVideoPlanFingerprint(original);
  if (!previous.has(originalFingerprint)) {
    return {
      plan: original,
      fingerprint: originalFingerprint,
      wasDiversified: false,
    };
  }

  for (let attempt = 0; attempt < PALETTES.length; attempt += 1) {
    const seed = Math.max(0, Math.floor(input.seed + attempt));
    const plan = portfolioVideoScenePlanSchema.parse({
      ...original,
      seed,
      palette: PALETTES[(seed + attempt) % PALETTES.length],
      typography: TYPOGRAPHIES[(seed + attempt) % TYPOGRAPHIES.length],
      scenes: original.scenes.map((scene, sceneIndex) => ({
        ...scene,
        photoIndices:
          scene.type === 'GALLERY' && (seed + sceneIndex) % 2 === 1
            ? [...scene.photoIndices].reverse()
            : scene.photoIndices,
        transition:
          scene.type === 'GALLERY'
            ? (['CUT', 'FADE', 'SLIDE'] as const)[
                (seed + sceneIndex) % 3
              ]
            : scene.transition,
        photoMotion:
          scene.type === 'GALLERY'
            ? (['ZOOM', 'PAN', 'STILL'] as const)[
                (seed + sceneIndex + 1) % 3
              ]
            : scene.photoMotion,
      })),
    });
    const fingerprint = createPortfolioVideoPlanFingerprint(plan);
    if (!previous.has(fingerprint)) {
      return { plan, fingerprint, wasDiversified: true };
    }
  }

  const fallback = portfolioVideoScenePlanSchema.parse({
    ...original,
    seed: Math.max(0, Math.floor(input.seed)),
    summary: `${original.summary} · yeni varyasyon`.slice(0, 240),
  });
  return {
    plan: fallback,
    fingerprint: createPortfolioVideoPlanFingerprint(fallback),
    wasDiversified: true,
  };
}
