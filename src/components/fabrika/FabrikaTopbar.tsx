'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Aperture,
  Bot,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleUserRound,
  Code2,
  FileCheck2,
  Grid2X2,
  HousePlus,
  LogOut,
  Megaphone,
  Menu,
  MessageCircleMore,
  Moon,
  Network,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UsersRound,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { BUSINESS_CEO_MODULES } from '@/lib/business-ceo-dashboard';
import FabrikaCommandPalette from './FabrikaCommandPalette';
import FabrikaJobIndicator from './FabrikaJobIndicator';
import NotificationBell from './NotificationBell';
import type { FabrikaClientSession } from './FabrikaSessionContext';

const moduleIcons = {
  'portfolio-specialist': HousePlus,
  studio: Aperture,
  'advertising-design': BriefcaseBusiness,
  'marketing-specialist': Megaphone,
  developer: Code2,
  'partner-finder': Network,
  'authorized-pool': ShieldCheck,
  'deed-tracking': FileCheck2,
  'company-ceo': UsersRound,
} as const;

const pageNames: Record<string, string> = {
  '/fabrika': 'Ana ekran',
  '/fabrika/crm': 'AI Şirket CEO',
  '/fabrika/portfoyler': 'Portföylerimiz',
  '/fabrika/satis': 'Satış fırsatları',
  '/fabrika/takvim': 'Randevular ve görevler',
  '/fabrika/sirket': 'Şirket ve ekip',
  '/fabrika/asistan': 'AI Satış Uzmanı',
  '/fabrika/avci': 'AI Portföy Uzmanı',
  '/fabrika/pazarlamaci': 'AI Pazarlama Uzmanı',
  '/fabrika/studyo': 'AI Stüdyo',
  '/fabrika/belgeler': 'AI Tapu Takip',
  '/fabrika/yazilimci': 'AI Yazılımcı',
  '/fabrika/partnerler': 'AI Partner Bulucu',
  '/fabrika/yetkili-havuz': 'AI Yetkili Portföy Havuzu',
  '/fabrika/tapu-takip': 'AI Tapu Takip',
  '/fabrika/ayarlar': 'Şirket Ayarlarınız',
  '/fabrika/whatsapp': 'WhatsApp bağlantısı',
};

export type BusinessCeoTheme = 'dark' | 'light';

interface FabrikaTopbarProps {
  account: {
    companyName: string;
    logoData: string | null;
  };
  session: FabrikaClientSession;
  theme: BusinessCeoTheme;
  onToggleTheme: () => void;
}

function BusinessCeoWordmark() {
  return (
    <Link
      href="/fabrika"
      className="group flex min-h-11 items-center gap-2.5 rounded-lg pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      aria-label="Business CEO AI ana ekran"
    >
      <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/35 bg-cyan-400/[0.07] text-cyan-300">
        <Building2 className="h-5 w-5" aria-hidden="true" />
        <span className="absolute -left-1 top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
        <span className="absolute -left-1 bottom-1.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
      </span>
      <span className="hidden min-w-0 sm:block">
        <span className="block whitespace-nowrap text-[15px] font-semibold tracking-[0.12em] text-slate-50 md:text-[17px]">
          BUSINESS CEO <span className="text-cyan-300">AI</span>
        </span>
        <span className="block text-[9px] uppercase tracking-[0.24em] text-slate-500">
          Real Estate Operations
        </span>
      </span>
    </Link>
  );
}

function CompanyMark({ companyName, logoData }: FabrikaTopbarProps['account']) {
  if (logoData?.startsWith('data:image/')) {
    return (
      <Image
        alt=""
        className="h-9 w-9 rounded-full border border-cyan-300/25 object-cover"
        height={36}
        src={logoData}
        unoptimized
        width={36}
      />
    );
  }

  return (
    <span className="grid h-9 w-9 place-items-center rounded-full border border-cyan-300/25 bg-cyan-300/10 text-sm font-semibold text-cyan-100">
      {companyName.slice(0, 1).toLocaleUpperCase('tr-TR')}
    </span>
  );
}

function ModuleNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const modules = useMemo(
    () => [...BUSINESS_CEO_MODULES.workflow, ...BUSINESS_CEO_MODULES.secondary],
    []
  );

  return (
    <nav className="grid gap-2" aria-label="Business CEO AI modülleri">
      {modules.map((module) => {
        const Icon = moduleIcons[module.key];
        const modulePathname = module.href.split('?')[0];
        const active =
          pathname === modulePathname ||
          (modulePathname !== '/fabrika' && pathname.startsWith(modulePathname));
        return (
          <Link
            aria-current={active ? 'page' : undefined}
            className={`group flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
              active
                ? 'border-cyan-300/40 bg-cyan-300/10 text-white'
                : 'border-slate-800/90 bg-[#091525] text-slate-300 hover:border-cyan-300/30 hover:bg-cyan-300/[0.06]'
            }`}
            href={module.href}
            key={module.key}
            onClick={onNavigate}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-300">
              <Icon className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{module.title}</span>
              <span className="line-clamp-1 text-xs text-slate-500">
                {module.description}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function FabrikaTopbar({
  account,
  session,
  theme,
  onToggleTheme,
}: FabrikaTopbarProps) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/fabrika-auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/fabrika-giris');
    }
  }

  return (
    <header className="relative z-40 flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b border-cyan-300/15 bg-[#050d18]/95 px-3 py-2 backdrop-blur-xl sm:px-5 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <BusinessCeoWordmark />
        <span className="hidden h-8 w-px bg-slate-800 lg:block" />
        <span className="hidden truncate text-xs font-medium text-slate-400 lg:block">
          {pageNames[pathname] ?? 'Business CEO AI'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <FabrikaJobIndicator />
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="hidden min-h-10 items-center gap-2 rounded-xl border border-slate-800 bg-[#091525] px-3 text-xs text-slate-400 transition hover:border-cyan-300/30 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 md:flex"
          aria-label="Panelde ara"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden xl:inline">Panelde ara</span>
          <kbd className="hidden rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 xl:inline">
            ⌘K
          </kbd>
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="grid h-10 w-10 place-items-center rounded-xl border border-slate-800 bg-[#091525] text-amber-200 transition hover:border-amber-200/40 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
          title={theme === 'dark' ? 'Açık tema' : 'Koyu tema'}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Moon className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        {session.principalType === 'OWNER' ? (
          <Link
            className="hidden min-h-10 items-center gap-2 rounded-xl border border-amber-100/25 bg-amber-100/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:border-amber-100/45 hover:bg-amber-100/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:flex"
            href="/fabrika/ayarlar"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">Şirket Ayarlarınız</span>
          </Link>
        ) : null}
        <NotificationBell />
        <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
          <SheetTrigger asChild>
            <button
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-800 bg-[#091525] text-slate-300 transition hover:border-cyan-300/35 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              type="button"
              aria-label="Modülleri aç"
            >
              <Grid2X2 className="hidden h-4.5 w-4.5 sm:block" aria-hidden="true" />
              <Menu className="h-5 w-5 sm:hidden" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent
            className="w-[min(92vw,27rem)] max-w-none border-cyan-300/20 bg-[#06111f] p-0 text-slate-100"
            side="right"
          >
            <SheetHeader className="border-b border-slate-800 px-5 py-5">
              <SheetTitle className="flex items-center gap-2 text-slate-100">
                <Bot className="h-5 w-5 text-cyan-300" aria-hidden="true" />
                Modüller
              </SheetTitle>
              <SheetDescription className="text-slate-500">
                Yapmak istediğiniz işi seçin. Mevcut verileriniz korunur.
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar">
              <ModuleNavigation onNavigate={() => setNavigationOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-transparent px-1.5 text-left transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:px-2"
              aria-label="Şirket ve hesap menüsü"
            >
              <CompanyMark {...account} />
              <span className="hidden min-w-0 max-w-40 lg:block">
                <span className="block truncate text-xs font-semibold text-slate-100">
                  {account.companyName}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  {session.principalType === 'OWNER' ? 'Patron hesabı' : 'Çalışan hesabı'}
                </span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-500 lg:block" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 border border-slate-700 bg-[#091525] p-2 text-slate-100 shadow-2xl"
          >
            <DropdownMenuLabel className="px-2 py-2">
              <span className="block truncate text-sm font-semibold text-slate-100">
                {session.displayName}
              </span>
              <span className="block truncate text-[11px] font-normal text-slate-500">
                {account.companyName}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem asChild className="min-h-10 focus:bg-cyan-300/10 focus:text-cyan-100">
              <Link href="/fabrika">
                <CircleUserRound className="text-cyan-300" /> Ana ekran
              </Link>
            </DropdownMenuItem>
            {session.principalType === 'OWNER' ? (
              <DropdownMenuItem asChild className="min-h-10 focus:bg-cyan-300/10 focus:text-cyan-100">
                <Link href="/fabrika/ayarlar">
                  <Settings className="text-cyan-300" /> Şirket Ayarlarınız
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild className="min-h-10 focus:bg-cyan-300/10 focus:text-cyan-100">
              <Link href="/fabrika/asistan">
                <MessageCircleMore className="text-cyan-300" /> AI Satış Uzmanı
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              className="min-h-10 text-rose-300 focus:bg-rose-400/10 focus:text-rose-200"
              disabled={loggingOut}
              onSelect={handleLogout}
            >
              <LogOut /> {loggingOut ? 'Çıkış yapılıyor…' : 'Oturumu kapat'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FabrikaCommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}
