import { Metadata } from "next";
import ContactPreview from "@/components/home/ContactPreview";
import { siteContent } from "@/data/site-content";

export const metadata: Metadata = {
  title: "İletişim | Jasmine Proje Pazarlama",
  description: "Alanya'daki ofisimizle iletişime geçin, gayrimenkul yatırımlarınızı planlayalım.",
};

export default function ContactPage() {
  return (
    <>
      <section className="bg-primary-950 text-white py-16 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">İletişim</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Gelecekteki yatırımlarınızı planlamak için bizimle iletişime geçin.
          </p>
        </div>
      </section>

      {/* İletişim Formu Bileşeni Ana Sayfadaki ile aynı kullanılabilir */}
      <div className="py-12">
        <ContactPreview />
      </div>

      {/* Büyük Harita */}
      <section className="h-[500px] w-full bg-gray-200">
        <iframe
          src={siteContent.contact.mapIframe}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen={false}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Jasmine Proje Pazarlama Konum"
        ></iframe>
      </section>
    </>
  );
}
