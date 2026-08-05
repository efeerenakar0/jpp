'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Info,
  Loader2,
  MessageCircle,
  Settings2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CompanyOnboardingProfile } from '@/lib/company-onboarding';

interface OnboardingWizardProps {
  initialCompanyName: string;
  mode?: 'dialog' | 'page';
  onComplete?: () => void;
  onDismiss?: () => void;
}

interface ApiResponse {
  error?: string;
  profile?: CompanyOnboardingProfile;
}

const steps = [
  { title: 'Şirket', icon: Users },
  { title: 'Web sitesi', icon: Globe2 },
  { title: 'Bağlantılar', icon: MessageCircle },
  { title: 'Operasyon', icon: Settings2 },
  { title: 'Otomasyon', icon: Sparkles },
  { title: 'Tamamla', icon: CheckCircle2 },
];

function initialProfile(companyName: string): CompanyOnboardingProfile {
  return {
    version: 2,
    companyName: companyName.trim() || 'Şirketim',
    ownerPhone: '',
    timezone: 'Europe/Istanbul',
    strengths: [],
    uniquePoints: [],
    serviceAreas: [],
    yearsInBusiness: 0,
    teamSize: 1,
    extraNotes: '',
    website: { status: 'NONE', url: '', hostingProvider: '' },
    integrations: {
      whatsapp: 'NOT_CONNECTED',
      googleCalendar: 'NOT_CONNECTED',
    },
    communication: {
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    },
    operations: {
      customerResponseMinutes: 15,
      employeeAcknowledgementMinutes: 15,
      ownerEscalationMinutes: 15,
      ownerNoResponseAction: 'CREATE_CRITICAL_TASK',
      appointmentReminderHours: 24,
      appointmentOutcomeDelayMinutes: 30,
    },
    automations: {
      automaticEmployeeAssignment: false,
      automaticEmployeeWhatsApp: false,
      hotLeadAlerts: true,
      morningSummary: true,
      eveningSummary: true,
    },
    setupDisposition: 'IN_PROGRESS',
    currentStep: 1,
  };
}

function csv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function FieldLabel({ children, help }: { children: React.ReactNode; help: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <label className="text-sm font-medium text-slate-200">{children}</label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label={`${String(children)} hakkında bilgi`}
          >
            <Info className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{help}</TooltipContent>
      </Tooltip>
    </div>
  );
}

const inputClass =
  'min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';

export default function OnboardingWizard({
  initialCompanyName,
  mode = 'dialog',
  onComplete,
  onDismiss,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(() => initialProfile(initialCompanyName));
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/fabrika/onboarding', { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json()) as ApiResponse;
        if (!response.ok) throw new Error(data.error || 'Ayarlar yüklenemedi.');
        if (active && data.profile) {
          setProfile(data.profile);
          if (mode === 'dialog' && data.profile.setupDisposition !== 'COMPLETED') {
            setStep(data.profile.currentStep);
          }
        }
      })
      .catch((caught) => {
        if (active) {
          setError(caught instanceof Error ? caught.message : 'Ayarlar yüklenemedi.');
        }
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });
    return () => {
      active = false;
    };
  }, [mode]);

  const progress = useMemo(() => (step / steps.length) * 100, [step]);

  function patchProfile(patch: Partial<CompanyOnboardingProfile>) {
    setSaved(false);
    setProfile((current) => ({ ...current, ...patch }));
  }

  async function persist(disposition: 'DEFERRED' | 'COMPLETED') {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload = {
        ...profile,
        companyName: profile.companyName.trim(),
        ownerPhone: profile.ownerPhone.trim(),
        setupDisposition: disposition,
        currentStep: disposition === 'COMPLETED' ? 6 : step,
        completed: disposition === 'COMPLETED',
      };
      const response = await fetch('/api/fabrika/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(data.error || 'Ayarlar kaydedilemedi.');
      if (data.profile) setProfile(data.profile);
      setSaved(true);
      if (disposition === 'COMPLETED') onComplete?.();
      else onDismiss?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <div
      role={mode === 'dialog' ? 'dialog' : undefined}
      aria-modal={mode === 'dialog' ? true : undefined}
      aria-labelledby="company-setup-title"
      className={
        mode === 'dialog'
          ? 'relative w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl'
          : 'w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70'
      }
    >
      <header className="border-b border-slate-800 px-5 py-5 sm:px-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
              {mode === 'dialog' ? 'İlk kurulum' : 'Şirket ayarları'}
            </p>
            <h2 id="company-setup-title" className="mt-1 text-2xl font-semibold text-white">
              Business CEO AI&apos;ı şirketinize göre ayarlayın
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Bu seçimler görev dağıtımı, patron bildirimleri, WhatsApp ve takvim akışlarında gerçekten uygulanır. API anahtarı girmeniz gerekmez.
            </p>
          </div>
          {mode === 'dialog' ? (
            <button
              type="button"
              onClick={() => void persist('DEFERRED')}
              disabled={saving}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
            >
              Daha sonra <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <ol className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Kurulum adımları">
          {steps.map((item, index) => {
            const number = index + 1;
            const Icon = item.icon;
            return (
              <li key={item.title}>
                <button
                  type="button"
                  onClick={() => setStep(number)}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-2.5 text-left text-xs transition ${
                    step === number
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                  }`}
                  aria-current={step === number ? 'step' : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      <div className="min-h-[360px] px-5 py-6 sm:px-7">
        {loadingProfile ? (
          <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="size-5 animate-spin" /> Ayarlar yükleniyor…
          </div>
        ) : (
          <>
            {error ? (
              <div role="alert" className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel help="Panelde ve müşteri iletişimlerinde görünen emlak şirketinizin adıdır.">Şirket adı</FieldLabel>
                  <input className={inputClass} value={profile.companyName} onChange={(event) => patchProfile({ companyName: event.target.value })} />
                </div>
                <div>
                  <FieldLabel help="Patron bildirimlerinin gönderileceği numaradır. Ülke koduyla yazın.">Patron telefonu</FieldLabel>
                  <input className={inputClass} inputMode="tel" placeholder="+905551112233" value={profile.ownerPhone} onChange={(event) => patchProfile({ ownerPhone: event.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel help="AI önerileri ve portföy eşleşmeleri öncelikle bu bölgeleri dikkate alır.">Hizmet bölgeleri (virgülle ayırın)</FieldLabel>
                  <input className={inputClass} placeholder="Alanya, Oba, Mahmutlar" value={profile.serviceAreas.join(', ')} onChange={(event) => patchProfile({ serviceAreas: csv(event.target.value) })} />
                </div>
                <div>
                  <FieldLabel help="Şirket tanıtımlarında ve pazarlama metinlerinde kullanılabilir.">Sektördeki yıl</FieldLabel>
                  <input className={inputClass} type="number" min={0} max={250} value={profile.yearsInBusiness} onChange={(event) => patchProfile({ yearsInBusiness: Number(event.target.value) })} />
                </div>
                <div>
                  <FieldLabel help="Görev dağıtımı ve ekip kapasitesi önerilerinde kullanılır.">Ekip büyüklüğü</FieldLabel>
                  <input className={inputClass} type="number" min={1} max={10000} value={profile.teamSize} onChange={(event) => patchProfile({ teamSize: Number(event.target.value) })} />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <div>
                  <FieldLabel help="Var olan sitenizi uygulamadaki portföylerle senkronlayabilir veya yeni site teslimi isteyebilirsiniz.">Web sitesi durumu</FieldLabel>
                  <select className={inputClass} value={profile.website.status} onChange={(event) => patchProfile({ website: { ...profile.website, status: event.target.value as CompanyOnboardingProfile['website']['status'] } })}>
                    <option value="NONE">Şu anda web sitem yok</option>
                    <option value="EXISTING">Mevcut web sitem var</option>
                    <option value="REQUESTED">Yeni web sitesi istiyorum</option>
                  </select>
                </div>
                {profile.website.status === 'EXISTING' ? (
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <FieldLabel help="Entegrasyon kapsamını hazırlamak için sitenizin açık adresidir.">Web sitesi adresi</FieldLabel>
                      <input className={inputClass} type="url" placeholder="https://sirketiniz.com" value={profile.website.url} onChange={(event) => patchProfile({ website: { ...profile.website, url: event.target.value } })} />
                    </div>
                    <div>
                      <FieldLabel help="Biliyorsanız Vercel, Netlify veya mevcut hosting firmanızı yazın.">Hosting sağlayıcısı</FieldLabel>
                      <input className={inputClass} placeholder="Örn. Vercel" value={profile.website.hostingProvider} onChange={(event) => patchProfile({ website: { ...profile.website, hostingProvider: event.target.value } })} />
                    </div>
                  </div>
                ) : null}
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm leading-6 text-slate-400">
                  Site dosyaları, teslim ve yayın işlemleri Yazılımcı modülünde güvenli şekilde yönetilir. Gerçek platform anahtarları hiçbir zaman tarayıcıda gösterilmez.
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="grid gap-5 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                  <FieldLabel help="WhatsApp bağlandığında Asistan, çalışan ve patron operasyonları aynı şirket hesabında çalışır.">WhatsApp planı</FieldLabel>
                  <select className={inputClass} value={profile.integrations.whatsapp} onChange={(event) => patchProfile({ integrations: { ...profile.integrations, whatsapp: event.target.value as CompanyOnboardingProfile['integrations']['whatsapp'] } })}>
                    <option value="NOT_CONNECTED">Şimdilik bağlamayacağım</option>
                    <option value="PLANNED">Kurulumdan sonra bağlayacağım</option>
                    {profile.integrations.whatsapp === 'CONNECTED' ? <option value="CONNECTED">Bağlı</option> : null}
                  </select>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-5">
                  <FieldLabel help="Google Takvim bağlanınca randevular iki yönlü senkron tutulur.">Google Takvim planı</FieldLabel>
                  <select className={inputClass} value={profile.integrations.googleCalendar} onChange={(event) => patchProfile({ integrations: { ...profile.integrations, googleCalendar: event.target.value as CompanyOnboardingProfile['integrations']['googleCalendar'] } })}>
                    <option value="NOT_CONNECTED">Şimdilik bağlamayacağım</option>
                    <option value="PLANNED">Kurulumdan sonra bağlayacağım</option>
                    {profile.integrations.googleCalendar === 'CONNECTED' ? <option value="CONNECTED">Bağlı</option> : null}
                  </select>
                </div>
                <p className="text-sm text-slate-500 md:col-span-2">
                  Bu adım yalnız planınızı kaydeder. Gerçek bağlantı; WhatsApp ve Takvim sayfalarındaki güvenli bağlantı düğmeleriyle tamamlanır.
                </p>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <NumberSetting label="Müşteriye ilk dönüş" help="Yeni müşteri talebinde ekibin hedef yanıt süresidir." suffix="dakika" min={1} max={240} value={profile.operations.customerResponseMinutes} onChange={(value) => patchProfile({ operations: { ...profile.operations, customerResponseMinutes: value } })} />
                <NumberSetting label="Çalışan görev kabulü" help="Çalışan bu sürede görevi kabul etmezse süreç patrona taşınır." suffix="dakika" min={5} max={120} value={profile.operations.employeeAcknowledgementMinutes} onChange={(value) => patchProfile({ operations: { ...profile.operations, employeeAcknowledgementMinutes: value } })} />
                <NumberSetting label="Patron eskalasyonu" help="İlk uyarıdan sonra patron kararının bekleneceği süredir." suffix="dakika" min={5} max={240} value={profile.operations.ownerEscalationMinutes} onChange={(value) => patchProfile({ operations: { ...profile.operations, ownerEscalationMinutes: value } })} />
                <NumberSetting label="Randevu hatırlatma" help="Çalışana randevudan kaç saat önce teyit sorulacağını belirler." suffix="saat önce" min={1} max={72} value={profile.operations.appointmentReminderHours} onChange={(value) => patchProfile({ operations: { ...profile.operations, appointmentReminderHours: value } })} />
                <NumberSetting label="Görüşme sonucu" help="Randevu bittikten ne kadar sonra çalışandan sonuç isteneceğini belirler." suffix="dakika sonra" min={5} max={1440} value={profile.operations.appointmentOutcomeDelayMinutes} onChange={(value) => patchProfile({ operations: { ...profile.operations, appointmentOutcomeDelayMinutes: value } })} />
                <div>
                  <FieldLabel help="Patron süresinde cevap vermezse sistemin güvenli varsayılan davranışıdır.">Patron cevap vermezse</FieldLabel>
                  <select className={inputClass} value={profile.operations.ownerNoResponseAction} onChange={(event) => patchProfile({ operations: { ...profile.operations, ownerNoResponseAction: event.target.value as CompanyOnboardingProfile['operations']['ownerNoResponseAction'] } })}>
                    <option value="CREATE_CRITICAL_TASK">Kritik görev oluştur</option>
                    <option value="RETRY_AND_ALERT">Bir kez tekrar uyar</option>
                    <option value="PAUSE_AUTOMATION">Otomasyonu güvenle durdur</option>
                  </select>
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <div className="grid gap-4 md:grid-cols-2">
                <ToggleSetting checked={profile.automations.automaticEmployeeAssignment} label="Uygun çalışana otomatik görev öner" help="Sistem uygun çalışanı seçer; güvenlik kuralı gerektiren işlemler yine onay bekler." onChange={(value) => patchProfile({ automations: { ...profile.automations, automaticEmployeeAssignment: value } })} />
                <ToggleSetting checked={profile.automations.automaticEmployeeWhatsApp} label="Çalışana WhatsApp görev mesajı gönder" help="Yalnız bağlı ve sağlıklı şirket WhatsApp oturumunda gönderim kuyruğuna eklenir." onChange={(value) => patchProfile({ automations: { ...profile.automations, automaticEmployeeWhatsApp: value } })} />
                <ToggleSetting checked={profile.automations.hotLeadAlerts} label="Sıcak müşteri uyarıları" help="Yüksek niyetli müşteriler patronun önemli bildirimlerine düşer." onChange={(value) => patchProfile({ automations: { ...profile.automations, hotLeadAlerts: value } })} />
                <ToggleSetting checked={profile.automations.morningSummary} label="Sabah özeti" help="Günün görev ve randevu özeti sessiz saatlerden sonra hazırlanır." onChange={(value) => patchProfile({ automations: { ...profile.automations, morningSummary: value } })} />
                <ToggleSetting checked={profile.automations.eveningSummary} label="Akşam özeti" help="Günün tamamlanan ve geciken işlerini tek kısa özet halinde sunar." onChange={(value) => patchProfile({ automations: { ...profile.automations, eveningSummary: value } })} />
                <ToggleSetting checked={profile.communication.quietHoursEnabled} label="Sessiz saatler" help="Acil olmayan özetler bu saat aralığında gönderilmez." onChange={(value) => patchProfile({ communication: { ...profile.communication, quietHoursEnabled: value } })} />
                {profile.communication.quietHoursEnabled ? (
                  <div className="grid grid-cols-2 gap-3 md:col-span-2">
                    <div>
                      <FieldLabel help="Acil olmayan bildirimlerin duracağı saat.">Başlangıç</FieldLabel>
                      <input className={inputClass} type="time" value={profile.communication.quietHoursStart} onChange={(event) => patchProfile({ communication: { ...profile.communication, quietHoursStart: event.target.value } })} />
                    </div>
                    <div>
                      <FieldLabel help="Ertelenen bildirimlerin yeniden başlayacağı saat.">Bitiş</FieldLabel>
                      <input className={inputClass} type="time" value={profile.communication.quietHoursEnd} onChange={(event) => patchProfile({ communication: { ...profile.communication, quietHoursEnd: event.target.value } })} />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 6 ? (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryCard label="Şirket" value={profile.companyName} />
                  <SummaryCard label="Hedef ilk dönüş" value={`${profile.operations.customerResponseMinutes} dakika`} />
                  <SummaryCard label="Otomatik görev" value={profile.automations.automaticEmployeeAssignment ? 'Açık' : 'Kapalı'} />
                </div>
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <FieldLabel help="Pazarlama ve AI iletişimlerinde öne çıkarılabilecek gerçek şirket avantajlarıdır.">Güçlü yanlar (virgülle ayırın)</FieldLabel>
                    <textarea className={`${inputClass} min-h-28 py-3`} value={profile.strengths.join(', ')} onChange={(event) => patchProfile({ strengths: csv(event.target.value) })} />
                  </div>
                  <div>
                    <FieldLabel help="Rakiplerden ayrışan hizmet veya uzmanlıklarınız için kullanılır.">Benzersiz özellikler (virgülle ayırın)</FieldLabel>
                    <textarea className={`${inputClass} min-h-28 py-3`} value={profile.uniquePoints.join(', ')} onChange={(event) => patchProfile({ uniquePoints: csv(event.target.value) })} />
                  </div>
                </div>
                <div>
                  <FieldLabel help="Şirket dilini veya operasyon ekibinin bilmesi gereken genel notları yazın; hassas bilgi ve parola yazmayın.">Şirkete özel notlar</FieldLabel>
                  <textarea className={`${inputClass} min-h-28 py-3`} placeholder="Örn. Müşterilerle samimi ama profesyonel konuş." value={profile.extraNotes} onChange={(event) => patchProfile({ extraNotes: event.target.value })} />
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
                  <div className="flex items-center gap-2 font-semibold"><Check className="size-4" /> Kurulum hazır</div>
                  <p className="mt-1 text-emerald-100/75">Tüm ayarları daha sonra Ayarlar sayfasından değiştirebilirsiniz.</p>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 sm:px-7">
        <button type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || saving} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:invisible">
          <ChevronLeft className="size-4" /> Geri
        </button>
        <div className="flex items-center gap-3">
          {saved ? <span role="status" className="text-sm text-emerald-400">Kaydedildi</span> : null}
          {step < steps.length ? (
            <button type="button" onClick={() => setStep((current) => Math.min(steps.length, current + 1))} disabled={loadingProfile} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50">
              Devam <ChevronRight className="size-4" />
            </button>
          ) : (
            <button type="button" onClick={() => void persist('COMPLETED')} disabled={saving || loadingProfile} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              {mode === 'dialog' ? 'Kurulumu tamamla' : 'Ayarları kaydet'}
            </button>
          )}
        </div>
      </footer>
    </div>
  );

  if (mode === 'page') return content;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/85 p-3 text-slate-100 backdrop-blur-sm sm:p-6">
      {content}
    </div>
  );
}

function NumberSetting({ label, help, suffix, min, max, value, onChange }: { label: string; help: string; suffix: string; min: number; max: number; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <FieldLabel help={help}>{label}</FieldLabel>
      <div className="relative">
        <input className={`${inputClass} pr-24`} type="number" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{suffix}</span>
      </div>
    </div>
  );
}

function ToggleSetting({ checked, label, help, onChange }: { checked: boolean; label: string; help: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 hover:border-slate-700">
      <span>
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{help}</span>
      </span>
      <input className="mt-1 size-4 accent-emerald-500" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 truncate text-base font-semibold text-slate-100">{value}</p>
    </div>
  );
}
