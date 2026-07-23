import { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { MapPin, Bed, Maximize, Heart, Sparkles, Filter, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Projelerimiz | Jasmine Nano Proje Pazarlama",
  description: "Alanya ve Akdeniz bölgesindeki en seçkin lüks konut ve villa projelerini keşfedin.",
};

const prisma = new PrismaClient();

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const resolvedParams = await searchParams;
  const statusFilter = typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined;
  
  const projects = await prisma.project.findMany({
    where: {
      published: true,
      ...(statusFilter ? { status: statusFilter } : {})
    },
    include: { units: true }
  });

  let displayProjects = projects.length > 0 ? projects.map(p => ({
    ...p,
    types: p.units.map(u => u.type),
    area: p.units.length > 0 ? p.units[0].area : "N/A"
  })) : [];

  return (
    <div className="bg-[#090d16] text-slate-100 min-h-screen pt-20">
      {/* Header Banner */}
      <section className="relative py-20 text-center bg-slate-950 overflow-hidden border-b border-slate-800/80">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="container relative z-10 mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Alanya Özel Portföy Seçkisi</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-black text-white mb-4">Seçkin Projelerimiz</h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto font-medium">
            Satış ve pazarlamasını otonom dijital altyapımızla üstlendiğimiz yüksek prim potansiyelli lüks konutlar.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6 flex flex-col md:flex-row gap-8">
          
          {/* Filter Sidebar - Stitch Glass */}
          <aside className="w-full md:w-72 shrink-0 bg-slate-900/80 p-6 rounded-3xl border border-slate-800 backdrop-blur-2xl h-fit sticky top-28 shadow-2xl">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-800 text-white font-black text-sm uppercase tracking-wider">
              <Filter className="w-4 h-4 text-cyan-400" />
              <span>Arama Filtreleri</span>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Proje Adı veya Konum</label>
                <div className="relative">
                  <input type="text" placeholder="İçerikte ara..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white outline-none focus:border-cyan-400 font-medium" />
                  <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Proje Durumu</label>
                <div className="space-y-2">
                  {["Tümü", "Satışta", "Yapım Aşamasında", "Tamamlandı"].map((status) => (
                    <label key={status} className="flex items-center gap-2.5 text-xs text-slate-300 font-medium cursor-pointer">
                      <input type="radio" name="status" defaultChecked={status === "Tümü"} className="accent-cyan-400" />
                      {status}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Daire Tipi</label>
                <div className="space-y-2">
                  {["1+1", "2+1", "3+1", "Dubleks / Penthouse"].map((type) => (
                    <label key={type} className="flex items-center gap-2.5 text-xs text-slate-300 font-medium cursor-pointer">
                      <input type="checkbox" className="accent-cyan-400 rounded" />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2">Fiyat Aralığı (€)</label>
                <input type="range" min="50000" max="1000000" className="w-full accent-cyan-400" />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
                  <span>€50k</span>
                  <span>€1M+</span>
                </div>
              </div>
              
              <button className="w-full py-3 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95 cursor-pointer">
                Sonuçları Uygula
              </button>
            </div>
          </aside>

          {/* Project List */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {displayProjects.length === 0 ? (
              <div className="col-span-full py-20 text-center text-slate-500 text-xs font-medium bg-slate-900/40 rounded-3xl border border-slate-800">
                Veritabanında yayınlanmış proje bulunmuyor.
              </div>
            ) : (
              displayProjects.map((project) => (
                <div
                  key={project.id}
                  className="group border border-slate-800/80 hover:border-cyan-500/50 rounded-3xl overflow-hidden transition-all duration-300 bg-slate-900/50 flex flex-col relative shadow-2xl hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] backdrop-blur-xl"
                >
                  <button className="absolute top-4 right-4 z-20 w-8 h-8 bg-slate-950/80 backdrop-blur rounded-full flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors border border-white/10 shadow-md">
                    <Heart className="w-4 h-4" />
                  </button>

                  <div className="relative h-60 overflow-hidden bg-slate-950">
                    <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur border border-cyan-500/30 px-3 py-1 text-[10px] font-black text-cyan-300 rounded-full shadow-lg">
                      {project.status}
                    </div>
                    <img 
                      src={project.image} 
                      alt={project.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  </div>

                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2.5 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{project.location}</span>
                    </div>
                    
                    <h3 className="text-lg font-serif font-black text-white mb-2 group-hover:text-cyan-300 transition-colors">
                      <Link href={`/projeler/${project.slug}`}>
                        {project.name}
                      </Link>
                    </h3>

                    <p className="text-slate-400 text-xs mb-6 line-clamp-2 leading-relaxed font-medium">
                      {project.shortDescription}
                    </p>

                    <div className="grid grid-cols-2 gap-y-3 border-t border-slate-800/80 pt-4 mt-auto mb-6">
                      <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                        <Bed className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="truncate">{project.types?.[0] || '1+1'}+</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                        <Maximize className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="truncate">{project.area}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link 
                        href={`/projeler/${project.slug}`}
                        className="flex-1 text-center py-3 bg-gradient-to-r from-cyan-400 to-teal-500 hover:from-cyan-300 hover:to-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md active:scale-95"
                      >
                        İncele
                      </Link>
                      <button className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-2xl transition-colors border border-slate-700">
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
    </div>
  );
}
