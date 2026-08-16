'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ClipboardCopy,
  Files,
  History,
  Landmark,
  ListChecks,
  Save,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DEED_APPLICATION_STATUSES,
  DEED_PAYMENT_STATUSES,
  deedApplicationStatusLabels,
  deedClosingSummary,
  deedOperationalSummary,
  deedPaymentStatusLabels,
  deedWorkflowChecks,
  nextDeedAction,
  requiredDeedWorkflowChecks,
  type DeedWorkflow,
} from '@/lib/deed-workflow';

import {
  deedChecklistSummary,
  deedStatusLabels,
  deedTypeLabels,
  formatDeedDate,
  nextDeedStatuses,
} from './format';
import { DEED_OPERATION_STAGES, getDeedProcessGuide } from './process-catalog';
import type {
  DeedCase,
  DeedCaseDraft,
  DeedCaseStatus,
  DeedWorkspace,
} from './types';

const inputClass =
  'min-h-11 border-[#28475b] bg-[#06131f] text-[#f4f8fa] placeholder:text-[#718797] focus-visible:border-cyan-300 focus-visible:ring-cyan-300/20';

type DetailSection = 'focus' | 'documents' | 'official' | 'closing';

const statusStageIndex: Record<DeedCaseStatus, number> = {
  DRAFT: 0,
  PREPARING: 2,
  DOCUMENTS_MISSING: 2,
  READY_FOR_APPOINTMENT: 4,
  APPOINTMENT_SCHEDULED: 5,
  COMPLETED: 6,
  CANCELLED: 0,
};

function WorkflowToggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
        checked
          ? 'border-emerald-300/30 bg-emerald-300/10'
          : 'border-[#28475b] bg-[#06131f] hover:border-cyan-300/30'
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 size-4 accent-emerald-300"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong className="block text-sm text-[#e8f1f4]">{label}</strong>
        <small className="mt-1 block leading-5 text-[#8da5b4]">{description}</small>
      </span>
    </label>
  );
}

function updateWorkflow(
  draft: DeedCaseDraft,
  key: keyof DeedWorkflow,
  value: DeedWorkflow[keyof DeedWorkflow]
) {
  return {
    ...draft,
    workflow: { ...draft.workflow, [key]: value },
  };
}

function customerMessage(deedCase: DeedCase, draft: DeedCaseDraft) {
  const missing = draft.checklist.filter(
    (item) => item.required && !item.completed
  );
  const greeting = deedCase.contact?.name
    ? `Merhaba ${deedCase.contact.name},`
    : 'Merhaba,';
  if (missing.length) {
    return `${greeting}\n\nTapu işleminizin devam edebilmesi için şu belgeleri bekliyoruz:\n${missing
      .map((item) => `• ${item.label}`)
      .join('\n')}\n\nBelgeleri güvenli kanal üzerinden iletmenizi rica ederiz. E-Devlet veya Web Tapu şifrenizi paylaşmayınız.`;
  }
  if (draft.appointmentAt) {
    return `${greeting}\n\nTapu işleminiz için planlanan randevu: ${formatDeedDate(
      new Date(draft.appointmentAt).toISOString()
    )}. Kimlik aslınızla hazır bulunmanızı rica ederiz. E-Devlet veya Web Tapu şifrenizi paylaşmayınız.`;
  }
  return `${greeting}\n\nTapu işlem dosyanız hazırlanıyor. Resmî başvuru veya randevu bilgisi oluştuğunda sizinle paylaşacağız. E-Devlet veya Web Tapu şifrenizi paylaşmayınız.`;
}

export default function DeedCaseOperationsDialog({
  deedCase,
  draft,
  isOwner,
  members,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  deedCase: DeedCase;
  draft: DeedCaseDraft;
  isOwner: boolean;
  members: DeedWorkspace['members'];
  saving: boolean;
  onChange: (draft: DeedCaseDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [section, setSection] = useState<DetailSection>('focus');
  const checklist = deedChecklistSummary(draft.checklist);
  const operations = deedOperationalSummary(deedCase.type, draft.workflow);
  const closing = deedClosingSummary(draft.workflow, deedCase.type);
  const requiredChecks = new Set(requiredDeedWorkflowChecks(deedCase.type));
  const guide = getDeedProcessGuide(deedCase.guideId);
  const currentStage = statusStageIndex[draft.status];
  const action = useMemo(
    () =>
      nextDeedAction({
        type: deedCase.type,
        status: draft.status,
        checklist: draft.checklist,
        workflow: draft.workflow,
        appointmentAt: draft.appointmentAt
          ? new Date(draft.appointmentAt).toISOString()
          : null,
      }),
    [deedCase.type, draft]
  );
  const allowedStatuses = [
    deedCase.status,
    ...nextDeedStatuses[deedCase.status],
  ];
  const readinessBlocked =
    checklist.missingRequired > 0 || operations.missing.length > 0;
  const completionBlocked = readinessBlocked || closing.missing.length > 0;

  const tabs: Array<{
    id: DetailSection;
    label: string;
    icon: typeof ListChecks;
    badge?: number;
  }> = [
    { id: 'focus', label: 'Sıradaki iş', icon: ListChecks },
    {
      id: 'documents',
      label: 'Evraklar',
      icon: Files,
      badge: checklist.missingRequired,
    },
    { id: 'official', label: 'Resmî süreç', icon: Landmark },
    {
      id: 'closing',
      label: 'Kapanış',
      icon: BadgeCheck,
      badge: closing.total - closing.completed,
    },
  ];

  async function copyCustomerMessage() {
    try {
      await navigator.clipboard.writeText(customerMessage(deedCase, draft));
      toast.success('Müşteri mesajı kopyalandı.');
    } catch {
      toast.error('Mesaj kopyalanamadı. Tarayıcı iznini kontrol edin.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-hidden border border-[#28475b] bg-[#081622] p-0 text-[#f4f8fa] sm:max-w-6xl">
        <DialogHeader className="border-b border-[#28475b] px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
              {deedTypeLabels[deedCase.type]}
            </span>
            {guide ? (
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 text-[11px] text-emerald-100">
                {guide.shortTitle}
              </span>
            ) : null}
            <span className="text-xs text-[#8da5b4]">Sürüm {deedCase.version}</span>
          </div>
          <DialogTitle className="mt-2 text-xl">{deedCase.title}</DialogTitle>
          <DialogDescription className="text-[#9bb0be]">
            {deedCase.property?.referenceCode || 'Portföy bağlanmadı'} ·{' '}
            {deedStatusLabels[draft.status]}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-[#28475b] bg-[#06131f] px-5 py-3">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Tapu işlem aşamaları">
            {DEED_OPERATION_STAGES.map((stage, index) => (
              <div
                className={`rounded-lg border px-3 py-2 ${
                  index < currentStage
                    ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                    : index === currentStage
                      ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100'
                      : 'border-[#1c3547] bg-[#081622] text-[#718797]'
                }`}
                key={stage.id}
              >
                <span className="text-[10px] font-bold">{stage.number}</span>
                <p className="mt-1 text-xs font-semibold">{stage.title}</p>
              </div>
            ))}
          </div>
        </div>

        <nav
          className="grid grid-cols-2 gap-2 border-b border-[#28475b] bg-[#081622] px-5 py-3 lg:grid-cols-4"
          aria-label="Tapu dosyası çalışma alanları"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors ${
                section === tab.id
                  ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100'
                  : 'border-transparent text-[#8da5b4] hover:border-[#28475b] hover:text-[#dce8ed]'
              }`}
              aria-current={section === tab.id ? 'page' : undefined}
              onClick={() => setSection(tab.id)}
            >
              <tab.icon className="size-4" aria-hidden="true" />
              {tab.label}
              {tab.badge ? (
                <span className="rounded-full bg-rose-300/15 px-2 py-0.5 text-xs text-rose-200">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {section === 'focus' ? (
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-5">
                <section
                  className={`rounded-2xl border p-4 ${
                    action.tone === 'danger'
                      ? 'border-rose-300/30 bg-rose-300/10'
                      : action.tone === 'warning'
                        ? 'border-amber-300/30 bg-amber-300/10'
                        : action.tone === 'success'
                          ? 'border-emerald-300/30 bg-emerald-300/10'
                          : 'border-cyan-300/30 bg-cyan-300/10'
                  }`}
                  aria-labelledby="next-action-title"
                >
                  <p className="text-xs font-bold tracking-[0.16em] text-[#9bb0be]">ŞİMDİ BUNU YAPIN</p>
                  <h3 id="next-action-title" className="mt-2 text-lg font-semibold">
                    {action.title}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[#b8c8d1]">
                    {action.detail}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 min-h-11 border-[#416276] bg-[#06131f] text-[#dce8ed] hover:bg-[#0b2030]"
                    onClick={() => void copyCustomerMessage()}
                  >
                    <ClipboardCopy aria-hidden="true" /> Müşteri mesajını kopyala
                  </Button>
                </section>

                <section aria-labelledby="controls-title">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h3 id="controls-title" className="font-semibold">Temel dosya kontrolleri</h3>
                      <p className="mt-1 text-sm text-[#8da5b4]">Yalnız resmî kaynaktan veya asıl belgeden doğruladığınızı işaretleyin.</p>
                    </div>
                    <span className="rounded-full border border-[#28475b] px-2.5 py-1 text-xs text-[#9bb0be]">
                      {operations.completed}/{operations.total}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {deedWorkflowChecks
                      .filter((item) => requiredChecks.has(item.key))
                      .map((item) => (
                        <WorkflowToggle
                          key={item.key}
                          checked={draft.workflow[item.key]}
                          label={item.label}
                          description={item.description}
                          onChange={(checked) =>
                            onChange(updateWorkflow(draft, item.key, checked))
                          }
                        />
                      ))}
                  </div>
                </section>
              </div>

              <aside className="space-y-4 rounded-2xl border border-[#28475b] bg-[#06131f] p-4">
                <div>
                  <h3 className="font-semibold">Dosya yönetimi</h3>
                  <p className="mt-1 text-xs leading-5 text-[#8da5b4]">Sorumlu, tarih ve süreci tek yerden güncelleyin.</p>
                </div>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Süreç durumu</span>
                  <select
                    className={`${inputClass} w-full rounded-lg px-3`}
                    value={draft.status}
                    disabled={allowedStatuses.length <= 1}
                    onChange={(event) =>
                      onChange({ ...draft, status: event.target.value as DeedCaseStatus })
                    }
                  >
                    {allowedStatuses.map((status) => (
                      <option
                        key={status}
                        value={status}
                        disabled={
                          (['READY_FOR_APPOINTMENT', 'APPOINTMENT_SCHEDULED'].includes(status) && readinessBlocked) ||
                          (status === 'COMPLETED' && completionBlocked)
                        }
                      >
                        {deedStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                  {readinessBlocked ? (
                    <small className="mt-1.5 block text-amber-200/80">Hazır aşaması için temel kontroller ve zorunlu evraklar tamamlanmalı.</small>
                  ) : null}
                </label>
                {isOwner ? (
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Sorumlu çalışan</span>
                    <select
                      className={`${inputClass} w-full rounded-lg px-3`}
                      value={draft.assignedMemberId}
                      onChange={(event) => onChange({ ...draft, assignedMemberId: event.target.value })}
                    >
                      <option value="">Atanmamış</option>
                      {members.filter((member) => member.active).map((member) => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Son tarih</span>
                  <Input className={inputClass} type="datetime-local" value={draft.dueAt} onChange={(event) => onChange({ ...draft, dueAt: event.target.value })} />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Tapu randevusu</span>
                  <Input className={inputClass} type="datetime-local" value={draft.appointmentAt} onChange={(event) => onChange({ ...draft, appointmentAt: event.target.value })} />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Ekip notu</span>
                  <Textarea className={`${inputClass} min-h-24`} maxLength={5000} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} placeholder="Eksik evrak, aranan kişi veya sıradaki adım…" />
                </label>
              </aside>
            </div>
          ) : null}

          {section === 'documents' ? (
            <section aria-labelledby="checklist-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 id="checklist-title" className="text-lg font-semibold">İşleme özel evrak listesi</h3>
                  <p className="mt-1 text-sm text-[#8da5b4]">
                    {guide ? `${guide.title} rehberinden oluşturuldu.` : 'Temel işlem türüne göre oluşturuldu.'} Belgeyi yalnız teslim alıp doğruladıktan sonra işaretleyin.
                  </p>
                </div>
                <span className="rounded-full border border-[#28475b] px-3 py-1.5 text-sm text-[#9bb0be]">
                  {checklist.completed}/{checklist.total} tamam
                </span>
              </div>
              {checklist.missingRequired > 0 ? (
                <div role="alert" className="mt-4 flex gap-2 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {checklist.missingRequired} zorunlu evrak bekleniyor. Dosya randevuya hazır durumuna alınamaz.
                </div>
              ) : (
                <div className="mt-4 flex gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  Zorunlu evrakların tamamı işaretlendi. Asıl belge ve resmî kaynak kontrolünü unutmayın.
                </div>
              )}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {draft.checklist.map((item, index) => (
                  <WorkflowToggle
                    key={item.key}
                    checked={item.completed}
                    label={item.label}
                    description={item.required ? 'Zorunlu belge' : 'Gerektiğinde alınacak belge'}
                    onChange={(completed) =>
                      onChange({
                        ...draft,
                        checklist: draft.checklist.map((current, currentIndex) =>
                          currentIndex === index ? { ...current, completed } : current
                        ),
                      })
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}

          {section === 'official' ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="space-y-4 rounded-2xl border border-[#28475b] bg-[#06131f] p-4" aria-labelledby="application-title">
                <div className="flex gap-3">
                  <Landmark className="mt-0.5 size-5 text-cyan-200" aria-hidden="true" />
                  <div>
                    <h3 id="application-title" className="font-semibold">Web Tapu ve müdürlük takibi</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8da5b4]">Panel başvuru yapmaz; tarafın paylaştığı resmî referansları kaydeder.</p>
                  </div>
                </div>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Başvuru durumu</span>
                  <select className={`${inputClass} w-full rounded-lg px-3`} value={draft.workflow.applicationStatus} onChange={(event) => onChange(updateWorkflow(draft, 'applicationStatus', event.target.value))}>
                    {DEED_APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{deedApplicationStatusLabels[status]}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Web Tapu başvuru numarası</span>
                  <Input className={inputClass} maxLength={80} value={draft.workflow.applicationNumber} onChange={(event) => onChange(updateWorkflow(draft, 'applicationNumber', event.target.value))} placeholder="Tarafın paylaştığı resmî numara" />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">E-tahsilat numarası</span>
                  <Input className={inputClass} inputMode="numeric" maxLength={32} value={draft.workflow.eCollectionNumber} onChange={(event) => onChange(updateWorkflow(draft, 'eCollectionNumber', event.target.value))} placeholder="SMS ile gelen 12–13 haneli numara" />
                </label>
                <WorkflowToggle checked={draft.workflow.appointmentConfirmed} label="Randevu taraflarla teyit edildi" description="Tarih, saat, müdürlük ve hazır bulunacak kişiler doğrulandı." onChange={(checked) => onChange(updateWorkflow(draft, 'appointmentConfirmed', checked))} />
              </section>

              <section className="space-y-4 rounded-2xl border border-[#28475b] bg-[#06131f] p-4" aria-labelledby="payment-title">
                <div className="flex gap-3">
                  <WalletCards className="mt-0.5 size-5 text-amber-200" aria-hidden="true" />
                  <div>
                    <h3 id="payment-title" className="font-semibold">Bedel, harç ve güvenli ödeme</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8da5b4]">Tutarları hesaplamak yerine taraf ve resmî bildirim kayıtlarını karşılaştırır.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Beyan edilen değer</span>
                    <Input className={inputClass} inputMode="decimal" maxLength={40} value={draft.workflow.declaredValue} onChange={(event) => onChange(updateWorkflow(draft, 'declaredValue', event.target.value))} placeholder="₺" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Belediye değeri</span>
                    <Input className={inputClass} inputMode="decimal" maxLength={40} value={draft.workflow.municipalValue} onChange={(event) => onChange(updateWorkflow(draft, 'municipalValue', event.target.value))} placeholder="₺" />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Tapu harcı</span>
                    <select className={`${inputClass} w-full rounded-lg px-3`} value={draft.workflow.deedFeeStatus} onChange={(event) => onChange(updateWorkflow(draft, 'deedFeeStatus', event.target.value))}>
                      {DEED_PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{deedPaymentStatusLabels[status]}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Döner sermaye</span>
                    <select className={`${inputClass} w-full rounded-lg px-3`} value={draft.workflow.revolvingFundStatus} onChange={(event) => onChange(updateWorkflow(draft, 'revolvingFundStatus', event.target.value))}>
                      {DEED_PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{deedPaymentStatusLabels[status]}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Ödeme sahibi / hesap adı</span>
                  <Input className={inputClass} maxLength={160} value={draft.workflow.paymentOwner} onChange={(event) => onChange(updateWorkflow(draft, 'paymentOwner', event.target.value))} />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Güvenli ödeme</span>
                    <select className={`${inputClass} w-full rounded-lg px-3`} value={draft.workflow.securePaymentStatus} onChange={(event) => onChange(updateWorkflow(draft, 'securePaymentStatus', event.target.value))}>
                      {DEED_PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{deedPaymentStatusLabels[status]}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Güvenli ödeme referansı</span>
                    <Input className={inputClass} maxLength={80} value={draft.workflow.securePaymentReference} onChange={(event) => onChange(updateWorkflow(draft, 'securePaymentReference', event.target.value))} />
                  </label>
                </div>
              </section>

              <section className="space-y-4 rounded-2xl border border-[#28475b] bg-[#06131f] p-4 lg:col-span-2" aria-labelledby="policy-title">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-5 text-emerald-200" aria-hidden="true" />
                  <div>
                    <h3 id="policy-title" className="font-semibold">DASK kayıt bilgisi</h3>
                    <p className="mt-1 text-xs leading-5 text-[#8da5b4]">Poliçeyi panel doğrulamaz; görülen resmî/poliçe bilgisi dosyaya kaydedilir.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Poliçe numarası</span>
                    <Input className={inputClass} maxLength={80} value={draft.workflow.daskPolicyNumber} onChange={(event) => onChange(updateWorkflow(draft, 'daskPolicyNumber', event.target.value))} />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Geçerlilik sonu</span>
                    <Input className={inputClass} type="date" value={draft.workflow.daskExpiresAt} onChange={(event) => onChange(updateWorkflow(draft, 'daskExpiresAt', event.target.value))} />
                  </label>
                </div>
              </section>
            </div>
          ) : null}

          {section === 'closing' ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
              <section aria-labelledby="closing-title">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h3 id="closing-title" className="text-lg font-semibold">İmza ve işlem sonrası kapanış</h3>
                    <p className="mt-1 text-sm text-[#8da5b4]">Dosya ancak tescil sonucu ve teslimler doğrulandıktan sonra tamamlanabilir.</p>
                  </div>
                  <span className="rounded-full border border-[#28475b] px-3 py-1.5 text-sm text-[#9bb0be]">{closing.completed}/{closing.total}</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    ['appointmentConfirmed', 'Randevu teyit edildi', 'Müdürlük, saat ve taraflar kesinleştirildi.'],
                    ['signaturesCompleted', 'İmzalar tamamlandı', 'Resmî imza aşamasının sonucu taraflardan teyit edildi.'],
                    ['registrationVerified', 'Tescil doğrulandı', 'Yeni malik/pay ve takyidat resmî kayıttan kontrol edildi.'],
                    ['deedDocumentReceived', 'Yeni tapu belgesi alındı', 'QR kodlu veya resmî tapu belgesi dosyaya işlendi.'],
                    ['clientInformed', 'Müşteri bilgilendirildi', 'İşlem sonucu ve sonraki yükümlülükler açıklandı.'],
                    ['originalsReturned', 'Asıl evraklar iade edildi', 'Teslim alınan asıl belgeler tutanakla geri verildi.'],
                  ].map(([key, label, description]) => (
                    <WorkflowToggle
                      key={key}
                      checked={draft.workflow[key as keyof DeedWorkflow] as boolean}
                      label={label}
                      description={description}
                      onChange={(checked) => onChange(updateWorkflow(draft, key as keyof DeedWorkflow, checked))}
                    />
                  ))}
                </div>
                {(deedCase.type === 'SALE' || deedCase.type === 'PURCHASE') ? (
                  <div className="mt-2">
                    <WorkflowToggle checked={draft.workflow.keyDelivered} label="Anahtar / taşınmaz teslimi tamamlandı" description="Teslim tarihi, sayaçlar ve erişim araçları tutanakla kaydedildi." onChange={(checked) => onChange(updateWorkflow(draft, 'keyDelivered', checked))} />
                  </div>
                ) : null}
              </section>

              <aside className="space-y-5 rounded-2xl border border-[#28475b] bg-[#06131f] p-4" aria-labelledby="timeline-title">
                <section>
                  <h3 className="font-semibold">Dosya özeti</h3>
                  <dl className="mt-3 grid gap-3 text-sm">
                    <div className="rounded-lg border border-[#1c3547] bg-[#081622] p-3"><dt className="text-xs text-[#718797]">Müşteri</dt><dd className="mt-1 text-[#dce8ed]">{deedCase.contact?.name || 'Bağlanmadı'}</dd></div>
                    <div className="rounded-lg border border-[#1c3547] bg-[#081622] p-3"><dt className="text-xs text-[#718797]">Portföy</dt><dd className="mt-1 text-[#dce8ed]">{deedCase.property?.title || 'Bağlanmadı'}</dd></div>
                    <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3"><dt className="text-xs text-amber-200/70">Resmî entegrasyon</dt><dd className="mt-1 text-sm text-amber-100">Bağlı değil · referansla takip</dd></div>
                  </dl>
                </section>
                <section aria-labelledby="timeline-title">
                  <h3 id="timeline-title" className="flex items-center gap-2 font-semibold"><History className="size-4 text-cyan-200" aria-hidden="true" /> Süreç geçmişi</h3>
                  {deedCase.events.length ? (
                    <ol className="mt-4 space-y-4 border-l border-[#28475b] pl-4">
                      {deedCase.events.map((event) => (
                        <li className="relative" key={event.id}>
                          <span className="absolute -left-[1.21rem] top-1.5 size-2 rounded-full bg-cyan-300" aria-hidden="true" />
                          <p className="text-sm leading-5 text-[#dce8ed]">{event.message}</p>
                          <time className="mt-1 block text-xs text-[#718797]">{formatDeedDate(event.createdAt)}</time>
                        </li>
                      ))}
                    </ol>
                  ) : <p className="mt-3 text-sm text-[#718797]">Henüz süreç kaydı yok.</p>}
                </section>
              </aside>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-[#28475b] bg-[#081622]">
          <Button type="button" variant="ghost" className="min-h-11 text-[#9bb0be]" onClick={onClose}>Kapat</Button>
          <Button type="button" className="min-h-11 bg-emerald-300 text-[#031510] hover:bg-emerald-200" disabled={saving} onClick={onSave}>
            <Save aria-hidden="true" /> {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
