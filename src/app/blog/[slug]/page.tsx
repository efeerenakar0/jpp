import { Metadata } from "next";
import { notFound } from "next/navigation";
import { blogPosts } from "../page";
import { Calendar, User, Share2 } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const post = blogPosts.find((p) => p.slug === resolvedParams.slug);
  
  if (!post) return { title: "Yazı Bulunamadı" };
  
  return {
    title: `${post.title} | Jasmine Proje Pazarlama Blog`,
    description: post.excerpt,
  };
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPostPage({ params }: Props) {
  const resolvedParams = await params;
  const post = blogPosts.find((p) => p.slug === resolvedParams.slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-gray-900 mb-6 leading-tight">
              {post.title}
            </h1>
            <div className="flex items-center justify-center gap-6 text-gray-500 text-sm">
              <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/> {post.date}</span>
              <span className="flex items-center gap-2"><User className="w-4 h-4"/> Jasmine Editör Ekibi</span>
            </div>
          </div>

          <div className="relative w-full h-[400px] md:h-[500px] rounded-sm overflow-hidden mb-12">
            <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
          </div>

          <div className="prose prose-primary lg:prose-lg max-w-none text-gray-700">
            <p className="lead text-xl text-gray-600 font-medium mb-8">
              {post.excerpt}
            </p>
            
            <p>
              {/* Fake Content Placeholder */}
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed pulvinar ex vel quam tempus, vel tempor mauris fermentum. Phasellus id mi in orci dapibus dignissim. Alanya gayrimenkul piyasası son yıllarda özellikle yabancı yatırımcıların radarına girmiş durumda.
            </p>
            <h3>Bölgesel Analiz: Neden Kargıcak ve Mahmutlar?</h3>
            <p>
              Suspendisse potenti. Mauris vitae libero ac est accumsan suscipit. In hac habitasse platea dictumst. Proin tincidunt, lectus eget efficitur congue, nisi arcu pretium nulla, ac congue nisi urna ut elit. 
            </p>
            <ul>
              <li>Denize sıfır projelerin sunduğu eşsiz avantajlar.</li>
              <li>Yüksek kira getirisi ve amortisman süreleri.</li>
              <li>Sosyal donatılara sahip komplekslerin artan popülaritesi.</li>
            </ul>
            <blockquote>
              "Gayrimenkul sadece bir mülk değil, geleceğinize yaptığınız en sağlam yatırımdır. Doğru proje, doğru pazarlama ve şeffaf bir süreçle kazanç garantidir."
            </blockquote>
            <p>
              Donec vel lacinia diam. Curabitur convallis eros non mi eleifend, id dignissim dolor tincidunt. Vivamus sollicitudin purus ac tellus viverra scelerisque.
            </p>
          </div>

          <div className="border-t border-gray-200 mt-12 pt-8 flex items-center justify-between">
            <Link href="/blog" className="text-primary-700 font-medium hover:underline">
              &larr; Tüm Yazılara Dön
            </Link>
            <button className="flex items-center gap-2 text-gray-500 hover:text-primary-700 transition-colors">
              <Share2 className="w-5 h-5" />
              <span>Paylaş</span>
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
