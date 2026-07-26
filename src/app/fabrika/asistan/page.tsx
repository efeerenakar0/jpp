'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bot, Plus, MessageSquare, Calendar, BarChart3, Clock, Loader2,
  X, Settings, Key, Phone, ShieldCheck, ExternalLink, Save, Trash2,
  Search, Sparkles, CheckCircle2, Smartphone, HelpCircle
} from 'lucide-react';
import ChatInterface from '@/components/fabrika/ChatInterface';
import AppointmentApproval from '@/components/fabrika/AppointmentApproval';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  deliveryStatus?: string;
  messageType?: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
}

interface Conversation {
  id: string;
  customerName: string;
  customerPhone: string | null;
  channel?: string;
  intent: string;
  summary: string | null;
  notes?: string | null;
  tags?: string[];
  aiEnabled?: boolean;
  lastCustomerMessageAt?: string | null;
  updatedAt: string;
  createdAt?: string;
  messages: Message[];
  _count?: { messages: number };
}

interface Appointment {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  proposedDate: string | null;
  proposedTime: string | null;
  status: string;
  confirmationSent?: boolean;
  reminderSentAt?: string | null;
  createdAt: string;
  conversation: { summary?: string | null };
}

interface AssistantMetrics {
  activeConversations: number;
  handoffConversations: number;
  todayMessages: number;
  incomingMessages: number;
  outgoingMessages: number;
  deliveredMessages: number;
  readMessages: number;
  failedMessages: number;
  readRate: number;
  pendingAppointments: number;
  approvedToday: number;
}

type AppointmentAction =
  | 'approve'
  | 'reject'
  | 'resend'
  | 'reschedule'
  | 'cancel'
  | 'remind';

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
  const [appointmentActionId, setAppointmentActionId] = useState<string | null>(null);
  const [isCleaningData, setIsCleaningData] = useState(false);
  const [metrics, setMetrics] = useState<AssistantMetrics | null>(null);

  // Meta & AI Config State
  const [configForm, setConfigForm] = useState({
    token: '',
    phoneNumberId: '',
    businessAccountId: '',
    verifyToken: '',
    geminiApiKey: '',
    companyName: 'Jasmine Group',
    assistantName: 'Efe',
    serviceCity: 'Alanya',
    companyAddress: '',
    companyDetails: '',
    websiteUrl: '',
    instagramUrl: '',
    languages: 'Türkçe',
    fallbackTemplateName: '',
    templateLanguage: 'tr'
  });

  // Modal State
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  
  const getDeletedConvIds = (): Set<string> => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('jasmine_deleted_conv_ids');
      if (raw) {
        try { return new Set(JSON.parse(raw)); } catch {}
      }
    }
    return new Set();
  };

  const normalizePhone = (phone?: string | null): string => {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('05')) clean = `90${clean.substring(1)}`;
    else if (clean.length === 10 && clean.startsWith('5')) clean = `90${clean}`;
    return clean;
  };

  const isDemoOrDeleted = (c: Conversation) => {
    if (!c) return true;
    const deletedIds = getDeletedConvIds();
    const id = String(c.id || '').toLowerCase();
    return id === 'demo_conv_dummy_test_1' || deletedIds.has(c.id);
  };

  // Smart Merging Engine to Prevent Serverless Disappearing Messages & Duplicate Cards
  const mergeConversationsWithLocalCache = (incomingConvs: Conversation[]): Conversation[] => {
    let cachedConvs: Conversation[] = [];
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('jasmine_conversations_cache');
      if (raw) {
        try { cachedConvs = JSON.parse(raw); } catch {}
      }
    }

    const map = new Map<string, Conversation>();

    const getMapKey = (c: Conversation) => {
      const norm = normalizePhone(c.customerPhone);
      return norm && norm.length >= 10 ? `phone_${norm}` : c.id;
    };

    // 1. Put cached conversations first (excluding demo and deleted ones)
    cachedConvs.filter(c => !isDemoOrDeleted(c)).forEach(c => map.set(getMapKey(c), c));

    // 2. Merge incoming conversations cleanly without losing any existing conversation
    if (Array.isArray(incomingConvs)) {
      incomingConvs.filter(inc => !isDemoOrDeleted(inc)).forEach(inc => {
        const key = getMapKey(inc);
        const existing = map.get(key);
        if (existing) {
          const msgMap = new Map<string, Message>();
          (existing.messages || []).forEach(m => msgMap.set(m.id || `${m.role}_${m.content}`, m));
          (inc.messages || []).forEach(m => msgMap.set(m.id || `${m.role}_${m.content}`, m));
          
          const mergedMessages = Array.from(msgMap.values()).sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
          map.set(key, {
            ...existing,
            ...inc,
            id: existing.id,
            messages: mergedMessages,
            _count: { messages: mergedMessages.length }
          });
        } else {
          map.set(key, inc);
        }
      });
    }

    const result = Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(b.updatedAt || b.createdAt || 0).getTime();
      const timeB = new Date(a.updatedAt || a.createdAt || 0).getTime();
      return timeA - timeB;
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem('jasmine_conversations_cache', JSON.stringify(result));
    }

    return result;
  };

  const clearLocalCache = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jasmine_conversations_cache');
      localStorage.removeItem('jasmine_deleted_conv_ids');
    }
    setConversations([]);
    setSelectedConvId(null);
  };

  const handleCleanupData = async () => {
    setIsCleaningData(true);
    try {
      const previewResponse = await fetch(
        '/api/fabrika/assistant/cleanup',
        { cache: 'no-store' }
      );
      const preview = await previewResponse.json();
      if (!previewResponse.ok) {
        throw new Error(preview.error || 'Temizlik önizlemesi alınamadı.');
      }
      const total =
        preview.testConversationCount + preview.invalidMessageCount;
      if (total === 0) {
        clearLocalCache();
        await fetchData(true);
        toast.success('Temizlenecek test veya hatalı kayıt bulunmadı.');
        return;
      }
      const confirmed = window.confirm(
        `${preview.testConversationCount} test sohbeti ve ${preview.invalidMessageCount} hatalı, gönderilmemiş mesaj kalıcı olarak silinecek. Devam edilsin mi?`
      );
      if (!confirmed) {
        return;
      }
      const response = await fetch('/api/fabrika/assistant/cleanup', {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Veriler temizlenemedi.');
      }
      clearLocalCache();
      await fetchData(true);
      toast.success(
        `${result.deletedTestConversations} test sohbeti ve ${result.deletedInvalidMessages} hatalı mesaj temizlendi.`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Veriler temizlenemedi.'
      );
    } finally {
      setIsCleaningData(false);
    }
  };

  useEffect(() => {
    fetchData(true);
    fetchMetaConfig();

    const interval = setInterval(() => {
      fetchData(false);
    }, 2000);

    return () => clearInterval(interval);
    // The polling lifecycle is intentionally created once per page mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isTestingMeta, setIsTestingMeta] = useState(false);

  const handleTestMetaConnection = async () => {
    setIsTestingMeta(true);
    const toastId = toast.loading('Meta WhatsApp Cloud API canlı testi yapılıyor...');
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          token: configForm.token,
          phoneNumberId: configForm.phoneNumberId,
          businessAccountId: configForm.businessAccountId,
          testPhone: '905435720769'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message, { id: toastId, duration: 8000 });
      } else {
        toast.error(data.error || 'Meta API Bağlantı Hatası', { id: toastId, duration: 9000 });
      }
    } catch (error: unknown) {
      toast.error(
        `Test isteği atılamadı: ${
          error instanceof Error ? error.message : 'Bilinmeyen hata'
        }`,
        { id: toastId }
      );
    } finally {
      setIsTestingMeta(false);
    }
  };

  async function fetchMetaConfig() {
    try {
      const res = await fetch('/api/whatsapp/config', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setConfigForm(prev => ({
          ...prev,
          token: '',
          phoneNumberId: data.phoneNumberId || prev.phoneNumberId,
          businessAccountId: data.businessAccountId || prev.businessAccountId,
          verifyToken: '',
          geminiApiKey: '',
          companyName: data.companyName || prev.companyName,
          assistantName: data.assistantName || prev.assistantName,
          serviceCity: data.serviceCity || prev.serviceCity,
          companyAddress: data.companyAddress || prev.companyAddress,
          companyDetails: data.companyDetails || prev.companyDetails,
          websiteUrl: data.websiteUrl || prev.websiteUrl,
          instagramUrl: data.instagramUrl || prev.instagramUrl,
          languages: data.languages || prev.languages,
          fallbackTemplateName:
            data.fallbackTemplateName || prev.fallbackTemplateName,
          templateLanguage: data.templateLanguage || prev.templateLanguage
        }));
      }
    } catch {
      console.error('Config fetch error');
    }
  }

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
      if (!res.ok) {
        throw new Error(data.error || 'Ayarlar kaydedilemedi.');
      }
      toast.success('Meta API ve firma ayarları güvenli biçimde kaydedildi.', { id: toastId });
      setIsSettingsOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.';
      toast.error(message, { id: toastId });
    } finally {
      setIsSavingConfig(false);
    }
  };

  async function fetchData(isInitial = false) {
    try {
      if (isInitial) setIsLoading(true);

      const [convRes, apptRes, metricsRes] = await Promise.all([
        fetch('/api/fabrika/assistant/conversations', { cache: 'no-store' }),
        fetch('/api/fabrika/assistant/appointment', { cache: 'no-store' }),
        fetch('/api/fabrika/assistant/metrics', { cache: 'no-store' })
      ]);
      if (convRes.ok) {
        const data = await convRes.json();
        if (Array.isArray(data)) {
          const merged = mergeConversationsWithLocalCache(data);
          setConversations(prev => {
            if (JSON.stringify(prev) === JSON.stringify(merged)) return prev;
            return merged;
          });
          setSelectedConvId(prevId => {
            if (!prevId && merged.length > 0) return merged[0].id;
            return prevId;
          });
        }
      }
      if (apptRes.ok) {
        const data = await apptRes.json();
        if (Array.isArray(data)) setAppointments(data);
      }
      if (metricsRes.ok) {
        setMetrics(await metricsRes.json());
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }

  const handleDeleteConversation = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Bu sohbeti ve tüm geçmişini silmek istediğinizden emin misiniz?')) return;

    const toastId = toast.loading('Sohbet siliniyor...');
    try {
      await fetch(`/api/fabrika/assistant/conversations?id=${id}`, { method: 'DELETE' });
    } catch {}

    // Record deleted ID in LocalStorage permanently
    if (typeof window !== 'undefined') {
      const deletedIds = getDeletedConvIds();
      deletedIds.add(id);
      localStorage.setItem('jasmine_deleted_conv_ids', JSON.stringify(Array.from(deletedIds)));
    }

    setConversations(prev => {
      const updated = prev.filter(c => c.id !== id);
      if (typeof window !== 'undefined') {
        localStorage.setItem('jasmine_conversations_cache', JSON.stringify(updated));
      }
      return updated;
    });

    if (selectedConvId === id) setSelectedConvId(null);
    toast.success('Sohbet başarıyla silindi!', { id: toastId });
  };

  const handleSendMessage = async (text: string) => {
    if (!selectedConvId) return;

    try {
      const res = await fetch('/api/fabrika/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConvId, message: text })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Mesaj gönderilemedi.');
      }
      if (data.messageRecord) {
        setConversations(prev => {
          const updated = prev.map(c => {
            if (c.id === selectedConvId) {
              const msgs = [...(c.messages || []), data.messageRecord];
              return { ...c, summary: data.messageRecord.content, updatedAt: new Date().toISOString(), messages: msgs, _count: { messages: msgs.length } };
            }
            return c;
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem('jasmine_conversations_cache', JSON.stringify(updated));
          }
          return updated;
        });
      }
      toast.success(
        data.sentToWhatsApp
          ? 'Mesaj WhatsApp’a gönderildi.'
          : 'Mesaj konuşmaya kaydedildi.'
      );
    } catch (error) {
      console.error('Failed to send message', error);
      toast.error(error instanceof Error ? error.message : 'Mesaj gönderilemedi.');
    }
  };

  const handleUpdateConversation = async (updates: {
    notes?: string;
    tags?: string[];
    aiEnabled?: boolean;
  }) => {
    if (!selectedConvId) return;

    try {
      const response = await fetch('/api/fabrika/assistant/conversations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedConvId, ...updates }),
      });
      const updatedConversation = await response.json();
      if (!response.ok) {
        throw new Error(
          updatedConversation.error || 'Müşteri bilgileri güncellenemedi.'
        );
      }
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === selectedConvId
            ? { ...conversation, ...updatedConversation }
            : conversation
        )
      );
      toast.success(
        typeof updates.aiEnabled === 'boolean'
          ? updates.aiEnabled
            ? 'Yapay zeka yeniden devreye alındı.'
            : 'Sohbet insan temsilciye devredildi.'
          : 'Müşteri bilgileri kaydedildi.'
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Müşteri bilgileri güncellenemedi.'
      );
      throw error;
    }
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/fabrika/assistant/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: newCustomerName, customerPhone: newCustomerPhone })
      });
      const conversation = await response.json();
      if (!response.ok) {
        throw new Error(conversation.error || 'Sohbet oluşturulamadı.');
      }
      setConversations(prev => [conversation, ...prev]);
      setSelectedConvId(conversation.id);
      setIsModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sohbet oluşturulamadı.');
    }
  };

  const handleAppointmentAction = async (
    id: string,
    action: AppointmentAction,
    data?: { proposedDate?: string; proposedTime?: string }
  ) => {
    setAppointmentActionId(id);
    try {
      const res = await fetch('/api/fabrika/assistant/appointment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...data })
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Randevu işlemi tamamlanamadı.');
      }
      const successMessages: Record<AppointmentAction, string> = {
        approve: 'Randevu onaylandı ve WhatsApp mesajı gönderildi.',
        reject: 'Randevu talebi reddedildi.',
        resend: 'Randevu onayı WhatsApp üzerinden gönderildi.',
        reschedule: 'Randevu değiştirildi ve müşteriye bildirildi.',
        cancel: 'Randevu iptal edildi ve müşteriye bildirildi.',
        remind: 'Randevu hatırlatması WhatsApp üzerinden gönderildi.',
      };
      toast.success(
        action === 'reschedule' && !result.messageRecord
          ? 'Randevu tarihi kaydedildi; onay bekliyor.'
          : successMessages[action]
      );
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Randevu işlemi tamamlanamadı.'
      );
      throw error;
    } finally {
      setAppointmentActionId(null);
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
  const selectedConversation = conversations.find(
    (conversation) => conversation.id === selectedConvId
  );

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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Şirket / Ofis Adresi
                  </label>
                  <textarea
                    rows={2}
                    value={configForm.companyAddress}
                    onChange={(e) => setConfigForm({ ...configForm, companyAddress: e.target.value })}
                    placeholder="Örn: Mahmutlar Mah. Barbaros Cad. Jasmine Towers No:12 Alanya/Antalya"
                    className="w-full bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800 focus:border-rose-500 outline-none resize-none custom-scrollbar"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Şirket Hakkında İlave Bilgiler & Hizmet Detayları
                  </label>
                  <textarea
                    rows={3}
                    value={configForm.companyDetails}
                    onChange={(e) => setConfigForm({ ...configForm, companyDetails: e.target.value })}
                    placeholder="Örn: Haftanın 7 günü 09:00 - 19:00 saatleri arasında açığız. Satış sonrası tapu ve abonelik işlemlerinde ücretsiz destek sağlıyoruz."
                    className="w-full bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800 focus:border-rose-500 outline-none resize-none custom-scrollbar"
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

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Web Sitesi (Tam Link)
                    </label>
                    <input
                      type="text"
                      value={configForm.websiteUrl}
                      onChange={(e) => setConfigForm({ ...configForm, websiteUrl: e.target.value })}
                      placeholder="https://siteadresi.com"
                      className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-800 focus:border-rose-500 outline-none"
                    />
                    <span className="block text-[9px] text-slate-400 mt-1 leading-tight">
                      Örn: https://siteadresi.com
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Instagram (Tam Link)
                    </label>
                    <input
                      type="text"
                      value={configForm.instagramUrl}
                      onChange={(e) => setConfigForm({ ...configForm, instagramUrl: e.target.value })}
                      placeholder="https://instagram.com/kullanici"
                      className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-800 focus:border-rose-500 outline-none"
                    />
                    <span className="block text-[9px] text-rose-400 font-medium mt-1 leading-tight">
                      ⚠️ Sadece kullanıcı adı yazmayın. https:// ile başlayan tam linki girin.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Desteklenen Diller
                    </label>
                    <input
                      type="text"
                      value={configForm.languages}
                      onChange={(e) => setConfigForm({ ...configForm, languages: e.target.value })}
                      placeholder="Türkçe, İngilizce, Rusça"
                      className="w-full bg-slate-950 text-white text-xs p-2.5 rounded-xl border border-slate-800 focus:border-rose-500 outline-none"
                    />
                    <span className="block text-[9px] text-slate-400 mt-1 leading-tight">
                      Virgülle ayırarak yazın.
                    </span>
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

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4">
                <div className="flex items-start gap-3 mb-3">
                  <Clock className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-200">
                      24 Saat Sonrası Meta Şablonu
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Meta’da onaylanmış ve gövdesinde tek metin değişkeni bulunan
                      şablonun adını girin. Süre dolduğunda manuel mesajlar ve
                      randevu bildirimleri bu şablonla gönderilir.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px] gap-3">
                  <div>
                    <label
                      htmlFor="fallback-template-name"
                      className="block text-[11px] font-semibold text-slate-300 mb-1"
                    >
                      Onaylı şablon adı
                    </label>
                    <input
                      id="fallback-template-name"
                      type="text"
                      value={configForm.fallbackTemplateName}
                      onChange={(event) =>
                        setConfigForm({
                          ...configForm,
                          fallbackTemplateName: event.target.value,
                        })
                      }
                      placeholder="jasmine_bildirim"
                      className="w-full bg-slate-950 text-white font-mono text-xs p-3 rounded-xl border border-slate-700 focus-visible:ring-2 focus-visible:ring-amber-400 outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="template-language"
                      className="block text-[11px] font-semibold text-slate-300 mb-1"
                    >
                      Dil kodu
                    </label>
                    <input
                      id="template-language"
                      type="text"
                      value={configForm.templateLanguage}
                      onChange={(event) =>
                        setConfigForm({
                          ...configForm,
                          templateLanguage: event.target.value,
                        })
                      }
                      placeholder="tr"
                      className="w-full bg-slate-950 text-white font-mono text-xs p-3 rounded-xl border border-slate-700 focus-visible:ring-2 focus-visible:ring-amber-400 outline-none"
                    />
                  </div>
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
                  value={typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : 'https://jpp-ufeb.vercel.app/api/whatsapp/webhook'}
                  className="w-full bg-slate-950 text-emerald-400 font-mono text-xs p-3 rounded-xl border border-emerald-500/20 outline-none select-all"
                />

                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1 border-t border-emerald-500/10">
                  <span>Verify Token: <code className="text-white font-mono">Vercel ortam değişkeninde saklanır</code></span>
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
                    <li><b>Callback URL</b> alanına yukarıdaki canlı URL&apos;i yapıştırın.</li>
                    <li><b>Verify Token</b> değerini güvenli Vercel ortam ayarınızdan alın.</li>
                    <li>Kaydedip <b>messages</b> olayına abone olun.</li>
                  </ol>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap justify-between items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestMetaConnection}
                  disabled={isTestingMeta}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  {isTestingMeta ? 'Meta Test Ediliyor...' : '🟢 Meta WhatsApp Bağlantısını Test Et'}
                </button>

                <div className="flex gap-2">
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
                      v3.0 CRM
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400">
                    WhatsApp teslim takibi, insan devri ve uçtan uca randevu yönetimi
                  </p>
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
                onClick={handleCleanupData}
                disabled={isCleaningData}
                className="flex items-center gap-1.5 text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 px-3.5 py-2 rounded-xl border border-rose-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Test sohbetlerini ve hatalı, gönderilmemiş mesajları önizleyip temizle"
              >
                {isCleaningData ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                )}
                Veri Temizliği
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
                <div className="text-base font-extrabold text-white">
                  {metrics?.activeConversations ?? conversations.length} müşteri
                </div>
                <div className="text-[10px] text-blue-300">
                  {metrics?.handoffConversations ?? 0} insan temsilcide
                </div>
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
                <div className="text-[10px] text-emerald-300">
                  Bugün {metrics?.approvedToday ?? 0} onay
                </div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-slate-700 transition-all">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">Bugünkü Mesajlar</div>
                <div className="text-base font-extrabold text-emerald-400">
                  {metrics?.todayMessages ?? 0} mesaj
                </div>
                <div className="text-[10px] text-slate-400">
                  {metrics?.incomingMessages ?? 0} gelen · {metrics?.outgoingMessages ?? 0} giden
                </div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-3.5 flex items-center gap-3.5 hover:border-slate-700 transition-all">
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-medium">Okunma Oranı</div>
                <div className="text-base font-extrabold text-purple-300">
                  %{metrics?.readRate ?? 0}
                </div>
                <div className="text-[10px] text-slate-400">
                  {metrics?.deliveredMessages ?? 0} teslim · {metrics?.failedMessages ?? 0} hata
                </div>
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
            onAction={handleAppointmentAction}
            processingId={appointmentActionId}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px]">
            {/* Sidebar: Conversation List */}
            <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800/80 rounded-3xl p-4 flex flex-col h-full shadow-2xl">
              {/* Search Bar & Clear Cache */}
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Müşteri adı veya telefon ile ara..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
                  />
                </div>
                <button
                  onClick={handleCleanupData}
                  disabled={isCleaningData}
                  className="p-2.5 bg-rose-950/50 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 rounded-xl transition-all cursor-pointer shrink-0"
                  title="Test ve hatalı verileri temizle"
                >
                  {isCleaningData ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
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
                          {conv.aiEnabled === false && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 font-bold">
                              İnsanda
                            </span>
                          )}
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
                      {conv.tags && conv.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {conv.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-1.5 py-0.5 text-[9px] rounded bg-purple-500/10 border border-purple-500/20 text-purple-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

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
                  key={selectedConvId}
                  conversationId={selectedConvId}
                  messages={selectedConversation?.messages || []}
                  onSendMessage={handleSendMessage}
                  onUpdateConversation={handleUpdateConversation}
                  onDeleteConversation={() => handleDeleteConversation(selectedConvId)}
                  customerName={selectedConversation?.customerName || 'Müşteri'}
                  intent={selectedConversation?.intent || 'UNKNOWN'}
                  notes={selectedConversation?.notes}
                  tags={selectedConversation?.tags}
                  aiEnabled={selectedConversation?.aiEnabled !== false}
                  lastCustomerMessageAt={selectedConversation?.lastCustomerMessageAt}
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

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 text-xs font-medium hover:bg-slate-800"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-500/20"
                  >
                    Sohbeti Başlat
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
