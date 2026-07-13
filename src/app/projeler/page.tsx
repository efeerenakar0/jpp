import { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { MapPin, Bed, Maximize, Heart } from "lucide-react";

export const metadata: Metadata = {
  title: "Projeler | Jasmine Proje Pazarlama",
  description: "Alanya'daki en seçkin gayrimenkul projelerimizi keşfedin.",
};

const prisma = new PrismaClient();

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedParams = await searchParams;
  const statusFilter = typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined;
  
  // Note: For a fully dynamic search, we should use a Client Component for the filters
  // and pass the query params to the Server Component. This is a simplified hybrid approach.
  const projects = await prisma.project.findMany({
    where: {
      published: true,
      ...(statusFilter ? { status: statusFilter } : {})
    },
    include: { units: true }
  });

  // Fallback to static data if DB is empty
  let displayProjects = projects.length > 0 ? projects.map(p => ({
    ...p,
    types: p.units.map(u => u.type),
    area: p.units.length > 0 ? p.units[0].area : "N/A"
  })) : [];

  return (
    <>
      <section className="bg-primary-950 text-white py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Projelerimiz</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Satış ve pazarlamasını üstlendiğimiz özel gayrimenkul portföyümüz.
          </p>
        </div>
      </section>

      <section className="py-20 bg-gray-50 min-h-[50vh]">
        <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row gap-8">
          
          {/* Advanced Filter Sidebar */}
          <aside className="w-full md:w-64 shrink-0 bg-white p-6 rounded-md shadow-sm border border-gray-200 h-fit sticky top-24">
            <h3 className="font-bold text-lg mb-4 pb-2 border-b">Filtreler</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Arama</label>
                <input type="text" placeholder="Proje Adı veya Konum..." className="w-full p-2 border rounded-md text-sm" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Durum</label>
                <div className="space-y-2">
                  {["Tümü", "Satışta", "Yapım Aşamasında", "Tamamlandı"].map((status) => (
                    <label key={status} className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="radio" name="status" defaultChecked={status === "Tümü"} className="text-primary-600" />
                      {status}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Daire Tipi</label>
                <div className="space-y-2">
                  {["1+1", "2+1", "3+1", "Dubleks/Penthouse"].map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm text-gray-600">
                      <input type="checkbox" className="text-primary-600 rounded-sm border-gray-300" />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fiyat Aralığı (€)</label>
                <input type="range" min="50000" max="1000000" className="w-full" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>50k</span>
                  <span>1M+</span>
                </div>
              </div>
              
              <button className="w-full bg-primary-700 text-white p-2 rounded-md hover:bg-primary-800 transition">
                Sonuçları Filtrele
              </button>
            </div>
          </aside>

          {/* Project List */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {displayProjects.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-500">
                Veritabanında henüz proje bulunmuyor. Lütfen Seed scriptini çalıştırın veya Admin panelinden proje ekleyin.
              </div>
            ) : (
              displayProjects.map((project) => (
                <div
                  key={project.id}
                  className="group border border-gray-100 rounded-sm overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white flex flex-col relative"
                >
                  <button className="absolute top-4 right-4 z-20 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors shadow-sm">
                    <Heart className="w-4 h-4" />
                  </button>

                  <div className="relative h-64 overflow-hidden bg-gray-100">
                    <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur px-3 py-1 text-xs font-semibold text-primary-800 rounded-sm">
                      {project.status}
                    </div>
                    <img 
                      src={project.image} 
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  </div>

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

                    <div className="grid grid-cols-2 gap-y-3 border-t border-gray-100 pt-4 mt-auto mb-6">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Bed className="w-4 h-4 text-primary-600" />
                        <span className="truncate">{project.types?.[0] || '1+1'}+</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Maximize className="w-4 h-4 text-primary-600" />
                        <span className="truncate">{project.area}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link 
                        href={`/projeler/${project.slug}`}
                        className="flex-1 text-center py-2.5 bg-gray-50 hover:bg-primary-700 hover:text-white text-gray-800 font-medium text-sm rounded-sm transition-colors border border-gray-200 hover:border-primary-700"
                      >
                        İncele
                      </Link>
                      <button className="flex-1 py-2.5 bg-white hover:bg-gray-50 text-primary-700 font-medium text-sm rounded-sm transition-colors border border-primary-200">
                        Karşılaştır
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
