'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import FabrikaSidebar from './Sidebar';
import FabrikaTopbar from './FabrikaTopbar';
import {
  FabrikaSessionProvider,
  type FabrikaClientSession,
} from './FabrikaSessionContext';
import { resolveWorkspaceBrand } from '@/lib/business-ceo-brand';
import OnboardingWizard from './OnboardingWizard';
import {
  isImmersiveFabrikaRoute,
  shouldShowFabrikaOnboarding,
} from '@/lib/fabrika-route-display';

interface FabrikaAppShellProps {
  children: React.ReactNode;
  account: {
    companyName: string;
    onboardingComplete: boolean;
  };
  session: FabrikaClientSession;
}

export default function FabrikaAppShell({
  children,
  account,
  session,
}: FabrikaAppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(
    account.onboardingComplete
  );
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const pathname = usePathname();
  const showOnboarding =
    !onboardingDismissed &&
    shouldShowFabrikaOnboarding({
      principalType: session.principalType,
      onboardingComplete,
    });

  if (isImmersiveFabrikaRoute(pathname)) {
    return (
      <FabrikaSessionProvider value={session}>
        <>
          <a
            href="#fabrika-main"
            className="sr-only z-[100] rounded-md bg-cyan-300 px-4 py-2 font-semibold text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Ana içeriğe geç
          </a>
          <main id="fabrika-main" data-ceo-route={pathname} tabIndex={-1}>
            {children}
          </main>
          {showOnboarding ? (
            <OnboardingWizard
              initialCompanyName={account.companyName}
              onComplete={() => setOnboardingComplete(true)}
              onDismiss={() => setOnboardingDismissed(true)}
            />
          ) : null}
        </>
      </FabrikaSessionProvider>
    );
  }

  return (
    <FabrikaSessionProvider value={session}>
      <div className="business-ceo-shell flex h-dvh min-h-0 overflow-hidden bg-[#07101d] text-slate-100">
        <a
          href="#fabrika-main"
          className="sr-only z-[100] rounded-md bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Ana içeriğe geç
        </a>

        <FabrikaSidebar
          companyName={resolveWorkspaceBrand(account.companyName)}
          mobileOpen={mobileNavigationOpen}
          onMobileClose={() => setMobileNavigationOpen(false)}
          principalType={session.principalType}
          hunterEnabled={session.hunterEnabled}
          profileName={session.displayName}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <FabrikaTopbar onOpenNavigation={() => setMobileNavigationOpen(true)} />
          <main
            id="fabrika-main"
            className="business-ceo-main min-h-0 flex-1 overflow-y-auto bg-[#07101d]"
            data-ceo-route={pathname}
            tabIndex={-1}
          >
            <div className="business-ceo-content mx-auto w-full max-w-[1920px] px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
              {children}
            </div>
          </main>
        </div>
        {showOnboarding ? (
          <OnboardingWizard
            initialCompanyName={account.companyName}
            onComplete={() => setOnboardingComplete(true)}
            onDismiss={() => setOnboardingDismissed(true)}
          />
        ) : null}
      </div>
    </FabrikaSessionProvider>
  );
}
