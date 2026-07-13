"use client";

import { siteContent } from "@/data/site-content";

export default function Timeline() {
  return (
    <div className="relative border-l-2 border-primary-200 ml-4 md:ml-6 py-4">
      {siteContent.timeline.map((item, index) => (
        <div key={index} className="mb-12 relative pl-8 md:pl-12">
          {/* Timeline Dot */}
          <div className="absolute -left-[11px] top-1 w-5 h-5 rounded-full bg-gold-400 border-4 border-white shadow-sm"></div>
          
          <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4 mb-2">
            <span className="text-xl md:text-2xl font-serif font-bold text-primary-700">{item.year}</span>
            <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
          </div>
          <p className="text-gray-600 leading-relaxed max-w-2xl">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}
