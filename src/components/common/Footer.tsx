import Link from "next/link";
import { siteContent } from "@/data/site-content";
import { Building2, Mail, MapPin, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-primary-950 text-gray-300 pt-20 pb-10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-gold-500" />
              <span className="font-serif text-2xl font-bold text-white">Jasmine</span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-400">
              {siteContent.meta.description}
            </p>
            <div className="flex gap-4 text-sm font-medium">
              <a href="#" className="hover:text-gold-500 transition-colors">Instagram</a>
              <a href="#" className="hover:text-gold-500 transition-colors">Facebook</a>
              <a href="#" className="hover:text-gold-500 transition-colors">YouTube</a>
              <a href="#" className="hover:text-gold-500 transition-colors">LinkedIn</a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-serif text-white text-lg font-semibold mb-6">Hızlı Bağlantılar</h3>
            <ul className="space-y-4">
              <li><Link href="/hakkimizda" className="hover:text-gold-500 transition-colors text-sm">Hakkımızda</Link></li>
              <li><Link href="/projeler" className="hover:text-gold-500 transition-colors text-sm">Projeler</Link></li>
              <li><Link href="/is-ortakligi" className="hover:text-gold-500 transition-colors text-sm">Emlakçı Portalı</Link></li>
              <li><Link href="/sss" className="hover:text-gold-500 transition-colors text-sm">Sık Sorulan Sorular</Link></li>
              <li><Link href="/iletisim" className="hover:text-gold-500 transition-colors text-sm">İletişim</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-serif text-white text-lg font-semibold mb-6">Hizmetlerimiz</h3>
            <ul className="space-y-4">
              {siteContent.services.slice(0, 5).map((service) => (
                <li key={service.id}>
                  <Link href={`/hizmetler#${service.id}`} className="hover:text-gold-500 transition-colors text-sm">
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-serif text-white text-lg font-semibold mb-6">İletişim</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                <span className="text-sm">{siteContent.contact.address}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-gold-500 shrink-0" />
                <a href={`tel:${siteContent.contact.phone.replace(/\s+/g, '')}`} className="text-sm hover:text-white transition-colors">
                  {siteContent.contact.phone}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gold-500 shrink-0" />
                <a href={`mailto:${siteContent.contact.email}`} className="text-sm hover:text-white transition-colors">
                  {siteContent.contact.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500 text-center md:text-left">
            &copy; {new Date().getFullYear()} Jasmine Proje Pazarlama. Tüm hakları saklıdır.
          </p>
          <div className="flex gap-6 text-xs text-gray-500">
            <Link href="/gizlilik-politikasi" className="hover:text-white transition-colors">Gizlilik Politikası</Link>
            <Link href="/kvkk-aydinlatma-metni" className="hover:text-white transition-colors">KVKK</Link>
            <Link href="/cerez-politikasi" className="hover:text-white transition-colors">Çerez Politikası</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
