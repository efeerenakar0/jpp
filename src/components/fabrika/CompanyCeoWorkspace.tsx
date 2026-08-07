'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Megaphone,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import WorkspacePage from '@/components/fabrika/WorkspacePage';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  buildCompanyCeoSnapshot,
  companyCeoManagerSchema,
  companyCeoMarketingSchema,
  companyCeoWorkspaceSchema,
} from '@/lib/company-ceo-view';

type CompanyCeoSection = 'overview' | 'customers' | 'pipeline';
type Snapshot = ReturnType<typeof buildCompanyCeoSnapshot>;
type DetailPanel = 'performance' | 'alerts' | 'report' | null;

async function fetchJson(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { cache: 'no-store', signal });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof body.error === 'string' ? body.error : 'Veriler yüklenemedi.',
    );
  }
  return body;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CompanyCeoWorkspace({
  initialSection = 'overview',
}: {
  initialSection?: CompanyCeoSection;
}) {
  const [section, setSection] = useState<CompanyCeoSection>(initialSection);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(initialSection === 'overview');
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [detailPanel, setDetailPanel] = useState<DetailPanel>(null);

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const [workspaceResult, managerResult, marketingResult] =
        await Promise.allSettled([
          fetchJson('/api/fabrika/workspace', signal),
          fetchJson('/api/fabrika/general-manager/dashboard', signal),
          fetchJson('/api/fabrika/marketing/campaigns', signal),
        ]);

      if (workspaceResult.status === 'rejected') throw workspaceResult.reason;
      if (managerResult.status === 'rejected') throw managerResult.reason;

      const workspaceEnvelope = workspaceResult.value;
      if (workspaceEnvelope.success !== true) {
        throw new Error(
          typeof workspaceEnvelope.error === 'string'
            ? workspaceEnvelope.error
            : 'Şirket çalışma alanı yüklenemedi.',
        );
      }

      const workspace = companyCeoWorkspaceSchema.parse(
        workspaceEnvelope.workspace,
      );
      const manager = companyCeoManagerSchema.parse(managerResult.value);
      const campaigns =
        marketingResult.status === 'fulfilled'
          ? companyCeoMarketingSchema.parse(marketingResult.value).campaigns
          : [];

      if (marketingResult.status === 'rejected') {
        setWarning(
          'Kampanya verileri şu anda alınamadı; diğer şirket verileri günceldir.',
        );
      }

      setSnapshot(buildCompanyCeoSnapshot(workspace, manager, campaigns));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') {
        return;
      }
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Şirket özeti yüklenemedi.',
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section !== 'overview' || snapshot) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadOverview(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadOverview, section, snapshot]);

  if (section !== 'overview') {
    return (
      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        <Button
          className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          onClick={() => setSection('overview')}
          type="button"
          variant="outline"
        >
          <ArrowLeft className="h-4 w-4" /> Şirket özetine dön
        </Button>
        <WorkspacePage
          initialView={section === 'pipeline' ? 'pipeline' : 'customers'}
          mode="crm"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Doğrulanmış şirket görünümü
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">AI Şirket CEO</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Müşteri, portföy, satış, görev, ekip ve kampanya verilerini tek ve
            sade bir yönetici ekranında takip edin.
          </p>
        </div>
        <Button
          className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          disabled={loading}
          onClick={() => void loadOverview()}
          type="button"
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </header>

      {warning && (
        <div
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          role="status"
        >
          {warning}
        </div>
      )}

      {error ? (
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-300" />
          <h2 className="mt-3 font-bold text-white">Şirket özeti açılamadı</h2>
          <p className="mt-2 text-sm text-rose-100">{error}</p>
          <Button
            className="mt-5 bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300"
            onClick={() => void loadOverview()}
            type="button"
          >
            Yeniden dene
          </Button>
        </section>
      ) : loading || !snapshot ? (
        <CompanyCeoSkeleton />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Şirket göstergeleri">
            <MetricCard label="Müşteriler" value={snapshot.metrics.customers} icon={Users} />
            <MetricCard label="Aktif portföyler" value={snapshot.metrics.portfolios} icon={Building2} />
            <MetricCard label="Satış fırsatları" value={snapshot.metrics.opportunities} icon={CircleDollarSign} />
            <MetricCard label="Geciken görevler" value={snapshot.metrics.overdueTasks} icon={ClipboardList} warning={snapshot.metrics.overdueTasks > 0} />
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Çalışma alanları</h2>
                <p className="mt-1 text-sm text-slate-500">Ayrıntıyı yalnız ihtiyacınız olduğunda açın.</p>
              </div>
              <span className="text-xs text-slate-500">
                Son kontrol {new Intl.DateTimeFormat('tr-TR', { timeStyle: 'short' }).format(new Date(snapshot.generatedAt))}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ActionCard title="Müşteriler" detail={`${snapshot.metrics.customers} kayıt`} icon={Users} onClick={() => setSection('customers')} />
              <ActionLink title="Portföyler" detail={`${snapshot.metrics.portfolios} aktif`} icon={Building2} href="/fabrika/portfoyler" />
              <ActionCard title="Satış fırsatları" detail={`${snapshot.metrics.opportunities} açık`} icon={BriefcaseBusiness} onClick={() => setSection('pipeline')} />
              <ActionLink title="Görevler" detail={`${snapshot.metrics.overdueTasks} geciken · ${snapshot.metrics.upcomingCriticalTasks} yaklaşan`} icon={CalendarCheck2} href="/fabrika/takvim" />
              <ActionCard title="Çalışan performansı" detail={`${snapshot.employeePerformance.length} aktif çalışan`} icon={ChartNoAxesCombined} onClick={() => setDetailPanel('performance')} />
              <ActionLink title="Kampanyalar" detail={`${snapshot.metrics.campaigns} çalışma · ${snapshot.metrics.manuallyConfirmedCampaigns} doğrulandı`} icon={Megaphone} href="/fabrika/pazarlamaci" />
              <ActionCard title="Kritik uyarılar" detail={`${snapshot.criticalAlerts.length} kayıt`} icon={AlertTriangle} onClick={() => setDetailPanel('alerts')} warning={snapshot.criticalAlerts.length > 0} />
              <ActionCard title="Özet rapor" detail="Doğrulanmış günlük görünüm" icon={Sparkles} onClick={() => setDetailPanel('report')} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-cyan-300" />
                <h2 className="font-bold text-white">Bugünün yönetici özeti</h2>
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-300">{snapshot.report}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <SmallMetric label="Satış hattı" value={formatCurrency(snapshot.metrics.pipelineValue)} />
                <SmallMetric label="Kazanılan komisyon" value={formatCurrency(snapshot.metrics.wonCommission)} />
                <SmallMetric label="Ortalama eşleşme" value={`%${Math.round(snapshot.metrics.averageMatchScore)}`} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-white">Kritik akış</h2>
                <span className={`rounded-full px-2 py-1 text-xs ${snapshot.criticalAlerts.length ? 'bg-amber-500/10 text-amber-200' : 'bg-emerald-500/10 text-emerald-200'}`}>
                  {snapshot.criticalAlerts.length || 'Temiz'}
                </span>
              </div>
              {snapshot.criticalAlerts.length === 0 ? (
                <div className="mt-6 text-center">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
                  <p className="mt-2 text-sm text-slate-300">Acil müdahale bekleyen kayıt yok.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {snapshot.criticalAlerts.slice(0, 4).map((alert) => (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3" key={alert.id}>
                      <p className="text-sm font-semibold text-amber-100">{alert.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{alert.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <Dialog open={detailPanel !== null} onOpenChange={(open) => !open && setDetailPanel(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-slate-700 bg-slate-950 text-slate-100 sm:max-w-2xl">
          {detailPanel === 'performance' && snapshot && (
            <>
              <DialogHeader>
                <DialogTitle>Çalışan performansı</DialogTitle>
                <DialogDescription className="text-slate-400">Bu ayın gerçek görev, fırsat ve portföy kayıtları.</DialogDescription>
              </DialogHeader>
              {snapshot.employeePerformance.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Aktif çalışan performansı bulunamadı.</p> : <div className="space-y-3">{snapshot.employeePerformance.map((member) => <div className="rounded-xl border border-slate-800 bg-slate-900 p-4" key={member.id}><p className="font-bold text-white">{member.name}</p><div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><SmallMetric label="Tamamlanan" value={member.completedTasks} /><SmallMetric label="Açık görev" value={member.openTasks} /><SmallMetric label="Kazanılan" value={member.wonDeals} /><SmallMetric label="Yeni portföy" value={member.newProperties} /></div></div>)}</div>}
            </>
          )}
          {detailPanel === 'alerts' && snapshot && (
            <>
              <DialogHeader><DialogTitle>Kritik uyarılar</DialogTitle><DialogDescription className="text-slate-400">Yalnız doğrulanmış görev, onay ve teslimat sorunları listelenir.</DialogDescription></DialogHeader>
              {snapshot.criticalAlerts.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Açık kritik kayıt yok.</p> : <div className="space-y-3">{snapshot.criticalAlerts.map((alert) => <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4" key={alert.id}><p className="font-bold text-amber-100">{alert.title}</p><p className="mt-1 text-sm text-slate-400">{alert.detail}</p></div>)}</div>}
            </>
          )}
          {detailPanel === 'report' && snapshot && (
            <>
              <DialogHeader><DialogTitle>Doğrulanmış özet rapor</DialogTitle><DialogDescription className="text-slate-400">Şirket kayıtlarından üretilen kısa yönetici özeti.</DialogDescription></DialogHeader>
              <p className="whitespace-pre-line rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm leading-7 text-slate-300">{snapshot.report}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, warning = false }: { label: string; value: number; icon: typeof Users; warning?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${warning ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-900/80'}`}><div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-400">{label}</span><Icon className={`h-5 w-5 ${warning ? 'text-amber-300' : 'text-cyan-300'}`} /></div><strong className="mt-3 block text-2xl text-white">{value}</strong></div>;
}

function ActionCard({ title, detail, icon: Icon, onClick, warning = false }: { title: string; detail: string; icon: typeof Users; onClick: () => void; warning?: boolean }) {
  return <button className={`rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${warning ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400/60' : 'border-slate-800 bg-slate-900/80 hover:border-cyan-400/50'}`} onClick={onClick} type="button"><Icon className={`h-5 w-5 ${warning ? 'text-amber-300' : 'text-cyan-300'}`} /><h3 className="mt-4 font-bold text-white">{title}</h3><p className="mt-1 text-sm text-slate-500">{detail}</p></button>;
}

function ActionLink({ title, detail, icon: Icon, href }: { title: string; detail: string; icon: typeof Users; href: string }) {
  return <Link className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-left transition hover:border-cyan-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300" href={href}><Icon className="h-5 w-5 text-cyan-300" /><h3 className="mt-4 font-bold text-white">{title}</h3><p className="mt-1 text-sm text-slate-500">{detail}</p></Link>;
}

function SmallMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-sm text-slate-100">{value}</strong></div>;
}

function CompanyCeoSkeleton() {
  return <div aria-label="Şirket özeti yükleniyor" className="space-y-5" role="status"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-28 rounded-2xl bg-slate-800" key={index} />)}</div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <Skeleton className="h-32 rounded-2xl bg-slate-800" key={index} />)}</div></div>;
}
