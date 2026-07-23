"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Sparkles, Award, Cpu } from "lucide-react";

export default function WhyJasmine() {
  return (
    <section className="py-24 bg-[#090d16] text-white relative overflow-hidden border-t border-slate-800/80">
      {/* Stitch Ambient Lighting */}
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex-1"
          >
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/20 via-teal-500/10 to-amber-500/10 rounded-3xl blur-xl -z-10" />
              
              <img 
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800" 
                alt="Jasmine Proje Pazarlama Ekibi" 
                className="w-full h-auto object-cover rounded-3xl shadow-2xl border border-slate-800"
              />
              
              {/* Floating Glass Badge */}
              <div className="absolute -bottom-8 -right-8 bg-[#090d16]/90 backdrop-blur-2xl p-6 shadow-2xl rounded-3xl border border-cyan-500/30 max-w-xs hidden md:block">
                <div className="flex items-center gap-2 text-cyan-400 font-black text-xs mb-1 uppercase tracking-wider">
                  <Award className="w-4 h-4" /> Kurumsal Deneyim
                </div>
                <div className="text-3xl font-serif font-black text-white mb-1">10+ Yıl</div>
                <div className="text-xs text-slate-400 font-semibold leading-relaxed">Akdeniz Bölgesi Sektör Liderliği ve Yüzlerce Başarılı Teslimat</div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="flex-1 space-y-6"
          >
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block">
              Kurumsal Farkımız
            </span>

            <h2 className="text-3xl md:text-5xl font-serif font-black text-white leading-tight">
              Neden Jasmine Proje Pazarlama?
            </h2>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed font-medium">
              Biz sıradan bir emlak ofisi değiliz. Biz, kaliteli müteahhit projeleri ile global gayrimenkul yatırımcıları arasında köprü kuran Alanya&apos;nın <span className="font-black text-cyan-300 underline underline-offset-4">ilk ve tek otonom proje pazarlama şirketiyiz</span>.
            </p>
            
            <ul className="space-y-4 pt-2">
              {[
                "Kendi projelerimizle rekabet etmiyoruz, sadece sizin projenize %100 odaklanıyoruz.",
                "Sadece satmıyoruz; mimari konseptten marka değerine ve 4K dijital stüdyo görsellerine kadar değer katıyoruz.",
                "Alanya'daki güçlü yerel ağımızın yanı sıra 40'tan fazla ülkede aktif acente partnerliğimiz mevcuttur.",
                "Meta Cloud API ve Gemini Yapay Zeka entegrasyonlu 5 modüllü dijital fabrikamızla müşteri kaçırmıyoruz."
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-md hover:border-cyan-500/30 transition-all">
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                  <span className="text-xs md:text-sm text-slate-300 font-semibold leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
