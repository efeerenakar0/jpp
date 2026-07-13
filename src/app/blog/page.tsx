import { Metadata } from "next";
import Link from "next/link";
import { Calendar } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog & Haberler | Jasmine Proje Pazarlama",
  description: "Alanya gayrimenkul sektörü, yatırım tavsiyeleri ve güncel piyasa analizleri.",
};

export const blogPosts = [
  {
    id: 1,
    slug: "alanya-gayrimenkul-piyasasi-2025-beklentileri",
    title: "Alanya Gayrimenkul Piyasası: 2025 Beklentileri",
    excerpt: "Yeni yılda Alanya'da hangi bölgeler değer kazanacak? Yabancı yatırımcıların tercihleri nasıl şekilleniyor?",
    date: "12 Kasım 2024",
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 2,
    slug: "yabancilar-icin-turkiyede-ev-alma-rehberi",
    title: "Yabancılar İçin Türkiye'de Ev Alma Rehberi",
    excerpt: "Vatandaşlık şartları, tapu süreçleri ve oturum izni hakkında bilmeniz gereken tüm hukuki detaylar.",
    date: "28 Ekim 2024",
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: 3,
    slug: "dogru-projeye-yatirim-yapmanin-ipuclari",
    title: "Doğru Projeye Yatırım Yapmanın 5 Altın Kuralı",
    excerpt: "Topraktan projeye girerken dikkat etmeniz gerekenler ve riskleri minimize etmenin yolları.",
    date: "15 Ekim 2024",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800"
  }
];

export default function BlogPage() {
  return (
    <>
      <section className="bg-primary-950 text-white py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Blog & Sektörel Analizler</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Gayrimenkul dünyasındaki en son gelişmeleri, yatırım fırsatlarını ve bölge analizlerini takip edin.
          </p>
        </div>
      </section>

      <section className="py-20 bg-gray-50 min-h-[50vh]">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <article key={post.id} className="bg-white rounded-sm border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">
                <div className="relative h-56 overflow-hidden">
                  <img src={post.image} alt={post.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    <Calendar className="w-4 h-4" />
                    <span>{post.date}</span>
                  </div>
                  <h2 className="text-xl font-serif font-bold text-gray-900 mb-3">
                    <Link href={`/blog/${post.slug}`} className="hover:text-primary-700 transition-colors">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-gray-600 text-sm mb-6 line-clamp-3 flex-grow">
                    {post.excerpt}
                  </p>
                  <Link href={`/blog/${post.slug}`} className="text-gold-600 font-medium hover:text-gold-500 transition-colors inline-flex items-center gap-1 mt-auto">
                    Devamını Oku &rarr;
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
