"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Sparkles, Building2, ShieldCheck, MapPin, Search, Cpu, Zap } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#090d16] pt-20">
      {/* Background Image Layer with Mesh Gradient */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-25 scale-105"
        style={{ 
          backgroundImage: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2000')",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#090d16] via-[#090d16]/80 to-[#090d16]" />

      {/* Google Stitch Glowing Mesh Aura Spheres */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-[600px] h-[600px] bg-cyan-500/15 rounded-full blur-[160px] pointer-events-none animate-pulse-glow" />
      <div className="absolute top-1/3 right-10 w-[500px] h-[500px] bg-purple-600/15 rounded-full blur-[160px] pointer-events-none animate-pulse-glow" />

      <div className="container relative z-10 mx-auto px-4 md:px-6 text-center text-white py-16">
        {/* Top Badge - Stitch Pill */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2.5 px-4.5 py-2 mb-8 bg-slate-900/80 backdrop-blur-2xl rounded-full border border-cyan-500/30 text-cyan-300 text-xs font-black shadow-xl shadow-cyan-500/10 uppercase tracking-widest"
        >
          <Cpu className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>Google Nano & Stitch Alanya Proje Pazarlama Motoru</span>
        </motion.div>
        
        {/* Main Heading */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-4xl md:text-6xl lg:text-7xl font-serif font-black mb-6 max-w-5xl mx-auto leading-[1.1] text-white tracking-tight"
        >
          Gayrimenkul Yatırımına <br />
          <span className="bg-gradient-to-r from-cyan-300 via-teal-300 to-amber-300 bg-clip-text text-transparent">
            Yapay Zekanın Gücüyle Yön Verin
          </span>
        </motion.h1>
        
        {/* Subtitle */}
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-sm md:text-base text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed font-medium"
        >
          Alanya ve Akdeniz bölgesinin seçkin lüks konut ve villa projelerini Google Gemini Vision & Meta Cloud API entegreli otonom dijital fabrikamızla dünya çapındaki yatırımcılara sunuyoruz.
        </motion.p>
        
        {/* Action Buttons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto"
        >
          <Link 
            href="/projeler" 
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20 active:scale-95 text-xs uppercase tracking-wider"
          >
            <span>Seçkin Projeleri İncele</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link 
            href="/iletisim" 
            className="w-full sm:w-auto px-8 py-4 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-2xl text-slate-200 border border-slate-700 hover:border-cyan-500/40 font-bold rounded-2xl transition-all text-center text-xs uppercase tracking-wider shadow-md"
          >
            Bize Ulaşın
          </Link>
        </motion.div>

        {/* Feature Highlights Grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mt-16 pt-8 border-t border-slate-800/80"
        >
          <div className="p-4 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all text-left group">
            <div className="text-2xl font-black text-cyan-300 font-serif mb-1 group-hover:scale-105 transition-transform">50+</div>
            <div className="text-xs text-slate-400 font-bold">Aktif Tamamlanan Proje</div>
          </div>

          <div className="p-4 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all text-left group">
            <div className="text-2xl font-black text-cyan-300 font-serif mb-1 group-hover:scale-105 transition-transform">%100</div>
            <div className="text-xs text-slate-400 font-bold">Güvenli Tapu & Yatırım</div>
          </div>

          <div className="p-4 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all text-left group">
            <div className="text-2xl font-black text-cyan-300 font-serif mb-1 group-hover:scale-105 transition-transform">7/24</div>
            <div className="text-xs text-slate-400 font-bold">Meta AI Otonom Asistan</div>
          </div>

          <div className="p-4 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-white/5 hover:border-cyan-500/30 transition-all text-left group">
            <div className="text-2xl font-black text-cyan-300 font-serif mb-1 group-hover:scale-105 transition-transform">12+</div>
            <div className="text-xs text-slate-400 font-bold">Ülkede Satış Ağı</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
