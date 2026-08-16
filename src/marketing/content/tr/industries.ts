import type { IndustriesContent } from "@/marketing/types";

export const industriesContent = {
  locale: "tr",
  metadata: {
    title: "Sektörler | Business CEO AI",
    description:
      "Business CEO AI’ın aktif emlak ürününü ve restoran, otelcilik, inşaat ve toptan ticaret için geliştirilmekte olan işletim modellerini keşfedin.",
    canonicalPath: "/tr/industries",
  },
  hero: {
    eyebrow: "Sektörel işletim sistemleri",
    title: "Tek operasyon beyni, her işletmenin gerçeklerine göre şekillenen bir model.",
    description:
      "Business CEO AI, çalışan amiral ürünü Real Estate ile başlar ve sektör ortaklarıyla geliştirilen odaklı işletim modelleriyle genişler.",
  },
  statusLabels: {
    flagship: "Aktif amiral ürün",
    "in-active-development": "Aktif geliştirme aşamasında",
  },
  developmentDisclaimer:
    "Yalnızca Real Estate aktif amiral ürün olarak sunulur. Diğer sektör modelleri aktif geliştirme aşamasındadır ve yayınlanmış özellikler gibi anlatılmaz.",
  sectors: [
    {
      id: "real-estate",
      name: "Emlak",
      route: "/tr/realestate",
      roadmapPriority: 1,
      eyebrow: "Amiral ürün",
      headline: "Müşteri görüşmelerini, portföy fırsatlarını ve patron görünürlüğünü koordine edin.",
      summary:
        "Business CEO AI for Real Estate; yapay zekâ destekli WhatsApp operasyonlarını, Portfolio Hunter’ı, ekip devirlerini ve AI General Manager’ı birleştirir.",
      operationalProblems: [
        "İvmesini kaybeden müşteri mesajları",
        "Ekip aksiyonundan kopan randevular",
        "Yeterli bağlam olmadan gelen satılık portföy fırsatları",
        "Operasyonun tamamını göremeyen işletme sahipleri",
      ],
      actions: [
        {
          label: "Emlak Ürününü Keşfedin",
          href: "/tr/realestate",
          kind: "primary",
          analyticsEvent: "realestate_explored",
        },
        {
          label: "Ücretsiz Deneme Talep Edin",
          href: "/tr/contact?sector=real-estate&intent=trial",
          kind: "secondary",
          analyticsEvent: "trial_started",
        },
      ],
      status: "flagship",
      statusLabel: "Aktif amiral ürün",
      proof:
        "Genellikle 15 saniye içinde yanıt verir. Bir iç emlak operasyonunda 30 gün içinde 40’ın üzerinde portföy fırsatı belirlendi.",
    },
    {
      id: "restaurants",
      name: "Restoranlar",
      route: "/tr/industries/restaurants",
      roadmapPriority: 2,
      eyebrow: "Restoran operasyonları",
      headline: "Misafir talebini, servis koordinasyonunu ve patron görünürlüğünü birbirine bağlayın.",
      summary:
        "Zamanlamanın, ekip koordinasyonunun ve değişen talebin tek bir servis operasyonunda buluştuğu restoranlar için gelecek işletim modeli.",
      operationalProblems: [
        "Kanallara ve vardiyalara bölünen misafir talepleri",
        "Salon ve mutfak bağlamının geç ulaşması",
        "Ortak görünümü olmayan rezervasyon, telafi ve takip süreçleri",
        "İşletme sahibinin tekrar eden sorunları servis sonrasında öğrenmesi",
      ],
      futureOperatingModel: {
        title: "Geliştirilmekte olan restoran işletim modeli",
        description:
          "Business CEO AI; restoran ekiplerinin talepleri, servis bağlamını ve yönetici görünürlüğünü koordine etmesine yardımcı olacak şekilde geliştirilmektedir. Model yayınlanmış bir ürün olarak sunulmaz.",
        plannedOutcomes: [
          "Misafir niyeti ve servis bağlamı için ortak görünüm",
          "Roller ve vardiyalar arasında daha açık koordinasyon",
          "İnsan müdahalesi gerektiren konuların daha hızlı iletilmesi",
          "Yönetici ve patronlar için operasyon özetleri",
        ],
      },
      actions: [
        {
          label: "Kurucu iş ortağı olun",
          href: "/tr/contact?sector=restaurants&intent=founding-partner",
          kind: "primary",
          analyticsEvent: "sector_contact_started",
        },
        {
          label: "Demo Talep Edin",
          href: "/tr/contact?sector=restaurants&intent=demo",
          kind: "secondary",
          analyticsEvent: "sector_contact_started",
        },
      ],
      status: "in-active-development",
      statusLabel: "Aktif geliştirme aşamasında",
      contactPreset: {
        sector: "restaurants",
        primaryIntent: "founding-partner",
      },
    },
    {
      id: "hospitality",
      name: "Otelcilik",
      route: "/tr/industries/hospitality",
      roadmapPriority: 3,
      eyebrow: "Otelcilik operasyonları",
      headline: "Misafir bağlamını talepler, ekipler ve konaklamanın tamamı boyunca taşıyın.",
      summary:
        "Departmanlar ve değişen vardiyalar arasında yüksek temaslı hizmet yöneten otelcilik işletmeleri için gelecek işletim modeli.",
      operationalProblems: [
        "Ortak bağlam olmadan departmanlar arasında dolaşan misafir talepleri",
        "Takibi kesintiye uğratan vardiya değişimleri",
        "Yöneticilere geç ulaşan hizmet sorunları",
        "Ayrı görüşmeler içinde görünmeyen tekrar eden ihtiyaçlar",
      ],
      futureOperatingModel: {
        title: "Geliştirilmekte olan otelcilik işletim modeli",
        description:
          "Business CEO AI; misafir niyeti, departman devirleri ve yönetici görünürlüğü için bir koordinasyon katmanı olarak araştırılmaktadır. Bu yetenekler geliştirme aşamasındadır.",
        plannedOutcomes: [
          "Ekipler arasında kesintisiz misafir bağlamı",
          "Açık bir sonraki aksiyona sahip departman devirleri",
          "Hassas hizmet anlarında insana yönlendirme",
          "Misafir yolculuğu boyunca yönetici görünürlüğü",
        ],
      },
      actions: [
        {
          label: "Kurucu iş ortağı olun",
          href: "/tr/contact?sector=hospitality&intent=founding-partner",
          kind: "primary",
          analyticsEvent: "sector_contact_started",
        },
        {
          label: "Demo Talep Edin",
          href: "/tr/contact?sector=hospitality&intent=demo",
          kind: "secondary",
          analyticsEvent: "sector_contact_started",
        },
      ],
      status: "in-active-development",
      statusLabel: "Aktif geliştirme aşamasında",
      contactPreset: {
        sector: "hospitality",
        primaryIntent: "founding-partner",
      },
    },
    {
      id: "construction",
      name: "Müteahhitler",
      route: "/tr/industries/construction",
      roadmapPriority: 4,
      eyebrow: "İnşaat operasyonları",
      headline: "Saha sinyallerini, ofis kararlarını ve proje takibini birlikte görünür kılın.",
      summary:
        "Değişen şantiyelerde ekipleri, proje sinyallerini ve yönetim kararlarını koordine eden müteahhitler için gelecek işletim modeli.",
      operationalProblems: [
        "Ofis kararlarından kopuk saha güncellemeleri",
        "İş geciktikten sonra fark edilen bağımlılıklar",
        "Net sorumlusu olmayan soru ve onaylar",
        "Birçok kaynaktan elle birleştirilen yönetici görünürlüğü",
      ],
      futureOperatingModel: {
        title: "Geliştirilmekte olan inşaat işletim modeli",
        description:
          "Business CEO AI; saha bilgisini, ekip koordinasyonunu ve yönetici dikkatini birbirine bağlayacak şekilde tasarlanmaktadır. Henüz canlı bir inşaat ürünü olarak sunulmaz.",
        plannedOutcomes: [
          "Yapılandırılmış sahadan ofise bilgi akışı",
          "Soru ve onaylar için açık sorumluluk",
          "Operasyon engellerinin daha erken görünmesi",
          "Ekip güncellemelerine dayanan yönetim özetleri",
        ],
      },
      actions: [
        {
          label: "Kurucu iş ortağı olun",
          href: "/tr/contact?sector=construction&intent=founding-partner",
          kind: "primary",
          analyticsEvent: "sector_contact_started",
        },
        {
          label: "Demo Talep Edin",
          href: "/tr/contact?sector=construction&intent=demo",
          kind: "secondary",
          analyticsEvent: "sector_contact_started",
        },
      ],
      status: "in-active-development",
      statusLabel: "Aktif geliştirme aşamasında",
      contactPreset: {
        sector: "construction",
        primaryIntent: "founding-partner",
      },
    },
    {
      id: "wholesale",
      name: "Toptancılar",
      route: "/tr/industries/wholesale",
      roadmapPriority: 5,
      eyebrow: "Toptan ticaret operasyonları",
      headline: "Alıcı taleplerini, ekip bilgisini ve ticari takibi koordine edin.",
      summary:
        "Tekrarlayan alıcıları, hızla değişen talepleri ve ekip içinde dağılmış bilgiyi yöneten toptancılar için gelecek işletim modeli.",
      operationalProblems: [
        "Görüşmelere ve satış çalışanlarına bölünen alıcı talepleri",
        "Güncelliğini kaybeden stok ve ticari bağlam",
        "Bireysel hafızaya bağlı takip",
        "Aktif talebin güncel görünümüne sahip olmayan işletme sahipleri",
      ],
      futureOperatingModel: {
        title: "Geliştirilmekte olan toptan ticaret işletim modeli",
        description:
          "Business CEO AI; alıcı niyeti, çalışan koordinasyonu ve patron görünürlüğü için bir katman olarak araştırılmaktadır. Yayınlanmamış hiçbir yetenek bugün kullanılabilir gibi sunulmaz.",
        plannedOutcomes: [
          "Yapılandırılmış alıcı ihtiyacı ve ticari bağlam",
          "Satış rolleri arasında tutarlı devirler",
          "Görünür takip ve çözümlenmemiş talepler",
          "İşletme sahipleri için daha açık operasyon görünümü",
        ],
      },
      actions: [
        {
          label: "Kurucu iş ortağı olun",
          href: "/tr/contact?sector=wholesale&intent=founding-partner",
          kind: "primary",
          analyticsEvent: "sector_contact_started",
        },
        {
          label: "Demo Talep Edin",
          href: "/tr/contact?sector=wholesale&intent=demo",
          kind: "secondary",
          analyticsEvent: "sector_contact_started",
        },
      ],
      status: "in-active-development",
      statusLabel: "Aktif geliştirme aşamasında",
      contactPreset: {
        sector: "wholesale",
        primaryIntent: "founding-partner",
      },
    },
  ],
} as const satisfies IndustriesContent;
