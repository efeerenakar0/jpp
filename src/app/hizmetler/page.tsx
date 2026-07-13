import { Metadata } from "next";
import { siteContent } from "@/data/site-content";
import { BarChart, Building, PenTool, Megaphone, Users, Database } from "lucide-react";

export const metadata: Metadata = {
  title: "Hizmetlerimiz | Jasmine Proje Pazarlama",
  description: "İnşaat firmaları ve müteahhitler için A'dan Z'ye uçtan uca proje pazarlama hizmetleri.",
};

const iconMap: Record<string, React.ElementType> = {
  BarChart, Building, PenTool, Megaphone, Users, Database
};

export default function ServicesPage() {
  return (
    <>
      <section className="bg-primary-950 text-white py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Hizmetlerimiz</h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Sadece bir pazarlama ajansı değil, projenizin başarısı için çalışan stratejik ortağınızız.
          </p>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="space-y-24">
            {siteContent.services.map((service, index) => {
              const IconComponent = iconMap[service.icon] || Building;
              const isEven = index % 2 === 0;

              return (
                <div 
                  key={service.id} 
                  id={service.id}
                  className={`flex flex-col md:flex-row items-center gap-12 ${isEven ? '' : 'md:flex-row-reverse'}`}
                >
                  {/* Görsel/İkon Alanı Placeholder */}
                  <div className="w-full md:w-1/2 aspect-video bg-white rounded-sm shadow-xl flex items-center justify-center p-12 border border-gray-100 relative overflow-hidden group">
                     {/* Arkaplan Dekorasyonu */}
                     <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700"></div>
                     <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-gold-50 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700 delay-100"></div>
                     
                     <IconComponent className="w-32 h-32 text-primary-700 relative z-10" strokeWidth={1} />
                  </div>

                  <div className="w-full md:w-1/2">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 text-primary-700 rounded-sm mb-6">
                      <span className="font-serif font-bold text-xl">0{index + 1}</span>
                    </div>
                    <h2 className="text-3xl font-serif font-bold text-gray-900 mb-6">{service.title}</h2>
                    <p className="text-xl text-gray-600 mb-6 font-medium">
                      {service.shortDescription}
                    </p>
                    <p className="text-gray-600 leading-relaxed border-l-4 border-gold-400 pl-6 py-2">
                      {service.details}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
