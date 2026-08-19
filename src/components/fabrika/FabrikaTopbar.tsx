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
import BusinessCeoLogo from '@/components/common/BusinessCeoLogo';
import { BUSINESS_CEO_MODULES } from '@/lib/business-ceo-dashboard';
import FabrikaCommandPalette from './FabrikaCommandPalette';
import FinanceCalculatorPopover from './FinanceCalculatorPopover';
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
  '/fabrika/reklam-tasarimi': 'AI Reklam Tasarımı',
  '/fabrika/belgeler': 'AI Tapu Takip',
  '/fabrika/yazilimci': 'AI Yazılımcı',
  '/fabrika/partnerler': 'AI Partner Bulucu',
  '/fabrika/yetkili-havuz': 'AI Yetkili Portföy Havuzu',
  '/fabrika/tapu-takip': 'AI Tapu Takip',
  '/fabrika/ayarlar': 'Şirket Ayarlarınız',
  '/fabrika/whatsapp': 'WhatsApp bağlantısı',
  '/fabrika/muhasebe': 'Muhasebe',
};

interface FabrikaTopbarProps {
  account: {
    companyName: string;
    logoData: string | null;
  };
  session: FabrikaClientSession;
}

function BusinessCeoWordmark({ dashboardHome = false }: { dashboardHome?: boolean }) {
  if (dashboardHome) {
    return (
      <Link
        href="/fabrika"
        className="group flex min-h-11 flex-col items-start justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        aria-label="Business CEO AI ana ekran"
      >
        <span
          className="relative block h-6 w-[202px] shrink-0 overflow-hidden"
          aria-hidden="true"
        >
          <Image
            alt=""
            className="pointer-events-none absolute left-[-28px] top-[-23px] h-[941px] w-[1672px] max-w-none select-none"
            height={941}
            src="/business-ceo/homepage-reference-v3.png"
            unoptimized
            width={1672}
          />
        </span>
        <span
          aria-hidden="true"
          className="mt-0.5 pl-0.5 text-[7px] font-semibold leading-none tracking-[0.44em] text-slate-400 sm:text-[8px]"
        >
          REAL ESTATE
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/fabrika"
      className="group flex min-h-11 flex-col items-start justify-center rounded-lg pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      aria-label="Business CEO AI ana ekran"
    >
      <BusinessCeoLogo
        className="w-[146px] sm:w-[178px] md:w-[205px]"
        decorative
        priority
        tone="light"
      />
      <span
        aria-hidden="true"
        className="mt-0.5 pl-0.5 text-[7px] font-semibold leading-none tracking-[0.44em] text-blue-700 sm:text-[8px]"
      >
        REAL ESTATE
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
    <header className="relative z-40 flex min-h-[72px] shrink-0 items-center justify-between gap-3 border-b border-[#dfe7f2] bg-white/95 px-4 py-2 text-[#07132f] shadow-[0_5px_18px_rgba(46,67,109,0.04)] backdrop-blur-xl sm:px-6 lg:px-9">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <BusinessCeoWordmark dashboardHome={isDashboardHome} />
        {!isDashboardHome ? (
          <>
            <span className="hidden h-8 w-px bg-slate-200 lg:block" />
            <span className="hidden truncate text-xs font-semibold text-slate-700 lg:block">
              {pageNames[pathname] ?? 'Business CEO AI'}
            </span>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <FabrikaJobIndicator bright />
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="hidden min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:flex"
          aria-label="Panelde ara"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden xl:inline">Panelde ara</span>
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 xl:inline">
            ⌘K
          </kbd>
        </button>
        <FinanceCalculatorPopover />
        {session.principalType === 'OWNER' ? (
          <Link
            className="hidden min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex"
            href="/fabrika/ayarlar"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">Şirket Ayarlarınız</span>
          </Link>
        ) : null}
        <NotificationBell bright />
        <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
          <SheetTrigger asChild>
            <button
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-blue-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-1.5 text-left shadow-sm transition hover:border-blue-300 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:px-2"
              aria-label="Şirket ve hesap menüsü"
            >
              <CompanyMark {...account} bright />
              <span className="hidden min-w-0 max-w-40 lg:block">
                <span className="block truncate text-xs font-semibold text-slate-900">
                  {account.companyName}
                </span>
                <span className="block truncate text-[10px] text-blue-700">
                  {session.principalType === 'OWNER' ? 'Patron hesabı' : 'Çalışan hesabı'}
                </span>
              </span>
              <ChevronDown className="hidden h-4 w-4 text-slate-500 lg:block" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl"
          >
            <DropdownMenuLabel className="px-2 py-2">
              <span className="block truncate text-sm font-semibold text-slate-900">
                {session.displayName}
              </span>
              <span className="block truncate text-[11px] font-normal text-slate-500">
                {account.companyName}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem asChild className="min-h-10 focus:bg-blue-50 focus:text-blue-800">
              <Link href="/fabrika">
                <CircleUserRound className="text-blue-600" /> Ana ekran
              </Link>
            </DropdownMenuItem>
            {session.principalType === 'OWNER' ? (
              <DropdownMenuItem asChild className="min-h-10 focus:bg-blue-50 focus:text-blue-800">
                <Link href="/fabrika/ayarlar">
                  <Settings className="text-blue-600" /> Şirket Ayarlarınız
                </Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild className="min-h-10 focus:bg-blue-50 focus:text-blue-800">
              <Link href="/fabrika/asistan">
                <MessageCircleMore className="text-blue-600" /> AI Satış Uzmanı
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
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
