import type { MarketingLocale } from "../../integrations/shared";

export interface PreferenceCopy {
  readonly consent: {
    readonly regionLabel: string;
    readonly title: string;
    readonly description: string;
    readonly acceptAll: string;
    readonly rejectOptional: string;
    readonly manage: string;
    readonly settingsLabel: string;
    readonly savedAnnouncement: string;
    readonly acceptedAnnouncement: string;
    readonly rejectedAnnouncement: string;
  };
  readonly dialog: {
    readonly title: string;
    readonly description: string;
    readonly closeLabel: string;
    readonly categoriesLegend: string;
    readonly necessaryTitle: string;
    readonly necessaryDescription: string;
    readonly alwaysActive: string;
    readonly analyticsTitle: string;
    readonly analyticsDescription: string;
    readonly marketingTitle: string;
    readonly marketingDescription: string;
    readonly save: string;
    readonly note: string;
  };
  readonly language: {
    readonly regionLabel: string;
    readonly title: string;
    readonly description: string;
    readonly continueInTurkish: string;
    readonly stayInEnglish: string;
    readonly switchedAnnouncement: string;
    readonly dismissedAnnouncement: string;
  };
}

const preferenceCopy = {
  en: {
    consent: {
      regionLabel: "Privacy choices",
      title: "You decide what this site remembers.",
      description:
        "Necessary storage keeps your privacy and language choices. Analytics and marketing remain off unless you enable them.",
      acceptAll: "Accept all",
      rejectOptional: "Reject optional",
      manage: "Manage preferences",
      settingsLabel: "Privacy settings",
      savedAnnouncement: "Your privacy preferences were saved.",
      acceptedAnnouncement: "All optional preferences were accepted.",
      rejectedAnnouncement: "Optional preferences remain off.",
    },
    dialog: {
      title: "Privacy preferences",
      description:
        "Choose which optional categories may operate on this device. You can return here at any time.",
      closeLabel: "Close privacy preferences",
      categoriesLegend: "Storage categories",
      necessaryTitle: "Necessary",
      necessaryDescription:
        "Remembers this choice and supports essential site behavior.",
      alwaysActive: "Always active",
      analyticsTitle: "Analytics",
      analyticsDescription:
        "Allows privacy-safe, categorical product analytics. Form text and contact details are never included.",
      marketingTitle: "Marketing",
      marketingDescription:
        "Allows campaign measurement if a provider is configured. It is off by default.",
      save: "Save choices",
      note: "Changes apply immediately on this device.",
    },
    language: {
      regionLabel: "Language suggestion",
      title: "Türkçe devam edebilirsiniz.",
      description:
        "Tarayıcı ayarınıza göre Türkçe sürümü gösterebiliriz. Yönlendirme yalnızca sizin seçiminizle yapılır.",
      continueInTurkish: "Türkçe devam et",
      stayInEnglish: "İngilizce devam et",
      switchedAnnouncement: "Türkçe sürüme geçiliyor.",
      dismissedAnnouncement: "Dil tercihiniz hatırlandı.",
    },
  },
  tr: {
    consent: {
      regionLabel: "Gizlilik tercihleri",
      title: "Bu sitenin neyi hatırlayacağına siz karar verin.",
      description:
        "Zorunlu depolama gizlilik ve dil tercihlerinizi saklar. Analitik ve pazarlama, siz izin vermedikçe kapalı kalır.",
      acceptAll: "Tümünü kabul et",
      rejectOptional: "İsteğe bağlıları reddet",
      manage: "Tercihleri yönet",
      settingsLabel: "Gizlilik ayarları",
      savedAnnouncement: "Gizlilik tercihleriniz kaydedildi.",
      acceptedAnnouncement: "Tüm isteğe bağlı tercihler kabul edildi.",
      rejectedAnnouncement: "İsteğe bağlı tercihler kapalı kalacak.",
    },
    dialog: {
      title: "Gizlilik tercihleri",
      description:
        "Bu cihazda hangi isteğe bağlı kategorilerin çalışabileceğini seçin. Buraya dilediğiniz zaman dönebilirsiniz.",
      closeLabel: "Gizlilik tercihlerini kapat",
      categoriesLegend: "Depolama kategorileri",
      necessaryTitle: "Zorunlu",
      necessaryDescription:
        "Bu tercihi hatırlar ve sitenin temel işlevlerini destekler.",
      alwaysActive: "Her zaman aktif",
      analyticsTitle: "Analitik",
      analyticsDescription:
        "Gizliliği koruyan, kategorik ürün analizine izin verir. Form metinleri ve iletişim bilgileri asla dahil edilmez.",
      marketingTitle: "Pazarlama",
      marketingDescription:
        "Bir sağlayıcı yapılandırılırsa kampanya ölçümüne izin verir. Varsayılan olarak kapalıdır.",
      save: "Tercihleri kaydet",
      note: "Değişiklikler bu cihazda hemen uygulanır.",
    },
    language: {
      regionLabel: "Dil önerisi",
      title: "Türkçe devam edebilirsiniz.",
      description:
        "Tarayıcı ayarınıza göre Türkçe sürümü gösterebiliriz. Yönlendirme yalnızca sizin seçiminizle yapılır.",
      continueInTurkish: "Türkçe devam et",
      stayInEnglish: "İngilizce devam et",
      switchedAnnouncement: "Türkçe sürüme geçiliyor.",
      dismissedAnnouncement: "Dil tercihiniz hatırlandı.",
    },
  },
} as const satisfies Readonly<Record<MarketingLocale, PreferenceCopy>>;

export function getPreferenceCopy(locale: MarketingLocale): PreferenceCopy {
  return preferenceCopy[locale];
}
