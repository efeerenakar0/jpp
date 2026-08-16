import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

function validMetadataBase(value: string | undefined) {
  try {
    const url = new URL(value || 'http://localhost:3000');
    return ['http:', 'https:'].includes(url.protocol)
      ? url
      : new URL('http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Business CEO AI | Akıllı Gayrimenkul Operasyon Sistemi",
  description: "Portföy, müşteri, iletişim, pazarlama ve iş operasyonlarını yapay zekâ destekli tek bir çalışma alanında yönetin.",
  metadataBase: validMetadataBase(process.env.NEXT_PUBLIC_SITE_URL),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} ${playfair.variable} scroll-smooth`}>
      <body className="flex flex-col min-h-screen bg-white dark:bg-black text-black dark:text-white">
        {children}
      </body>
    </html>
  );
}
