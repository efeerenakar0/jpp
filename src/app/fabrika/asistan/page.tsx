'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bot, Plus, MessageSquare, Calendar, BarChart3, Users, Clock, Loader2, 
  Target, X, Settings, Key, Phone, ShieldCheck, ExternalLink, Save, Trash2,
  Search, Sparkles, Coffee, Building2, CheckCircle2, Zap, Send, ArrowUpRight,
  Filter, PhoneCall, ChevronRight, UserCheck, Smartphone, HelpCircle
} from 'lucide-react';
import ChatInterface from '@/components/fabrika/ChatInterface';
import AppointmentApproval from '@/components/fabrika/AppointmentApproval';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  customerName: string;
  customerPhone: string | null;
  intent: string;
  summary: string | null;
  updatedAt: string;
  messages: Message[];
  _count?: { messages: number };
}

interface Appointment {
  id: string;
  customerName: string;
  proposedDate: string | null;
  proposedTime: string | null;
  status: string;
  createdAt: string;
  conversation: { summary?: string | null };
}

export default function AsistanPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'appointments'>('chat');
  const [filterIntent, setFilterIntent] = useState<'ALL' | 'HOT' | 'APPOINTMENT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Meta & AI Config State
  const [configForm, setConfigForm] = useState({
    token: '',
    phoneNumberId: '',
    businessAccountId: '',
    verifyToken: 'jasmine_secret_verify_token',
    geminiApiKey: '',
    companyName: 'Jasmine Group',
    assistantName: 'Efe',
    serviceCity: 'Alanya'
  });

  // Modal State
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  
  // Real-time messages for selected conversation
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);

  useEffect(() => {
    fetchData(true);
    fetchMetaConfig();

    // Auto-poll for incoming WhatsApp messages every 2 seconds in real-time
    const interval = setInterval(() => {
      fetchData(false);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const fetchMetaConfig = async () => {
    try {
      const res = await fetch('/api/whatsapp/config', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setConfigForm({
          token: data.tokenRaw || '',
          phoneNumberId: data.phoneNumberId || '',
          businessAccountId: data.businessAccountId || '',
          verifyToken: data.verifyToken || 'jasmine_secret_verify_token',
          geminiApiKey: data.geminiApiKey || '',
          companyName: data.companyName || 'Jasmine Group',
          assistantName: data.assistantName || 'Efe',
          serviceCity: data.serviceCity || 'Alanya'
        });
      }
    } catch (e) {
      console.error('Config fetch error');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    const toastId = toast.loading('Ayarlar kaydediliyor...');
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configForm)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Meta API & AI ayarları kaydedildi!', { id: toastId });
        setIsSettingsOpen(false);
      } else {
        toast.error(data.error || 'Kaydetme hatası', { id: toastId });
      }
    } catch (error) {
      toast.error('Bağlantı hatası', { id: toastId });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) setIsLoading(true);
      const [convRes, apptRes] = await Promise.all([
        fetch('/api/fabrika/assistant/conversations', { cache: 'no-store' }),
        fetch('/api/fabrika/assistant/appointment', { cache: 'no-store' })
      ]);
      if (convRes.ok) {
        const data = await convRes.json();
        if (Array.isArray(data)) {
          setConversations(data);
          setSelectedConvId(prevId => {
            if (!prevId && data.length > 0) return data[0].id;
            return prevId;
          });
        }
      }
      if (apptRes.ok) {
        const data = await apptRes.json();
        if (Array.isArray(data)) setAppointments(data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Bu sohbeti ve tüm geçmişini silmek istediğinizden emin misiniz?')) return;

    const toastId = toast.loading('Sohbet siliniyor...');
    try {
      const res = await fetch(`/api/fabrika/assistant/conversations?id=${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success('Sohbet başarıyla silindi!', { id: toastId });
        if (selectedConvId === id) setSelectedConvId(null);
        fetchData();
      } else {
        toast.error('Sohbet silinemedi', { id: toastId });
      }
    } catch (error) {
      toast.error('Silme hatası', { id: toastId });
    }
  };

  useEffect(() => {
    if (selectedConvId) {
      const conv = conversations.find(c => c.id === selectedConvId);
      if (conv) {
        setCurrentMessages(conv.messages || []);
      }
    }
  }, [selectedConvId, conversations]);

  const handleSendMessage = async (text: string) => {
    if (!selectedConvId) return;

    const newMsg: Message = { id: Date.now().toString(), role: 'customer', content: text, createdAt: new Date().toISOString() };
    setCurrentMessages(prev => [...prev, newMsg]);

    try {
      const res = await fetch('/api/fabrika/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConvId, message: text })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentMessages(prev => [...prev, data.messageRecord]);
        fetchData();
      }
    } catch (error) {
      console.error('Failed to send message', error);
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/fabrika/assistant/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: newCustomerName, customerPhone: newCustomerPhone })
      });
      if (res.ok) {
        setIsModalOpen(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        fetchData();
      }
    } catch (error) {
      console.error('Error creating conversation', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch('/api/fabrika/assistant/appointment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve' })
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch('/api/fabrika/assistant/appointment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject' })
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const intentColors: Record<string, string> = {
    INVESTMENT: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    RESIDENTIAL: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    BOTH: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    UNKNOWN: 'bg-slate-800/60 text-slate-300 border-slate-700/40',
  };

  const pendingAppointments = appointments.filter(a => a.status === 'PENDING').length;

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = 
      conv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conv.customerPhone && conv.customerPhone.includes(searchQuery)) ||
      (conv.summary && conv.summary.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterIntent === 'HOT') return conv.intent === 'INVESTMENT' || conv.intent === 'BOTH';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500 selection:text-white relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl w-full max-w-xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
            <div className="flex justify-between items-center mb-6 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-2xl shadow-lg shadow-rose-500/25">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-white">Meta WhatsApp & AI Yapılandırması</h3>
                  <p className="text-xs text-slate-400">Geliştirici anahtarları, canlı webhook ve danışman profili</p>
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar pr-1">
              {/* AI & Persona Config Box */}
              <div className="bg-gradient-to-br from-rose-950/20 via-slate-900 to-slate-950 p-4.5 rounded-2xl border border-rose-500/20 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider">
                    <Sparkles className="w-4 h-4" /> Yapay Zeka Danışman & Şirket Profili
                  </div>
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors hover:underline"
                  >
                    <span>Gemini API Key Al</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Google Gemini API Key (Seçeneğe Bağlı)
                  </label>
                  <input
                    type="password"
                    value={configForm.geminiApiKey}
                    onChange={(e) => setConfigForm({ ...configForm, geminiApiKey: e.target.value })}
                    placeholder="AIzaSy... (Boş bırakılırsa varsayılan anahtar çalışır)"
                    className="w-full bg-slate-950 text-white font-mono text-xs p-3 rounded-xl border border-slate-800 focus:border-rose-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Şirket / Firma Adı
                    </label>
                    <input
                      type="text"
                      value={configForm.companyName}
                      onChange={(e) => setConfigForm({ ...configForm, companyName: e.target.value })}
                      placeholder="Jasmine Group"
                      className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-800 focus:border-rose-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Danışman İsmi
                    </label>
                    <input
                      type="text"
                      value={configForm.assistantName}
                      onChange={(e) => setConfigForm({ ...configForm, assistantName: e.target.value })}
                      placeholder="Efe"
                      className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-800 focus:border-rose-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Hizmet Bölgesi
                    </label>
                    <input
                      type="text"
                      value={configForm.serviceCity}
                      onChange={(e) => setConfigForm({ ...configForm, serviceCity: e.target.value })}
                      placeholder="Alanya"
                      className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-800 focus:border-rose-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Meta Developer Portal Direct Link Bar */}
              <div className="flex items-center justify-between pt-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-rose-400" /> Meta Access Token & ID Bilgileri
                </label>
                <a 
                  href="https://developers.facebook.com/apps/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors hover:underline"
                >
                  <span>Meta Developer Portal & Dashboard</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div>
                <textarea
                  rows={2}
                  value={configForm.token}
                  onChange={(e) => setConfigForm({ ...configForm, token: e.target.value })}
                  placeholder="EAAG... (Meta Cloud API Jetonu)"
                  className="w-full bg-slate-950 text-white font-mono text-xs p-3 rounded-xl border border-slate-800 focus:border-rose-500 outline-none placeholder:text-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-rose-400" /> Phone Number ID
                    </label>
                    <a 
                      href="https://developers.facebook.com/apps/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-0.5"
                    >
                      Al <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="text"
                    value={configForm.phoneNumberId}
                    onChange={(e) => setConfigForm({ ...configForm, phoneNumberId: e.target.value })}
                    placeholder="102938475612345"
                    className="w-full bg-slate-950 text-white font-mono text-xs p-3 rounded-xl border border-slate-800 focus:border-rose-500 outline-none placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400" /> Business Account ID
                    </label>
                    <a 
                      href="https://developers.facebook.com/apps/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-400 hover:text-rose-400 flex items-center gap-0.5"
                    >
                      Al <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="text"
                    value={configForm.businessAccountId}
                    onChange={(e) => setConfigForm({ ...configForm, businessAccountId: e.target.value })}
                    placeholder="987654321012345"
                    className="w-full bg-slate-950 text-white font-mono text-xs p-3 rounded-xl border border-slate-800 focus:border-rose-500 outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Webhook Callback Display & Quick Guide Box */}
              <div className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/30 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300">🟢 Canlı Meta Webhook Callback URL:</span>
                  <a 
                    href="https://developers.facebook.com/apps/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 hover:underline"
                  >
                    <span>Meta Webhook Ayarlarına Git</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <input
                  readOnly
                  value="https://substantially-recommendations-gaming-themes.trycloudflare.com/api/whatsapp/webhook"
                  className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-3 rounded-xl border border-emerald-500/20 outline-none"
                />

                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-emerald-500/10">
                  <span>Verify Token: <code className="text-white font-mono">jasmine_secret_verify_token</code></span>
                  <span className="text-emerald-400 font-semibold">HTTP 200 OK Bekleme Süresi: 0.05sn</span>
                </div>

                {/* Quick Step Guide */}
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1 mt-2">
                  <div className="font-bold text-rose-400 flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" /> Meta Webhook Kurulum Adımları:
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-slate-400 pl-1">
                    <li><a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="text-rose-300 underline">Meta App Dashboard</a> &gt; <b>WhatsApp</b> &gt; <b>Configuration</b> sayfasına gidin.</li>
                    <li><b>Webhook</b> kısmındaki <b>Edit (Düzenle)</b> butonuna tıklayın.</li>
                    <li><b>Callback URL</b> alanına yukarıdaki kırmızı renkli canlı URL&apos;i yapıştırın.</li>
                    <li><b>Verify Token</b> alanına <code className="text-white">jasmine_secret_verify_token</code> yazın.</li>
                    <li>Kaydedip <b>messages</b> olayına abone olun.</li>
                  </ol>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-medium text-xs hover:bg-slate-800 transition-colors"
                >
                  Kapat
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-500/25 transition-all cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Ayarları Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-xl shadow-rose-500/30">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                    Yapay Zeka Asistanı & WhatsApp CRM
                    <span className="text-xs font-normal px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-full font-semibold">
                      v2.4 Live Engine
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400">Otonom müşteri görüşmeleri, randevu takibi ve ilan sunum paneli</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-inner">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>🟢 Canlı Webhook Aktif (Anında 200 OK)</span>
              </div>

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 px-4 py-2 rounded-xl border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Settings className="w-4 h-4 text-rose-400" /> Meta & AI Ayarları
              </button>

              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white px-4 py-2 rounded-xl shadow-lg shadow-rose-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" /> Yeni Test Sohbeti
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/60">
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-slate-700 transition-all">
              <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">Aktif Sohbetler</div>
                <div className="text-base font-extrabold text-white">{conversations.length} Müşteri</div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-slate-700 transition-all">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20 relative">
                <Calendar className="w-4 h-4" />
                {pendingAppointments > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
                )}
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">Onay Bekleyen Randevular</div>
                <div className="text-base font-extrabold text-rose-400">{pendingAppointments} Talep</div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-slate-700 transition-all">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">AI Cevaplama Hızı</div>
                <div className="text-base font-extrabold text-emerald-400">&lt; 0.05s Asenkron</div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-slate-700 transition-all">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">Canlı Portföy Sunumu</div>
                <div className="text-base font-extrabold text-purple-300">Alanya Projeleri</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Tabs */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/80 shadow-inner">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Canlı Sohbet CRM ({conversations.length})
            </button>
            <button
              onClick={() => setActiveTab('appointments')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                activeTab === 'appointments'
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Ofis Randevu Talepleri
              {pendingAppointments > 0 && (
                <span className="px-2 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-bold">
                  {pendingAppointments}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'chat' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilterIntent('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  filterIntent === 'ALL' ? 'bg-slate-800 border-slate-700 text-white' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Tümü
              </button>
              <button
                onClick={() => setFilterIntent('HOT')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  filterIntent === 'HOT' ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                🔥 Sıcak İlgilenenler
              </button>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-4 bg-slate-900/50 border border-slate-800 rounded-3xl">
            <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
            <p className="text-slate-400 text-xs font-medium">Asistan verileri ve sohbet akışı yükleniyor...</p>
          </div>
        ) : activeTab === 'appointments' ? (
          <AppointmentApproval 
            appointments={appointments} 
            onApprove={handleApprove} 
            onReject={handleReject} 
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">
            {/* Sidebar: Conversation List */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800/80 rounded-3xl p-4 flex flex-col h-full shadow-2xl">
              {/* Search Bar */}
              <div className="relative mb-3">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Müşteri adı veya telefon ile ara..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                />
              </div>

              {/* Conversations Stream */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-xs font-medium">Henüz bir sohbet kaydı bulunmuyor.</p>
                  </div>
                ) : (
                  filteredConversations.map(conv => (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                        selectedConvId === conv.id
                          ? 'bg-rose-500/10 border-rose-500/40 shadow-lg shadow-rose-500/10'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="font-bold text-sm text-white group-hover:text-rose-400 transition-colors">
                          {conv.customerName}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${intentColors[conv.intent] || intentColors.UNKNOWN}`}>
                            {conv.intent === 'INVESTMENT' ? 'Yatırımcı' : conv.intent === 'RESIDENTIAL' ? 'Konut' : 'İlgilenen'}
                          </span>
                          <button
                            onClick={(e) => handleDeleteConversation(conv.id, e)}
                            className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 transition-opacity"
                            title="Sohbeti Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-400 truncate mb-2">
                        {conv.summary || 'Henüz mesaj yok'}
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-800/50 pt-2">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-slate-600" />
                          {conv.customerPhone || 'WhatsApp Direct'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(conv.updatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Main Chat Interface */}
            <div className="lg:col-span-8 h-full">
              {selectedConvId ? (
                <ChatInterface 
                  conversationId={selectedConvId}
                  messages={currentMessages}
                  onSendMessage={handleSendMessage}
                  onDeleteConversation={() => handleDeleteConversation(selectedConvId)}
                  customerName={conversations.find(c => c.id === selectedConvId)?.customerName || 'Müşteri'}
                  intent={conversations.find(c => c.id === selectedConvId)?.intent || 'UNKNOWN'}
                />
              ) : (
                <div className="h-full bg-slate-900/60 border border-slate-800/80 rounded-3xl flex flex-col items-center justify-center p-8 text-center shadow-2xl">
                  <div className="w-20 h-20 bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/30 rounded-3xl flex items-center justify-center mb-6 shadow-xl">
                    <Bot className="w-10 h-10 text-rose-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Canlı Sohbet Seçin</h3>
                  <p className="text-slate-400 text-xs max-w-md">
                    Sol menüden müşteri sohbetini seçerek yapay zeka asistanının otonom cevaplarını, randevu tekliflerini ve canlı ilan sunumlarını izleyebilirsiniz.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* New Conversation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white">Yeni Test Sohbeti Başlat</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateConversation}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Müşteri Adı</label>
                    <input 
                      type="text" 
                      required
                      value={newCustomerName}
                      onChange={e => setNewCustomerName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-rose-500"
                      placeholder="Örn: Mehmet Yılmaz"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp Telefon Numarası</label>
                    <input 
                      type="text" 
                      value={newCustomerPhone}
                      onChange={e => setNewCustomerPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-rose-500"
                      placeholder="Örn: 905551234567"
                    />
                  </div>
                </div>
                <div className="mt-8 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-800 text-slate-300 font-medium text-xs hover:bg-slate-800 transition-colors"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-xs transition-colors shadow-lg shadow-rose-500/20"
                  >
                    Sohbet Başlat
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
