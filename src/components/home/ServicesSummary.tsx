"use client";

import { siteContent } from "@/data/site-content";
import { motion } from "framer-motion";
import { BarChart, Building, PenTool, Megaphone, Users, Database } from "lucide-react";
import Link from "next/link";

const iconMap: Record<string, React.ElementType> = {
  BarChart, Building, PenTool, Megaphone, Users, Database
};

export default function ServicesSummary() {
  return (
    <section className="py-24 bg-primary-950 text-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-white mb-4">
            A'dan Z'ye Proje Pazarlama
          </h2>
          <p className="text-gray-400">
            Projenizin fikir aşamasından, son anahtar teslimine kadar tüm pazarlama ve satış süreçlerini tek elden yönetiyoruz.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {siteContent.services.map((service, index) => {
            const IconComponent = iconMap[service.icon] || Building;
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white/5 border border-white/10 p-8 rounded-sm hover:bg-white/10 transition-colors group"
              >
                <div className="w-14 h-14 bg-primary-800 rounded-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <IconComponent className="w-7 h-7 text-gold-400" />
                </div>
                <h3 className="text-xl font-serif font-bold mb-3">{service.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  {service.shortDescription}
                </p>
                <Link 
                  href={`/hizmetler#${service.id}`}
                  className="inline-flex items-center text-gold-400 text-sm font-medium hover:text-gold-300"
                >
                  Daha Fazla Bilgi &rarr;
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
