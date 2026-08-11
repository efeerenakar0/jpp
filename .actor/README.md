# Business AI Portföy Uzmanı Worker

Bu Actor, uygulamada açık ve aktif kaynak yetkisiyle oluşturulan tek bir Avcı
işini kuyruktan alır, işler ve ardından kapanır. Sürekli çalışan sunucu değildir;
boş kuyrukta da hemen çıkar. Böylece ücretsiz deneme kredisi yalnızca gerçek bir
iş başlatıldığında kullanılır.

Actor çalışma ortamında aşağıdaki gizli değişkenler Apify Console üzerinden
tanımlanmalıdır:

- `DATABASE_URL`
- `HUNTING_CONTACT_ENCRYPTION_KEY`
- `HUNTING_CONTACT_HMAC_KEY`
- `AVCI_LIVE_PROVIDER_ENABLED=true`
- `AVCI_RUN_ONCE=true`

Actor tanımı canlı taramada `RESIDENTIAL` proxy grubunu, `TR` ülke çıkışını,
tek oturumu, istekler arasında en az 13 saniyeyi ve iş başına en fazla 11
ilanı zorunlu tutar. Proxy erişimi yoksa worker doğrudan bağlantıya düşmez;
işi hata ile durdurur. `robots.txt` kontrolü de aynı Türkiye proxy oturumu
üzerinden yapılır.

Worker, kaynak doğrulaması veya erişim kısıtlaması gördüğünde durur. CAPTCHA ya
da site güvenlik kontrollerini aşmaya çalışmaz.
