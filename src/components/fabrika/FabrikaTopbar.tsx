'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Aperture,
  Bot,
  BriefcaseBusiness,
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
  Network,
  Search,
  Settings,
  ShieldCheck,
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

interface FabrikaTopbarProps {
  account: {
    companyName: string;
    logoData: string | null;
  };
  session: FabrikaClientSession;
}

function BusinessCeoWordmark({ bright = false }: { bright?: boolean }) {
  return (
    <Link
      href="/fabrika"
      className="group flex min-h-11 items-center rounded-lg pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      aria-label="Business CEO AI ana ekran"
    >
      <span className={`flex min-w-0 whitespace-nowrap ${bright ? 'flex-col items-start leading-none' : 'items-center'}`}>
        <span className={`font-black tracking-[-0.035em] ${
          bright
            ? 'text-[15px] text-[#070b16] sm:text-[18px] md:text-[21px]'
            : 'text-[11px] tracking-[0.055em] text-white sm:text-[14px] md:text-[16px]'
        }`}>
          BUSINESS CEO{' '}
          <span className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI
          </span>
        </span>
        {bright ? (
          <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.34em] text-blue-700 sm:text-[9px]">
            Real Estate
          </span>
        ) : (
          <>
            <span className="mx-2 h-5 w-px shrink-0 bg-slate-600 sm:mx-3" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-[0.04em] text-slate-300 sm:text-xs md:text-sm">
              Real Estate
            </span>
          </>
        )}
      </span>
    </Link>
  );
}

function CompanyMark({
  companyName,
  logoData,
  bright = false,
}: FabrikaTopbarProps['account'] & { bright?: boolean }) {
  if (logoData?.startsWith('data:image/')) {
    return (
      <Image
        alt=""
        className={`h-9 w-9 rounded-full border object-cover ${bright ? 'border-blue-200' : 'border-cyan-300/25'}`}
        height={36}
        src={logoData}
        unoptimized
        width={36}
      />
    );
  }

  return (
    <span className={`grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold ${
      bright
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'
    }`}>
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
}: FabrikaTopbarProps) {
  const pathname = usePathname();
  const isDashboardHome = pathname === '/fabrika';
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
    <header className={`relative z-40 flex min-h-[68px] shrink-0 items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur-xl sm:px-6 lg:px-9 ${
      isDashboardHome
        ? 'border-[#cdd9e9] bg-[#f6f8fc]/95 text-[#0a1b53] shadow-[0_4px_18px_rgba(52,74,116,0.05)]'
        : 'border-cyan-300/15 bg-[#050d18]/95'
    }`}>
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <BusinessCeoWordmark bright={isDashboardHome} />
        {!isDashboardHome ? (
          <>
            <span className="hidden h-8 w-px bg-slate-800 lg:block" />
            <span className="hidden truncate text-xs font-medium text-slate-400 lg:block">
              {pageNames[pathname] ?? 'Business CEO AI'}
            </span>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <FabrikaJobIndicator bright={isDashboardHome} />
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className={`hidden min-h-10 items-center gap-2 rounded-xl border px-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:flex ${
            isDashboardHome
              ? 'border-slate-200 bg-white/75 text-[#425274] shadow-sm hover:border-blue-200 hover:bg-white hover:text-blue-700'
              : 'border-slate-800 bg-[#091525] text-slate-400 hover:border-cyan-300/30 hover:text-slate-100'
          }`}
          aria-label="Panelde ara"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden xl:inline">Panelde ara</span>
          <kbd className="hidden rounded border border-slate-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 xl:inline">
            ⌘K
          </kbd>
        </button>
        {session.principalType === 'OWNER' ? (
          <Link
            className={`hidden min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex ${
              isDashboardHome
                ? 'border-slate-200 bg-white/75 text-[#14285d] hover:border-blue-200 hover:bg-white'
                : 'border-amber-100/25 bg-amber-100/[0.04] text-slate-200 hover:border-amber-100/45 hover:bg-amber-100/[0.08]'
            }`}
            href="/fabrika/ayarlar"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">Şirket Ayarlarınız</span>
          </Link>
        ) : null}
        <NotificationBell bright={isDashboardHome} />
        <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
          <SheetTrigger asChild>
            <button
              className={`grid h-10 w-10 place-items-center rounded-xl border shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isDashboardHome
                  ? 'border-slate-200 bg-white/75 text-blue-700 hover:border-blue-200 hover:bg-white'
                  : 'border-slate-800 bg-[#091525] text-slate-300 hover:border-cyan-300/35 hover:text-cyan-200'
              }`}
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
              className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-1.5 text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-2 ${
                isDashboardHome
                  ? 'border-slate-200 bg-white/75 hover:border-blue-200 hover:bg-white'
                  : 'border-transparent hover:border-cyan-300/25 hover:bg-cyan-300/[0.05]'
              }`}
              aria-label="Şirket ve hesap menüsü"
            >
              <CompanyMark {...account} bright={isDashboardHome} />
              <span className="hidden min-w-0 max-w-40 lg:block">
                <span className={`block truncate text-xs font-semibold ${isDashboardHome ? 'text-[#0a1b53]' : 'text-slate-100'}`}>
                  {account.companyName}
                </span>
                <span className={`block truncate text-[10px] ${isDashboardHome ? 'text-[#61708e]' : 'text-slate-500'}`}>
                  {session.principalType === 'OWNER' ? 'Patron hesabı' : 'Çalışan hesabı'}
                </span>
              </span>
              <ChevronDown className={`hidden h-4 w-4 lg:block ${isDashboardHome ? 'text-[#61708e]' : 'text-slate-500'}`} aria-hidden="true" />
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
