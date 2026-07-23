"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Handshake, ArrowRight, Sparkles } from "lucide-react";

export default function PartnerCTA() {
  return (
    <section className="py-24 relative bg-[#090d16] text-white overflow-hidden border-t border-slate-800/80">
      {/* Stitch Pattern Overlay */}
      <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="w-20 h-20 bg-gradient-to-br from-cyan-400 via-teal-400 to-emerald-400 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-cyan-500/25 border border-white/20"
          >
            <Handshake className="w-10 h-10 text-slate-950 stroke-[2.5]" />
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-serif font-black mb-6 text-white"
          >
            Emlakçı ve Acente Ortağımız Olun
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-sm md:text-base text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Geniş Alanya portföyümüze B2B portalımız üzerinden erişin, 4K profesyonel görsel materyallerini indirin ve müşterilerinize sunarak yüksek komisyon oranlarıyla kazancınızı katlayın.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link 
              href="/is-ortakligi" 
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black rounded-2xl transition-all text-xs uppercase tracking-widest shadow-xl shadow-cyan-500/20 active:scale-95 cursor-pointer"
            >
              <span>İş Ortaklığı Başvurusu Yap</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
