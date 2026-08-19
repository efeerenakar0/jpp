'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CirclePause,
  LoaderCircle,
  MapPin,
  PhoneCall,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import {
  type HuntPropertyType,
} from '@/lib/hunting-v2/property-types';
import {
  getHuntPropertyLabel,
  getHuntRule,
  HuntCategoryPicker,
  mergeHuntQuota,
  normalizeHuntPropertyType,
  normalizeHuntQuotaResponse,
  normalizeHuntQuotaSnapshot,
  type HuntQuotaView,
  type HuntScanContext,
} from './HuntQuotaGuide';
import type { HuntJobStatus, HuntJobSummary } from './types';

const STORAGE_KEY = 'jasmine-avci-v2-current-job';
const TERMINAL_STATUSES: HuntJobStatus[] = [
  'COMPLETED',
  'PARTIAL',
  'FAILED',
  'CANCELLED',
  'SOURCE_CHALLENGE',
];

const ACTIVE_JOB_STATUSES: HuntJobStatus[] = [
  'QUEUED',
  'RUNNING',
  'PAUSED',
];

export function isActiveHuntJob(status: HuntJobStatus | null | undefined) {
  return Boolean(status && ACTIVE_JOB_STATUSES.includes(status));
}

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
  onScanContextChange?: (context: HuntScanContext | null) => void;
};

type HuntJobApiSummary = HuntJobSummary & {
  propertyType?: unknown;
  requestedResults?: unknown;
  quota?: unknown;
};

type HuntJobStartResponse = {
  jobId: string;
  status: HuntJobStatus;
  propertyType?: unknown;
  requestedResults?: unknown;
  quota?: unknown;
};

type LocationOption = {
  id: number;
  name: string;
};

export default function HuntJobPanel({
  onJobChange,
  onJobFinished,
  onScanContextChange,
}: HuntJobPanelProps) {
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [propertyType, setPropertyType] = useState<HuntPropertyType | ''>('');
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [job, setJob] = useState<HuntJobApiSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [controlling, setControlling] = useState(false);
  const [quotas, setQuotas] = useState<HuntQuotaView[]>(() =>
    normalizeHuntQuotaResponse(null)
  );
  const [quotasLoading, setQuotasLoading] = useState(true);
  const startLockRef = useRef(false);

  const loadQuotas = useCallback(
    async (options?: { quiet?: boolean; signal?: AbortSignal }) => {
      if (!options?.quiet) setQuotasLoading(true);
      try {
        const payload = await apiJson<unknown>(
          '/api/fabrika/hunting/quotas',
          options?.signal ? { signal: options.signal } : undefined
        );
        if (options?.signal?.aborted) return;
        setQuotas(normalizeHuntQuotaResponse(payload));
      } catch (error) {
        if (
          options?.signal?.aborted ||
          (error instanceof DOMException && error.name === 'AbortError')
        ) {
          return;
        }
        if (!options?.quiet) setQuotas(normalizeHuntQuotaResponse(null));
      } finally {
        if (!options?.signal?.aborted) setQuotasLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadQuotas({ signal: controller.signal });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadQuotas]);

  useEffect(() => {
    const controller = new AbortController();
    void apiJson<{ items: LocationOption[] }>(
      '/api/fabrika/hunting/locations',
      { signal: controller.signal }
    )
      .then(({ items }) => setProvinces(items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        toast.error('İl seçenekleri yüklenemedi.');
      })
      .finally(() => setLocationsLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!provinceId) return;
    const controller = new AbortController();
    void apiJson<{ items: LocationOption[] }>(
      `/api/fabrika/hunting/locations?provinceId=${encodeURIComponent(provinceId)}`,
      { signal: controller.signal }
    )
      .then(({ items }) => setDistricts(items))
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        toast.error('İlçe seçenekleri yüklenemedi.');
      })
      .finally(() => setLocationsLoading(false));
    return () => controller.abort();
  }, [provinceId]);

  const loadJob = useCallback(
    async (jobId: string, quiet = false) => {
      try {
        const nextJob = await apiJson<HuntJobApiSummary>(
          `/api/fabrika/hunting/jobs/${jobId}`
        );
        const nextPropertyType = normalizeHuntPropertyType(
          nextJob.propertyType
        );
        const nextQuota = normalizeHuntQuotaSnapshot(
          nextJob,
          nextPropertyType
        );
        if (nextPropertyType) setPropertyType(nextPropertyType);
        if (nextQuota) {
          setQuotas((current) => mergeHuntQuota(current, nextQuota));
        }
        if (nextJob.status === 'SOURCE_CHALLENGE') {
          // SOURCE_CHALLENGE yalnız artık kullanılmayan eski tarayıcıdan kalan
          // terminal bir durumdur. ClearPath/Apify akışında üretilmez; eski iş
          // yeni tarama formunu kilitlememeli veya kullanıcıya bayat bir hata
          // göstermemelidir.
          window.localStorage.removeItem(STORAGE_KEY);
          setJob(null);
          onJobChange(null);
          onJobFinished();
          return nextJob;
        }
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
  const hasActiveJob = isActiveHuntJob(job?.status);
  const selectedQuota = propertyType
    ? quotas.find((quota) => quota.propertyType === propertyType) || null
    : null;
  const selectedRule = propertyType ? getHuntRule(propertyType) : null;
  const quotaExhausted = Boolean(
    selectedQuota &&
      selectedQuota.remaining !== null &&
      selectedQuota.remaining < selectedQuota.perRunLimit
  );
  const jobPropertyType = normalizeHuntPropertyType(job?.propertyType);
  const contextPropertyType = jobPropertyType || propertyType || null;
  const contextQuota = contextPropertyType
    ? quotas.find((quota) => quota.propertyType === contextPropertyType) || null
    : null;
  const requestedResultsValue =
    typeof job?.requestedResults === 'number'
      ? job.requestedResults
      : typeof job?.requestedResults === 'string'
        ? Number(job.requestedResults)
        : null;
  const contextRequestedResults =
    requestedResultsValue !== null &&
    Number.isFinite(requestedResultsValue) &&
    requestedResultsValue > 0
      ? Math.floor(requestedResultsValue)
      : contextQuota?.perRunLimit || 0;
  const liveStages = [
    { label: 'Taramayı başlat', icon: Search },
    { label: 'İlanlar taranıyor', icon: Radar },
    { label: 'Maliklerle görüşülüyor', icon: PhoneCall },
    { label: 'Yetki süreci', icon: ShieldCheck },
  ];
  const scanFinished = Boolean(
    job && ['COMPLETED', 'PARTIAL'].includes(job.status)
  );

  useEffect(() => {
    if (!onScanContextChange || !contextPropertyType || !contextQuota) {
      onScanContextChange?.(null);
      return;
    }
    onScanContextChange({
      ...contextQuota,
      propertyType: contextPropertyType,
      label: getHuntPropertyLabel(contextPropertyType),
      jobId: job?.id || null,
      requestedResults: contextRequestedResults,
    });
  }, [
    contextPropertyType,
    contextQuota,
    contextRequestedResults,
    job?.id,
    onScanContextChange,
  ]);

  async function startJob(event: React.FormEvent) {
    event.preventDefault();
    if (startLockRef.current || loading || hasActiveJob) return;
    const province = provinces.find(
      (option) => option.id === Number(provinceId)
    );
    const district = districts.find(
      (option) => option.id === Number(districtId)
    );
    if (!province || !district) {
      toast.error('İl ve ilçe seçimini tamamlayın.');
      return;
    }
    if (!propertyType) {
      toast.error('Bir gayrimenkul türü seçin.');
      return;
    }
    if (quotaExhausted) {
      toast.error('Bu kategori için aylık tarama hakkınız kalmadı.');
      return;
    }
    startLockRef.current = true;
    setLoading(true);
    try {
      const created = await apiJson<HuntJobStartResponse>(
        '/api/fabrika/hunting/jobs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'SAHIBINDEN',
            filters: {
              province: province.name,
              district: district.name,
              propertyType,
            },
          }),
        }
      );
      const createdQuota = normalizeHuntQuotaSnapshot(created, propertyType);
      if (createdQuota) {
        setQuotas((current) => mergeHuntQuota(current, createdQuota));
      }
      window.localStorage.setItem(STORAGE_KEY, created.jobId);
      await loadJob(created.jobId);
      void loadQuotas({ quiet: true });
      toast.success('Portföy içe aktarma işi kuyruğa alındı.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Av işi başlatılamadı.'
      );
    } finally {
      startLockRef.current = false;
      setLoading(false);
    }
  }

  async function controlJob(action: 'cancel') {
    if (!job) return;
    setControlling(true);
    try {
      await apiJson(`/api/fabrika/hunting/jobs/${job.id}/${action}`, {
        method: 'POST',
      });
      await loadJob(job.id);
      toast.success(
        'Av işi durduruldu.'
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
    <section
      className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]"
      data-avci-hunt-layout
    >
      <div
        className="rounded-xl border border-slate-800 bg-slate-900 p-5"
        data-avci-form-card
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
            <Search className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Satış yetkisini almak istediğiniz portföyleri belirleyin
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              AI portföy uzmanı yeni portföy fırsatlarını keşfeder ve Sizin
              yerinize malikler ile konuşarak satış yetkisi almaya çalışır.
            </p>
          </div>
        </div>

        <form
          className="mt-5 space-y-4"
          data-avci-hunt-form
          onSubmit={startJob}
        >
          <fieldset className="space-y-3" data-avci-step="1">
            <legend className="text-sm font-semibold text-slate-100">
              1. Nerede arıyorsunuz?
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <MapPin className="h-3.5 w-3.5" /> İl
              </span>
              <select
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                disabled={hasActiveJob || (locationsLoading && !provinces.length)}
                onChange={(event) => {
                  setProvinceId(event.target.value);
                  setDistrictId('');
                  setDistricts([]);
                  setLocationsLoading(Boolean(event.target.value));
                }}
                required
                value={provinceId}
              >
                <option value="">İl seçin</option>
                {provinces.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Building2 className="h-3.5 w-3.5" /> İlçe
              </span>
              <select
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                disabled={hasActiveJob || !provinceId || locationsLoading}
                onChange={(event) => setDistrictId(event.target.value)}
                required
                value={districtId}
              >
                <option value="">İlçe seçin</option>
                {districts.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            </div>
            <p className="text-xs leading-5 text-slate-400">
              Mahalle gelen ilanların kendi adresinde gösterilir.
            </p>
          </fieldset>
          <HuntCategoryPicker
            disabled={hasActiveJob}
            loading={quotasLoading}
            onSelect={setPropertyType}
            quotas={quotas}
            selected={propertyType}
          />
          <div
            className="flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 sm:flex-row sm:items-center sm:justify-between"
            data-avci-source-row
            data-avci-step="3"
          >
            <span className="grid gap-1 text-xs text-emerald-100">
              <span className="flex items-center gap-2 font-semibold">
                <UserRoundCheck className="h-4 w-4" /> Kimden: Sahibinden
                Satıcılar
              </span>
            </span>
            <Button
              aria-describedby={hasActiveJob ? 'active-hunt-explanation' : undefined}
              className="min-h-11 bg-emerald-500 px-5 font-semibold text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              disabled={
                loading ||
                hasActiveJob ||
                quotaExhausted ||
                locationsLoading ||
                !districtId ||
                !propertyType
              }
              type="submit"
            >
              {loading ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SlidersHorizontal className="mr-2 h-4 w-4" />
              )}
              {hasActiveJob
                ? 'Tarama devam ediyor'
                : quotaExhausted
                  ? 'Bu ayki hakkınız bitti'
                  : selectedRule
                    ? `${selectedRule.perRunLimit} ilanı taramaya başla`
                    : 'Taramayı başlat'}
            </Button>
          </div>
          {hasActiveJob && (
            <p
              className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2.5 text-xs leading-5 text-amber-100"
              id="active-hunt-explanation"
              role="status"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Bu tarama bitmeden yeni bir tarama başlatılamaz. Böylece aynı işlem
              yanlışlıkla iki kez çalışmaz.
            </p>
          )}
        </form>
      </div>

      <div
        className="rounded-xl border border-slate-800 bg-slate-900 p-5"
        data-avci-live-card
      >
        <div data-avci-live-header>
          <div className="flex items-start gap-2.5">
            <StatusIcon
              aria-hidden="true"
              className={`h-5 w-5 text-sky-500 ${
                job && ['RUNNING', 'QUEUED'].includes(job.status)
                  ? 'animate-spin'
                  : ''
              }`}
            />
            <div>
              <h2>Canlı görev durumu</h2>
              <p>
                {job
                  ? `Son güncelleme: ${new Intl.DateTimeFormat('tr-TR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(job.updatedAt))}`
                  : 'Tarama başladığında ilerleme burada görünecek.'}
              </p>
            </div>
          </div>
          <span data-active={hasActiveJob || undefined} data-avci-live-badge>
            {hasActiveJob ? 'Çalışıyor' : job ? STATUS_LABELS[job.status] : 'Hazır'}
          </span>
        </div>

        <ol aria-label="AI portföy avı aşamaları" data-avci-live-stages>
          {liveStages.map(({ icon: StageIcon, label }, index) => {
            const stageState = !job
              ? index === 0
                ? 'ready'
                : 'pending'
              : index === 0 || (index === 1 && scanFinished)
                ? 'complete'
                : index === 1
                  ? 'active'
                  : 'pending';
            return (
              <li data-state={stageState} key={label}>
                <span data-avci-stage-icon>
                  <StageIcon aria-hidden="true" />
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>

        {!job ? (
          <div
            className="flex min-h-44 flex-col items-center justify-center text-center"
            data-avci-live-empty
          >
            <Radar className="h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-200">
              Henüz izlenen bir av işi yok
            </p>
            <p className="mt-1 text-xs text-slate-500">
              İş başladığında güvenli ilerleme burada gösterilecek.
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-avci-job-details>
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
                {['QUEUED', 'RUNNING', 'PAUSED'].includes(
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

            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ['Tarama hedefi', contextRequestedResults],
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

            {job.errorSummary &&
              !['CANCELLED', 'SOURCE_CHALLENGE'].includes(job.status) && (
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
