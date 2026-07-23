import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { companyName, themeColor, logoUrl } = data;

    const zip = new AdmZip();

    // Basit bir emlak HTML şablonu oluştur
    const htmlContent = `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${companyName || 'Emlak Firması'}</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <header style="background-color: ${themeColor || '#2563eb'};">
        <div class="container">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo">` : `<h1>${companyName || 'Emlak Firması'}</h1>`}
            <nav>
                <a href="#home">Ana Sayfa</a>
                <a href="#portfolios">İlanlarımız</a>
                <a href="#contact">İletişim</a>
            </nav>
        </div>
    </header>

    <main>
        <section class="hero">
            <h2>Hayalinizdeki Evi Bulun</h2>
            <p>En iyi lokasyonlarda, en uygun fiyatlarla...</p>
        </section>

        <section id="portfolios" class="portfolios">
            <!-- İlanlar buraya API üzerinden veya manuel eklenecek -->
            <p style="text-align:center; padding: 50px;">İlanlarınız yakında burada sergilenecek.</p>
        </section>
    </main>

    <footer style="background-color: #1f2937; color: white; text-align: center; padding: 20px;">
        <p>&copy; 2026 ${companyName || 'Emlak Firması'}. Tüm Hakları Saklıdır.</p>
        <p>Altyapı: Jasmine Group Yazılımcı Modülü</p>
    </footer>
</body>
</html>
    `;

    const cssContent = `
* { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
body { background-color: #f9fafb; color: #111827; }
header { padding: 1rem 0; color: white; }
.container { max-w: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; }
.logo { max-height: 50px; }
nav a { color: white; text-decoration: none; margin-left: 20px; font-weight: 500; }
.hero { text-align: center; padding: 100px 20px; background-color: #e5e7eb; }
.hero h2 { font-size: 2.5rem; margin-bottom: 10px; }
    `;

    // Dosyaları ZIP içine ekle
    zip.addFile("index.html", Buffer.from(htmlContent, "utf8"));
    zip.addFile("style.css", Buffer.from(cssContent, "utf8"));

    // ZIP'i buffer olarak al
    const zipBuffer = zip.toBuffer();

    return new NextResponse(zipBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${(companyName || 'emlak_sitesi').replace(/\s+/g, '_')}.zip"`
      }
    });

  } catch (error: any) {
    console.error('ZIP Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
