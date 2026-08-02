import type { AdPlatform } from "@prisma/client";

export type MarketingChannelDefinition = {
  id: AdPlatform;
  label: string;
  group: "Reklam" | "Sosyal medya" | "Doğrudan iletişim" | "İlan portalı";
  guidance: string;
  defaultSelected?: boolean;
};

export const MARKETING_CHANNELS: MarketingChannelDefinition[] = [
  {
    id: "GOOGLE_ADS",
    label: "Google Ads",
    group: "Reklam",
    guidance:
      "En fazla 30 karakterlik kısa başlıklar ve 90 karakterlik açıklamalar üret.",
    defaultSelected: true,
  },
  {
    id: "INSTAGRAM",
    label: "Instagram",
    group: "Sosyal medya",
    guidance:
      "Doğal bir gönderi açıklaması, kısa harekete geçirici mesaj ve ilgili etiketler üret.",
    defaultSelected: true,
  },
  {
    id: "FACEBOOK",
    label: "Facebook",
    group: "Sosyal medya",
    guidance:
      "Yerel kitleye uygun gönderi başlığı ve güven veren açıklama üret.",
    defaultSelected: true,
  },
  {
    id: "YOUTUBE",
    label: "YouTube",
    group: "Sosyal medya",
    guidance:
      "Video başlığı, kısa açıklama ve ilk 15 saniyelik açılış metni üret.",
  },
  {
    id: "TIKTOK",
    label: "TikTok",
    group: "Sosyal medya",
    guidance: "Kısa video kancası, konuşma metni ve kısa açıklama üret.",
  },
  {
    id: "LINKEDIN",
    label: "LinkedIn",
    group: "Sosyal medya",
    guidance:
      "Profesyonel, yatırım odağında ve doğrulanabilir bir paylaşım üret.",
  },
  {
    id: "X",
    label: "X",
    group: "Sosyal medya",
    guidance: "Kısa ve doğrudan bir gönderi üret; doğrulanmamış vaat kullanma.",
  },
  {
    id: "PINTEREST",
    label: "Pinterest",
    group: "Sosyal medya",
    guidance: "Arama odaklı pin başlığı ve açıklaması üret.",
  },
  {
    id: "WHATSAPP",
    label: "WhatsApp",
    group: "Doğrudan iletişim",
    guidance: "Yalnızca izinli alıcıya uygun, kısa ve doğal bir mesaj üret.",
    defaultSelected: true,
  },
  {
    id: "TELEGRAM",
    label: "Telegram",
    group: "Doğrudan iletişim",
    guidance: "Kanal veya grup paylaşımına uygun, taranabilir bir metin üret.",
  },
  {
    id: "EMAIL",
    label: "E-posta",
    group: "Doğrudan iletişim",
    guidance: "Konu satırı, ön izleme metni ve kısa e-posta gövdesi üret.",
    defaultSelected: true,
  },
  {
    id: "SMS",
    label: "SMS",
    group: "Doğrudan iletişim",
    guidance:
      "İzinli alıcı için kısa, açık ve bağlantı eklenebilir SMS metni üret.",
  },
  {
    id: "SAHIBINDEN",
    label: "Sahibinden",
    group: "İlan portalı",
    guidance:
      "Doğrulanmış portföy bilgileriyle portal ilan başlığı ve açıklaması üret.",
  },
  {
    id: "HEPSIEMLAK",
    label: "Hepsiemlak",
    group: "İlan portalı",
    guidance:
      "Portföy özelliklerini düzenli bölümlerle anlatan ilan metni üret.",
  },
  {
    id: "EMLAKJET",
    label: "Emlakjet",
    group: "İlan portalı",
    guidance:
      "Arama sonuçlarında anlaşılır, sade bir ilan başlığı ve açıklaması üret.",
  },
];

const channelIds = new Set(MARKETING_CHANNELS.map((channel) => channel.id));

export const DEFAULT_MARKETING_CHANNELS = MARKETING_CHANNELS.filter(
  (channel) => channel.defaultSelected,
).map((channel) => channel.id);

export function normalizeMarketingChannels(value: unknown): AdPlatform[] {
  if (!Array.isArray(value)) return DEFAULT_MARKETING_CHANNELS;
  const channels = Array.from(
    new Set(
      value.filter((item): item is AdPlatform =>
        channelIds.has(item as AdPlatform),
      ),
    ),
  );
  return channels.length
    ? channels.slice(0, MARKETING_CHANNELS.length)
    : DEFAULT_MARKETING_CHANNELS;
}

export function marketingChannelLabel(platform: AdPlatform) {
  return (
    MARKETING_CHANNELS.find((channel) => channel.id === platform)?.label ||
    platform
  );
}

export function marketingChannelGuidance(platform: AdPlatform) {
  return (
    MARKETING_CHANNELS.find((channel) => channel.id === platform)?.guidance ||
    "Kanala uygun, doğrulanabilir bir içerik üret."
  );
}
