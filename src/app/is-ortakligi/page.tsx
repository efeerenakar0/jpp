"use client";

import { useState } from "react";
import { Handshake, UserPlus, FileCheck, Landmark } from "lucide-react";

export default function PartnerPage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <>
      {/* Header */}
      <section className="bg-primary-950 text-white py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">İş Ortaklığı & Emlakçı Portalı</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Dünyanın her yerindeki emlak profesyonelleri ile Alanya'nın en prestijli projelerini buluşturuyoruz.
          </p>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-serif font-bold text-center text-gray-900 mb-16">Nasıl Çalışır?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Connecting Line */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gray-100 -z-10 -translate-y-1/2"></div>
            
            {[
              { icon: UserPlus, title: "1. Başvuru", desc: "Aşağıdaki formu doldurarak iş ortaklığı talebinizi iletin." },
              { icon: FileCheck, title: "2. Onay", desc: "Uzman ekibimiz başvurunuzu değerlendirip hesabınızı aktifleştirsin." },
              { icon: Landmark, title: "3. Portföy Erişimi", desc: "Portala giriş yapıp sunum, görsel ve fiyat listelerine ulaşın." },
              { icon: Handshake, title: "4. Satış & Kazanç", desc: "Müşterilerinize sunum yapın ve yüksek komisyonlarla kazanın." }
            ].map((step, idx) => (
              <div key={idx} className="bg-white text-center p-6 rounded-sm border border-gray-100 shadow-sm relative">
                <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                  <step.icon className="w-8 h-8 text-primary-700" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Forms Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto bg-white rounded-sm shadow-xl overflow-hidden flex flex-col md:flex-row">
            
            {/* CTA/Login side */}
            <div className="bg-primary-900 text-white p-10 md:w-2/5 flex flex-col justify-center">
              <h3 className="text-2xl font-serif font-bold mb-4">Zaten Ortak Mısınız?</h3>
              <p className="text-gray-300 text-sm mb-8">
                B2B portalımıza giriş yaparak güncel fiyat listelerine, pazarlama materyallerine ve boş daire durumlarına anında ulaşın.
              </p>
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="w-full bg-gold-500 hover:bg-gold-600 text-primary-950 font-bold py-3 rounded-sm transition-colors"
              >
                Portala Giriş Yap
              </button>
            </div>

            {/* Register side */}
            <div className="p-10 md:w-3/5">
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6">Yeni İş Ortaklığı Başvurusu</h3>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Firma Adı</label>
                    <input type="text" className="w-full px-4 py-2.5 rounded-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Yetkili Kişi</label>
                    <input type="text" className="w-full px-4 py-2.5 rounded-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-Posta</label>
                    <input type="email" className="w-full px-4 py-2.5 rounded-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input type="tel" className="w-full px-4 py-2.5 rounded-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Faaliyet Gösterilen Bölge/Ülke</label>
                  <input type="text" className="w-full px-4 py-2.5 rounded-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <button type="button" className="w-full bg-primary-700 hover:bg-primary-800 text-white font-medium py-3 rounded-sm transition-colors mt-2">
                  Başvuruyu Gönder
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Fake Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-sm shadow-2xl max-w-sm w-full relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900"
            >
              ✕
            </button>
            <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2 text-center">Portal Girişi</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Lütfen e-posta ve şifrenizi giriniz.</p>
            
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Posta</label>
                <input type="email" className="w-full px-4 py-2.5 rounded-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
                <input type="password" className="w-full px-4 py-2.5 rounded-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="flex justify-end">
                <a href="#" className="text-xs text-primary-600 hover:underline">Şifremi Unuttum</a>
              </div>
              <button className="w-full bg-primary-700 text-white font-medium py-3 rounded-sm">
                Giriş Yap
              </button>
              <p className="text-xs text-center text-gray-400 mt-4">
                {/* TODO: Gerçek auth eklendiğinde bu mock kaldırılacak */}
                (Bu sadece bir UI demosu olup, gerçek giriş sistemi entegre edilecektir.)
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
