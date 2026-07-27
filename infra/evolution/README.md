# Jasmine WhatsApp Gateway

Bu paket, Evolution API `v2.3.7`, PostgreSQL, Redis, otomatik TLS sağlayan
Caddy ve Jasmine mesaj kuyruğu işçisini ayrı bir sürekli çalışan sunucuda
başlatır. Vercel üzerinde uzun ömürlü WhatsApp bağlantısı çalıştırılmaz.

## Sunucu gereksinimi

- Ubuntu 24.04 tabanlı, en az 2 vCPU / 4 GB RAM VPS
- Sunucunun IP adresine yönlendirilmiş bir alt alan adı
- 80 ve 443 portları açık
- Docker Engine ve Docker Compose v2
- Her gece şifreli volume yedeği ve servis sağlık izleme

## İlk kurulum

1. `evolution.env.example` dosyasını `.env` adıyla kopyalayın.
2. Üç ayrı güçlü anahtar üretin: `openssl rand -hex 32`.
3. `EVOLUTION_DOMAIN` DNS kaydını sunucu IP adresine yönlendirin.
4. `docker compose pull` ve ardından `docker compose up -d` çalıştırın.
5. `docker compose ps` ile `postgres`, `redis`, `evolution`, `caddy` ve
   `outbox-worker` servislerinin sağlıklı olduğunu doğrulayın.
6. `curl -H "apikey: $EVOLUTION_API_KEY" https://$EVOLUTION_DOMAIN/`
   komutuyla HTTPS erişimini test edin.

## Vercel üretim değişkenleri

Jasmine Vercel projesinin Production ortamına aşağıdaki değerleri ekleyin:

```env
EVOLUTION_API_URL=https://wa-api.example.com
EVOLUTION_API_KEY=VPS_ILE_AYNI_DEGER
WHATSAPP_CREDENTIAL_ENCRYPTION_KEY=openssl-rand-hex-32
CRON_SECRET=openssl-rand-hex-32
APP_URL=https://jpp-ufeb.vercel.app
```

`CRON_SECRET` değeri VPS `.env` dosyasıyla aynı olmalıdır. Evolution API
anahtarı ve veritabanı parolaları tarayıcıya gönderilmez.

## İşletim

- Güncellemeden önce PostgreSQL ve `evolution_instances` volume yedeği alın.
- Sürüm etiketini test ortamında doğrulamadan `latest` kullanmayın.
- Hata durumunda önce `docker compose ps`, sonra
  `docker compose logs --tail=200 evolution` ve `caddy` loglarını inceleyin.
- Platform admin ekranı şirket bağlantısını ve başarısız kuyruğu gösterir;
  gizli anahtarları hiçbir zaman göstermez.
- Bağlı numaralarda toplu/izinsiz gönderim yapmayın. Evolution/Baileys resmi
  WhatsApp Cloud API değildir ve hesap kısıtlaması riski taşır.
