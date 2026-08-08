'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import FabrikaTopbar from './FabrikaTopbar';
import {
  FabrikaSessionProvider,
  type FabrikaClientSession,
} from './FabrikaSessionContext';
import OnboardingWizard from './OnboardingWizard';
import {
  isImmersiveFabrikaRoute,
  shouldShowFabrikaOnboarding,
} from '@/lib/fabrika-route-display';

interface FabrikaAppShellProps {
  children: React.ReactNode;
  account: {
    companyName: string;
    logoData: string | null;
    onboardingComplete: boolean;
  };
  session: FabrikaClientSession;
}

export default function FabrikaAppShell({
  children,
  account,
  session,
}: FabrikaAppShellProps) {
  const [onboardingComplete, setOnboardingComplete] = useState(
    account.onboardingComplete
  );
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const pathname = usePathname();
  const isDashboardHome = pathname === '/fabrika';
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
      <div
        className={`business-ceo-shell flex h-dvh min-h-0 flex-col overflow-hidden ${
          isDashboardHome
            ? 'bg-[#edf2f8] text-[#0a1b53]'
            : 'bg-[#050d18] text-slate-100'
        }`}
      >
        <a
          href="#fabrika-main"
          className="sr-only z-[100] rounded-md bg-cyan-300 px-4 py-2 font-semibold text-slate-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Ana içeriğe geç
        </a>

        <FabrikaTopbar
          account={{
            companyName: account.companyName,
            logoData: account.logoData,
          }}
          session={session}
        />

        <main
          id="fabrika-main"
          className={`business-ceo-main min-h-0 flex-1 overflow-y-auto ${
            isDashboardHome ? 'bg-[#edf2f8]' : 'bg-[#050d18]'
          }`}
          data-ceo-route={pathname}
          tabIndex={-1}
        >
          <div
            className={`business-ceo-content mx-auto w-full max-w-[1920px] ${
              isDashboardHome
                ? 'p-0'
                : 'px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6'
            }`}
          >
            {children}
          </div>
        </main>

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
