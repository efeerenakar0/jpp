'use client';

import { useState, useEffect } from 'react';
import OnboardingWizard from '@/components/fabrika/OnboardingWizard';
import StatusBoard from '@/components/fabrika/StatusBoard';
import WhatsAppButton from '@/components/fabrika/WhatsAppButton';
import WhatsAppCRM from '@/components/fabrika/WhatsAppCRM';
import { Search, Loader2, Sparkles, Download, CheckCircle2, AlertTriangle, ArrowRight, Trash2, Crosshair, RefreshCw } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AvciPage() {
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'pano' | 'eklenti' | 'mesaj' | 'whatsapp'>('pano');
  
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [tone, setTone] = useState<'resmi' | 'samimi' | 'acil'>('samimi');
  
  // WhatsApp State
  const [waStatus, setWaStatus] = useState('disconnected');
  const [waQr, setWaQr] = useState<string | null>(null);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  
  // Tüm ilanlar
  const [allListings, setAllListings] = useState<any[]>([]);

  // Chat Modal State
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chattingWith, setChattingWith] = useState<string>('');

  useEffect(() => {
    fetchProfile();
    fetchListings();
  }, []);

  const fetchAndShowChat = async (phone: string, name: string) => {
    setChattingWith(`${name} (${phone})`);
    setChatHistory([]);
    setChatModalOpen(true);
    try {
      const res = await fetch(`/api/fabrika/hunting/whatsapp-messages?phone=${phone}`);
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/fabrika/onboarding');
      if (res.ok) {
        const data = await res.json();
        setHasProfile(!!data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setProfileLoaded(true);
    }
  };

  const fetchListings = async () => {
    try {
      const res = await fetch('/api/fabrika/hunting/status');
      if (res.ok) {
        const data = await res.json();
        setAllListings(data);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await fetch('/api/fabrika/hunting/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        fetchListings();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (!confirm('Bu ilanı tamamen silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`/api/fabrika/hunting/delete-listing?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAllListings(prev => prev.filter(l => l.id !== id));
      } else {
        alert('İlan silinemedi.');
      }
    } catch (error) {
      console.error(error);
      alert('Silme işlemi sırasında hata oluştu.');
    }
  };

  const handleGenerateBulkMessages = async () => {
    const yellowListings = allListings.filter(l => l.status === 'YELLOW' && (!l.messages || l.messages.length === 0));
    if (yellowListings.length === 0) return alert('Mesajı olmayan Sarı (Pazarlıkta) ilan bulunamadı.');
    
    setIsGeneratingMessages(true);
    try {
      const listingIds = yellowListings.map(l => l.id);
      const res = await fetch('/api/fabrika/hunting/bulk-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingIds, tone }),
      });

      const data = await res.json();
      if (data.success) {
        alert(`${data.count} ilan için kişiselleştirilmiş mesajlar üretildi!`);
        fetchListings();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error(error);
      alert('Mesajlar üretilirken hata oluştu.');
    } finally {
      setIsGeneratingMessages(false);
    }
  };

  if (!profileLoaded) {
    return <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-white font-mono">Yükleniyor...</div>;
  }

  if (!hasProfile) {
    return <OnboardingWizard />;
  }

  const yellowListings = allListings.filter(l => l.status === 'YELLOW');

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-4 sm:p-8 font-sans">
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header & Stats - Stitch Glass */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-slate-900/80 border border-slate-800 p-6 rounded-3xl backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Crosshair className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                Avcı Modülü
                <span className="text-xs px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-full font-bold">
                  Chrome Otonom Bot
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Sahibinden.com bot korumalarını aşarak ilan ve mal sahibi telefonlarını fabrikanıza çekin.</p>
            </div>
          </div>
          
          <div className="flex gap-6">
            <div className="text-center bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
              <div className="text-xl font-black text-white">{allListings.length}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Toplam İlan</div>
            </div>
            <div className="text-center bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
              <div className="text-xl font-black text-amber-400">{allListings.filter(l => l.status === 'YELLOW').length}</div>
              <div className="text-[10px] text-amber-500 uppercase font-bold tracking-wider">Pazarlıkta</div>
            </div>
            <div className="text-center bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
              <div className="text-xl font-black text-emerald-400">{allListings.filter(l => l.status === 'GREEN').length}</div>
              <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Avlandı</div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
            <button 
              onClick={() => { setActiveTab('pano'); fetchListings(); }}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'pano' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Durum Panosu
            </button>
            <button 
              onClick={() => { setActiveTab('eklenti'); fetchListings(); }}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'eklenti' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              🚀 Chrome Eklentisi
            </button>
            <button 
              onClick={() => { setActiveTab('mesaj'); fetchListings(); }}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'mesaj' ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              AI Mesajları
            </button>
            <button 
              onClick={() => { setActiveTab('whatsapp'); }}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'whatsapp' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              💬 WhatsApp CRM
            </button>
          </div>
          
          <button 
            onClick={fetchListings}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl transition-all border border-slate-800 cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Verileri Yenile
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 min-h-[600px] shadow-2xl backdrop-blur-xl">
          
          {/* PANO TAB */}
          {activeTab === 'pano' && (
            <div className="animate-in fade-in space-y-6">
              <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-amber-400" />
                    Çevrimdışı İlan Yükle (JSON)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Eklentiden indirdiğiniz <code className="text-amber-300 font-mono">jasmine_ilanlar.json</code> dosyasını buraya yükleyerek ilanları panoya ekleyebilirsiniz.</p>
                </div>
                <div>
                  <label className="cursor-pointer px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold rounded-xl transition-all inline-flex items-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20">
                    <Download className="w-4 h-4" />
                    JSON Dosyası Seç
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);
                          const res = await fetch('/api/fabrika/hunting/bulk-import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                          });
                          const result = await res.json();
                          if (result.success) {
                            alert(`Başarılı! ${result.added} yeni ilan panoya eklendi.`);
                            fetchListings();
                          } else {
                            alert(result.error || 'Yükleme başarısız oldu.');
                          }
                        } catch (err) {
                          alert('Dosya okunurken bir hata oluştu. Geçerli bir JSON olduğundan emin olun.');
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>

              <StatusBoard listings={allListings} onStatusChange={handleStatusChange} onDeleteListing={handleDeleteListing} />
            </div>
          )}

          {/* EKLENTI TAB */}
          {activeTab === 'eklenti' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in py-8">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-xl shadow-amber-500/10">
                  <Download className="w-10 h-10 text-amber-400" />
                </div>
                <h2 className="text-3xl font-extrabold text-white">Jasmine Group Avcı Eklentisi</h2>
                <p className="text-slate-400 text-sm max-w-2xl mx-auto font-medium leading-relaxed">
                  Sahibinden.com bot korumalarını (Cloudflare) aşarak gizli telefon numaralarını ve ilan detaylarını tek tıkla fabrikanıza çekin.
                </p>
                
                <div className="pt-4">
                  <a 
                    href="/downloads/jasmine-extension.zip" 
                    download
                    className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-2xl font-black transition-all shadow-xl shadow-amber-500/20 text-xs uppercase tracking-wider"
                  >
                    <Download className="w-4 h-4" />
                    Eklentiyi İndir (.ZIP)
                  </a>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 mt-12 shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Kurulum ve Kullanım Rehberi
                </h3>
                
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center font-bold text-amber-400 border border-slate-700 text-xs">1</div>
                    <div>
                      <h4 className="text-white font-bold text-sm">ZIP Dosyasını Çıkarın</h4>
                      <p className="text-slate-400 text-xs mt-1">İndirdiğiniz <code className="bg-slate-950 px-2 py-0.5 rounded text-amber-400 font-mono">jasmine-extension.zip</code> dosyasını bilgisayarınızda bir klasöre çıkartın.</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center font-bold text-amber-400 border border-slate-700 text-xs">2</div>
                    <div>
                      <h4 className="text-white font-bold text-sm">Chrome&apos;a Yükleyin</h4>
                      <p className="text-slate-400 text-xs mt-1">Google Chrome adres çubuğuna <code className="bg-slate-950 px-2 py-0.5 rounded text-amber-400 font-mono">chrome://extensions/</code> yazın. Geliştirici Modunu açıp çıkardığınız klasörü seçin.</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center font-bold text-amber-400 border border-slate-700 text-xs">3</div>
                    <div>
                      <h4 className="text-white font-bold text-sm">Sahibinden.com&apos;da Avlanın</h4>
                      <p className="text-slate-400 text-xs mt-1">İlan sayfasına girip <strong>&quot;Telefonu Göster&quot;</strong> butonuna basın. Eklentimizdeki <strong>&quot;İlanı Fabrikaya Gönder&quot;</strong> butonuna tıklayın.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MESAJLAR TAB */}
          {activeTab === 'mesaj' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-xl">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Yapay Zeka Mesaj Üretimi</h3>
                    <p className="text-xs text-slate-400">Panodaki <strong>Sarı (Pazarlıkta)</strong> olan ilanlara mesaj üretin.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <select 
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none font-medium"
                  >
                    <option value="samimi">Samimi Ton</option>
                    <option value="resmi">Resmi Ton</option>
                    <option value="acil">Acil Ton</option>
                  </select>
                  <button
                    onClick={handleGenerateBulkMessages}
                    disabled={isGeneratingMessages}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors border border-slate-700 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingMessages ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Üretiliyor...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 text-amber-400" /> Mesaj Üret</>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {yellowListings.map((listing, idx) => (
                  <div key={listing.id} className="relative bg-slate-950 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/30 transition-colors flex flex-col group">
                    <button
                      onClick={() => handleDeleteListing(listing.id)}
                      className="absolute top-4 right-4 p-1.5 bg-red-500/10 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                      title="İlanı Sil"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="flex items-center justify-between mb-3 pr-10">
                      <span className="text-[10px] font-bold px-2 py-1 bg-slate-800 text-slate-300 rounded-lg">İlan #{idx + 1}</span>
                      <span className="text-xs font-bold text-emerald-400">{listing.price}</span>
                    </div>
                    <h4 className="text-xs font-bold text-white mb-2 line-clamp-2 pr-6">{listing.title}</h4>
                    <div className="text-[11px] text-slate-400 space-y-1 mb-4 flex-1 font-medium">
                      <p>👤 {listing.ownerName || 'Bilinmiyor'}</p>
                      <p>📱 {listing.ownerPhone || 'No Yok'}</p>
                    </div>
                    
                    {listing.messages && listing.messages.length > 0 ? (
                      <div className="mt-auto space-y-3 pt-3 border-t border-slate-800">
                        <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                          <p className="text-xs text-slate-300 line-clamp-3 font-medium">{listing.messages[0].content}</p>
                        </div>
                        <div className="flex gap-2">
                          <WhatsAppButton 
                            phone={listing.ownerPhone} 
                            message={listing.messages[0].content} 
                            className="flex-1 justify-center text-xs"
                          />
                          <button 
                            onClick={() => fetchAndShowChat(listing.ownerPhone, listing.ownerName || 'Bilinmiyor')}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white transition-colors cursor-pointer text-xs"
                            title="WhatsApp Sohbetini Gör"
                          >
                            💬
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-auto pt-3 border-t border-slate-800 text-center">
                        <span className="text-[11px] text-slate-500">Henüz mesaj üretilmedi</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WHATSAPP TAB */}
          {activeTab === 'whatsapp' && (
            <WhatsAppCRM allListings={allListings} />
          )}

        </div>

      </div>

      {/* CHAT MODAL */}
      {chatModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  WhatsApp Live Stream
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{chattingWith}</p>
              </div>
              <button 
                onClick={() => setChatModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors text-xs font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh] min-h-[40vh] bg-slate-950">
              <div className="space-y-4">
                {chatHistory.length === 0 ? (
                  <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-slate-800">
                    <p className="text-xs text-slate-400">Henüz sohbet geçmişi yok veya yükleniyor...</p>
                  </div>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl p-3 text-xs ${msg.fromMe ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className="text-[10px] mt-1 text-right text-slate-400">
                          {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
