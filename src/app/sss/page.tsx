"use client";

import { useState } from "react";
import { siteContent } from "@/data/site-content";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>("cat0-0");

  const toggle = (id: string) => {
    setOpenIndex(openIndex === id ? null : id);
  };

  return (
    <>
      <section className="bg-primary-950 text-white py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Sık Sorulan Sorular</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Yatırımcılarımız ve iş ortaklarımızdan gelen en sık soruların yanıtları.
          </p>
        </div>
      </section>

      <section className="py-20 bg-white min-h-[50vh]">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          {siteContent.faq.map((category, catIndex) => (
            <div key={catIndex} className="mb-12">
              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-6 pb-2 border-b-2 border-primary-100">
                {category.category}
              </h2>
              
              <div className="space-y-4">
                {category.questions.map((item, qIndex) => {
                  const id = `cat${catIndex}-${qIndex}`;
                  const isOpen = openIndex === id;
                  
                  return (
                    <div 
                      key={qIndex} 
                      className={`border rounded-sm overflow-hidden transition-colors ${isOpen ? 'border-primary-300 bg-primary-50/50' : 'border-gray-200 bg-white'}`}
                    >
                      <button
                        onClick={() => toggle(id)}
                        className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                      >
                        <span className="font-semibold text-gray-900 pr-4">{item.q}</span>
                        {isOpen ? (
                          <ChevronUp className="w-5 h-5 text-primary-600 shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                        )}
                      </button>
                      
                      {isOpen && (
                        <div className="p-5 pt-0 text-gray-600 leading-relaxed border-t border-primary-100/50">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          
          <div className="mt-16 bg-gray-50 p-8 rounded-sm text-center border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Başka bir sorunuz mu var?</h3>
            <p className="text-gray-600 mb-6">Aradığınız cevabı bulamadıysanız bizimle doğrudan iletişime geçebilirsiniz.</p>
            <a href="/iletisim" className="inline-block bg-primary-700 text-white px-8 py-3 rounded-sm font-medium hover:bg-primary-800 transition-colors">
              Bize Ulaşın
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
