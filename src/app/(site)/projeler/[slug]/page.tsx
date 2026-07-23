import { Metadata } from "next";
import { siteContent } from "@/data/site-content";
import { notFound } from "next/navigation";
import { MapPin, Bed, Maximize, Calendar, CheckCircle2, Download, FileText } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const project = siteContent.projects.find((p) => p.slug === resolvedParams.slug);
  
  if (!project) return { title: "Proje Bulunamadı" };
  
  return {
    title: `${project.name} | Jasmine Proje Pazarlama`,
    description: project.shortDescription,
  };
}

export async function generateStaticParams() {
  return siteContent.projects.map((project) => ({
    slug: project.slug,
  }));
}

export default async function ProjectDetailPage({ params }: Props) {
  const resolvedParams = await params;
  const project = siteContent.projects.find((p) => p.slug === resolvedParams.slug);

  if (!project) {
    notFound();
  }

  return (
    <>
      {/* Hero Gallery Placeholder */}
      <section className="relative h-[60vh] min-h-[400px] w-full bg-gray-900">
        <img 
          src={project.image} 
          alt={project.name} 
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full p-8 md:p-16 text-white">
          <div className="container mx-auto">
            <div className="inline-block px-4 py-1.5 mb-4 text-sm font-semibold bg-primary-600 rounded-sm">
              {project.status}
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-4">{project.name}</h1>
            <div className="flex items-center gap-2 text-lg text-gray-200">
              <MapPin className="w-5 h-5" />
              <span>{project.location}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            {/* Left Column (Details) */}
            <div className="lg:col-span-2 space-y-12">
              <div>
                <h2 className="text-3xl font-serif font-bold text-gray-900 mb-6">Proje Hakkında</h2>
                <p className="text-lg text-gray-600 leading-relaxed">
                  {project.shortDescription}
                  <br /><br />
                  {/* Ekstra sahte içerik */}
                  Modern yaşam standartlarını yeniden tanımlayan bu özel projemiz, lokasyonu ve mimari yapısıyla öne çıkıyor. Yüksek kaliteli malzemelerin ustalıkla kullanıldığı iç mekanlar, hem estetik hem de fonksiyonel bir yaşam sunmak üzere tasarlandı. 
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6">Özellikler & Donatılar</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {project.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-gray-50 rounded-sm border border-gray-100">
                      <CheckCircle2 className="w-5 h-5 text-primary-600 shrink-0" />
                      <span className="text-gray-700 font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6">Kat Planları (Örnek)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {project.types.map((type, i) => (
                    <div key={i} className="border border-gray-200 p-6 text-center rounded-sm hover:shadow-md transition-shadow">
                      <div className="w-full h-48 bg-gray-100 mb-4 flex items-center justify-center text-gray-400 border border-dashed border-gray-300">
                        <FileText className="w-8 h-8 opacity-50" />
                      </div>
                      <h4 className="text-lg font-bold text-gray-900">{type} Daire</h4>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column (Sidebar) */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                
                {/* Info Card */}
                <div className="bg-primary-950 text-white p-8 rounded-sm shadow-xl">
                  <h3 className="text-xl font-serif font-bold mb-6 border-b border-gray-800 pb-4">Proje Özeti</h3>
                  
                  <ul className="space-y-4 mb-8">
                    <li className="flex justify-between items-center">
                      <span className="text-gray-400 flex items-center gap-2"><Bed className="w-4 h-4"/> Daire Tipleri</span>
                      <span className="font-semibold">{project.types.join(", ")}</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-gray-400 flex items-center gap-2"><Maximize className="w-4 h-4"/> Büyüklük</span>
                      <span className="font-semibold">{project.area}</span>
                    </li>
                    <li className="flex justify-between items-center">
                      <span className="text-gray-400 flex items-center gap-2"><Calendar className="w-4 h-4"/> Teslim Tarihi</span>
                      <span className="font-semibold text-gold-400">{project.deliveryDate}</span>
                    </li>
                  </ul>

                  <div className="text-center p-4 bg-white/10 rounded-sm mb-6">
                    <span className="block text-sm text-gray-300 mb-1">Başlangıç Fiyatı</span>
                    <span className="text-2xl font-bold text-gold-400">{project.price}</span>
                  </div>

                  <button className="w-full bg-gold-500 hover:bg-gold-600 text-primary-950 font-bold py-3.5 rounded-sm transition-colors mb-3">
                    Fiyat Teklifi Al
                  </button>
                  <button className="w-full border border-white/20 hover:bg-white/10 text-white font-medium py-3 rounded-sm transition-colors flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> E-Katalog İndir
                  </button>
                </div>

                {/* Map Placeholder */}
                <div className="bg-gray-200 h-64 rounded-sm relative overflow-hidden flex items-center justify-center border border-gray-300">
                  <span className="text-gray-500 font-medium">Google Maps Embed</span>
                  {/* TODO: Gerçek iframe buraya eklenecek */}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </>
  );
}
