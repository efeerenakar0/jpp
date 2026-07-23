'use client';

import { useState, useRef } from 'react';
import { 
  Aperture, 
  UploadCloud, 
  Smartphone, 
  Camera, 
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  Download,
  Sparkles,
  Globe,
  Tag,
  ShieldCheck,
  Check,
  Layers,
  ArrowRight,
  RefreshCw,
  Eye,
  Sliders,
  Palette,
  Wand2,
  MonitorCheck
} from 'lucide-react';
import toast from 'react-hot-toast';

type Step = 'DEVICE_SELECTION' | 'UPLOAD' | 'PROCESSING' | 'RESULTS';

const DEVICES = [
  { id: 'iphone_15_pro', name: 'iPhone 15 / 16 Pro', icon: Smartphone, desc: 'LiDAR Sensör & 48MP Photonic Engine Optimizasyonu', tag: 'Önerilen Cihaz' },
  { id: 'iphone_14_pro', name: 'iPhone 14 Pro Max', icon: Smartphone, desc: 'Apple ProRAW & Geniş Açı Lens Dengeleme', tag: 'Popüler Model' },
  { id: 'samsung_s', name: 'Samsung Galaxy S Serisi', icon: Smartphone, desc: 'Canlı Renk ve Dynamic HDR Tonlama', tag: 'HDR Pro' },
  { id: 'dslr', name: 'Profesyonel Kamera (DSLR/Aynasız)', icon: Camera, desc: 'Ham Sensör Verisi & Lens Distorsiyon Kalibrasyonu', tag: 'Stüdyo RAW' },
];

const FILTERS = [
  { id: 'f1', name: 'Ferah Gün Işığı', desc: 'İç mekanları ferah, geniş ve aydınlık gösteren standart kurumsal emlak tonu.', color: 'from-blue-400 to-cyan-500', tag: 'Kurumsal Favori' },
  { id: 'f2', name: 'Lüks & Sıcak Atmosfer', desc: 'Akşamüstü sıcak ışığı efekti ile villaya lüks ve çekici bir hava katar.', color: 'from-amber-400 to-orange-500', tag: 'Lüks Villa' },
  { id: 'f3', name: 'Canlı & Doygun Renkler', desc: 'Özellikle havuz, bahçe ve Toros/deniz manzaralarını patlatan canlı tonlar.', color: 'from-emerald-400 to-teal-500', tag: 'Manzara & Havuz' },
  { id: 'f4', name: 'HDR Sinematik', desc: 'Kontrastın keskin olduğu, mimarlık dergisi tarzı derin sinematik ton.', color: 'from-purple-400 to-pink-500', tag: 'Mimari Dergi' },
];

const PRESET_COLORS = [
  { id: 'white', name: 'Sade Beyaz', hex: '#ffffff' },
  { id: 'cyan', name: 'Turkuaz Neon', hex: '#00f2fe' },
  { id: 'emerald', name: 'Zümrüt Yeşil', hex: '#10b981' },
  { id: 'gold', name: 'Altın Sarı', hex: '#f59e0b' },
  { id: 'coral', name: 'Mercan', hex: '#ff6b6b' },
  { id: 'purple', name: 'Mor', hex: '#a855f7' },
];

export default function StudioPage() {
  const [step, setStep] = useState<Step>('DEVICE_SELECTION');
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [textColor, setTextColor] = useState<string>('#ffffff');
  const [isUploading, setIsUploading] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [packages, setPackages] = useState<any[]>([]);
  const [hasWatermark, setHasWatermark] = useState<boolean>(false);
  const [currentProcessText, setCurrentProcessText] = useState('Fotoğraflar analiz ediliyor...');
  const [currentShootId, setCurrentShootId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleDeviceSelect = (id: string) => {
    setSelectedDevice(id);
    setStep('UPLOAD');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (droppedFiles.length > 0) {
        setFiles(prev => [...prev, ...droppedFiles]);
      } else {
        toast.error('Lütfen sadece fotoğraf dosyaları yükleyin.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        return toast.error('Lütfen geçerli bir logo resmi (PNG/JPG) yükleyin.');
      }
      setLogoFile(file);
      toast.success('Şirket logosu seçildi!');
    }
  };

  const handleStartProcessing = async () => {
    if (files.length === 0) return toast.error('Lütfen en az bir fotoğraf yükleyin.');

    const deviceToUse = selectedDevice || 'iphone_15_pro';
    setStep('PROCESSING');
    setIsUploading(true);
    setProcessProgress(5);
    setCurrentProcessText('Asistan kısmındaki Gemini Yapay Zeka API anahtarı doğrulanıyor...');

    try {
      // 1. Upload photos & branding to server
      const formData = new FormData();
      formData.append('device', deviceToUse);
      formData.append('fileCount', files.length.toString());
      formData.append('textColor', textColor);
      if (websiteUrl.trim()) formData.append('websiteUrl', websiteUrl.trim());
      if (logoFile) formData.append('logo', logoFile);
      
      files.forEach((f) => formData.append('photos', f));

      const uploadRes = await fetch('/api/fabrika/studio/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || 'Yükleme hatası');

      setCurrentShootId(uploadData.shootId);
      setProcessProgress(25);
      setCurrentProcessText('Gemini Görsel Yapay Zekası geniş açı ve ışık analizini tamamlıyor...');

      // 2. Process (UI Progress animation)
      const texts = [
        'Kamera sensör verisi okunuyor...',
        'Geniş açı bozulmaları (distorsiyon) düzeltiliyor...',
        'Karanlık köşeler (gölgeler) aydınlatılıyor ve HDR tone-mapping uygulanıyor...',
        'Pencereden patlayan ışıklar dengeleniyor...',
        (logoFile || websiteUrl) ? 'Sol alt köşeye şirket logosu (PNG) ve web sitesi filigranı ekleniyor...' : 'Filtre paketleri oluşturuluyor...',
        'Stüdyo kalitesinde 4K ZIP paketleri hazırlanıyor...'
      ];

      for (let i = 30; i <= 85; i += 5) {
        setProcessProgress(i);
        const idx = Math.min(Math.floor((i - 30) / 10), texts.length - 1);
        setCurrentProcessText(texts[idx]);
        await new Promise(r => setTimeout(r, 80));
      }

      // Call Process API (which uses WhatsAppConfig Gemini API and Sharp on actual uploaded photos)
      const processRes = await fetch('/api/fabrika/studio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shootId: uploadData.shootId }),
      });
      const processData = await processRes.json();
      if (!processRes.ok) throw new Error(processData.error || 'İşleme hatası');

      setPackages(processData.packages || []);
      setHasWatermark(processData.hasWatermark || false);
      setProcessProgress(100);
      setIsUploading(false);
      setStep('RESULTS');
      toast.success('Fotoğraflarınız Gemini AI stüdyo kalitesine yükseltildi!');
    } catch (err: any) {
      console.error('Studio Processing Error:', err);
      toast.error(err.message || 'Fotoğraflar işlenirken bir hata oluştu');
      setIsUploading(false);
      setStep('UPLOAD');
    }
  };

  const resetStudio = () => {
    setStep('DEVICE_SELECTION');
    setSelectedDevice('');
    setFiles([]);
    setLogoFile(null);
    setWebsiteUrl('');
    setProcessProgress(0);
    setCurrentShootId('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-teal-500 selection:text-white relative overflow-x-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Banner */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center shadow-xl shadow-teal-500/25">
                  <Aperture className="w-6 h-6 text-slate-950 stroke-[2.5]" />
                </div>
                <div>
                  <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
                    Dijital Fotoğraf Stüdyosu & AI Filigran
                    <span className="text-xs font-normal px-2.5 py-0.5 bg-teal-500/10 border border-teal-500/20 text-teal-300 rounded-full font-bold">
                      4K Ultra HD Engine
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400">Ham ev fotoğraflarını profesyonel stüdyo çekimine dönüştürün</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold shadow-inner">
                <Sparkles className="w-4 h-4 text-teal-400" />
                <span>Gemini Vision AI & Sharp Entegre</span>
              </div>
              {step !== 'DEVICE_SELECTION' && (
                <button
                  onClick={resetStudio}
                  className="flex items-center gap-1.5 text-xs font-bold bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 px-4 py-2 rounded-xl border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Yeni İşlem
                </button>
              )}
            </div>
          </div>

          {/* Dynamic 4-Step Stepper Header */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4 mt-6 pt-4 border-t border-slate-800/80">
            <div className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
              step === 'DEVICE_SELECTION' ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-lg shadow-teal-500/10' : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
            }`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold ${
                step === 'DEVICE_SELECTION' ? 'bg-teal-400 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-400'
              }`}>1</div>
              <span className="text-xs font-bold hidden sm:inline">Cihaz Seçimi</span>
            </div>

            <div className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
              step === 'UPLOAD' ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-lg shadow-teal-500/10' : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
            }`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold ${
                step === 'UPLOAD' ? 'bg-teal-400 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-400'
              }`}>2</div>
              <span className="text-xs font-bold hidden sm:inline">Fotoğraf & Logo</span>
            </div>

            <div className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
              step === 'PROCESSING' ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-lg shadow-teal-500/10' : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
            }`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold ${
                step === 'PROCESSING' ? 'bg-teal-400 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-400'
              }`}>3</div>
              <span className="text-xs font-bold hidden sm:inline">AI Kalibrasyonu</span>
            </div>

            <div className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all ${
              step === 'RESULTS' ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-lg shadow-teal-500/10' : 'bg-slate-900/60 border-slate-800/80 text-slate-500'
            }`}>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-extrabold ${
                step === 'RESULTS' ? 'bg-teal-400 text-slate-950 shadow-md' : 'bg-slate-800 text-slate-400'
              }`}>4</div>
              <span className="text-xs font-bold hidden sm:inline">4K İndirme</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* STEP 1: DEVICE SELECTION */}
        {step === 'DEVICE_SELECTION' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl font-extrabold text-white mb-2">Çekim Yaptığınız Cihazı Seçin</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Yapay Zeka sensör eğrisini ve lens distorsiyon kalibrasyonunu seçtiğiniz kameranın donanım profiline göre otomatik ayarlar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {DEVICES.map(device => {
                const IconComponent = device.icon;
                return (
                  <button
                    key={device.id}
                    onClick={() => handleDeviceSelect(device.id)}
                    className="group relative overflow-hidden bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-teal-500/50 rounded-3xl p-6 text-left transition-all hover:shadow-2xl hover:shadow-teal-500/10 cursor-pointer active:scale-98"
                  >
                    <div className="absolute top-0 right-0 w-36 h-36 bg-gradient-to-br from-teal-500/10 to-cyan-500/10 rounded-bl-full group-hover:scale-110 transition-transform pointer-events-none" />
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3.5 bg-slate-950 text-teal-400 rounded-2xl border border-slate-800 group-hover:bg-teal-400 group-hover:text-slate-950 transition-all shadow-md">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <span className="text-[10px] font-extrabold px-3 py-1 bg-teal-500/10 text-teal-300 border border-teal-500/20 rounded-full">
                        {device.tag}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1 group-hover:text-teal-300 transition-colors">
                      {device.name}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      {device.desc}
                    </p>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-teal-400">
                      <span>Bu Cihaz İle Devam Et</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: UPLOAD & BRANDING */}
        {step === 'UPLOAD' && (
          <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-300">
            {/* PHOTO UPLOAD DROPZONE */}
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-800 hover:border-teal-500/50 bg-slate-900/60 rounded-3xl p-10 text-center transition-all cursor-pointer group hover:bg-slate-900/90 shadow-xl"
            >
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />

              <div className="w-16 h-16 bg-slate-950 text-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-800 group-hover:scale-110 transition-transform shadow-md">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Evin Ham Fotoğraflarını Yükleyin</h3>
              <p className="text-xs text-slate-400 mb-4">Sürükleyip bırakın veya seçmek için tıklayın (JPEG, PNG, HEIC)</p>

              {files.length > 0 && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-xs font-bold">
                  <ImageIcon className="w-4 h-4" />
                  {files.length} Adet Ev Fotoğrafı Seçildi
                </div>
              )}
            </div>

            {/* BRANDING & WATERMARK CONTROL CENTER */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
              <div className="flex items-center gap-2 text-white font-bold border-b border-slate-800/80 pb-3">
                <Tag className="w-5 h-5 text-teal-400" />
                <h3>Logo & Web Sitesi Filigranı Özelleştirme</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Logo Upload */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Şirket Logosu (PNG / Saydam Logo)
                  </label>
                  <input 
                    type="file" 
                    accept="image/png, image/jpeg, image/webp" 
                    className="hidden" 
                    ref={logoInputRef}
                    onChange={handleLogoSelect}
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="w-full flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl hover:border-teal-500/50 text-xs text-slate-300 transition-all cursor-pointer"
                  >
                    <span className="truncate">
                      {logoFile ? `Logo: ${logoFile.name}` : 'Logo Yüklemek İçin Tıklayın (.png)'}
                    </span>
                    {logoFile ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <UploadCloud className="w-4 h-4 text-slate-500 shrink-0" />}
                  </button>
                </div>

                {/* Website Address Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Web Sitesi Adresi
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                    <input 
                      type="text"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="www.jasminegroup.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>
              </div>

              {/* Text Color Selector */}
              <div className="pt-3 border-t border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Web Sitesi Yazı Rengi Seçimi
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setTextColor(c.hex)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        textColor.toLowerCase() === c.hex.toLowerCase() 
                          ? 'border-teal-400 bg-teal-500/20 text-white shadow-md' 
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: c.hex }} />
                      {c.name}
                    </button>
                  ))}

                  {/* HTML5 Custom Color Picker */}
                  <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
                    <input 
                      type="color" 
                      value={textColor} 
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-transparent border border-slate-700 cursor-pointer overflow-hidden"
                      title="Özel Renk Seç"
                    />
                    <span className="text-xs text-teal-400 font-mono uppercase font-bold">{textColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleStartProcessing}
                disabled={files.length === 0}
                className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-extrabold rounded-2xl shadow-xl shadow-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-95 text-sm"
              >
                <Sparkles className="w-5 h-5" /> Profesyonel Yapay Zeka İşlemini Başlat
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PROCESSING */}
        {step === 'PROCESSING' && (
          <div className="max-w-xl mx-auto text-center py-12 space-y-8 animate-in fade-in duration-300">
            {/* Animated Progress Ring */}
            <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800 animate-pulse" />
              <div className="w-32 h-32 rounded-full border-4 border-t-teal-400 border-r-cyan-400 border-b-transparent border-l-transparent animate-spin" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-white">{processProgress}%</span>
                <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">İşleniyor</span>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-2">Yapay Zeka Stüdyo İşlemi Devam Ediyor</h3>
              <p className="text-xs text-teal-400 font-mono bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl inline-block">
                {currentProcessText}
              </p>
            </div>

            {/* Checklist Monitor */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-left space-y-3 shadow-xl">
              <div className="flex items-center gap-3 text-xs font-semibold">
                <CheckCircle2 className={`w-4 h-4 ${processProgress >= 25 ? 'text-teal-400' : 'text-slate-700'}`} />
                <span className={processProgress >= 25 ? 'text-white' : 'text-slate-500'}>
                  Kamera Sensör Verisi & Lens Distorsiyon Kalibrasyonu
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <CheckCircle2 className={`w-4 h-4 ${processProgress >= 50 ? 'text-teal-400' : 'text-slate-700'}`} />
                <span className={processProgress >= 50 ? 'text-white' : 'text-slate-500'}>
                  Gölge Aydınlatma & Pencere Işığı Dengeleme (HDR Tone-Mapping)
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <CheckCircle2 className={`w-4 h-4 ${processProgress >= 75 ? 'text-teal-400' : 'text-slate-700'}`} />
                <span className={processProgress >= 75 ? 'text-white' : 'text-slate-500'}>
                  Sol Alt Köşeye PNG Logo & Web Sitesi Yerleşimi
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-semibold">
                <CheckCircle2 className={`w-4 h-4 ${processProgress >= 95 ? 'text-teal-400' : 'text-slate-700'}`} />
                <span className={processProgress >= 95 ? 'text-white' : 'text-slate-500'}>
                  4K Çözünürlükte Kurumsal Paket ZIP Arşivi Oluşturuluyor
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: RESULTS & DOWNLOAD GALLERY */}
        {step === 'RESULTS' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-teal-500/25">
                <Check className="w-8 h-8 text-slate-950 stroke-[3]" />
              </div>
              <h2 className="text-2xl font-extrabold text-white mb-2">Profesyonel İşlem Tamamlandı!</h2>
              <p className="text-xs text-slate-400">
                Yüklediğiniz fotoğraflar Asistan Gemini AI ve Sharp işlemcisi tarafından dönüştürüldü ve 4 profesyonel filtre ile paketlendi.
              </p>
            </div>

            {/* Filter Download Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {FILTERS.map((filter, idx) => (
                <div key={filter.id} className="relative group overflow-hidden bg-slate-900 border border-slate-800 rounded-3xl p-6 hover:border-teal-500/50 transition-all space-y-4 shadow-xl">
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${filter.color} opacity-10 blur-2xl group-hover:opacity-20 transition-opacity pointer-events-none`} />
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg">
                        Filtre Paketi {idx + 1}
                      </span>
                      <span className="text-[10px] font-bold px-2.5 py-1 bg-teal-500/10 text-teal-300 border border-teal-500/20 rounded-full">
                        {filter.tag}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{filter.name}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{filter.desc}</p>
                  </div>

                  <div className="space-y-2 pt-2">
                    {/* Original HDR Download Link */}
                    <a 
                      href={`/api/fabrika/studio/download?shootId=${currentShootId}&filter=${encodeURIComponent(filter.name.replace(/\s+/g, '_'))}&watermark=false`}
                      download={`Jasmine_Studio_${filter.name.replace(/\s+/g, '_')}_HDR.zip`}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-700 text-xs font-bold cursor-pointer active:scale-95 shadow-sm"
                    >
                      <Download className="w-4 h-4 text-teal-400" />
                      <span>Orijinal 4K HDR ZIP İndir ({(files.length > 0 ? files.length : 3) * 2.4} MB)</span>
                    </a>

                    {/* Watermarked Download Link */}
                    <a 
                      href={`/api/fabrika/studio/download?shootId=${currentShootId}&filter=${encodeURIComponent(filter.name.replace(/\s+/g, '_'))}&watermark=true&website=${encodeURIComponent(websiteUrl || 'www.jasminegroup.com')}&textColor=${encodeURIComponent(textColor)}`}
                      download={`Jasmine_Studio_${filter.name.replace(/\s+/g, '_')}_Filigranli.zip`}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 rounded-xl transition-all border border-emerald-500/30 text-xs font-extrabold cursor-pointer active:scale-95 shadow-md"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Logo & Web Filigranlı 4K ZIP İndir</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Action Footer */}
            <div className="max-w-5xl mx-auto p-5 bg-teal-500/10 border border-teal-500/20 rounded-3xl flex items-start gap-4 shadow-xl">
              <div className="p-3 bg-teal-500/20 rounded-2xl shrink-0">
                <Sparkles className="w-6 h-6 text-teal-400" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm mb-1">İlan Portallarına Hazır!</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  İndirdiğiniz ZIP paketlerindeki fotoğraflar yüksek çözünürlükte ve kurumsal filigranlı olarak hazırdır. İster Sahibinden/Hepsiemlak ilanlarınıza ekleyin, ister müşterilerinize WhatsApp katalogu olarak gönderin!
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
