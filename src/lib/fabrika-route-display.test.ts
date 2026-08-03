import { describe, expect, it } from 'vitest';
import {
  isImmersiveFabrikaRoute,
  shouldShowFabrikaOnboarding,
} from './fabrika-route-display';

describe('Fabrika immersive route display', () => {
  it('uses the full-screen shell only for the new AI flow dashboard', () => {
    expect(isImmersiveFabrikaRoute('/fabrika/akilli-panel')).toBe(true);
    expect(isImmersiveFabrikaRoute('/fabrika')).toBe(false);
    expect(isImmersiveFabrikaRoute('/fabrika/studyo')).toBe(false);
  });

  it('keeps owner onboarding available inside the immersive dashboard', () => {
    expect(
      shouldShowFabrikaOnboarding({
        principalType: 'OWNER',
        onboardingComplete: false,
      })
    ).toBe(true);
    expect(
      shouldShowFabrikaOnboarding({
        principalType: 'OWNER',
        onboardingComplete: true,
      })
    ).toBe(false);
    expect(
      shouldShowFabrikaOnboarding({
        principalType: 'EMPLOYEE',
        onboardingComplete: false,
      })
    ).toBe(false);
  });
});
