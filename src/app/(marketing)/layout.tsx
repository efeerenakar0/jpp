import { Geist, Geist_Mono } from "next/font/google";

import { MarketingPreferences } from "@/marketing/components/preferences";
import "@/styles/tokens.css";
import "@/styles/marketing.css";
import "@/styles/preferences.css";

const geistSans = Geist({
  display: "optional",
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  display: "optional",
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className={`${geistSans.variable} ${geistMono.variable} bceo-marketing-root`}
    >
      {children}
      <MarketingPreferences />
    </div>
  );
}
