'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  FileCheck2,
  FilePlus2,
  FileText,
  History,
  Landmark,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import EmptyState from '@/components/fabrika/EmptyState';
import PageHeader from '@/components/fabrika/PageHeader';
import { useFabrikaSession } from '@/components/fabrika/FabrikaSessionContext';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import {
  deedCaseDraft,
  deedChecklistSummary,
  deedStatusLabels,
  deedTypeLabels,
  formatDeedDate,
  nextDeedStatuses,
  toIsoOrNull,
} from './format';
import type {
  DeedCase,
  DeedCaseDraft,
  DeedCaseStatus,
  DeedCaseType,
  DeedWorkspace,
} from './types';

const inputClass =
  'min-h-11 border-[#1d3850] bg-[#071421] text-[#f3f8fc] placeholder:text-[#71869b] focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20';

const EMPTY_WORKSPACE: DeedWorkspace = { properties: [], contacts: [], members: [] };

type CreateForm = {
  title: string;
  type: DeedCaseType;
  propertyId: string;
  contactId: string;
  assignedMemberId: string;
  appointmentAt: string;
  dueAt: string;
  notes: string;
};

const EMPTY_CREATE_FORM: CreateForm = {
  title: '',
  type: 'SALE',
  propertyId: '',
  contactId: '',
  assignedMemberId: '',
  appointmentAt: '',
  dueAt: '',
  notes: '',
};

function statusTone(status: DeedCaseStatus) {
  if (status === 'COMPLETED') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
  if (status === 'DOCUMENTS_MISSING' || status === 'CANCELLED') return 'border-rose-400/25 bg-rose-400/10 text-rose-200';
  if (status === 'READY_FOR_APPOINTMENT' || status === 'APPOINTMENT_SCHEDULED') return 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100';
  return 'border-amber-400/25 bg-amber-400/10 text-amber-100';
}

function LoadingCases() {
  return (
    <div className="grid gap-4 lg:grid-cols-2" aria-label="Tapu takip dosyaları yükleniyor">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-xl border border-[#1d3850] bg-[#091727] p-4">
          <Skeleton className="h-5 w-2/3 bg-[#132a3e]" />
          <Skeleton className="mt-3 h-4 w-1/2 bg-[#132a3e]" />
          <Skeleton className="mt-5 h-2 w-full bg-[#132a3e]" />
          <Skeleton className="mt-5 h-9 w-32 bg-[#132a3e]" />
        </div>
      ))}
    </div>
  );
}

function DeedCaseCard({ deedCase, onOpen }: { deedCase: DeedCase; onOpen: (item: DeedCase) => void }) {
  const summary = deedChecklistSummary(deedCase.checklist);
  const progress = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
  return (
    <article className="rounded-xl border border-[#1d3850] bg-[#091727] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.13)] transition-colors hover:border-cyan-300/35">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusTone(deedCase.status)}`}>{deedStatusLabels[deedCase.status]}</span>
            <span className="text-xs text-[#71869b]">{deedTypeLabels[deedCase.type]}</span>
          </div>
          <h2 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-[#f3f8fc]">{deedCase.title}</h2>
          <p className="mt-1 text-xs text-[#8ea3b8]">{deedCase.property ? `${deedCase.property.referenceCode} · ${deedCase.property.title}` : 'Portföy bağlanmadı'}</p>
        </div>
        {summary.missingRequired > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-rose-300/25 bg-rose-300/10 px-2 py-1 text-xs text-rose-100">
            <AlertTriangle className="size-3.5" aria-hidden="true" /> {summary.missingRequired} eksik zorunlu belge
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-[#8ea3b8]">
          <span>Evrak ilerlemesi</span>
          <span>{summary.completed}/{summary.total}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#071421]" role="progressbar" aria-label={`${deedCase.title} evrak ilerlemesi`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-cyan-300 transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg border border-[#142c41] bg-[#071421] p-2.5">
          <dt className="text-[#71869b]">Sorumlu</dt>
          <dd className="mt-1 font-medium text-[#dce8f0]">{deedCase.assignedMember?.name || 'Atanmadı'}</dd>
        </div>
        <div className="rounded-lg border border-[#142c41] bg-[#071421] p-2.5">
          <dt className="text-[#71869b]">Son tarih</dt>
          <dd className="mt-1 font-medium text-[#dce8f0]">{formatDeedDate(deedCase.dueAt)}</dd>
        </div>
      </dl>
      <Button type="button" variant="outline" className="mt-4 min-h-10 w-full border-[#1d3850] bg-[#071421] text-[#f3f8fc] hover:bg-[#0d2034]" onClick={() => onOpen(deedCase)}>
        Dosyayı aç <ArrowRight aria-hidden="true" />
      </Button>
    </article>
  );
}

export function DeedTrackingView({
  cases,
  error,
  loading,
  onCreate,
  onOpen,
  onRefresh,
}: {
  cases: DeedCase[];
  error: string | null;
  loading: boolean;
  onCreate: () => void;
  onOpen: (item: DeedCase) => void;
  onRefresh: () => void;
}) {
  const completed = cases.filter((item) => item.status === 'COMPLETED').length;
  const missing = cases.filter((item) => deedChecklistSummary(item.checklist).missingRequired > 0 && !['COMPLETED', 'CANCELLED'].includes(item.status)).length;
  const appointments = cases.filter((item) => item.status === 'APPOINTMENT_SCHEDULED').length;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="AI Tapu Takip"
        title="Belge ve tapu işlemlerini adım adım yönetin"
        description="İşleme özel evrak listesini, sorumluyu, randevuyu ve son tarihi tek yerde takip edin. Resmî işlem ve hukuki kararlar insan onayıyla tamamlanır."
        icon={Landmark}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-10 border-[#1d3850] bg-[#091727] text-[#f3f8fc] hover:bg-[#0d2034]" onClick={onRefresh} disabled={loading}>
              <RefreshCcw className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Yenile
            </Button>
            <Button type="button" className="min-h-10 bg-cyan-300 text-[#03111c] hover:bg-cyan-200" onClick={onCreate}>
              <FilePlus2 aria-hidden="true" /> Yeni takip dosyası
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <div role="note" className="flex gap-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-200" aria-hidden="true" />
          <div>
            <p className="font-semibold text-amber-100">Resmî Tapu sistemi bağlantısı yok</p>
            <p className="mt-1 text-sm leading-6 text-amber-100/75">Bu ekran ekip içi takip ve hazırlık içindir; Web Tapu veya başka bir resmî sisteme işlem göndermez.</p>
          </div>
        </div>
        <div role="note" className="flex gap-3 rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4">
          <FileCheck2 className="mt-0.5 size-5 shrink-0 text-cyan-200" aria-hidden="true" />
          <div>
            <p className="font-semibold text-cyan-100">Hukuki kontrol ve insan onayı gerekir</p>
            <p className="mt-1 text-sm leading-6 text-[#9fb5c7]">Belge listeleri hazırlık desteğidir. İmzadan veya resmî başvurudan önce yetkili uzman kontrolü yapın.</p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-rose-100">Tapu takip verileri alınamadı</p>
            <p className="mt-1 text-sm text-rose-200/80">{error}</p>
          </div>
          <Button type="button" variant="outline" className="border-rose-300/30 text-rose-100" onClick={onRefresh}>
            <RotateCcw aria-hidden="true" /> Yeniden dene
          </Button>
        </div>
      )}

      <Tabs defaultValue="tracking" className="space-y-5">
        <TabsList className="h-auto w-full justify-start rounded-xl border border-[#1d3850] bg-[#071421] p-1 sm:w-fit">
          <TabsTrigger value="documents" className="min-h-10 px-4 text-[#8ea3b8] data-active:text-cyan-100"><FileText aria-hidden="true" /> Belge oluştur</TabsTrigger>
          <TabsTrigger value="tracking" className="min-h-10 px-4 text-[#8ea3b8] data-active:text-cyan-100"><ClipboardCheck aria-hidden="true" /> Tapu takip</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <section className="overflow-hidden rounded-xl border border-[#1d3850] bg-[#091727]">
            <div className="grid gap-8 p-5 lg:grid-cols-[1fr_auto] lg:items-center lg:p-8">
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><FileText className="size-5" aria-hidden="true" /></span>
                <h2 className="mt-4 text-xl font-semibold text-[#f3f8fc]">Mevcut Belge Merkezi’ni kullanın</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8ea3b8]">Yetkilendirme, satış, kiralama, tapu kontrol listesi ve diğer belgeleri şirket, müşteri ve portföy bilgilerinizle hazırlayın.</p>
                <ol className="mt-5 grid gap-2 text-sm text-[#b8cad8] sm:grid-cols-3">
                  <li className="rounded-lg border border-[#142c41] bg-[#071421] p-3"><strong className="block text-cyan-100">1. Şablonu seçin</strong><span className="mt-1 block text-xs text-[#71869b]">İşleme uygun belgeyi bulun.</span></li>
                  <li className="rounded-lg border border-[#142c41] bg-[#071421] p-3"><strong className="block text-cyan-100">2. Bilgileri doldurun</strong><span className="mt-1 block text-xs text-[#71869b]">Şirket ve portföy kaydıyla tamamlayın.</span></li>
                  <li className="rounded-lg border border-[#142c41] bg-[#071421] p-3"><strong className="block text-cyan-100">3. Kontrol edin</strong><span className="mt-1 block text-xs text-[#71869b]">Hukuki incelemeden sonra kullanın.</span></li>
                </ol>
              </div>
              <Button asChild className="min-h-11 bg-cyan-300 px-5 text-[#03111c] hover:bg-cyan-200">
                <Link href="/fabrika/belgeler">Belge Merkezi’ni aç <ArrowRight aria-hidden="true" /></Link>
              </Button>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-5">
          <section className="grid gap-3 sm:grid-cols-3" aria-label="Tapu takip özeti">
            {[
              { label: 'Açık takip dosyası', value: cases.length - completed, icon: ClipboardCheck },
              { label: 'Eksik belgeli', value: missing, icon: AlertTriangle },
              { label: 'Planlı randevu', value: appointments, icon: CalendarClock },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border border-[#1d3850] bg-[#091727] p-4">
                <div className="flex items-center justify-between"><span className="text-xs font-medium text-[#8ea3b8]">{label}</span><Icon className="size-4 text-cyan-200" aria-hidden="true" /></div>
                <strong className="mt-2 block text-2xl font-semibold text-[#f3f8fc]">{value}</strong>
              </div>
            ))}
          </section>
          {loading && cases.length === 0 ? (
            <LoadingCases />
          ) : cases.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {cases.map((deedCase) => <DeedCaseCard key={deedCase.id} deedCase={deedCase} onOpen={onOpen} />)}
            </div>
          ) : (
            <EmptyState icon={ClipboardCheck} title="Henüz tapu takip dosyası yok" description="İşlem türünü seçerek evrak kontrolü, sorumlu çalışan, randevu ve son tarih takibini başlatın." action={<Button type="button" className="bg-cyan-300 text-[#03111c] hover:bg-cyan-200" onClick={onCreate}><FilePlus2 aria-hidden="true" /> İlk dosyayı oluştur</Button>} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CaseDetailDialog({
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
  const summary = deedChecklistSummary(draft.checklist);
  const allowedStatuses = [deedCase.status, ...nextDeedStatuses[deedCase.status]];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-hidden border border-[#1d3850] bg-[#091727] p-0 text-[#f3f8fc] sm:max-w-5xl">
        <DialogHeader className="border-b border-[#1d3850] px-5 py-4 pr-12">
          <DialogTitle className="text-lg">{deedCase.title}</DialogTitle>
          <DialogDescription className="text-[#8ea3b8]">{deedTypeLabels[deedCase.type]} · {deedCase.property?.referenceCode || 'Portföy bağlanmadı'} · Sürüm {deedCase.version}</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-5 border-b border-[#1d3850] p-5 lg:border-b-0 lg:border-r">
            {summary.missingRequired > 0 && (
              <div role="alert" className="flex gap-2 rounded-lg border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Zorunlu {summary.missingRequired} belge tamamlanmadı. Randevuya hazır veya tamamlandı durumuna geçilemez.</div>
            )}
            <section aria-labelledby="checklist-title">
              <div className="flex items-center justify-between"><h3 id="checklist-title" className="font-semibold">Evrak kontrol listesi</h3><span className="text-xs text-[#8ea3b8]">{summary.completed}/{summary.total} tamamlandı</span></div>
              <div className="mt-3 space-y-2">
                {draft.checklist.map((item, index) => (
                  <label key={item.key} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-[#142c41] bg-[#071421] p-3 transition-colors hover:border-cyan-300/25">
                    <input type="checkbox" className="mt-0.5 size-4 accent-cyan-300" checked={item.completed} onChange={(event) => onChange({ ...draft, checklist: draft.checklist.map((current, currentIndex) => currentIndex === index ? { ...current, completed: event.target.checked } : current) })} />
                    <span className="text-sm leading-5 text-[#dce8f0]">{item.label}{item.required && <span className="ml-1 text-rose-300" aria-label="zorunlu">*</span>}</span>
                  </label>
                ))}
              </div>
            </section>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Süreç durumu</span><select className={`${inputClass} w-full rounded-lg px-3`} value={draft.status} disabled={allowedStatuses.length <= 1} onChange={(event) => onChange({ ...draft, status: event.target.value as DeedCaseStatus })}>{allowedStatuses.map((status) => <option key={status} value={status}>{deedStatusLabels[status]}</option>)}</select></label>
              {isOwner && <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Sorumlu çalışan</span><select className={`${inputClass} w-full rounded-lg px-3`} value={draft.assignedMemberId} onChange={(event) => onChange({ ...draft, assignedMemberId: event.target.value })}><option value="">Atanmamış</option>{members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
              <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Tapu randevusu</span><Input className={inputClass} type="datetime-local" value={draft.appointmentAt} onChange={(event) => onChange({ ...draft, appointmentAt: event.target.value })} /></label>
              <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Son tarih</span><Input className={inputClass} type="datetime-local" value={draft.dueAt} onChange={(event) => onChange({ ...draft, dueAt: event.target.value })} /></label>
            </div>
            <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">İç ekip notu</span><Textarea className={`${inputClass} min-h-28`} maxLength={5000} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} placeholder="Eksik evrak, randevu veya takip notunu ekleyin." /></label>
          </div>
          <aside className="space-y-5 bg-[#071421] p-5" aria-labelledby="timeline-title">
            <section>
              <h3 className="font-semibold text-[#f3f8fc]">Dosya özeti</h3>
              <dl className="mt-3 space-y-3 text-sm">
                <div><dt className="text-xs text-[#71869b]">Müşteri</dt><dd className="mt-1 text-[#dce8f0]">{deedCase.contact?.name || 'Bağlanmadı'}</dd></div>
                <div><dt className="text-xs text-[#71869b]">Portföy</dt><dd className="mt-1 text-[#dce8f0]">{deedCase.property?.title || 'Bağlanmadı'}</dd></div>
                <div><dt className="text-xs text-[#71869b]">Resmî entegrasyon</dt><dd className="mt-1 inline-flex rounded-md border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-xs text-amber-100">Bağlı değil</dd></div>
              </dl>
            </section>
            <section aria-labelledby="timeline-title">
              <h3 id="timeline-title" className="flex items-center gap-2 font-semibold text-[#f3f8fc]"><History className="size-4 text-cyan-200" aria-hidden="true" /> Süreç zaman çizelgesi</h3>
              {deedCase.events.length ? <ol className="mt-4 space-y-4 border-l border-[#1d3850] pl-4">{deedCase.events.map((event) => <li key={event.id} className="relative"><span className="absolute -left-[1.21rem] top-1.5 size-2 rounded-full bg-cyan-300" aria-hidden="true" /><p className="text-sm leading-5 text-[#dce8f0]">{event.message}</p><time className="mt-1 block text-xs text-[#71869b]">{formatDeedDate(event.createdAt)}</time></li>)}</ol> : <p className="mt-3 text-sm text-[#71869b]">Henüz süreç kaydı yok.</p>}
            </section>
          </aside>
        </div>
        <DialogFooter className="border-[#1d3850] bg-[#091727]">
          <Button type="button" variant="ghost" className="text-[#8ea3b8]" onClick={onClose}>Kapat</Button>
          <Button type="button" className="bg-cyan-300 text-[#03111c] hover:bg-cyan-200" disabled={saving} onClick={onSave}><Save aria-hidden="true" />{saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DeedTrackingClient() {
  const session = useFabrikaSession();
  const isOwner = session.principalType === 'OWNER';
  const [cases, setCases] = useState<DeedCase[]>([]);
  const [workspace, setWorkspace] = useState<DeedWorkspace>(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [selected, setSelected] = useState<DeedCase | null>(null);
  const [draft, setDraft] = useState<DeedCaseDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const activeMembers = useMemo(() => workspace.members.filter((member) => member.active), [workspace.members]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [caseResponse, workspaceResponse] = await Promise.all([
        fetch('/api/fabrika/deed-tracking', { cache: 'no-store' }),
        fetch('/api/fabrika/workspace', { cache: 'no-store' }),
      ]);
      const [caseBody, workspaceBody] = await Promise.all([caseResponse.json(), workspaceResponse.json()]);
      if (!caseResponse.ok || !caseBody.success) throw new Error(caseBody.error || 'Tapu takip verileri alınamadı.');
      if (!workspaceResponse.ok || !workspaceBody.success) throw new Error(workspaceBody.error || 'Şirket kayıtları alınamadı.');
      setCases(caseBody.cases || []);
      setWorkspace({
        properties: workspaceBody.workspace?.properties || [],
        contacts: workspaceBody.workspace?.contacts || [],
        members: workspaceBody.workspace?.members || [],
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Tapu takip verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/fabrika/deed-tracking', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/fabrika/workspace', { cache: 'no-store', signal: controller.signal }),
    ])
      .then(async ([caseResponse, workspaceResponse]) => {
        const [caseBody, workspaceBody] = await Promise.all([
          caseResponse.json(),
          workspaceResponse.json(),
        ]);
        if (!caseResponse.ok || !caseBody.success) {
          throw new Error(caseBody.error || 'Tapu takip verileri alınamadı.');
        }
        if (!workspaceResponse.ok || !workspaceBody.success) {
          throw new Error(workspaceBody.error || 'Şirket kayıtları alınamadı.');
        }
        return { caseBody, workspaceBody };
      })
      .then(({ caseBody, workspaceBody }) => {
        setCases(caseBody.cases || []);
        setWorkspace({
          properties: workspaceBody.workspace?.properties || [],
          contacts: workspaceBody.workspace?.contacts || [],
          members: workspaceBody.workspace?.members || [],
        });
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Tapu takip verileri alınamadı.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  function openCase(item: DeedCase) {
    setSelected(item);
    setDraft(deedCaseDraft(item));
  }

  async function submitCreate() {
    if (createForm.title.trim().length < 3) {
      toast.error('Dosya adı en az 3 karakter olmalıdır.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/fabrika/deed-tracking', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          type: createForm.type,
          propertyId: createForm.propertyId || null,
          contactId: createForm.contactId || null,
          ...(isOwner ? { assignedMemberId: createForm.assignedMemberId || null } : {}),
          appointmentAt: toIsoOrNull(createForm.appointmentAt),
          dueAt: toIsoOrNull(createForm.dueAt),
          notes: createForm.notes.trim() || null,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Takip dosyası oluşturulamadı.');
      toast.success('Tapu takip dosyası oluşturuldu.');
      setCreateForm(EMPTY_CREATE_FORM);
      setCreateOpen(false);
      await loadData();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Takip dosyası oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  async function saveCase() {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      const response = await fetch('/api/fabrika/deed-tracking', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          version: selected.version,
          status: draft.status,
          checklist: draft.checklist,
          ...(isOwner ? { assignedMemberId: draft.assignedMemberId || null } : {}),
          appointmentAt: toIsoOrNull(draft.appointmentAt),
          dueAt: toIsoOrNull(draft.dueAt),
          notes: draft.notes.trim() || null,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Takip dosyası güncellenemedi.');
      toast.success('Tapu takip dosyası güncellendi.');
      setSelected(null);
      setDraft(null);
      await loadData();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Takip dosyası güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DeedTrackingView cases={cases} error={error} loading={loading} onCreate={() => setCreateOpen(true)} onOpen={openCase} onRefresh={() => void loadData()} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto border border-[#1d3850] bg-[#091727] text-[#f3f8fc] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Yeni tapu takip dosyası</DialogTitle>
            <DialogDescription className="leading-6 text-[#8ea3b8]">İşlem türünü seçtiğinizde sunucu o işleme özel evrak kontrol listesini oluşturur. Bu kayıt resmî başvuru değildir.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Dosya adı</span><Input className={inputClass} required minLength={3} maxLength={160} value={createForm.title} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} placeholder="Örn. P-104 satış tapu takibi" /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">İşlem türü</span><select className={`${inputClass} w-full rounded-lg px-3`} value={createForm.type} onChange={(event) => setCreateForm({ ...createForm, type: event.target.value as DeedCaseType })}>{Object.entries(deedTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Portföy (isteğe bağlı)</span><select className={`${inputClass} w-full rounded-lg px-3`} value={createForm.propertyId} onChange={(event) => setCreateForm({ ...createForm, propertyId: event.target.value })}><option value="">Portföy seçilmedi</option>{workspace.properties.map((property) => <option key={property.id} value={property.id}>{property.referenceCode} · {property.title}</option>)}</select></label>
            <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Müşteri (isteğe bağlı)</span><select className={`${inputClass} w-full rounded-lg px-3`} value={createForm.contactId} onChange={(event) => setCreateForm({ ...createForm, contactId: event.target.value })}><option value="">Müşteri seçilmedi</option>{workspace.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
            {isOwner && <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Sorumlu çalışan</span><select className={`${inputClass} w-full rounded-lg px-3`} value={createForm.assignedMemberId} onChange={(event) => setCreateForm({ ...createForm, assignedMemberId: event.target.value })}><option value="">Daha sonra ata</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>}
            <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Tapu randevusu (isteğe bağlı)</span><Input className={inputClass} type="datetime-local" value={createForm.appointmentAt} onChange={(event) => setCreateForm({ ...createForm, appointmentAt: event.target.value })} /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">Son tarih (isteğe bağlı)</span><Input className={inputClass} type="datetime-local" value={createForm.dueAt} onChange={(event) => setCreateForm({ ...createForm, dueAt: event.target.value })} /></label>
            <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">İç ekip notu (isteğe bağlı)</span><Textarea className={`${inputClass} min-h-28`} maxLength={5000} value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} placeholder="Takip için gerekli kısa notları yazın." /></label>
          </div>
          <div className="flex gap-2 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/80"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Oluşturulan kontrol listesi resmî kurumun güncel evrak listesinin yerine geçmez; başvuru öncesinde yetkili uzman doğrulaması gerekir.</div>
          <DialogFooter className="border-[#1d3850] bg-[#071421]">
            <Button type="button" variant="ghost" className="text-[#8ea3b8]" onClick={() => setCreateOpen(false)}>Vazgeç</Button>
            <Button type="button" className="bg-cyan-300 text-[#03111c] hover:bg-cyan-200" disabled={saving} onClick={() => void submitCreate()}><FilePlus2 aria-hidden="true" />{saving ? 'Oluşturuluyor…' : 'Dosyayı oluştur'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && draft && <CaseDetailDialog deedCase={selected} draft={draft} isOwner={isOwner} members={workspace.members} saving={saving} onChange={setDraft} onClose={() => { setSelected(null); setDraft(null); }} onSave={() => void saveCase()} />}
    </>
  );
}
