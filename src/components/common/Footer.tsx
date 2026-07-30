import Link from "next/link";
import { siteContent } from "@/data/site-content";
import { Mail, MapPin, Phone, Sparkles } from "lucide-react";
import BusinessCeoMark from "@/components/fabrika/BusinessCeoMark";

export default function Footer() {
  return (
    <footer className="bg-[#090d16] text-slate-400 pt-20 pb-10 border-t border-slate-800/80 relative">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand Column - Stitch Design */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3 group">
              <BusinessCeoMark />
            </Link>

            <p className="text-xs leading-relaxed text-slate-400 font-medium">
              Gayrimenkul şirketlerinin portföy, müşteri, iletişim, pazarlama ve ekip operasyonlarını yapay zekâ destekli tek bir yönetim alanında birleştiren işletim sistemi.
            </p>

            <div className="flex gap-4 text-xs font-bold text-slate-400">
              <a href="#" className="hover:text-cyan-400 transition-colors">Instagram</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">Facebook</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">YouTube</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">LinkedIn</a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-serif text-white text-base font-black mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Hızlı Navigasyon
            </h3>
            <ul className="space-y-3.5 text-xs font-semibold">
              <li><Link href="/hakkimizda" className="hover:text-cyan-400 transition-colors">Hakkımızda</Link></li>
              <li><Link href="/projeler" className="hover:text-cyan-400 transition-colors">Öne Çıkan Projeler</Link></li>
              <li><Link href="/is-ortakligi" className="hover:text-cyan-400 transition-colors">Acente & Emlakçı Portalı</Link></li>
              <li><Link href="/sss" className="hover:text-cyan-400 transition-colors">Sık Sorulan Sorular</Link></li>
              <li><Link href="/fabrika" className="hover:text-cyan-400 transition-colors font-bold text-cyan-400 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> CEO Workspace</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-serif text-white text-base font-black mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Hizmetlerimiz
            </h3>
            <ul className="space-y-3.5 text-xs font-semibold">
              {siteContent.services.slice(0, 5).map((service) => (
                <li key={service.id}>
                  <Link href={`/hizmetler#${service.id}`} className="hover:text-cyan-400 transition-colors">
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h3 className="font-serif text-white text-base font-black mb-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              İletişim & Merkez
            </h3>
            <ul className="space-y-3.5 text-xs font-semibold">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>{siteContent.contact.address}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-cyan-400 shrink-0" />
                <a href={`tel:${siteContent.contact.phone.replace(/\s+/g, '')}`} className="hover:text-white transition-colors">
                  {siteContent.contact.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                <a href={`mailto:${siteContent.contact.email}`} className="hover:text-white transition-colors">
                  {siteContent.contact.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="border-t border-slate-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500 text-center md:text-left font-semibold">
            &copy; {new Date().getFullYear()} Business CEO AI. Tüm hakları saklıdır.
          </p>
          <div className="flex gap-6 text-xs text-slate-500 font-semibold">
            <Link href="/gizlilik-politikasi" className="hover:text-white transition-colors">Gizlilik Politikası</Link>
            <Link href="/kvkk-aydinlatma-metni" className="hover:text-white transition-colors">KVKK</Link>
            <Link href="/cerez-politikasi" className="hover:text-white transition-colors">Çerez Politikası</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
