'use client';

import { useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import FabrikaTopbar, { type BusinessCeoTheme } from './FabrikaTopbar';
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

const businessCeoThemeStorageKey = 'business-ceo-theme';
const businessCeoThemeChangeEvent = 'business-ceo-theme-change';

function readBusinessCeoTheme(): BusinessCeoTheme {
  if (typeof window === 'undefined') return 'dark';
  const storedTheme = window.localStorage.getItem(businessCeoThemeStorageKey);
  return storedTheme === 'light' ? 'light' : 'dark';
}

function subscribeToBusinessCeoTheme(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  window.addEventListener('storage', onStoreChange);
  window.addEventListener(businessCeoThemeChangeEvent, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(businessCeoThemeChangeEvent, onStoreChange);
  };
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
  const theme = useSyncExternalStore(
    subscribeToBusinessCeoTheme,
    readBusinessCeoTheme,
    (): BusinessCeoTheme => 'dark'
  );
  const pathname = usePathname();
  const showOnboarding =
    !onboardingDismissed &&
    shouldShowFabrikaOnboarding({
      principalType: session.principalType,
      onboardingComplete,
    });

  function toggleTheme() {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(businessCeoThemeStorageKey, nextTheme);
    window.dispatchEvent(new Event(businessCeoThemeChangeEvent));
  }

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
        className="business-ceo-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-[#050d18] text-slate-100"
        data-business-theme={theme}
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
          onToggleTheme={toggleTheme}
          session={session}
          theme={theme}
        />

        <main
          id="fabrika-main"
          className="business-ceo-main min-h-0 flex-1 overflow-y-auto bg-[#050d18]"
          data-ceo-route={pathname}
          tabIndex={-1}
        >
          <div className="business-ceo-content mx-auto w-full max-w-[1920px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
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
