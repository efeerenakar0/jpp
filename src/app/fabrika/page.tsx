'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Crown,
  Activity,
  Send,
  Bell,
  Code2,
  Crosshair,
  Megaphone,
  MessageCircle,
  Aperture,
  Sparkles,
  Zap,
  ArrowRight,
  TrendingUp,
  Building2,
  ShieldCheck,
  Cpu,
  Clock,
  Layers
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';

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

const getNotificationStyles = (type: string) => {
  switch (type) {
    case 'GREEN_LISTING': return { icon: Crosshair, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    case 'WEBSITE_GENERATED': return { icon: Code2, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' };
    case 'AD_COPY_READY': return { icon: Megaphone, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' };
    case 'APPOINTMENT_REQUEST': return { icon: MessageCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' };
    case 'STUDIO_READY': return { icon: Aperture, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' };
    default: return { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' };
  }
};

export default function CommandCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchData = async () => {
    try {
      const notifRes = await fetch('/api/fabrika/notifications');
      const notifData = await notifRes.json();
      if (notifData.success) {
        setNotifications(notifData.notifications.slice(0, 10));
      }

      const chatRes = await fetch('/api/fabrika/general-manager/chat');
      const chatData = await chatRes.json();
      if (chatData.success) {
        setMessages(chatData.messages);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText('');
    
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'patron',
      content: userMessage,
      createdAt: new Date().toISOString()
    }]);

    setIsSending(true);

    try {
      const res = await fetch('/api/fabrika/general-manager/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });
      
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev.filter(m => m.id !== tempId), {
          id: tempId,
          role: 'patron',
          content: userMessage,
          createdAt: new Date().toISOString()
        }, data.message]);
        
        fetchData();
      } else {
        toast.error(data.error || 'Mesaj gönderilemedi');
      }
    } catch (error) {
      toast.error('Bağlantı hatası');
    } finally {
      setIsSending(false);
    }
  };

  const modules = [
    {
      title: 'Avcı',
      subtitle: 'AI Sahibinden İlan Toplama & İkna Motoru',
      icon: Crosshair,
      href: '/fabrika/avci',
      color: 'from-amber-500 to-emerald-500',
      badge: '3 Yeni Sarı İlan',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    },
    {
      title: 'Asistan (CRM)',
      subtitle: 'Efe AI WhatsApp Temsilcisi & Müşteri Takibi',
      icon: MessageCircle,
      href: '/fabrika/asistan',
      color: 'from-rose-500 to-pink-600',
      badge: 'Canlı WhatsApp Sync',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
    },
    {
      title: 'Pazarlamacı',
      subtitle: 'AI Reklam Metinleri, Instagram & Google Ads',
      icon: Megaphone,
      href: '/fabrika/pazarlamaci',
      color: 'from-amber-400 to-amber-600',
      badge: '4K Kampanya Seti',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    },
    {
      title: 'Stüdyo',
      subtitle: '4K Gayrimenkul Görsel HDR & Filigran Motoru',
      icon: Aperture,
      href: '/fabrika/studyo',
      color: 'from-purple-500 to-indigo-600',
      badge: 'Sharp HDR Active',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    },
    {
      title: 'Yazılımcı',
      subtitle: 'Emlak Acentesi Web Sitesi Üretim & Export',
      icon: Code2,
      href: '/fabrika/yazilimci',
      color: 'from-cyan-400 to-blue-600',
      badge: 'ZIP Exporter',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    }
  ];

  return (
    <div className="space-y-8 max-w-[1650px] mx-auto pb-12">
      
      {/* TOP BANNER & METRICS */}
      <div className="relative rounded-3xl overflow-hidden glass-card p-8 border border-slate-800 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> UI/UX Pro Max 2.0 Zekası Devrede
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> Otonom Emlak Fabrikası
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight font-heading">
              Jasmine Group Komuta Merkezi
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl font-sans">
              Tüm yapay zeka operasyonlarını, WhatsApp görüşmelerini, ilan avlama süreçlerini ve görsel stüdyoyu tek ekrandan yönetin.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-emerald-400">12</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Aktif Portföy</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-amber-400">%98.4</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">AI Doğruluk</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-cyan-400">48</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">WhatsApp Yanıtı</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-purple-400">4K</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">HDR Stüdyo</div>
            </div>
          </div>
        </div>
      </div>

      {/* MODULE LAUNCHER CARDS GRID */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white tracking-tight font-heading flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" /> Operasyonel YZ Modülleri
          </h2>
          <span className="text-xs text-slate-400">5 Aktif Modül Hazır</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link 
                key={mod.title}
                href={mod.href}
                className="group relative rounded-2xl bg-slate-900/80 border border-slate-800/90 p-5 hover:border-slate-700 transition-all duration-300 shadow-lg hover:shadow-2xl flex flex-col justify-between overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${mod.color} opacity-5 group-hover:opacity-15 blur-2xl transition-opacity pointer-events-none`} />
                
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${mod.color} flex items-center justify-center shadow-md text-slate-950`}>
                      <Icon className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${mod.badgeColor}`}>
                      {mod.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors font-heading mb-1">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans line-clamp-2">
                    {mod.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-300 group-hover:text-emerald-400 transition-colors">
                  <span>Modülü Aç</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* TWO COLUMN LIVE FEED & GENERAL MANAGER AI CHAT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT 6 COLS: LIVE OPERATIONAL FEED */}
        <div className="lg:col-span-6 glass-card rounded-3xl border border-slate-800 overflow-hidden flex flex-col h-[600px] shadow-2xl">
          <div className="p-5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl text-slate-950 shadow-md">
                <Activity className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-heading">Canlı Operasyon Akışı</h3>
                <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Gerçek Zamanlı AI Logları
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-500 font-mono">{notifications.length} Bildirim</span>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="text-center py-20 text-slate-500">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-xs font-medium">Henüz bir operasyon kaydı yok.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const { icon: Icon, color, bg } = getNotificationStyles(notif.type);
                return (
                  <div key={notif.id} className="flex gap-3.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all shadow-sm">
                    <div className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border ${bg}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="text-xs font-bold text-white">{notif.title}</h4>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: tr })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-sans">{notif.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT 6 COLS: GENERAL MANAGER AI ASSISTANT CHAT */}
        <div className="lg:col-span-6 glass-card rounded-3xl border border-slate-800 overflow-hidden flex flex-col h-[600px] shadow-2xl">
          <div className="p-5 border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-md">
                <Crown className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-heading">Genel Müdür Yardımcısı (Efe)</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-emerald-400 font-semibold">Komuta Merkezi Canlı</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <Crown className="w-8 h-8 text-amber-400 mx-auto mb-2 opacity-80" />
                <h4 className="text-sm font-bold text-white mb-1">Selam Patron!</h4>
                <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
                  Bana buradan tüm fabrika operasyonu hakkında talimat verebilirsiniz.
                </p>
              </div>
            )}

            {messages.map((msg, index) => {
              const isPatron = msg.role === 'patron';
              return (
                <div key={`${msg.id}-${index}`} className={`flex gap-3 max-w-[88%] ${isPatron ? 'ml-auto flex-row-reverse' : ''}`}>
                  <div className={`
                    flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-sm
                    ${isPatron ? 'bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-950' : 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950'}
                  `}>
                    {isPatron ? 'P' : <Crown className="w-4 h-4" />}
                  </div>
                  
                  <div className={`
                    p-3.5 rounded-2xl shadow-sm text-xs leading-relaxed font-sans
                    ${isPatron 
                      ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 rounded-tr-sm' 
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm'
                    }
                  `}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <span className={`text-[10px] mt-1.5 block font-mono ${isPatron ? 'text-cyan-400 text-right' : 'text-slate-500'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3.5 bg-slate-950 border-t border-slate-800/80 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Patron emrini yazın... (Örn: Sahnede durumlar nasıl?)"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
