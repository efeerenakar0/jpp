'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, Home, Kanban, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

type WorkspaceMetrics = {
  contacts: number;
  activeProperties: number;
  openDeals: number;
  overdueTasks: number;
};

const items = [
  { key: 'contacts', label: 'CRM müşterisi', href: '/fabrika/crm', icon: Users },
  { key: 'activeProperties', label: 'Aktif portföy', href: '/fabrika/portfoyler', icon: Home },
  { key: 'openDeals', label: 'Açık fırsat', href: '/fabrika/satis', icon: Kanban },
  { key: 'overdueTasks', label: 'Bekleyen görev', href: '/fabrika/takvim', icon: CalendarDays },
] as const;

/** Small cross-module status strip used by legacy Fabrika tools. */
export default function WorkspacePulse() {
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch('/api/fabrika/workspace', { cache: 'no-store' });
        const data = await response.json();
        if (active && response.ok && data.success) setMetrics(data.workspace.metrics);
      } catch {
        // The main tool remains usable when the workspace is temporarily unavailable.
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <section
      className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3 sm:px-4"
      aria-label="Bağlı emlak operasyonu"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-200">Bağlı emlak operasyonu</p>
          <p className="text-[11px] text-slate-500">Bu modüldeki kayıtlar CRM, portföy ve satış ekranlarıyla otomatik eşitlenir.</p>
        </div>
        <Link
          href="/fabrika/eslestirme"
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          Tümünü aç <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-live="polite">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2 transition-colors hover:border-emerald-500/25 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Icon className="h-3.5 w-3.5 text-emerald-400" />
              <span className="min-w-0 text-[11px] text-slate-400">{item.label}</span>
              <strong className="ml-auto text-sm text-white">{metrics?.[item.key] ?? '—'}</strong>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
