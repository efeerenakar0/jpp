import { describe, expect, it } from 'vitest';
import { buildLocalScenePlan } from './scene-plan';
import {
  createPortfolioVideoPlanFingerprint,
  ensureDistinctPortfolioVideoPlan,
} from './plan-diversity';

function plan(seed: number) {
  return buildLocalScenePlan({
    command: 'Lüks ve sinematik olsun, finalde Instagram hesabını göster',
    photoCount: 5,
    showPrice: true,
    showLocation: true,
    instagramUrl: 'https://instagram.com/businessceoai',
    seed,
  });
}

describe('portfolio video plan diversity', () => {
  it('aynı seed ve plan için kararlı bir fingerprint üretir', () => {
    expect(createPortfolioVideoPlanFingerprint(plan(17))).toBe(
      createPortfolioVideoPlanFingerprint(plan(17)),
    );
  });

  it('farklı seed ile görsel yön veya sahne hareketini gerçekten değiştirir', () => {
    const first = plan(17);
    const second = plan(18);

    expect(createPortfolioVideoPlanFingerprint(first)).not.toBe(
      createPortfolioVideoPlanFingerprint(second),
    );
    expect({
      palette: first.palette,
      typography: first.typography,
      scenes: first.scenes,
    }).not.toEqual({
      palette: second.palette,
      typography: second.typography,
      scenes: second.scenes,
    });
  });

  it('önceki fingerprint tekrarlandığında güvenli ve farklı bir varyasyon döndürür', () => {
    const original = plan(41);
    const originalFingerprint = createPortfolioVideoPlanFingerprint(original);
    const distinct = ensureDistinctPortfolioVideoPlan({
      plan: original,
      previousFingerprints: [originalFingerprint],
      seed: 42,
    });

    expect(distinct.fingerprint).not.toBe(originalFingerprint);
    expect(distinct.plan.seed).toBe(42);
    expect(distinct.wasDiversified).toBe(true);
  });
});
