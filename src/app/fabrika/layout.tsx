import FabrikaAppShell from '@/components/fabrika/FabrikaAppShell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import styles from './fabrika-ui.module.css';

export const metadata = {
  title: 'Jasmine AI Fabrikası | Yapay Zeka Kontrol Paneli',
  description: 'Jasmine Group Yapay Zeka Fabrikası — Emlak ofisinizi otonom bir dijital fabrikaya dönüştürün.',
};

export default async function FabrikaLayout({ children }: { children: React.ReactNode }) {
  const principal = await requireFabrikaPrincipal();

  return (
    <TooltipProvider delayDuration={250}>
      <div className={`${styles.root} dark`}>
        <FabrikaAppShell
          account={{
            companyName: principal.account.companyName,
          }}
          session={{
            principalType: principal.type,
            displayName: principal.displayName,
            hunterEnabled: principal.account.hunterEnabled,
            permissions: principal.permissions,
          }}
        >
          {children}
        </FabrikaAppShell>
        <Toaster position="top-right" richColors closeButton />
      </div>
    </TooltipProvider>
  );
}
