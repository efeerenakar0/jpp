'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, Crosshair, MessageCircle, Code2, Megaphone, AlertCircle } from 'lucide-react';

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
  APPOINTMENT_REQUEST: 'from-rose-500 to-pink-500',
  NEW_CUSTOMER_MESSAGE: 'from-blue-500 to-cyan-500',
  GREEN_LISTING: 'from-emerald-500 to-green-500',
  WEBSITE_GENERATED: 'from-violet-500 to-purple-500',
  AD_COPY_READY: 'from-amber-500 to-orange-500',
  SYSTEM: 'from-gray-500 to-gray-600',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    fetchNotifications();
    // Her 30 saniyede bir yeni bildirimleri kontrol et
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
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
        className="relative w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all duration-200 group cursor-pointer"
      >
        <Bell className="w-[18px] h-[18px] text-gray-400 group-hover:text-white transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center animate-pulse shadow-lg shadow-red-500/40">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu (Always sits on top with z-[9999]) */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-96 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden z-[9999] backdrop-blur-2xl">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-slate-900/90">
            <h3 className="text-sm font-semibold text-white">Bildirimler</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  disabled={isLoading}
                  className="text-xs text-amber-400 hover:text-amber-300 font-medium transition-colors cursor-pointer"
                >
                  Tümünü Okundu İşaretle
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
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
                      px-5 py-4 border-b border-white/5 hover:bg-white/10 transition-colors cursor-pointer
                      ${!notification.read ? 'bg-white/[0.04]' : ''}
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
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-md`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-semibold ${notification.read ? 'text-gray-400' : 'text-white'}`}>
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 ml-2" />
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
        </div>
      )}
    </div>
  );
}
