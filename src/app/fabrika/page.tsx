'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Aperture,
  Bell,
  Bot,
  Clock,
  Code2,
  Crosshair,
  Crown,
  Megaphone,
  MessageCircle,
  Send,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import EmptyState from '@/components/fabrika/EmptyState';
import NotificationPanel from '@/components/fabrika/NotificationPanel';
import PageHeader from '@/components/fabrika/PageHeader';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
  link?: string | null;
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

const notificationSource = (type: string) => {
  if (type === 'APPOINTMENT_REQUEST') return 'Takvim';
  if (type === 'NEW_CUSTOMER_MESSAGE') return 'Asistan';
  if (type === 'GREEN_LISTING') return 'Portföyler';
  if (type === 'WEBSITE_GENERATED') return 'Yazılımcı';
  if (type === 'AD_COPY_READY') return 'Pazarlamacı';
  if (type === 'STUDIO_READY') return 'Stüdyo';
  return 'Sistem';
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
  const [whatsAppConnected, setWhatsAppConnected] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);

  async function fetchData() {
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
      const whatsAppRes = await fetch('/api/fabrika/whatsapp/connection', {
        cache: 'no-store',
      });
      if (whatsAppRes.ok) {
        const whatsAppData = (await whatsAppRes.json()) as {
          connectionStatus?: string;
          platformEnabled?: boolean;
        };
        setWhatsAppConnected(
          whatsAppData.platformEnabled !== false &&
            ['CONNECTED', 'WORKING'].includes(whatsAppData.connectionStatus || '')
        );
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

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Günlük çalışma alanı"
        title={`${context?.company.name || 'Jasmine Group'} Komuta Merkezi`}
        description="Önce müdahale gerektiren işleri görün; ardından şirket verileriniz hakkında Dijital Genel Müdür'e sorun."
        icon={Crown}
      />

      <NotificationPanel
        title="Kritik operasyon akışı"
        description="Yalnızca karar veya müdahale gerektiren olaylar"
        count={notifications.length}
      >
        <div className="custom-scrollbar max-h-[26rem] space-y-2 overflow-y-auto">
            {notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="Kritik olay yok"
                description="Şu anda müdahale gerektiren bir operasyon bulunmuyor."
              />
            ) : (
              notifications.map((notification) => {
                const { icon: Icon, color, bg } = getNotificationStyles(notification.type);
                const source = notificationSource(notification.type);
                const article = (
                  <article
                    key={notification.id}
                    className="flex gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 transition-colors hover:border-slate-700"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{notification.title}</h3>
                          <span className="rounded-md border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
                            {source}
                          </span>
                        </div>
                        <time className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: tr })}
                        </time>
                      </div>
                      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <p className="text-sm leading-6 text-slate-400">{notification.message}</p>
                        {notification.link && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-emerald-300">
                            Kaydı aç <ArrowRight className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
                return notification.link ? (
                  <Link href={notification.link} key={notification.id}>
                    {article}
                  </Link>
                ) : article;
              })
            )}
        </div>
      </NotificationPanel>

      {context?.company.principalType === 'OWNER' ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5" aria-labelledby="setup-checklist-title">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 id="setup-checklist-title" className="text-base font-semibold text-white">Başlangıç kontrol listesi</h2><p className="mt-1 text-sm text-slate-400">Temel bağlantıları tamamladığınızda sistem tüm modüller arasında canlı çalışır.</p></div>
            <span className="text-sm font-semibold text-emerald-300">{[
              context.metrics.activeCrmProperties > 0,
              context.metrics.crmContacts > 0,
              context.calendar.google.connected,
              whatsAppConnected,
            ].filter(Boolean).length}/4 tamamlandı</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { done: context.metrics.activeCrmProperties > 0, label: 'İlk portföyü yayınla', href: '/fabrika/portfoyler' },
              { done: context.metrics.crmContacts > 0, label: 'Müşteri kaydı oluştur', href: '/fabrika/crm' },
              { done: context.calendar.google.connected, label: 'Google Takvim’i bağla', href: '/fabrika/takvim' },
              { done: whatsAppConnected, label: 'WhatsApp’ı bağla', href: '/fabrika/whatsapp' },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="flex min-h-12 items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 text-sm text-slate-200 transition hover:border-emerald-500/30">
                {item.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="h-4 w-4 shrink-0 text-slate-600" />}
                <span className={item.done ? 'text-slate-400 line-through' : ''}>{item.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

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
                  Dijital Genel Müdür
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
            aria-label="Dijital Genel Müdür mesajları"
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
                      <span>{isPatron ? message.authorName || 'Ekip üyesi' : 'Dijital Genel Müdür'}</span>
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
              <div className="flex max-w-[90%] gap-2.5" aria-label="Dijital Genel Müdür yanıt hazırlıyor">
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
  );
}
