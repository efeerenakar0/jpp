import { Metadata } from "next";
import Timeline from "@/components/about/Timeline";

export const metadata: Metadata = {
  title: "Hakkımızda | Jasmine Nano Proje Pazarlama",
  description: "Alanya'nın ilk ve tek proje pazarlama firması Jasmine'in hikayesi, vizyonu ve ekibi.",
};

const team = [
  { name: "Ayşe Yılmaz", role: "Kurucu & CEO", image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400" },
  { name: "Caner Demir", role: "Satış Direktörü", image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400" },
  { name: "Selin Kaya", role: "Pazarlama Müdürü", image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400" },
  { name: "Tariq Ali", role: "Global Partnerlik Yöneticisi", image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400" }
];

export default function AboutPage() {
  return (
    <div className="bg-[#090d16] text-slate-100 min-h-screen pt-20">
      {/* Page Header */}
      <section className="relative py-20 text-center bg-slate-950 overflow-hidden border-b border-slate-800/80">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10 mx-auto px-4">
          <h1 className="text-4xl md:text-6xl font-serif font-black text-white mb-4">Hakkımızda</h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto font-medium">
            Türkiye&apos;nin turizm ve yatırım başkenti Alanya&apos;da otonom yapay zeka altyapısıyla gayrimenkul kurallarını yeniden yazıyoruz.
          </p>
        </div>
      </section>

      {/* Story & Vision */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block">Kurumsal Hikayemiz</span>
              <h2 className="text-3xl font-serif font-black text-white">Alanya&apos;nın İlk Proje Pazarlama Firması</h2>
              <div className="space-y-4 text-xs md:text-sm text-slate-300 leading-relaxed font-medium">
                <p>
                  Jasmine Proje Pazarlama, inşaat sektöründeki pazarlama boşluğunu doldurmak üzere kurulan Alanya&apos;nın <span className="font-bold text-cyan-300 underline underline-offset-4">ilk ve tek</span> otonom proje pazarlama şirketidir.
                </p>
                <p>
                  Müteahhit firmaların yüksek kaliteli projeler üretmesine rağmen satış ve pazarlamada yaşadığı zorlukları görerek yola çıktık. Amacımız, projenin çizim aşamasından itibaren satış ve pazarlamasını uçtan uca yönetmektir.
                </p>
                <p>
                  Sıradan bir emlak ofisi mantığıyla çalışmıyoruz. Tamamen tarafsız bir B2B ve B2C teknoloji köprüsü olarak hizmet veriyoruz.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 p-8 rounded-3xl border border-slate-800 backdrop-blur-2xl shadow-2xl relative">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-serif font-bold text-white mb-2 text-cyan-300">Vizyonumuz</h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Türk gayrimenkul sektörünü uluslararası alanda en yenilikçi biçimde temsil etmek; Alanya&apos;yı global gayrimenkul yatırımcılarının birinci tercihi yapmak.
                  </p>
                </div>
                
                <div className="border-t border-slate-800 pt-6">
                  <h3 className="text-xl font-serif font-bold text-white mb-2 text-cyan-300">Misyonumuz</h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    Geliştirdiğimiz otonom dijital altyapımız sayesinde müteahhitlerimize değer katarken, yatırımcılara en güvenli ve kârlı gayrimenkul deneyimini sunmak.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-slate-950 border-t border-b border-slate-800/80">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-serif font-black text-center text-white mb-16">Kilometre Taşlarımız</h2>
            <Timeline />
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif font-black text-white mb-3">Yönetim Kadromuz</h2>
            <p className="text-slate-400 text-xs max-w-2xl mx-auto font-medium">
              Sektörde deneyimli, vizyoner ve global düşünen uzman ekibimizle projelerinize değer katıyoruz.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="group text-center bg-slate-900/50 p-6 rounded-3xl border border-slate-800/80 hover:border-cyan-500/40 transition-all backdrop-blur-xl">
                <div className="relative w-36 h-36 mx-auto mb-4 rounded-2xl overflow-hidden border border-slate-700 group-hover:scale-105 transition-transform duration-500">
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-base font-bold text-white mb-1">{member.name}</h3>
                <p className="text-xs text-cyan-400 font-semibold">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
