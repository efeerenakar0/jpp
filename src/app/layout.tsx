import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import Providers from "@/components/common/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Jasmine Proje Pazarlama | Alanya'nın İlk ve Tek Proje Pazarlama Firması",
  description: "Alanya'da inşaat firmaları ve emlakçılar arasında köprü kuran ilk ve tek proje pazarlama firması. Lüks projeler, yatırım danışmanlığı.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} ${playfair.variable} scroll-smooth`}>
      <body className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
