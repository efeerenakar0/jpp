import fs from 'fs';
import path from 'path';

const basePath = '/Users/efeerenakar/.gemini/antigravity/scratch/jasmine-proje';

const files = {
  'src/app/sitemap.ts': `import { MetadataRoute } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://jasmineprojepazarlama.com';

  const projects = await prisma.project.findMany({ where: { published: true } });
  const posts = await prisma.blogPost.findMany({ where: { published: true } });

  const projectUrls = projects.map((p) => ({
    url: \`\${baseUrl}/projeler/\${p.slug}\`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as any,
    priority: 0.8,
  }));

  const postUrls = posts.map((p) => ({
    url: \`\${baseUrl}/blog/\${p.slug}\`,
    lastModified: p.updatedAt,
    changeFrequency: 'monthly' as any,
    priority: 0.6,
  }));

  const staticUrls = [
    '',
    '/hakkimizda',
    '/projeler',
    '/hizmetler',
    '/is-ortakligi',
    '/neden-alanya',
    '/iletisim',
    '/sss',
    '/blog',
  ].map((route) => ({
    url: \`\${baseUrl}\${route}\`,
    lastModified: new Date(),
    changeFrequency: 'daily' as any,
    priority: route === '' ? 1.0 : 0.8,
  }));

  return [...staticUrls, ...projectUrls, ...postUrls];
}
`,
  'prisma/seed-blog.ts': `import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const posts = [
    {
      slug: 'alanya-yatirim-icin-en-iyi-bolgeler-2025',
      title: 'Alanya\\'da Yatırım İçin En İyi Bölgeler: 2025 Rehberi',
      excerpt: 'Kargıcak, Mahmutlar, Oba ve Kestel bölgelerinin detaylı yatırım analizleri ve getiri potansiyelleri.',
      content: '<p>Alanya, son yıllarda sadece bir tatil destinasyonu olmakla kalmayıp, küresel ölçekte gayrimenkul yatırımcılarının gözdesi haline gelmiştir. Özellikle 2025 projeksiyonlarına bakıldığında bazı bölgeler ön plana çıkmaktadır.</p><h2>Kargıcak: Premium Lüks Yaşam</h2><p>Yeni havalimanı yoluna yakınlığı ve düşük katlı lüks villa/rezidans imarı ile Kargıcak, A+ yatırımcıların tercihidir.</p><h2>Mahmutlar: Hızlı Amortisman</h2><p>Yoğun göçmen nüfusu ve yüksek kira getirisi ile Mahmutlar, kısa vadeli ROI hedefleyen yatırımcılar için idealdir.</p>',
      image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=800',
      published: true,
    },
    {
      slug: 'yabancilar-icin-turkiyede-ev-alma-ve-vatandaslik',
      title: 'Yabancılar İçin Türkiye\\'de Ev Alma ve Vatandaşlık Süreçleri',
      excerpt: '400.000 USD yatırım şartı, tapu işlemleri ve ikametgah izinleri hakkında hukuki rehber.',
      content: '<p>Türkiye\\'de gayrimenkul edinimi yoluyla Türk Vatandaşlığı kazanılması süreci 2024 yılında güncellenen yasalarla belirli standartlara bağlanmıştır.</p><h3>Vatandaşlık Şartları</h3><ul><li>En az 400.000 USD değerinde gayrimenkul alımı</li><li>3 yıl satılamaz şerhi konulması</li></ul>',
      image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800',
      published: true,
    },
    {
      slug: 'topraktan-projeye-girmek-avantajlar-ve-riskler',
      title: 'Topraktan (Off-Plan) Projeye Girmek: Avantajlar ve Riskler',
      excerpt: 'Lansman öncesi fiyatlardan yararlanırken dikkat edilmesi gereken müteahhit güvenceleri.',
      content: '<p>Topraktan projeye girmek (off-plan yatırım), bitmiş bir eve göre %20-30 arasında fiyat avantajı sağlar. Ancak bu avantaj beraberinde riskler de getirir.</p><h3>Avantajlar</h3><p>Düşük giriş maliyeti ve yüksek değer artışı. Taksitli ödeme kolaylığı.</p><h3>Riskler ve Alınacak Önlemler</h3><p>Proje tesliminin gecikmesi veya müteahhitin iflası. Bu nedenle projeyi yapan firmanın geçmiş referansları ve finansal gücü hayati önem taşır. Jasmine Proje Pazarlama olarak sadece referansları güçlü projeleri listeliyoruz.</p>',
      image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=800',
      published: true,
    },
    {
      slug: 'alanyada-kisa-donem-kiralama-airbnb-yasasi',
      title: 'Alanya\\'da Kısa Dönem Kiralama (Airbnb) ve Yeni Yasalar',
      excerpt: '100 günden kısa süreli kiralamalar için gerekli olan Turizm Amaçlı Kiralama Belgesi nasıl alınır?',
      content: '<p>Türkiye\\'de 2024 yılı itibarıyla kısa dönem kiralama pazarı yeni düzenlemelere tabi tutulmuştur. Artık "Turizm Amaçlı Kiralama İzin Belgesi" zorunludur.</p>',
      image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800',
      published: true,
    },
    {
      slug: 'deniz-manzarali-ev-almanin-5-altin-kurali',
      title: 'Alanya\\'da Deniz Manzaralı Ev Almanın 5 Altın Kuralı',
      excerpt: 'Kot farkı, ön kapanma riski ve imar planı incelemesinin önemi.',
      content: '<p>Herkes denize karşı uyanmak ister. Ancak bir evin manzarasının gelecekte de kapanmayacağından emin olmak uzmanlık gerektirir.</p>',
      image: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&q=80&w=800',
      published: true,
    }
  ]

  for (const post of posts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {},
      create: post,
    })
  }

  console.log('Blog Seed completed.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
`
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(basePath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Created:', relPath);
}
