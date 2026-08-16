import type { RealEstateContent } from "@/marketing/types";

export const realEstateContent = {
  locale: "tr",
  metadata: {
    title: "Emlak için Business CEO AI",
    description:
      "Müşteri görüşmelerini, ekip devirlerini, portföy fırsatlarını ve yönetici görünürlüğünü tek bir yapay zekâ operasyon katmanında koordine edin.",
    canonicalPath: "/tr/realestate",
  },
  hero: {
    eyebrow: "Business CEO AI for Real Estate",
    selectedHeadlineId: "coordinated-action",
    headlineAlternatives: [
      {
        id: "coordinated-action",
        title: "Her emlak sinyalini koordineli aksiyona dönüştürün.",
        rationale: "Tek bir otomasyon yerine operasyon sonucunu ve bütünsel ürün konumunu öne çıkarır.",
      },
      {
        id: "owner-visibility",
        title: "İlk mesajdan patron görünürlüğüne—tek operasyon beyni.",
        rationale: "Müşteri, çalışan ve işletme sahibi döngüsünü uçtan uca görünür kılar.",
      },
    ],
    supportingCopy:
      "Müşteri görüşmelerini, randevuları, satılık portföy fırsatlarını ve ekip bilgisini tek bir koordineli operasyon katmanında birleştirin; insana ihtiyaç duyulan anlarda ekibinizi sürecin dışında bırakmayın.",
    actions: [
      {
        label: "14 Günlük Ücretsiz Deneme Talep Edin",
        href: "/tr/contact?sector=real-estate&intent=trial",
        kind: "primary",
        analyticsEvent: "trial_started",
      },
      {
        label: "Giriş Yap",
        href: "/realestate/login",
        kind: "secondary",
        analyticsEvent: "login_clicked",
      },
    ],
    noCardLabel: "Kredi kartı gerekmez",
    proofSummary:
      "Genellikle 15 saniye içinde yanıt verir. Bir iç emlak operasyonunda 30 gün içinde 40’ın üzerinde portföy fırsatı belirlendi.",
  },
  problemSequence: {
    eyebrow: "İvmenin kaybolduğu yer",
    title: "Kaçan tek bir sinyal, operasyonun geri kalanını birbirinden koparabilir.",
    introduction:
      "Sorun çoğu zaman tek bir mesaj değildir. Mesajlar, randevular, portföyler ve ekip bilgisi ayrı kaldığında kaybolan bağlam zinciridir.",
    stages: [
      { id: "late-message", label: "Geciken mesaj" },
      { id: "lost-customer", label: "Kaçan müşteri ivmesi" },
      { id: "untracked-appointment", label: "Takipsiz randevu" },
      { id: "portfolio-gap", label: "Yetersiz satılık portföy" },
      { id: "visibility-gap", label: "Patron görünürlüğü kaybı" },
    ],
    transition:
      "Business CEO AI bu sinyalleri yeniden bağlar ve nitelikli her anı bir sonraki operasyon adımına taşır.",
  },
  whatsappOperations: {
    eyebrow: "Müşteri operasyonları",
    title: "İnsanın ne zaman devreye girmesi gerektiğini bilen yapay zekâ destekli WhatsApp operasyonları.",
    description:
      "Gelen ihtiyacı anlayın, görüşmeyi toplantı veya randevuya ilerletin, doğru çalışanı bilgilendirin ve sonucu patron görünürlüğüne taşıyın.",
    approvedDescriptor: "Yapay zekâ destekli WhatsApp operasyonları",
    aiDisclosure:
      "Business CEO AI’ın yapay zekâ destekli asistanıyla görüşüyorsunuz. İstediğiniz zaman bir ekip üyesi görüşmeyi devralabilir.",
    flow: [
      {
        id: "incoming-message",
        label: "Gelen mesaj",
        description: "Müşteri bir gayrimenkul ihtiyacı, sorusu veya görme niyetiyle görüşmeyi başlatır.",
      },
      {
        id: "ai-disclosure",
        label: "Yapay zekâ bildirimi",
        description: "Asistan kendisini açıkça tanıtır ve insan devrini her zaman mümkün tutar.",
      },
      {
        id: "response",
        label: "Yanıt",
        description: "İş akışı yanıt verir ve görüşmenin ilerlemesini sağlar.",
      },
      {
        id: "qualification",
        label: "İhtiyacı anlama",
        description: "İhtiyacı ve ilgili operasyon bağlamını toplar.",
      },
      {
        id: "appointment-intent",
        label: "Randevu niyeti",
        description: "Gayrimenkul görme veya görüşme talebi belirlenir.",
      },
      {
        id: "employee-handoff",
        label: "Çalışana devir",
        description: "Uygun ekip üyesi nitelikli bağlamı alır.",
      },
      {
        id: "owner-visibility",
        label: "Patron görünürlüğü",
        description: "Operasyon bilgisi işletme sahibinin görünümüne taşınır.",
      },
    ],
    capabilities: [
      "Gelen müşteri mesajlarına otomatik yanıt",
      "Genellikle 15 saniye içinde yanıt",
      "İhtiyaç anlama ve niteliklendirme",
      "Görüşme veya randevuya ilerletme",
      "Müşteri gayrimenkulü görmek istediğinde çalışanı bilgilendirme",
      "Çalışanlardan bilgi alma",
      "Operasyon bağlamını patrona taşıma",
      "Patronun doğal dilde operasyon soruları sorması",
      "Google bağlantıları",
      "İnsana devir",
    ],
  },
  portfolioHunter: {
    eyebrow: "Yeni portföy fırsatları",
    title: "Portfolio Hunter",
    description:
      "Satış odaklı gayrimenkul pazaryeri sinyallerini araştırır, ilan sahibiyle görüşmenin ilerlemesine yardımcı olur ve yetki fırsatı doğru aşamaya geldiğinde çalışanı bilgilendirir.",
    scopeNote:
      "Portfolio Hunter yalnızca satılık portföy fırsatlarına odaklanır. Herhangi bir gayrimenkul pazaryeriyle resmî bağlantı iddiasında bulunmaz.",
    flow: [
      {
        id: "marketplace-signal",
        label: "Pazaryeri sinyali",
        description: "İlgili bir satılık gayrimenkul sinyali araştırma akışına girer.",
      },
      {
        id: "opportunity-score",
        label: "Fırsat analizi",
        description: "Sinyal, potansiyel satış yetkisi fırsatı açısından değerlendirilir.",
      },
      {
        id: "owner-conversation",
        label: "İlan sahibi görüşmesi",
        description: "İlan sahibiyle görüşme açık bir bağlamla ilerletilir.",
      },
      {
        id: "authorization-stage",
        label: "Yetki aşaması",
        description: "İş akışı, insan katılımının anlamlı hâle geldiği noktayı belirler.",
      },
      {
        id: "employee-notification",
        label: "Çalışan bildirimi",
        description: "Ekip üyesi fırsatı ve toplanan bağlamı alır.",
      },
    ],
    capabilities: [
      "Satılık portföy fırsatlarına odaklı araştırma",
      "Gayrimenkul pazaryeri sinyal analizi",
      "İlan sahibiyle görüşmeyi ilerletme",
      "Yetki aşamasında çalışanı bilgilendirme",
    ],
  },
  generalManager: {
    eyebrow: "Patron zekâsı",
    title: "AI General Manager",
    description:
      "Müşteri, çalışan ve operasyon sinyallerini ortak bir patron görünümünde birleştirerek işletmenin dağınık görüşmeler arasında bağlam aramadan anlaşılmasını sağlar.",
    capabilities: [
      "Müşteri, çalışan ve yönetici koordinasyonu",
      "Çalışanlardan bilgi toplama",
      "Patronu bilgilendirme",
      "Operasyon görünürlüğü",
    ],
    exampleOwnerQuestion: "Bugün hangi randevular dikkat gerektiriyor ve her ekip üyesi neyi bekliyor?",
  },
  humanHandoff: {
    eyebrow: "İnsan değerlendirmesi döngünün içinde",
    title: "Yapay zekâ işi koordine eder. Önemli anların sahibi ekibinizdir.",
    description:
      "Business CEO AI, insanları müşteri ilişkilerinden veya işletme kararlarından çıkarmak için değil; doğru kişiyi yararlı bağlamla sürece almak için tasarlanmıştır.",
    steps: [
      "Yapay zekâ niyeti belirler ve ilgili bağlamı toplar.",
      "Uygun çalışan devir noktasında bilgilendirilir.",
      "Çalışan, görüşme geçmişi ve bir sonraki adım bağlamıyla süreci devralır.",
      "Patron operasyon sonucunu görmeye devam eder.",
    ],
  },
  proof: {
    eyebrow: "Operasyon kanıtı",
    title: "İki ölçülmüş sinyal. Uydurulmuş dönüşüm iddiası yok.",
    disclaimer:
      "Aşağıdaki veriler tipik ürün davranışını ve belirli bir iç operasyonu açıklar; işletme sonucu garanti etmez.",
    metrics: [
      {
        id: "response-speed",
        value: "~15 sn",
        statement: "Genellikle 15 saniye içinde yanıt verir.",
        context: "Tipik yanıt davranışıdır; süre bağlantı ve iş akışı koşullarına göre değişebilir.",
        evidenceBasis: "typical-product-behavior",
      },
      {
        id: "portfolio-opportunities",
        value: "40+",
        statement:
          "Bir iç emlak operasyonunda 30 gün içinde 40’ın üzerinde portföy fırsatı belirlendi.",
        context: "30 günlük tek bir iç emlak operasyonunda gözlemlendi; sonuçlar pazara ve girdi kalitesine göre değişir.",
        evidenceBasis: "internal-real-estate-operation",
      },
    ],
    internationalTestingStatement: "Seçili uluslararası emlak işletmeleriyle test edilmiştir.",
  },
  productFilms: {
    eyebrow: "Operasyon akışlarını görün",
    title: "İşin kendisine odaklanan iki kısa ürün filmi.",
    description:
      "Sentetik arayüz sahneleri, gerçek müşteri verisi veya tamamlanmamış ürün ekranları kullanmadan her iş akışını açıklar.",
    films: [
      {
        id: "whatsapp-operations",
        title: "WhatsApp Operasyonları",
        description:
          "Gelen mesaj ve görünür yapay zekâ bildiriminden ihtiyaç analizine, çalışana devre ve patron görünürlüğüne.",
        durationLabel: "20–30 saniye",
        captionsRequired: true,
      },
      {
        id: "portfolio-hunter",
        title: "Portfolio Hunter",
        description:
          "Pazaryeri sinyalinden fırsat analizine, ilan sahibi görüşmesine, yetki aşamasına ve çalışan bildirimine.",
        durationLabel: "20–30 saniye",
        captionsRequired: true,
      },
    ],
  },
  security: {
    eyebrow: "Veri ilkeleri",
    title: "Kalıcı bir ham mesaj arşivi değil, yararlı operasyon bağlamı tutun.",
    description:
      "Ürün; desteklenmeyen sertifika iddiaları kullanmadan açık saklama sınırları, izole tenant verileri ve şifreleme ilkeleri üzerine tasarlanmıştır.",
    principles: [
      {
        id: "raw-message-deletion",
        title: "Ham mesajlar",
        description: "Ham WhatsApp mesajları anında silinir.",
      },
      {
        id: "structured-crm-retention",
        title: "Yapılandırılmış operasyon bağlamı",
        description: "İsim, ihtiyaç, randevu ve CRM özeti hesap aktifken saklanabilir.",
      },
      {
        id: "account-closure",
        title: "Hesap kapanışı",
        description:
          "Hesap kapanınca yapılandırılmış CRM bilgileri aktif sistemlerde saklanmaz.",
      },
      {
        id: "no-model-training",
        title: "Model eğitimi yok",
        description: "Müşteri verileri model eğitimi için kullanılmaz.",
      },
      {
        id: "tenant-isolation",
        title: "Tenant izolasyonu",
        description: "Tenant verileri izole edilir.",
      },
      {
        id: "encryption-in-transit",
        title: "Aktarım sırasında",
        description: "Veriler aktarım sırasında şifrelenir.",
      },
      {
        id: "encryption-at-rest",
        title: "Veritabanında",
        description: "Veriler veritabanında şifrelenir.",
      },
    ],
    certificationNote: "Doğrulanmamış sertifika veya güvenlik üstünlüğü iddiasında bulunulmaz.",
  },
  pricingReference: {
    title: "Office ile başlayın. Enterprise ile ölçekleyin.",
    description:
      "Office mevcut yapay zekâ iş gücünü ve 14 günlük ücretsiz denemeyi içerir. Enterprise, çoklu ofis ve özel operasyon ihtiyaçlarını destekler.",
    officePrice: "₺11.350",
    cadence: "/ ay",
    enterpriseLabel: "Satış Ekibiyle Görüşün",
    action: {
      label: "Planları Karşılaştırın",
      href: "#pricing",
      kind: "primary",
      analyticsEvent: "pricing_plan_selected",
    },
  },
  finalCta: {
    eyebrow: "Operasyon döngüsünü görmek için 14 gün",
    title: "Ekibinizin her gün yürüttüğü emlak operasyonlarıyla başlayın.",
    description:
      "Office deneyimini 14 gün boyunca deneyin. Kredi kartı gerekmez ve yapay zekâ destekli görüşmeleri bir ekip üyesi istediğiniz zaman devralabilir.",
    actions: [
      {
        label: "14 Günlük Ücretsiz Deneme Talep Edin",
        href: "/tr/contact?sector=real-estate&intent=trial",
        kind: "primary",
        analyticsEvent: "trial_started",
      },
      {
        label: "Giriş Yap",
        href: "/realestate/login",
        kind: "secondary",
        analyticsEvent: "login_clicked",
      },
    ],
  },
} as const satisfies RealEstateContent;
