'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Aperture,
  ArrowUpRight,
  Bell,
  Bot,
  Code2,
  Crosshair,
  Crown,
  Megaphone,
  MessageCircle,
  Send,
  AlertTriangle,
  Users,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Flame,
  Star,
  Target,
} from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '@/components/fabrika/EmptyState';
import DigitalManagerOperations from '@/components/fabrika/DigitalManagerOperations';
import { compactCriticalNotifications } from '@/lib/fabrika-critical-notifications';
import SwitchToExecutiveFlowButton from '@/components/fabrika/executive-dashboard/SwitchToExecutiveFlowButton';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
  important?: boolean;
  dedupeKey?: string | null;
  link?: string | null;
  groupedCount?: number;
};

type ChatMessage = {
  id: string;
  role: 'patron' | 'asistan' | 'system';
  content: string;
  authorName?: string | null;
  authorType?: string | null;
  provider?: string | null;
  createdAt: string;
};

type OperationalContext = {
  generatedAt: string;
  company: {
    name: string;
    principalName: string;
    principalType: 'OWNER' | 'EMPLOYEE';
  };
  metrics: {
    activeProjects: number;
    huntedListings: number;
    authorizedListings: number;
    pendingAppointments: number;
    activeConversations: number;
    unreadNotifications: number;
    crmContacts: number;
    activeCrmProperties: number;
    openDeals: number;
    overdueTasks: number;
    upcomingTasks: number;
    campaigns: number;
    approvedCampaignCopies: number;
  };
  priorities: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    detail: string;
    href: string;
  }>;
  calendar: {
    google: {
      connected: boolean;
      email?: string | null;
      lastSyncedAt?: string | null;
      status?: string;
    };
  };
};

type ManagerSuggestion = {
  label: string;
  prompt: string;
};

type ManagerProvider = {
  configured: boolean;
  provider: string;
  model: string;
  activeProvider: string;
  sharedWithAssistant: boolean;
};

function ExecutiveMetricCard({
  label,
  value,
  icon: Icon,
  hint,
  accent = 'success',
}: {
  label: string;
  value: ReactNode;
  icon: typeof Users;
  hint: string;
  accent?: 'success' | 'danger' | 'neutral';
}) {
  const accentClass = accent === 'danger'
    ? 'text-rose-400'
    : accent === 'neutral'
      ? 'text-[#9aa8ba]'
      : 'text-emerald-400';

  return (
    <article className="group relative min-h-[116px] overflow-hidden rounded-[11px] border border-[#34445a] bg-[linear-gradient(145deg,#0d1c2c,#0a1725)] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition-colors hover:border-[#c99a57]/45">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium normal-case tracking-normal text-[#99a7b8]">{label}</p>
          <div className="mt-2 flex items-end gap-2">
            <strong className="font-heading text-[2rem] font-normal leading-none text-[#f4f0e8]">{value}</strong>
            <span className={`pb-0.5 text-[10px] font-semibold ${accentClass}`}>
              {accent === 'danger' ? 'Takip gerekli' : accent === 'neutral' ? 'Canlı' : 'Güncel'}
            </span>
          </div>
          <p className="mt-2 text-[10px] text-[#738299]">{hint}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d3a557] text-[#d9aa5e] shadow-[inset_0_0_18px_rgba(201,154,87,0.08)]">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

const getNotificationStyles = (type: string) => {
  switch (type) {
    case 'GREEN_LISTING':
      return { icon: Crosshair, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'WEBSITE_GENERATED':
      return { icon: Code2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'AD_COPY_READY':
      return { icon: Megaphone, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'APPOINTMENT_REQUEST':
      return { icon: MessageCircle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    case 'STUDIO_READY':
      return { icon: Aperture, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'NEW_CUSTOMER_MESSAGE':
      return { icon: MessageCircle, color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/30' };
    case 'SYSTEM':
      return { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30' };
    default:
      return { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' };
  }
};

export default function CommandCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [context, setContext] = useState<OperationalContext | null>(null);
  const [suggestions, setSuggestions] = useState<ManagerSuggestion[]>([]);
  const [provider, setProvider] = useState<ManagerProvider | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);

  async function fetchData() {
    try {
      const notifRes = await fetch('/api/fabrika/notifications?scope=important');
      const notifData = await notifRes.json();
      if (notifRes.ok && Array.isArray(notifData.notifications)) {
        setNotifications(compactCriticalNotifications(notifData.notifications));
      }

      const chatRes = await fetch('/api/fabrika/general-manager/chat');
      const chatData = await chatRes.json();
      if (chatData.success) {
        setMessages(chatData.messages);
        if (chatData.context) {
          setContext(chatData.context);
        }
        if (Array.isArray(chatData.suggestions)) {
          setSuggestions(chatData.suggestions);
        }
        if (chatData.provider) {
          setProvider(chatData.provider);
        }
      }
      setChatLoading(false);

    } catch (err) {
      console.error('Data fetch error:', err);
      setChatLoading(false);
    }
  }

  useEffect(() => {
    const initialTimeout = setTimeout(() => fetchData(), 0);
    const interval = setInterval(fetchData, 10_000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const lastMessageId = messages.at(-1)?.id || null;
    if (lastMessageId === lastMessageIdRef.current) return;
    const animationFrame = requestAnimationFrame(() => {
      const chat = chatScrollRef.current;
      if (chat && (lastMessageIdRef.current === null || stickToBottomRef.current)) {
        chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
      }
      lastMessageIdRef.current = lastMessageId;
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [messages]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText('');
    stickToBottomRef.current = true;

    const tempId = Date.now().toString();
    setMessages((previous) => [
      ...previous,
      {
        id: tempId,
        role: 'patron',
        content: userMessage,
        createdAt: new Date().toISOString(),
      },
    ]);

    setIsSending(true);

    try {
      const clientRequestId = crypto.randomUUID();
      const response = await fetch('/api/fabrika/general-manager/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, clientRequestId }),
      });

      const data = await response.json();
      if (data.success) {
        setMessages((previous) => [
          ...previous.filter((message) => message.id !== tempId),
          {
            id: tempId,
            role: 'patron',
            content: userMessage,
            createdAt: new Date().toISOString(),
          },
          data.message,
        ]);
        if (data.context) setContext(data.context);
        if (data.provider) setProvider(data.provider);
        fetchData();
        window.dispatchEvent(new Event('digital-manager-refresh'));
      } else {
        toast.error(data.error || 'Mesaj gönderilemedi');
      }
    } catch {
      toast.error('Bağlantı hatası');
    } finally {
      setIsSending(false);
    }
  };

  const priorities = context?.priorities.slice(0, 3) || [];

  return (
    <div className="pb-7">
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="business-ceo-display text-[1.9rem] font-medium leading-tight text-[#f6f1e8] sm:text-[2.15rem]">
                {context?.company.name || 'Business CEO AI'} Komuta Merkezi
              </h1>
              <p className="mt-2 max-w-3xl text-[13px] leading-5 text-[#8e9caf]">
                Portföy, müşteri iletişimi, pazarlama ve operasyon süreçlerinizi tek bir merkezden yönetin.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SwitchToExecutiveFlowButton />
              <span className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-[#34445a] bg-[#0b1827] px-3.5 text-[11px] text-[#c3cbd5] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
                <CalendarDays className="h-4 w-4 text-[#d6a55a]" />
                {new Date().toLocaleDateString('tr-TR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  weekday: 'long',
                })}
                <ChevronRight className="h-3.5 w-3.5 rotate-90 text-[#66758a]" />
              </span>
            </div>
          </header>

          <div className="order-2 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <ExecutiveMetricCard label="CRM müşterisi" value={context?.metrics.crmContacts || 0} icon={Users} hint="Doğrulanmış kayıt" />
            <ExecutiveMetricCard label="Aktif portföy" value={context?.metrics.activeCrmProperties || 0} icon={Activity} hint="Yayındaki portföy" />
            <ExecutiveMetricCard label="Sıcak müşteri" value={context?.metrics.activeConversations || 0} icon={Flame} hint="Aktif görüşme" />
            <ExecutiveMetricCard label="Bugünkü randevu" value={context?.metrics.upcomingTasks || 0} icon={CalendarDays} hint="Bugünün planı" accent="neutral" />
            <ExecutiveMetricCard label="Kritik görev" value={context?.metrics.overdueTasks || 0} icon={AlertTriangle} hint="Geciken görevler" accent={context?.metrics.overdueTasks ? 'danger' : 'neutral'} />
          </div>

          <section className="order-3 rounded-xl border border-[#34445a] bg-[linear-gradient(145deg,#0d1b2a,#0a1725)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <TargetIcon />
                <h2 className="font-heading text-sm font-semibold text-[#f6f1e8]">Yönetici öncelikleri</h2>
              </div>
              <span className="text-[10px] text-[#718198]">Canlı şirket verisi</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {(priorities.length > 0
                ? priorities
                : [
                    {
                      id: 'overdue',
                      severity: 'critical' as const,
                      title: `${context?.metrics.overdueTasks || 0} kritik görev takipte`,
                      detail: 'Geciken ve yaklaşan operasyonları kontrol edin.',
                      href: '/fabrika/takvim',
                    },
                    {
                      id: 'conversations',
                      severity: 'warning' as const,
                      title: `${context?.metrics.activeConversations || 0} müşteri görüşmesi açık`,
                      detail: 'Yanıt ve insan devri bekleyen sohbetleri inceleyin.',
                      href: '/fabrika/asistan',
                    },
                    {
                      id: 'portfolio',
                      severity: 'info' as const,
                      title: `${context?.metrics.activeCrmProperties || 0} aktif portföy yayında`,
                      detail: 'Portföy performansını ve yeni talepleri görüntüleyin.',
                      href: '/fabrika/portfoyler',
                    },
                  ]
              ).map((priority) => {
                const tone = priority.severity === 'critical'
                  ? 'border-rose-500/35 bg-rose-500/[0.06] text-rose-300'
                  : priority.severity === 'warning'
                    ? 'border-amber-500/35 bg-amber-500/[0.06] text-amber-300'
                    : 'border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-300';
                const PriorityIcon = priority.severity === 'critical'
                  ? AlertTriangle
                  : priority.severity === 'warning'
                    ? Clock3
                    : Star;
                return (
                  <article key={priority.id} className={`flex min-h-[146px] flex-col overflow-hidden rounded-lg border ${tone}`}>
                    <div className="flex flex-1 gap-3 p-3.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-current/30 bg-black/10">
                        <PriorityIcon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-bold uppercase tracking-[0.16em]">{priority.severity === 'critical' ? 'Yüksek öncelik' : priority.severity === 'warning' ? 'Orta öncelik' : 'Fırsat'}</p>
                        <h3 className="mt-2 text-[13px] font-semibold text-[#f6f1e8]">{priority.title}</h3>
                        <p className="mt-1.5 text-[10px] leading-4 text-[#91a1b5]">{priority.detail}</p>
                      </div>
                    </div>
                    <Link href={priority.href} className="inline-flex items-center justify-between border-t border-current/15 px-3.5 py-2.5 text-[10px] font-semibold">
                      İlgili kaydı aç <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="order-1 rounded-xl border border-[#34445a] bg-[linear-gradient(145deg,#0d1b2a,#0a1725)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-sm text-[#f6f1e8]">Kritik operasyon akışı</h2>
                <p className="mt-1 text-[10px] text-[#718198]">Müdahale veya karar gerektiren son olaylar</p>
              </div>
              <Link href="/fabrika" className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
                Tüm akışı görüntüle <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="custom-scrollbar max-h-56 space-y-1.5 overflow-y-auto">
              {notifications.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Kritik olay yok" description="Şu anda müdahale gerektiren bir operasyon bulunmuyor." />
              ) : notifications.map((notification) => {
                const { icon: Icon, color, bg } = getNotificationStyles(notification.type);
                const status = notification.type === 'SYSTEM'
                  ? { label: 'Gecikti', className: 'border-rose-500/45 bg-rose-500/10 text-rose-300' }
                  : notification.type === 'NEW_CUSTOMER_MESSAGE' || notification.type === 'APPOINTMENT_REQUEST'
                    ? { label: 'Yanıt bekliyor', className: 'border-amber-500/45 bg-amber-500/10 text-amber-300' }
                    : notification.type === 'GREEN_LISTING' || notification.type === 'WEBSITE_GENERATED' || notification.type === 'STUDIO_READY'
                      ? { label: 'Tamamlandı', className: 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300' }
                      : { label: 'Aktif', className: 'border-[#c99a57]/45 bg-[#c99a57]/10 text-[#e2b56e]' };
                const href = notification.link || (notification.type === 'NEW_CUSTOMER_MESSAGE' || notification.type === 'APPOINTMENT_REQUEST'
                  ? '/fabrika/asistan'
                  : notification.type === 'GREEN_LISTING'
                    ? '/fabrika/portfoyler'
                    : notification.type === 'AD_COPY_READY'
                      ? '/fabrika/pazarlamaci'
                      : notification.type === 'STUDIO_READY'
                        ? '/fabrika/studyo'
                        : '/fabrika');
                const owner = context?.company.principalName || 'Ekip';
                return (
                  <article key={notification.id} className="grid grid-cols-[3.6rem_2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[#29384d] bg-[#081522]/70 px-2.5 py-2 sm:grid-cols-[3.6rem_2rem_minmax(0,1fr)_6.5rem_7.5rem_3rem]">
                    <time className="text-[10px] text-[#7d8ca1]">{new Date(notification.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</time>
                    <span className={`flex h-7 w-7 items-center justify-center rounded-md border ${bg}`}><Icon className={`h-3.5 w-3.5 ${color}`} /></span>
                    <div className="min-w-0"><h3 className="truncate text-[10px] font-medium text-[#dfe5ed]">{notification.title}{notification.groupedCount && notification.groupedCount > 1 ? ` · ${notification.groupedCount} olay` : ''}</h3><p className="truncate text-[9px] text-[#718198]">{notification.message}</p></div>
                    <span className={`hidden rounded border px-2 py-1 text-center text-[8px] font-semibold uppercase sm:block ${status.className}`}>{status.label}</span>
                    <span className="hidden items-center gap-2 truncate text-[9px] text-[#9eabba] sm:flex"><i className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#c99a57]/50 not-italic text-[8px] text-[#e2b56e]">{owner.slice(0, 2).toUpperCase()}</i>{owner}</span>
                    <Link href={href} className="text-right text-[9px] font-semibold text-emerald-300 hover:text-emerald-200">İncele</Link>
                  </article>
                );
              })}
            </div>
          </section>

          <details className="order-4 group rounded-xl border border-[#2b3b50] bg-[#0b1929]/70">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-semibold text-[#c6d0dc]">
              Gelişmiş yönetim ve onay iş akışları
              <ArrowUpRight className="h-4 w-4 transition-transform group-open:rotate-90" />
            </summary>
            <div className="border-t border-[#2b3b50] p-4"><DigitalManagerOperations /></div>
          </details>
        </div>

        <section
          aria-labelledby="general-manager-title"
          className="sticky top-0 flex h-[calc(100dvh-7.5rem)] min-h-[42rem] flex-col overflow-hidden rounded-xl border border-[#c99a57]/30 bg-[linear-gradient(180deg,#0d1b2b,#091522)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
        >
          <div className="flex items-start justify-between border-b border-[#34445a] px-4 py-4">
            <div>
              <h2 id="general-manager-title" className="font-heading text-[15px] font-medium text-[#f6f1e8]">
                Genel Müdür Yardımcısı
              </h2>
              <p className="mt-1 text-[10px] text-[#8998aa]">
                Business CEO AI Asistanı
              </p>
            </div>
            <span
              className={`rounded border px-2 py-1 text-[9px] font-semibold ${
                provider?.configured
                  ? 'border-[#c99a57]/40 bg-[#c99a57]/10 text-[#e8bb76]'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
              }`}
            >
              {provider?.configured ? 'AI' : 'Yedek'}
            </span>
          </div>

          <div
            ref={chatScrollRef}
            onScroll={(event) => {
              const element = event.currentTarget;
              stickToBottomRef.current =
                element.scrollHeight - element.scrollTop - element.clientHeight < 80;
            }}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Genel Müdür Yardımcısı mesajları"
            className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#08131f]/45 p-4"
          >
            {chatLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <span className="mx-auto flex h-10 w-10 animate-pulse items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                    <Bot className="h-5 w-5" />
                  </span>
                  <p className="mt-3 text-xs text-slate-500">Şirket bağlamı hazırlanıyor…</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <EmptyState
                icon={Crown}
                title="Operasyon sorunu hazır"
                description="Müşteri, portföy, satış, randevu veya kampanyalar hakkında sorun."
              />
            ) : null}
            {messages.map((message, index) => {
              const isPatron = message.role === 'patron';
              return (
                <div
                  key={`${message.id}-${index}`}
                  className={`flex max-w-[90%] gap-2.5 ${isPatron ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${
                      isPatron
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-800 text-slate-300'
                    }`}
                  >
                    {isPatron
                      ? (message.authorName || context?.company.principalName || 'E').slice(0, 1).toUpperCase()
                      : <Crown className="h-4 w-4" />}
                  </span>
                  <div
                    className={`rounded-xl border px-3.5 py-3 text-xs leading-5 ${
                      isPatron
                        ? 'rounded-tr-sm border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
                        : 'rounded-tl-sm border-slate-800 bg-slate-900 text-slate-200'
                    }`}
                  >
                    <div className={`mb-1.5 flex items-center gap-2 text-[10px] font-semibold ${isPatron ? 'justify-end text-emerald-300' : 'text-slate-400'}`}>
                      <span>{isPatron ? message.authorName || 'Ekip üyesi' : 'Genel Müdür Yardımcısı'}</span>
                      {!isPatron && message.provider && (
                        <span className="rounded border border-slate-700 px-1.5 py-0.5 font-normal text-slate-500">
                          {message.provider === 'RULE_ENGINE' ? 'Doğrulanmış yedek' : message.provider}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <time className={`mt-1.5 block text-[10px] ${isPatron ? 'text-right text-emerald-400' : 'text-slate-500'}`}>
                      {new Date(message.createdAt).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </div>
                </div>
              );
            })}
            {isSending && (
              <div className="flex max-w-[90%] gap-2.5" aria-label="Genel Müdür Yardımcısı yanıt hazırlıyor">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300">
                  <Crown className="h-4 w-4" />
                </span>
                <div className="flex items-center gap-1 rounded-xl rounded-tl-sm border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:300ms]" />
                </div>
              </div>
            )}
          </div>

          {suggestions.length > 0 && (
            <div className="shrink-0 border-t border-[#34445a] bg-[#0b1724] px-3 py-3">
              <p className="mb-2 text-[9px] text-[#77869a]">Önerilen komutlar</p>
              <div className="custom-scrollbar flex flex-wrap gap-1.5">
                {suggestions.slice(0, 5).map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => setInputText(suggestion.prompt)}
                    className="rounded-full border border-[#34445a] bg-[#0b1827] px-2.5 py-1.5 text-[9px] font-medium text-[#aeb8c5] transition-colors hover:border-[#c99a57]/45 hover:text-[#e5b972] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c99a57]"
                    aria-label={`${suggestion.label} sorusunu hazırla`}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="border-t border-[#34445a] bg-[#0b1724] p-3">
            <div className="flex items-center gap-2">
              <label htmlFor="manager-command" className="sr-only">
                Genel müdür yardımcısına mesaj
              </label>
              <input
                id="manager-command"
                type="text"
                value={inputText}
                maxLength={2000}
                onChange={(event) => setInputText(event.target.value)}
                placeholder="Bir şey yazın…"
                aria-describedby="manager-command-help"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-emerald-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Mesajı gönder"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p id="manager-command-help" className="mt-2 px-1 text-[10px] leading-4 text-slate-600">
              Yanıtlar şirketinizin doğrulanmış kayıtlarıyla sınırlıdır; değişiklikler ilgili modülde insan onayı gerektirir.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}

function TargetIcon() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#c99a57]/25 bg-[#c99a57]/10 text-[#e9bd79]">
      <Target className="h-3.5 w-3.5" />
    </span>
  );
}
