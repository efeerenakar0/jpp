'use client';

import { useState } from 'react';
import FabrikaSidebar from './Sidebar';
import FabrikaTopbar from './FabrikaTopbar';

interface FabrikaAppShellProps {
  children: React.ReactNode;
}

export default function FabrikaAppShell({ children }: FabrikaAppShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-slate-950 text-slate-100">
      <a
        href="#fabrika-main"
        className="sr-only z-[100] rounded-md bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Ana içeriğe geç
      </a>

      <FabrikaSidebar
        mobileOpen={mobileNavigationOpen}
        onMobileClose={() => setMobileNavigationOpen(false)}
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
  );
}
