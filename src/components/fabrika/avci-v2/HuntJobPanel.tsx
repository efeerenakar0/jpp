'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  LoaderCircle,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import type { HuntJobStatus, HuntJobSummary } from './types';

const STORAGE_KEY = 'jasmine-avci-v2-current-job';
const TERMINAL_STATUSES: HuntJobStatus[] = [
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
  'SOURCE_CHALLENGE',
];

const STATUS_LABELS: Record<HuntJobStatus, string> = {
  QUEUED: 'Kuyrukta',
  RUNNING: 'İşleniyor',
  PAUSED: 'Duraklatıldı',
  COMPLETED: 'Tamamlandı',
  PARTIAL: 'Kısmi tamamlandı',
  FAILED: 'Başarısız',
  CANCELLED: 'İptal edildi',
  SOURCE_CHALLENGE: 'Kaynak doğrulaması gerekli',
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || 'İşlem tamamlanamadı.');
  }
  return payload as T;
}

type HuntJobPanelProps = {
  onJobChange: (jobId: string | null) => void;
  onJobFinished: () => void;
};

export default function HuntJobPanel({
  onJobChange,
  onJobFinished,
}: HuntJobPanelProps) {
  const [searchUrl, setSearchUrl] = useState('');
  const [job, setJob] = useState<HuntJobSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [controlling, setControlling] = useState(false);

  const loadJob = useCallback(
    async (jobId: string, quiet = false) => {
      try {
        const nextJob = await apiJson<HuntJobSummary>(
          `/api/fabrika/hunting/jobs/${jobId}`
        );
        setJob(nextJob);
        onJobChange(nextJob.id);
        if (TERMINAL_STATUSES.includes(nextJob.status)) {
          onJobFinished();
        }
        return nextJob;
      } catch (error) {
        if (!quiet) {
          toast.error(
            error instanceof Error ? error.message : 'Av işi yüklenemedi.'
          );
        }
        return null;
      }
    },
    [onJobChange, onJobFinished]
  );

  useEffect(() => {
    const jobFromUrl = new URLSearchParams(window.location.search).get('job');
    const savedJobId =
      (jobFromUrl && /^[a-zA-Z0-9_-]{8,160}$/.test(jobFromUrl)
        ? jobFromUrl
        : null) || window.localStorage.getItem(STORAGE_KEY);
    if (savedJobId) {
      window.localStorage.setItem(STORAGE_KEY, savedJobId);
      const timer = window.setTimeout(() => {
        void loadJob(savedJobId, true).then((loaded) => {
          if (!loaded) window.localStorage.removeItem(STORAGE_KEY);
        });
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [loadJob]);

  useEffect(() => {
    if (!job || TERMINAL_STATUSES.includes(job.status)) return;
    const timer = window.setInterval(() => {
      void loadJob(job.id, true);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job, loadJob]);

  const processed =
    (job?.totalCompleted || 0) +
    (job?.totalPartial || 0) +
    (job?.totalFailed || 0);
  const progress = job?.totalDiscovered
    ? Math.min(100, Math.round((processed / job.totalDiscovered) * 100))
    : job?.status === 'COMPLETED'
      ? 100
      : 0;

  const statusIcon = useMemo(() => {
    if (!job) return Radar;
    if (job.status === 'RUNNING' || job.status === 'QUEUED')
      return LoaderCircle;
    if (job.status === 'COMPLETED') return CheckCircle2;
    if (job.status === 'PAUSED') return CirclePause;
    return AlertTriangle;
  }, [job]);
  const StatusIcon = statusIcon;

  async function startJob(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const created = await apiJson<{ jobId: string; status: HuntJobStatus }>(
        '/api/fabrika/hunting/jobs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'SAHIBINDEN',
            searchUrl: searchUrl.trim(),
            idempotencyKey: crypto.randomUUID(),
          }),
        }
      );
      window.localStorage.setItem(STORAGE_KEY, created.jobId);
      await loadJob(created.jobId);
      toast.success('Portföy içe aktarma işi kuyruğa alındı.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Av işi başlatılamadı.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function controlJob(action: 'cancel' | 'resume') {
    if (!job) return;
    setControlling(true);
    try {
      await apiJson(`/api/fabrika/hunting/jobs/${job.id}/${action}`, {
        method: 'POST',
      });
      await loadJob(job.id);
      toast.success(
        action === 'cancel' ? 'Av işi durduruldu.' : 'Av işi yeniden kuyruğa alındı.'
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'İş durumu değiştirilemedi.'
      );
    } finally {
      setControlling(false);
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
            <Search className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Portföyü tek bağlantıyla içe aktar
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              Filtrelediğin sonuç bağlantısını yapıştır. Business AI Portföy
              Bulucu sonuçları ve ilan detaylarını sırayla işler, aday
              portföyüne ekler ve son sayfada kendiliğinden tamamlar.
            </p>
          </div>
        </div>

        <form className="mt-5 space-y-3" onSubmit={startJob}>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">
              Filtrelenmiş arama URL&apos;si
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Filtrelenmiş arama URL'si"
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                onChange={(event) => setSearchUrl(event.target.value)}
                placeholder="https://www.sahibinden.com/..."
                required
                type="url"
                value={searchUrl}
              />
              <Button
                className="h-10 bg-emerald-500 font-semibold text-emerald-950 hover:bg-emerald-400"
                disabled={loading}
                type="submit"
              >
                {loading ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Radar className="mr-2 h-4 w-4" />
                )}
                Portföyü içe aktar
              </Button>
            </div>
          </label>
          <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5 text-xs leading-5 text-sky-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Sayfa sınırı veya bekleme ayarı gerekmez. İşlem sunucuda tek tek ve
            kontrollü yürütülür; kaynak doğrulaması gösterirse güvenli biçimde
            duraklar. İletişim verileri yalnızca ayrı, doğrulanmış sağlayıcı
            akışından eklenir.
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        {!job ? (
          <div className="flex min-h-44 flex-col items-center justify-center text-center">
            <Radar className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-200">
              Henüz izlenen bir av işi yok
            </p>
            <p className="mt-1 text-xs text-slate-500">
              İş başladığında güvenli ilerleme burada gösterilecek.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <StatusIcon
                  className={`h-5 w-5 text-emerald-300 ${
                    ['RUNNING', 'QUEUED'].includes(job.status)
                      ? 'animate-spin'
                      : ''
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {STATUS_LABELS[job.status]}
                  </p>
                  <p className="font-mono text-[10px] text-slate-500">
                    {job.id}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {['PAUSED', 'PARTIAL', 'FAILED', 'SOURCE_CHALLENGE'].includes(
                  job.status
                ) && (
                  <Button
                    className="h-8 border-slate-700 bg-slate-950 text-xs text-slate-200 hover:bg-slate-800"
                    disabled={controlling}
                    onClick={() => void controlJob('resume')}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <CirclePlay className="mr-1.5 h-3.5 w-3.5" />
                    Devam
                  </Button>
                )}
                {['QUEUED', 'RUNNING', 'PAUSED', 'SOURCE_CHALLENGE'].includes(
                  job.status
                ) && (
                  <Button
                    className="h-8 border-rose-500/30 bg-rose-500/10 text-xs text-rose-200 hover:bg-rose-500/20"
                    disabled={controlling}
                    onClick={() => void controlJob('cancel')}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Durdur
                  </Button>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex justify-between text-[11px] text-slate-400">
                <span>İşlenme ilerlemesi</span>
                <span>%{progress}</span>
              </div>
              <div
                aria-label={`İşlenme ilerlemesi yüzde ${progress}`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={progress}
                className="h-2 overflow-hidden rounded-full bg-slate-800"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-emerald-500 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <dl className="grid grid-cols-4 gap-2">
              {[
                ['Bulunan', job.totalDiscovered],
                ['Tamamlanan', job.totalCompleted],
                ['Kısmi', job.totalPartial],
                ['Hatalı', job.totalFailed],
              ].map(([label, value]) => (
                <div
                  className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-center"
                  key={String(label)}
                >
                  <dt className="text-[10px] text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-white">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {job.errorSummary && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{job.errorSummary}</span>
              </div>
            )}

            <Button
              className="h-8 w-full border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800"
              onClick={() => void loadJob(job.id)}
              type="button"
              variant="outline"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Durumu yenile
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
