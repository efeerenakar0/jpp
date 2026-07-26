import FabrikaAppShell from '@/components/fabrika/FabrikaAppShell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import styles from './fabrika-ui.module.css';

export const metadata = {
  title: 'Jasmine AI Fabrikası | Yapay Zeka Kontrol Paneli',
  description: 'Jasmine Group Yapay Zeka Fabrikası — Emlak ofisinizi otonom bir dijital fabrikaya dönüştürün.',
};

export default function FabrikaLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={250}>
      <div className={`${styles.root} dark`}>
        <FabrikaAppShell>{children}</FabrikaAppShell>
        <Toaster position="top-right" richColors closeButton />
      </div>
    </TooltipProvider>
  );
}
