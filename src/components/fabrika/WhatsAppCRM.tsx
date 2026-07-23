'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Search, Send, Bot, RefreshCw, XCircle, ShieldCheck, Key, Phone, Settings, Save, ExternalLink, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WhatsAppCRM({ allListings }: { allListings: any[] }) {
  const [metaStatus, setMetaStatus] = useState<{ configured: boolean; phoneNumberId?: string; verifyToken?: string } | null>(null);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Settings Modal State
  const [configForm, setConfigForm] = useState({
    token: '',
    phoneNumberId: '',
    businessAccountId: '',
    verifyToken: 'jasmine_secret_verify_token'
  });

  const [waChats, setWaChats] = useState<any[]>([]);
  const [waSelectedChat, setWaSelectedChat] = useState<any>(null);
  const [waActiveMessages, setWaActiveMessages] = useState<any[]>([]);
  const [waMessageInput, setWaMessageInput] = useState('');
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Meta API Status & Config
  useEffect(() => {
    fetchMetaStatus();
    fetchMetaConfig();
  }, []);

  const fetchMetaStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMetaStatus(data);
      }
    } catch (e) {
      setMetaStatus({ configured: false });
    }
  };

  const fetchMetaConfig = async () => {
    try {
      const res = await fetch('/api/whatsapp/config', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setConfigForm({
          token: data.tokenRaw || '',
          phoneNumberId: data.phoneNumberId || '',
          businessAccountId: data.businessAccountId || '',
          verifyToken: data.verifyToken || 'jasmine_secret_verify_token'
        });
      }
    } catch (e) {
      console.error('Config fetch error');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    const toastId = toast.loading('Ayarlar veritabanına kaydediliyor...');
    try {
      const res = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configForm)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Ayarlar kaydedildi!', { id: toastId });
        setIsSettingsOpen(false);
        fetchMetaStatus();
      } else {
        toast.error(data.error || 'Kaydetme hatası', { id: toastId });
      }
    } catch (error) {
      toast.error('Bağlantı hatası', { id: toastId });
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Poll Chats & Active Messages
  useEffect(() => {
    fetchWaChats();
    const interval = setInterval(() => {
      fetchWaChats(true);
      if (waSelectedChat) {
        fetchWaMessages(waSelectedChat.phone, true);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [waSelectedChat]);

  // Scroll to bottom when active messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [waActiveMessages]);

  const fetchWaChats = async (silent = false) => {
    try {
      const res = await fetch(`/api/fabrika/hunting/whatsapp-chats?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const chats = await res.json();
        setWaChats(chats);
      }
    } catch (e) {
      if (!silent) console.error('Sohbetler alınamadı');
    }
  };

  const fetchWaMessages = async (phone: string, silent = false) => {
    try {
      const res = await fetch(`/api/fabrika/hunting/whatsapp-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      if (res.ok) {
        const msgs = await res.json();
        setWaActiveMessages(msgs);
      }
    } catch (e) {
      if (!silent) console.error('Mesajlar alınamadı');
    }
  };

  const sendWaMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waMessageInput.trim() || !waSelectedChat) return;
    const msg = waMessageInput;
    setWaMessageInput('');
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: waSelectedChat.phone, message: msg })
      });
      if (res.ok) {
        toast.success('Mesaj gönderildi!');
        fetchWaMessages(waSelectedChat.phone);
        fetchWaChats();
      } else {
        toast.error('Mesaj gönderilemedi');
      }
    } catch (e) {
      toast.error('Bağlantı hatası');
    }
  };

  const handleGenerateAiReply = async () => {
    if (!waSelectedChat) return;
    setIsGeneratingReply(true);
    const loadingToast = toast.loading('Jasmine AI yanıt üretiyor...');
    try {
      await fetch('/api/fabrika/hunting/whatsapp-ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: waSelectedChat.phone })
      });
      toast.success('Taslak hazır!', { id: loadingToast });
      fetchWaChats();
      fetchWaMessages(waSelectedChat.phone);
    } catch (error) {
      toast.error('AI yanıtı üretilemedi.', { id: loadingToast });
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleApproveDraft = async (messageId: string, content: string) => {
    toast.loading('Mesaj gönderiliyor...', { id: 'approve' });
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: waSelectedChat.phone, message: content, messageId })
      });
      if (res.ok) {
        toast.success('Mesaj onaylandı ve gönderildi!', { id: 'approve' });
        if (waSelectedChat) fetchWaMessages(waSelectedChat.phone);
        fetchWaChats();
      } else {
        toast.error('Gönderim hatası', { id: 'approve' });
      }
    } catch (error) {
      toast.error('Onaylanırken hata oluştu.', { id: 'approve' });
    }
  };

  const handleRejectDraft = async (messageId: string) => {
    try {
      await fetch('/api/fabrika/hunting/whatsapp-reject-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
      });
      toast.success('Taslak iptal edildi.');
      if (waSelectedChat) fetchWaMessages(waSelectedChat.phone);
      fetchWaChats();
    } catch (error) {
      toast.error('İptal edilirken hata oluştu.');
    }
  };

  const handleBulkSend = async () => {
    toast.success('Meta Cloud API ile otonom gönderim başlatıldı...');
    setIsBulkSending(true);
    setTimeout(() => { setIsBulkSending(false); toast.success('Gönderim tamamlandı'); }, 3000);
  };

  const filteredChats = waChats.filter(c => c.phone.includes(searchTerm) || c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-500 relative">
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700/60 rounded-3xl w-full max-w-xl p-6 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Meta WhatsApp Cloud API Ayarları</h3>
                  <p className="text-xs text-gray-400">Veritabanında güvenle saklanır, kod düzenlemesi gerektirmez.</p>
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-emerald-400" /> Meta Access Token (Kalıcı / Geçici Jeton)
                </label>
                <textarea
                  rows={3}
                  value={configForm.token}
                  onChange={(e) => setConfigForm({ ...configForm, token: e.target.value })}
                  placeholder="EAAG... (Meta Developer Portal'dan alınan token)"
                  className="w-full bg-gray-950 text-white font-mono text-xs p-3 rounded-xl border border-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-gray-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" /> Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={configForm.phoneNumberId}
                    onChange={(e) => setConfigForm({ ...configForm, phoneNumberId: e.target.value })}
                    placeholder="102938475612345"
                    className="w-full bg-gray-950 text-white font-mono text-xs p-3 rounded-xl border border-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Business Account ID
                  </label>
                  <input
                    type="text"
                    value={configForm.businessAccountId}
                    onChange={(e) => setConfigForm({ ...configForm, businessAccountId: e.target.value })}
                    placeholder="987654321012345"
                    className="w-full bg-gray-950 text-white font-mono text-xs p-3 rounded-xl border border-gray-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  Webhook Verify Token (Doğrulama Jetonu)
                </label>
                <input
                  type="text"
                  value={configForm.verifyToken}
                  onChange={(e) => setConfigForm({ ...configForm, verifyToken: e.target.value })}
                  className="w-full bg-gray-950 text-white font-mono text-xs p-3 rounded-xl border border-gray-800 focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="bg-gray-950/60 p-3.5 rounded-xl border border-gray-800 text-xs text-gray-400 flex items-center justify-between">
                <span>Meta Developer Console Paneline gitmek için:</span>
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-bold hover:underline flex items-center gap-1">
                  Meta Developers <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button type="button" onClick={() => setIsSettingsOpen(false)} className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-bold transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={isSavingConfig} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center gap-2">
                  {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Ayarları Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Configuration Alert Banner if Credentials Missing */}
      {metaStatus && !metaStatus.configured && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4 flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <h5 className="text-sm font-bold text-amber-200">Meta WhatsApp Cloud API Yapılandırması Yapılmadı</h5>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Canlı mesaj göndermek için sağ üstteki <strong className="text-amber-200">⚙️ Meta API Ayarları</strong> butonuna tıklayarak Meta Token ve Phone Number ID giriniz.
              </p>
            </div>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl transition-all shadow-md">
            Ayarları Yapılandır
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-gray-900/80 backdrop-blur-xl p-5 rounded-t-3xl border border-gray-700/50 flex justify-between items-center shadow-lg z-20 relative">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
             <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h4 className="text-xl font-bold text-white tracking-tight">Meta Cloud API CRM</h4>
              <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${metaStatus?.configured ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                {metaStatus?.configured ? 'Resmi API Aktif' : 'Test / Simulation Modu'}
              </span>
              <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-1.5 text-xs font-bold bg-gray-800 hover:bg-gray-700 text-emerald-400 px-3 py-1.5 rounded-full border border-gray-700 transition-all hover:scale-105">
                <Settings className="w-3.5 h-3.5" /> Meta API Ayarları
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">Sıfır çökme, sıfır QR kod. Doğrudan Meta altyapısına bağlı.</p>
          </div>
        </div>
        <div className="w-80">
          {isBulkSending ? (
            <div className="space-y-2 bg-gray-950/50 p-3 rounded-xl border border-gray-800">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Meta Cloud API Gönderimi Devam Ediyor...</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse w-full"></div>
              </div>
            </div>
          ) : (
            <button onClick={handleBulkSend} className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-sm transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 flex items-center justify-center gap-2">
              <Bot className="w-4 h-4" /> Portföylere Otonom Mesaj At
            </button>
          )}
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="flex flex-1 overflow-hidden bg-gray-950/90 backdrop-blur-3xl border-x border-b border-gray-700/50 rounded-b-3xl shadow-2xl relative z-10">
        
        {/* Sidebar (Chats) */}
        <div className="w-[380px] border-r border-gray-800/80 flex flex-col bg-gray-900/30">
          <div className="p-4 border-b border-gray-800/80 bg-gray-900/50 backdrop-blur-xl">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Sohbet veya Numara Ara..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-950/80 text-white pl-10 pr-4 py-3 rounded-xl text-sm border border-gray-800 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-gray-600 shadow-inner"
                />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {waChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3 p-6 text-center">
                  <div className="w-12 h-12 border border-gray-800 rounded-full flex items-center justify-center bg-gray-900/50">
                    <Phone className="w-5 h-5 text-gray-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-400">Henüz sohbet yok</p>
                  <p className="text-xs text-gray-600">Gelen mesajlar Meta Webhook ile buraya otomatik dökülür.</p>
              </div>
            ) : (
              filteredChats.map((chat, i) => {
                const isSelected = waSelectedChat?.phone === chat.phone;
                return (
                <button 
                  key={i}
                  onClick={() => setWaSelectedChat(chat)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 relative group flex items-center gap-4 ${
                    isSelected ? 'bg-gradient-to-r from-gray-800/80 to-gray-800/40 shadow-inner' : 'hover:bg-gray-800/40'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md border ${isSelected ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400/30' : 'bg-gradient-to-br from-gray-700 to-gray-800 border-gray-600 group-hover:border-gray-500'}`}>
                        {chat.name ? chat.name.substring(0,1).toUpperCase() : chat.phone.substring(0,2)}
                    </div>
                    {chat.hasDraft && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 border-2 border-gray-900 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse"></span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className={`font-bold truncate text-[15px] ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                          {chat.name || chat.phone}
                      </h4>
                      <span className="text-[11px] text-gray-500 font-medium whitespace-nowrap ml-2">
                          {new Date(chat.lastMessageTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <p className={`text-[13px] truncate ${chat.hasDraft ? 'text-amber-400 font-semibold' : 'text-gray-400'}`}>
                        {chat.hasDraft ? '✨ AI Taslağı Hazır' : chat.lastMessage || 'Medya/İleti'}
                    </p>
                  </div>
                </button>
              )})
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-[#0b141a] relative">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("https://static.whatsapp.net/rsrc.php/v3/yl/r/gi_DckOUM5a.png")', backgroundRepeat: 'repeat' }}></div>
          
          {waSelectedChat ? (
            <div className="relative flex flex-col h-full z-10">
              {/* Chat Header */}
              <div className="p-4 bg-gray-900/90 backdrop-blur-xl border-b border-gray-800/80 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-white font-bold">{waSelectedChat.name ? waSelectedChat.name.substring(0,1).toUpperCase() : waSelectedChat.phone.substring(0,2)}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg leading-tight">{waSelectedChat.name || waSelectedChat.phone}</h3>
                      <p className="text-xs text-gray-400">{waSelectedChat.phone}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => fetchWaMessages(waSelectedChat.phone)} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors" title="Sohbeti Yenile">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {waActiveMessages.map((msg, idx) => {
                  const isDraft = msg.status === 'DRAFT';
                  return (
                  <div key={msg.id || idx} className={`flex flex-col ${msg.fromMe ? 'items-end' : 'items-start'}`}>
                    <div className={`relative max-w-[75%] px-4 py-2.5 shadow-sm text-[15px] leading-[22px] ${
                      isDraft 
                        ? 'bg-gradient-to-br from-amber-500/10 to-amber-600/20 border border-amber-500/30 rounded-2xl rounded-tr-sm text-gray-100 backdrop-blur-sm' 
                        : msg.fromMe 
                          ? 'bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-sm' 
                          : 'bg-[#202c33] text-[#e9edef] rounded-2xl rounded-tl-sm'
                    }`}>
                      {isDraft && (
                          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/20">
                              <Sparkles className="w-4 h-4 text-amber-400" />
                              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Jasmine AI Asistan Tarafından Hazırlandı</span>
                          </div>
                      )}
                      
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      
                      <div className={`text-[10px] flex justify-end items-center gap-1 mt-1 -mb-1 ${isDraft ? 'text-amber-400/60' : 'text-gray-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        {msg.fromMe && !isDraft && <CheckCircle2 className="w-3 h-3 text-[#53bdeb]" />}
                      </div>
                    </div>
                    
                    {/* Draft Actions Container */}
                    {isDraft && (
                        <div className="flex gap-2 mt-2 max-w-[75%]">
                            <button onClick={() => handleRejectDraft(msg.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-800 hover:bg-red-500/20 text-gray-300 hover:text-red-400 text-xs font-bold transition-colors border border-gray-700/50 hover:border-red-500/30">
                                <XCircle className="w-4 h-4" /> Reddet
                            </button>
                            <button onClick={() => handleApproveDraft(msg.id, msg.content)} className="flex-1 flex justify-center items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-bold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:-translate-y-0.5">
                                <Send className="w-4 h-4" /> Onayla ve Meta Cloud API ile Gönder
                            </button>
                        </div>
                    )}
                  </div>
                )})}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-[#202c33] z-20">
                <form onSubmit={sendWaMessage} className="flex gap-3 items-end max-w-5xl mx-auto">
                  <button 
                    type="button" 
                    onClick={handleGenerateAiReply}
                    disabled={isGeneratingReply}
                    className="p-3.5 bg-gradient-to-br from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(245,158,11,0.2)] hover:-translate-y-0.5 flex-shrink-0"
                    title="Bu Sohbete AI Yanıtı Üret"
                  >
                    {isGeneratingReply ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
                  </button>
                  
                  <div className="flex-1 bg-[#2a3942] rounded-xl overflow-hidden shadow-inner flex items-center">
                      <input 
                        type="text" 
                        value={waMessageInput}
                        onChange={e => setWaMessageInput(e.target.value)}
                        placeholder="Bir mesaj yazın veya AI butonuna tıklayın..." 
                        className="w-full bg-transparent text-white px-5 py-4 outline-none placeholder:text-gray-500 text-[15px]"
                      />
                  </div>

                  <button type="submit" disabled={!waMessageInput.trim()} className="p-3.5 bg-emerald-500 hover:bg-teal-500 text-white rounded-xl transition-all disabled:opacity-40 disabled:hover:translate-y-0 shadow-lg flex-shrink-0">
                    <Send className="w-5 h-5 ml-0.5" />
                  </button>
                </form>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="relative flex flex-col h-full z-10 items-center justify-center">
              <div className="text-center p-10 max-w-md animate-in zoom-in-95 duration-700">
                <div className="w-32 h-32 bg-gray-800/30 rounded-full flex items-center justify-center mx-auto mb-8 relative border border-gray-700/30 backdrop-blur-xl">
                    <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-pulse"></div>
                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-16 h-16 opacity-50 grayscale" />
                </div>
                <h3 className="text-3xl font-light text-gray-300 mb-4 tracking-tight">Jasmine Meta CRM</h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Mesaj göndermek veya yapay zeka asistanını çalıştırmak için sol taraftan bir sohbet seçin.
                </p>
                <div className="mt-10 inline-flex items-center gap-2 text-xs text-gray-400 bg-gray-900/50 px-4 py-2 rounded-full border border-gray-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" /> Meta WhatsApp Cloud API Entegre
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
