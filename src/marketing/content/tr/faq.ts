import type { FaqContent } from "@/marketing/types";

export const faqContent = {
  locale: "tr",
  metadata: {
    title: "Sık Sorulan Sorular | Business CEO AI",
    description:
      "Business CEO AI, emlak ürünü, deneme, fiyatlandırma, insan devri ve veri ilkeleri hakkında yanıtlar.",
    canonicalPath: "/tr#faq",
  },
  eyebrow: "Sorulara açık yanıtlar",
  title: "İşletmelerin ve ekiplerin bilmesi gerekenler.",
  introduction:
    "Business CEO AI; jenerik bir chatbot, uydurulmuş bir vaat veya insan değerlendirmesinin yerine geçen bir sistem değil, koordineli iş için bir işletim sistemidir.",
  groups: [
    {
      id: "general",
      title: "Business CEO AI",
      description: "Amiral emlak ürününün arkasındaki platform, şirket ve yön.",
      items: [
        {
          id: "what-is-business-ceo-ai",
          question: "Business CEO AI nedir?",
          answer:
            "Business CEO AI bir AI Business Operating System’dir. Müşteri iletişimini, çalışan bilgisini, satış faaliyetlerini, randevuları, fırsatları ve patron görünürlüğünü tek bir akıllı işletim katmanında koordine etmek için tasarlanmıştır.",
        },
        {
          id: "is-it-a-chatbot",
          question: "Business CEO AI bir chatbot mu?",
          answer:
            "Hayır. Görüşme bir arayüz olabilir; ancak ürün müşteri, çalışan ve patron arasındaki operasyon beyni olarak konumlanır. Birden fazla iş akışını koordine eder, bağlamı aksiyon ve raporlamaya taşır.",
        },
        {
          id: "which-industries",
          question: "Business CEO AI yalnızca emlak sektörü için mi?",
          answer:
            "Hayır. Real Estate aktif amiral üründür. Restoran, otelcilik, inşaat ve toptan ticaret işletim modelleri aktif geliştirme aşamasındadır ve yayınlanmış ürünler gibi sunulmaz.",
        },
        {
          id: "does-ai-replace-team",
          question: "Yapay zekâ çalışanların yerini mi alır?",
          answer:
            "İşletim modeli insanı döngünün içinde tutar. Yapay zekâ rutin anlama ve koordinasyonu yürütür; değerlendirme, ilişki sahipliği veya karar gerektiğinde uygun çalışanı sürece alır.",
        },
        {
          id: "who-builds-it",
          question: "Business CEO AI’ı kim geliştiriyor?",
          answer:
            "Business CEO AI, NexFrame AI tarafından KatEXtrema AI iş birliğiyle geliştirilmektedir.",
        },
        {
          id: "where-starting",
          question: "Business CEO AI ilk olarak nerede kullanıma sunuluyor?",
          answer:
            "İlk pazar Türkiye’dir. Web sitesi ve ürün anlatımı İngilizce ile Türkçeyi destekler; varsayılan global dil İngilizcedir.",
        },
        {
          id: "start-other-industry",
          question: "Başka bir sektördeki işletme nasıl sürece katılabilir?",
          answer:
            "Sektörünüzü seçerek demo talep edebilir veya kurucu iş ortağı olmak için başvurabilirsiniz. İletişim formu sektör seçimini korur; böylece görüşme ilgili operasyon bağlamıyla başlar.",
        },
      ],
    },
    {
      id: "real-estate",
      title: "Business CEO AI for Real Estate",
      description: "Ürün kapsamı, kanıt, deneme koşulları, fiyatlandırma ve veri işleme.",
      items: [
        {
          id: "what-real-estate-coordinates",
          question: "Real Estate ürünü neleri koordine eder?",
          answer:
            "Yapay zekâ destekli WhatsApp operasyonlarını, ihtiyaç analizini, randevu niyetini, çalışana devri, Portfolio Hunter sinyallerini ve AI General Manager üzerinden patron görünürlüğünü birbirine bağlar.",
        },
        {
          id: "response-time",
          question: "Gelen bir mesaja ne kadar hızlı yanıt verir?",
          answer:
            "Genellikle 15 saniye içinde yanıt verir. Bu süre garantili bir hizmet seviyesi değil, tipik davranıştır; bağlantı ve iş akışı koşullarına göre değişebilir.",
        },
        {
          id: "whatsapp-status",
          question: "Ürün resmî bir sağlayıcı ortaklığı iddiasında bulunuyor mu?",
          answer:
            "Herhangi bir sağlayıcı ortaklığı veya resmî entegrasyon statüsü iddiasında bulunulmaz. Doğru anlatım “yapay zekâ destekli WhatsApp operasyonları” veya “akıllı WhatsApp iş akışları”dır.",
        },
        {
          id: "portfolio-hunter",
          question: "Portfolio Hunter nedir?",
          answer:
            "Portfolio Hunter satılık gayrimenkul pazaryeri sinyallerini araştırır, ilan sahibi görüşmesini ilerletmeye yardımcı olur ve yetki aşamasında çalışanı bilgilendirir. Yalnızca satış odaklıdır ve adı belirtilen bir pazaryeriyle bağlantı iddiasında bulunmaz.",
        },
        {
          id: "human-takeover",
          question: "Bir ekip üyesi görüşmeyi devralabilir mi?",
          answer:
            "Evet. Onaylı bildirim şöyledir: “Business CEO AI’ın yapay zekâ destekli asistanıyla görüşüyorsunuz. İstediğiniz zaman bir ekip üyesi görüşmeyi devralabilir.” Devir, operasyon akışının görünür bir parçasıdır.",
        },
        {
          id: "trial-terms",
          question: "14 günlük deneme nasıl çalışır?",
          answer:
            "Deneme, Office özelliklerini 14 gün boyunca içerir ve kredi kartı gerektirmez. Deneme sonunda ödeme tamamlanmazsa hesap kapatılır veya askıya alınır. Deneme her şirket için bir kez sunulmak üzere tasarlanmıştır.",
        },
        {
          id: "pricing",
          question: "Business CEO AI for Real Estate fiyatı nedir?",
          answer:
            "Office, Türkiye lansman fiyatı kapsamında ₺11.350 / ay olarak sunulur. Enterprise için satış ekibiyle görüşülür. Önerilen altı ve on iki aylık toplamlar onay beklediği için herkese açık değildir.",
        },
        {
          id: "data-handling",
          question: "Görüşme verileri nasıl işlenir?",
          answer:
            "Ham WhatsApp mesajları anında silinir. İsim, ihtiyaç, randevu ve CRM özeti gibi yapılandırılmış bilgiler hesap aktifken saklanabilir; hesap kapandıktan sonra aktif sistemlerde tutulmaz. Veriler model eğitimi için kullanılmaz, tenant verileri izole edilir ve veriler aktarım sırasında ve veritabanında şifrelenir.",
        },
      ],
    },
  ],
  contactPrompt: {
    text: "İşletim modelinin işletmenize uygun olup olmadığına hâlâ karar mı veriyorsunuz?",
    action: {
      label: "Ekiple İletişime Geçin",
      href: "mailto:info@businessceo.ai",
      kind: "secondary",
    },
  },
} as const satisfies FaqContent;
