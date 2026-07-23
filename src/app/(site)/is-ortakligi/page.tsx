"use client";

import { useState } from "react";
import { Handshake, UserPlus, FileCheck, Landmark, Sparkles, ArrowRight } from "lucide-react";

export default function PartnerPage() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <div className="bg-[#090d16] text-slate-100 min-h-screen pt-20">
      {/* Header */}
      <section className="relative py-20 text-center bg-slate-950 overflow-hidden border-b border-slate-800/80">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10 mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>B2B Global Acente Portalı</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-black text-white mb-4">İş Ortaklığı & Emlakçı Portalı</h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto font-medium">
            Dünyanın her yerindeki emlak profesyonelleri ile Alanya&apos;nın en prestijli lüks projelerini buluşturuyoruz.
          </p>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <h2 className="text-3xl font-serif font-black text-center text-white mb-16">Nasıl Çalışır?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { icon: UserPlus, title: "1. Başvuru", desc: "Formu doldurarak iş ortaklığı talebinizi saniyeler içinde iletin." },
              { icon: FileCheck, title: "2. Onay", desc: "Ekibimiz başvurunuzu onaylayıp B2B portal hesabınızı aktifleştirsin." },
              { icon: Landmark, title: "3. Portföy Erişimi", desc: "Portala girip 4K sunum, görsel ve canlı stok fiyat listelerine ulaşın." },
              { icon: Handshake, title: "4. Satış & Kazanç", desc: "Müşterilerinize sunum yapın ve yüksek komisyon oranlarıyla kazanın." }
            ].map((step, idx) => (
              <div key={idx} className="bg-slate-900/60 text-center p-6 rounded-3xl border border-slate-800/80 backdrop-blur-xl shadow-2xl relative group">
                <div className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <step.icon className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Forms Section */}
      <section className="py-20 bg-slate-950 border-t border-slate-800/80">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row backdrop-blur-2xl">
            
            {/* CTA/Login side */}
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-10 md:w-2/5 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-800">
              <h3 className="text-xl font-serif font-black mb-3 text-cyan-300">Zaten Ortak Mısınız?</h3>
              <p className="text-slate-400 text-xs mb-8 leading-relaxed font-medium">
                B2B portalımıza giriş yaparak güncel fiyat listelerine, 4K pazarlama materyallerine ve boş daire stok durumuna anında ulaşın.
              </p>
              <button 
                onClick={() => setIsLoginModalOpen(true)}
                className="w-full bg-gradient-to-r from-cyan-400 to-teal-500 hover:from-cyan-300 hover:to-teal-400 text-slate-950 font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-cyan-500/20 text-xs uppercase tracking-wider cursor-pointer active:scale-95"
              >
                Portala Giriş Yap
              </button>
            </div>

            {/* Register side */}
            <div className="p-10 md:w-3/5">
              <h3 className="text-xl font-serif font-black text-white mb-6">Yeni İş Ortaklığı Başvurusu</h3>
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Firma Adı</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400 font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Yetkili Kişi</label>
                    <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400 font-medium" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">E-Posta</label>
                    <input type="email" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400 font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Telefon</label>
                    <input type="tel" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400 font-medium" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Faaliyet Gösterilen Bölge/Ülke</label>
                  <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400 font-medium" />
                </div>
                <button type="button" className="w-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-cyan-500/20 text-xs uppercase tracking-wider mt-2 cursor-pointer active:scale-95">
                  Başvuruyu Gönder
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl max-w-sm w-full relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold text-xs"
            >
              ✕
            </button>
            <h3 className="text-xl font-serif font-black text-white mb-1 text-center">B2B Portal Girişi</h3>
            <p className="text-xs text-slate-400 text-center mb-6 font-medium">E-posta ve şifrenizle giriş yapınız.</p>
            
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">E-Posta</label>
                <input type="email" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400 font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Şifre</label>
                <input type="password" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white outline-none focus:border-cyan-400 font-medium" />
              </div>
              <button className="w-full py-3.5 bg-gradient-to-r from-cyan-400 to-teal-500 hover:from-cyan-300 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer">
                Giriş Yap
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
