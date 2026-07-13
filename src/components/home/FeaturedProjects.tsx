"use client";

import { siteContent } from "@/data/site-content";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, Bed, Maximize, Calendar } from "lucide-react";
import Image from "next/image";

export default function FeaturedProjects() {
  // Sadece ilk 3 projeyi al
  const projects = siteContent.projects.slice(0, 3);

  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
              Öne Çıkan Projeler
            </h2>
            <p className="text-gray-600">
              Yatırım değeri yüksek, kaliteli yaşam standartları sunan en seçkin projelerimizi inceleyin.
            </p>
          </div>
          <Link 
            href="/projeler" 
            className="text-primary-700 font-medium hover:text-primary-600 hover:underline underline-offset-4 whitespace-nowrap"
          >
            Tüm Projeleri Gör &rarr;
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
              className="group border border-gray-100 rounded-sm overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white flex flex-col"
            >
              {/* Image Container */}
              <div className="relative h-64 overflow-hidden bg-gray-100">
                <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-3 py-1 text-xs font-semibold text-primary-800 rounded-sm">
                  {project.status}
                </div>
                {/* Placeholder Image using img tag since we don't have configured next/image domains yet */}
                <img 
                  src={project.image} 
                  alt={project.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col flex-grow">
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <MapPin className="w-4 h-4" />
                  <span>{project.location}</span>
                </div>
                <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">
                  <Link href={`/projeler/${project.slug}`} className="hover:text-primary-700 transition-colors">
                    {project.name}
                  </Link>
                </h3>
                <p className="text-gray-600 text-sm mb-6 line-clamp-2">
                  {project.shortDescription}
                </p>

                {/* Specs */}
                <div className="grid grid-cols-2 gap-y-3 border-t border-gray-100 pt-4 mt-auto mb-6">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Bed className="w-4 h-4 text-primary-600" />
                    <span className="truncate">{project.types[0]}+</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Maximize className="w-4 h-4 text-primary-600" />
                    <span className="truncate">{project.area}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 col-span-2">
                    <Calendar className="w-4 h-4 text-primary-600" />
                    <span>{project.deliveryDate}</span>
                  </div>
                </div>

                <Link 
                  href={`/projeler/${project.slug}`}
                  className="block w-full text-center py-3 bg-gray-50 hover:bg-primary-700 hover:text-white text-gray-800 font-medium rounded-sm transition-colors"
                >
                  Proje Detayları
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
