# Jasmine WAHA/GOWS WhatsApp Gateway

Bu paket Jasmine'in her şirket için ayrı bağlı cihaz oturumu açan WAHA/GOWS
gateway'idir. GOWS, Temmuz 2026 WhatsApp Passkey akışıyla uyumludur. Vercel
yalnızca web uygulamasını çalıştırır; uzun ömürlü WhatsApp oturumları bu Docker
servisinde saklanır.

## Üretim sunucusu

- Ubuntu 24.04, en az 2 vCPU / 4 GB RAM
- Sunucu IP'sine yönlendirilmiş bir alt alan adı
- Açık 80 ve 443 portları
- Docker Engine ve Docker Compose v2
- `waha_sessions` volume'u için şifreli günlük yedek

## Kurulum

1. `waha.env.example` dosyasını `.env` adıyla kopyalayın.
2. `WAHA_API_KEY` ve `CRON_SECRET` için ayrı ayrı
   `openssl rand -hex 32` çalıştırın.
3. `WAHA_DOMAIN` DNS kaydını sunucu IP'sine yönlendirin.
4. `docker compose pull && docker compose up -d` çalıştırın.
5. `docker compose ps` çıktısında `waha` servisinin sağlıklı olduğunu doğrulayın.
6. API'yi doğrulayın:

   ```bash
   curl -H "X-Api-Key: $WAHA_API_KEY" \
     "https://$WAHA_DOMAIN/api/sessions?all=true"
   ```

## Vercel Production değişkenleri

```env
WAHA_API_URL=https://wa-api.example.com
WAHA_API_KEY=SUNUCUDAKI_AYNI_DEGER
CRON_SECRET=SUNUCUDAKI_AYNI_DEGER
APP_URL=https://jpp-ufeb.vercel.app
```

API anahtarı sunucu tarafında kalır ve müşterinin tarayıcısına gönderilmez.
Şirket sahibi `/fabrika/whatsapp` ekranında yalnızca QR kodu tarar. Asistan ve
Avcı aynı şirkete ait izole GOWS oturumunu kullanır.

Önceden taranmış tek bir test oturumunu ilk şirkete taşımak gerekiyorsa ilk
deploy'da geçici olarak `WAHA_BOOTSTRAP_SESSION` tanımlanabilir. Şirket kaydı
`WAHA` sağlayıcısına geçirildikten sonra bu değişken kaldırılmalıdır.

## İşletim

- Güncellemeden önce `waha_sessions` volume yedeği alın.
- Görüntü digest'i test edilmeden değiştirilmemelidir.
- Durum: `docker compose ps`
- Log: `docker compose logs --tail=200 waha`
- Yeniden başlatma: `docker compose restart waha`
- Toplu veya izinsiz mesaj göndermeyin. Bu bağlantı resmi Meta Cloud API
  değildir ve WhatsApp hesabı kısıtlanabilir.

GitHub Codespaces kurulumu yalnızca test içindir. Codespace uyuduğunda WhatsApp
gateway'i de çevrimdışı olur; satışa açmadan önce bu paketi sürekli çalışan bir
VPS'e taşıyın.

## Sunum öncesi ücretsiz test gateway'ini hazırlama

Proje kökünde aşağıdaki komutu çalıştırın:

```bash
npm run whatsapp:presentation
```

Komut `jasmine-evolution-test` Codespace'ini uyandırır, `jasmine-waha`
container'ını başlatır, 8080 portunu herkese açık hale getirir ve anahtarlı WAHA
sağlık kontrolünü tamamlar. `Hazır` sonucu görüldükten sonra
`/fabrika/whatsapp` ekranındaki **QR oluştur** düğmesi kullanılabilir.

Bu hazırlık yalnızca ücretsiz demo ortamı içindir. Codespaces boşta kaldığında
uykuya geçebildiği için kesintisiz müşteri kullanımı sağlayan üretim çözümü
değildir.
