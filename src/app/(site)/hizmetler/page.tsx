import { Metadata } from "next";
import { siteContent } from "@/data/site-content";
import { BarChart, Building, PenTool, Megaphone, Users, Database, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Hizmetlerimiz | Jasmine Nano Proje Pazarlama",
  description: "İnşaat firmaları ve müteahhitler için A'dan Z'ye uçtan uca proje pazarlama hizmetleri.",
};

const iconMap: Record<string, React.ElementType> = {
  BarChart, Building, PenTool, Megaphone, Users, Database
};

export default function ServicesPage() {
  return (
    <div className="bg-[#090d16] text-slate-100 min-h-screen pt-20">
      <section className="relative py-20 text-center bg-slate-950 overflow-hidden border-b border-slate-800/80">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10 mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Stratejik Proje Pazarlama Hizmetleri</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-black text-white mb-4">Hizmetlerimiz</h1>
          <p className="text-sm md:text-base text-slate-400 max-w-3xl mx-auto font-medium">
            Sadece bir pazarlama ajansı değil, projenizin otonom başarısı için çalışan stratejik ortağınızız.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="space-y-20">
            {siteContent.services.map((service, index) => {
              const IconComponent = iconMap[service.icon] || Building;
              const isEven = index % 2 === 0;

              return (
                <div 
                  key={service.id} 
                  id={service.id}
                  className={`flex flex-col md:flex-row items-center gap-12 ${isEven ? '' : 'md:flex-row-reverse'}`}
                >
                  <div className="w-full md:w-1/2 aspect-video bg-slate-900/80 rounded-3xl border border-slate-800 backdrop-blur-2xl shadow-2xl flex items-center justify-center p-12 relative overflow-hidden group">
                     <div className="absolute -right-20 -top-20 w-64 h-64 bg-cyan-500/10 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700 pointer-events-none" />
                     <IconComponent className="w-28 h-28 text-cyan-400 relative z-10 stroke-[1.2] group-hover:scale-110 transition-transform" />
                  </div>

                  <div className="w-full md:w-1/2 space-y-4">
                    <div className="inline-flex items-center justify-center w-10 h-10 bg-slate-900 text-cyan-400 border border-cyan-500/30 rounded-2xl text-xs font-black">
                      0{index + 1}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-serif font-black text-white">{service.title}</h2>
                    <p className="text-sm text-slate-300 font-bold leading-relaxed">
                      {service.shortDescription}
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-cyan-400 pl-4 py-1 font-medium">
                      {service.details}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
