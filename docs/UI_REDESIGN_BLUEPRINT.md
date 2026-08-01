# JPP UI Redesign Blueprint

Durum: Özellik geliştirme tamamlandıktan ve ürün kapsamı dondurulduktan sonra uygulanacak.

Son güncelleme: 29 Temmuz 2026

## 1. Hedef

JPP'nin görünümünü parça parça makyajlamak yerine baştan, tek bir tasarım sistemi altında yenilemek.

Ortaya çıkacak ürün iki farklı deneyimi aynı marka altında taşımalı:

- Halka açık site: lüks gayrimenkul, sinematik hikâye anlatımı, güçlü tipografi, 3D/ışık efektleri ve yüksek hareket yoğunluğu.
- Fabrika uygulaması: yapay zekâ destekli operasyon sistemi, veri yoğun ama hızlı okunabilen arayüz, kontrollü mikro animasyonlar.

Kuzey yıldızı: **Luxury Spatial AI Operating System for Real Estate**.

## 2. Mevcut Teknik Durum

Projede bugün:

- Next.js `16.2.12`
- React `19.2.4`
- Tailwind CSS `4`
- shadcn/ui registry yapısı
- Radix UI
- Framer Motion `12.42.2`
- Lucide ikonları
- Recharts
- Sonner

bulunuyor.

Bu nedenle yeni bir temel UI framework'ü kurulmayacak. Mevcut shadcn/Radix katmanı korunacak ve görsel sistem onun üzerinde yeniden inşa edilecek.

Tespit edilen ana borç:

- Kaynak dosyalarda yaklaşık `2012` adet `slate-*` kullanımı var.
- Yaklaşık `666` adet `emerald-*` kullanımı var.
- Framer Motion yalnızca sınırlı sayıdaki halka açık site bileşeninde kullanılıyor.
- GSAP, Lenis, Three.js, Rive ve dotLottie henüz kurulu değil.
- Büyük Fabrika ekranları görsel değerleri doğrudan bileşenlerin içinde taşıyor.

Sonuç: Redesign'ın ilk işi efekt eklemek değil, sabit görsel değerleri token sistemine taşımaktır.

## 3. Tasarım Yönü

### 3.1 Halka açık site

- Koyu obsidian yüzeyler
- Büyük editorial başlıklar
- Kontrollü şampanya/altın vurgu
- Marka işlevlerini anlatan elektrik cyan ve emerald durum renkleri
- Asimetrik bento düzenleri
- Tam ekran medya ve maskeli geçişler
- Scroll ile ilerleyen ürün hikâyesi
- Tek bir güçlü 3D imza sahnesi

Önerilen tipografi:

- Başlık: Instrument Serif
- Gövde/UI: Manrope veya Geist Sans
- Sayısal veri: Geist Mono

### 3.2 Fabrika uygulaması

- Koyu “command center” yüzeyleri
- Daha az dekor, daha kuvvetli hiyerarşi
- Yumuşak elevation ve ince sınırlar
- Durum renkleri yalnızca anlam taşıdığında
- Veriyi kapatmayan glow efektleri
- Mouse, klavye ve dokunma için tutarlı geri bildirim

Fabrika uygulamasında büyük dekoratif 3D sahne, sürekli parallax veya smooth-scroll kullanılmayacak.

## 4. Kesin Teknoloji Kararı

| Katman | Seçim | Karar |
|---|---|---|
| Stil | Tailwind CSS 4 | Koru |
| Erişilebilir UI | shadcn/ui + Radix UI | Koru ve genişlet |
| İkon | Lucide | Tek ikon ailesi olarak koru |
| React durum/layout animasyonu | Motion | Framer Motion importlarını redesign sırasında taşı |
| Sinematik koreografi | GSAP + `@gsap/react` | Ekle |
| Scroll sahneleri | GSAP ScrollTrigger | Ekle |
| Metin animasyonu | GSAP SplitText | Sadece kısa başlıklarda kullan |
| Shared-element/geçiş | Motion `layoutId` veya GSAP Flip | Senaryoya göre kullan |
| Smooth scroll | Lenis | Yalnızca halka açık siteye ekle |
| Hazır animasyonlu primitive | Animate UI | Öncelikli kaynak |
| Dekoratif efekt | Magic UI | Öncelikli kaynak |
| Maksimum görsel efekt | Aceternity UI / React Bits | Seçerek kullan |
| 3D | Three.js + React Three Fiber v9 + Drei | Opsiyonel, yalnızca imza sahnelerinde |
| Hafif vektör animasyonu | dotLottie | Varsayılan tercih |
| Etkileşimli state-machine animasyonu | Rive | dotLottie yetersizse alternatif |
| Grafik | Recharts | Koru; tema ve motion adaptörü ekle |

### Kaynaklar

- [Motion for React](https://motion.dev/docs/react)
- [GSAP kurulumu ve eklentileri](https://gsap.com/docs/v3/Installation/)
- [GSAP ticari kullanım lisansı](https://gsap.com/community/standard-license/)
- [Lenis](https://github.com/darkroomengineering/lenis)
- [Magic UI](https://magicui.design/)
- [Animate UI](https://animate-ui.com/docs)
- [Aceternity UI](https://ui.aceternity.com/)
- [React Bits](https://reactbits.dev/)
- [React Three Fiber](https://github.com/pmndrs/react-three-fiber)
- [dotLottie React](https://docs.lottiefiles.com/en/runtimes/distributions/react)
- [Rive React runtime](https://rive.app/docs/runtimes/react/react)

## 5. Kurulum Grupları

Paketler özellik geliştirme sürerken eklenmeyecek. Aşağıdaki komutlar redesign dalında, kullanılacak ilk bileşen hazır olduğunda çalıştırılacak.

### 5.1 Çekirdek motion

```bash
npm install motion gsap @gsap/react lenis
```

Tüm importlar `motion/react` yapısına taşındıktan sonra eski paket kaldırılacak:

```bash
npm uninstall framer-motion
```

`motion` ile `framer-motion` kalıcı olarak birlikte tutulmayacak.

### 5.2 Opsiyonel 3D

```bash
npm install three @react-three/fiber @react-three/drei @react-three/postprocessing
```

React 19 ile React Three Fiber v9 kullanılmalı. 3D paketleri yalnızca 3D prototipi performans bütçesini geçtiğinde kurulmalı.

### 5.3 Vektör animasyonu

Varsayılan:

```bash
npm install @lottiefiles/dotlottie-react
```

Etkileşimli state machine gerçekten gerekiyorsa bunun yerine:

```bash
npm install @rive-app/react-webgl2
```

İki runtime aynı kullanım için birlikte kurulmayacak.

## 6. Component Kaynak Politikası

Magic UI, Animate UI, Aceternity UI ve React Bits tam kütüphane olarak projeye doldurulmayacak.

Her component için:

1. Kaynak kod görülerek projeye alınır.
2. Bağımlılıkları ve lisansı incelenir.
3. Kod `src/components/visual/` altında JPP tokenlarına uyarlanır.
4. `prefers-reduced-motion` davranışı eklenir.
5. Mobil ve klavye davranışı doğrulanır.
6. Kullanılmayan demo kodu ve bağımlılıklar temizlenir.

Bir sayfada en fazla:

- Bir ana arka plan efekti
- Bir güçlü başlık animasyonu
- Bir scroll koreografisi
- Bir veya iki odak CTA mikro etkileşimi

kullanılmalı. Her şey aynı anda hareket etmemeli.

## 7. Üç Katmanlı Token Mimarisi

### 7.1 Primitive tokenlar

Ham değerler:

- Renk skalaları
- 4/8 px spacing sistemi
- Tipografi ölçeği
- Radius
- Shadow ve glow
- Blur
- Süre ve easing
- Z-index

Örnek:

```css
--jpp-obsidian-950: #06080d;
--jpp-emerald-500: #10b981;
--jpp-space-4: 1rem;
--jpp-radius-lg: 0.875rem;
--jpp-duration-fast: 150ms;
```

### 7.2 Semantic tokenlar

Amaca göre isimlendirilir:

```css
--surface-canvas: var(--jpp-obsidian-950);
--surface-panel: var(--jpp-graphite-900);
--text-primary: var(--jpp-pearl-50);
--text-muted: var(--jpp-slate-400);
--action-primary: var(--jpp-emerald-500);
--status-warning: var(--jpp-amber-400);
--focus-ring: var(--jpp-cyan-300);
```

### 7.3 Component tokenları

```css
--button-primary-bg: var(--action-primary);
--card-bg: var(--surface-panel);
--card-border: var(--border-subtle);
--dialog-scrim: var(--surface-scrim);
--sidebar-active-bg: var(--surface-selected);
```

Tema değiştirmek için semantic katman değişir; component kodu değişmez.

## 8. Motion Sistemi

| Seviye | Süre | Kullanım |
|---|---:|---|
| M0 | `0ms` | Reduced-motion modu |
| M1 | `120–220ms` | Hover, press, focus, tooltip |
| M2 | `240–420ms` | Dialog, tab, kart, liste/layout |
| M3 | `450–800ms` | Hero ve bölüm girişleri |
| M4 | Scroll kontrollü | Pin, parallax ve sinematik sahne |

Kurallar:

- Giriş `ease-out`, çıkış daha kısa `ease-in`.
- Liste stagger değeri genellikle `20–60ms`.
- Transform ve opacity öncelikli.
- `width`, `height`, `top`, `left` animasyonundan kaçınılır.
- Dashboard içinde sonsuz dekoratif animasyon kullanılmaz.
- Aynı element aynı anda Motion ve GSAP tarafından kontrol edilmez.
- `prefers-reduced-motion` tüm hareket altyapılarında desteklenir.
- ScrollTrigger pin kullanımı halka açık bir sayfada en fazla iki ana sahneyle sınırlandırılır.

## 9. Sayfa Bazlı Motion Haritası

### Ana sayfa

- SplitText ile kısa hero başlığı
- Maskeli ana medya girişi
- Mouse/scroll ile çok hafif derinlik
- Bento özellik kartlarında Motion layout
- Bir adet pinned ürün hikâyesi
- Güçlü fakat kısa CTA geçişi

Yoğunluk: `9/10`

### Projeler ve proje detayı

- Filtre değişimlerinde Motion layout
- Karttan detay sayfasına shared-element medya geçişi
- Proje detayında sticky görsel hikâye
- 3D varsa yalnızca seçili projelerde dinamik yükleme

Yoğunluk: `7/10`

### Giriş ve onboarding

- Form adımları arasında yön hissi veren geçiş
- Başarı durumunda dotLottie
- Hata durumunda kısa ve sakin feedback

Yoğunluk: `4/10`

### Fabrika dashboard

- KPI sayı geçişleri
- Kartların yüklenmesinde kısa stagger
- Layout değişiminde Motion
- Durum değişikliklerinde renk + ikon + kısa motion
- Smooth scroll, parallax ve 3D yok

Yoğunluk: `4/10`

### CRM, portföy ve görevler

- Filtre ve sıralamada FLIP/layout animasyonu
- Seçili kayıt panelinde shared layout
- Drag gerekiyorsa yalnızca gerçek iş akışında
- Tablo satırlarında ağır hover veya glow yok

Yoğunluk: `3/10`

### Platform admin

- Yalnızca işlevsel mikro etkileşim
- Hata, başarı, loading ve dialog motion

Yoğunluk: `2/10`

## 10. 3D ve Ağır Efekt Politikası

React Three Fiber kullanılacaksa:

- `next/dynamic` ile client-only ve lazy load edilir.
- Sayfanın ilk HTML içeriği 3D'ye bağlı olmaz.
- WebGL desteklenmediğinde statik görsel fallback gösterilir.
- Mobilde daha düşük DPR, daha az geometri ve post-processing kullanılır.
- Canvas görünür değilken render döngüsü durdurulur.
- Bir sayfada bir tam ekran canvas sınırı uygulanır.
- 3D sahne klavye kullanımını veya metin seçimini engellemez.

Rive runtime'larının sıkıştırılmış WASM boyutu seçilen renderere göre yaklaşık `222–648 KB` aralığında olabilir. Bu nedenle basit loading/empty-state animasyonlarında dotLottie tercih edilir.

## 11. Performans Kapıları

Redesign görsel olarak tamamlanmış sayılmaz; aşağıdaki hedefleri de geçmelidir:

- LCP: `≤ 2.5s`
- INP: `≤ 200ms`
- CLS: `≤ 0.1`
- Mobilde reduced-motion desteği
- İlk görünümde 3D veya Rive zorunlu bağımlılık olmamalı
- Görünmeyen animasyonlar durdurulmalı
- Büyük görsel/animasyon paketleri route bazında lazy load edilmeli

Resmî eşikler: [Core Web Vitals](https://web.dev/articles/defining-core-web-vitals-thresholds)

Next.js 16 bundle analizi:

```bash
npx next experimental-analyze --output
```

Kaynak: [Next.js package bundling](https://nextjs.org/docs/app/guides/package-bundling)

Analiz redesign öncesi ve sonrası kaydedilip karşılaştırılmalı.

## 12. Uygulama Sırası

1. Ürün özelliklerini ve route yapısını dondur.
2. Tüm önemli sayfaların masaüstü ve mobil ekran görüntülerini al.
3. Ayrı redesign dalı oluştur.
4. Build, test ve bundle baseline kaydet.
5. Primitive → semantic → component tokenlarını oluştur.
6. Sabit `slate/emerald` kullanımlarını semantic tokenlara taşı.
7. Button, input, card, dialog, tabs, table ve shell'i yenile.
8. Fabrika navigation ve dashboard iskeletini yenile.
9. Motion paketine geç ve ortak motion tokenlarını kur.
10. Halka açık siteyi GSAP/Lenis ile yeniden tasarla.
11. Seçili Magic UI/Animate UI bileşenlerini JPP stiline adapte et.
12. 3D veya Rive için tek bir imza prototipi yap.
13. Erişilebilirlik, mobil ve düşük donanım testlerini çalıştır.
14. Bundle ve Core Web Vitals karşılaştırmasını tamamla.

## 13. Kurulmaması Gerekenler

- MUI, Ant Design veya Chakra gibi ikinci bir temel component framework'ü
- Aynı anda Lenis ve GSAP ScrollSmoother
- Aynı element üzerinde Motion ve GSAP
- Tüm Aceternity/React Bits kataloğu
- Her sayfada particle veya shader arka planı
- Dashboard içinde scroll-jacking
- Sadece dekor amacıyla büyük Rive/Three.js runtime
- Lisansı ve kaynak kodu incelenmemiş registry componentleri

## 14. Tamamlanma Kriterleri

- Tüm kullanıcıya açık ve Fabrika route'ları yeni tasarım sistemini kullanıyor.
- Eski sabit palette sınıfları istisnalar dışında kaldırılmış.
- Light/dark ve status renkleri semantic tokenlardan geliyor.
- Her interaktif element klavye ile kullanılabiliyor.
- Reduced-motion modunda işlev kaybı yok.
- Mobil, tablet ve masaüstü düzenleri doğrulanmış.
- E2E ana akışları geçiyor.
- Bundle analizi ve Core Web Vitals hedefleri geçiyor.
- Kullanılmayan UI/animasyon bağımlılığı kalmamış.
- Görsel dil halka açık site ile Fabrika arasında tutarlı, fakat hareket yoğunluğu kullanım amacına göre ayrılmış.
