'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Aperture,
  ArrowRight,
  Bell,
  Bot,
  ChevronRight,
  Clock,
  Code2,
  Crosshair,
  Crown,
  Megaphone,
  MessageCircle,
  Send,
  AlertTriangle,
  Users,
  Home,
  Kanban,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import EmptyState from '@/components/fabrika/EmptyState';
import NotificationPanel from '@/components/fabrika/NotificationPanel';
import PageHeader from '@/components/fabrika/PageHeader';
import StatCard from '@/components/fabrika/StatCard';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
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

type WorkspaceMetrics = {
  contacts: number;
  activeProperties: number;
  openDeals: number;
  overdueTasks: number;
  upcomingCriticalTasks: number;
  pipelineValue: number;
  wonCommission: number;
  averageMatchScore: number;
};

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

const priorityStyles = {
  critical: 'border-rose-500/25 bg-rose-500/5 text-rose-300',
  warning: 'border-amber-500/25 bg-amber-500/5 text-amber-300',
  info: 'border-slate-700 bg-slate-900 text-slate-300',
};

export default function CommandCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [workspaceMetrics, setWorkspaceMetrics] = useState<WorkspaceMetrics | null>(null);
  const [context, setContext] = useState<OperationalContext | null>(null);
  const [suggestions, setSuggestions] = useState<ManagerSuggestion[]>([]);
  const [provider, setProvider] = useState<ManagerProvider | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);

  async function fetchData(includeWorkspace = false) {
    try {
      const notifRes = await fetch('/api/fabrika/notifications?scope=important');
      const notifData = await notifRes.json();
      if (notifRes.ok && Array.isArray(notifData.notifications)) {
        setNotifications(notifData.notifications.slice(0, 8));
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

      if (includeWorkspace) {
        const workspaceRes = await fetch('/api/fabrika/workspace');
        const workspaceData = await workspaceRes.json();
        if (workspaceRes.ok && workspaceData.success) {
          setWorkspaceMetrics(workspaceData.workspace.metrics);
        }
      }
    } catch (err) {
      console.error('Data fetch error:', err);
      setChatLoading(false);
    }
  }

  useEffect(() => {
    const initialTimeout = setTimeout(() => fetchData(true), 0);
    const interval = setInterval(fetchData, 5000);
    const workspaceInterval = setInterval(() => fetchData(true), 15000);
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      clearInterval(workspaceInterval);
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
      const response = await fetch('/api/fabrika/general-manager/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
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
      } else {
        toast.error(data.error || 'Mesaj gönderilemedi');
      }
    } catch {
      toast.error('Bağlantı hatası');
    } finally {
      setIsSending(false);
    }
  };

  const modules = [
    {
      title: 'Avcı',
      subtitle: 'Sahibinden ilan toplama ve ikna operasyonu',
      icon: Crosshair,
      href: '/fabrika/avci',
      badge: `${context?.metrics.huntedListings ?? 0} kayıt`,
    },
    {
      title: 'Asistan',
      subtitle: 'WhatsApp temsilcisi ve müşteri takibi',
      icon: MessageCircle,
      href: '/fabrika/asistan',
      badge: `${context?.metrics.activeConversations ?? 0} sohbet`,
    },
    {
      title: 'Pazarlamacı',
      subtitle: 'Reklam metni ve kampanya üretimi',
      icon: Megaphone,
      href: '/fabrika/pazarlamaci',
      badge: `${context?.metrics.campaigns ?? 0} kampanya`,
    },
    {
      title: 'Stüdyo',
      subtitle: 'Portföy görseli iyileştirme ve indirme',
      icon: Aperture,
      href: '/fabrika/studyo',
      badge: 'Görsel AI',
    },
    {
      title: 'Yazılımcı',
      subtitle: 'Web sitesi üretimi ve teknik destek',
      icon: Code2,
      href: '/fabrika/yazilimci',
      badge: 'ZIP export',
    },
  ];

  const operatingCore = [
    {
      title: 'Merkezi CRM',
      subtitle: 'Müşteri profilleri, satış süreci ve şirket hafızası',
      icon: Users,
      href: '/fabrika/crm',
      badge: `${workspaceMetrics?.contacts || 0} müşteri · ${workspaceMetrics?.openDeals || 0} fırsat`,
    },
    {
      title: 'Portföyler',
      subtitle: 'Portföy, performans ve paylaşılabilir malik raporları',
      icon: Home,
      href: '/fabrika/portfoyler',
      badge: `${workspaceMetrics?.activeProperties || 0} aktif`,
    },
    {
      title: 'Eşleştirme',
      subtitle: 'Müşteri tercihlerini portföylerle eşleştir',
      icon: Sparkles,
      href: '/fabrika/eslestirme',
      badge: `%${workspaceMetrics?.averageMatchScore || 0} ortalama`,
    },
    {
      title: 'Takvim',
      subtitle: 'Randevu, gösterim ve takip görevleri',
      icon: CalendarDays,
      href: '/fabrika/takvim',
      badge: `${workspaceMetrics?.upcomingCriticalTasks || 0} yaklaşan · ${workspaceMetrics?.overdueTasks || 0} geciken`,
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Operasyon görünümü"
        title={`${context?.company.name || 'Jasmine Group'} Komuta Merkezi`}
        description="Portföy, müşteri iletişimi, pazarlama ve üretim operasyonlarını tek bir çalışma alanından yönetin."
        icon={Crown}
        actions={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
              <Bot className="h-3.5 w-3.5" />
              {provider?.configured
                ? `${provider.provider} · ${provider.model}`
                : 'Doğrulanmış kural motoru'}
            </span>
            <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300">
              İnsan onaylı
            </span>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="CRM müşterisi" value={workspaceMetrics?.contacts || 0} icon={Users} status="success" />
        <StatCard label="Aktif portföy" value={workspaceMetrics?.activeProperties || 0} icon={Activity} />
        <StatCard label="Açık satış fırsatı" value={workspaceMetrics?.openDeals || 0} icon={Kanban} status="success" />
        <StatCard label="Geciken görev" value={workspaceMetrics?.overdueTasks || 0} icon={Clock} status="warning" />
        <StatCard label="Yaklaşan randevu" value={workspaceMetrics?.upcomingCriticalTasks || 0} icon={CalendarDays} status="success" />
      </div>

      <section aria-labelledby="manager-priorities-title">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="manager-priorities-title" className="text-base font-semibold text-white">
              Yönetici öncelikleri
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              CRM, Takvim, Avcı ve satış verilerinden anlık olarak derlenir.
            </p>
          </div>
          {context?.generatedAt && (
            <time className="text-[11px] text-slate-500" dateTime={context.generatedAt}>
              Son kontrol{' '}
              {new Date(context.generatedAt).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          )}
        </div>
        {context?.priorities.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {context.priorities.slice(0, 4).map((priority) => (
              <Link
                key={priority.id}
                href={priority.href}
                className={`group flex min-h-28 flex-col justify-between rounded-xl border p-4 transition-colors hover:border-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${priorityStyles[priority.severity]}`}
              >
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-75">
                    {priority.severity === 'critical'
                      ? 'Kritik'
                      : priority.severity === 'warning'
                        ? 'Takip'
                        : 'Yaklaşan'}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-white">{priority.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{priority.detail}</p>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 group-hover:text-emerald-300">
                  İlgili kaydı aç <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
            Şu anda geciken, yüksek öncelikli veya yakın tarihli kritik bir operasyon görünmüyor.
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Emlak işletim sistemi</h2>
            <p className="mt-0.5 text-xs text-slate-500">Müşteriden satış kapanışına kadar merkezi çalışma alanı</p>
          </div>
          <span className="text-xs text-slate-500">4 çalışma alanı</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {operatingCore.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="group flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-emerald-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                href={item.href}
                key={item.title}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <span className="shrink-0 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                      {item.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{item.subtitle}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Operasyon modülleri</h2>
            <p className="mt-0.5 text-xs text-slate-500">Günlük iş akışınız için aktif çalışma alanları</p>
          </div>
          <span className="text-xs text-slate-500">5 modül</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.title}
                href={module.href}
                className="group flex min-h-44 flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-emerald-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300">
                      {module.badge}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">{module.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{module.subtitle}</p>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs font-medium text-slate-400 transition-colors group-hover:text-emerald-300">
                  <span>Modülü aç</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <NotificationPanel
          title="Kritik operasyon akışı"
          description="Müdahale veya karar gerektiren olaylar"
          count={notifications.length}
        >
          <div className="custom-scrollbar max-h-[32rem] space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Kritik olay yok"
                description="Şu anda müdahale gerektiren bir operasyon bulunmuyor."
              />
            ) : (
              notifications.map((notification) => {
                const { icon: Icon, color, bg } = getNotificationStyles(notification.type);
                return (
                  <article
                    key={notification.id}
                    className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 transition-colors hover:border-slate-700"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-xs font-semibold text-white">{notification.title}</h3>
                        <time className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: tr })}
                        </time>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{notification.message}</p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </NotificationPanel>

        <section
          aria-labelledby="general-manager-title"
          className="flex h-[42rem] max-h-[calc(100vh-6rem)] min-h-[34rem] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <Crown className="h-4 w-4" />
              </span>
              <div>
                <h2 id="general-manager-title" className="text-sm font-semibold text-white">
                  Genel Müdür Yardımcısı
                </h2>
                <p className="mt-0.5 text-xs text-emerald-400">
                  Asistan ile aynı {provider?.provider || 'AI'} · şirket kapsamlı veri
                </p>
              </div>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                provider?.configured
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
              }`}
            >
              {provider?.configured ? 'Canlı AI' : 'Güvenli yedek'}
            </span>
          </div>

          {suggestions.length > 0 && (
            <div className="custom-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-slate-800 bg-slate-950/60 px-4 py-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() => setInputText(suggestion.prompt)}
                  className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-medium text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label={`${suggestion.label} sorusunu hazırla`}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}

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
            className="custom-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-950/30 p-4 sm:p-5"
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

          <form onSubmit={handleSendMessage} className="border-t border-slate-800 bg-slate-950 p-3">
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
                placeholder="Örn. Bu hafta hangi müşterileri takip etmeliyim?"
                aria-describedby="manager-command-help"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-emerald-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
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
