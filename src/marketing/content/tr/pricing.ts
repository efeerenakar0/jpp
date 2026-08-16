import type { PricingContent } from "@/marketing/types";

export const pricingContent = {
  locale: "tr",
  metadata: {
    title: "Emlak Ürünü Fiyatları | Business CEO AI",
    description:
      "Emlak için Business CEO AI’ı aylık ₺11.350 Office planıyla başlatın veya Enterprise işletim modeli için satış ekibiyle görüşün.",
    canonicalPath: "/tr/realestate#pricing",
  },
  hero: {
    eyebrow: "Türkiye lansman fiyatı",
    title: "Eksiksiz bir Office planı. Daha büyük operasyonlar için Enterprise yolu.",
    description:
      "Kredi kartı gerektirmeyen 14 günlük Office denemesiyle başlayın veya çoklu ofis ve özel operasyon ihtiyaçları için ekibimizle görüşün.",
  },
  trial: {
    durationDays: 14,
    title: "14 günlük ücretsiz deneme",
    description:
      "Office özelliklerini 14 gün boyunca keşfedin. Kredi kartı gerekmediği için deneme süresince ücret alınmaz.",
    noCardRequired: true,
    noCardLabel: "Kredi kartı gerekmez",
    includes: "Office özelliklerini içerir",
    afterTrialWithoutPayment:
      "Deneme sonunda ödeme tamamlanmazsa hesap kapatılır veya askıya alınır.",
  },
  plans: [
    {
      id: "office",
      name: "Office",
      audience: "Müşteri ve ekip operasyonlarını tek sistemden yürütmeye hazır bir emlak ofisi için.",
      description:
        "Tek ofis, tek WhatsApp bağlantısı ve mevcut yapay zekâ iş gücünün tamamını içeren başlangıç planı.",
      price: {
        currency: "TRY",
        amount: 11350,
        formatted: "₺11.350",
        display: "₺11.350 / ay",
        cadence: "month",
        cadenceLabel: "/ ay",
        note: "Türkiye lansman fiyatı",
        pendingApproval: false,
        isPublic: true,
      },
      features: [
        "1 ofis",
        "1 WhatsApp bağlantısı",
        "10 kullanıcıya kadar",
        "Mevcut tüm yapay zekâ çalışanları",
        "Standart başlangıç desteği",
        "Standart e-posta desteği",
      ],
      supportResponse: "İlk yanıt bir iş günü içinde",
      action: {
        label: "Ücretsiz Denemeyi Başlatın",
        href: "/tr/contact?sector=real-estate&intent=trial&plan=office",
        kind: "primary",
        analyticsEvent: "pricing_plan_selected",
      },
    },
    {
      id: "enterprise",
      name: "Enterprise",
      audience: "Özel limit, taşıma veya yapılandırma gerektiren çoklu ofis işletmeleri için.",
      description:
        "Öncelikli başlangıç, destek ve escalation bağlantısı sunan yapılandırılabilir işletim modeli. Herkese açık Enterprise fiyatı belirtilmez.",
      priceLabel: "Satış Ekibiyle Görüşün",
      features: [
        "Birden fazla ofis",
        "Birden fazla WhatsApp bağlantısı",
        "Özel limitler",
        "Öncelikli başlangıç desteği",
        "Taşıma desteği",
        "Özel yapılandırma",
        "Öncelikli destek",
        "Periyodik operasyon değerlendirmesi",
        "Escalation iletişim kişisi",
      ],
      supportResponse: "İş saatleri içinde iki iş saati içinde ilk yanıt",
      action: {
        label: "Satış Ekibiyle Görüşün",
        href: "/tr/contact?sector=real-estate&intent=sales&plan=enterprise",
        kind: "secondary",
        analyticsEvent: "pricing_plan_selected",
      },
    },
  ],
  pendingOptions: [
    {
      id: "office-six-month",
      durationMonths: 6,
      currency: "TRY",
      proposedTotal: 61290,
      formatted: "₺61.290",
      pendingApproval: true,
      isPublic: false,
      internalLabel: "Altı aylık Office önerisi — açık onay olmadan yayınlama",
      refundPolicy:
        "Onaylanıp satın alınması hâlinde altı aylık planın erken iptalinde iade yapılmayacaktır.",
    },
    {
      id: "office-twelve-month",
      durationMonths: 12,
      currency: "TRY",
      proposedTotal: 108960,
      formatted: "₺108.960",
      pendingApproval: true,
      isPublic: false,
      internalLabel: "On iki aylık Office önerisi — açık onay olmadan yayınlama",
      refundPolicy:
        "Onaylanıp satın alınması hâlinde on iki aylık planın erken iptalinde iade yapılmayacaktır.",
    },
  ],
  disclosure:
    "Yalnızca aylık Office fiyatı herkese açık gösterim için onaylanmıştır. Altı ve on iki aylık toplamlar açık onay beklerken gizli kalır. Enterprise fiyatı yalnızca satış görüşmesiyle paylaşılır.",
} as const satisfies PricingContent;
