"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { name: "Ana Sayfa", href: "/" },
  { name: "Hakkımızda", href: "/hakkimizda" },
  { name: "Projeler", href: "/projeler" },
  { name: "Hizmetler", href: "/hizmetler" },
  { name: "Neden Alanya", href: "/neden-alanya" },
  { name: "İş Ortaklığı", href: "/is-ortakligi" },
  { name: "SSS", href: "/sss" },
  { name: "İletişim", href: "/iletisim" },
];

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300",
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm py-4" : "bg-white py-6"
      )}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Building2 className="w-8 h-8 text-primary-700 group-hover:text-primary-600 transition-colors" />
          <span className="font-serif text-2xl font-bold text-primary-900">Jasmine</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-gray-600 hover:text-primary-700 transition-colors"
            >
              {link.name}
            </Link>
          ))}
          <Link
            href="/is-ortakligi"
            className="bg-primary-700 hover:bg-primary-800 text-white px-5 py-2.5 rounded-sm text-sm font-medium transition-colors"
          >
            Portal Girişi
          </Link>
        </nav>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden text-gray-800 p-2"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Menüyü Aç"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full h-screen bg-white shadow-xl flex flex-col pt-8 px-6 pb-24 gap-6 overflow-y-auto md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-2xl font-serif text-gray-800 border-b border-gray-100 pb-4"
              onClick={() => setIsOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <Link
            href="/is-ortakligi"
            className="mt-4 bg-primary-700 text-center text-white px-6 py-4 rounded-sm text-lg font-medium"
            onClick={() => setIsOpen(false)}
          >
            Portal Girişi
          </Link>
        </div>
      )}
    </header>
  );
}
