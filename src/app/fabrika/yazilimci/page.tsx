'use client';

import { useState, useRef, useEffect } from 'react';
import { Monitor, Code, Download, MessageSquare, Send, Loader2, Server, Globe } from 'lucide-react';
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
        
        toast.success('Web siteniz başarıyla oluşturuldu ve indirildi!', { icon: '🎉' });
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
    } catch (error) {
        toast.error('Bağlantı hatası.');
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 md:p-8 font-sans">
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
        
        {/* Header - Stitch Glass */}
        <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-2xl flex items-center justify-center border border-cyan-400/30 shadow-lg shadow-cyan-500/20 shrink-0">
                <Code className="w-8 h-8 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
                <h1 className="text-2xl font-black text-white flex items-center gap-2">
                  Yazılımcı & IT Entegratör
                  <span className="text-xs px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-full font-bold">
                    Otonom Web Şablon Oluşturucu
                  </span>
                </h1>
                <p className="text-xs text-slate-400 font-medium mt-1">Web sitenizi saniyeler içinde inşa edin ve yayınlamak için yapay zeka destekli IT uzmanından yardım alın.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Pane: Onboarding & Site Generator */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col h-[700px]">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-cyan-400" /> Web Sitesi Kurulumu
                </h2>

                {hasWebsite === null ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
                        <div className="w-20 h-20 bg-slate-950 rounded-3xl flex items-center justify-center border border-slate-800 shadow-inner">
                            <Monitor className="w-10 h-10 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white mb-2">Mevcut bir web siteniz var mı?</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium leading-relaxed">Jasmine Fabrikası verilerinizi kendi sitenize bağlayabilir veya size yepyeni bir site oluşturabiliriz.</p>
                        </div>
                        <div className="flex gap-4 w-full max-w-sm">
                            <button onClick={() => setHasWebsite(true)} className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl transition-all border border-slate-700 cursor-pointer">
                                Evet, Var
                            </button>
                            <button onClick={() => setHasWebsite(false)} className="flex-1 py-3.5 bg-gradient-to-r from-cyan-400 to-teal-500 hover:from-cyan-300 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-cyan-500/20 cursor-pointer active:scale-95">
                                Hayır, Yok
                            </button>
                        </div>
                    </div>
                ) : hasWebsite === true ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
                        <Server className="w-16 h-16 text-emerald-400 mb-2" />
                        <h3 className="text-lg font-bold text-white">Harika! Webhook Entegrasyonu Hazır.</h3>
                        <p className="text-xs text-slate-400 max-w-md font-medium">Kendi web sitenizdeki ilanları otomatik güncellemek için Endpoint adresimiz:</p>
                        <code className="bg-slate-950 text-emerald-400 px-4 py-3 rounded-xl border border-slate-800 text-xs font-mono w-full max-w-md">
                            POST /api/portfolios/add
                        </code>
                        <p className="text-[11px] text-slate-500 mt-4">Bu endpoint&apos;e gönderilen veriler Gemini ile SEO uyumlu hale getirilip saklanır.</p>
                        <button onClick={() => setHasWebsite(null)} className="text-cyan-400 hover:text-cyan-300 text-xs mt-8 underline cursor-pointer">Geri Dön</button>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col h-full animate-in slide-in-from-right-8 duration-500">
                        <p className="text-xs text-slate-400 mb-6 font-medium">Hemen size özel temel bir emlak sitesi şablonu oluşturalım. Bilgileri doldurun ve sitenizi indirin.</p>
                        
                        <form onSubmit={handleGenerateWebsite} className="space-y-5 flex-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Şirket Adı</label>
                                <input 
                                    type="text" 
                                    value={companyName} 
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 transition-all font-medium"
                                    placeholder="Örn: Jasmine Emlak"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Logo URL (Opsiyonel)</label>
                                <input 
                                    type="url" 
                                    value={logoUrl} 
                                    onChange={(e) => setLogoUrl(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 transition-all font-medium"
                                    placeholder="https://..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-2">Tema Ana Rengi</label>
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

                            <div className="pt-4">
                                <button 
                                    type="submit" 
                                    disabled={isGenerating}
                                    className="w-full py-4 bg-gradient-to-r from-cyan-400 to-teal-500 hover:from-cyan-300 hover:to-teal-400 text-slate-950 font-black rounded-2xl transition-all shadow-xl shadow-cyan-500/20 text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                                >
                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                    {isGenerating ? 'Şablon Derleniyor...' : 'Web Sitesini Oluştur ve İndir'}
                                </button>
                            </div>
                        </form>
                        <button onClick={() => setHasWebsite(null)} className="text-slate-500 hover:text-slate-400 text-xs mt-4 underline text-center w-full cursor-pointer">Geri Dön</button>
                    </div>
                )}
            </div>

            {/* Right Pane: IT Support Chatbot */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col h-[700px] overflow-hidden">
                <div className="bg-slate-950 p-6 flex justify-between items-center border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800">
                            <span className="text-xl">👨‍💻</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">IT Destek Uzmanı</h3>
                            <p className="text-[11px] text-cyan-400 flex items-center gap-1 font-bold">
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
                                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 rounded-tr-none' 
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
                            className="flex-1 bg-slate-900 text-white text-xs px-4 py-3.5 rounded-2xl outline-none focus:border-cyan-400 border border-slate-800 transition-all font-medium"
                        />
                        <button 
                            type="submit" 
                            disabled={!chatInput.trim() || isTyping} 
                            className="px-5 bg-gradient-to-r from-cyan-400 to-teal-500 hover:from-cyan-300 hover:to-teal-400 text-slate-950 font-black rounded-2xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-center cursor-pointer active:scale-95"
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
