export const IMMERSIVE_FABRIKA_ROUTE = '/fabrika/akilli-panel';

export function isImmersiveFabrikaRoute(pathname: string) {
  return pathname === IMMERSIVE_FABRIKA_ROUTE;
}

export function shouldShowFabrikaOnboarding({
  principalType,
  onboardingComplete,
}: {
  principalType: 'OWNER' | 'EMPLOYEE';
  onboardingComplete: boolean;
}) {
  return principalType === 'OWNER' && !onboardingComplete;
}
