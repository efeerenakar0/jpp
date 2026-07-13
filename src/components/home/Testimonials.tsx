"use client";

import { useState } from "react";
import { siteContent } from "@/data/site-content";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

export default function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const testimonials = siteContent.testimonials;

  const next = () => {
    setCurrentIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  return (
    <section className="py-24 bg-primary-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary-900">
            Müşteri ve Ortaklarımızın Gözünden
          </h2>
        </div>

        <div className="max-w-4xl mx-auto relative">
          {/* Controls */}
          <div className="absolute top-1/2 -left-4 md:-left-12 -translate-y-1/2 z-10">
            <button onClick={prev} className="p-3 bg-white rounded-full shadow-md text-primary-700 hover:bg-primary-700 hover:text-white transition-colors" aria-label="Önceki">
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>
          <div className="absolute top-1/2 -right-4 md:-right-12 -translate-y-1/2 z-10">
            <button onClick={next} className="p-3 bg-white rounded-full shadow-md text-primary-700 hover:bg-primary-700 hover:text-white transition-colors" aria-label="Sonraki">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Carousel */}
          <div className="overflow-hidden px-4 py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                className="bg-white p-8 md:p-12 rounded-sm shadow-sm text-center relative"
              >
                <Quote className="w-12 h-12 text-gold-200 mx-auto mb-6" />
                <p className="text-lg md:text-xl text-gray-700 italic mb-8 leading-relaxed">
                  "{testimonials[currentIndex].content}"
                </p>
                <div>
                  <h4 className="font-bold text-gray-900">{testimonials[currentIndex].name}</h4>
                  <p className="text-sm text-primary-600 font-medium">{testimonials[currentIndex].role}</p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${
                  idx === currentIndex ? "bg-primary-700" : "bg-gray-300"
                }`}
                aria-label={`Yorum ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
