import FabrikaSidebar from '@/components/fabrika/Sidebar';
import NotificationBell from '@/components/fabrika/NotificationBell';
import { Sparkles, Cpu } from 'lucide-react';

export const metadata = {
  title: 'Jasmine AI Fabrikası | Yapay Zeka Kontrol Paneli',
  description: 'Jasmine Group Yapay Zeka Fabrikası — Emlak ofisinizi otonom bir dijital fabrikaya dönüştürün.',
};

export default function FabrikaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <FabrikaSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-2xl flex items-center justify-between px-6 flex-shrink-0 z-[100] relative">
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
              <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider">AI Fabrikası Otonom Motor</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* AI Status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-300 font-bold">Canlı Gemini & Meta API</span>
            </div>

            {/* Notifications */}
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
