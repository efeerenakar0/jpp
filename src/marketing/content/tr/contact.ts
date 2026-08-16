import type { ContactContent } from "@/marketing/contact";

export const contactContent = {
  locale: "tr",
  metadata: {
    title: "Ekiple iletişime geçin",
    description:
      "Business CEO AI ile Emlak deneme talebi hazırlayın, ürün demosu planlayın, satış ekibiyle görüşün veya kurucu iş ortaklığını keşfedin.",
    canonicalPath: "/tr/contact",
  },
  routeLabel: "İletişim / nitelikli ön bilgi",
  hero: {
    real_estate: {
      title: "Emlak deneme görüşmenizi hazırlayın.",
      description:
        "Ofisinizin bugün müşteri adaylarını, portföyleri ve ekip takibini nasıl yönettiğini anlatın. Bu adım insan değerlendirmesi için ön bilgi hazırlar; otomatik olarak hesap veya deneme başlatmaz.",
      contextLabel: "Emlak · deneme hazırlığı",
    },
    enterprise_sales: {
      title: "Daha büyük bir ağ için işletim modeli tasarlayın.",
      description:
        "Operasyonunuzun ofis, bağlantı ve geçiş gereksinimlerini paylaşın. Ön bilgiyi, herkese açık fiyat veya ölçülmemiş SLA uydurmadan Enterprise görüşmesini çerçevelemek için kullanacağız.",
      contextLabel: "Enterprise · operasyon kapsamı",
    },
    book_demo: {
      title: "Tek bir işletim katmanının sürtünmeyi nerede azaltacağını görün.",
      description:
        "İşletmeyi yavaşlatan müşteri, çalışan veya operasyon devirlerini anlatın. Bu bağlamı odaklı bir ürün görüşmesi hazırlamak için kullanacağız.",
      contextLabel: "Ürün demosu · operasyon uyumu",
    },
    founding_partner: {
      title: "Sıradaki sektör işletim modelini birlikte şekillendirin.",
      description:
        "Business CEO AI yeni sektör modellerini aktif olarak geliştiriyor. Kurucu iş ortağı olarak sunabileceğiniz iş akışı bilgisini, kısıtları ve iş birliği kapsamını paylaşın.",
      contextLabel: "Kurucu iş ortağı · sektör tasarımı",
    },
  },
  introduction: {
    title: "Gerçek operasyon bağlamıyla başlayın.",
    description:
      "Kısa bir ön bilgi, görüşmeden önce uyumu anlamamıza yardımcı olur. Parola, ödeme bilgisi, özel WhatsApp konuşması veya başka hassas bilgiler paylaşmayın.",
    responseNote:
      "Bağımsız formun teslimat servisi henüz bağlı değil. Bugün için çalışan iletişim yolu e-postadır.",
    emailLabel: "Ekibe e-posta gönderin",
  },
  process: [
    {
      title: "Operasyonu çerçeveleyin",
      description: "İşletmeyi, ekip büyüklüğünü ve ele alınması gereken iş akışını paylaşın.",
    },
    {
      title: "Uyumu değerlendirelim",
      description: "Ekip kapsamı, hazırlığı ve doğru sonraki görüşmeyi değerlendirir.",
    },
    {
      title: "Bir insanla devam edin",
      description: "Sonraki adımı otomatik başarı ekranı değil, gerçek bir ekip üyesi üstlenir.",
    },
  ],
  provider: {
    statusLabel: "Teslimat durumu",
    unavailableTitle: "Form teslimatı bağlı değil",
    unavailableDescription:
      "Bu bağımsız forma girilen hiçbir bilgi gönderilmez veya saklanmaz. Canlı bir talep için doğrudan e-posta bağlantısını kullanın.",
    submittedUnavailableTitle: "Ön bilginiz kontrol edildi ancak gönderilmedi",
    submittedUnavailableDescription:
      "Alanlar geçerli fakat iletişim backend’i bağlı değil. Herhangi bir başvuru oluşturulmadı. Lütfen info@businessceo.ai adresine e-posta gönderin.",
    genericErrorTitle: "Talep işlenemedi",
    genericErrorDescription:
      "Herhangi bir başvuru oluşturulmadı. Formu gözden geçirin veya aşağıdaki doğrudan e-posta yolunu kullanın.",
    acceptedTitle: "Talep alındı",
    acceptedDescription:
      "İletişim servisi talebinizi kabul etti. Ekip paylaştığınız operasyon bağlamını değerlendirecek.",
  },
  form: {
    title: "Ön bilgiyi oluşturun",
    description: "Talep kontrol edilmeden önce zorunlu işaretli alanlar tamamlanmalıdır.",
    requiredLabel: "Zorunlu",
    optionalLabel: "İsteğe bağlı",
    selectPlaceholder: "Bir seçenek belirleyin",
    nameLabel: "Ad soyad",
    namePlaceholder: "Adınız ve soyadınız",
    workEmailLabel: "İş e-postası",
    workEmailPlaceholder: "ad@sirket.com",
    phoneLabel: "Telefon / WhatsApp",
    phonePlaceholder: "+90 5xx xxx xx xx",
    companyLabel: "Şirket",
    companyPlaceholder: "Şirket adı",
    sectorLabel: "Sektör",
    teamSizeLabel: "Ekip büyüklüğü",
    messageLabel: "Mesaj",
    messagePlaceholder:
      "Operasyon problemi nedir, kimleri etkiliyor ve yararlı bir sonraki görüşme neleri kapsamalı?",
    privacyPrefix: "Bilgilerimin nasıl ele alınacağını açıklayan",
    privacyLinkLabel: "Gizlilik Bildirimi’ni",
    privacySuffix: "okuduğumu kabul ediyorum.",
    privacyHref: "/tr/legal/privacy",
    consentGroupLabel: "Gizlilik ve iletişim tercihleri",
    marketingConsentLabel: "Bana zaman zaman ürün ve lansman güncellemeleri gönderin. İsteğe bağlıdır.",
    submitLabels: {
      real_estate: "Deneme talebini hazırlayın",
      enterprise_sales: "Satış ön bilgisini hazırlayın",
      book_demo: "Demo talebini hazırlayın",
      founding_partner: "İş ortaklığı ön bilgisini hazırlayın",
    },
    submittingLabel: "Ön bilgi kontrol ediliyor…",
    summaryTitle: "İşaretlenen alanları gözden geçirin",
    summaryDescription: "Talep gönderilmedi. Aşağıdaki alanları düzeltin:",
    directEmailLabel: "Bunun yerine info@businessceo.ai adresine yazın",
    noAccountNotice:
      "Bu talebi hazırlamak hesap oluşturmaz, deneme başlatmaz veya bilgilerinizi saklamaz.",
    characterLimitLabel: "2.000 karakter sınırı",
  },
  sectors: [
    { value: "real_estate", label: "Emlak" },
    { value: "hospitality", label: "Konaklama" },
    { value: "restaurants", label: "Restoranlar" },
    { value: "wholesale", label: "Toptancılar" },
    { value: "construction", label: "İnşaat / Müteahhitler" },
    { value: "other", label: "Diğer" },
  ],
  teamSizes: [
    { value: "1", label: "1 kişi" },
    { value: "2_10", label: "2–10 kişi" },
    { value: "11_50", label: "11–50 kişi" },
    { value: "51_200", label: "51–200 kişi" },
    { value: "201_plus", label: "201+ kişi" },
  ],
  validation: {
    nameRequired: "Adınızı en az 2 karakter kullanarak girin.",
    nameTooLong: "Adınızı 100 karakterin altında tutun.",
    emailInvalid: "Geçerli bir iş e-postası girin.",
    emailTooLong: "E-posta adresini 254 karakterin altında tutun.",
    phoneInvalid: "En az 7 karakter girin veya bu isteğe bağlı alanı boş bırakın.",
    phoneTooLong: "Telefon veya WhatsApp numarasını 40 karakterin altında tutun.",
    companyRequired: "Şirket adını en az 2 karakter kullanarak girin.",
    companyTooLong: "Şirket adını 120 karakterin altında tutun.",
    sectorRequired: "Bir sektör seçin.",
    teamSizeRequired: "Ekip büyüklüğünü seçin.",
    messageRequired: "Operasyon bağlamını en az 20 karakterle anlatın.",
    messageTooLong: "Mesajı 2.000 karakterin altında tutun.",
    privacyRequired: "Devam etmek için Gizlilik Bildirimi’ni kabul edin.",
  },
} as const satisfies ContactContent;
