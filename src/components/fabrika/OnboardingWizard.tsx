'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
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

      const res = await fetch('/api/fabrika/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      window.location.reload();
    } catch (error) {
      console.error(error);
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = ((step - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-gray-100">
      <div className="w-full max-w-2xl bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        {/* Header / Progress */}
        <div className="bg-gray-800 p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent mb-2">
            Şirket Profili Kurulumu
          </h2>
          <p className="text-gray-400 text-sm">Avcı modülünün size en uygun mesajları üretebilmesi için firmanızı tanıyalım.</p>
          
          <div className="mt-6 relative h-2 bg-gray-700 rounded-full">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs font-medium text-gray-500">
            <span className={step >= 1 ? 'text-amber-400' : ''}>Temel Bilgiler</span>
            <span className={step >= 2 ? 'text-amber-400' : ''}>Öne Çıkanlar</span>
            <span className={step >= 3 ? 'text-amber-400' : ''}>Ek Detaylar</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Firma Adı</label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Örn: Jasmine Real Estate"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Hizmet Bölgeleri (Virgülle ayırın)</label>
                <input
                  type="text"
                  name="serviceAreas"
                  value={formData.serviceAreas}
                  onChange={handleChange}
                  placeholder="Örn: Alanya, Mahmutlar, Kargıcak"
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Güçlü Yanlarınız (Virgülle ayırın)</label>
                <textarea
                  name="strengths"
                  value={formData.strengths}
                  onChange={handleChange}
                  placeholder="Örn: Geniş müşteri portföyü, Ücretsiz drone çekimi, Hızlı satış"
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Benzersiz Satış Noktaları (USP)</label>
                <textarea
                  name="uniquePoints"
                  value={formData.uniquePoints}
                  onChange={handleChange}
                  placeholder="Örn: Sadece bize özel yabancı yatırımcı ağı, Hukuki destek"
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Sektördeki Yılınız</label>
                  <input
                    type="number"
                    name="yearsInBusiness"
                    value={formData.yearsInBusiness}
                    onChange={handleChange}
                    placeholder="Örn: 10"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Ekip Büyüklüğü</label>
                  <input
                    type="number"
                    name="teamSize"
                    value={formData.teamSize}
                    onChange={handleChange}
                    placeholder="Örn: 15"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Ek Notlar (Yapay Zekaya İpuçları)</label>
                <textarea
                  name="extraNotes"
                  value={formData.extraNotes}
                  onChange={handleChange}
                  placeholder="Örn: Mesajlarda her zaman gülücük kullan, çok resmi olma."
                  rows={3}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div className="bg-gray-800 p-6 border-t border-gray-700 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              step === 1 ? 'opacity-0 cursor-default' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Geri
          </button>
          
          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg shadow-orange-500/20"
            >
              Devam Et
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg font-medium hover:from-amber-400 hover:to-orange-500 transition-all shadow-lg shadow-orange-500/20 flex items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Kaydediliyor...
                </>
              ) : (
                'Tamamla ve Başla'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
