"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative h-[90vh] min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Background Image Placeholder (Blur effect) */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ 
          backgroundImage: "url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=2000')",
        }}
      >
        <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6 text-center text-white">
        <motion.span 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-block px-4 py-1.5 mb-6 text-sm font-medium bg-white/10 backdrop-blur-md rounded-full border border-white/20"
        >
          Alanya'nın İlk ve Tek Proje Pazarlama Firması
        </motion.span>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-6 max-w-4xl mx-auto leading-tight"
        >
          Gayrimenkul Yatırımınıza <br />
          <span className="text-gold-400">Yön Veriyoruz</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-lg md:text-xl text-gray-200 mb-10 max-w-2xl mx-auto"
        >
          Seçkin müteahhit projeleri ile dünyanın dört bir yanındaki yatırımcıları güvenle buluşturuyoruz.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link 
            href="/projeler" 
            className="w-full sm:w-auto px-8 py-4 bg-primary-700 hover:bg-primary-600 text-white font-medium rounded-sm transition-all flex items-center justify-center gap-2 group"
          >
            Projeleri İncele
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link 
            href="/iletisim" 
            className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 font-medium rounded-sm transition-all text-center"
          >
            Bize Ulaşın
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
