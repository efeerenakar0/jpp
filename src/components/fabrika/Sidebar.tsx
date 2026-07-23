'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Crown, 
  Code2, 
  Crosshair, 
  Megaphone, 
  MessageCircle,
  Aperture,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building2
} from 'lucide-react';
import { useState } from 'react';

const modules = [
  {
    name: 'Komuta Merkezi',
    href: '/fabrika',
    icon: Crown,
    color: 'from-amber-400 to-amber-600',
    description: 'Genel Müdür',
  },
  {
    name: 'Yazılımcı',
    href: '/fabrika/yazilimci',
    icon: Code2,
    color: 'from-cyan-400 to-teal-500',
    description: 'Site Oluşturucu & SEO',
    moduleNumber: 1,
  },
  {
    name: 'Avcı',
    href: '/fabrika/avci',
    icon: Crosshair,
    color: 'from-amber-400 to-amber-600',
    description: 'Portföy Toplayıcı',
    moduleNumber: 2,
  },
  {
    name: 'Pazarlamacı',
    href: '/fabrika/pazarlamaci',
    icon: Megaphone,
    color: 'from-emerald-400 to-teal-400',
    description: 'Reklam Ekibi',
    moduleNumber: 3,
  },
  {
    name: 'Asistan',
    href: '/fabrika/asistan',
    icon: MessageCircle,
    color: 'from-rose-400 to-purple-500',
    description: 'CRM & İletişim',
    moduleNumber: 4,
  },
  {
    name: 'Stüdyo',
    href: '/fabrika/studyo',
    icon: Aperture,
    color: 'from-cyan-400 to-blue-500',
    description: 'Görsel Optimizasyon',
    moduleNumber: 5,
  },
];

export default function FabrikaSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`
        relative flex flex-col h-full
        bg-slate-950/90 border-r border-slate-800/80 backdrop-blur-2xl
        transition-all duration-300 ease-in-out z-20
        ${collapsed ? 'w-20' : 'w-72'}
      `}
    >
      {/* Logo */}
      <div className="p-5 border-b border-slate-800/80">
        <Link href="/fabrika" className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-amber-500 rounded-2xl blur-sm opacity-70" />
            <div className="relative w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center border border-white/10">
              <Building2 className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h2 className="text-base font-black text-white tracking-tight leading-tight">Jasmine AI</h2>
              <p className="text-[9px] text-cyan-400 font-extrabold tracking-widest uppercase -mt-0.5">Fabrika</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
        {modules.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/fabrika' && pathname.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group relative flex items-center gap-3 px-3 py-3 rounded-2xl
                transition-all duration-200 cursor-pointer
                ${isActive 
                  ? 'bg-slate-900 border border-slate-800 shadow-xl' 
                  : 'hover:bg-slate-900/50 border border-transparent'
                }
              `}
              title={collapsed ? item.name : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-gradient-to-b ${item.color}`} />
              )}
              
              {/* Icon */}
              <div className={`
                w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                transition-all duration-200
                ${isActive 
                  ? `bg-gradient-to-br ${item.color} text-slate-950 shadow-md` 
                  : 'bg-slate-900 text-slate-400 group-hover:text-white border border-slate-800'
                }
              `}>
                <Icon className="w-4 h-4 stroke-[2.5]" />
              </div>

              {/* Label */}
              {!collapsed && (
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    {item.moduleNumber && (
                      <span className={`
                        text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase font-mono
                        ${isActive 
                          ? 'bg-cyan-500/20 text-cyan-300' 
                          : 'bg-slate-800 text-slate-500'
                        }
                      `}>
                        M{item.moduleNumber}
                      </span>
                    )}
                    <span className={`text-xs font-black ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {item.name}
                    </span>
                  </div>
                  <p className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                    {item.description}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-all z-30 cursor-pointer shadow-md"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Bottom Profile Section */}
      <div className={`p-4 border-t border-slate-800/80 ${collapsed ? 'text-center' : ''}`}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-black text-slate-950 shadow-md">
              P
            </div>
            <div>
              <p className="text-xs font-black text-white">Patron</p>
              <p className="text-[10px] text-amber-400 font-bold">Genel Müdür</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 mx-auto rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xs font-black text-slate-950 shadow-md">
            P
          </div>
        )}
      </div>
    </aside>
  );
}
