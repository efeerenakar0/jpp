import { Metadata } from "next";
import ContactPreview from "@/components/home/ContactPreview";
import { siteContent } from "@/data/site-content";
import { Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "İletişim | Jasmine Nano Proje Pazarlama",
  description: "Alanya'daki ofisimizle iletişime geçin, gayrimenkul yatırımlarınızı planlayalım.",
};

export default function ContactPage() {
  return (
    <div className="bg-[#090d16] text-slate-100 min-h-screen pt-20">
      <section className="relative py-16 text-center bg-slate-950 overflow-hidden border-b border-slate-800/80">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="container relative z-10 mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-widest">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Merkez Ofis & İletişim</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-black text-white mb-4">İletişim</h1>
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto font-medium">
            Gelecekteki yatırımlarınızı planlamak için bizimle saniyeler içinde iletişime geçin.
          </p>
        </div>
      </section>

      <div>
        <ContactPreview />
      </div>

      <section className="h-[450px] w-full bg-slate-950 relative border-t border-slate-800/80">
        <iframe
          src={siteContent.contact.mapIframe}
          width="100%"
          height="100%"
          style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
          allowFullScreen={false}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Jasmine Proje Pazarlama Konum"
        ></iframe>
      </section>
    </div>
  );
}
