'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Bot,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe2,
  Loader2,
  Save,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import CompanySettingsStep from '@/components/fabrika/company-settings/CompanySettingsStep';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  companySettingsRequestSchema,
  defaultCompanySettings,
  type CompanySettingsMemberOption,
  type CompanySettingsRequest,
} from '@/lib/company-settings';

interface OnboardingWizardProps {
  initialCompanyName: string;
  mode?: 'dialog' | 'page';
  onComplete?: () => void;
  onDismiss?: () => void;
}

interface ApiResponse {
  success?: boolean;
  error?: string;
  completed?: boolean;
  settings?: CompanySettingsRequest;
  members?: CompanySettingsMemberOption[];
}

const steps = [
  { title: 'Şirket', description: 'Kimlik ve iletişim', icon: Building2 },
  { title: 'Web ve sosyal', description: 'Bağlantılar', icon: Globe2 },
  { title: 'Çalışma saatleri', description: 'Ofis programı', icon: Clock3 },
  { title: 'Operasyon', description: 'Süreler ve sıra', icon: Settings2 },
  { title: 'Bildirimler', description: 'Patron politikası', icon: BellRing },
  { title: 'AI izinleri', description: 'Otomasyon sınırı', icon: Bot },
  { title: 'Onay', description: 'Kontrol ve bitir', icon: ShieldCheck },
];

type SaveReason = 'AUTO' | 'MANUAL' | 'DEFER' | 'COMPLETE';

export default function OnboardingWizard({
  initialCompanyName,
  mode = 'dialog',
  onComplete,
  onDismiss,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [settings, setSettings] = useState<CompanySettingsRequest>(() =>
    defaultCompanySettings(initialCompanyName)
  );
  const [members, setMembers] = useState<CompanySettingsMemberOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [completedBefore, setCompletedBefore] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/fabrika/settings', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as ApiResponse;
        if (!response.ok) throw new Error(data.error || 'Ayarlar yüklenemedi.');
        if (data.settings) {
          setSettings(data.settings);
          setCompletedBefore(Boolean(data.completed));
          if (mode === 'dialog' && !data.completed) {
            setStep(data.settings.setup.currentStep);
          }
        }
        setMembers(data.members ?? []);
      })
      .catch((caught) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : 'Ayarlar yüklenemedi.');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [mode]);

  const save = useCallback(
    async (next: CompanySettingsRequest, reason: SaveReason) => {
      const sequence = ++requestSequence.current;
      const silent = reason === 'AUTO';
      if (silent) setAutoSaving(true);
      else setSaving(true);
      if (!silent) setError('');

      try {
        const parsed = companySettingsRequestSchema.safeParse(next);
        if (!parsed.success) {
          if (!silent) {
            throw new Error(parsed.error.issues[0]?.message || 'Ayarları kontrol edin.');
          }
          return false;
        }

        const response = await fetch('/api/fabrika/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        const data = (await response.json()) as ApiResponse;
        if (!response.ok) throw new Error(data.error || 'Ayarlar kaydedilemedi.');

        if (sequence === requestSequence.current) {
          if (data.settings) setSettings(data.settings);
          setMembers(data.members ?? members);
          setSavedAt(new Date());
          setDirty(false);
          setCompletedBefore(Boolean(data.completed));
        }
        return true;
      } catch (caught) {
        if (sequence === requestSequence.current) {
          setError(caught instanceof Error ? caught.message : 'Ayarlar kaydedilemedi.');
        }
        return false;
      } finally {
        if (sequence === requestSequence.current) {
          setSaving(false);
          setAutoSaving(false);
        }
      }
    },
    [members]
  );

  const autoSave = useDebouncedCallback(
    (draft: CompanySettingsRequest) => void save(draft, 'AUTO'),
    1_000
  );

  useEffect(() => () => autoSave.cancel(), [autoSave]);

  const progress = useMemo(() => (step / steps.length) * 100, [step]);

  function update(next: CompanySettingsRequest) {
    const withProgress: CompanySettingsRequest = {
      ...next,
      setup: {
        ...next.setup,
        currentStep: step,
        disposition: completedBefore ? 'COMPLETED' : 'IN_PROGRESS',
      },
    };
    setSettings(withProgress);
    setDirty(true);
    setError('');
    autoSave(withProgress);
  }

  async function navigate(nextStep: number) {
    autoSave.cancel();
    const next = {
      ...settings,
      setup: {
        ...settings.setup,
        currentStep: nextStep,
        disposition: completedBefore ? 'COMPLETED' as const : 'IN_PROGRESS' as const,
      },
    };
    setSettings(next);
    setStep(nextStep);
    if (dirty) await save(next, 'MANUAL');
  }

  async function defer() {
    autoSave.cancel();
    const next = {
      ...settings,
      setup: {
        disposition: 'DEFERRED' as const,
        currentStep: step,
      },
    };
    if (await save(next, 'DEFER')) onDismiss?.();
  }

  async function complete() {
    autoSave.cancel();
    if (!settings.dataProcessing.accepted && !completedBefore) {
      setError('Kurulumu tamamlamak için veri işleme bilgilendirmesini onaylayın.');
      return;
    }
    const next = {
      ...settings,
      setup: { disposition: 'COMPLETED' as const, currentStep: 7 },
    };
    if (await save(next, 'COMPLETE')) onComplete?.();
  }

  const content = (
    <div
      aria-describedby="company-setup-description"
      aria-labelledby="company-setup-title"
      className={
        mode === 'dialog'
          ? 'relative w-full max-w-6xl overflow-hidden rounded-2xl border border-cyan-500/20 bg-slate-950 shadow-2xl shadow-cyan-950/40'
          : 'w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60'
      }
    >
      <header className="border-b border-slate-800 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">
              {mode === 'dialog' ? 'İlk şirket kurulumu' : 'Şirket Ayarlarınız'}
            </p>
            {mode === 'dialog' ? (
              <DialogTitle asChild>
                <h2 id="company-setup-title" className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                  Business CEO AI&apos;ı şirketinize göre ayarlayın
                </h2>
              </DialogTitle>
            ) : (
              <h2 id="company-setup-title" className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                Business CEO AI&apos;ı şirketinize göre ayarlayın
              </h2>
            )}
            {mode === 'dialog' ? (
              <DialogDescription asChild>
                <p id="company-setup-description" className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                  Bu seçimler görev dağıtımı, hatırlatmalar, patron bildirimleri ve AI otomasyonlarında gerçek ayar olarak uygulanır.
                </p>
              </DialogDescription>
            ) : (
              <p id="company-setup-description" className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                Bu seçimler görev dağıtımı, hatırlatmalar, patron bildirimleri ve AI otomasyonlarında gerçek ayar olarak uygulanır.
              </p>
            )}
          </div>
          {mode === 'dialog' ? (
            <button
              type="button"
              onClick={() => void defer()}
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-200 disabled:opacity-50"
            >
              Daha sonra devam et <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div
          aria-label="Kurulum ilerlemesi"
          aria-valuemax={steps.length}
          aria-valuemin={1}
          aria-valuenow={step}
          className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-800"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="Kurulum adımları">
          {steps.map((item, index) => {
            const number = index + 1;
            const Icon = item.icon;
            const active = step === number;
            return (
              <li key={item.title}>
                <button
                  type="button"
                  onClick={() => void navigate(number)}
                  className={`flex min-h-14 w-full items-center gap-2 rounded-lg border px-2.5 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    active
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100'
                      : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                  }`}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-900"><Icon className="size-4" /></span>
                  <span className="min-w-0"><span className="block truncate font-semibold">{item.title}</span><span className="mt-0.5 hidden truncate text-[10px] opacity-70 xl:block">{item.description}</span></span>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      <div className="min-h-[430px] px-5 py-6 sm:px-7">
        {loading ? (
          <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-slate-400" role="status">
            <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> Ayarlar yükleniyor…
          </div>
        ) : (
          <>
            {error ? (
              <div role="alert" className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}
            <CompanySettingsStep step={step} value={settings} members={members} onChange={update} />
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 sm:px-7">
        <button
          type="button"
          onClick={() => void navigate(Math.max(1, step - 1))}
          disabled={step === 1 || saving}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:invisible"
        >
          <ChevronLeft className="size-4" /> Geri
        </button>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="min-w-28 text-right text-xs text-slate-500" aria-live="polite">
            {autoSaving ? 'Taslak kaydediliyor…' : savedAt ? `Kaydedildi · ${savedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : dirty ? 'Kaydedilmemiş değişiklik' : ''}
          </span>
          {mode === 'page' ? (
            <button
              type="button"
              onClick={() => void save(settings, 'MANUAL')}
              disabled={saving || loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:border-cyan-500/40 hover:text-cyan-200 disabled:opacity-50"
            >
              <Save className="size-4" /> Kaydet ve çık
            </button>
          ) : null}
          {step < steps.length ? (
            <button
              type="button"
              onClick={() => void navigate(Math.min(steps.length, step + 1))}
              disabled={saving || loading}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-cyan-400 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
            >
              Devam <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void complete()}
              disabled={saving || loading || (!settings.dataProcessing.accepted && !completedBefore)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-400 px-5 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : <CheckCircle2 className="size-4" />}
              {mode === 'dialog' ? 'Kurulumu tamamla' : 'Ayarları uygula'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );

  if (mode === 'page') return content;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) void defer();
      }}
    >
      <DialogContent
        aria-describedby="company-setup-description"
        className="z-[90] !w-[calc(100vw-1.5rem)] !max-w-6xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto border-0 bg-transparent p-0 text-slate-100 shadow-none sm:!w-[calc(100vw-3rem)]"
        showCloseButton={false}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
