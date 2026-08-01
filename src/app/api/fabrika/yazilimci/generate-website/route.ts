import AdmZip from 'adm-zip';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireFabrikaAccount } from '@/lib/fabrika-session';
import { buildWebsiteIntegrationPrompt } from '@/lib/website-integration';

const requestSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  logoUrl: z.union([z.string().trim().url(), z.literal('')]).optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeFileName(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLocaleLowerCase('en-US') || 'emlak_sitesi'
  );
}

export async function POST(request: Request) {
  try {
    const account = await requireFabrikaAccount();
    const input = requestSchema.parse(await request.json());
    const companyName = escapeHtml(input.companyName);
    const logoUrl = input.logoUrl ? escapeHtml(input.logoUrl) : '';
    const apiBaseUrl = new URL(request.url).origin;
    const connectorPrompt = `${buildWebsiteIntegrationPrompt({
      companyName: input.companyName,
      apiBaseUrl,
    })}

Yeni site projesi için ek teslim kuralları:
- ZIP içindeki index.html ve style.css yalnızca görsel başlangıç referansıdır; üretim sitesini mevcut teknoloji seçimine göre yeniden kur.
- Portföy liste ve detay tasarımını bu başlangıç temasının renk, tipografi, boşluk ve kart sistemiyle birebir uyumlu tut.
- Yalnızca ACTIVE durumundaki portföyleri halka açık sayfalarda göster; diğer durumları yönetim tarafında tut.
- Hosting sağlayıcısına uygun ortam değişkeni, build ve deploy belgelerini ekle.
- API anahtarı üretildikten sonra [TEK_SEFERLIK_API_ANAHTARI] yer tutucusunu yalnızca sunucu ortamında kullan.`;

    const htmlContent = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${companyName}</title>
  <meta name="description" content="${companyName} güncel gayrimenkul portföyleri" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="site-header">
    <a class="brand" href="#anasayfa">
      ${logoUrl ? `<img src="${logoUrl}" alt="${companyName} logosu" />` : `<span>${companyName}</span>`}
    </a>
    <nav aria-label="Ana menü"><a href="#portfoyler">Portföyler</a><a href="#iletisim">İletişim</a></nav>
  </header>
  <main id="anasayfa">
    <section class="hero">
      <p class="eyebrow">GÜNCEL PORTFÖYLER</p>
      <h1>Doğru gayrimenkulü güvenle bulun.</h1>
      <p>Satılık ve kiralık seçenekleri tek yerde inceleyin.</p>
      <a class="button" href="#portfoyler">Portföyleri incele</a>
    </section>
    <section id="portfoyler" class="section">
      <div class="section-heading"><div><p class="eyebrow">PORTFÖYLER</p><h2>Öne çıkan ilanlar</h2></div><span>Jasmine ile canlı eşitlenir</span></div>
      <div id="portfolio-grid" class="portfolio-grid" aria-live="polite">
        <article class="empty-state"><h3>Bağlantı kurulmaya hazır</h3><p>Codex entegrasyon promptunu uyguladıktan sonra aktif portföyler burada otomatik görünür.</p></article>
      </div>
    </section>
  </main>
  <footer id="iletisim"><strong>${companyName}</strong><span>Profesyonel gayrimenkul danışmanlığı</span></footer>
</body>
</html>`;

    const cssContent = `:root{--brand:${input.themeColor};--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--surface:#f8fafc}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#fff;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.site-header{min-height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 clamp(24px,6vw,96px);border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);z-index:10}.brand{font-weight:800;color:var(--ink);text-decoration:none}.brand img{display:block;max-height:44px;max-width:190px}nav{display:flex;gap:24px}nav a{color:#334155;text-decoration:none;font-size:14px;font-weight:650}.hero{padding:clamp(72px,12vw,150px) clamp(24px,8vw,128px);background:linear-gradient(135deg,var(--surface),#fff)}.hero h1{max-width:820px;margin:12px 0 18px;font-size:clamp(40px,7vw,84px);line-height:1.02;letter-spacing:-.05em}.hero>p:not(.eyebrow){max-width:580px;color:var(--muted);font-size:18px;line-height:1.7}.eyebrow{margin:0;color:var(--brand);font-size:12px;font-weight:850;letter-spacing:.14em}.button{display:inline-flex;margin-top:24px;padding:14px 20px;border-radius:10px;background:var(--brand);color:white;text-decoration:none;font-weight:750}.section{padding:clamp(64px,9vw,112px) clamp(24px,8vw,128px)}.section-heading{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:32px}.section-heading h2{margin:8px 0 0;font-size:clamp(30px,4vw,48px);letter-spacing:-.035em}.section-heading span,.empty-state p,footer span{color:var(--muted)}.portfolio-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.empty-state{grid-column:1/-1;padding:48px;border:1px dashed #cbd5e1;border-radius:16px;background:var(--surface);text-align:center}.empty-state h3{margin:0 0 8px}footer{display:flex;justify-content:space-between;gap:20px;padding:32px clamp(24px,8vw,128px);border-top:1px solid var(--line)}@media(max-width:760px){.site-header{padding:0 20px}.portfolio-grid{grid-template-columns:1fr}.section-heading,footer{align-items:flex-start;flex-direction:column}nav{gap:14px}.hero,.section{padding-left:20px;padding-right:20px}}`;

    const zip = new AdmZip();
    zip.addFile('index.html', Buffer.from(htmlContent, 'utf8'));
    zip.addFile('style.css', Buffer.from(cssContent, 'utf8'));
    zip.addFile('JASMINE_CODEX_PROMPT.md', Buffer.from(connectorPrompt, 'utf8'));
    zip.addFile(
      'README.md',
      Buffer.from(
        `# ${input.companyName}\n\nBu paket görsel başlangıç şablonu ve Jasmine Website Connector v1 Codex promptunu içerir. Üretim entegrasyonu için JASMINE_CODEX_PROMPT.md dosyasındaki adımları uygulayın. API anahtarını hiçbir zaman tarayıcı koduna eklemeyin.`,
        'utf8'
      )
    );

    const generatedSite = await prisma.generatedWebsite.create({
      data: {
        companyAccountId: account.id,
        companyName: input.companyName,
        logoUrl: input.logoUrl || null,
        primaryColor: input.themeColor,
        accentColor: '#10b981',
        promptTemplate: connectorPrompt,
        status: 'ready',
      },
      select: { id: true },
    });

    return new NextResponse(new Uint8Array(zip.toBuffer()), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeFileName(input.companyName)}_website.zip"`,
        'Cache-Control': 'no-store',
        'X-Jasmine-Generated-Site-Id': generatedSite.id,
      },
    });
  } catch (error) {
    console.error('[Website generator]', error);
    const message =
      error instanceof z.ZodError
        ? 'Site bilgileri geçersiz veya eksik.'
        : error instanceof Error
          ? error.message
          : 'Site paketi oluşturulamadı.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
