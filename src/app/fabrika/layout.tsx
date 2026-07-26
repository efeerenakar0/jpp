import FabrikaAppShell from '@/components/fabrika/FabrikaAppShell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { requireFabrikaAccount } from '@/lib/fabrika-session';
import styles from './fabrika-ui.module.css';

export const metadata = {
  title: 'Jasmine AI Fabrikası | Yapay Zeka Kontrol Paneli',
  description: 'Jasmine Group Yapay Zeka Fabrikası — Emlak ofisinizi otonom bir dijital fabrikaya dönüştürün.',
};

export default async function FabrikaLayout({ children }: { children: React.ReactNode }) {
  const account = await requireFabrikaAccount();

  return (
    <TooltipProvider delayDuration={250}>
      <div className={`${styles.root} dark`}>
        <FabrikaAppShell
          account={{
            companyName: account.companyName,
            ownerName: account.ownerName,
          }}
        >
          {children}
        </FabrikaAppShell>
        <Toaster position="top-right" richColors closeButton />
      </div>
    </TooltipProvider>
  );
}
