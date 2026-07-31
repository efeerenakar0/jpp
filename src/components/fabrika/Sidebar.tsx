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
  LogOut,
  X,
  Users,
  Home,
  CalendarDays,
  Settings2,
  Smartphone,
  LockKeyhole,
  FileText,
} from 'lucide-react';
import { useState } from 'react';
import { primaryModuleDefinitions } from '@/lib/fabrika-primary-modules';
import BusinessCeoMark from './BusinessCeoMark';

const primaryModulePresentation = {
  'Komuta Merkezi': {
    icon: Crown,
    color: 'from-amber-400 to-amber-600',
  },
  Yazılımcı: { icon: Code2, color: 'from-cyan-400 to-teal-500' },
  Portföyler: { icon: Home, color: 'from-emerald-400 to-teal-500' },
  Avcı: { icon: Crosshair, color: 'from-amber-400 to-amber-600' },
  Pazarlamacı: { icon: Megaphone, color: 'from-emerald-400 to-teal-400' },
  Asistan: { icon: MessageCircle, color: 'from-rose-400 to-purple-500' },
  Stüdyo: { icon: Aperture, color: 'from-cyan-400 to-blue-500' },
  'Belge Merkezi': {
    icon: FileText,
    color: 'from-emerald-400 to-teal-500',
  },
} as const;

const primaryModules = primaryModuleDefinitions.map((module) => ({
  ...module,
  ...primaryModulePresentation[module.name],
  moduleNumber: 'moduleNumber' in module ? module.moduleNumber : undefined,
  requiresHunter: 'requiresHunter' in module ? module.requiresHunter : false,
}));

const realEstatePackages = [
  {
    name: 'Merkezi CRM',
    href: '/fabrika/crm',
    icon: Users,
    color: 'from-emerald-400 to-teal-500',
    description: 'Müşteri Profilleri',
  },
  {
    name: 'Takvim',
    href: '/fabrika/takvim',
    icon: CalendarDays,
    color: 'from-emerald-400 to-teal-500',
    description: 'Görev & Randevu',
  },
  {
    name: 'Şirket & Ekip',
    href: '/fabrika/sirket',
    icon: Settings2,
    color: 'from-emerald-400 to-teal-500',
    description: 'Ekip & Erişim',
  },
  {
    name: 'WhatsApp',
    href: '/fabrika/whatsapp',
    icon: Smartphone,
    color: 'from-emerald-400 to-teal-500',
    description: 'Telefon & Otomasyon',
    ownerOnly: true,
  },
];

interface FabrikaSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  companyName?: string;
  profileName?: string;
  principalType?: 'OWNER' | 'EMPLOYEE';
  hunterEnabled?: boolean;
}

export default function FabrikaSidebar({
  mobileOpen = false,
  onMobileClose,
  companyName = 'Business CEO AI',
  profileName = 'Patron',
  principalType = 'OWNER',
  hunterEnabled = false,
}: FabrikaSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/fabrika-auth/logout', { method: 'POST' });
    } finally {
      window.location.assign('/fabrika-giris');
    }
  }

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/75 lg:hidden"
          onClick={onMobileClose}
          aria-label="Navigasyonu kapat"
        />
      )}
    <aside
      className={`
        fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col
        border-r border-[#243247] bg-[#08111f]
        transition-transform duration-200 ease-out lg:relative lg:z-20 lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        ${collapsed ? 'lg:w-20' : 'lg:w-72'}
      `}
    >
      {/* Logo */}
      <div className="flex h-[76px] items-center justify-between border-b border-[#243247] px-4">
        <Link href="/fabrika" className="flex items-center gap-3" onClick={onMobileClose}>
          <BusinessCeoMark compact={collapsed} />
        </Link>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:hidden"
          onClick={onMobileClose}
          aria-label="Navigasyonu kapat"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-5" aria-label="Business CEO AI modülleri">
        <div className="space-y-1">
        {primaryModules.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/fabrika' && pathname.startsWith(item.href));
          const Icon = item.icon;
          if (item.requiresHunter && !hunterEnabled) {
            return (
              <div
                key={item.href}
                className="group flex min-h-11 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-slate-600"
                title="Avcı paketi platform yöneticisi tarafından etkinleştirilir"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-800 bg-slate-900 text-slate-600">
                  <LockKeyhole className="h-4 w-4" />
                </div>
                {!collapsed && (
                  <div className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Avcı</span>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">Kilitli</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-600">Ücretli eklenti</p>
                  </div>
                )}
              </div>
            );
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={`
                group relative flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5
                transition-colors duration-150
                ${isActive 
                  ? 'border-[#c99a57]/30 bg-[#c99a57]/10 text-white'
                  : 'border-transparent text-slate-400 hover:border-[#29384d] hover:bg-[#111d2d] hover:text-slate-100'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.name : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-[#d7a85f]" />
              )}
              
              {/* Icon */}
              <div className={`
                flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors
                ${isActive 
                  ? 'border-[#c99a57]/30 bg-[#c99a57]/10 text-[#e9bd79]'
                  : 'border-slate-800 bg-slate-900 text-slate-500 group-hover:text-slate-300'
                }
              `}>
                <Icon className="h-4 w-4" />
              </div>

              {/* Label */}
              {!collapsed && (
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    {item.moduleNumber && (
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-slate-500">
                        M{item.moduleNumber}
                      </span>
                    )}
                    <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                      {item.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-normal text-slate-500">
                    {item.description}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
        </div>

        <div className="my-4 border-t border-slate-800 pt-3">
          {!collapsed && (
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c99a57]">
                Yönetim araçları
              </p>
              <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                Yeni
              </span>
            </div>
          )}
          <div className="space-y-1" role="group" aria-label="Emlak operasyon paketi">
          {realEstatePackages
            .filter((item) => !item.ownerOnly || principalType === 'OWNER')
            .map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/fabrika' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={`
                group relative flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2.5
                transition-colors duration-150
                ${isActive
                  ? 'border-[#c99a57]/30 bg-[#c99a57]/10 text-white'
                  : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900 hover:text-slate-100'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.name : undefined}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-[#d7a85f]" />
              )}
              <div className={`
                flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors
                ${isActive
                  ? 'border-[#c99a57]/30 bg-[#c99a57]/10 text-[#e9bd79]'
                  : 'border-slate-800 bg-slate-900 text-slate-500 group-hover:text-slate-300'
                }
              `}>
                <Icon className="h-4 w-4" />
              </div>
              {!collapsed && (
                <div className="overflow-hidden">
                  <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                    {item.name}
                  </span>
                  <p className="mt-0.5 text-[10px] font-normal text-slate-500">
                    {item.description}
                  </p>
                </div>
              )}
            </Link>
          );
        })}
          </div>
        </div>
      </nav>

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 z-30 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:flex"
        aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Bottom Profile Section */}
      <div className={`border-t border-[#243247] bg-[#07101c] p-4 ${collapsed ? 'text-center' : ''}`}>
        {!collapsed && (
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200">
                {profileName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="max-w-32 truncate text-xs font-semibold text-white">{profileName}</p>
                <p className="text-[10px] font-medium text-slate-500">
                  {principalType === 'OWNER' ? 'Patron' : 'Çalışan'}
                </p>
              </div>
            </div>
            <button
              aria-label="Oturumu kapat"
              className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 transition hover:border-rose-500/30 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
              disabled={loggingOut}
              onClick={handleLogout}
              title="Oturumu kapat"
              type="button"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        {collapsed && (
          <button
            aria-label="Oturumu kapat"
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
            disabled={loggingOut}
            onClick={handleLogout}
            title="Oturumu kapat"
            type="button"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
      {!collapsed && companyName !== 'Business CEO AI' && (
        <p className="absolute bottom-[74px] left-5 max-w-[220px] truncate text-[10px] font-medium uppercase tracking-[0.14em] text-slate-600">
          {companyName} çalışma alanı
        </p>
      )}
    </aside>
    </>
  );
}
