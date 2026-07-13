export const siteContent = {
  meta: {
    title: "Jasmine Proje Pazarlama | Alanya'nın İlk ve Tek Proje Pazarlama Firması",
    description: "Alanya'da inşaat firmaları ve emlakçılar arasında köprü kuran ilk ve tek proje pazarlama firması. Yatırımınıza yön veriyoruz.",
  },
  contact: {
    address: "Mahmutlar Mah. Barbaros Cad. No: 123/A Alanya / Antalya",
    phone: "+90 555 123 45 67",
    email: "info@jasmineprojepazarlama.com",
    workingHours: "Pzt - Cmt: 09:00 - 18:00",
    mapIframe: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d102008.87786448405!2d31.916840733560758!3d36.536768340242274!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14dca2161a49f82d%3A0xc3af001fb14c2747!2sAlanya%2C%20Antalya!5e0!3m2!1str!2str!4v1700000000000!5m2!1str!2str",
    whatsapp: "+905551234567"
  },
  stats: [
    { label: "Satışa Sunulan Daire", value: "2500+" },
    { label: "Aktif Proje", value: "15" },
    { label: "Emlakçı Ortak", value: "300+" },
    { label: "Hizmet Verilen Ülke", value: "40+" }
  ],
  services: [
    {
      id: "analiz",
      title: "Pazar, Bölge ve Rakip Analizi",
      shortDescription: "Projenizin konumu ve pazar dinamiklerini inceleyerek en doğru fiyatlandırma ve stratejiyi oluşturuyoruz.",
      icon: "BarChart",
      details: "Bölgedeki diğer projeleri, fiyat artış trendlerini ve potansiyel müşteri kitlesini analiz ederek projenizin rekabet gücünü artırıyoruz."
    },
    {
      id: "satis-ofisi",
      title: "Satış Ofisi Kurulumu",
      shortDescription: "Projenizin satış ofisi ve örnek dairelerini müşteriyi etkileyecek ve güven verecek şekilde tasarlıyoruz.",
      icon: "Building",
      details: "Fiziksel satış ofisinizin mimari tasarımından teknolojik altyapısına kadar her detayıyla ilgileniyor, marka kimliğinize uygun bir deneyim alanı yaratıyoruz."
    },
    {
      id: "mimari-destek",
      title: "3D Mimari Tasarım Desteği",
      shortDescription: "Projenizi henüz topraktan satılabilmesi için en gerçekçi 3D görseller ve sanal turlarla destekliyoruz.",
      icon: "PenTool",
      details: "Sadece dış cephe değil, tüm sosyal alanlar ve iç mekanlar için üst düzey render hizmetleri sunarak müşterinin hayal etmesini kolaylaştırıyoruz."
    },
    {
      id: "dijital-pazarlama",
      title: "Dijital & Geleneksel Pazarlama",
      shortDescription: "Global kitleye ulaşmak için SEO, sosyal medya ve geleneksel medya kanallarını entegre kullanıyoruz.",
      icon: "Megaphone",
      details: "Hedef kitlenin bulunduğu ülkelere ve dillere özel kampanyalar düzenliyor, B2B ve B2C pazarlama süreçlerini yönetiyoruz."
    },
    {
      id: "emlakci-agi",
      title: "Emlakçı Ağı Yönetimi",
      shortDescription: "Yerel ve uluslararası emlakçılarla güçlü bir satış ve partnerlik ağı oluşturuyoruz.",
      icon: "Users",
      details: "Alanya ve globaldeki yüzlerce aracı kuruma projenizi tanıtıyor, B2B portallar ve özel sunumlarla satışı hızlandırıyoruz."
    },
    {
      id: "crm",
      title: "CRM ve Yapay Zeka Desteği",
      shortDescription: "Müşteri ilişkileri yönetimini dijitalleştiriyor, veri odaklı kararlarla satış kapatma oranını artırıyoruz.",
      icon: "Database",
      details: "Tüm potansiyel alıcıların (lead) takibi, otomatik bilgilendirmeler ve satış ekiplerinin performans ölçümünü yapay zeka destekli altyapımızla sağlıyoruz."
    }
  ],
  projects: [
    {
      id: "state-of-art",
      slug: "state-of-art-residence",
      name: "State of Art Residence",
      location: "Kargıcak, Alanya",
      status: "Satışta", // Satışta, Tamamlandı, Yapım Aşamasında
      image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=800",
      shortDescription: "Kargıcak'ın en prestijli lokasyonunda, deniz manzaralı ve ultra lüks donatılara sahip eşsiz bir yaşam projesi.",
      features: ["Deniz Manzarası", "Açık/Kapalı Havuz", "Spa & Hamam", "Fitness", "Sinema Salonu", "7/24 Güvenlik"],
      types: ["1+1", "2+1", "3+1 Dubleks", "4+1 Penthouse"],
      area: "55m² - 240m²",
      deliveryDate: "Aralık 2025",
      price: "İletişime Geçin"
    },
    {
      id: "jasmine-view",
      slug: "jasmine-view-life",
      name: "Jasmine View Life",
      location: "Mahmutlar, Alanya",
      status: "Yapım Aşamasında",
      image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
      shortDescription: "Modern mimarisi ve zengin sosyal alanlarıyla aileniz için güvenli ve huzurlu bir yaşam alanı.",
      features: ["Açık Havuz", "Aquapark", "Sauna", "Buhar Odası", "Otopark", "Çocuk Oyun Alanı"],
      types: ["1+1", "2+1", "2+1 Dubleks"],
      area: "50m² - 120m²",
      deliveryDate: "Haziran 2026",
      price: "İletişime Geçin"
    },
    {
      id: "milano-pearl",
      slug: "milano-pearl-residence",
      name: "Milano Pearl Residence",
      location: "Oba, Alanya",
      status: "Tamamlandı",
      image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800",
      shortDescription: "Şehir merkezine yakın, butik ve şık tasarımıyla yatırım değeri yüksek, teslime hazır proje.",
      features: ["Merkezi Konum", "Yüzme Havuzu", "Jeneratör", "Asansör", "Güvenlik Kamerası"],
      types: ["1+1", "3+1 Penthouse"],
      area: "45m² - 160m²",
      deliveryDate: "Hemen Teslim",
      price: "İletişime Geçin"
    }
  ],
  testimonials: [
    {
      id: 1,
      name: "Ahmet Yılmaz",
      role: "Müteahhit Firma Sahibi",
      content: "Jasmine Proje Pazarlama ile çalışmaya başladıktan sonra satış hızımız %40 arttı. Yabancı müşterilere ulaşma konusundaki ağları gerçekten inanılmaz."
    },
    {
      id: 2,
      name: "Elena Ivanova",
      role: "Gayrimenkul Yatırımcısı",
      content: "Alanya'da ev alırken tüm süreci o kadar şeffaf ve profesyonel yönettiler ki, bir sonraki yatırımım için de kesinlikle onları tercih edeceğim."
    },
    {
      id: 3,
      name: "Mehmet Demir",
      role: "Emlak Ofisi Broker'ı",
      content: "Portföylerindeki projeler her zaman çok kaliteli ve pazarlanabilir nitelikte. İş ortaklarına verdikleri değer, sektörde çok nadir rastlanan cinsten."
    }
  ],
  faq: [
    {
      category: "Yatırımcılar için",
      questions: [
        { q: "Neden Alanya'dan gayrimenkul almalıyım?", a: "Alanya; yılın 300 günü güneşli iklimi, uluslararası havalimanına yakınlığı, güvenli yaşam ortamı ve her yıl artan gayrimenkul değeri ile hem yaşamak hem de yatırım yapmak için Türkiye'nin en cazip bölgelerinden biridir." },
        { q: "Yabancılar Türkiye'de mülk edinebilir mi?", a: "Evet, karşılıklılık ilkesine bağlı olarak birçok ülke vatandaşı Türkiye'den gayrimenkul satın alabilir. Sürecin tüm yasal detaylarını uzman ekibimizle birlikte yönetiyoruz." },
        { q: "Projelerinizin inşaat kalitesine nasıl güvenebilirim?", a: "Sadece geçmiş projelerini başarıyla tamamlamış, güvenilir ve finansal yapısı güçlü müteahhit firmalarla çalışıyoruz. Pazarlamasını üstlendiğimiz tüm projeler bizim kalite standartlarımızdan geçmektedir." }
      ]
    },
    {
      category: "Emlakçılar için",
      questions: [
        { q: "İş ortaklığı sisteminiz nasıl çalışıyor?", a: "İş Ortaklığı formumuzu doldurarak kayıt oluyorsunuz. Tarafımızdan onaylandıktan sonra, portföyümüzdeki tüm projelere B2B portalımız üzerinden erişebilir, pazarlama materyallerini indirebilir ve müşterilerinize sunabilirsiniz." },
        { q: "Komisyon hak edişi ne zaman gerçekleşir?", a: "Müşterinizin sözleşme imzalayıp ilk peşinatını yatırdığı anda komisyon hak edişiniz güvence altına alınır." }
      ]
    }
  ],
  timeline: [
    { year: "2018", title: "Kuruluş", description: "Jasmine Proje Pazarlama, Alanya'nın ilk proje pazarlama şirketi olarak faaliyetlerine başladı." },
    { year: "2020", title: "Global Açılım", description: "Yurt dışı pazarında 20 farklı ülkede acente ağları oluşturuldu." },
    { year: "2022", title: "1000. Teslimat", description: "Pazarlamasını üstlendiğimiz projelerde toplam 1000'den fazla bağımsız bölümün satışı başarıyla tamamlandı." },
    { year: "2024", title: "Dijital Dönüşüm", description: "CRM ve yapay zeka destekli kendi B2B yazılım altyapımızı devreye alarak iş ortaklarımıza eşsiz bir deneyim sunduk." }
  ]
};
