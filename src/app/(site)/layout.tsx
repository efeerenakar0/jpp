import Header from "@/components/common/Header";
import Footer from "@/components/common/Footer";
import WhatsAppButton from "@/components/common/WhatsAppButton";
import ScrollToTop from "@/components/common/ScrollToTop";
import CookieBanner from "@/components/common/CookieBanner";
import AIChatbot from "@/components/common/AIChatbot";
import BottomNav from "@/components/common/BottomNav";

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Header />
      <main className="flex-grow pt-20">
        {children}
      </main>
      <Footer />
      <WhatsAppButton />
      <AIChatbot />
      <BottomNav />
      <ScrollToTop />
      <CookieBanner />
    </>
  );
}
