'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Crosshair, MessageCircle, Code2, Megaphone, AlertCircle } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

const typeIcons: Record<string, typeof Bell> = {
  APPOINTMENT_REQUEST: MessageCircle,
  NEW_CUSTOMER_MESSAGE: MessageCircle,
  GREEN_LISTING: Crosshair,
  WEBSITE_GENERATED: Code2,
  AD_COPY_READY: Megaphone,
  SYSTEM: AlertCircle,
};

const typeColors: Record<string, string> = {
  APPOINTMENT_REQUEST: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  NEW_CUSTOMER_MESSAGE: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  GREEN_LISTING: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  WEBSITE_GENERATED: 'border-slate-600 bg-slate-800 text-slate-300',
  AD_COPY_READY: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  SYSTEM: 'border-slate-600 bg-slate-800 text-slate-300',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/fabrika/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch {
      // Sessizce devam et
    }
  }

  useEffect(() => {
    const initialTimeout = window.setTimeout(fetchNotifications, 0);
    // Her 30 saniyede bir yeni bildirimleri kontrol et
    const interval = setInterval(fetchNotifications, 30000);
    return () => {
      window.clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markAsRead(id: string) {
    setIsLoading(true);
    try {
      await fetch('/api/fabrika/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, read: true }),
      });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {
      // Sessizce devam et
    }
    setIsLoading(false);
  }

  async function markAllAsRead() {
    setIsLoading(true);
    try {
      await fetch('/api/fabrika/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      // Sessizce devam et
    }
    setIsLoading(false);
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins}dk önce`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}sa önce`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}g önce`;
  }

  return (
    <div className="relative z-[9999]" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 transition-colors hover:border-slate-700 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        type="button"
        aria-label={`Bildirimler${unreadCount ? `, ${unreadCount} okunmamış` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="h-[18px] w-[18px] text-slate-400 transition-colors group-hover:text-white" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu (Always sits on top with z-[9999]) */}
      {isOpen && (
        <section className="absolute right-0 top-12 z-[9999] w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/40" aria-label="Bildirim paneli">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3.5">
            <h3 className="text-sm font-semibold text-white">Bildirimler</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={isLoading}
                  className="text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300 disabled:opacity-50"
                >
                  Tümünü Okundu İşaretle
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                type="button"
                aria-label="Bildirim panelini kapat"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="custom-scrollbar max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Bell className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Henüz bildirim yok</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = typeIcons[notification.type] || Bell;
                const color = typeColors[notification.type] || 'from-gray-500 to-gray-600';
                
                return (
                  <div
                    key={notification.id}
                    className={`
                      border-b border-slate-800 px-4 py-3.5 transition-colors hover:bg-slate-800/70
                      ${!notification.read ? 'bg-emerald-500/[0.03]' : ''}
                    `}
                    onClick={() => {
                      if (!notification.read) markAsRead(notification.id);
                      if (notification.link) {
                        window.location.href = notification.link;
                        setIsOpen(false);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-semibold ${notification.read ? 'text-gray-400' : 'text-white'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="ml-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">{notification.message}</p>
                        <p className="text-[10px] text-gray-500 mt-1.5">{formatTime(notification.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
