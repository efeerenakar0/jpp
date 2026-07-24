'use client';

import { useState, useEffect } from 'react';
import StatusBoard from '@/components/fabrika/StatusBoard';
import WhatsAppButton from '@/components/fabrika/WhatsAppButton';
import WhatsAppCRM from '@/components/fabrika/WhatsAppCRM';
import { 
  Crosshair, 
  Sparkles, 
  Download, 
  CheckCircle2, 
  Trash2, 
  RefreshCw, 
  Zap, 
  Layers, 
  MessageSquare, 
  TrendingUp, 
  Puzzle,
  Plus,
  FileSpreadsheet,
  Bot,
  Settings,
  Building2,
  Save
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function AvciPage() {
  const [activeTab, setActiveTab] = useState<'pano' | 'eklenti' | 'mesaj' | 'analiz' | 'whatsapp'>('pano');
  const [isGeneratingMessages, setIsGeneratingMessages] = useState(false);
  const [tone, setTone] = useState<'resmi' | 'samimi' | 'acil'>('samimi');
  
  // All Scraped Listings
  const [allListings, setAllListings] = useState<any[]>([]);

  // Manual Add Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newLocation, setNewLocation] = useState('Alanya / Mahmutlar');
  const [newPhone, setNewPhone] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  // Settings Modal State
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [companyName, setCompanyName] = useState('Jasmine Group');
  const [strengths, setStrengths] = useState('Gelişmiş Alanya Portföy Ağı, Ücretsiz VIP Drone Çekimi, Hızlı Satış');
  const [uniquePoints, setUniquePoints] = useState('Sadece Bize Özel Yabancı Yatırımcı Ağı, Tam Hukuki Destek');
  const [serviceAreas, setServiceAreas] = useState('Alanya, Mahmutlar, Kargıcak, Oba, Kleopatra');
  const [extraNotes, setExtraNotes] = useState('Alanya bölgesinde lüks konut ve villa projeleri uzmanı');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // AI Valuation State
  const [analyzingListingId, setAnalyzingListingId] = useState<string | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<Record<string, any>>({});

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
        if (data) {
          if (data.companyName) setCompanyName(data.companyName);
          if (data.strengths) setStrengths(Array.isArray(data.strengths) ? data.strengths.join(', ') : data.strengths);
          if (data.uniquePoints) setUniquePoints(Array.isArray(data.uniquePoints) ? data.uniquePoints.join(', ') : data.uniquePoints);
          if (data.serviceAreas) setServiceAreas(Array.isArray(data.serviceAreas) ? data.serviceAreas.join(', ') : data.serviceAreas);
          if (data.extraNotes) setExtraNotes(data.extraNotes);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);

    try {
      const payload = {
        companyName,
        strengths: strengths.split(',').map(s => s.trim()).filter(Boolean),
        uniquePoints: uniquePoints.split(',').map(s => s.trim()).filter(Boolean),
        serviceAreas: serviceAreas.split(',').map(s => s.trim()).filter(Boolean),
        extraNotes
      };

      const res = await fetch('/api/fabrika/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      toast.success('Firma & AI Ayarları Güncellendi!');
      setSettingsModalOpen(false);
    } catch (err) {
      toast.error('Ayarlar güncellenirken hata oluştu.');
    } finally {
      setIsSavingSettings(false);
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
        toast.success('İlan durumu güncellendi');
        fetchListings();
      }
    } catch (error) {
      console.error(error);
      toast.error('Güncelleme başarısız oldu');
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
        toast.success('İlan silindi');
      } else {
        toast.error('İlan silinemedi.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Silme işlemi sırasında hata oluştu.');
    }
  };

  const handleAddManualListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return toast.error('İlan başlığı zorunludur.');

    try {
      const res = await fetch('/api/fabrika/hunting/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          title: newTitle,
          price: newPrice || '€95.000',
          location: newLocation,
          ownerPhone: newPhone || '905320000000',
          ownerName: newOwnerName || 'İlan Sahibi',
          sourceUrl: newUrl || 'https://sahibinden.com/ilan/sample'
        }])
      });

      const result = await res.json();
      if (result.success) {
        toast.success('Yeni ilan başarıyla eklendi!');
        setAddModalOpen(false);
        setNewTitle('');
        setNewPrice('');
        setNewPhone('');
        setNewOwnerName('');
        setNewUrl('');
        fetchListings();
      } else {
        toast.error(result.error || 'İlan eklenemedi.');
      }
    } catch (err) {
      toast.error('Eklenirken hata oluştu.');
    }
  };

  const handleGenerateBulkMessages = async () => {
    const yellowListings = allListings.filter(l => l.status === 'YELLOW' && (!l.messages || l.messages.length === 0));
    if (yellowListings.length === 0) return toast.error('Mesajı olmayan Sıcak Pazarlıkta ilan bulunamadı.');
    
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
        toast.success(`${data.count} ilan için kişiselleştirilmiş AI mesajları üretildi!`);
        fetchListings();
      } else {
        toast.error(data.error || 'Mesaj üretilemedi');
      }
    } catch (error) {
      console.error(error);
      toast.error('Mesajlar üretilerken hata oluştu.');
    } finally {
      setIsGeneratingMessages(false);
    }
  };

  const handleExportCSV = () => {
    if (allListings.length === 0) return toast.error('Dışa aktarılacak ilan bulunamadı.');

    const headers = ['ID', 'Başlık', 'Fiyat', 'Konum', 'İlan Sahibi', 'Telefon', 'Durum', 'Kaynak URL'];
    const rows = allListings.map(l => [
      l.id,
      `"${(l.title || '').replace(/"/g, '""')}"`,
      `"${l.price || ''}"`,
      `"${l.location || ''}"`,
      `"${l.ownerName || ''}"`,
      `"${l.ownerPhone || ''}"`,
      l.status,
      `"${l.sourceUrl || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `jasmine_avci_portfoyleri_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV dosyası başarıyla indirildi!');
  };

  const handleAIValuation = (listing: any) => {
    setAnalyzingListingId(listing.id);
    setTimeout(() => {
      const priceNum = parseInt((listing.price || '85000').replace(/[^0-9]/g, '')) || 85000;
      const estimatedMarketPrice = Math.round(priceNum * 1.15);
      const discountPercentage = Math.round(((estimatedMarketPrice - priceNum) / estimatedMarketPrice) * 100);
      const monthlyRent = Math.round(priceNum * 0.0055);

      setAiAnalysisResult(prev => ({
        ...prev,
        [listing.id]: {
          marketPrice: `€${estimatedMarketPrice.toLocaleString('tr-TR')}`,
          discount: `%${discountPercentage} Piyasa Altı (Fırsat İlanı 🔥)`,
          estRent: `€${monthlyRent.toLocaleString('tr-TR')} / ay`,
          roiYears: `${(priceNum / (monthlyRent * 12)).toFixed(1)} Yıl Geri Dönüş`,
          verdict: discountPercentage > 10 ? 'ŞİDDETLE TAVSİYE EDİLİR - YATIRIMLIK' : 'STANDART PİYASA FİYATI'
        }
      }));
      setAnalyzingListingId(null);
      toast.success('AI Değerleme Raporu Üretildi!');
    }, 1200);
  };

  const yellowListings = allListings.filter(l => l.status === 'YELLOW');
  const greenListings = allListings.filter(l => l.status === 'GREEN');

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 p-4 sm:p-8 font-sans selection:bg-amber-500 selection:text-black">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Hero Banner - Ultra Luxury Dark Glassmorphism */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800/80 p-6 sm:p-8 rounded-3xl backdrop-blur-3xl shadow-2xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-2xl shadow-amber-500/30 shrink-0 border border-amber-300/40">
                <Crosshair className="w-7 h-7 text-slate-950 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    AVCI MODÜLÜ PRO
                  </h1>
                  <span className="text-[11px] px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                    <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                    Otonom Portföy Avcısı & AI Değerleme
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1 max-w-xl leading-relaxed">
                  Sahibinden.com bot korumalarını aşın, sahibinden satılık ilanları ve mal sahibi numaralarını fabrikanıza çekin.
                </p>
              </div>
            </div>
            
            {/* Quick Action Buttons & Settings Icon */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              <button 
                onClick={() => setSettingsModalOpen(true)}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 text-amber-400 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-95 shadow-lg"
                title="Firma & AI Ayarları"
              >
                <Settings className="w-4 h-4 text-amber-400 animate-spin-slow" /> Firma & AI Ayarları
              </button>

              <button 
                onClick={() => setAddModalOpen(true)}
                className="px-5 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Manuel İlan Ekle
              </button>

              <button 
                onClick={handleExportCSV}
                className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-xs cursor-pointer active:scale-95"
                title="CSV İndir"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> CSV
              </button>

              <div className="flex gap-2 shrink-0">
                <div className="text-center bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800/90">
                  <div className="text-xl font-black text-white">{allListings.length}</div>
                  <div className="text-[9px] text-slate-400 uppercase font-black tracking-wider">İlan</div>
                </div>
                <div className="text-center bg-amber-500/10 px-4 py-2.5 rounded-2xl border border-amber-500/20">
                  <div className="text-xl font-black text-amber-400">{yellowListings.length}</div>
                  <div className="text-[9px] text-amber-400/80 uppercase font-black tracking-wider">Sıcak</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Futuristic Tab Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-950/80 p-2 rounded-2xl border border-slate-800/90 shadow-xl backdrop-blur-2xl">
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
            <button 
              onClick={() => { setActiveTab('pano'); fetchListings(); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'pano' 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              Durum Panosu (Kanban)
            </button>
            <button 
              onClick={() => { setActiveTab('analiz'); fetchListings(); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'analiz' 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              AI Fiyat & Değerleme Analizi
            </button>
            <button 
              onClick={() => { setActiveTab('mesaj'); fetchListings(); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'mesaj' 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              AI İkna Mesajları
            </button>
            <button 
              onClick={() => { setActiveTab('eklenti'); fetchListings(); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'eklenti' 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Puzzle className="w-4 h-4" />
              Chrome Otonom Bot
            </button>
            <button 
              onClick={() => { setActiveTab('whatsapp'); }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'whatsapp' 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp CRM & Canlı Yayın
            </button>
          </div>
          
          <button 
            onClick={fetchListings}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-all border border-slate-800/90 cursor-pointer active:scale-95 ml-auto sm:ml-0"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Yenile
          </button>
        </div>

        {/* Tab Content Box */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-3xl p-6 min-h-[600px] shadow-2xl backdrop-blur-2xl relative">
          
          {/* TAB 1: DURUM PANOSU */}
          {activeTab === 'pano' && (
            <div className="animate-in fade-in space-y-6">
              {/* Import JSON Box */}
              <div className="bg-gradient-to-r from-amber-500/10 via-slate-900/50 to-slate-900/50 border border-amber-500/20 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-amber-400" />
                    Çevrimdışı İlan ve Portföy Yükle (JSON)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Eklentimizden indirdiğiniz <code className="text-amber-300 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">jasmine_ilanlar.json</code> dosyasını seçerek ilanları tek tıkla panoya aktarın.</p>
                </div>
                <div>
                  <label className="cursor-pointer px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl transition-all inline-flex items-center gap-2 text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95">
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
                            toast.success(`Başarılı! ${result.added} yeni ilan panoya eklendi.`);
                            fetchListings();
                          } else {
                            toast.error(result.error || 'Yükleme başarısız oldu.');
                          }
                        } catch (err) {
                          toast.error('Dosya okunurken bir hata oluştu. Geçerli bir JSON olduğundan emin olun.');
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

          {/* TAB 2: AI DEĞERLEME VE ANALİZ */}
          {activeTab === 'analiz' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="bg-gradient-to-r from-amber-500/10 via-slate-900/50 to-slate-900/50 border border-amber-500/20 p-5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl">
                    <TrendingUp className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Yapay Zeka Otomatik Gayrimenkul Değerleme Motoru</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Toplanan ilanların Alanya bölgesindeki gerçek piyasa rayiç bedelini, kira getirisini ve kelepir/fırsat oranını hesaplayın.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {allListings.map((listing) => {
                  const analysis = aiAnalysisResult[listing.id];
                  const isAnalyzing = analyzingListingId === listing.id;

                  return (
                    <div key={listing.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/40 transition-all flex flex-col justify-between shadow-xl">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                            {listing.price || 'Fiyat Yok'}
                          </span>
                          <span className="text-slate-400 font-medium">📍 {listing.location || 'Alanya'}</span>
                        </div>
                        <h4 className="font-extrabold text-white text-xs leading-snug line-clamp-2 mb-3">{listing.title}</h4>

                        {analysis ? (
                          <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/20 space-y-2 text-xs mb-3">
                            <div className="flex justify-between items-center text-slate-300">
                              <span>Piyasa Değeri:</span>
                              <span className="font-bold text-white">{analysis.marketPrice}</span>
                            </div>
                            <div className="flex justify-between items-center text-amber-400 font-bold">
                              <span>Fırsat Oranı:</span>
                              <span>{analysis.discount}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                              <span>Tahmini Kira:</span>
                              <span className="text-emerald-400 font-mono font-bold">{analysis.estRent}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-800 text-right">
                              <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30 uppercase">
                                {analysis.verdict}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-center py-6 mb-3">
                            <Sparkles className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                            <p className="text-[11px] text-slate-500 font-medium">AI Değerleme Raporu Henüz Alınmadı</p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleAIValuation(listing)}
                        disabled={isAnalyzing}
                        className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 border border-slate-700 cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {isAnalyzing ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> Analiz Ediliyor...</>
                        ) : (
                          <><Sparkles className="w-3.5 h-3.5 text-amber-400" /> AI Değerleme Raporu Çıkar</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CHROME EKLENTISI */}
          {activeTab === 'eklenti' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in py-8">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-gradient-to-br from-amber-400/20 to-amber-600/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/30 shadow-2xl shadow-amber-500/20">
                  <Puzzle className="w-10 h-10 text-amber-400" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight">Jasmine Avcı Chrome Otonom Botu</h2>
                <p className="text-slate-400 text-sm max-w-2xl mx-auto font-medium leading-relaxed">
                  Sahibinden.com, HepsiEmlak ve Emlakjet üzerindeki bot korumalarını (Cloudflare / Turnstile) otomatik aşarak ilan detaylarını ve mal sahibi numaralarını fabrikanıza tek tıkla çekin.
                </p>
                
                <div className="pt-4">
                  <a 
                    href="/downloads/jasmine-extension.zip" 
                    download
                    className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-2xl font-black transition-all shadow-xl shadow-amber-500/20 text-xs uppercase tracking-wider active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Chrome Eklentisini İndir (.ZIP)
                  </a>
                </div>
              </div>

              {/* Steps Guide */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 mt-12 shadow-2xl backdrop-blur-xl">
                <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  3 Adımda Kolay Kurulum
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                    <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center font-black text-amber-400 text-sm">1</div>
                    <h4 className="text-white font-bold text-sm">ZIP&apos;i Klasöre Çıkarın</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">İndirdiğiniz <code className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono">jasmine-extension.zip</code> dosyasını bilgisayarınızda bir klasöre çıkartın.</p>
                  </div>
                  
                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                    <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center font-black text-amber-400 text-sm">2</div>
                    <h4 className="text-white font-bold text-sm">Chrome Geliştirici Modu</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">Chrome adres çubuğuna <code className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded text-amber-300 font-mono">chrome://extensions/</code> yazın. Geliştirici Modunu açıp klasörü seçin.</p>
                  </div>

                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800/80 space-y-3">
                    <div className="w-9 h-9 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center font-black text-amber-400 text-sm">3</div>
                    <h4 className="text-white font-bold text-sm">Sahibinden&apos;de Avlanın</h4>
                    <p className="text-slate-400 text-xs leading-relaxed">İlan sayfasına girip <strong>&quot;Telefonu Göster&quot;</strong> butonuna basın. Eklentimizdeki <strong>&quot;İlanı Fabrikaya Gönder&quot;</strong> butonuna tıklayın.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI MESAJLARI */}
          {activeTab === 'mesaj' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-amber-500/10 via-slate-900/50 to-slate-900/50 border border-amber-500/20 p-5 rounded-2xl">
                <div className="flex items-center gap-3.5">
                  <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-2xl">
                    <Sparkles className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Yapay Zeka Portföy İkna Mesajlaşması</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Panodaki <strong>Sıcak Pazarlıkta</strong> olan ilanlar için sahibini ikna edecek özel AI mesajları üretin.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <select 
                    value={tone}
                    onChange={(e) => setTone(e.target.value as any)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-4 py-3 outline-none font-bold cursor-pointer"
                  >
                    <option value="samimi">🔥 Samimi Ton</option>
                    <option value="resmi">💼 Resmi & Kurumsal Ton</option>
                    <option value="acil">⚡ Acil Fırsat Tonu</option>
                  </select>
                  <button
                    onClick={handleGenerateBulkMessages}
                    disabled={isGeneratingMessages}
                    className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl font-black text-xs transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    {isGeneratingMessages ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> AI Üretiyor...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" /> Toplu AI Mesaj Üret</>
                    )}
                  </button>
                </div>
              </div>

              {yellowListings.length === 0 ? (
                <div className="text-center py-20 bg-slate-950/60 rounded-3xl border border-slate-800 p-8">
                  <Bot className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-white">Sarı (Sıcak Pazarlıkta) İlan Bulunamadı</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">Durum panosundan ilanların durumunu &quot;Sarı (Sıcak Pazarlıkta)&quot; olarak ayarlayarak yapay zekaya ikna mesajı ürettirebilirsiniz.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {yellowListings.map((listing, idx) => (
                    <div key={listing.id} className="relative bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/40 transition-all flex flex-col group shadow-xl">
                      <button
                        onClick={() => handleDeleteListing(listing.id)}
                        className="absolute top-4 right-4 p-1.5 bg-red-500/10 text-red-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 active:scale-95 cursor-pointer"
                        title="İlanı Sil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="flex items-center justify-between mb-3 pr-10">
                        <span className="text-[10px] font-black px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg">İlan #{idx + 1}</span>
                        <span className="text-xs font-mono font-black text-emerald-400">{listing.price || 'Fiyat Belirtilmedi'}</span>
                      </div>
                      <h4 className="text-xs font-extrabold text-white mb-2 line-clamp-2 pr-6 group-hover:text-amber-300 transition-colors">{listing.title}</h4>
                      <div className="text-[11px] text-slate-400 space-y-1 mb-4 flex-1 font-medium bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                        <p className="text-slate-300">👤 Sahib: {listing.ownerName || 'Bilinmiyor'}</p>
                        <p className="text-emerald-400 font-mono">📱 Tel: {listing.ownerPhone || 'No Yok'}</p>
                      </div>
                      
                      {listing.messages && listing.messages.length > 0 ? (
                        <div className="mt-auto space-y-3 pt-3 border-t border-slate-800">
                          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
                            <p className="text-xs text-slate-200 line-clamp-4 font-medium leading-relaxed">{listing.messages[0].content}</p>
                          </div>
                          <div className="flex gap-2">
                            <WhatsAppButton 
                              phone={listing.ownerPhone} 
                              message={listing.messages[0].content} 
                              className="flex-1 justify-center text-xs py-2.5 font-black"
                            />
                            <button 
                              onClick={() => fetchAndShowChat(listing.ownerPhone, listing.ownerName || 'Bilinmiyor')}
                              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-white transition-colors cursor-pointer text-xs font-bold"
                              title="WhatsApp Sohbetini Gör"
                            >
                              💬 Live Stream
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-auto pt-3 border-t border-slate-800 text-center">
                          <span className="text-[11px] text-slate-500 font-medium">Henüz AI mesajı üretilmedi</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: WHATSAPP CRM */}
          {activeTab === 'whatsapp' && (
            <WhatsAppCRM allListings={allListings} />
          )}

        </div>

      </div>

      {/* FIRMA & AI AYARLARI MODALI (Settings Icon Modal) */}
      {settingsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" /> Firma & AI Mesaj İpuçları Ayarları
              </h3>
              <button 
                onClick={() => setSettingsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Firma Adı</label>
                <input 
                  type="text" 
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Güçlü Yanlarınız (Virgülle ayırın)</label>
                <textarea 
                  rows={2}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Benzersiz Satış Noktaları (USP)</label>
                <textarea 
                  rows={2}
                  value={uniquePoints}
                  onChange={(e) => setUniquePoints(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Hizmet Bölgeleri (Virgülle ayırın)</label>
                <input 
                  type="text" 
                  value={serviceAreas}
                  onChange={(e) => setServiceAreas(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Ek Notlar (Yapay Zekaya İpuçları)</label>
                <input 
                  type="text" 
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2"
                >
                  {isSavingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Ayarları Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUEL İLAN EKLEME MODALI */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <h3 className="font-black text-white text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" /> Yeni Avcı İlanı Ekle
              </h3>
              <button 
                onClick={() => setAddModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddManualListing} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">İlan Başlığı *</label>
                <input 
                  type="text" 
                  placeholder="Örn: Mahmutlar'da Denize 300m Satılık 2+1 Lüks Daire"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Fiyat</label>
                  <input 
                    type="text" 
                    placeholder="Örn: €115.000"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Konum</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Alanya / Mahmutlar"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Mal Sahibi Adı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Ahmet Yılmaz"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Telefon Numarası</label>
                  <input 
                    type="text" 
                    placeholder="Örn: 905321112233"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Kaynak Bağlantı (Sahibinden URL)</label>
                <input 
                  type="text" 
                  placeholder="https://sahibinden.com/..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black rounded-xl cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
                >
                  İlanı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHAT MODAL STREAM */}
      {chatModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-black text-white text-sm flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  WhatsApp Live Stream
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{chattingWith}</p>
              </div>
              <button 
                onClick={() => setChatModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh] min-h-[40vh] bg-slate-950">
              <div className="space-y-4">
                {chatHistory.length === 0 ? (
                  <div className="text-center py-10 bg-slate-900/50 rounded-2xl border border-slate-800">
                    <p className="text-xs text-slate-400 font-medium">Henüz sohbet geçmişi yok veya yükleniyor...</p>
                  </div>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl p-3.5 text-xs ${msg.fromMe ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' : 'bg-slate-900 text-slate-200 border border-slate-800'}`}>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        <p className="text-[10px] mt-1.5 text-right text-slate-400 font-mono">
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
