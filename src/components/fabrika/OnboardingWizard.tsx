'use client';

import { useState } from 'react';

interface FormData {
  companyName: string;
  strengths: string;
  uniquePoints: string;
  serviceAreas: string;
  yearsInBusiness: string;
  teamSize: string;
  extraNotes: string;
}

export default function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    strengths: '',
    uniquePoints: '',
    serviceAreas: '',
    yearsInBusiness: '',
    teamSize: '',
    extraNotes: '',
  });

  const totalSteps = 3;

  const handleSkip = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jasmine_onboarding_done', 'true');
      window.location.href = '/fabrika/avci';
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        companyName: formData.companyName || 'Jasmine Group',
        strengths: (formData.strengths || 'Lüks Gayrimenkul, Hızlı Satış').split(',').map((s) => s.trim()).filter(Boolean),
        uniquePoints: (formData.uniquePoints || 'Yatırımcı Ağı, VIP Hizmet').split(',').map((s) => s.trim()).filter(Boolean),
        serviceAreas: (formData.serviceAreas || 'Alanya, Mahmutlar, Oba').split(',').map((s) => s.trim()).filter(Boolean),
        yearsInBusiness: formData.yearsInBusiness ? parseInt(formData.yearsInBusiness) : 10,
        teamSize: formData.teamSize ? parseInt(formData.teamSize) : 15,
        extraNotes: formData.extraNotes || 'Alanya bölgesinde lüks konut uzmanı',
      };

      await fetch('/api/fabrika/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});

      if (typeof window !== 'undefined') {
        localStorage.setItem('jasmine_onboarding_done', 'true');
        window.location.href = '/fabrika/avci';
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('jasmine_onboarding_done', 'true');
        window.location.href = '/fabrika/avci';
      }
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = ((step - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-slate-100 font-sans">
      <div className="w-full max-w-2xl bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden relative">
        
        {/* Bypass/Skip Button */}
        <button 
          onClick={handleSkip}
          className="absolute top-4 right-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer z-20 flex items-center gap-1.5"
        >
          ⚡ Kurulumu Atla & Doğrudan Avcı Paneline Geç ✕
        </button>

        {/* Header / Progress */}
        <div className="bg-slate-900 p-6 border-b border-slate-800 pt-8">
          <h2 className="text-2xl font-black text-white mb-1">
            Şirket Profili Kurulumu
          </h2>
          <p className="text-slate-400 text-xs">Avcı modülünün size en uygun mesajları üretebilmesi için firmanızı tanıyalım.</p>
          
          <div className="mt-6 relative h-2 bg-slate-800 rounded-full">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs font-bold text-slate-500">
            <span className={step >= 1 ? 'text-amber-400' : ''}>Temel Bilgiler</span>
            <span className={step >= 2 ? 'text-amber-400' : ''}>Öne Çıkanlar</span>
            <span className={step >= 3 ? 'text-amber-400' : ''}>Ek Detaylar</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Firma Adı</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Örn: Jasmine Real Estate"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-amber-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Hizmet Bölgeleri (Virgülle ayırın)</label>
                <input
                  type="text"
                  name="serviceAreas"
                  value={formData.serviceAreas}
                  onChange={handleChange}
                  placeholder="Örn: Alanya, Mahmutlar, Kargıcak"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-amber-500 outline-none transition-all"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Güçlü Yanlarınız (Virgülle ayırın)</label>
                <textarea
                  name="strengths"
                  value={formData.strengths}
                  onChange={handleChange}
                  placeholder="Örn: Geniş müşteri portföyü, Ücretsiz drone çekimi, Hızlı satış"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-amber-500 outline-none transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Benzersiz Satış Noktaları (USP)</label>
                <textarea
                  name="uniquePoints"
                  value={formData.uniquePoints}
                  onChange={handleChange}
                  placeholder="Örn: Sadece bize özel yabancı yatırımcı ağı, Hukuki destek"
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-amber-500 outline-none transition-all resize-none"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Sektördeki Yılınız</label>
                  <input
                    type="number"
                    name="yearsInBusiness"
                    value={formData.yearsInBusiness}
                    onChange={handleChange}
                    placeholder="Örn: 10"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-amber-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Ekip Büyüklüğü</label>
                  <input
                    type="number"
                    name="teamSize"
                    value={formData.teamSize}
                    onChange={handleChange}
                    placeholder="Örn: 15"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-amber-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Ek Notlar (Yapay Zekaya İpuçları)</label>
                <textarea
                  name="extraNotes"
                  value={formData.extraNotes}
                  onChange={handleChange}
                  placeholder="Örn: Mesajlarda her zaman gülücük kullan, çok resmi olma."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 focus:border-amber-500 outline-none transition-all resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div className="bg-slate-900 p-6 border-t border-slate-800 flex justify-between items-center">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              step === 1 ? 'opacity-0 cursor-default' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer'
            }`}
          >
            Geri
          </button>
          
          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 rounded-xl font-black text-xs transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              Devam Et
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 rounded-xl font-black text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>Kaydediliyor...</>
              ) : (
                'Tamamla ve Avcı Paneline Geç'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
