'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Aperture,
  ArrowRight,
  Bell,
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
  createdAt: string;
};

type OperationalContext = {
  activeProjects: number;
  huntedListings: number;
  pendingAppointments: number;
  activeConversations: number;
  unreadNotifications: number;
};

type WorkspaceMetrics = {
  contacts: number;
  activeProperties: number;
  openDeals: number;
  overdueTasks: number;
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

export default function CommandCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [workspaceMetrics, setWorkspaceMetrics] = useState<WorkspaceMetrics | null>(null);
  const [context, setContext] = useState<OperationalContext>({
    activeProjects: 0,
    huntedListings: 0,
    pendingAppointments: 0,
    activeConversations: 0,
    unreadNotifications: 0,
  });
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
      }

      if (includeWorkspace) {
        const workspaceRes = await fetch('/api/fabrika/workspace');
        const workspaceData = await workspaceRes.json();
        if (workspaceRes.ok && workspaceData.success) {
          setWorkspaceMetrics(workspaceData.workspace.metrics);
        }
      }
    } catch (err) {
      console.error('Data fetch error:', err);
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
    // Keep new messages visible without moving the whole command-center page.
    // scrollIntoView() selected <main> as its scrollable ancestor, which could
    // leave the user on an apparently empty section of the page.
    const animationFrame = requestAnimationFrame(() => {
      const chat = chatScrollRef.current;
      if (chat) {
        chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
      }
    });

    return () => cancelAnimationFrame(animationFrame);
  }, [messages]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText('');

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
      badge: `${context.huntedListings} kayıt`,
    },
    {
      title: 'Asistan',
      subtitle: 'WhatsApp temsilcisi ve müşteri takibi',
      icon: MessageCircle,
      href: '/fabrika/asistan',
      badge: `${context.activeConversations} sohbet`,
    },
    {
      title: 'Pazarlamacı',
      subtitle: 'Reklam metni ve kampanya üretimi',
      icon: Megaphone,
      href: '/fabrika/pazarlamaci',
      badge: 'AI taslak',
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
      badge: `${workspaceMetrics?.overdueTasks || 0} geciken`,
    },
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Operasyon görünümü"
        title="Jasmine Group Komuta Merkezi"
        description="Portföy, müşteri iletişimi, pazarlama ve üretim operasyonlarını tek bir çalışma alanından yönetin."
        icon={Crown}
        actions={
          <>
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
              Pilot sürüm
            </span>
            <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300">
              İnsan onaylı
            </span>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="CRM müşterisi" value={workspaceMetrics?.contacts || 0} icon={Users} status="success" />
        <StatCard label="Aktif portföy" value={workspaceMetrics?.activeProperties || 0} icon={Activity} />
        <StatCard label="Açık satış fırsatı" value={workspaceMetrics?.openDeals || 0} icon={Kanban} status="success" />
        <StatCard label="Geciken görev" value={workspaceMetrics?.overdueTasks || 0} icon={Clock} status="warning" />
      </div>

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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

        <section className="flex min-h-[36rem] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <Crown className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-white">Genel Müdür Yardımcısı</h2>
                <p className="mt-0.5 text-xs text-emerald-400">Asistan ile aynı AI · tüm Fabrika bağlamı</p>
              </div>
            </div>
          </div>

          <div ref={chatScrollRef} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-slate-950/30 p-4 sm:p-5">
            {messages.length === 0 && (
              <EmptyState
                icon={Crown}
                title="Komuta bekleniyor"
                description="Fabrika operasyonları hakkında talimatınızı buradan iletebilirsiniz."
              />
            )}
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
                    {isPatron ? 'P' : <Crown className="h-4 w-4" />}
                  </span>
                  <div
                    className={`rounded-xl border px-3.5 py-3 text-xs leading-5 ${
                      isPatron
                        ? 'rounded-tr-sm border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
                        : 'rounded-tl-sm border-slate-800 bg-slate-900 text-slate-200'
                    }`}
                  >
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
          </div>

          <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t border-slate-800 bg-slate-950 p-3">
            <label htmlFor="manager-command" className="sr-only">Genel müdür yardımcısına mesaj</label>
            <input
              id="manager-command"
              type="text"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder="Operasyon talimatınızı yazın..."
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-emerald-950 transition-colors hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Mesajı gönder"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
