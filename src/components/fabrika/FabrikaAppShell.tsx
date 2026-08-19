'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import FabrikaTopbar from './FabrikaTopbar';
import {
  FabrikaSessionProvider,
  type FabrikaClientSession,
} from './FabrikaSessionContext';
import OnboardingWizard from './OnboardingWizard';
import BusinessCeoHomeShell from './business-ceo/BusinessCeoHomeShell';
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
  const searchParams = useSearchParams();
  const isDashboardHome = pathname === '/fabrika';
  const isDashboardWorkspace = searchParams.get('workspace') === 'dashboard';
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

  if (isDashboardHome || isDashboardWorkspace) {
    return (
      <FabrikaSessionProvider value={session}>
        <>
          <a
            href="#fabrika-main"
            className="sr-only z-[100] rounded-md bg-blue-600 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
          >
            Ana içeriğe geç
          </a>
          <BusinessCeoHomeShell
            account={{
              companyName: account.companyName,
              logoData: account.logoData,
            }}
            session={session}
          >
            {children}
          </BusinessCeoHomeShell>
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
        className="business-ceo-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f6f8fc] text-[#07132f]"
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
          className="business-ceo-main min-h-0 flex-1 overflow-y-auto bg-[#f6f8fc]"
          data-ceo-route={pathname}
          tabIndex={-1}
        >
          <div
            className="business-ceo-content mx-auto w-full max-w-[1920px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6"
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
