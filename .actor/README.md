# Business AI Portfoy Uzmani Worker

Bu Actor, uygulamanin kendisine verdigi kisa omurlu ve tek ise bagli capability
ile bir Avci isini calistirir, sonucu Vercel'deki korumali internal API'ye yazar
ve kapanir. Bos kuyruk taramaz; her run yalniz imzali `jobId` icin calisir.

Actor'a asagidaki hassas degerler **verilmez**:

- `DATABASE_URL`
- `HUNTING_CONTACT_ENCRYPTION_KEY`
- `HUNTING_CONTACT_HMAC_KEY`
- `BLOB_READ_WRITE_TOKEN`

Veritabani yazimi, telefon sifreleme/HMAC ve tenant dogrulamasi yalniz Vercel
tarafinda yapilir. Actor input'u sadece `version`, `jobId` ve 20 dakika gecen
kisa omurlu capability tasir. Kalici imzalama anahtari Actor'a aktarilmaz.

Actor tanimi canli taramada `RESIDENTIAL` proxy grubunu, `TR` ulke cikisini,
tek oturumu, kaynak istekleri arasinda en az 13 saniyeyi ve is basina en fazla
11 ilani zorunlu tutar. Proxy erisimi yoksa dogrudan baglantiya dusmez. Robots
kontrolu de ayni Turkiye proxy oturumu uzerinden yapilir.

Worker kaynak dogrulamasi veya erisim kisitlamasi gordugunde durur. CAPTCHA ya
da site guvenlik kontrollerini asmaya calismaz.
