# Business CEO AI — Gayrimenkul Operasyon Sistemi

Business CEO AI; SEO, PWA, WhatsApp, CRM, pazarlama, belge ve yapay zekâ operasyonlarını tek çalışma alanında birleştiren Next.js uygulamasıdır.

## 🚀 Yeni Eklenen NPM Paketleri (Phase 2 & 3)

- \`prisma\` & \`@prisma/client\` (v5.21.1) - Veritabanı ORM.
- \`next-auth\` - Rol bazlı kimlik doğrulama.
- \`bcryptjs\` - Şifreleme.
- \`react-hot-toast\` - Bildirim sistemi.
- \`@tiptap/react\` & \`@tiptap/starter-kit\` - Zengin metin editörü (CMS).
- \`axios\` - API çağrıları.
- \`date-fns\` - Tarih formatlama.
- \`recharts\` - Grafik ve analizler.
- \`use-debounce\` - Arama performans optimizasyonu.

_(Not: Test kütüphaneleri \`vitest\` ve \`@playwright/test\` proje scale edildiğinde devDependencies olarak kurulmalıdır.)_

## 🔐 .env Değişkenleri (Ortam Değişkenleri)

Projeyi prodüksiyona almak için aşağıdaki değişkenlerin ayarlanması şarttır. `development` ortamında .env, `production` ortamında ise Vercel panelinden girilmelidir.

\`\`\`env

# Veritabanı

DATABASE_URL="postgresql://user:password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" # Supabase veya Neon üzerinden alınır.

# Kimlik Doğrulama

NEXTAUTH_URL="https://jasmineprojepazarlama.com" # Vercel üzerinde kendi domaininiz
NEXTAUTH_SECRET="kendi-guvenlik-anahtariniz" # \`openssl rand -base64 32\` ile üretin.

# E-Posta (Resend veya Nodemailer)

SMTP_HOST="smtp.example.com" # Resend/SendGrid paneli
SMTP_USER="user"
SMTP_PASS="pass"

# API & Entegrasyonlar

EXCHANGE_RATE_API_KEY="xxx" # exchangeratesapi.io üzerinden
NEXT_PUBLIC_MAPS_API_KEY="xxx" # Google Cloud Console

# Pazarlama Otomasyonu (Mock'tan gerçeğe geçiş için eklenecekler)

WHATSAPP_TOKEN="xxx" # Meta for Developers -> WhatsApp Cloud API
HUBSPOT_API_KEY="xxx" # HubSpot Developer Portal
ANTHROPIC_API_KEY="xxx" # Anthropic Console (AI Chatbot için)
\`\`\`

## 🧪 Test Komutları & CI/CD

Projede GitHub Actions kullanılarak otomatik bir CI (Continuous Integration) pipeline'ı kurulmuştur (\`.github/workflows/ci.yml\`). Her \`main\` dalına push yapıldığında veya PR açıldığında Lint, Prisma Generate ve Build adımları test edilir.

**Yerel Test Komutları:**

- \`npm run test\` - Vitest birim testlerini çalıştırır (hesaplayıcı mantıkları vb.)
- \`npm run test:e2e\` - Playwright ile uçtan uca senaryoları çalıştırır.

## 🎬 Stüdyo AI Sinematik Video operasyonu

Portföy Video Stüdyosu iki ayrı çalışma biçimi sunar: hızlı şablon video
tarayıcıda Remotion ile oluşturulur; **AI Sinematik Video** ise platformun
BytePlus ModelArk üzerindeki Seedance 2.0 hesabını ve kalıcı iş kuyruğunu
kullanır. Müşteriler API anahtarı girmez ve anahtar hiçbir zaman tarayıcıya
gönderilmez.

Üretim kurulumu:

1. BytePlus ModelArk hesabında Seedance 2.0 erişimini etkinleştirin ve sunucu API
   anahtarı oluşturun. Güncel model kimliği ve örnekler için
   [resmî Seedance 2.0 rehberini](https://docs.byteplus.com/en/docs/ModelArk/2291680)
   kullanın.
2. Vercel **Production** ortamına `BYTEPLUS_ARK_API_KEY`,
   `BYTEPLUS_SEEDANCE_MODEL`, `BYTEPLUS_ARK_BASE_URL`, `BLOB_READ_WRITE_TOKEN`
   ve `CRON_SECRET` değişkenlerini ekleyin. Anahtarı `NEXT_PUBLIC_` önekiyle
   tanımlamayın; kaynak koda, loga veya müşteri `.env` dosyasına koymayın.
3. Yeniden deploy edin. `npm run vercel-build`,
   `20260804170000_studio_video_jobs` migration'ını marker tablosuyla idempotent
   biçimde uygular; üretimde bunun yanında `prisma db push` çalıştırmayın.
4. `vercel.json`, `/api/cron/studio-worker` route'unu her dakika çağırır. Route
   yalnız `Authorization: Bearer <CRON_SECRET>` ile çalışır; aynı worker hem
   fotoğraf işlerini hem video kuyruğunu dengeli biçimde işler.

Tamamlanan MP4 sağlayıcının geçici adresinde bırakılmaz; sunucu tarafından
private Vercel Blob'a kopyalanır ve yalnız tenant/rol denetimli indirme route'u
üzerinden sunulur. Çıktı **7 gün** saklanır. Süresi dolan MP4 blob'u
`studio-worker` temizleme adımında kaldırılır; iş kaydı ise denetim amacıyla
`EXPIRED` durumunda ve çıktı anahtarı temizlenmiş olarak kalır. Bu nedenle
worker'ın düzenli çalışması hem üretim hem saklama politikası için zorunludur.

Anahtar yoksa arayüz AI Sinematik Video'yu hazır göstermez ve istek fail-closed
kalır; hızlı Remotion şablonu çalışmaya devam eder. Operasyon doğrulamasında
önce AI işinin `QUEUED -> GENERATING -> COMPLETED` ilerlediğini, ardından MP4'ün
yetkili kullanıcı tarafından oynatılıp indirilebildiğini ve yetkisiz/başka şirket
isteklerinin reddedildiğini kontrol edin. Anahtarın açığa çıkması halinde
BytePlus ve Blob token'larını hemen döndürün.

## ⏱️ Üretim operasyon zamanlayıcısı

Gösterim görevi ACK süreleri, patron eskalasyonu, randevu teyidi ve görüşme
sonucu akışları dakikalarla ölçülen SLA'lara sahiptir. Bu nedenle
`/api/cron/digital-manager`, `/api/cron/appointment-reminders` ve
`/api/cron/studio-worker` üretimde her dakika çalışır. Route'lar `CRON_SECRET`
ile korunur ve aynı çağrı birden fazla kez gelse de durum/benzersizlik
kontrolleri sayesinde idempotent kalacak şekilde tasarlanmıştır.

Vercel'in güncel sınırına göre Hobby planı bir cron'u yalnız günde bir kez
çalıştırabilir; daha sık cron ifadeleri Hobby deployment'ını reddeder. Bu
repository'deki `vercel.json` dakikalık işler nedeniyle **Vercel Pro veya
Enterprise** varsayar. Hobby ile yalnız geliştirme/deneme yapılacaksa dakikalık
işleri `vercel.json` üzerinden deploy etmeyin; bunun yerine route'ları her dakika
`Authorization: Bearer <CRON_SECRET>` başlığıyla çağıran güvenilir haricî bir
zamanlayıcı/worker kullanın. Preview deployment'larda Vercel Cron çalışmaz.

Plan sınırları: [Vercel Cron Jobs kullanım ve fiyatlandırma](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## 📈 SEO & İçerik Stratejisi

Arama motoru görünürlüğünü artırmak için dinamik \`sitemap.xml\` aktif edilmiştir.

### Hedeflenen 20 Blog Başlığı (Anahtar Kelime Odaklı)

**Veritabanına Seed Edilmiş Olanlar (Yazıldı ✅):**

1. ✅ Alanya'da Yatırım İçin En İyi Bölgeler: 2025 Rehberi
2. ✅ Yabancılar İçin Türkiye'de Ev Alma ve Vatandaşlık Süreçleri
3. ✅ Topraktan (Off-Plan) Projeye Girmek: Avantajlar ve Riskler
4. ✅ Alanya'da Kısa Dönem Kiralama (Airbnb) ve Yeni Yasalar
5. ✅ Alanya'da Deniz Manzaralı Ev Almanın 5 Altın Kuralı

**Yazılacak Diğer Başlıklar (SEO Backlog):** 6. Gayrimenkul Yatırım Getirisi (ROI) Nasıl Hesaplanır? 7. Kargıcak vs. Mahmutlar: Hangisine Yatırım Yapmalı? 8. Türkiye'de Tapu Masrafları ve Vergi Avantajları 9. Emeklilik Sonrası Alanya'da Yaşam: Kapsamlı Rehber 10. Emlak Alırken Müteahhit Firması Nasıl Seçilir? 11. Alanya'da Kiralama Garantili Projeler Gerçekten Karlı mı? 12. Gayrimenkul Değerleme Raporu Nedir ve Nasıl Alınır? 13. Dövizle Kira Getirisi Sağlamanın Güvenli Yolları 14. Alanya'da Akıllı Ev Sistemli Lüks Projeler 15. İkametgah Amaçlı Gayrimenkul Alımında 200.000$ Sınırı 16. Alanya Gayrimenkul Piyasası Neden Avrupalıların Gözdesi? 17. Ev Alırken Karşılaşılan En Sık 10 Hukuki Hata 18. Emlakçı (Broker) Üzerinden Ev Almanın Avantajları 19. Alanya'da Havalimanına Yakın Projeler ve Fiyat Analizi 20. Site Aidatları ve Sosyal Donatı Yönetimi Hakkında Bilinmesi Gerekenler

## 📱 PWA & Mobil Deneyim

Site Progressive Web App (PWA) standartlarına uygun hale getirilmiştir:

- \`public/manifest.json\` eklendi.
- Mobilde parmakla erişimi kolaylaştıran "Bottom Navigation Bar" \`layout.tsx\` içine entegre edildi.
- **PWA Kurulum Testi:** Mobil cihazınızdan (Chrome/Safari) siteye girdiğinizde "Ana Ekrana Ekle" (Add to Home Screen) seçeneği belirecek ve site native bir uygulama gibi tam ekran çalışacaktır. Offline önbellekleme (Service Worker) için \`next-pwa\` paketi kurulduğunda (\`npm install next-pwa\`) çevrimdışı çalışmaya başlayacaktır.

## 🎯 Canlıya Alma (Deployment) Öncesi Aksiyon Listesi (Priority Checklist)

Prodüksiyona çıkmadan hemen önce aşağıdaki entegrasyonların "Mock" (sahte) moddan "Gerçek" moda alınması gerekir:

1. [ ] **Veritabanı:** Supabase'den alınan gerçek \`DATABASE_URL\`'in Vercel'e girilmesi ve \`npx prisma db push\` yapılması.
2. [ ] **AI Chatbot:** \`src/app/api/chat/route.ts\` içine gerçek Anthropic/OpenAI API anahtarı ile istek atılması.
3. [ ] **CRM:** \`src/app/api/crm/sync/route.ts\` içindeki webhook'un HubSpot/Pipedrive API'sine bağlanması.
4. [ ] **Analytics & İzleme:** Google Analytics kodu eklenmesi ve Vercel üzerinde [Sentry](https://sentry.io) entegrasyonunun aktif edilmesi.
5. [ ] **E-Posta:** \`src/app/api/contact/route.ts\` form gönderimlerinde gerçek SMTP/Resend mail atma fonksiyonunun çağrılması.
