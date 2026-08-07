'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Building2,
  ImagePlus,
  Info,
  MessageCircleMore,
  Trash2,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  CompanySettingsMemberOption,
  CompanySettingsRequest,
} from '@/lib/company-settings';

interface Props {
  step: number;
  value: CompanySettingsRequest;
  members: CompanySettingsMemberOption[];
  onChange: (value: CompanySettingsRequest) => void;
}

export const settingsInputClass =
  'min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20';

const dayLabels: Record<CompanySettingsRequest['workHours'][number]['day'], string> = {
  MONDAY: 'Pazartesi',
  TUESDAY: 'Salı',
  WEDNESDAY: 'Çarşamba',
  THURSDAY: 'Perşembe',
  FRIDAY: 'Cuma',
  SATURDAY: 'Cumartesi',
  SUNDAY: 'Pazar',
};

export function SettingsLabel({ children, help }: { children: ReactNode; help: string }) {
  const helpId = useId();

  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="text-sm font-medium text-slate-200">{children}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-full border border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-300 transition hover:border-cyan-300/50 hover:bg-cyan-400/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Bu ayar hakkında bilgi"
            aria-describedby={helpId}
          >
            <Info className="size-4" />
          </button>
        </TooltipTrigger>
        <span id={helpId} className="sr-only">
          {help}
        </span>
        <TooltipContent
          align="start"
          className="max-w-[min(22rem,calc(100vw-2rem))] items-start rounded-xl border border-cyan-300/30 bg-[#061522] px-4 py-3 text-sm font-medium leading-6 text-slate-100 shadow-2xl shadow-black/50 dark:bg-[#061522] dark:text-slate-100 [&>svg]:bg-[#061522] [&>svg]:fill-[#061522]"
          sideOffset={8}
        >
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function Toggle({
  checked,
  label,
  help,
  onChange,
}: {
  checked: boolean;
  label: string;
  help: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex min-h-24 cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 transition hover:border-cyan-500/30">
      <span>
        <span className="block text-sm font-semibold text-slate-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{help}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 size-4 accent-cyan-400"
      />
    </label>
  );
}

function NumberField({
  label,
  help,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  help: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <SettingsLabel help={help}>{label}</SettingsLabel>
      <div className="relative">
        <input
          className={`${settingsInputClass} pr-24`}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">
          {suffix}
        </span>
      </div>
    </div>
  );
}

export default function CompanySettingsStep({ step, value, members, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState('');

  const patch = <K extends keyof CompanySettingsRequest>(
    key: K,
    next: CompanySettingsRequest[K]
  ) => onChange({ ...value, [key]: next });

  function selectLogo(file: File | undefined) {
    setLocalError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setLocalError('Logo PNG, JPG veya WEBP olmalı.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLocalError('Logo dosyası en fazla 2 MB olabilir.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        patch('company', { ...value.company, logoData: reader.result });
      }
    };
    reader.onerror = () => setLocalError('Logo okunamadı. Lütfen yeniden deneyin.');
    reader.readAsDataURL(file);
  }

  if (step === 1) {
    return (
      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div>
          <SettingsLabel help="Üst çubukta ve şirket belgelerinde gösterilir. API anahtarı veya gizli bilgi içermez.">
            Şirket logosu
          </SettingsLabel>
          <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-4 text-center">
            {value.company.logoData ? (
              // A locally selected data URL is intentionally previewed before saving.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value.company.logoData}
                alt="Şirket logosu önizlemesi"
                className="max-h-24 max-w-full object-contain"
              />
            ) : (
              <Building2 className="size-10 text-cyan-400" />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 hover:border-cyan-500/50 hover:text-cyan-200"
            >
              <ImagePlus className="size-4" /> Logo seç
            </button>
            {value.company.logoData ? (
              <button
                type="button"
                onClick={() => patch('company', { ...value.company, logoData: null })}
                className="mt-2 text-xs text-slate-500 hover:text-rose-300"
              >
                Logoyu kaldır
              </button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => selectLogo(event.target.files?.[0])}
            />
          </div>
          {localError ? <p className="mt-2 text-xs text-rose-300">{localError}</p> : null}
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SettingsLabel help="Panelde, raporlarda ve müşteri belgelerinde gösterilecek şirket adıdır.">
              Şirket adı
            </SettingsLabel>
            <input
              className={settingsInputClass}
              value={value.company.name}
              onChange={(event) => patch('company', { ...value.company, name: event.target.value })}
            />
          </div>
          <div>
            <SettingsLabel help="Şirket ve patron bildirimleri için kullanılacak e-posta adresidir.">
              İletişim e-postası
            </SettingsLabel>
            <input
              className={settingsInputClass}
              type="email"
              placeholder="ofis@sirketiniz.com"
              value={value.company.contactEmail}
              onChange={(event) => patch('company', { ...value.company, contactEmail: event.target.value })}
            />
          </div>
          <div>
            <SettingsLabel help="Patron bildirimlerinde kullanılacak telefon numarasıdır. Ülke koduyla yazın.">
              İletişim telefonu
            </SettingsLabel>
            <input
              className={settingsInputClass}
              inputMode="tel"
              placeholder="+905551112233"
              value={value.company.contactPhone}
              onChange={(event) => patch('company', { ...value.company, contactPhone: event.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <SettingsLabel help="Ofis adresi rapor, sözleşme ve operasyon kayıtlarında kullanılabilir.">
              Ofis adresi
            </SettingsLabel>
            <textarea
              className={`${settingsInputClass} min-h-24 py-3`}
              value={value.company.address}
              onChange={(event) => patch('company', { ...value.company, address: event.target.value })}
            />
          </div>
          <div>
            <SettingsLabel help="Bölgesel rapor ve saat hesaplamalarında kullanılır.">Şehir</SettingsLabel>
            <input
              className={settingsInputClass}
              value={value.company.city}
              onChange={(event) => patch('company', { ...value.company, city: event.target.value })}
            />
          </div>
          <div>
            <SettingsLabel help="Yerel portföy ve müşteri operasyonlarını daraltır.">İlçe</SettingsLabel>
            <input
              className={settingsInputClass}
              value={value.company.district}
              onChange={(event) => patch('company', { ...value.company, district: event.target.value })}
            />
          </div>
          <div>
            <SettingsLabel help="Randevu, hatırlatma ve sessiz saatler bu saat dilimine göre çalışır.">
              Saat dilimi
            </SettingsLabel>
            <select
              className={settingsInputClass}
              value={value.company.timezone}
              onChange={(event) => patch('company', { ...value.company, timezone: event.target.value })}
            >
              <option value="Europe/Istanbul">Türkiye · İstanbul</option>
              <option value="Europe/Berlin">Almanya · Berlin</option>
              <option value="Europe/London">İngiltere · Londra</option>
              <option value="Asia/Dubai">BAE · Dubai</option>
            </select>
          </div>
          <div>
            <SettingsLabel help="Panel metinleri ve varsayılan içerik dili için kullanılır.">Dil ve bölge</SettingsLabel>
            <select
              className={settingsInputClass}
              value={value.company.locale}
              onChange={(event) => patch('company', { ...value.company, locale: event.target.value as CompanySettingsRequest['company']['locale'] })}
            >
              <option value="tr-TR">Türkçe</option>
              <option value="en-US">English</option>
              <option value="de-DE">Deutsch</option>
              <option value="ru-RU">Русский</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (step === 2) {
    const links: Array<[keyof CompanySettingsRequest['socialLinks'], string, string]> = [
      ['instagram', 'Instagram', 'https://instagram.com/...'],
      ['facebook', 'Facebook', 'https://facebook.com/...'],
      ['tiktok', 'TikTok', 'https://tiktok.com/@...'],
      ['x', 'X', 'https://x.com/...'],
      ['linkedin', 'LinkedIn', 'https://linkedin.com/company/...'],
    ];
    return (
      <div className="space-y-6">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <SettingsLabel help="Mevcut sitenizi bağlayabilir veya ücretsiz yeni site iş akışını başlatabilirsiniz.">
              Web sitesi durumu
            </SettingsLabel>
            <select
              className={settingsInputClass}
              value={value.website.status}
              onChange={(event) => patch('website', { ...value.website, status: event.target.value as CompanySettingsRequest['website']['status'] })}
            >
              <option value="NONE">Web sitem yok</option>
              <option value="EXISTING">Mevcut web sitem var</option>
              <option value="REQUESTED">Yeni web sitesi istiyorum</option>
            </select>
          </div>
          <div>
            <SettingsLabel help="Yalnız http veya https adresi kabul edilir; gizli anahtar yazmayın.">
              Web sitesi adresi
            </SettingsLabel>
            <input
              className={settingsInputClass}
              type="url"
              disabled={value.website.status !== 'EXISTING'}
              placeholder="https://sirketiniz.com"
              value={value.website.url}
              onChange={(event) => patch('website', { ...value.website, url: event.target.value })}
            />
          </div>
          <div>
            <SettingsLabel help="Biliyorsanız mevcut hosting sağlayıcınızı yazın.">Hosting sağlayıcısı</SettingsLabel>
            <input
              className={settingsInputClass}
              disabled={value.website.status !== 'EXISTING'}
              placeholder="Örn. Vercel"
              value={value.website.hostingProvider}
              onChange={(event) => patch('website', { ...value.website, hostingProvider: event.target.value })}
            />
          </div>
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Sosyal medya bağlantıları</h3>
          <p className="mt-1 text-sm text-slate-500">Yalnız herkese açık profil bağlantılarını girin. Şifre veya API anahtarı istenmez.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {links.map(([key, label, placeholder]) => (
              <div key={key}>
                <SettingsLabel help={`${label} profiliniz pazarlama çalışmalarında hızlı erişim için kullanılır.`}>{label}</SettingsLabel>
                <input
                  className={settingsInputClass}
                  type="url"
                  placeholder={placeholder}
                  value={value.socialLinks[key]}
                  onChange={(event) => patch('socialLinks', { ...value.socialLinks, [key]: event.target.value })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div>
        <h3 className="text-base font-semibold text-white">Ofis çalışma saatleri</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">Hatırlatma ve patron bildirimleri bu programa göre planlanır. Uzun süreli süreçler veritabanı görevleriyle çalışır.</p>
        <div className="mt-5 space-y-3">
          {value.workHours.map((entry, index) => (
            <div key={entry.day} className="grid items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 sm:grid-cols-[150px_1fr_1fr]">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-200">
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  className="size-4 accent-cyan-400"
                  onChange={(event) => {
                    const next = [...value.workHours];
                    next[index] = { ...entry, enabled: event.target.checked };
                    patch('workHours', next);
                  }}
                />
                {dayLabels[entry.day]}
              </label>
              <input
                className={settingsInputClass}
                type="time"
                disabled={!entry.enabled}
                value={entry.start}
                aria-label={`${dayLabels[entry.day]} başlangıç saati`}
                onChange={(event) => {
                  const next = [...value.workHours];
                  next[index] = { ...entry, start: event.target.value };
                  patch('workHours', next);
                }}
              />
              <input
                className={settingsInputClass}
                type="time"
                disabled={!entry.enabled}
                value={entry.end}
                aria-label={`${dayLabels[entry.day]} bitiş saati`}
                onChange={(event) => {
                  const next = [...value.workHours];
                  next[index] = { ...entry, end: event.target.value };
                  patch('workHours', next);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 4) {
    const availableMembers = members.filter(
      (member) => !value.escalationMemberIds.includes(member.id)
    );
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/fabrika/sirket"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-28 items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 outline-none transition hover:border-cyan-400/50 hover:bg-cyan-500/5 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/40"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
              <UsersRound className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-100">Patron ve çalışanları yönet</span>
              <span className="mt-1 block text-sm leading-5 text-slate-400">
                Ekip üyelerini, telefonlarını, rollerini ve giriş kodlarını düzenleyin.
              </span>
              <span className={`mt-2 block text-xs font-semibold ${members.length > 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                {members.length > 0
                  ? `${members.length} aktif ekip üyesi hazır`
                  : 'Henüz ekip üyesi eklenmedi'}
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden="true" />
          </Link>

          <Link
            href="/fabrika/whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-28 items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 outline-none transition hover:border-emerald-400/50 hover:bg-emerald-500/5 focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-300/40"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
              <MessageCircleMore className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-slate-100">WhatsApp bağlantılarını yönet</span>
              <span className="mt-1 block text-sm leading-5 text-slate-400">
                Şirket hattını bağlayın ve her hattın müşteri, ekip veya portföy amacını seçin.
              </span>
              <span className="mt-2 block text-xs font-semibold text-cyan-300">
                Bağlantı durumunu yeni sekmede kontrol edin
              </span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-emerald-300" aria-hidden="true" />
          </Link>
        </div>

        <p className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-4 py-3 text-sm leading-6 text-cyan-100/80">
          Yönetim sayfası yeni sekmede açılır. İşlemi orada bitirin. Bu kurulum sekmesine geri dönün; kurulum ilerlemeniz burada korunur.
        </p>

        <div className="grid gap-7 xl:grid-cols-[1fr_0.9fr]">
          <div className="grid content-start gap-5 md:grid-cols-2">
          <NumberField label="Müşteriye ilk dönüş" help="Yeni müşteri ilk mesajını gönderdiğinde ekibin yanıt vermesi için hedef süredir. Süre aşılırsa kayıt gecikmiş olarak işaretlenir ve bildirim kurallarınız devreye girer." suffix="dakika" min={1} max={240} value={value.operations.customerResponseMinutes} onChange={(next) => patch('operations', { ...value.operations, customerResponseMinutes: next })} />
          <NumberField label="Hatırlatma aralığı" help="Atanan çalışan görevi henüz kabul etmediyse sistem bu aralıkla yeni bir hatırlatma kuyruğa alır. Aynı görev için sınırsız mesaj gönderilmez." suffix="dakika" min={1} max={60} value={value.operations.employeeReminderMinutes} onChange={(next) => patch('operations', { ...value.operations, employeeReminderMinutes: next })} />
          <NumberField label="Çalışan cevap süresi" help="Çalışan bu süre içinde görevi kabul veya reddetmezse sistem eskalasyon sıranızdaki bir sonraki uygun çalışana geçer ve işlem geçmişini kaydeder." suffix="dakika" min={5} max={120} value={value.operations.employeeAcknowledgementMinutes} onChange={(next) => patch('operations', { ...value.operations, employeeAcknowledgementMinutes: next })} />
          <NumberField label="Patron karar süresi" help="Çalışan bulunamadığında veya kritik bir karar gerektiğinde patrona açılan karar isteğinin yanıt bekleyeceği süredir. Süre sonunda kayıt kritik uyarılara taşınır; sistem rastgele karar vermez." suffix="dakika" min={5} max={240} value={value.operations.ownerEscalationMinutes} onChange={(next) => patch('operations', { ...value.operations, ownerEscalationMinutes: next })} />
          <NumberField label="Randevu hatırlatma" help="Gösterimden bu kadar saat önce sorumlu çalışana randevu bilgisi ve teyit isteği gönderilir. Tarih ve saat şirketinizin seçili saat dilimine göre hesaplanır." suffix="saat önce" min={1} max={72} value={value.operations.appointmentReminderHours} onChange={(next) => patch('operations', { ...value.operations, appointmentReminderHours: next })} />
          <NumberField label="Görüşme sonucu" help="Randevu bittikten sonra sistem bu süre kadar bekler ve sorumlu çalışandan satıldı, takipte, sonuçsuz veya iptal gibi yapılandırılmış görüşme sonucunu ister." suffix="dakika" min={5} max={1440} value={value.operations.appointmentOutcomeDelayMinutes} onChange={(next) => patch('operations', { ...value.operations, appointmentOutcomeDelayMinutes: next })} />
          <div className="md:col-span-2">
            <SettingsLabel help="Patron yanıt vermezse güvenli ve denetlenebilir varsayılan davranıştır.">
              Patron cevap vermezse
            </SettingsLabel>
            <select
              className={settingsInputClass}
              value={value.operations.ownerNoResponseAction}
              onChange={(event) => patch('operations', { ...value.operations, ownerNoResponseAction: event.target.value as CompanySettingsRequest['operations']['ownerNoResponseAction'] })}
            >
              <option value="CREATE_CRITICAL_TASK">Kritik görev oluştur</option>
              <option value="RETRY_AND_ALERT">Bir kez tekrar uyar</option>
              <option value="PAUSE_AUTOMATION">Otomasyonu durdur</option>
            </select>
          </div>
          </div>
          <div>
          <SettingsLabel help="İlk çalışan yanıt vermezse sistem bu sırayı takip eder. Başka şirketin çalışanı seçilemez.">
            Çalışan eskalasyon sırası
          </SettingsLabel>
          <select
            className={settingsInputClass}
            value=""
            onChange={(event) => {
              if (event.target.value) patch('escalationMemberIds', [...value.escalationMemberIds, event.target.value]);
            }}
          >
            <option value="">Çalışan ekle…</option>
            {availableMembers.map((member) => (
              <option key={member.id} value={member.id} disabled={!member.canReceiveWhatsAppTasks}>
                {member.name} · {member.phoneVerified ? 'telefon doğrulandı' : 'telefon doğrulanmadı'}
              </option>
            ))}
          </select>
          <ol className="mt-3 space-y-2">
            {value.escalationMemberIds.map((memberId, index) => {
              const member = members.find((candidate) => candidate.id === memberId);
              return (
                <li key={memberId} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-xs font-bold text-cyan-300">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-100">{member?.name ?? 'Kaldırılmış çalışan'}</span>
                    <span className="block text-xs text-slate-500">{member?.phoneVerified ? 'Telefon doğrulandı' : 'Telefon doğrulaması bekleniyor'}</span>
                  </span>
                  <button type="button" aria-label="Yukarı taşı" disabled={index === 0} onClick={() => { const next = [...value.escalationMemberIds]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; patch('escalationMemberIds', next); }} className="rounded-md p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowUp className="size-4" /></button>
                  <button type="button" aria-label="Aşağı taşı" disabled={index === value.escalationMemberIds.length - 1} onClick={() => { const next = [...value.escalationMemberIds]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; patch('escalationMemberIds', next); }} className="rounded-md p-2 text-slate-400 hover:bg-slate-800 disabled:opacity-30"><ArrowDown className="size-4" /></button>
                  <button type="button" aria-label="Sıradan kaldır" onClick={() => patch('escalationMemberIds', value.escalationMemberIds.filter((id) => id !== memberId))} className="rounded-md p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="size-4" /></button>
                </li>
              );
            })}
          </ol>
          {value.escalationMemberIds.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-700 p-5 text-center text-sm text-slate-500">Henüz bir çalışan sırası seçilmedi.</div>
          ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Toggle checked={value.notifications.criticalImmediately} label="Kritik durumlar" help="Sistem, bağlantı ve çalışan devri gibi kritik sorunları hemen bildirir." onChange={(next) => patch('notifications', { ...value.notifications, criticalImmediately: next })} />
        <Toggle checked={value.notifications.hotLead} label="Sıcak müşteri" help="Yüksek niyetli müşteri patronun önemli bildirimlerine düşer." onChange={(next) => patch('notifications', { ...value.notifications, hotLead: next })} />
        <Toggle checked={value.notifications.authorization} label="Satış yetkisi" help="Satış yetkisi alındığında veya reddedildiğinde patron bilgilendirilir." onChange={(next) => patch('notifications', { ...value.notifications, authorization: next })} />
        <Toggle checked={value.notifications.appointment} label="Randevular" help="Yeni, değişen veya riskli randevular patrona bildirilir." onChange={(next) => patch('notifications', { ...value.notifications, appointment: next })} />
        <Toggle checked={value.notifications.systemError} label="Sistem hataları" help="İş akışını durduran teknik sorunlar bildirilir; gizli bilgi gönderilmez." onChange={(next) => patch('notifications', { ...value.notifications, systemError: next })} />
        <Toggle checked={value.notifications.taskFailure} label="Görev aksaması" help="Çalışan yanıt vermediğinde veya görev başarısız olduğunda bildirilir." onChange={(next) => patch('notifications', { ...value.notifications, taskFailure: next })} />
        <Toggle checked={value.notifications.morningSummary} label="Sabah özeti" help="Günün öncelikleri çalışma saatleri başladığında hazırlanır." onChange={(next) => patch('notifications', { ...value.notifications, morningSummary: next })} />
        <Toggle checked={value.notifications.eveningSummary} label="Akşam özeti" help="Tamamlanan ve geciken işlerin kısa özeti hazırlanır." onChange={(next) => patch('notifications', { ...value.notifications, eveningSummary: next })} />
        <Toggle checked={value.notifications.quietHoursEnabled} label="Sessiz saatler" help="Acil olmayan bildirimler seçilen zaman aralığında bekletilir." onChange={(next) => patch('notifications', { ...value.notifications, quietHoursEnabled: next })} />
        {value.notifications.quietHoursEnabled ? (
          <div className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 md:col-span-2 md:grid-cols-2 xl:col-span-3">
            <div><SettingsLabel help="Acil olmayan bildirimlerin duracağı saat.">Başlangıç</SettingsLabel><input className={settingsInputClass} type="time" value={value.notifications.quietHoursStart} onChange={(event) => patch('notifications', { ...value.notifications, quietHoursStart: event.target.value })} /></div>
            <div><SettingsLabel help="Bekleyen bildirimlerin yeniden gönderilebileceği saat.">Bitiş</SettingsLabel><input className={settingsInputClass} type="time" value={value.notifications.quietHoursEnd} onChange={(event) => patch('notifications', { ...value.notifications, quietHoursEnd: event.target.value })} /></div>
          </div>
        ) : null}
      </div>
    );
  }

  if (step === 6) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Toggle checked={value.aiPermissions.automaticEmployeeAssignment} label="Otomatik çalışan önerisi" help="AI uygun çalışanı seçer; şirket dışından birini hiçbir zaman kullanmaz." onChange={(next) => patch('aiPermissions', { ...value.aiPermissions, automaticEmployeeAssignment: next })} />
        <Toggle checked={value.aiPermissions.automaticEmployeeWhatsApp} label="Çalışan WhatsApp görevleri" help="Yalnız bağlı şirket hattı ve kalıcı outbox üzerinden görev mesajı kuyruğa alınır." onChange={(next) => patch('aiPermissions', { ...value.aiPermissions, automaticEmployeeWhatsApp: next })} />
        <Toggle checked={value.aiPermissions.customerAutoReply} label="Müşteri temel yanıtları" help="AI temel portföy sorularını yanıtlar; insan devrinde gereksiz mesajı bırakır." onChange={(next) => patch('aiPermissions', { ...value.aiPermissions, customerAutoReply: next })} />
        <Toggle checked={value.aiPermissions.salesAuthorityOutreach} label="Satış yetkisi görüşmesi" help="Yalnız iletişim izni ve insan onayı bulunan kayıtlarda görüşme akışını başlatır." onChange={(next) => patch('aiPermissions', { ...value.aiPermissions, salesAuthorityOutreach: next })} />
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm leading-6 text-cyan-100/80 md:col-span-2">
          Bu izinler otomasyon sınırlarını belirler. Hiçbir API anahtarı, şifre veya gizli sağlayıcı ayarı müşteriden istenmez.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Şirket</p><p className="mt-2 font-semibold text-white">{value.company.name}</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">İlk dönüş</p><p className="mt-2 font-semibold text-white">{value.operations.customerResponseMinutes} dakika</p></div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Çalışan sırası</p><p className="mt-2 font-semibold text-white">{value.escalationMemberIds.length} çalışan</p></div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/5 p-5">
        <input
          type="checkbox"
          checked={value.dataProcessing.accepted}
          onChange={(event) => patch('dataProcessing', { ...value.dataProcessing, accepted: event.target.checked })}
          className="mt-1 size-4 accent-cyan-400"
        />
        <span>
          <span className="flex items-center gap-2 font-semibold text-white"><UserRoundCheck className="size-5 text-cyan-300" /> Veri işleme bilgilendirmesini okudum</span>
          <span className="mt-1 block text-sm leading-6 text-slate-400">Şirket, çalışan ve müşteri verilerinin seçilen operasyonları yürütmek için şirket hesabı sınırları içinde işlendiğini anlıyorum. Bu kayıt zaman damgasıyla saklanır ve Ayarlar bölümünden değiştirilebilir.</span>
        </span>
      </label>
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm leading-6 text-emerald-100/80">Kurulum tamamlandıktan sonra tüm seçimler “Şirket Ayarlarınız” sayfasından değiştirilebilir.</div>
    </div>
  );
}
