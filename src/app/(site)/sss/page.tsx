"use client";

import { useState } from "react";
import { siteContent } from "@/data/site-content";
import { ChevronDown, ChevronUp, Sparkles, HelpCircle } from "lucide-react";
import Link from "next/link";

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>("cat0-0");

  const toggle = (id: string) => {
    setOpenIndex(openIndex === id ? null : id);
  };

  return (
    <div className="bg-[#090d16] text-slate-100 min-h-screen pt-20">
      <section className="relative py-20 text-center bg-slate-950 overflow-hidden border-b border-slate-800/80">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10 mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-widest">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>Merak Edilen Tüm Detaylar</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-black text-white mb-4">Sık Sorulan Sorular</h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto font-medium">
            Yatırımcılarımız ve iş ortaklarımızdan gelen en sık soruların net yanıtları.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          {siteContent.faq.map((category, catIndex) => (
            <div key={catIndex} className="mb-12">
              <h2 className="text-xl font-serif font-black text-white mb-6 pb-2 border-b border-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                {category.category}
              </h2>
              
              <div className="space-y-4">
                {category.questions.map((item, qIndex) => {
                  const id = `cat${catIndex}-${qIndex}`;
                  const isOpen = openIndex === id;
                  
                  return (
                    <div 
                      key={qIndex} 
                      className={`border rounded-2xl overflow-hidden transition-all backdrop-blur-xl ${
                        isOpen 
                          ? 'border-cyan-500/40 bg-slate-900/80 shadow-lg shadow-cyan-500/5' 
                          : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700'
                      }`}
                    >
                      <button
                        onClick={() => toggle(id)}
                        className="w-full flex items-center justify-between p-5 text-left focus:outline-none cursor-pointer"
                      >
                        <span className="font-bold text-white text-xs md:text-sm pr-4">{item.q}</span>
                        {isOpen ? (
                          <ChevronUp className="w-4 h-4 text-cyan-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                        )}
                      </button>
                      
                      {isOpen && (
                        <div className="p-5 pt-0 text-slate-300 text-xs leading-relaxed border-t border-slate-800/60 font-medium">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          <div className="mt-16 bg-slate-900/80 p-8 rounded-3xl text-center border border-slate-800 backdrop-blur-2xl">
            <h3 className="text-lg font-black text-white mb-2">Başka bir sorunuz mu var?</h3>
            <p className="text-xs text-slate-400 mb-6 font-medium">Aradığınız cevabı bulamadıysanız uzman ekibimizle doğrudan iletişime geçebilirsiniz.</p>
            <Link href="/iletisim" className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95">
              <span>Bize Ulaşın</span>
              <Sparkles className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
