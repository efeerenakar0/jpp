'use client';

import { CalendarDays, Menu, Radio, Search } from 'lucide-react';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';

const pageNames: Record<string, string> = {
  '/fabrika': 'Komuta Merkezi',
  '/fabrika/crm': 'Merkezi CRM',
  '/fabrika/portfoyler': 'Portföy Yönetimi',
  '/fabrika/satis': 'Merkezi CRM · Satış süreci',
  '/fabrika/takvim': 'Randevular ve Görevler',
  '/fabrika/satici-portali': 'Portföyler · Malik raporları',
  '/fabrika/sirket': 'Şirket ve Ekip',
  '/fabrika/asistan': 'Asistan',
  '/fabrika/avci': 'Avcı',
  '/fabrika/pazarlamaci': 'Pazarlamacı',
  '/fabrika/studyo': 'Stüdyo',
  '/fabrika/belgeler': 'Belge Merkezi',
  '/fabrika/yazilimci': 'Yazılımcı',
};

interface FabrikaTopbarProps {
  onOpenNavigation: () => void;
}

export default function FabrikaTopbar({ onOpenNavigation }: FabrikaTopbarProps) {
  const pathname = usePathname();
  const title = pageNames[pathname] ?? 'CEO Workspace';

  return (
    <header className="relative z-40 flex h-[76px] shrink-0 items-center justify-between border-b border-[#243247] bg-[#08111f]/95 px-4 backdrop-blur-xl sm:px-6 lg:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenNavigation}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:hidden"
          aria-label="Navigasyonu aç"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate font-serif text-[15px] font-semibold tracking-wide text-[#f6f1e8]">{title}</p>
          <p className="hidden text-[11px] text-slate-500 sm:block">Business CEO AI · Executive workspace</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          className="hidden h-9 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 md:flex"
          aria-label="Panelde ara"
          title="Komut araması yakında"
        >
          <Search className="h-4 w-4" />
          <span>Panelde ara</span>
          <kbd className="ml-3 rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">⌘K</kbd>
        </button>
        <div className="hidden items-center gap-2 text-[11px] text-slate-400 xl:flex">
          <CalendarDays className="h-3.5 w-3.5 text-[#c99a57]" />
          {new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 sm:flex">
          <Radio className="h-3.5 w-3.5" />
          Sistemler çalışıyor
        </div>
        <NotificationBell />
      </div>
    </header>
  );
}
