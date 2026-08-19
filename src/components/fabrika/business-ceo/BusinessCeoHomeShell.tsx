'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  FileText,
  FolderKanban,
  LogOut,
  Menu,
  MessageCircleMore,
  Search,
  Send,
  Settings,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';

import BusinessCeoLogo from '@/components/common/BusinessCeoLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FabrikaCommandPalette from '@/components/fabrika/FabrikaCommandPalette';
import FinanceCalculatorPopover, {
  LiveExchangeRates,
} from '@/components/fabrika/FinanceCalculatorPopover';
import NotificationBell from '@/components/fabrika/NotificationBell';
import type { FabrikaClientSession } from '@/components/fabrika/FabrikaSessionContext';

import styles from './BusinessCeoHomeShell.module.css';

type HomeShellProps = {
  account: {
    companyName: string;
    logoData: string | null;
  };
  children: React.ReactNode;
  session: FabrikaClientSession;
};

type ManagerReply = {
  error?: string;
  message?: { content?: string } | string;
};

const navigation = [
  { label: 'Ana Panel', href: '/fabrika', icon: Building2 },
  { label: 'CRM · Müşteri Takibi', href: '/fabrika/crm?view=customers&workspace=dashboard', icon: UsersRound },
  { label: 'Portföyler', href: '/fabrika/portfoyler?workspace=dashboard', icon: FolderKanban },
  { label: 'Belge ve Sözleşme Asistanı', href: '/fabrika/belgeler?workspace=dashboard', icon: FileText },
  { label: 'Muhasebe', href: '/fabrika/muhasebe?workspace=dashboard', icon: CircleDollarSign },
  { label: 'Takvim', href: '/fabrika/takvim?workspace=dashboard', icon: CalendarDays },
  { label: 'Sohbetler', href: '/fabrika/asistan?workspace=dashboard', icon: MessageCircleMore },
] as const;

function CompanyAvatar({
  companyName,
  logoData,
}: HomeShellProps['account']) {
  if (logoData?.startsWith('data:image/')) {
    return (
      <Image
        alt={`${companyName} şirket logosu`}
        className={styles.companyAvatarImage}
        height={46}
        src={logoData}
        unoptimized
        width={46}
      />
    );
  }

  const initials = companyName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('');

  return (
    <span aria-label={`${companyName} şirket simgesi`} className={styles.companyAvatarFallback}>
      <Building2 aria-hidden="true" />
      <strong>{initials || 'BC'}</strong>
    </span>
  );
}

export default function BusinessCeoHomeShell({
  account,
  children,
  session,
}: HomeShellProps) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantReply, setAssistantReply] = useState(
    `${account.companyName} için hangi bilgiyi öğrenmek istersiniz?`
  );
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
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

  useEffect(() => {
    let active = true;

    async function loadUnread() {
      try {
        const response = await fetch('/api/fabrika/assistant/metrics', {
          cache: 'no-store',
        });
        const data = (await response.json()) as { newMessages?: number };
        if (active && response.ok) {
          setUnreadMessages(Math.max(0, data.newMessages || 0));
        }
      } catch {
        // The badge is supplementary; the main dashboard keeps its own error state.
      }
    }

    void loadUnread();
    const interval = window.setInterval(loadUnread, 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function sendAssistantMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = assistantInput.trim();
    if (!message || assistantBusy) return;

    setAssistantBusy(true);
    setAssistantReply('Şirket verileriniz kontrol ediliyor…');
    try {
      const response = await fetch('/api/fabrika/general-manager/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          clientRequestId: crypto.randomUUID(),
        }),
      });
      const data = (await response.json().catch(() => null)) as ManagerReply | null;
      if (!response.ok) {
        throw new Error(data?.error || 'AI CEO Asistanı şu anda yanıt veremedi.');
      }
      const reply =
        typeof data?.message === 'string'
          ? data.message
          : data?.message?.content;
      setAssistantReply(reply?.trim() || 'İsteğiniz işlendi.');
      setAssistantInput('');
    } catch (error) {
      setAssistantReply(
        error instanceof Error
          ? error.message
          : 'AI CEO Asistanı şu anda yanıt veremedi.'
      );
    } finally {
      setAssistantBusy(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch('/api/fabrika-auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/fabrika-giris');
    }
  }

  const roleLabel =
    session.principalType === 'OWNER' ? 'CEO Girişi' : 'Kullanıcı Girişi';

  return (
    <div className={styles.shell}>
      <button
        aria-expanded={mobileMenuOpen}
        aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
        className={styles.mobileMenuButton}
        onClick={() => setMobileMenuOpen((current) => !current)}
        type="button"
      >
        {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>

      {mobileMenuOpen ? (
        <button
          aria-label="Menüyü kapat"
          className={styles.mobileBackdrop}
          onClick={() => setMobileMenuOpen(false)}
          type="button"
        />
      ) : null}

      <aside className={styles.sidebar} data-open={mobileMenuOpen}>
        <Link aria-label="Business CEO AI ana panel" className={styles.brand} href="/fabrika">
          <BusinessCeoLogo className={styles.brandLogo} decorative priority tone="dark" />
          <span>REAL ESTATE</span>
        </Link>

        <nav aria-label="Ana panel menüsü" className={styles.navigation}>
          {navigation.map(({ label, href, icon: Icon }) => {
            const targetPath = href.split('?')[0];
            const active = pathname === targetPath;
            return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={styles.navigationLink}
              data-active={active}
              href={href}
              key={href}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
              {label === 'Sohbetler' && unreadMessages > 0 ? (
                <strong className={styles.navigationBadge}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </strong>
              ) : (
                <ChevronRight aria-hidden="true" className={styles.navigationArrow} />
              )}
            </Link>
            );
          })}
        </nav>

        <LiveExchangeRates />

        <section className={styles.assistantCard} data-open={assistantOpen}>
          <h2 className={styles.assistantTitle}>
            <Sparkles aria-hidden="true" />
            <span>AI CEO Asistanı</span>
          </h2>
          <button
            aria-expanded={assistantOpen}
            className={styles.mascotButton}
            onClick={() => setAssistantOpen((current) => !current)}
            type="button"
          >
            <Image
              alt="AI CEO Asistanı maskotu"
              className={styles.mascot}
              height={240}
              priority
              src="/business-ceo/homepage-v4/mascot-transparent.png"
              width={180}
            />
          </button>
          <div aria-live="polite" className={styles.assistantReply}>
            {assistantReply}
          </div>
          <form className={styles.assistantForm} onSubmit={sendAssistantMessage}>
            <label className="sr-only" htmlFor="business-ceo-assistant-input">
              AI CEO Asistanına sorun
            </label>
            <input
              disabled={assistantBusy}
              id="business-ceo-assistant-input"
              onChange={(event) => setAssistantInput(event.target.value)}
              onFocus={() => setAssistantOpen(true)}
              placeholder="Asistana bir şey sor…"
              value={assistantInput}
            />
            <button
              aria-label="Soruyu gönder"
              disabled={!assistantInput.trim() || assistantBusy}
              type="submit"
            >
              <Send aria-hidden="true" />
            </button>
          </form>
        </section>

        <div className={styles.onlineStatus}>
          <span /> Sistem Online
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.welcome}>
            <h1>Hoş Geldin, {account.companyName} <span aria-hidden="true">👋</span></h1>
            <p>Tüm iş süreçlerinizi yapay zekâ gücüyle yönetin.</p>
          </div>

          <button
            aria-label="Panelde ara"
            className={styles.searchButton}
            onClick={() => setCommandOpen(true)}
            type="button"
          >
            <Search aria-hidden="true" />
            <span>Arama yapın…</span>
            <kbd>⌘K</kbd>
          </button>

          <div className={styles.topbarActions}>
            <FinanceCalculatorPopover />
            {session.principalType === 'OWNER' ? (
              <Link className={styles.settingsLink} href="/fabrika/ayarlar">
                <Settings aria-hidden="true" />
                <span>Şirket Ayarlarınız</span>
              </Link>
            ) : null}
            <NotificationBell bright />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={styles.accountButton} type="button">
                  <CompanyAvatar {...account} />
                  <span>
                    <strong>{account.companyName}</strong>
                    <small>{roleLabel}</small>
                  </span>
                  <ChevronDown aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 border-slate-200 bg-white p-2 text-slate-900 shadow-xl"
              >
                <DropdownMenuLabel>
                  <span className="block truncate font-semibold">{session.displayName}</span>
                  <span className="block truncate text-xs font-normal text-slate-500">
                    {account.companyName}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-100" />
                <DropdownMenuItem asChild className="focus:bg-blue-50 focus:text-blue-800">
                  <Link href="/fabrika/ayarlar">
                    <Settings /> Şirket Ayarlarınız
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                  disabled={loggingOut}
                  onSelect={logout}
                >
                  <LogOut /> {loggingOut ? 'Çıkış yapılıyor…' : 'Oturumu kapat'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className={styles.main}
          data-dashboard-workspace={pathname === '/fabrika' ? undefined : 'true'}
          id="fabrika-main"
          tabIndex={-1}
        >
          {children}
        </main>
      </section>

      <FabrikaCommandPalette onOpenChange={setCommandOpen} open={commandOpen} />
    </div>
  );
}
