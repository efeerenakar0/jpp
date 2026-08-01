'use client';

import { useState, useRef, useEffect } from 'react';
import { Monitor, Code, Download, Send, Loader2, Globe, PlugZap, Sparkles } from 'lucide-react';
import PageHeader from '@/components/fabrika/PageHeader';
import ExistingWebsiteIntegration from '@/components/fabrika/ExistingWebsiteIntegration';
import toast, { Toaster } from 'react-hot-toast';

export default function YazilimciPage() {
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  
  // Onboarding Form
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState('#06b6d4');
  const [isGenerating, setIsGenerating] = useState(false);

  // IT Support Chat
  const [chatMessages, setChatMessages] = useState<{role: string, content: string}[]>([
    { role: 'model', content: 'Merhaba! Ben Jasmine Group IT Destek Uzmanıyım. Alan adı (domain) satın alma, hosting kurulumu veya web sitenizi yayına alma konusunda size nasıl yardımcı olabilirim?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleGenerateWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName) return toast.error('Lütfen şirket adını giriniz.');

    setIsGenerating(true);
    try {
        const res = await fetch('/api/fabrika/yazilimci/generate-website', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyName, logoUrl, themeColor })
        });

        if (!res.ok) throw new Error('Site oluşturulamadı.');

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${companyName.replace(/\s+/g, '_').toLowerCase()}_website.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        
        toast.success('Site paketi ve Codex entegrasyon promptu hazırlandı.');
    } catch (error) {
        toast.error('Bir hata oluştu.');
        console.error(error);
    } finally {
        setIsGenerating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
    setIsTyping(true);

    try {
        const res = await fetch('/api/fabrika/yazilimci/it-support', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: newMsg.content,
                history: chatMessages.slice(1)
            })
        });

        const data = await res.json();
        if (data.reply) {
            setChatMessages(prev => [...prev, { role: 'model', content: data.reply }]);
        }
    } catch {
        toast.error('Bağlantı hatası.');
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="space-y-6 pb-8 text-slate-100">
      <Toaster position="top-right" />
      <div className="space-y-6">
        
        <PageHeader
          eyebrow="Web ve teknik operasyon"
          title="Yazılımcı & IT Entegratör"
          description="Yeni bir site projesi başlatın veya mevcut sitenizi Jasmine portföyleriyle güvenli ve çift yönlü eşitleyin."
          icon={Code}
          actions={
            <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
              Website Connector v1
            </span>
          }
        />


        <div className="space-y-5">
            
            {/* Left Pane: Onboarding & Site Generator */}
            <div className="flex min-h-[520px] flex-col rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-8">
                <h2 className="mb-2 flex items-center gap-3 text-2xl font-bold text-white">
                    <Globe className="h-6 w-6 text-emerald-400" /> Yeni site projesi oluştur
                </h2>
                <p className="mb-7 max-w-3xl text-sm leading-6 text-slate-400">Şirketiniz için canlı portföylerle uyumlu yeni bir site paketi hazırlayın veya çalışan sitenizin kaynak kodunu güvenli bağlantı için gönderin.</p>

                {hasWebsite === null ? (
                    <div className="grid flex-1 gap-4 lg:grid-cols-2">
                        <button onClick={() => setHasWebsite(false)} className="group flex min-h-64 flex-col items-start justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-7 text-left transition hover:border-emerald-400 hover:bg-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                          <span className="rounded-xl bg-emerald-500/15 p-3 text-emerald-300"><Sparkles className="h-7 w-7" /></span>
                          <span><strong className="block text-xl text-white">Sıfırdan yeni site hazırla</strong><span className="mt-2 block max-w-md text-sm leading-6 text-slate-400">Tema, şirket adı ve logoyla başlangıç paketini; Codex promptunu ve canlı portföy bağlantı planını birlikte oluşturur.</span></span>
                          <span className="text-sm font-semibold text-emerald-300">Yeni projeyi başlat →</span>
                        </button>
                        <button onClick={() => setHasWebsite(true)} className="group flex min-h-64 flex-col items-start justify-between rounded-2xl border border-slate-700 bg-slate-950/50 p-7 text-left transition hover:border-slate-500 hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                          <span className="rounded-xl bg-slate-800 p-3 text-slate-200"><PlugZap className="h-7 w-7" /></span>
                          <span><strong className="block text-xl text-white">Mevcut siteyi bağla</strong><span className="mt-2 block max-w-md text-sm leading-6 text-slate-400">Kaynak kodu ve hosting bilgisinden şirkete özel, sürümlü ve imzalı Website Connector paketi üretir.</span></span>
                          <span className="text-sm font-semibold text-slate-200">Bağlantı bilgilerini gir →</span>
                        </button>
                    </div>
                ) : hasWebsite === true ? (
                    <ExistingWebsiteIntegration onBack={() => setHasWebsite(null)} />
                ) : (
                    <div className="flex-1 animate-in slide-in-from-right-8 duration-300">
                        <div className="mb-6 flex items-center gap-3"><Monitor className="h-6 w-6 text-emerald-300"/><div><h3 className="text-lg font-bold text-white">Yeni site bilgileri</h3><p className="text-sm text-slate-400">İndirilen ZIP içinde başlangıç sitesi, kurulum özeti ve Codex entegrasyon promptu bulunur.</p></div></div>
                        
                        <form onSubmit={handleGenerateWebsite} className="grid gap-5 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="mb-2 block text-sm font-semibold text-slate-300">Şirket adı</label>
                                <input 
                                    type="text" 
                                    value={companyName} 
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-white outline-none transition focus:border-emerald-400"
                                    placeholder="Örn: Jasmine Emlak"
                                    required
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-300">Logo adresi <span className="font-normal text-slate-500">(isteğe bağlı)</span></label>
                                <input 
                                    type="url" 
                                    value={logoUrl} 
                                    onChange={(e) => setLogoUrl(e.target.value)}
                                    className="min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-white outline-none transition focus:border-emerald-400"
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-semibold text-slate-300">Tema ana rengi</label>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="color" 
                                        value={themeColor} 
                                        onChange={(e) => setThemeColor(e.target.value)}
                                        className="w-12 h-12 rounded-2xl cursor-pointer bg-transparent border-0"
                                    />
                                    <span className="text-slate-300 font-mono text-xs font-bold">{themeColor}</span>
                                </div>
                            </div>

                            <div className="flex items-end">
                                <button 
                                    type="submit" 
                                    disabled={isGenerating}
                                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                                >
                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    {isGenerating ? 'Paket hazırlanıyor...' : 'Site paketini ve promptu oluştur'}
                                </button>
                            </div>
                        </form>
                        <button onClick={() => setHasWebsite(null)} className="mt-5 text-sm font-medium text-slate-400 underline hover:text-white">Kurulum türüne dön</button>
                    </div>
                )}
            </div>

            {/* Right Pane: IT Support Chatbot */}
            <div className="flex h-[560px] min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                <div className="bg-slate-950 p-6 flex justify-between items-center border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800">
                            <span className="text-xl">👨‍💻</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">IT Destek Uzmanı</h3>
                            <p className="flex items-center gap-1 text-xs font-medium text-emerald-300">
                                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Çevrimiçi (Gemini AI)
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-950/40">
                    {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed font-medium shadow-md ${
                                msg.role === 'user' 
                                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-100 rounded-tr-none'
                                : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                            }`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                         <div className="flex justify-start">
                            <div className="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-none p-4 flex gap-1 items-center">
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-slate-950 border-t border-slate-800">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input 
                            type="text" 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Domain nasıl alırım, dosyaları nasıl yüklerim? Sorun..." 
                            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3.5 text-sm text-white outline-none transition focus:border-emerald-400"
                        />
                        <button 
                            type="submit" 
                            disabled={!chatInput.trim() || isTyping} 
                            className="flex items-center justify-center rounded-xl bg-emerald-400 px-5 font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}
