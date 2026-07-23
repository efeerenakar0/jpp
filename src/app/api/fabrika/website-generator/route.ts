import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { companyName, logoUrl, primaryColor, accentColor, phone, email, address, templateId } = await request.json();
    
    const website = await prisma.generatedWebsite.create({
      data: {
        companyName,
        logoUrl,
        primaryColor,
        accentColor,
        phone,
        email,
        address,
        templateId,
        status: 'generating'
      }
    });
    
    // Generate HTML
    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName} - Gayrimenkul</title>
    <style>
        :root {
            --primary: ${primaryColor || '#1a365d'};
            --accent: ${accentColor || '#c6a55a'};
            --text: #333;
            --bg: #f9f9f9;
        }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; color: var(--text); background: var(--bg); }
        header { background: var(--primary); color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 1.5rem; font-weight: bold; display: flex; align-items: center; gap: 10px; }
        .logo img { height: 40px; border-radius: 5px; }
        nav a { color: white; text-decoration: none; margin-left: 1.5rem; font-weight: 500; }
        nav a:hover { color: var(--accent); }
        .hero { background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80') center/cover; color: white; padding: 100px 20px; text-align: center; }
        .hero h1 { font-size: 3rem; margin-bottom: 20px; }
        .btn { background: var(--accent); color: white; padding: 12px 30px; text-decoration: none; border-radius: 30px; font-weight: bold; display: inline-block; transition: 0.3s; border: none; cursor: pointer; }
        .btn:hover { opacity: 0.9; transform: translateY(-2px); }
        .section { padding: 60px 20px; max-width: 1200px; margin: 0 auto; }
        .section-title { text-align: center; color: var(--primary); margin-bottom: 40px; font-size: 2rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px; }
        .card { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); transition: 0.3s; }
        .card:hover { transform: translateY(-5px); box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .card-img { height: 200px; background: #ddd; }
        .card-body { padding: 20px; }
        .card-title { font-size: 1.2rem; font-weight: bold; margin-bottom: 10px; color: var(--primary); }
        .card-price { color: var(--accent); font-weight: bold; font-size: 1.3rem; margin-bottom: 10px; }
        footer { background: #222; color: #aaa; padding: 40px 20px; text-align: center; }
        footer p { margin: 5px 0; }
        .contact-info { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; margin-bottom: 20px; }
    </style>
</head>
<body>
    <header>
        <div class="logo">
            ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} Logo">` : ''}
            ${companyName}
        </div>
        <nav>
            <a href="#about">Hakkımızda</a>
            <a href="#properties">Portföyümüz</a>
            <a href="#contact">İletişim</a>
        </nav>
    </header>

    <section class="hero">
        <h1>Hayalinizdeki Eve Giden Yol</h1>
        <p style="font-size: 1.2rem; max-width: 600px; margin: 0 auto 30px;">Profesyonel ekibimizle gayrimenkul yatırımlarınıza değer katıyoruz. Size en uygun portföyleri sunmak için buradayız.</p>
        <a href="#properties" class="btn">Portföyleri İncele</a>
    </section>

    <section id="about" class="section">
        <div style="text-align: center; max-width: 800px; margin: 0 auto;">
            <h2 class="section-title">Hakkımızda</h2>
            <p style="line-height: 1.8; font-size: 1.1rem; color: #555;">${companyName} olarak, yılların verdiği tecrübe ve güvenle sektörde öncü olmaya devam ediyoruz. Müşteri memnuniyetini her zaman ilk sıraya koyarak, hayallerinizdeki yaşam alanlarını sizlere sunuyoruz.</p>
        </div>
    </section>

    <section id="properties" class="section" style="background: white; padding-top: 80px; padding-bottom: 80px; max-width: none;">
        <div style="max-width: 1200px; margin: 0 auto;">
            <h2 class="section-title">Öne Çıkan Portföyler</h2>
            <div class="grid">
                <div class="card">
                    <div class="card-img" style="background: url('https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80') center/cover;"></div>
                    <div class="card-body">
                        <div class="card-price">5.500.000 TL</div>
                        <div class="card-title">Deniz Manzaralı Lüks Daire</div>
                        <p style="color: #666; margin-bottom: 15px;">3+1 • 140 m² • Merkezi Konum</p>
                        <button class="btn" style="width: 100%; padding: 10px;">Detayları Gör</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-img" style="background: url('https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80') center/cover;"></div>
                    <div class="card-body">
                        <div class="card-price">12.000.000 TL</div>
                        <div class="card-title">Müstakil Havuzlu Villa</div>
                        <p style="color: #666; margin-bottom: 15px;">5+2 • 350 m² • Doğa İçinde</p>
                        <button class="btn" style="width: 100%; padding: 10px;">Detayları Gör</button>
                    </div>
                </div>
                <div class="card">
                    <div class="card-img" style="background: url('https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=800&q=80') center/cover;"></div>
                    <div class="card-body">
                        <div class="card-price">3.200.000 TL</div>
                        <div class="card-title">Yatırımlık Fırsat Daire</div>
                        <p style="color: #666; margin-bottom: 15px;">2+1 • 85 m² • Site İçerisinde</p>
                        <button class="btn" style="width: 100%; padding: 10px;">Detayları Gör</button>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <footer id="contact">
        <h2 style="color: white; margin-bottom: 20px;">İletişim</h2>
        <div class="contact-info">
            ${phone ? `<div>📞 ${phone}</div>` : ''}
            ${email ? `<div>✉️ ${email}</div>` : ''}
            ${address ? `<div>📍 ${address}</div>` : ''}
        </div>
        <div style="margin-top: 30px; border-top: 1px solid #444; padding-top: 20px;">
            <p>&copy; ${new Date().getFullYear()} ${companyName}. Tüm hakları saklıdır.</p>
            <p style="font-size: 0.8rem; color: #777;">Powered by Jasmine AI Factory</p>
        </div>
    </footer>
</body>
</html>`;

    await prisma.generatedWebsite.update({
      where: { id: website.id },
      data: { status: 'ready' }
    });

    await prisma.notification.create({
      data: {
        type: 'WEBSITE_GENERATED',
        title: 'Web Sitesi Hazır',
        message: `${companyName} için oluşturduğunuz web sitesi yayınlanmaya hazır.`,
      }
    });

    return NextResponse.json({ websiteId: website.id, html, status: 'ready' });
  } catch (error) {
    console.error('Website generation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
