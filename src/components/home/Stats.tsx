"use client";

import { siteContent } from "@/data/site-content";
import { motion } from "framer-motion";

export default function Stats() {
  return (
    <section className="py-20 bg-primary-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 divide-x divide-primary-200">
          {siteContent.stats.map((stat, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center px-4"
            >
              <div className="text-4xl md:text-5xl font-serif font-bold text-primary-800 mb-2">
                {stat.value}
              </div>
              <div className="text-sm md:text-base font-medium text-gray-600">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
