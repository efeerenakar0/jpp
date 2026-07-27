'use client';

import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  CloudOff,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  Video,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/fabrika/ConfirmDialog';
import EmptyState from '@/components/fabrika/EmptyState';
import PageHeader from '@/components/fabrika/PageHeader';
import StatCard from '@/components/fabrika/StatCard';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TaskType =
  | 'CALL'
  | 'MESSAGE'
  | 'MEETING'
  | 'VIEWING'
  | 'FOLLOW_UP'
  | 'DOCUMENT'
  | 'OTHER';

type CalendarTask = {
  id: string;
  title: string;
  type: TaskType;
  description: string | null;
  dueAt: string | null;
  endAt: string | null;
  allDay: boolean;
  priority: number;
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  calendarSource: 'JASMINE' | 'GOOGLE' | string;
  calendarSyncStatus: 'LOCAL' | 'PENDING' | 'SYNCED' | 'ERROR' | string;
  contact: { id: string; name: string; phone: string | null } | null;
  property: { id: string; title: string; location: string | null } | null;
  deal: { id: string; title: string } | null;
  assignedMember: { id: string; name: string } | null;
};

type Choice = { id: string; name?: string; title?: string };

type CalendarData = {
  tasks: CalendarTask[];
  contacts: Array<Choice & { phone: string | null }>;
  properties: Array<Choice & { location: string | null }>;
  deals: Choice[];
  members: Choice[];
  permissions: {
    canManageTeam: boolean;
    canManageSecrets: boolean;
    canViewSubscription: boolean;
    canEditReports: boolean;
  };
  google: {
    configured: boolean;
    connected: boolean;
    email?: string | null;
    calendarId?: string;
    lastSyncedAt?: string | null;
    lastSyncStatus?: string;
    lastSyncError?: string | null;
  };
  syncLogs: Array<{
    id: string;
    status: string;
    pulledCount: number;
    pushedCount: number;
    conflictCount: number;
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
  }>;
  metrics: {
    today: number;
    nextSevenDays: number;
    appointments: number;
    overdue: number;
  };
};

type CalendarView = 'month' | 'week' | 'day';

const typeLabels: Record<TaskType, string> = {
  CALL: 'Arama',
  MESSAGE: 'Mesaj',
  MEETING: 'Randevu',
  VIEWING: 'Portföy gösterimi',
  FOLLOW_UP: 'Takip',
  DOCUMENT: 'Belge',
  OTHER: 'Diğer',
};

const typeStyles: Record<TaskType, string> = {
  CALL: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
  MESSAGE: 'border-violet-500/25 bg-violet-500/10 text-violet-200',
  MEETING: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  VIEWING: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  FOLLOW_UP: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200',
  DOCUMENT: 'border-slate-600 bg-slate-800 text-slate-200',
  OTHER: 'border-slate-600 bg-slate-800 text-slate-200',
};

const fieldClass =
  'h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';
const labelClass = 'space-y-1.5 text-xs font-medium text-slate-300';

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

function eventTime(task: CalendarTask) {
  if (task.allDay) return 'Tüm gün';
  const start = toDate(task.dueAt);
  const end = toDate(task.endAt);
  if (!start) return 'Saat yok';
  return `${format(start, 'HH:mm')}${end ? `–${format(end, 'HH:mm')}` : ''}`;
}

function inputDate(value: string | null, allDay: boolean) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offset).toISOString();
  return allDay ? local.slice(0, 10) : local.slice(0, 16);
}

function eventIso(value: FormDataEntryValue | null, allDay: boolean) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return new Date(allDay ? `${normalized}T00:00:00` : normalized).toISOString();
}

function TaskPill({
  task,
  compact = false,
  onSelect,
}: {
  task: CalendarTask;
  compact?: boolean;
  onSelect: (task: CalendarTask) => void;
}) {
  return (
    <button
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${typeStyles[task.type]} ${
        task.status === 'COMPLETED' ? 'opacity-55' : ''
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(task);
      }}
      title={`${task.title} · ${eventTime(task)}`}
      type="button"
    >
      {!compact && (
        <span className="shrink-0 font-mono text-[10px] opacity-75">
          {eventTime(task)}
        </span>
      )}
      <span
        className={`min-w-0 truncate font-medium ${
          task.status === 'COMPLETED' ? 'line-through' : ''
        }`}
      >
        {task.title}
      </span>
      {task.calendarSource === 'GOOGLE' && (
        <Cloud className="ml-auto h-3 w-3 shrink-0 opacity-70" />
      )}
    </button>
  );
}

export default function CalendarWorkspace() {
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(startOfDay(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [renderedAt] = useState(Date.now);

  async function loadCalendar() {
    try {
      const response = await fetch('/api/fabrika/calendar', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Takvim yüklenemedi.');
      }
      setCalendar(data.calendar);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Takvim verileri yüklenemedi.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(loadCalendar, 0);
    const interval = window.setInterval(loadCalendar, 30_000);
    const result = new URLSearchParams(window.location.search).get('google');
    if (result === 'connected') {
      toast.success('Google Calendar bağlandı ve ilk senkron başlatıldı.');
      window.history.replaceState({}, '', '/fabrika/takvim');
    } else if (result === 'not-configured') {
      toast.error('Google OAuth sunucu bilgileri henüz yapılandırılmamış.');
      window.history.replaceState({}, '', '/fabrika/takvim');
    } else if (result === 'denied') {
      toast.error('Google Calendar izni verilmedi.');
      window.history.replaceState({}, '', '/fabrika/takvim');
    } else if (result) {
      toast.error('Google Calendar bağlantısı tamamlanamadı.');
      window.history.replaceState({}, '', '/fabrika/takvim');
    }
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  async function postAction(
    payload: Record<string, unknown>,
    successMessage?: string
  ) {
    setSaving(true);
    try {
      const response = await fetch('/api/fabrika/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Takvim işlemi tamamlanamadı.');
      }
      setCalendar(data.calendar);
      setDialogOpen(false);
      setSelectedTask(null);
      toast.success(data.message || successMessage || 'Takvim güncellendi.');
      if (data.syncWarning) {
        toast.warning(`Jasmine kaydetti; Google bekliyor: ${data.syncWarning}`);
      }
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Takvim işlemi tamamlanamadı.'
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function disconnectGoogle() {
    setSaving(true);
    try {
      const response = await fetch('/api/fabrika/calendar/google', {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Google bağlantısı kaldırılamadı.');
      }
      toast.success('Google Calendar bağlantısı kaldırıldı.');
      await loadCalendar();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Bağlantı kaldırılamadı.'
      );
    } finally {
      setSaving(false);
    }
  }

  const tasks = useMemo(() => calendar?.tasks || [], [calendar]);
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);
  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [cursor]);
  const upcoming = useMemo(
    () =>
      tasks
        .filter(
          (task) =>
            task.status === 'OPEN' &&
            task.dueAt &&
            new Date(task.dueAt).getTime() >= renderedAt
        )
        .sort(
          (a, b) =>
            new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime()
        )
        .slice(0, 8),
    [renderedAt, tasks]
  );

  function openNew(date = cursor) {
    const start = new Date(date);
    if (view !== 'month' || isSameDay(start, new Date())) {
      start.setHours(Math.max(new Date().getHours() + 1, 9), 0, 0, 0);
    } else {
      start.setHours(10, 0, 0, 0);
    }
    setDefaultDate(start);
    setSelectedTask(null);
    setDialogOpen(true);
  }

  function openTask(task: CalendarTask) {
    setSelectedTask(task);
    setDefaultDate(null);
    setDialogOpen(true);
  }

  function moveCursor(direction: -1 | 1) {
    setCursor((current) =>
      view === 'month'
        ? direction === 1
          ? addMonths(current, 1)
          : subMonths(current, 1)
        : view === 'week'
          ? direction === 1
            ? addWeeks(current, 1)
            : subWeeks(current, 1)
          : addDays(current, direction)
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 bg-slate-900" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton className="h-28 bg-slate-900" key={item} />
          ))}
        </div>
        <Skeleton className="h-[42rem] bg-slate-900" />
      </div>
    );
  }

  if (!calendar) {
    return (
      <EmptyState
        action={<Button onClick={loadCalendar}>Yeniden dene</Button>}
        description="Takvim çalışma alanı şu anda yüklenemedi."
        icon={CalendarDays}
        title="Takvim açılamadı"
      />
    );
  }

  const title =
    view === 'month'
      ? format(cursor, 'LLLL yyyy', { locale: tr })
      : view === 'week'
        ? `${format(weekDays[0], 'd MMM', { locale: tr })} – ${format(
            weekDays[6],
            'd MMM yyyy',
            { locale: tr }
          )}`
        : format(cursor, 'd MMMM yyyy, EEEE', { locale: tr });

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        actions={
          <>
            {calendar.google.connected ? (
              <Button
                disabled={saving}
                onClick={() =>
                  postAction(
                    { action: 'sync-google' },
                    'Google Calendar senkronu tamamlandı.'
                  )
                }
                variant="outline"
              >
                <RefreshCw className={saving ? 'animate-spin' : ''} />
                Google&apos;ı eşitle
              </Button>
            ) : calendar.permissions.canManageSecrets ? (
              <Button
                asChild={calendar.google.configured}
                disabled={!calendar.google.configured}
                variant="outline"
              >
                {calendar.google.configured ? (
                  <a href="/api/fabrika/calendar/google/connect">
                    <Cloud />
                    Google ile bağlan
                  </a>
                ) : (
                  <>
                    <CloudOff />
                    Google kurulumu bekliyor
                  </>
                )}
              </Button>
            ) : null}
            <Button
              className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              onClick={() => openNew()}
            >
              <Plus />
              Yeni kayıt
            </Button>
          </>
        }
        description="Randevuları, portföy gösterimlerini ve ekip görevlerini gerçek zamanlı yönetin; isterseniz Google Calendar ile iki yönlü eşitleyin."
        eyebrow="Canlı operasyon planı"
        icon={CalendarDays}
        title="Takvim ve Randevular"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={CalendarCheck2}
          label="Bugün"
          status="success"
          value={calendar.metrics.today}
        />
        <StatCard
          icon={Clock3}
          label="Önümüzdeki 7 gün"
          value={calendar.metrics.nextSevenDays}
        />
        <StatCard
          icon={Video}
          label="Randevu ve gösterim"
          status="success"
          value={calendar.metrics.appointments}
        />
        <StatCard
          icon={Clock3}
          label="Geciken"
          status={calendar.metrics.overdue > 0 ? 'warning' : 'default'}
          value={calendar.metrics.overdue}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Button
                aria-label="Önceki tarih aralığı"
                onClick={() => moveCursor(-1)}
                size="icon"
                variant="outline"
              >
                <ChevronLeft />
              </Button>
              <Button
                onClick={() => setCursor(startOfDay(new Date()))}
                variant="outline"
              >
                Bugün
              </Button>
              <Button
                aria-label="Sonraki tarih aralığı"
                onClick={() => moveCursor(1)}
                size="icon"
                variant="outline"
              >
                <ChevronRight />
              </Button>
              <h2 className="ml-2 text-sm font-semibold capitalize text-white sm:text-base">
                {title}
              </h2>
            </div>
            <Tabs
              onValueChange={(value) => setView(value as CalendarView)}
              value={view}
            >
              <TabsList
                aria-label="Takvim görünümü"
                className="grid h-10 w-full grid-cols-3 bg-slate-950 lg:w-72"
              >
                <TabsTrigger value="month">Ay</TabsTrigger>
                <TabsTrigger value="week">Hafta</TabsTrigger>
                <TabsTrigger value="day">Gün</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {view === 'month' && (
            <div className="custom-scrollbar overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/50">
                  {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(
                    (day) => (
                      <div
                        className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                        key={day}
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map((day) => {
                    const dayTasks = tasks.filter(
                      (task) => task.dueAt && isSameDay(new Date(task.dueAt), day)
                    );
                    const today = isSameDay(day, new Date());
                    return (
                      <div
                        className={`min-h-32 border-b border-r border-slate-800 p-2 text-left align-top transition hover:bg-slate-800/40 ${
                          isSameMonth(day, cursor)
                            ? 'bg-slate-900'
                            : 'bg-slate-950/55'
                        }`}
                        key={day.toISOString()}
                      >
                        <button
                          aria-label={`${format(day, 'd MMMM', {
                            locale: tr,
                          })} tarihine kayıt ekle`}
                          className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                            today
                              ? 'bg-emerald-500 text-emerald-950'
                              : isSameMonth(day, cursor)
                                ? 'text-slate-300'
                                : 'text-slate-600'
                          }`}
                          onClick={() => openNew(day)}
                          type="button"
                        >
                          {format(day, 'd')}
                        </button>
                        <div className="space-y-1">
                          {dayTasks.slice(0, 3).map((task) => (
                            <TaskPill
                              compact
                              key={task.id}
                              onSelect={openTask}
                              task={task}
                            />
                          ))}
                          {dayTasks.length > 3 && (
                            <span className="block px-1 text-[10px] text-slate-500">
                              +{dayTasks.length - 3} kayıt daha
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="custom-scrollbar overflow-x-auto">
              <div className="grid min-h-[38rem] min-w-[900px] grid-cols-7 divide-x divide-slate-800">
                {weekDays.map((day) => {
                  const dayTasks = tasks.filter(
                    (task) => task.dueAt && isSameDay(new Date(task.dueAt), day)
                  );
                  return (
                    <div className="bg-slate-900" key={day.toISOString()}>
                      <button
                        className={`w-full border-b border-slate-800 p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                          isSameDay(day, new Date()) ? 'bg-emerald-500/5' : ''
                        }`}
                        onClick={() => {
                          setCursor(day);
                          setView('day');
                        }}
                        type="button"
                      >
                        <span className="block text-[10px] uppercase text-slate-500">
                          {format(day, 'EEE', { locale: tr })}
                        </span>
                        <span
                          className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                            isSameDay(day, new Date())
                              ? 'bg-emerald-500 text-emerald-950'
                              : 'text-slate-200'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                      </button>
                      <div className="space-y-2 p-2">
                        {dayTasks.map((task) => (
                          <TaskPill
                            key={task.id}
                            onSelect={openTask}
                            task={task}
                          />
                        ))}
                        <Button
                          className="w-full border-dashed text-xs text-slate-500"
                          onClick={() => openNew(day)}
                          size="sm"
                          variant="outline"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Ekle
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'day' && (
            <div className="custom-scrollbar max-h-[42rem] overflow-y-auto p-4 sm:p-6">
              {tasks.filter(
                (task) =>
                  task.dueAt && isSameDay(new Date(task.dueAt), cursor)
              ).length === 0 ? (
                <EmptyState
                  action={
                    <Button onClick={() => openNew(cursor)}>
                      <Plus />
                      Kayıt ekle
                    </Button>
                  }
                  description="Bu güne ait görev, randevu veya gösterim bulunmuyor."
                  icon={CalendarDays}
                  title="Gün boş"
                />
              ) : (
                <div className="relative ml-14 border-l border-slate-800">
                  {tasks
                    .filter(
                      (task) =>
                        task.dueAt && isSameDay(new Date(task.dueAt), cursor)
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.dueAt!).getTime() -
                        new Date(b.dueAt!).getTime()
                    )
                    .map((task) => (
                      <article
                        className="relative mb-4 ml-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                        key={task.id}
                      >
                        <time className="absolute -left-20 top-3 w-12 text-right font-mono text-xs text-slate-500">
                          {eventTime(task).split('–')[0]}
                        </time>
                        <span
                          className={`absolute -left-[31px] top-4 h-3 w-3 rounded-full border-2 border-slate-900 ${
                            task.type === 'VIEWING'
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                        <button
                          className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                          onClick={() => openTask(task)}
                          type="button"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {task.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {typeLabels[task.type]} · {eventTime(task)}
                              </p>
                            </div>
                            <span
                              className={`rounded-md border px-2 py-1 text-[10px] ${typeStyles[task.type]}`}
                            >
                              {task.calendarSource === 'GOOGLE'
                                ? 'Google'
                                : 'Jasmine'}
                            </span>
                          </div>
                          {(task.contact || task.property || task.assignedMember) && (
                            <p className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
                              {task.contact && (
                                <span className="flex items-center gap-1">
                                  <UserRound className="h-3.5 w-3.5" />
                                  {task.contact.name}
                                </span>
                              )}
                              {task.property && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  {task.property.title}
                                </span>
                              )}
                            </p>
                          )}
                        </button>
                      </article>
                    ))}
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Google Calendar
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {calendar.google.connected
                    ? calendar.google.email || 'Google hesabı bağlı'
                    : 'Şirket takviminizi iki yönlü eşitleyin.'}
                </p>
              </div>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  calendar.google.connected
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-slate-700 bg-slate-950 text-slate-500'
                }`}
              >
                {calendar.google.connected ? <Cloud /> : <CloudOff />}
              </span>
            </div>
            {calendar.google.connected ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">
                  <p className="text-slate-500">Son senkron</p>
                  <p className="mt-1 font-medium text-slate-200">
                    {calendar.google.lastSyncedAt
                      ? format(
                          new Date(calendar.google.lastSyncedAt),
                          'd MMM yyyy HH:mm',
                          { locale: tr }
                        )
                      : 'İlk senkron bekleniyor'}
                  </p>
                  <p
                    className={`mt-1 text-[10px] ${
                      calendar.google.lastSyncStatus === 'ERROR'
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {calendar.google.lastSyncStatus || 'CONNECTED'}
                  </p>
                </div>
                {calendar.google.lastSyncError && (
                  <p className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 text-xs leading-5 text-rose-300">
                    {calendar.google.lastSyncError}
                  </p>
                )}
                {calendar.permissions.canManageSecrets && (
                  <ConfirmDialog
                    confirmLabel="Bağlantıyı kaldır"
                    description="Google erişimi iptal edilir. Mevcut Jasmine kayıtları silinmez ve yerel takvimde kalır."
                    destructive
                    onConfirm={disconnectGoogle}
                    title="Google Calendar bağlantısı kaldırılsın mı?"
                    trigger={
                      <Button className="w-full" variant="outline">
                        <CloudOff />
                        Bağlantıyı kaldır
                      </Button>
                    }
                  />
                )}
              </div>
            ) : calendar.permissions.canManageSecrets ? (
              <div className="mt-4">
                {calendar.google.configured ? (
                  <Button asChild className="w-full" variant="outline">
                    <a href="/api/fabrika/calendar/google/connect">
                      <Cloud />
                      Google ile bağlan
                    </a>
                  </Button>
                ) : (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-xs font-medium text-amber-300">
                      Platform kurulumu bekleniyor
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">
                      Google Cloud’da Calendar API, OAuth izin ekranı ve web
                      istemcisi bir kez hazırlanır. Yetkili yönlendirme adresi:
                    </p>
                    <code className="mt-2 block break-all rounded bg-slate-950 p-2 text-[10px] text-slate-300">
                      /api/fabrika/calendar/google/callback
                    </code>
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      Platform hazır olduğunda müşteri yalnızca “Google ile
                      bağlan” düğmesine basıp hesabını seçer.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Google bağlantısını şirket patronu kurabilir.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Yaklaşanlar</h2>
              <span className="text-[10px] text-slate-500">
                {upcoming.length} kayıt
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {upcoming.length > 0 ? (
                upcoming.map((task) => (
                  <button
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-left transition hover:border-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    key={task.id}
                    onClick={() => openTask(task)}
                    type="button"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          task.type === 'VIEWING'
                            ? 'bg-amber-400'
                            : task.type === 'MEETING'
                              ? 'bg-emerald-400'
                              : 'bg-sky-400'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-200">
                          {task.title}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {format(new Date(task.dueAt!), 'd MMM, EEE HH:mm', {
                            locale: tr,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-xs leading-5 text-slate-500">
                  Yaklaşan açık kayıt bulunmuyor.
                </p>
              )}
            </div>
          </section>

          {calendar.google.connected && calendar.syncLogs.length > 0 && (
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-sm font-semibold text-white">
                Senkron günlüğü
              </h2>
              <div className="mt-3 space-y-2">
                {calendar.syncLogs.slice(0, 4).map((log) => (
                  <div
                    className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                    key={log.id}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-semibold ${
                          log.status === 'SUCCESS'
                            ? 'text-emerald-400'
                            : log.status === 'ERROR'
                              ? 'text-rose-400'
                              : 'text-amber-300'
                        }`}
                      >
                        {log.status}
                      </span>
                      <time className="text-[10px] text-slate-600">
                        {format(new Date(log.startedAt), 'd MMM HH:mm', {
                          locale: tr,
                        })}
                      </time>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {log.pulledCount} alındı · {log.pushedCount} gönderildi ·{' '}
                      {log.conflictCount} çakışma
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      <EventDialog
        calendar={calendar}
        defaultDate={defaultDate}
        key={`${selectedTask?.id || 'new'}-${defaultDate?.toISOString() || ''}`}
        onClose={() => {
          setDialogOpen(false);
          setSelectedTask(null);
        }}
        onDelete={(id) => postAction({ action: 'delete-event', id })}
        onSubmit={postAction}
        open={dialogOpen}
        saving={saving}
        task={selectedTask}
      />
    </div>
  );
}

function EventDialog({
  calendar,
  task,
  defaultDate,
  open,
  saving,
  onClose,
  onSubmit,
  onDelete,
}: {
  calendar: CalendarData;
  task: CalendarTask | null;
  defaultDate: Date | null;
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    payload: Record<string, unknown>,
    message?: string
  ) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [allDay, setAllDay] = useState(task?.allDay || false);
  const start = task?.dueAt
    ? new Date(task.dueAt)
    : defaultDate || new Date();
  const end = task?.endAt
    ? new Date(task.endAt)
    : new Date(start.getTime() + 60 * 60 * 1000);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const dueAt = eventIso(values.get('dueAt'), allDay);
    const endAt = eventIso(values.get('endAt'), allDay);
    if (!dueAt) {
      toast.error('Başlangıç tarihi gerekli.');
      return;
    }
    await onSubmit({
      action: task ? 'update-event' : 'create-event',
      ...(task ? { id: task.id } : {}),
      title: values.get('title'),
      type: values.get('type'),
      description: values.get('description') || null,
      dueAt,
      endAt,
      allDay,
      priority: values.get('priority'),
      contactId: values.get('contactId') || null,
      propertyId: values.get('propertyId') || null,
      dealId: values.get('dealId') || null,
      assignedMemberId: values.get('assignedMemberId') || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-700 bg-slate-900 text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {task ? 'Takvim kaydını düzenle' : 'Yeni takvim kaydı'}
          </DialogTitle>
          <DialogDescription>
            Randevu ve gösterimler önemli bildirimlere; Google bağlantısı
            varsa bağlı takvime otomatik gönderilir.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          id="calendar-event-form"
          key={`${task?.id || 'new'}-${defaultDate?.toISOString() || ''}`}
          onSubmit={submit}
        >
          <label className={`${labelClass} sm:col-span-2`}>
            Başlık
            <Input
              className={fieldClass}
              defaultValue={task?.title || ''}
              name="title"
              placeholder="Örn. Kestel portföy gösterimi"
              required
            />
          </label>
          <label className={labelClass}>
            Kayıt türü
            <select
              className={fieldClass}
              defaultValue={task?.type || 'MEETING'}
              name="type"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Öncelik
            <select
              className={fieldClass}
              defaultValue={String(task?.priority || 2)}
              name="priority"
            >
              <option value="1">Düşük</option>
              <option value="2">Normal</option>
              <option value="3">Yüksek</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300 sm:col-span-2">
            <input
              checked={allDay}
              className="h-4 w-4 rounded border-slate-600 accent-emerald-500"
              onChange={(event) => setAllDay(event.target.checked)}
              type="checkbox"
            />
            Tüm gün süren kayıt
          </label>
          <label className={labelClass}>
            Başlangıç
            <Input
              className={fieldClass}
              defaultValue={inputDate(start.toISOString(), allDay)}
              name="dueAt"
              required
              type={allDay ? 'date' : 'datetime-local'}
            />
          </label>
          <label className={labelClass}>
            Bitiş
            <Input
              className={fieldClass}
              defaultValue={inputDate(end.toISOString(), allDay)}
              name="endAt"
              type={allDay ? 'date' : 'datetime-local'}
            />
          </label>
          <label className={labelClass}>
            Müşteri
            <select
              className={fieldClass}
              defaultValue={task?.contact?.id || ''}
              name="contactId"
            >
              <option value="">Müşteri seçilmedi</option>
              {calendar.contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Portföy
            <select
              className={fieldClass}
              defaultValue={task?.property?.id || ''}
              name="propertyId"
            >
              <option value="">Portföy seçilmedi</option>
              {calendar.properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.title}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Satış fırsatı
            <select
              className={fieldClass}
              defaultValue={task?.deal?.id || ''}
              name="dealId"
            >
              <option value="">Fırsat seçilmedi</option>
              {calendar.deals.map((deal) => (
                <option key={deal.id} value={deal.id}>
                  {deal.title}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Sorumlu ekip üyesi
            <select
              className={fieldClass}
              defaultValue={task?.assignedMember?.id || ''}
              name="assignedMemberId"
            >
              <option value="">Atanmadı</option>
              {calendar.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Açıklama
            <textarea
              className={`${fieldClass} min-h-24 py-3`}
              defaultValue={task?.description || ''}
              name="description"
              placeholder="Hazırlık notları, buluşma adresi veya özel detaylar..."
            />
          </label>
        </form>
        <DialogFooter className="sm:justify-between">
          <div>
            {task && (
              <ConfirmDialog
                confirmLabel="Kaydı sil"
                description="Bu kayıt Jasmine takviminden ve bağlıysa Google Calendar’dan silinir. Bu işlem geri alınamaz."
                destructive
                onConfirm={async () => {
                  await onDelete(task.id);
                }}
                title="Takvim kaydı silinsin mi?"
                trigger={
                  <Button type="button" variant="destructive">
                    <Trash2 />
                    Sil
                  </Button>
                }
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={onClose} type="button" variant="ghost">
              Vazgeç
            </Button>
            {task && (
              <Button
                disabled={saving}
                onClick={() =>
                  onSubmit({
                    action: 'toggle-event',
                    id: task.id,
                    completed: task.status !== 'COMPLETED',
                  })
                }
                type="button"
                variant="outline"
              >
                <CheckCircle2 />
                {task.status === 'COMPLETED' ? 'Yeniden aç' : 'Tamamla'}
              </Button>
            )}
            <Button
              className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              disabled={saving}
              form="calendar-event-form"
              type="submit"
            >
              {saving && <Loader2 className="animate-spin" />}
              Kaydet
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
