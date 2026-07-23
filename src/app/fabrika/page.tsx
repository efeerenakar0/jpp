'use client';

import { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Cpu
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import toast from 'react-hot-toast';

// Types
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

// Helpers for icons and colors based on notification type
const getNotificationStyles = (type: string) => {
  switch (type) {
    case 'GREEN_LISTING': return { icon: Crosshair, color: 'text-amber-400', bg: 'bg-amber-400/10' };
    case 'WEBSITE_GENERATED': return { icon: Code2, color: 'text-cyan-400', bg: 'bg-cyan-400/10' };
    case 'AD_COPY_READY': return { icon: Megaphone, color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
    case 'APPOINTMENT_REQUEST': return { icon: MessageCircle, color: 'text-rose-400', bg: 'bg-rose-400/10' };
    case 'STUDIO_READY': return { icon: Aperture, color: 'text-purple-400', bg: 'bg-purple-400/10' };
    default: return { icon: Bell, color: 'text-slate-400', bg: 'bg-slate-400/10' };
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
    // Simulate real-time polling every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchData = async () => {
    try {
      // 1. Fetch Notifications (Limit to 10 for the feed)
      const notifRes = await fetch('/api/fabrika/notifications');
      const notifData = await notifRes.json();
      if (notifData.success) {
        setNotifications(notifData.notifications.slice(0, 10));
      }

      // 2. Fetch Chat History
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

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* LEFT COLUMN: LIVE FEED - STITCH GLASS DESIGN */}
      <div className="flex-1 flex flex-col bg-[#090d16]/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative backdrop-blur-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
        
        {/* Feed Header */}
        <div className="p-6 border-b border-slate-800/80 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl shadow-lg shadow-amber-500/20">
              <Activity className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Canlı Operasyon Akışı</h2>
              <p className="text-xs text-amber-400 font-extrabold tracking-wider uppercase mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Gerçek Zamanlı AI Olayları
              </p>
            </div>
          </div>
        </div>

        {/* Feed List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-xs font-semibold">Henüz bir operasyon kaydı yok.</p>
            </div>
          ) : (
            notifications.map((notif) => {
              const { icon: Icon, color, bg } = getNotificationStyles(notif.type);
              return (
                <div key={notif.id} className="group flex gap-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all shadow-sm">
                  <div className={`mt-1 flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${bg} shadow-md`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-black text-white">{notif.title}</h3>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: tr })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">{notif.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>


      {/* RIGHT COLUMN: GM ASSISTANT CHAT */}
      <div className="flex-[1.2] flex flex-col bg-[#090d16]/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-2xl">
        {/* Chat Header */}
        <div className="p-6 border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-xl shadow-amber-500/20 border border-amber-300/30">
              <Crown className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight">Genel Müdür Yardımcınız (AI Patron)</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-emerald-400 font-bold">🟢 Otonom Mod Aktif — Sizi Dinliyor</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {messages.length === 0 && (
            <div className="text-center py-20 animate-in fade-in zoom-in-95 duration-700">
              <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                <Crown className="w-10 h-10 text-amber-400" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Selam Patron!</h3>
              <p className="text-slate-400 text-xs max-w-sm mx-auto font-medium leading-relaxed">
                Ben sizin Genel Müdür Yardımcınızım. Sol taraftan operasyonu izleyebilir, bana buradan doğrudan komut verebilirsiniz.
              </p>
            </div>
          )}

          {messages.map((msg, index) => {
            const isPatron = msg.role === 'patron';
            return (
              <div key={`${msg.id}-${index}`} className={`flex gap-4 max-w-[85%] ${isPatron ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className={`
                  flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-black shadow-md
                  ${isPatron ? 'bg-gradient-to-br from-cyan-400 to-teal-500 text-slate-950' : 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950'}
                `}>
                  {isPatron ? 'P' : <Crown className="w-4 h-4" />}
                </div>
                
                <div className={`
                  p-4 rounded-2xl shadow-md relative text-xs leading-relaxed font-medium
                  ${isPatron 
                    ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 rounded-tr-sm' 
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm'
                  }
                `}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <span className={`text-[10px] mt-2 block font-mono ${isPatron ? 'text-cyan-400 text-right' : 'text-slate-500'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
          
          {isSending && (
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Crown className="w-4 h-4 text-slate-950" />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-slate-950 border-t border-slate-800/80">
          <form onSubmit={handleSendMessage} className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Asistana emir ver (Örn: Bugün sahada durumlar nasıl?)"
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3.5 pl-4 pr-14 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="absolute right-2 p-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 disabled:opacity-50 text-slate-950 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-2 text-center">
             <p className="text-[10px] text-slate-500 font-semibold">Asistan; yazdığınız komutları algılar ve ilgili modülleri otonom çalıştırır.</p>
          </div>
        </div>
      </div>

    </div>
  );
}
