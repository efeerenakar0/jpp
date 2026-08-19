import type {
  DeveloperTheme,
  DeveloperThemeId,
} from "@/lib/developer-site";

import styles from "./YazilimciPage.module.css";

const THEME_PREVIEW_COPY: Partial<
  Record<DeveloperThemeId, string>
> = {
  "midnight-estate": "Seçkin yaşamlar.",
  "coastal-living": "Denize daha yakın.",
  "monaco-luxe": "Prestijin yeni adresi.",
  "nordic-space": "Sade ve zamansız.",
  "editorial-ink": "Şehrin yeni sayısı.",
  "terracotta-home": "Sıcak bir yuva.",
  "emerald-reserve": "Ayrıcalıklı bir seçki.",
  "skyline-pro": "Şehri verilerle okuyun.",
  "gallery-white": "Mimari konuşsun.",
  "desert-modern": "Işık ve çağdaş yaşam.",
  "cobalt-grid": "Akıllı ve hızlı.",
  "rosewood-signature": "Kişisel bir imza.",
  "brutalist-key": "EV BUL. KARAR VER.",
  "sage-habitat": "Sakin yaşamın rotası.",
  "golden-hour": "Işığın en güzel hâli.",
};

export function ThemeSitePreview({
  isCurrent = false,
  theme,
}: {
  isCurrent?: boolean;
  theme: DeveloperTheme;
}) {
  const headline = THEME_PREVIEW_COPY[theme.id] ?? theme.name;

  return (
    <span className={styles.websiteThumbnail} aria-hidden="true">
      <span className={styles.miniHero}>
        <strong>{headline}</strong>
      </span>
      {isCurrent && <span className={styles.currentRibbon}>Mevcut siteniz</span>}
    </span>
  );
}
