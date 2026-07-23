"use client";

import { siteContent } from "@/data/site-content";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Bed, Maximize, Calendar, ArrowRight, Sparkles } from "lucide-react";

export default function FeaturedProjects() {
  const projects = siteContent.projects.slice(0, 3);

  return (
    <section className="py-24 bg-[#090d16] text-white relative">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block mb-2">
              Özel Portföy Seçkisi
            </span>
            <h2 className="text-3xl md:text-5xl font-serif font-black text-white mb-4">
              Öne Çıkan Lüks Projeler
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              Yatırım değeri yüksek, yüksek prim potansiyeline sahip seçkin Alanya konut ve villa projelerimizi keşfedin.
            </p>
          </div>
          <Link 
            href="/projeler" 
            className="inline-flex items-center gap-2 text-cyan-400 font-black hover:text-cyan-300 transition-colors text-xs uppercase tracking-wider group"
          >
            <span>Tüm Projeleri Keşfet</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group border border-slate-800/80 hover:border-cyan-500/50 rounded-3xl overflow-hidden transition-all duration-300 bg-slate-900/50 flex flex-col shadow-2xl hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-xl"
            >
              {/* Image Container */}
              <div className="relative h-64 overflow-hidden bg-slate-950">
                <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 px-3.5 py-1 text-[11px] font-black text-cyan-300 rounded-full shadow-lg">
                  {project.status}
                </div>
                <img 
                  src={project.image} 
                  alt={project.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col flex-grow">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3 font-semibold">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{project.location}</span>
                </div>
                
                <h3 className="text-xl font-serif font-black text-white mb-2 group-hover:text-cyan-300 transition-colors">
                  <Link href={`/projeler/${project.slug}`}>
                    {project.name}
                  </Link>
                </h3>

                <p className="text-slate-400 text-xs mb-6 line-clamp-2 leading-relaxed font-medium">
                  {project.shortDescription}
                </p>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-y-3 border-t border-slate-800/80 pt-4 mt-auto mb-6">
                  <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                    <Bed className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="truncate">{project.types[0]}+</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                    <Maximize className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="truncate">{project.area}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 col-span-2 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Teslim: {project.deliveryDate}</span>
                  </div>
                </div>

                <Link 
                  href={`/projeler/${project.slug}`}
                  className="block w-full text-center py-3.5 bg-slate-800/80 hover:bg-gradient-to-r hover:from-cyan-400 hover:to-emerald-400 hover:text-slate-950 text-slate-200 text-xs font-black rounded-2xl transition-all border border-slate-700 hover:border-cyan-400 shadow-sm uppercase tracking-wider"
                >
                  Proje Detaylarını İncele
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
