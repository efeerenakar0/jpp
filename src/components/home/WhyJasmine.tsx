"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function WhyJasmine() {
  return (
    <section className="py-24 bg-white overflow-hidden">
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
              {/* Background decorative element */}
              <div className="absolute -inset-4 bg-primary-100 rounded-sm transform rotate-3 -z-10"></div>
              {/* Main Image Placeholder */}
              <img 
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800" 
                alt="Jasmine Proje Pazarlama Ekibi" 
                className="w-full h-auto object-cover rounded-sm shadow-xl"
              />
              
              {/* Floating Badge */}
              <div className="absolute -bottom-8 -right-8 bg-white p-6 shadow-xl rounded-sm max-w-xs hidden md:block">
                <div className="text-4xl font-serif font-bold text-primary-700 mb-2">10+</div>
                <div className="text-sm font-medium text-gray-600">Yıllık Sektör Deneyimi ve Yüzlerce Başarılı Teslimat</div>
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
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">
              Neden Jasmine Proje Pazarlama?
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              Biz bir emlak ofisi değiliz. Biz, inşaat firmaları ile global gayrimenkul piyasası arasında köprü kuran Alanya'nın <span className="font-semibold text-primary-700">ilk ve tek</span> profesyonel proje pazarlama şirketiyiz.
            </p>
            
            <ul className="space-y-4 pt-4">
              {[
                "Kendi projelerimizle rekabet etmiyoruz, sadece sizin projenize odaklanıyoruz.",
                "Sadece satmıyoruz, projenin mimari tasarımından marka kimliğine kadar değer katıyoruz.",
                "Alanya'daki yerel ağımızın yanı sıra 40'tan fazla ülkede aktif partnerlerimiz var.",
                "Yapay zeka destekli CRM altyapımızla hiçbir potansiyel müşteriyi kaçırmıyoruz."
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-gold-100 text-gold-600 flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </div>
                  <span className="text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
