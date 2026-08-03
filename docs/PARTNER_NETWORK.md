# Global Partner Ağı

Bu modül, şirket bazlı partner keşfi, kanıta dayalı puanlama, insan onaylı e-posta erişimi ve partner hattı takibini tek bir tenant güvenlik sınırı içinde yürütür.

## Üretim davranışı

- Her kayıt `companyAccountId` ile izole edilir. Fabrika API'leri mevcut patron/çalışan oturumunu sunucuda doğrular.
- Canlı dizin sağlayıcısı yapılandırılmadıysa sistem kapalı kalır; sahte partner üretmez.
- İlk veri giriş yöntemleri manuel CSV, imzalı JSON akışı ve gerçek birinci taraf başvuru formudur.
- Bir şirket seçilmeden, kaynak kanıtı bulunmadan ve kurumsal e-posta doğrulanmadan mesaj hazırlanamaz.
- E-posta doğrudan istek içinde gönderilmez. Patronun son içerik özetini onaylamasıyla veritabanı outbox kaydı oluşur; cron worker Gmail API üzerinden gönderir.
- İlk temasın ardından en fazla iki takip gönderilebilir. Her mesaj ayrı taslak ve ayrı insan onayı gerektirir.
- Ülke politikası, baskılama kaydı, e-posta doğrulaması, taslak hash'i ve Gmail bağlantısı hem kuyruklama hem gerçek gönderim anında yeniden kontrol edilir.
- E-posta, telefon ve OAuth token'ları şifreli tutulur; arayüz ve loglarda maskeli değerler kullanılır.

## Gerekli ortam değişkenleri

```env
PARTNER_CREDENTIAL_ENCRYPTION_KEY=<en az 32 baytlık rastgele secret>
PARTNER_FEED_SIGNING_SECRET=<imzalı akış kullanılacaksa en az 32 bayt>
PARTNER_PUBLIC_COMPANY_SLUG=<kamu başvurularının bağlanacağı şirket slugı>
GOOGLE_OAUTH_CLIENT_ID=<Google OAuth istemci kimliği>
GOOGLE_OAUTH_CLIENT_SECRET=<Google OAuth secret>
GOOGLE_OAUTH_REDIRECT_URI=https://alan-adiniz.example/api/fabrika/partners/google/callback
CRON_SECRET=<uzun rastgele cron secret>
```

Secret değerlerini `.env` dosyasına commit etmeyin; Vercel Production/Preview secret store üzerinden tanımlayın. `PARTNER_CREDENTIAL_ENCRYPTION_KEY` değişirse eski OAuth ve iletişim şifreleri çözülemez; anahtar rotasyonu için önce yeniden şifreleme süreci gerekir.

## Google Gmail kurulumu

1. Google Cloud Console'da bir OAuth istemcisi oluşturun.
2. Yetkili yönlendirme adresine `GOOGLE_OAUTH_REDIRECT_URI` değerinin birebir aynısını ekleyin.
3. Uygulama kapsamı yalnız `openid`, `email` ve `https://www.googleapis.com/auth/gmail.send` olmalıdır.
4. Gmail bağlantısını şirket patronu `/fabrika/partnerler` içindeki **Ayarlar** sekmesinden başlatır.
5. Bağlantıdan sonra aynı ekranda test gönderimi yapılır. Bağlantı kesildiğinde token Google tarafında iptal edilmeye çalışılır ve yerel şifreli kayıt silinir.

Bu sürüm gelen kutusunu okumaz, e-posta cevabı izlemez ve Gmail parolasını hiçbir zaman istemez.

Üretime geçmeden önce platform sahibi OAuth onay ekranında doğrulanmış uygulama domainini, uygulama ana sayfasını, gizlilik politikasını ve kullanım koşullarını tanımlamalı; Gmail API'yi etkinleştirip Google'ın gerekli marka/scope doğrulamasını tamamlamalıdır. Bunların hiçbiri müşteri şirket tarafından yapılmaz.

## Ülke politikası

Yeni ülke varsayılan olarak fail-closed davranır. Platform yöneticisi aşağıdaki API ile şirket/ülke çiftini inceleyip açıkça izin vermelidir:

- `GET /api/platform-admin/partners/country-policies`
- `PATCH /api/platform-admin/partners/country-policies`
- `GET /api/platform-admin/partners/health`

`PATCH` gövdesi şirket kimliği, ISO-2 ülke kodu, durum, hukuki değerlendirme notu ve günlük şirket/domain/mailbox sınırlarını içerir. Hukuki not olmadan politika kaydedilemez.

## CSV içe aktarma

CSV 1–500 kayıt içerebilir. Önerilen başlıklar:

```csv
name,countryCode,countryName,city,websiteUrl,corporateEmail,sourceUrl,observedAt,languages,specialties
Atlas Realty,DE,Almanya,Berlin,https://atlas.example,partner@atlas.example,https://registry.example/atlas,2026-08-03T09:00:00Z,de|en,luxury|investment
```

Her satırda gerçek `sourceUrl` bulunmalıdır. İçe aktarma kurumsal e-postayı kaynak doğrulamalı kabul eder; CSV'nin yetkili ve güncel bir kaynaktan geldiğini platform işletmecisi doğrulamalıdır.

## İmzalı JSON akışı

Akış yalnız HTTPS, genel IP, `application/json`, en fazla iki güvenli yönlendirme ve 2 MB gövde ile kabul edilir. Gövde HMAC-SHA256 ile `PARTNER_FEED_SIGNING_SECRET` kullanılarak imzalanır. Her yönlendirmede DNS/IP kontrolü yeniden yapılır.

## Cron ve outbox

Vercel cron her dakika `/api/cron/partner-email-outbox` adresini çağırır. İstek şu başlıkla gelmelidir:

```text
Authorization: Bearer <CRON_SECRET>
```

Worker compare-and-set lease kullanır; aynı kaydı paralel işleyen ikinci worker sahiplenemez. Geçici Gmail hataları sınırlı üstel geri çekilme ile aynı outbox kaydı üzerinden yeniden denenir. Kalıcı hata, geri alınmış onay, baskılama, doğrulama kaybı veya ülke politikasının kapanması gönderimi durdurur.

## Migration ve yayın

Yeni veritabanı değişikliği:

```text
prisma/migrations/20260803120000_partner_network/migration.sql
```

Repository'nin mevcut idempotent `vercel-build` zincirine eklenmiştir. Üretimde ayrıca `prisma db push` veya ikinci bir migrate komutu çalıştırmayın. Yayından önce:

```bash
npx prisma validate
npx prisma generate
npm test -- --run src/lib/partner-outreach/domain.test.ts src/lib/partner-outreach/provider.test.ts
npx tsc --noEmit
npm run lint
npm run build
```

## Bilinçli olarak kapalı kapsam

- Yetkilendirilmemiş web kazıma, tahmin edilmiş e-posta ve kişisel veri toplama yoktur.
- Yetkili canlı dizin credential'ı olmadığı için otomatik ülke araması kapalıdır.
- Gmail yalnız onaylı e-posta gönderir; cevap okuma, otomatik takip ve toplantı kararı uydurulmaz.
- Gerçek sözleşme ve komisyon ödemesi entegrasyonu yoktur; modeller yalnız izlenebilir operasyon kayıtlarıdır.
