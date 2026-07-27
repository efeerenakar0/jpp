# Jasmine Fabrika ürün yol haritası

Bu belge, 27 Temmuz 2026 tarihinde onaylanan ürün kararlarının uygulama
sırasını ve değişmez yetki sınırlarını kaydeder. Her aşama ayrı doğrulanır,
yayınlanır ve sonraki aşamaya geçmeden önce ürün sahibi onayı alınır.

## Değişmez erişim modeli

Yalnızca iki hesap türü vardır:

- **Patron:** Şirket çalışma alanının tamamına, aboneliğe, entegrasyonlara,
  gizli anahtarlara ve ekip hesabı yönetimine erişir.
- **Çalışan:** Şirketin operasyonel CRM, müşteri telefonları, portföyler,
  görüşmeler, eşleştirmeler, görevler, Pazarlamacı ve Stüdyo verilerine
  erişir. Ekip listesini ve salt okunur raporları görebilir. Abonelik,
  gizli anahtarlar, patron işlemleri ile çalışan oluşturma, kapatma veya
  şifre sıfırlama yetkisi yoktur.

Çalışan erişimi yalnızca arayüzde gizlenmez; API ve veritabanı işlemlerinde
sunucu tarafında denetlenir. Giriş kodları düz metin saklanmaz ve yalnızca
oluşturma/sıfırlama anında bir kez gösterilir.

## Uygulama aşamaları

1. **Patron ve Çalışan hesapları — Tamamlandı (27 Temmuz 2026)**
   - Ayrı Patron Girişi ve Çalışan Girişi ekranları.
   - Şirket patronunun ve platform yöneticisinin çalışan oluşturabilmesi.
   - Çalışanı açma/kapatma ve geçici giriş kodunu sıfırlama.
   - Oturum belirtecinde şirket ve kullanıcı kimliği; sunucu tarafı rol
     denetimi; abonelik ve gizli anahtarların çalışandan saklanması.

2. **Bildirim kapsamı ve menü sadeleştirmesi — Tamamlandı (27 Temmuz 2026)**
   - Bildirimlerin şirket ve kullanıcı kapsamında ayrılması.
   - “Çok önemli” ve “Tümü” sekmeleri.
   - Randevu, yeni portföy/onay, sıcak müşteri, kritik entegrasyon hatası ve
     gecikmiş yüksek öncelikli görevlerin önemli sayılması.
   - Satış Hunisi ayrı sayfasının CRM içine alınması.
   - Satıcı Portalı ayrı menüsünün kaldırılması; portföy içinde
     **Malik Raporu** olarak sürdürülmesi.

   Uygulanan kararlar:
   - Her bildirim şirket ve alıcı kimliğiyle saklanır; okundu bilgisi
     patron ve her çalışan için birbirinden bağımsızdır.
   - Önemli kapsamı randevu/gösterim, sıcak müşteri, yeni aktif/onaylı
     portföy, kritik entegrasyon hatası ve geciken 3/3 öncelikli görevlerle
     sınırlıdır. Reklam, web sitesi ve diğer rutin üretim logları yalnızca
     **Tümü** sekmesinde görünür.
   - Eski `/fabrika/satis` bağlantısı CRM içindeki Satış sürecine; eski
     `/fabrika/satici-portali` bağlantısı Portföyler içindeki Malik
     raporlarına güvenli biçimde yönlendirilir.

3. **Profesyonel Merkezi CRM ve eşleştirme — Tamamlandı (27 Temmuz 2026)**
   - Tek müşteri profili, notlar, konuşma/aktivite zaman çizgisi, sorumlu
     çalışan, sıcaklık ve AI puanı.
   - AI puanının gerekçelerini görünür ve denetlenebilir sunma.
   - Müşteriyi manuel veya Asistan konuşmasından ekleme.
   - Manuel ve otomatik müşteri-portföy eşleştirmeleri.
   - Satış aşamalarını müşteri profilinde kompakt biçimde yönetme.

   Uygulanan kararlar:
   - Müşteri profili; iletişim bilgileri, arama kriterleri, sorumlu
     danışman, satış aşaması, görevler, fırsatlar, notlar ve kronolojik
     aktiviteyi tek ekranda birleştirir.
   - Müşteri puanı mevcut AI sağlayıcısıyla gerekçeli hesaplanır. Sağlayıcı
     kullanılamadığında sonuç uydurulmaz; görünür biçimde akıllı kural
     yedeğine geçilir.
   - Asistan konuşmaları mevcut Jasmine şirket senkronuyla içe alınabilir;
     manuel müşteri oluşturma korunur.
   - Otomatik eşleşmeler bölge, oda ve bütçeden hesaplanır. Danışmanın
     oluşturduğu manuel eşleşmeler ayrıca işaretlenir ve otomatik
     yenilemede silinmez.

4. **Gerçek takvim ve Google Calendar**
   - Aylık/haftalık/günlük takvim, görev ve randevu ayrımı.
   - Yaklaşan kritik kayıtların Komuta Merkezi ve bildirimlere düşmesi.
   - Kullanıcı onaylı Google OAuth bağlantısı ve iki yönlü senkronizasyon.
   - Çakışma, silme ve tekrar eden etkinlik kurallarının denetlenebilir
     senkronizasyon günlüğü.

5. **Portföy kaynakları ve Avcı**
   - Jasmine tarafından üretilen siteler için doğrudan şirket API bağlantısı.
   - Diğer siteler için WordPress REST, sitemap, JSON-LD/HTML bağlayıcıları,
     önizleme ve onay akışı.
   - Bağlantı kurulumunu anlatan AI yardımcısı.
   - Avcı’da “Satış yetkisi alındı” aşaması ve onay sonrası portföye aktarım.
   - Elenen ilanlarda yapılandırılmış neden ve AI destekli özet.

6. **Profesyonel Pazarlamacı**
   - Aktif portföy seçerek açıklama, emlakçı grubu mesajı ve kanal
     varyasyonları üretme.
   - OpenRouter sağlayıcı arayüzü; ücretsiz metin modeli pilot amaçlı
     seçilir, limit ve yedek model görünür tutulur.
   - Gerçek portföy fotoğraflarını kullanan şablon tabanlı poster motoru.
   - Web sitesi reklam analizi, kanal planı ve uygulanabilir AI rehberi.

7. **Komuta Merkezi ve genel müdür yardımcısı**
   - Asistan ile ortak şirket AI sağlayıcısı.
   - CRM, portföy, görev, randevu ve pazarlama verilerine yetkili araçlarla
     erişim.
   - Sabit yükseklikte, kendi içinde kaydırılan ve erişilebilir sohbet alanı.

8. **WhatsApp altyapısı**
   - Önceki karara göre son aşamada Evolution API/Baileys tabanlı seçenek
     kontrollü pilot edilir.
   - Resmî olmayan bağlantının hesap/oturum riski açıkça gösterilir; şirket
     bazlı oturum izolasyonu, kuyruk, hız sınırı ve hata geri kazanımı
     tamamlanmadan üretime açılmaz.

## AI ve entegrasyon ilkeleri

- Sağlayıcı ve model seçimleri şirket bazlıdır; anahtarları yalnızca Patron
  veya platform yöneticisi yönetebilir.
- “Ücretsiz model” üretim garantisi değildir. Kota, hız ve model değişikliği
  için görünür durum, yedek sağlayıcı ve maliyet sınırı bulunur.
- Harici sitelerden veya AI’dan gelen kayıtlar doğrudan yayınlanmaz; kaynak,
  önizleme ve kullanıcı onayı korunur.
- AI puanı, öneri ve eleme açıklamalarında gerekçe ve kaynak veri gösterilir.
