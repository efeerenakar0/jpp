import type { Locale } from "@/marketing/types";

export const LEGAL_SLUGS = [
  "privacy",
  "terms",
  "cookies",
  "kvkk",
  "gdpr",
  "dpa",
  "refunds",
  "subprocessors",
] as const;

export type LegalSlug = (typeof LEGAL_SLUGS)[number];

interface LocalizedLegalDocument {
  readonly slug: LegalSlug;
  readonly title: string;
  readonly purpose: string;
}

export interface LegalPageContent {
  readonly locale: Locale;
  readonly eyebrow: string;
  readonly status: string;
  readonly title: string;
  readonly purpose: string;
  readonly notice: string;
  readonly nextStep: string;
  readonly contactLabel: string;
  readonly backLabel: string;
  readonly indexLabel: string;
  readonly updatedLabel: string;
}

const documents: Readonly<Record<Locale, readonly LocalizedLegalDocument[]>> = {
  en: [
    { slug: "privacy", title: "Privacy Policy", purpose: "Privacy practices and personal data handling." },
    { slug: "terms", title: "Terms of Service", purpose: "Terms governing access to Business CEO AI services." },
    { slug: "cookies", title: "Cookie Policy", purpose: "Necessary, analytics and marketing cookie practices." },
    { slug: "kvkk", title: "KVKK Clarification Text", purpose: "Türkiye-specific personal data disclosures under KVKK." },
    { slug: "gdpr", title: "GDPR Privacy Notice", purpose: "Privacy information for people covered by the GDPR." },
    { slug: "dpa", title: "Data Processing Addendum", purpose: "Controller and processor responsibilities for customer data." },
    { slug: "refunds", title: "Cancellation & Refund Policy", purpose: "Cancellation timing, eligibility and refund handling." },
    { slug: "subprocessors", title: "Subprocessor List", purpose: "Third parties authorized to process service data." },
  ],
  tr: [
    { slug: "privacy", title: "Gizlilik Politikası", purpose: "Gizlilik uygulamaları ve kişisel verilerin işlenmesi." },
    { slug: "terms", title: "Hizmet Koşulları", purpose: "Business CEO AI hizmetlerine erişimi düzenleyen koşullar." },
    { slug: "cookies", title: "Çerez Politikası", purpose: "Zorunlu, analitik ve pazarlama çerezleriyle ilgili uygulamalar." },
    { slug: "kvkk", title: "KVKK Aydınlatma Metni", purpose: "KVKK kapsamındaki Türkiye'ye özgü kişisel veri açıklamaları." },
    { slug: "gdpr", title: "GDPR Gizlilik Bildirimi", purpose: "GDPR kapsamındaki kişiler için gizlilik bilgileri." },
    { slug: "dpa", title: "Veri İşleme Eki", purpose: "Müşteri verileri için veri sorumlusu ve işleyen sorumlulukları." },
    { slug: "refunds", title: "İptal ve İade Politikası", purpose: "İptal zamanlaması, uygunluk ve iade süreçleri." },
    { slug: "subprocessors", title: "Alt İşleyen Listesi", purpose: "Hizmet verilerini işlemeye yetkili üçüncü taraflar." },
  ],
};

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}

export function getLegalPageContent(locale: Locale, slug: LegalSlug): LegalPageContent {
  const document = documents[locale].find((entry) => entry.slug === slug);

  if (!document) {
    throw new Error(`Missing ${locale} legal content for ${slug}.`);
  }

  if (locale === "tr") {
    return {
      locale,
      eyebrow: "Yasal belge merkezi",
      status: "Taslak — hukuki inceleme gerektirir",
      title: document.title,
      purpose: document.purpose,
      notice:
        "Bu sayfa gerekli doküman yapısını ayırır; onaylanmış hukuk metni henüz yayımlanmamıştır. Buradaki içerik hukuki tavsiye veya yürürlükte bir sözleşme değildir.",
      nextStep:
        "Metin, yetkili hukuk danışmanı tarafından hazırlanıp onaylandıktan sonra sürümlenecek ve yürürlük tarihiyle birlikte yayımlanacaktır.",
      contactLabel: "Yasal talepler için e-posta gönder",
      backLabel: "Ana sayfaya dön",
      indexLabel: "Belge durumu",
      updatedLabel: "Yayımlanma bekleniyor",
    };
  }

  return {
    locale,
    eyebrow: "Legal document centre",
    status: "Draft — requires legal review",
    title: document.title,
    purpose: document.purpose,
    notice:
      "This page reserves the required document structure; approved legal text has not yet been published. Nothing here is legal advice or an operative agreement.",
    nextStep:
      "The document will be versioned and published with an effective date after preparation and approval by qualified legal counsel.",
    contactLabel: "Email a legal request",
    backLabel: "Return home",
    indexLabel: "Document status",
    updatedLabel: "Publication pending",
  };
}
