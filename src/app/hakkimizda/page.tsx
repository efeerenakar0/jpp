import { Metadata } from "next";
import Timeline from "@/components/about/Timeline";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Hakkımızda | Jasmine Proje Pazarlama",
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
    <>
      {/* Page Header */}
      <section className="bg-primary-950 text-white py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Hakkımızda</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Türkiye'nin turizm ve yatırım başkenti Alanya'da sektörün kurallarını yeniden yazıyoruz.
          </p>
        </div>
      </section>

      {/* Story & Vision */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-serif font-bold text-gray-900 mb-6">Şirket Hikayemiz</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>
                  Jasmine Proje Pazarlama, inşaat sektöründeki pazarlama boşluğunu doldurmak üzere kurulan Alanya'nın <span className="font-semibold text-primary-700">ilk ve tek</span> proje pazarlama firmasıdır.
                </p>
                <p>
                  Müteahhit firmaların yüksek kaliteli projeler üretmesine rağmen satış ve pazarlamada yaşadığı zorlukları görerek yola çıktık. Amacımız, projenin henüz çizim aşamasından başlayarak anahtar teslimine kadar geçen süreci uçtan uca yönetmek.
                </p>
                <p>
                  Kendi inşaat projelerimizle veya direkt emlak ofisi mantığıyla çalışmıyoruz. Tamamen tarafsız bir B2B ve B2C köprüsü olarak hizmet veriyoruz.
                </p>
              </div>
            </div>
            <div className="bg-primary-50 p-8 md:p-12 rounded-sm border-l-4 border-gold-500">
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4">Vizyonumuz</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Türk gayrimenkul sektörünü uluslararası arenada en yenilikçi ve güvenilir şekilde temsil etmek; Alanya'yı global gayrimenkul yatırımcılarının birinci tercihi haline getirmek.
              </p>
              
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4">Misyonumuz</h3>
              <p className="text-gray-600 leading-relaxed">
                Geliştirdiğimiz teknolojik altyapılar ve küresel ağımız sayesinde müteahhitlerimize değer katarken, yatırımcılara da en güvenli, şeffaf ve kârlı gayrimenkul yatırım deneyimini sunmak.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-serif font-bold text-center text-gray-900 mb-16">Kilometre Taşlarımız</h2>
            <Timeline />
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-4">Yönetim Kadromuz</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Sektörde deneyimli, vizyoner ve global düşünen uzman ekibimizle projelerinize değer katıyoruz.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <div key={index} className="group text-center">
                <div className="relative w-48 h-48 mx-auto mb-6 rounded-full overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-500">
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{member.name}</h3>
                <p className="text-primary-600 font-medium">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
