'use client';

import { useState } from 'react';
import FabrikaSidebar from './Sidebar';
import FabrikaTopbar from './FabrikaTopbar';
import {
  FabrikaSessionProvider,
  type FabrikaClientSession,
} from './FabrikaSessionContext';

interface FabrikaAppShellProps {
  children: React.ReactNode;
  account: {
    companyName: string;
  };
  session: FabrikaClientSession;
}

export default function FabrikaAppShell({
  children,
  account,
  session,
}: FabrikaAppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <FabrikaSessionProvider value={session}>
      <div className="fabrika-shell flex h-dvh min-h-0 overflow-hidden bg-slate-950 font-sans text-slate-100 [&_button]:font-sans [&_h1]:font-sans [&_h2]:font-sans [&_h3]:font-sans [&_h4]:font-sans [&_input]:font-sans [&_select]:font-sans [&_textarea]:font-sans">
        <a
          href="#fabrika-main"
          className="sr-only z-[100] rounded-md bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Ana içeriğe geç
        </a>

        <FabrikaSidebar
          companyName={account.companyName}
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
            className="min-h-0 flex-1 overflow-y-auto bg-slate-950"
            tabIndex={-1}
          >
            <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </FabrikaSessionProvider>
  );
}
