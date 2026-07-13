"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Handshake } from "lucide-react";

export default function PartnerCTA() {
  return (
    <section className="py-20 relative bg-primary-800 text-white overflow-hidden">
      {/* Pattern Overlay */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      
      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="w-20 h-20 bg-gold-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-gold-500/20"
          >
            <Handshake className="w-10 h-10 text-primary-900" />
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-serif font-bold mb-6"
          >
            Emlakçı Ortağımız Olun
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-primary-100 mb-10 leading-relaxed"
          >
            Geniş portföyümüze B2B portalımız üzerinden erişin, özel pazarlama materyallerini indirin ve müşterilerinize sunarak yüksek komisyon oranlarıyla kazancınızı artırın.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Link 
              href="/is-ortakligi" 
              className="inline-block px-8 py-4 bg-white text-primary-800 hover:bg-gray-100 font-bold rounded-sm transition-colors text-lg"
            >
              İş Ortaklığı Başvurusu
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
