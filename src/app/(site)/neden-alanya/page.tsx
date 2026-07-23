import { Metadata } from "next";
import { Sun, Plane, TrendingUp, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Neden Alanya? | Jasmine Nano Proje Pazarlama",
  description: "Alanya'da gayrimenkul yatırımının avantajları ve yaşam rehberi.",
};

export default function WhyAlanyaPage() {
  return (
    <div className="bg-[#090d16] text-slate-100 min-h-screen pt-20">
      {/* Hero Banner */}
      <section className="relative h-[50vh] min-h-[400px] w-full bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800/80">
        <img 
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=2000" 
          alt="Alanya Manzarası" 
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-transparent to-[#090d16]/80" />

        <div className="relative z-10 text-center text-white px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Akdeniz'in Yatırım Başkenti</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-black mb-4">Neden Alanya?</h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl mx-auto font-medium">
            Akdeniz&apos;in incisi Alanya&apos;da yaşamak ve yatırım yapmak için sayısız nedeniniz var.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center mb-16 space-y-4">
            <h2 className="text-3xl font-serif font-black text-white">Yatırımın En Güvenli Limanı</h2>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium">
              Tarihi dokusu, muhteşem doğası ve modern şehir yaşantısıyla Alanya, sadece bir tatil beldesi değil, aynı zamanda uluslararası gayrimenkul yatırımcılarının en çok tercih ettiği, değeri sürekli artan bir dünya kentidir.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            {[
              { icon: Sun, title: "Mükemmel İklim", desc: "Yılın 300 günü güneşli, ılıman Akdeniz iklimi ile 4 mevsim yaşanabilir şehir." },
              { icon: Plane, title: "Kolay Ulaşım", desc: "Gazipaşa (GZP) ve Antalya (AYT) havalimanları ile dünyanın her yerine direkt uçuş." },
              { icon: TrendingUp, title: "Yüksek Getiri", desc: "Sürekli artan konut talebi sayesinde yüksek kira getirisi ve döviz bazında değer kazanımı." },
              { icon: ShieldCheck, title: "Güvenli Yaşam", desc: "Farklı kültürlerin barış içinde yaşadığı, suç oranının çok düşük olduğu uluslararası merkez." }
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-900/60 p-8 rounded-3xl text-center border border-slate-800/80 hover:border-cyan-500/40 transition-all backdrop-blur-xl group">
                <div className="w-14 h-14 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <item.icon className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Buying Process */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-serif font-black mb-3 text-cyan-300">Yabancılar İçin Satın Alma Süreci</h2>
              <p className="text-xs text-slate-400 font-medium">Türkiye&apos;de gayrimenkul sahibi olmak sandığınızdan çok daha kolay. Sürecin her adımında yanınızdayız.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative">
               <div className="relative z-10 bg-slate-950 p-6 rounded-2xl border border-slate-800">
                 <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-teal-500 text-slate-950 rounded-xl flex items-center justify-center text-sm font-black mx-auto mb-4 shadow-lg shadow-cyan-500/20">1</div>
                 <h4 className="font-bold text-sm mb-2 text-white">Proje Seçimi</h4>
                 <p className="text-xs text-slate-400 font-medium leading-relaxed">Bütçe ve beklentilerinize en uygun projeyi portföyümüzden belirliyoruz.</p>
               </div>
               
               <div className="relative z-10 bg-slate-950 p-6 rounded-2xl border border-slate-800">
                 <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-teal-500 text-slate-950 rounded-xl flex items-center justify-center text-sm font-black mx-auto mb-4 shadow-lg shadow-cyan-500/20">2</div>
                 <h4 className="font-bold text-sm mb-2 text-white">Sözleşme & Ödeme</h4>
                 <p className="text-xs text-slate-400 font-medium leading-relaxed">Noter onaylı satış vaadi sözleşmesi imzalanır ve ödeme planı başlatılır.</p>
               </div>
               
               <div className="relative z-10 bg-slate-950 p-6 rounded-2xl border border-slate-800">
                 <div className="w-10 h-10 bg-gradient-to-r from-cyan-400 to-teal-500 text-slate-950 rounded-xl flex items-center justify-center text-sm font-black mx-auto mb-4 shadow-lg shadow-cyan-500/20">3</div>
                 <h4 className="font-bold text-sm mb-2 text-white">Tapu & İskan</h4>
                 <p className="text-xs text-slate-400 font-medium leading-relaxed">Tüm yasal prosedürler tarafımızca yürütülerek tapunuz adınıza tescil edilir.</p>
               </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
