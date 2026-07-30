import { Metadata } from "next";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { blogPosts } from "./blog-posts";

export const metadata: Metadata = {
  title: "Blog & Haberler | Jasmine Proje Pazarlama",
  description: "Alanya gayrimenkul sektörü, yatırım tavsiyeleri ve güncel piyasa analizleri.",
};

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
