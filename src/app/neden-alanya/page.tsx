import { Metadata } from "next";
import { Sun, Plane, TrendingUp, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Neden Alanya? | Jasmine Proje Pazarlama",
  description: "Alanya'da gayrimenkul yatırımının avantajları ve yaşam rehberi.",
};

export default function WhyAlanyaPage() {
  return (
    <>
      <section className="relative h-[50vh] min-h-[400px] w-full bg-gray-900 flex items-center justify-center">
        <img 
          src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=2000" 
          alt="Alanya Manzarası" 
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="relative z-10 text-center text-white px-4">
          <h1 className="text-4xl md:text-6xl font-serif font-bold mb-4">Neden Alanya?</h1>
          <p className="text-xl max-w-2xl mx-auto">Akdeniz'in incisi Alanya'da yaşamak ve yatırım yapmak için sayısız nedeniniz var.</p>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-6">Yatırımın Güvenli Limanı</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Tarihi dokusu, muhteşem doğası ve modern şehir yaşantısıyla Alanya, sadece bir tatil beldesi değil, aynı zamanda uluslararası gayrimenkul yatırımcılarının en çok tercih ettiği, değeri sürekli artan bir metropoldür.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
            {[
              { icon: Sun, title: "Mükemmel İklim", desc: "Yılın 300 günü güneşli, ılıman Akdeniz iklimi ile dört mevsim yaşanabilir bir şehir." },
              { icon: Plane, title: "Kolay Ulaşım", desc: "Gazipaşa (GZP) ve Antalya (AYT) havalimanları ile dünyanın her yerine direkt veya aktarmalı uçuş imkanı." },
              { icon: TrendingUp, title: "Yüksek Getiri", desc: "Sürekli artan konut talebi sayesinde yüksek kira getirisi ve döviz bazında değer artışı garantisi." },
              { icon: ShieldCheck, title: "Güvenli Yaşam", desc: "Farklı kültürlerin bir arada barış içinde yaşadığı, suç oranının çok düşük olduğu uluslararası bir merkez." }
            ].map((item, idx) => (
              <div key={idx} className="bg-gray-50 p-8 rounded-sm text-center hover:shadow-lg transition-shadow border border-gray-100">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <item.icon className="w-8 h-8 text-primary-700" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Buying Process */}
          <div className="bg-primary-950 text-white rounded-sm p-8 md:p-12 shadow-2xl">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl font-serif font-bold mb-4 text-gold-400">Yabancılar İçin Satın Alma Süreci</h2>
              <p className="text-gray-300">Türkiye'de gayrimenkul sahibi olmak sandığınızdan çok daha kolay. Sürecin her adımında uzman ekibimizle yanınızdayız.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center relative">
               <div className="hidden md:block absolute top-6 left-[15%] right-[15%] h-0.5 bg-gray-800 -z-0"></div>
               
               <div className="relative z-10">
                 <div className="w-12 h-12 bg-gold-500 text-primary-950 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg shadow-gold-500/20">1</div>
                 <h4 className="font-bold text-lg mb-2 text-white">Proje Seçimi</h4>
                 <p className="text-sm text-gray-400">Bütçe ve beklentilerinize en uygun projeyi portföyümüzden belirliyoruz.</p>
               </div>
               
               <div className="relative z-10">
                 <div className="w-12 h-12 bg-gold-500 text-primary-950 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg shadow-gold-500/20">2</div>
                 <h4 className="font-bold text-lg mb-2 text-white">Sözleşme & Ödeme</h4>
                 <p className="text-sm text-gray-400">Noter onaylı satış vaadi sözleşmesi imzalanır ve ödeme planı başlatılır.</p>
               </div>
               
               <div className="relative z-10">
                 <div className="w-12 h-12 bg-gold-500 text-primary-950 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4 shadow-lg shadow-gold-500/20">3</div>
                 <h4 className="font-bold text-lg mb-2 text-white">Tapu & İskan</h4>
                 <p className="text-sm text-gray-400">Tüm yasal prosedürler tarafımızca yürütülerek tapunuz adınıza tescil edilir.</p>
               </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
