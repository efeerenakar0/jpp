import FabrikaAppShell from '@/components/fabrika/FabrikaAppShell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { isHunterEnabled } from '@/lib/company-accounts';
import { businessCeoBrand } from '@/lib/business-ceo-brand';
import styles from './fabrika-ui.module.css';

export const metadata = {
  title: `${businessCeoBrand.productName} | Real Estate`,
  description: `${businessCeoBrand.productName} — şirketinizi müşteri, portföy, pazarlama ve yapay zekâ operasyonlarıyla tek merkezden yönetin.`,
};

export default async function FabrikaLayout({ children }: { children: React.ReactNode }) {
  const principal = await requireFabrikaPrincipal();

  return (
    <TooltipProvider delayDuration={250}>
      <div className={`${styles.root} dark`}>
        <FabrikaAppShell
          account={{
            companyName: principal.account.companyName,
            logoData: principal.account.brandLogoData,
            onboardingComplete: Boolean(principal.account.onboardingCompletedAt),
          }}
          session={{
            principalType: principal.type,
            displayName: principal.displayName,
            hunterEnabled: isHunterEnabled(principal.account),
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
