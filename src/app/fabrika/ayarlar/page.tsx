import { Settings2 } from 'lucide-react';

import OnboardingWizard from '@/components/fabrika/OnboardingWizard';
import { requireFabrikaOwner } from '@/lib/fabrika-session';

export default async function CompanySettingsPage() {
  const principal = await requireFabrikaOwner();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6">
      <header className="border-b border-slate-800 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Şirket yönetimi
        </p>
        <div className="mt-3 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <Settings2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              Ayarlar
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              İlk kurulum seçimlerinizi, operasyon sürelerini ve patron/çalışan otomasyonlarını buradan değiştirebilirsiniz.
            </p>
          </div>
        </div>
      </header>

      <OnboardingWizard
        initialCompanyName={principal.account.companyName}
        mode="page"
      />
    </main>
  );
}
