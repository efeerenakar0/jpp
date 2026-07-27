# Google Calendar üretim kurulumu

Google Calendar istemci bilgileri Jasmine platformu için yalnızca bir kez
kurulur. Jasmine müşterileri Google Cloud veya Vercel ayarı yapmaz; Fabrika
Takvim ekranındaki **Google ile bağla** düğmesine basıp kendi Google hesabına
izin verir.

## Platform yöneticisinin yapacağı tek seferlik kurulum

1. [Google Cloud Console](https://console.cloud.google.com/) içinde Jasmine
   için bir proje seçin veya oluşturun.
2. **APIs & Services → Library** bölümünden **Google Calendar API** hizmetini
   etkinleştirin.
3. **Google Auth Platform → Branding / Audience / Data Access** alanlarında
   uygulama adını, destek e-postasını ve gerekli izin kapsamlarını ayarlayın.
4. **Clients → Create client → Web application** yoluyla bir OAuth istemcisi
   oluşturun.
5. Yetkili yönlendirme adreslerine üretim için tam olarak şunu ekleyin:
   `https://jpp-ufeb.vercel.app/api/fabrika/calendar/google/callback`
6. Vercel projesinin Production ortamına şu değişkenleri ekleyin:
   - `GOOGLE_CALENDAR_CLIENT_ID`
   - `GOOGLE_CALENDAR_CLIENT_SECRET`
   - `CALENDAR_TOKEN_ENCRYPTION_KEY` — uzun ve rastgele bir sunucu sırrı
7. Yeni bir production deployment başlatın.

Yerel geliştirmede kullanılacak yönlendirme adresi ayrıca Google istemcisine
eklenmelidir:
`http://localhost:3000/api/fabrika/calendar/google/callback`

## Müşterinin yapacağı işlem

1. Patron hesabıyla Fabrika’ya giriş yapar.
2. **Takvim → Google Calendar → Google ile bağla** düğmesine basar.
3. Kullanacağı Google hesabını ve takvimi seçip izin verir.
4. Jasmine’e döndüğünde ilk iki yönlü senkronizasyon otomatik başlar.

Çalışanlar takvim kayıtlarını kullanabilir ve senkronizasyonu çalıştırabilir;
hesabı bağlama veya bağlantıyı kaldırma yetkisi yalnızca patrondadır.

Google erişim ve yenileme belirteçleri AES-256-GCM ile şifrelenerek sunucuda
saklanır. Anahtarlar ve belirteçler tarayıcıya gönderilmez. Her senkronizasyon
sonucu şirket kapsamındaki günlükte tutulur.
