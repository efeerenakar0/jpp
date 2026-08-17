import {
  siFacebook,
  siGoogle,
  siInstagram,
  siPinterest,
  siTelegram,
  siTiktok,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons";

import type { SocialPlatformId } from "@/lib/developer-workspace";

type BrandIcon = {
  path: string;
  title: string;
};

const LINKEDIN_ICON: BrandIcon = {
  title: "LinkedIn",
  path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM3.56 20.452h3.553V9H3.56v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z",
};

const BRAND_ICONS: Record<SocialPlatformId, BrandIcon> = {
  instagram: siInstagram,
  facebook: siFacebook,
  tiktok: siTiktok,
  linkedin: LINKEDIN_ICON,
  youtube: siYoutube,
  x: siX,
  pinterest: siPinterest,
  "google-business": siGoogle,
  "whatsapp-business": siWhatsapp,
  telegram: siTelegram,
};

export function SocialPlatformLogo({
  className,
  platform,
}: {
  className?: string;
  platform: SocialPlatformId;
}) {
  const icon = BRAND_ICONS[platform];

  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      role="img"
      viewBox="0 0 24 24"
    >
      <path d={icon.path} fill="currentColor" />
    </svg>
  );
}
