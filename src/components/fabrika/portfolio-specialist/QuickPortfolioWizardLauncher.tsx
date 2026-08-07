'use client';

import Link from 'next/link';
import { ArrowRight, WandSparkles } from 'lucide-react';

import {
  buildPortfolioWorkflowHref,
  PORTFOLIO_WORKFLOW_INTENT_STORAGE_KEY,
} from '@/lib/portfolio-workflow-intent';

export function QuickPortfolioWizardLauncher() {
  return (
    <Link
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
      href={buildPortfolioWorkflowHref({ source: 'hunter', step: 'source' })}
      onClick={() => {
        try {
          window.localStorage.setItem(
            PORTFOLIO_WORKFLOW_INTENT_STORAGE_KEY,
            JSON.stringify({
              source: 'hunter',
              step: 'source',
              resume: false,
              requestedAt: new Date().toISOString(),
            })
          );
        } catch {
          // Storage may be disabled; navigation still opens the workflow.
        }
      }}
    >
      <WandSparkles className="h-4 w-4" aria-hidden="true" />
      Hızlı portföy akışını başlat
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
