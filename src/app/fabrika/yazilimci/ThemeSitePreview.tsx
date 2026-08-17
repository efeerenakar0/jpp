import {
  getDeveloperThemeBlueprint,
  type DeveloperTheme,
  type DeveloperThemeId,
} from "@/lib/developer-site";

import styles from "./YazilimciPage.module.css";

const THEME_PREVIEW_COPY: Partial<
  Record<DeveloperThemeId, { cta: string; headline: string }>
> = {
  "midnight-estate": {
    headline: "Gecenin içinden seçkin yaşamlar.",
    cta: "Özel koleksiyonu aç",
  },
  "coastal-living": {
    headline: "Denize yakın, hayata daha yakın.",
    cta: "Sahil evlerini keşfet",
  },
  "monaco-luxe": {
    headline: "Nadir mülkler. Kusursuz temsil.",
    cta: "Koleksiyona gir",
  },
  "nordic-space": {
    headline: "Daha az gürültü, daha çok yaşam.",
    cta: "Kataloğu incele",
  },
  "editorial-ink": {
    headline: "Şehrin yeni yaşam sayısı çıktı.",
    cta: "Dosyayı oku",
  },
  "terracotta-home": {
    headline: "Bir evden fazlası: sizin hikâyeniz.",
    cta: "Hikâyeyi keşfet",
  },
  "emerald-reserve": {
    headline: "Değerini bilenlere özel seçki.",
    cta: "Rezerv seçkiyi aç",
  },
  "skyline-pro": {
    headline: "Şehrin yatırım verisi tek ekranda.",
    cta: "Fırsatları karşılaştır",
  },
  "gallery-white": {
    headline: "Mimarinin kendisi konuşsun.",
    cta: "Sergiyi gez",
  },
  "desert-modern": {
    headline: "Işık, doku ve çağdaş yaşam.",
    cta: "Projeleri gör",
  },
  "cobalt-grid": {
    headline: "Akıllı arama. Hızlı eşleşme.",
    cta: "Ağı keşfet",
  },
  "rosewood-signature": {
    headline: "Eviniz için kişisel bir imza.",
    cta: "Danışmanınızla tanışın",
  },
  "brutalist-key": {
    headline: "EV BUL. KARAR VER. TAŞIN.",
    cta: "İLANLARI AÇ",
  },
  "sage-habitat": {
    headline: "Sakin bir hayatın rotasını çizin.",
    cta: "Yaşam alanlarını gör",
  },
  "golden-hour": {
    headline: "Günün en güzel ışığında yeni eviniz.",
    cta: "Vitrini keşfet",
  },
};

export function ThemeSitePreview({
  brandName,
  isCurrent = false,
  theme,
}: {
  brandName?: string;
  isCurrent?: boolean;
  theme: DeveloperTheme;
}) {
  const blueprint = getDeveloperThemeBlueprint(theme.id);
  const copy = THEME_PREVIEW_COPY[theme.id] ?? {
    headline: blueprint.architecture,
    cta: "Portföyleri keşfet",
  };

  return (
    <span className={styles.websiteThumbnail} aria-hidden="true">
      <span className={styles.miniNav}>
        <b>{brandName || theme.name}</b>
        <i />
        <i />
        <i />
        <em>İletişim</em>
      </span>
      <span className={styles.miniHero}>
        <small>{blueprint.signature}</small>
        <strong>{copy.headline}</strong>
        <i>{copy.cta}</i>
      </span>
      <span className={styles.miniProperties}>
        <i />
        <i />
        <i />
      </span>
      {isCurrent && <span className={styles.currentRibbon}>Mevcut siteniz</span>}
    </span>
  );
}
