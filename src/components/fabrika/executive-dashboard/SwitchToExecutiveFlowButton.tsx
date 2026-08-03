'use client';

import { ArrowRight, Palette } from 'lucide-react';
import { useEffect } from 'react';

const DESIGN_STORAGE_KEY = 'business-ceo:dashboard-design';
const EXECUTIVE_ROUTE = '/fabrika/akilli-panel';

export default function SwitchToExecutiveFlowButton() {
  useEffect(() => {
    if (window.localStorage.getItem(DESIGN_STORAGE_KEY) === 'executive-flow') {
      window.location.replace(EXECUTIVE_ROUTE);
    }
  }, []);

  const openExecutiveFlow = () => {
    window.localStorage.setItem(DESIGN_STORAGE_KEY, 'executive-flow');
    window.location.assign(EXECUTIVE_ROUTE);
  };

  return (
    <button
      type="button"
      onClick={openExecutiveFlow}
      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.07] px-3.5 text-[11px] font-semibold text-cyan-100 transition hover:border-cyan-300/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      aria-label="AI Akış Merkezi tasarımına geç"
    >
      <Palette className="h-4 w-4" aria-hidden="true" />
      <span>
        <span className="block text-[9px] font-normal text-cyan-300/70">Yeni tasarıma geç</span>
        AI Akış Merkezi
      </span>
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
