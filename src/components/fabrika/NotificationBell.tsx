'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Code2,
  Crosshair,
  Inbox,
  Megaphone,
  MessageCircle,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  important: boolean;
  read: boolean;
  createdAt: string;
}

type NotificationScope = 'important' | 'all';

const typeIcons: Record<string, typeof Bell> = {
  APPOINTMENT_REQUEST: MessageCircle,
  NEW_CUSTOMER_MESSAGE: MessageCircle,
  GREEN_LISTING: Crosshair,
  WEBSITE_GENERATED: Code2,
  AD_COPY_READY: Megaphone,
  SYSTEM: AlertCircle,
};

const typeColors: Record<string, string> = {
  APPOINTMENT_REQUEST:
    'border-amber-500/25 bg-amber-500/10 text-amber-300',
  NEW_CUSTOMER_MESSAGE:
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  GREEN_LISTING:
    'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  WEBSITE_GENERATED: 'border-slate-600 bg-slate-800 text-slate-300',
  AD_COPY_READY:
    'border-slate-600 bg-slate-800 text-slate-300',
  SYSTEM: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

function formatTime(dateValue: string) {
  const date = new Date(dateValue);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (diffMinutes < 1) return 'Az önce';
  if (diffMinutes < 60) return `${diffMinutes} dk önce`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa önce`;
  return `${Math.floor(diffHours / 24)} gün önce`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [scope, setScope] = useState<NotificationScope>('important');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const importantNotifications = useMemo(
    () => notifications.filter((notification) => notification.important),
    [notifications]
  );
  const visibleNotifications =
    scope === 'important' ? importantNotifications : notifications;
  const importantUnread = importantNotifications.filter(
    (notification) => !notification.read
  ).length;
  const totalUnread = notifications.filter(
    (notification) => !notification.read
  ).length;
  const visibleUnread = visibleNotifications.filter(
    (notification) => !notification.read
  ).length;

  async function fetchNotifications() {
    try {
      const response = await fetch('/api/fabrika/notifications', {
        cache: 'no-store',
      });
      const data = (await response.json()) as {
        notifications?: Notification[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'Bildirimler yüklenemedi.');
      }
      setNotifications(data.notifications || []);
      setLoadError('');
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Bildirimler yüklenemedi.'
      );
    }
  }

  useEffect(() => {
    const initialTimeout = window.setTimeout(fetchNotifications, 0);
    const interval = window.setInterval(fetchNotifications, 30000);
    return () => {
      window.clearTimeout(initialTimeout);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function closePanel(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (
        event instanceof MouseEvent &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', closePanel);
    document.addEventListener('keydown', closePanel);
    return () => {
      document.removeEventListener('mousedown', closePanel);
      document.removeEventListener('keydown', closePanel);
    };
  }, []);

  async function markAsRead(notification: Notification) {
    if (!notification.read) {
      setIsLoading(true);
      try {
        const response = await fetch('/api/fabrika/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: notification.id, read: true }),
        });
        if (response.ok) {
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id ? { ...item, read: true } : item
            )
          );
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (notification.link) {
      setIsOpen(false);
      window.location.assign(notification.link);
    }
  }

  async function markVisibleAsRead() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/fabrika/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true, scope }),
      });
      if (response.ok) {
        const visibleIds = new Set(
          visibleNotifications.map((notification) => notification.id)
        );
        setNotifications((current) =>
          current.map((notification) =>
            visibleIds.has(notification.id)
              ? { ...notification, read: true }
              : notification
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  const badgeCount = importantUnread || totalUnread;

  return (
    <div className="relative z-[9999]" ref={dropdownRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`Bildirimler${
          importantUnread
            ? `, ${importantUnread} önemli okunmamış`
            : totalUnread
              ? `, ${totalUnread} okunmamış`
              : ''
        }`}
        className="group relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 transition-colors hover:border-slate-700 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Bell
          aria-hidden="true"
          className="h-[18px] w-[18px] text-slate-400 transition-colors group-hover:text-white"
        />
        {badgeCount > 0 ? (
          <span
            className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              importantUnread ? 'bg-rose-500' : 'bg-slate-600'
            }`}
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <section
          aria-label="Bildirim paneli"
          className="absolute right-0 top-12 z-[9999] w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40"
          role="dialog"
        >
          <div className="flex items-start justify-between border-b border-slate-800 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-white">Bildirimler</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Karar gerektiren olaylar önce gösterilir
              </p>
            </div>
            <button
              aria-label="Bildirim panelini kapat"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-slate-800 px-4 py-3">
            <Tabs
              onValueChange={(value) => setScope(value as NotificationScope)}
              value={scope}
            >
              <TabsList
                aria-label="Bildirim kapsamı"
                className="grid h-10 w-full grid-cols-2 bg-slate-950"
              >
                <TabsTrigger
                  className="gap-2 data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-200"
                  value="important"
                >
                  <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />
                  Önemli
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">
                    {importantNotifications.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  className="gap-2 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-200"
                  value="all"
                >
                  <Inbox aria-hidden="true" className="h-3.5 w-3.5" />
                  Tümü
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px]">
                    {notifications.length}
                  </span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {visibleUnread > 0 ? (
              <button
                className="mt-2 text-[11px] font-medium text-emerald-400 transition-colors hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
                disabled={isLoading}
                onClick={markVisibleAsRead}
                type="button"
              >
                Bu sekmedekileri okundu işaretle
              </button>
            ) : null}
          </div>

          <div aria-live="polite" className="custom-scrollbar max-h-96 overflow-y-auto">
            {loadError ? (
              <div className="m-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">
                {loadError}
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                {scope === 'important' ? (
                  <ShieldAlert
                    aria-hidden="true"
                    className="mx-auto mb-3 h-8 w-8 text-emerald-500"
                  />
                ) : (
                  <Bell
                    aria-hidden="true"
                    className="mx-auto mb-3 h-8 w-8 text-slate-700"
                  />
                )}
                <p className="text-sm font-medium text-slate-300">
                  {scope === 'important'
                    ? 'Müdahale gerektiren olay yok'
                    : 'Henüz bildirim yok'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {scope === 'important'
                    ? 'Rutin güncellemeleri Tümü sekmesinde görebilirsiniz.'
                    : 'Yeni operasyon olayları burada görünecek.'}
                </p>
              </div>
            ) : (
              visibleNotifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                const color =
                  typeColors[notification.type] ||
                  'border-slate-600 bg-slate-800 text-slate-300';

                return (
                  <button
                    className={`block w-full border-b border-slate-800 px-4 py-3.5 text-left transition-colors hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${
                      notification.read ? '' : 'bg-emerald-500/[0.03]'
                    }`}
                    key={notification.id}
                    onClick={() => markAsRead(notification)}
                    type="button"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${color}`}
                      >
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span
                            className={`text-sm font-semibold ${
                              notification.read
                                ? 'text-slate-400'
                                : 'text-white'
                            }`}
                          >
                            {notification.title}
                          </span>
                          {!notification.read ? (
                            <span
                              aria-label="Okunmadı"
                              className="h-2 w-2 shrink-0 rounded-full bg-emerald-400"
                            />
                          ) : null}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-400">
                          {notification.message}
                        </span>
                        <span className="mt-1.5 block text-[10px] text-slate-500">
                          {formatTime(notification.createdAt)}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
