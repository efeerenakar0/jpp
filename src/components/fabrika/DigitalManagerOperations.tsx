'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellOff,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  FilePenLine,
  Handshake,
  Loader2,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  ShieldCheck,
  ShieldPlus,
  UserCheck,
  UserRoundCog,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

type Approval = {
  id: string;
  actionType: string;
  reason: string;
  evidence: unknown;
  confidence: number;
  riskLevel: string;
  proposedMessage: string | null;
  payload: unknown;
  canMuteEvent: boolean;
  createdAt: string;
};

type ManagerAction = {
  id: string;
  actionType: string;
  reason: string;
  status: string;
  riskLevel: string;
  policyDecision: string;
  proposedMessage: string | null;
  errorMessage: string | null;
  createdAt: string;
  executedAt: string | null;
};

type ManagerTask = {
  id: string;
  title: string;
  description: string | null;
  priority: number;
  workflowStatus: string;
  dueAt: string | null;
  failureReason: string | null;
  assignedMember: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  property: { id: string; title: string } | null;
  updatedAt: string;
};

type Commitment = {
  id: string;
  description: string;
  dueAt: string | null;
  status: string;
  reminderCount: number;
  member: { id: string; name: string } | null;
};

type Delivery = {
  id: string;
  purpose: string | null;
  relatedTaskId: string | null;
  status: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  presentation: {
    label: string;
    terminal: boolean;
    successful: boolean;
  };
};

type Handoff = {
  id: string;
  status: string;
  summary: string;
  assignedMemberId: string | null;
  requestedAt: string;
  verifiedContext: unknown;
  conversation: {
    customerName: string;
    aiEnabled: boolean;
    intent: string;
    summary: string | null;
    notes: string | null;
    tags: string[];
  };
};

type Correction = {
  id: string;
  operation: string;
  entityType: string | null;
  result: string;
  errorMessage: string | null;
  createdAt: string;
};

type Preferences = {
  ownerPhone: string | null;
  notifyCriticalImmediately: boolean;
  notifyTaskAccepted: boolean;
  notifyOnlyProblemsAndDelays: boolean;
  alwaysNotifyHotLeads: boolean;
  hourlySummaryEnabled: boolean;
  morningSummaryEnabled: boolean;
  eveningSummaryEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  autonomyMode: 'SUGGEST_ONLY' | 'APPROVAL_REQUIRED' | 'AUTO_LOW_RISK';
  allowAutomaticEmployeeAssignment: boolean;
  allowAutomaticEmployeeWhatsApp: boolean;
};

type Member = {
  id: string;
  name: string;
  availability: string;
  maxActiveTaskCapacity: number;
  activeTaskCount: number;
};

type Dashboard = {
  role: 'OWNER' | 'EMPLOYEE';
  generatedAt: string;
  approvals: Approval[];
  actions: ManagerAction[];
  tasks: ManagerTask[];
  commitments: Commitment[];
  deliveries: Delivery[];
  handoffs: Handoff[];
  members: Member[];
  corrections: Correction[];
  preferences: Preferences | null;
  summary: {
    generatedText: string;
    periodStart: string;
    periodEnd: string;
  } | null;
};

const actionLabels: Record<string, string> = {
  CREATE_TASK: 'Görev oluştur',
  ASSIGN_EMPLOYEE: 'Çalışana ata',
  REASSIGN_EMPLOYEE: 'Yeniden ata',
  UPDATE_TASK_STATUS: 'Görev durumunu güncelle',
  CREATE_COMMITMENT: 'Taahhüt kaydet',
  CREATE_CRM_ACTIVITY: 'CRM aktivitesi ekle',
  UPDATE_LEAD_STAGE: 'Müşteri aşamasını güncelle',
  SEND_EMPLOYEE_WHATSAPP: 'Çalışana WhatsApp gönder',
  NOTIFY_OWNER: 'Patronu bilgilendir',
  OFFER_CONVERSATION_HANDOFF: 'Sohbet devri öner',
  SCHEDULE_APPOINTMENT: 'Randevu planla',
  ASK_CLARIFICATION: 'Açıklama iste',
  CREATE_POLICY: 'Yönetim kuralı oluştur',
  NO_ACTION: 'İşlem yapma',
};

const statusLabels: Record<string, string> = {
  CREATED: 'Oluşturuldu',
  ASSIGNED: 'Atandı',
  MESSAGE_QUEUED: 'Mesaj kuyruğunda',
  DELIVERED: 'Çalışan yanıtı bekleniyor',
  ACCEPTED: 'Kabul edildi',
  IN_PROGRESS: 'Devam ediyor',
  WAITING_CUSTOMER: 'Müşteri bekleniyor',
  APPOINTMENT_PROPOSED: 'Randevu önerildi',
  APPOINTMENT_CONFIRMED: 'Randevu kesinleşti',
  COMPLETED: 'Tamamlandı',
  REJECTED: 'Reddedildi',
  REASSIGNMENT_REQUIRED: 'Yeniden atama gerekiyor',
  CANCELLED: 'İptal edildi',
  FAILED: 'Başarısız',
  PENDING_APPROVAL: 'Onay bekliyor',
  EXECUTING: 'Uygulanıyor',
  EXECUTED: 'Uygulandı',
};

function dateTime(value: string | null) {
  if (!value) return 'Tarih yok';
  return new Date(value).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function StatusBadge({
  status,
  problem = false,
}: {
  status: string;
  problem?: boolean;
}) {
  const successful = ['EXECUTED', 'COMPLETED', 'READ'].includes(
    status
  );
  const warning =
    problem ||
    ['FAILED', 'REJECTED', 'REASSIGNMENT_REQUIRED', 'OVERDUE'].includes(
      status
    );
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        warning
          ? 'border-rose-500/25 bg-rose-500/10 text-rose-300'
          : successful
            ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
            : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
      }`}
    >
      {statusLabels[status] || status}
    </span>
  );
}

const editableFieldLabels: Record<string, string> = {
  title: 'Başlık',
  description: 'Açıklama',
  reason: 'Gerekçe',
  message: 'Gönderilecek mesaj',
  question: 'Sorulacak soru',
  summary: 'Devir özeti',
  evidenceText: 'Doğrulama bilgisi',
  activityType: 'Aktivite türü',
  stage: 'Müşteri aşaması',
  status: 'Görev durumu',
  taskType: 'Görev türü',
  relativeTimeText: 'Süre ifadesi',
  dueAt: 'Termin',
  startAt: 'Başlangıç',
  endAt: 'Bitiş',
  priority: 'Öncelik',
  certainty: 'Kesinlik',
  important: 'Önemli bildirim',
  confirmed: 'Kesinleşmiş randevu',
  scope: 'Kural kapsamı',
  instruction: 'Doğal dil talimatı',
  expiresAt: 'Bitiş zamanı',
};

const editableFieldOptions: Record<
  string,
  Array<{ value: string; label: string }>
> = {
  scope: [
    { value: 'ONE_TIME', label: 'Tek seferlik' },
    { value: 'CONVERSATION', label: 'Bu konuşmaya özel' },
    { value: 'TEMPORARY', label: 'Zaman sınırlı' },
    { value: 'PERMANENT', label: 'Kalıcı şirket kuralı' },
  ],
  stage: [
    { value: 'NEW', label: 'Yeni' },
    { value: 'CONTACTED', label: 'İletişim kuruldu' },
    { value: 'QUALIFIED', label: 'Nitelikli' },
    { value: 'VIEWING', label: 'Gösterim' },
    { value: 'OFFER', label: 'Teklif' },
    { value: 'WON', label: 'Kazanıldı' },
    { value: 'LOST', label: 'Kaybedildi' },
  ],
  taskType: [
    { value: 'CALL', label: 'Arama' },
    { value: 'MESSAGE', label: 'Mesaj' },
    { value: 'MEETING', label: 'Toplantı' },
    { value: 'VIEWING', label: 'Gösterim' },
    { value: 'FOLLOW_UP', label: 'Takip' },
    { value: 'DOCUMENT', label: 'Belge' },
    { value: 'OTHER', label: 'Diğer' },
  ],
};

function editablePayloadFields(payload: Record<string, unknown> | null) {
  if (!payload) return [];
  return Object.entries(payload).filter(([key]) => key in editableFieldLabels);
}

function verifiedContextLines(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const context = value as Record<string, unknown>;
  return [
    context.need ? `İhtiyaç: ${String(context.need)}` : null,
    context.property ? `Portföy: ${String(context.property)}` : null,
    context.nextAction ? `Sonraki adım: ${String(context.nextAction)}` : null,
  ].filter((line): line is string => Boolean(line));
}

function canMakePermanentRule(approval: Approval) {
  return (
    approval.riskLevel === 'LOW' &&
    [
      'CREATE_TASK',
      'CREATE_COMMITMENT',
      'CREATE_CRM_ACTIVITY',
      'UPDATE_LEAD_STAGE',
      'NOTIFY_OWNER',
      'ASK_CLARIFICATION',
    ].includes(approval.actionType)
  );
}

function EmptyLine({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-xs text-slate-500">
      {children}
    </div>
  );
}

function PanelTitle({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
      {count !== undefined && (
        <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-semibold text-slate-400">
          {count}
        </span>
      )}
    </div>
  );
}

export default function DigitalManagerOperations() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Approval | null>(null);
  const [editedPayload, setEditedPayload] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [taskAssignments, setTaskAssignments] = useState<
    Record<string, string>
  >({});
  const [handoffAssignments, setHandoffAssignments] = useState<
    Record<string, string>
  >({});

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch('/api/fabrika/general-manager/dashboard', {
        cache: 'no-store',
      });
      const data = (await response.json()) as Dashboard & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Operasyonlar yüklenemedi.');
      setDashboard(data);
      setPreferences(data.preferences);
    } catch (error) {
      if (!quiet) {
        toast.error(
          error instanceof Error ? error.message : 'Operasyonlar yüklenemedi.'
        );
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(true), 15_000);
    const listener = () => void refresh(true);
    window.addEventListener('digital-manager-refresh', listener);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      window.removeEventListener('digital-manager-refresh', listener);
    };
  }, [refresh]);

  const pendingProblems = useMemo(
    () =>
      (dashboard?.commitments.filter((item) => item.status === 'OVERDUE')
        .length || 0) +
      (dashboard?.deliveries.filter((item) => item.status === 'FAILED').length ||
        0),
    [dashboard]
  );

  async function decide(
    approval: Approval,
    decision: 'APPROVED' | 'REJECTED',
    payload?: unknown
  ) {
    setBusyId(approval.id);
    try {
      const response = await fetch('/api/fabrika/general-manager/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: approval.id,
          decision,
          ...(payload === undefined ? {} : { editedPayload: payload }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Karar kaydedilemedi.');
      toast.success(
        decision === 'APPROVED' ? 'Aksiyon onaylandı.' : 'Aksiyon reddedildi.'
      );
      setEditing(null);
      await refresh(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Karar kaydedilemedi.');
    } finally {
      setBusyId(null);
    }
  }

  async function submitEditedApproval() {
    if (!editing || !editedPayload) return;
    await decide(editing, 'APPROVED', editedPayload);
  }

  async function changeHandoff(
    handoff: Handoff,
    action: 'ACCEPT' | 'RETURN',
    memberId?: string | null
  ) {
    setBusyId(handoff.id);
    try {
      const response = await fetch('/api/fabrika/general-manager/handoffs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handoffId: handoff.id,
          action,
          memberId:
            action === 'ACCEPT'
              ? memberId || handoff.assignedMemberId
              : handoff.assignedMemberId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Devir güncellenemedi.');
      toast.success(action === 'ACCEPT' ? 'Sohbet devralındı.' : 'Sohbet AI asistana döndü.');
      await refresh(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Devir güncellenemedi.');
    } finally {
      setBusyId(null);
    }
  }

  async function reassignTask(task: ManagerTask) {
    const memberId = taskAssignments[task.id];
    if (!memberId) {
      toast.error('Önce görevi devralacak çalışanı seçin.');
      return;
    }
    setBusyId(`task:${task.id}`);
    try {
      const response = await fetch('/api/fabrika/general-manager/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          memberId,
          reason: 'Patron Dijital Genel Müdür panelinden yeniden atadı.',
          clientRequestId: crypto.randomUUID(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Görev atanamadı.');
      toast.success('Görev seçilen çalışana atandı.');
      setTaskAssignments((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      await refresh(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Görev atanamadı.');
    } finally {
      setBusyId(null);
    }
  }

  async function applyOwnerPolicy(
    approval: Approval,
    operation: 'MUTE_EVENT' | 'MAKE_PERMANENT'
  ) {
    setBusyId(`policy:${approval.id}`);
    try {
      const response = await fetch('/api/fabrika/general-manager/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: approval.id, operation }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kural kaydedilemedi.');
      toast.success(
        operation === 'MUTE_EVENT'
          ? 'Bu olay sessize alındı.'
          : 'Güvenli aksiyon kuralı kalıcı olarak kaydedildi.'
      );
      await refresh(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kural kaydedilemedi.');
    } finally {
      setBusyId(null);
    }
  }

  async function savePreferences() {
    if (!preferences) return;
    const savedPhone = dashboard?.preferences?.ownerPhone?.trim() || null;
    const draftPhone = preferences.ownerPhone?.trim() || null;
    const ownerPhoneChanged = draftPhone !== savedPhone;
    setBusyId('preferences');
    try {
      const response = await fetch('/api/fabrika/general-manager/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(ownerPhoneChanged ? { ownerPhone: draftPhone } : {}),
          notifyCriticalImmediately: preferences.notifyCriticalImmediately,
          notifyTaskAccepted: preferences.notifyTaskAccepted,
          notifyOnlyProblemsAndDelays:
            preferences.notifyOnlyProblemsAndDelays,
          alwaysNotifyHotLeads: preferences.alwaysNotifyHotLeads,
          hourlySummaryEnabled: preferences.hourlySummaryEnabled,
          morningSummaryEnabled: preferences.morningSummaryEnabled,
          eveningSummaryEnabled: preferences.eveningSummaryEnabled,
          quietHoursEnabled: preferences.quietHoursEnabled,
          quietHoursStart: preferences.quietHoursStart,
          quietHoursEnd: preferences.quietHoursEnd,
          timezone: preferences.timezone,
          autonomyMode: preferences.autonomyMode,
          allowAutomaticEmployeeAssignment:
            preferences.allowAutomaticEmployeeAssignment,
          allowAutomaticEmployeeWhatsApp:
            preferences.allowAutomaticEmployeeWhatsApp,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Tercihler kaydedilemedi.');
      toast.success('Dijital Genel Müdür tercihleri kaydedildi.');
      await refresh(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tercihler kaydedilemedi.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !dashboard) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          Dijital Genel Müdür operasyonları hazırlanıyor…
        </div>
      </section>
    );
  }
  if (!dashboard) return null;

  const savedOwnerPhone = dashboard.preferences?.ownerPhone?.trim() || '';
  const ownerPhoneDraft = preferences?.ownerPhone?.trim() || '';
  const ownerPhoneIsSaved =
    Boolean(ownerPhoneDraft) && ownerPhoneDraft === savedOwnerPhone;

  return (
    <section
      aria-labelledby="digital-manager-operations"
      className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
    >
      <div className="flex flex-col gap-3 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <h2
              id="digital-manager-operations"
              className="text-sm font-semibold text-white"
            >
              Dijital Genel Müdür Operasyonları
            </h2>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Onay, görev, taahhüt, teslimat ve insan devri tek doğrulanmış akışta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge
            status={
              dashboard.role === 'OWNER'
                ? dashboard.preferences?.autonomyMode || 'SUGGEST_ONLY'
                : 'Çalışan görünümü'
            }
          />
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
            aria-label="Operasyonları yenile"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-slate-800 bg-slate-800 sm:grid-cols-4">
        {[
          ['Onay bekleyen', dashboard.approvals.length],
          ['Açık görev', dashboard.tasks.filter((task) => !['COMPLETED', 'CANCELLED', 'FAILED'].includes(task.workflowStatus)).length],
          ['Açık taahhüt', dashboard.commitments.length],
          ['Müdahale', pendingProblems],
        ].map(([label, value]) => (
          <div key={String(label)} className="bg-slate-900 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {label}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue={dashboard.role === 'OWNER' ? 'approvals' : 'tasks'} className="p-4 sm:p-5">
        <TabsList
          variant="line"
          className="custom-scrollbar max-w-full justify-start overflow-x-auto border-b border-slate-800"
        >
          {dashboard.role === 'OWNER' && (
            <TabsTrigger value="approvals" className="px-3 text-xs">
              <UserCheck /> Onaylar ({dashboard.approvals.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="tasks" className="px-3 text-xs">
            <CheckCircle2 /> Görevler
          </TabsTrigger>
          <TabsTrigger value="delivery" className="px-3 text-xs">
            <Send /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="handoffs" className="px-3 text-xs">
            <Handshake /> Devirler
          </TabsTrigger>
          <TabsTrigger value="summary" className="px-3 text-xs">
            <Bot /> Özet
          </TabsTrigger>
          {dashboard.role === 'OWNER' && (
            <TabsTrigger value="settings" className="px-3 text-xs">
              <Settings2 /> Tercihler
            </TabsTrigger>
          )}
        </TabsList>

        {dashboard.role === 'OWNER' && (
          <TabsContent value="approvals" className="pt-4">
            <PanelTitle
              title="Patron onayı bekleyen aksiyonlar"
              description="Bağlayıcı veya politika gereği insan kararı isteyen işlemler."
              count={dashboard.approvals.length}
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {dashboard.approvals.length === 0 ? (
                <div className="lg:col-span-2">
                  <EmptyLine>Onay bekleyen aksiyon yok.</EmptyLine>
                </div>
              ) : (
                dashboard.approvals.map((approval) => (
                  <article
                    key={approval.id}
                    className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-white">
                          {actionLabels[approval.actionType] ||
                            approval.actionType}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Güven %{Math.round(approval.confidence * 100)} ·{' '}
                          {approval.riskLevel} risk · {dateTime(approval.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status="PENDING_APPROVAL" />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-300">
                      {approval.reason}
                    </p>
                    {approval.proposedMessage && (
                      <blockquote className="mt-3 rounded-md border border-slate-700 bg-slate-950/60 p-3 text-xs leading-5 text-slate-400">
                        “{approval.proposedMessage}”
                      </blockquote>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          busyId === approval.id ||
                          busyId === `policy:${approval.id}`
                        }
                        onClick={() => void decide(approval, 'APPROVED')}
                        className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                      >
                        <Check /> Onayla
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === approval.id}
                        onClick={() => {
                          setEditing(approval);
                          setEditedPayload(
                            approval.payload &&
                              typeof approval.payload === 'object' &&
                              !Array.isArray(approval.payload)
                              ? {
                                  ...(approval.payload as Record<
                                    string,
                                    unknown
                                  >),
                                }
                              : { actionType: approval.actionType }
                          );
                        }}
                        className="border-slate-700 bg-slate-950 text-slate-300"
                      >
                        <FilePenLine /> Düzenle
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busyId === approval.id}
                        onClick={() => void decide(approval, 'REJECTED')}
                      >
                        <X /> Reddet
                      </Button>
                      {approval.canMuteEvent && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === `policy:${approval.id}`}
                          onClick={() =>
                            void applyOwnerPolicy(approval, 'MUTE_EVENT')
                          }
                          className="border-slate-700 bg-slate-950 text-slate-300"
                        >
                          <BellOff /> Bu olayı sessize al
                        </Button>
                      )}
                      {canMakePermanentRule(approval) && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === `policy:${approval.id}`}
                          onClick={() =>
                            void applyOwnerPolicy(approval, 'MAKE_PERMANENT')
                          }
                          className="border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                        >
                          <ShieldPlus /> Bu kuralı kalıcı yap
                        </Button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="tasks" className="pt-4">
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <PanelTitle
                title="Operasyon görevleri"
                description="Sadece doğrulanmış görev durumu ve sorumlu bilgisi."
                count={dashboard.tasks.length}
              />
              <div className="custom-scrollbar max-h-[28rem] space-y-2 overflow-y-auto">
                {dashboard.tasks.length === 0 ? (
                  <EmptyLine>Görev bulunmuyor.</EmptyLine>
                ) : (
                  dashboard.tasks.map((task) => (
                    <article
                      key={task.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-white">
                            {task.title}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {task.assignedMember?.name || 'Atanmamış'} ·{' '}
                            {task.contact?.name || task.property?.title || 'Bağlı kayıt yok'}
                          </p>
                        </div>
                        <StatusBadge
                          status={task.workflowStatus}
                          problem={Boolean(task.failureReason)}
                        />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-500">
                        Termin: {dateTime(task.dueAt)}
                      </p>
                      {task.failureReason && (
                        <p className="mt-2 text-xs text-rose-300">
                          {task.failureReason}
                        </p>
                      )}
                      {dashboard.role === 'OWNER' &&
                        !['COMPLETED', 'CANCELLED', 'FAILED'].includes(
                          task.workflowStatus
                        ) && (
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <select
                              value={taskAssignments[task.id] || ''}
                              onChange={(event) =>
                                setTaskAssignments((current) => ({
                                  ...current,
                                  [task.id]: event.target.value,
                                }))
                              }
                              className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                              aria-label={`${task.title} için yeni çalışan`}
                            >
                              <option value="">Yeni sorumlu seçin</option>
                              {dashboard.members
                                .filter(
                                  (member) =>
                                    member.id !== task.assignedMember?.id
                                )
                                .map((member) => (
                                  <option
                                    key={member.id}
                                    value={member.id}
                                    disabled={
                                      member.availability !== 'AVAILABLE' ||
                                      member.activeTaskCount >=
                                        member.maxActiveTaskCapacity
                                    }
                                  >
                                    {member.name} · {member.activeTaskCount}/
                                    {member.maxActiveTaskCapacity} görev
                                  </option>
                                ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={
                                !taskAssignments[task.id] ||
                                busyId === `task:${task.id}`
                              }
                              onClick={() => void reassignTask(task)}
                              className="border-slate-700 bg-slate-950 text-slate-300"
                            >
                              {busyId === `task:${task.id}` ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <UserRoundCog />
                              )}
                              Başka çalışana ata
                            </Button>
                          </div>
                        )}
                    </article>
                  ))
                )}
              </div>
            </div>
            <div>
              <PanelTitle
                title="Taahhüt takibi"
                description="Çalışanların zaman verdiği takip ve dönüşler."
                count={dashboard.commitments.length}
              />
              <div className="custom-scrollbar max-h-[28rem] space-y-2 overflow-y-auto">
                {dashboard.commitments.length === 0 ? (
                  <EmptyLine>Açık taahhüt bulunmuyor.</EmptyLine>
                ) : (
                  dashboard.commitments.map((commitment) => (
                    <article
                      key={commitment.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-medium leading-5 text-slate-200">
                          {commitment.description}
                        </p>
                        <StatusBadge status={commitment.status} />
                      </div>
                      <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock3 className="h-3 w-3" />
                        {commitment.member?.name || 'Atanmamış'} ·{' '}
                        {dateTime(commitment.dueAt)} ·{' '}
                        {commitment.reminderCount} hatırlatma
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="delivery" className="pt-4">
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <PanelTitle
                title="Gerçek WhatsApp teslim durumları"
                description="Kuyruk, sağlayıcı, teslim ve hata ayrı gösterilir."
                count={dashboard.deliveries.length}
              />
              <div className="custom-scrollbar max-h-[28rem] space-y-2 overflow-y-auto">
                {dashboard.deliveries.length === 0 ? (
                  <EmptyLine>WhatsApp gönderimi bulunmuyor.</EmptyLine>
                ) : (
                  dashboard.deliveries.map((delivery) => (
                    <article
                      key={delivery.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-white">
                            {delivery.purpose || 'WhatsApp mesajı'}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {dateTime(delivery.createdAt)} · Deneme{' '}
                            {delivery.attemptCount}
                          </p>
                        </div>
                        <StatusBadge
                          status={delivery.status}
                          problem={!delivery.presentation.successful && delivery.presentation.terminal}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {delivery.presentation.label}
                      </p>
                      {delivery.lastError && (
                        <p className="mt-2 text-xs text-rose-300">
                          {delivery.lastError}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
            <div>
              <PanelTitle
                title="Son aksiyonlar"
                description="Önerinin uygulandığı değil, gerçek yürütme durumu."
                count={dashboard.actions.length}
              />
              <div className="custom-scrollbar max-h-[28rem] space-y-2 overflow-y-auto">
                {dashboard.actions.length === 0 ? (
                  <EmptyLine>Aksiyon kaydı bulunmuyor.</EmptyLine>
                ) : (
                  dashboard.actions.map((action) => (
                    <article
                      key={action.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-white">
                            {actionLabels[action.actionType] || action.actionType}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            {action.policyDecision} · {dateTime(action.createdAt)}
                          </p>
                        </div>
                        <StatusBadge
                          status={action.status}
                          problem={Boolean(action.errorMessage)}
                        />
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {action.reason}
                      </p>
                      {action.errorMessage && (
                        <p className="mt-2 text-xs text-rose-300">
                          {action.errorMessage}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="handoffs" className="pt-4">
          <div className="grid gap-5 xl:grid-cols-2">
            <div>
              <PanelTitle
                title="İnsan devri"
                description="AI kapatılmadan önce devri açıkça kabul edin."
                count={dashboard.handoffs.length}
              />
              <div className="space-y-2">
                {dashboard.handoffs.length === 0 ? (
                  <EmptyLine>Aktif sohbet devri bulunmuyor.</EmptyLine>
                ) : (
                  dashboard.handoffs.map((handoff) => (
                    <article
                      key={handoff.id}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-white">
                            {handoff.conversation.customerName}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {handoff.summary}
                          </p>
                          <div className="mt-2 space-y-1 text-[10px] leading-4 text-slate-500">
                            <p>
                              Niyet: {handoff.conversation.intent} · AI{' '}
                              {handoff.conversation.aiEnabled
                                ? 'aktif'
                                : 'insan devrinde'}
                            </p>
                            {handoff.conversation.summary && (
                              <p>
                                Sohbet özeti: {handoff.conversation.summary}
                              </p>
                            )}
                            {handoff.conversation.notes && (
                              <p>İç not: {handoff.conversation.notes}</p>
                            )}
                            {handoff.conversation.tags.length > 0 && (
                              <p>
                                Etiketler:{' '}
                                {handoff.conversation.tags.join(', ')}
                              </p>
                            )}
                            {verifiedContextLines(
                              handoff.verifiedContext
                            ).map((line) => (
                              <p key={line}>{line}</p>
                            ))}
                            <p>
                              Aktif sorumlu:{' '}
                              {dashboard.members.find(
                                (member) =>
                                  member.id === handoff.assignedMemberId
                              )?.name || 'Henüz atanmadı'}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={handoff.status} />
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        {handoff.status !== 'ACTIVE' && (
                          <>
                            {dashboard.role === 'OWNER' && (
                              <select
                                value={
                                  handoffAssignments[handoff.id] ||
                                  handoff.assignedMemberId ||
                                  ''
                                }
                                onChange={(event) =>
                                  setHandoffAssignments((current) => ({
                                    ...current,
                                    [handoff.id]: event.target.value,
                                  }))
                                }
                                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                                aria-label={`${handoff.conversation.customerName} sohbeti için çalışan`}
                              >
                                <option value="">Çalışan seçin</option>
                                {dashboard.members.map((member) => (
                                  <option
                                    key={member.id}
                                    value={member.id}
                                    disabled={
                                      member.availability !== 'AVAILABLE'
                                    }
                                  >
                                    {member.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <Button
                              size="sm"
                              disabled={
                                busyId === handoff.id ||
                                (dashboard.role === 'OWNER' &&
                                  !(
                                    handoffAssignments[handoff.id] ||
                                    handoff.assignedMemberId
                                  ))
                              }
                              onClick={() =>
                                void changeHandoff(
                                  handoff,
                                  'ACCEPT',
                                  handoffAssignments[handoff.id]
                                )
                              }
                              className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                            >
                              <MessageSquareText /> Devral
                            </Button>
                          </>
                        )}
                        {handoff.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === handoff.id}
                            onClick={() => void changeHandoff(handoff, 'RETURN')}
                            className="border-slate-700 bg-slate-950 text-slate-300"
                          >
                            <RotateCcw /> AI asistana ver
                          </Button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
            {dashboard.role === 'OWNER' && (
              <div>
                <PanelTitle
                  title="Düzeltme kayıtları"
                  description="Yanlış anlaşılan işlemler silinmez; ek kayıtla düzeltilir."
                  count={dashboard.corrections.length}
                />
                <div className="space-y-2">
                  {dashboard.corrections.length === 0 ? (
                    <EmptyLine>Düzeltme kaydı bulunmuyor.</EmptyLine>
                  ) : (
                    dashboard.corrections.map((correction) => (
                      <article
                        key={correction.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                          <div>
                            <p className="text-xs font-semibold text-white">
                              {correction.operation}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-500">
                              {correction.entityType || 'Kayıt'} ·{' '}
                              {dateTime(correction.createdAt)}
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                              {correction.errorMessage || correction.result}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="summary" className="pt-4">
          <PanelTitle
            title="Doğrulanmış günlük yönetici özeti"
            description="Yalnız CRM, görev, olay, taahhüt, onay ve teslimat kayıtlarından hesaplanır."
          />
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="text-sm leading-7 text-slate-200">
              {dashboard.summary?.generatedText ||
                'Bugün için doğrulanmış özet henüz oluşmadı.'}
            </p>
            {dashboard.summary && (
              <p className="mt-3 text-[10px] text-slate-500">
                Dönem: {dateTime(dashboard.summary.periodStart)} –{' '}
                {dateTime(dashboard.summary.periodEnd)}
              </p>
            )}
          </div>
        </TabsContent>

        {dashboard.role === 'OWNER' && preferences && (
          <TabsContent value="settings" className="pt-4">
            <PanelTitle
              title="Otomasyon ve bildirim tercihleri"
              description="Bağlayıcı işlemler politika gereği yine patron onayına düşebilir."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <label className="block text-xs font-medium text-slate-300">
                  Otomasyon seviyesi
                  <select
                    value={preferences.autonomyMode}
                    onChange={(event) =>
                      setPreferences({
                        ...preferences,
                        autonomyMode: event.target.value as Preferences['autonomyMode'],
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="SUGGEST_ONLY">Yalnız öner</option>
                    <option value="APPROVAL_REQUIRED">Onayla çalıştır</option>
                    <option value="AUTO_LOW_RISK">Düşük riski otomatik çalıştır</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-300">
                  Patron WhatsApp telefonu
                  <input
                    value={preferences.ownerPhone || ''}
                    onChange={(event) =>
                      setPreferences({
                        ...preferences,
                        ownerPhone: event.target.value || null,
                      })
                    }
                    placeholder="+90 5xx xxx xx xx"
                    className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </label>
                <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-5 text-slate-400">
                  {ownerPhoneIsSaved
                    ? 'Telefon kaydedildi. Bildirimler ve yönetici mesajları bu numaraya gönderilir.'
                    : 'Telefonu kaydedin; tek kullanımlık kod istenmez.'}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-slate-300">
                    Sessiz başlangıç
                    <input
                      type="time"
                      value={preferences.quietHoursStart}
                      onChange={(event) =>
                        setPreferences({
                          ...preferences,
                          quietHoursStart: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs font-medium text-slate-300">
                    Sessiz bitiş
                    <input
                      type="time"
                      value={preferences.quietHoursEnd}
                      onChange={(event) =>
                        setPreferences({
                          ...preferences,
                          quietHoursEnd: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                {[
                  ['Kritik olayları hemen bildir', 'notifyCriticalImmediately'],
                  ['Görev kabulünü bildir', 'notifyTaskAccepted'],
                  ['Yalnız sorun ve gecikmeleri bildir', 'notifyOnlyProblemsAndDelays'],
                  ['Sıcak müşterileri daima bildir', 'alwaysNotifyHotLeads'],
                  ['Saatlik operasyon özeti', 'hourlySummaryEnabled'],
                  ['Sabah özeti', 'morningSummaryEnabled'],
                  ['Akşam özeti', 'eveningSummaryEnabled'],
                  ['Sessiz saatleri uygula', 'quietHoursEnabled'],
                  ['Otomatik çalışan ataması', 'allowAutomaticEmployeeAssignment'],
                  ['Otomatik çalışan WhatsApp mesajı', 'allowAutomaticEmployeeWhatsApp'],
                ].map(([label, key]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-800 px-3 py-2 text-xs text-slate-300"
                  >
                    {label}
                    <input
                      type="checkbox"
                      checked={Boolean(
                        preferences[key as keyof Preferences]
                      )}
                      onChange={(event) =>
                        setPreferences({
                          ...preferences,
                          [key]: event.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-emerald-500"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                disabled={busyId === 'preferences'}
                onClick={() => void savePreferences()}
                className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              >
                {busyId === 'preferences' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ShieldCheck />
                )}
                Tercihleri kaydet
              </Button>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="border border-slate-700 bg-slate-900 text-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aksiyonu düzenle ve onayla</DialogTitle>
            <DialogDescription className="text-slate-400">
              Gönderilecek metni ve işlem ayrıntılarını doğal alanlardan
              düzenleyin. Bağlı müşteri, görev ve şirket kimlikleri güvenlik
              için değiştirilemez.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
            {editablePayloadFields(editedPayload).map(([key, value]) => {
              const label = editableFieldLabels[key] || key;
              const options = editableFieldOptions[key];
              if (options) {
                return (
                  <label
                    key={key}
                    className="block text-xs font-medium text-slate-300"
                  >
                    {label}
                    <select
                      value={String(value ?? '')}
                      onChange={(event) =>
                        setEditedPayload((current) =>
                          current
                            ? {
                                ...current,
                                [key]: event.target.value,
                              }
                            : current
                        )
                      }
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                    >
                      {options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }
              if (typeof value === 'boolean') {
                return (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300"
                  >
                    {label}
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) =>
                        setEditedPayload((current) =>
                          current
                            ? {
                                ...current,
                                [key]: event.target.checked,
                              }
                            : current
                        )
                      }
                      className="h-4 w-4 accent-emerald-500"
                    />
                  </label>
                );
              }
              const longText = [
                'description',
                'reason',
                'message',
                'question',
                'summary',
                'evidenceText',
              ].includes(key);
              const inputType =
                typeof value === 'number'
                  ? 'number'
                  : ['dueAt', 'startAt', 'endAt'].includes(key)
                    ? 'datetime-local'
                    : 'text';
              const displayedValue =
                inputType === 'datetime-local' && typeof value === 'string'
                  ? value.slice(0, 16)
                  : String(value ?? '');
              return (
                <label
                  key={key}
                  className={`block text-xs font-medium text-slate-300 ${
                    longText ? 'sm:col-span-2' : ''
                  }`}
                >
                  {label}
                  {longText ? (
                    <textarea
                      value={displayedValue}
                      onChange={(event) =>
                        setEditedPayload((current) =>
                          current
                            ? {
                                ...current,
                                [key]: event.target.value,
                              }
                            : current
                        )
                      }
                      className="mt-2 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm leading-6 text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  ) : (
                    <input
                      type={inputType}
                      value={displayedValue}
                      onChange={(event) => {
                        let nextValue: unknown = event.target.value;
                        if (inputType === 'number') {
                          nextValue = Number(event.target.value);
                        } else if (
                          inputType === 'datetime-local' &&
                          event.target.value
                        ) {
                          nextValue = new Date(
                            event.target.value
                          ).toISOString();
                        }
                        setEditedPayload((current) =>
                          current
                            ? { ...current, [key]: nextValue }
                            : current
                        );
                      }}
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  )}
                </label>
              );
            })}
            {editablePayloadFields(editedPayload).length === 0 && (
              <p className="sm:col-span-2 rounded-lg border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">
                Bu aksiyonda kullanıcı tarafından düzenlenebilen alan yok.
              </p>
            )}
          </div>
          <DialogFooter className="border-slate-700 bg-slate-950/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
              className="border-slate-700 bg-slate-900 text-slate-300"
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={Boolean(editing && busyId === editing.id)}
              onClick={() => void submitEditedApproval()}
              className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
            >
              <Check /> Düzenleyip onayla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

