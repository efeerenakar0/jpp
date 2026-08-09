# Business AI Portföy Uzmanı Worker

Bu Actor, uygulamada açık ve aktif kaynak yetkisiyle oluşturulan tek bir Avcı
işini kuyruktan alır, işler ve ardından kapanır. Sürekli çalışan sunucu değildir;
boş kuyrukta da hemen çıkar. Böylece ücretsiz deneme kredisi yalnızca gerçek bir
iş başlatıldığında kullanılır.

Actor çalışma ortamında aşağıdaki gizli değişkenler Apify Console üzerinden
tanımlanmalıdır:

- `DATABASE_URL`
- `WHATSAPP_CREDENTIAL_ENCRYPTION_KEY`
- `HUNTING_CONTACT_HMAC_KEY`
- `AVCI_LIVE_PROVIDER_ENABLED=true`
- `AVCI_RUN_ONCE=true`

Worker, kaynak doğrulaması veya erişim kısıtlaması gördüğünde durur. CAPTCHA ya
da site güvenlik kontrollerini aşmaya çalışmaz.
