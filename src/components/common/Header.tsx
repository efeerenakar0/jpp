"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Building2, Sparkles, Phone, ArrowUpRight, Cpu, Zap } from "lucide-react";
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
        scrolled 
          ? "bg-[#090d16]/85 backdrop-blur-2xl border-b border-white/10 shadow-2xl py-3" 
          : "bg-gradient-to-b from-[#090d16]/95 via-[#090d16]/60 to-transparent py-5"
      )}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Brand Logo - Stitch Glass Design */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-amber-400 to-rose-500 rounded-2xl blur-sm opacity-70 group-hover:opacity-100 transition-opacity" />
            <div className="relative w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10">
              <Building2 className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
          </div>
          <div>
            <span className="font-serif text-2xl font-black bg-gradient-to-r from-white via-cyan-200 to-amber-400 bg-clip-text text-transparent tracking-tight">
              Jasmine
            </span>
            <span className="text-[9px] tracking-[0.25em] text-cyan-400 uppercase font-black block -mt-1">
              Nano Proje Pazarlama
            </span>
          </div>
        </Link>

        {/* Desktop Nav - Google Stitch Inspired */}
        <nav className="hidden lg:flex items-center gap-6">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md shadow-inner">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-bold text-slate-300 hover:text-cyan-300 px-3 py-1.5 rounded-full transition-all hover:bg-white/5 uppercase tracking-wider"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <Link
            href="/fabrika"
            className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 px-4.5 py-2.5 rounded-2xl text-xs font-black shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-95 uppercase tracking-wider"
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Fabrikası
          </Link>

          <Link
            href="/iletisim"
            className="flex items-center gap-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/10 hover:border-cyan-500/40 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Phone className="w-3.5 h-3.5 text-cyan-400" /> Bize Ulaşın
          </Link>
        </nav>

        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden text-white p-2.5 rounded-2xl bg-slate-900 border border-white/10"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Menüyü Aç"
        >
          {isOpen ? <X className="w-6 h-6 text-cyan-400" /> : <Menu className="w-6 h-6 text-white" />}
        </button>
      </div>

      {/* Mobile Nav Drawer */}
      {isOpen && (
        <div className="fixed inset-0 top-[72px] bg-[#090d16]/95 backdrop-blur-2xl shadow-2xl flex flex-col p-6 gap-4 overflow-y-auto lg:hidden z-50">
          <div className="space-y-2 pt-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between text-base font-bold text-slate-200 hover:text-cyan-300 p-3.5 rounded-2xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
                onClick={() => setIsOpen(false)}
              >
                <span>{link.name}</span>
                <ArrowUpRight className="w-4 h-4 text-slate-500" />
              </Link>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800/80 space-y-3 mt-auto">
            <Link
              href="/fabrika"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 text-slate-950 px-6 py-3.5 rounded-2xl text-sm font-black w-full shadow-lg shadow-cyan-500/20 uppercase tracking-wider"
              onClick={() => setIsOpen(false)}
            >
              <Sparkles className="w-4 h-4" /> AI Yapay Zeka Fabrikası
            </Link>
            <Link
              href="/iletisim"
              className="flex items-center justify-center gap-2 bg-slate-900 text-slate-200 border border-slate-700 px-6 py-3.5 rounded-2xl text-sm font-bold w-full"
              onClick={() => setIsOpen(false)}
            >
              <Phone className="w-4 h-4 text-cyan-400" /> Bize Ulaşın
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
