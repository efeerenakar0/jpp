import type { HomeContent } from "@/marketing/types";

export const homeContent = {
  locale: "tr",
  metadata: {
    title: "Business CEO AI | İşletmenizin operasyon beyni",
    description:
      "Müşterileri, çalışanları ve operasyonları koordine eden; emlak sektörüyle başlayan bir AI Business Operating System.",
    canonicalPath: "/tr",
  },
  brand: {
    name: "Business CEO AI",
    category: "AI Business Operating System",
    tagline: "İşletmenizin operasyon beyni.",
  },
  presentation: {
    productStatusLabel: "Ürün durumu",
    systemFigureLabel: "Business CEO AI operasyon çekirdeğinden geçen sinyaller",
    systemModelLabel: "İşletim sistemi modeli",
    humanInLoopLabel: "İnsan döngünün içinde",
    coreLabel: "İşletme operasyon beyni",
    coreStatus: "Dinle · koordine et · harekete geç",
    signalNodes: [
      { stage: "Dinle", label: "Müşteri niyeti" },
      { stage: "Anla", label: "Ekip bilgisi" },
      { stage: "Harekete geç", label: "Satış sinyali" },
      { stage: "Raporla", label: "Patron görünürlüğü" },
      { stage: "Koordine et", label: "Randevu aksiyonu" },
    ],
    readout: ["Sinyal", "Bağlam", "Aksiyon"],
    heroIndexLabel: "01 / Operasyon beyni",
    heroAudienceLabel: "Müşteriler · çalışanlar · patronlar",
    manifestoFlow: ["Sinyal", "Bağlam", "Karar", "Aksiyon"],
    workforceMapLabel: "Müşteri, yapay zekâ, ekip ve patron koordinasyon haritası",
    tailoredOperationsLabel: "İhtiyaca göre operasyon",
    founderLinkLabel: "Kurucu",
  },
  hero: {
    eyebrow: "AI Business Operating System",
    title: "İşletmenizin operasyon beyni.",
    supportingCopy:
      "Business CEO AI; müşterileri, çalışanları ve operasyonları tek bir akıllı işletim katmanında koordine eder. Bugün emlak sektörü için geliştirildi, yarının işletmeleri için tasarlandı.",
    actions: [
      {
        label: "Business CEO AI’ı Keşfedin",
        href: "/tr#platform",
        kind: "primary",
        analyticsEvent: "primary_cta_clicked",
      },
      {
        label: "Emlak için Business CEO AI",
        href: "/tr/realestate",
        kind: "secondary",
        analyticsEvent: "realestate_explored",
      },
      {
        label: "Giriş Yap",
        href: "/realestate/login",
        kind: "tertiary",
        analyticsEvent: "login_clicked",
      },
    ],
  },
  manifesto: {
    eyebrow: "Sinyalden aksiyona",
    title: "Bir işletmede yüzlerce sinyal oluşur. Çoğu birbirinden kopuk kalır.",
    body:
      "Business CEO AI; müşteri niyetini, ekip bilgisini ve operasyon olaylarını koordineli aksiyona dönüştürür, ardından sonucu görmesi gereken kişilere taşır.",
  },
  operationalLoop: {
    eyebrow: "Operasyon döngüsü",
    title: "İşi anlamak ve ilerletmek için kesintisiz bir sistem.",
    introduction:
      "Her mesajı, randevuyu ve fırsatı ayrı bir araçta bırakmak yerine Business CEO AI, operasyon bağlamını ortak bir döngü içinde hareket ettirir.",
    steps: [
      {
        id: "listen",
        label: "Dinle",
        description: "Müşterilerden, çalışanlardan ve aktif operasyonlardan gelen sinyalleri yakala.",
      },
      {
        id: "understand",
        label: "Anla",
        description: "Her sinyalin arkasındaki niyeti, aciliyeti ve operasyon bağlamını belirle.",
      },
      {
        id: "coordinate",
        label: "Koordine Et",
        description: "Doğru bilgiyi, yapay zekâ iş akışını ve ekip üyesini bir araya getir.",
      },
      {
        id: "act",
        label: "Harekete Geç",
        description: "Görüşmeyi, randevuyu veya fırsatı bir sonraki anlamlı adıma taşı.",
      },
      {
        id: "report",
        label: "Raporla",
        description: "İşletme sahibine gerçekleşenleri ve dikkat gerektiren noktaları açıkça göster.",
      },
    ],
  },
  flagship: {
    eyebrow: "Amiral ürün",
    title: "Business CEO AI for Real Estate",
    description:
      "Müşteri görüşmelerini, ekip devirlerini, portföy fırsatlarını ve yönetici görünürlüğünü koordine eden operasyon katmanı.",
    capabilities: [
      {
        id: "whatsapp-operations",
        title: "Yapay zekâ destekli WhatsApp operasyonları",
        description:
          "Müşteri niyetini yanıtlayın, anlayın ve doğru insan devrine doğru ilerletin.",
        signalLabel: "Müşteri operasyonları",
      },
      {
        id: "portfolio-hunter",
        title: "Portfolio Hunter",
        description:
          "Gayrimenkul pazaryeri sinyallerini insan incelemesine hazır satılık portföy fırsatlarına dönüştürün.",
        signalLabel: "Fırsat zekâsı",
      },
      {
        id: "general-manager",
        title: "AI General Manager",
        description:
          "Ekip sinyallerini toplayın ve patrona doğal dilde operasyon görünürlüğü verin.",
        signalLabel: "Patron görünürlüğü",
      },
      {
        id: "human-handoff",
        title: "İnsan devri",
        description:
          "Doğru ekip üyesini, ivme kaybetmeden devam etmesi için gereken bağlamla devreye alın.",
        signalLabel: "İnsan döngünün içinde",
      },
    ],
    actions: [
      {
        label: "Emlak Ürününü Keşfedin",
        href: "/tr/realestate",
        kind: "secondary",
        analyticsEvent: "realestate_explored",
      },
      {
        label: "14 Günlük Ücretsiz Deneme Talep Edin",
        href: "/tr/contact?sector=real-estate&intent=trial",
        kind: "primary",
        analyticsEvent: "trial_started",
      },
    ],
  },
  proof: {
    eyebrow: "Bağlamıyla birlikte kanıt",
    title: "Emlak operasyonlarından ölçülen sinyaller.",
    disclaimer:
      "Bu veriler, belirtilen ürün davranışını ve bir iç operasyon dönemini açıklar; gelecekteki sonuçlar için garanti değildir.",
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
  },
  workforce: {
    eyebrow: "Koordineli yapay zekâ iş gücü",
    title: "Müşteriyi, ekibi ve işletme sahibini aynı operasyon bağlamında tutun.",
    description:
      "Yapay zekâ rutin koordinasyonu ilerletirken insanlar görünür ve bilgili kalır; doğru anda süreci devralabilir.",
    roles: [
      {
        id: "customer",
        label: "Müşteri",
        description: "İhtiyacını, sorusunu veya randevu niyetini paylaşır.",
      },
      {
        id: "ai-operations",
        label: "Yapay zekâ operasyon katmanı",
        description: "Sinyali anlar ve bir sonraki adımı koordine eder.",
      },
      {
        id: "team-member",
        label: "Ekip üyesi",
        description: "Nitelikli bağlamı alır, insan değerlendirmesi gerektiğinde devreye girer.",
      },
      {
        id: "owner",
        label: "İşletme sahibi",
        description: "Operasyon ilerleyişini, boşlukları ve dikkat gerektiren kararları görür.",
      },
    ],
  },
  industriesPreview: {
    eyebrow: "Tek işletim sistemi, birden fazla sektör",
    title: "Operasyonun insana, zamana ve bağlama dayandığı her alana genişlemek için tasarlandı.",
    description:
      "Emlak aktif amiral üründür. Restoran, otelcilik, inşaat ve toptan ticaret işletim modelleri aktif geliştirme aşamasındadır.",
    flagshipLabel: "Aktif amiral ürün",
    developmentLabel: "Aktif geliştirme aşamasında",
  },
  ownership: {
    statement: "Business CEO AI, NexFrame AI tarafından KatEXtrema AI iş birliğiyle geliştirilmektedir.",
    developerName: "NexFrame AI",
    collaboratorName: "KatEXtrema AI",
    nexFrameLinkedIn: "https://www.linkedin.com/company/139593914",
    founderLinkedIn: "https://www.linkedin.com/in/efeerenakar0",
    founderTitle: "Co-Founder & CTO at NexFrame AI and Business CEO AI",
  },
  pricingPreview: {
    eyebrow: "Türkiye lansman fiyatı",
    title: "Eksiksiz Office deneyimiyle başlayın.",
    office: {
      name: "Office",
      price: "₺11.350",
      cadence: "/ ay",
      note: "Türkiye lansman fiyatı",
    },
    enterprise: {
      name: "Enterprise",
      priceLabel: "Satış Ekibiyle Görüşün",
    },
    trialLabel: "14 günlük ücretsiz deneme",
    noCardLabel: "Kredi kartı gerekmez",
    action: {
      label: "Fiyatları İnceleyin",
      href: "/tr/realestate#pricing",
      kind: "primary",
      analyticsEvent: "pricing_plan_selected",
    },
  },
  trust: {
    eyebrow: "Operasyon kanıtı",
    title: "Gerçek iş akışları için tasarlanan çalışma modeli.",
    selectedVariant: "anonymous",
    variants: [
      {
        id: "anonymous",
        isDefault: true,
        statement:
          "İnsan onayını koruyan, ölçülebilir ve izlenebilir operasyon döngüleri üzerine kurulmuştur.",
        organizations: [],
      },
    ],
  },
  finalCta: {
    eyebrow: "Emlak ile başlayın",
    title: "Operasyonunuza bir sonraki aksiyonu ilerleten bir beyin kazandırın.",
    description:
      "Amiral ürünü keşfedin veya kredi kartı gerektirmeyen 14 günlük Office denemesi için talep gönderin.",
    actions: [
      {
        label: "Ücretsiz Deneme Talep Edin",
        href: "/tr/contact?sector=real-estate&intent=trial",
        kind: "primary",
        analyticsEvent: "trial_started",
      },
      {
        label: "Emlak Ürününü Keşfedin",
        href: "/tr/realestate",
        kind: "secondary",
        analyticsEvent: "realestate_explored",
      },
    ],
  },
} as const satisfies HomeContent;
