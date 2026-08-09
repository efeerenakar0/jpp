'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  LoaderCircle,
  MapPin,
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

type LocationOption = {
  id: number;
  name: string;
};

type ListingType = 'SALE' | 'RENT';
type PropertyType = 'APARTMENT' | 'RESIDENCE' | 'VILLA' | 'DETACHED_HOUSE';
type FurnishedOption = 'ANY' | 'YES' | 'NO';

export default function HuntJobPanel({
  onJobChange,
  onJobFinished,
}: HuntJobPanelProps) {
  const [listingType, setListingType] = useState<ListingType>('SALE');
  const [propertyType, setPropertyType] =
    useState<PropertyType>('APARTMENT');
  const [furnished, setFurnished] = useState<FurnishedOption>('ANY');
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [job, setJob] = useState<HuntJobSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [controlling, setControlling] = useState(false);

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
    setLoading(true);
    try {
      const created = await apiJson<{ jobId: string; status: HuntJobStatus }>(
        '/api/fabrika/hunting/jobs',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'SAHIBINDEN',
            filters: {
              listingType,
              propertyType,
              province: province.name,
              district: district.name,
              furnished,
              minPrice: minPrice ? Number(minPrice) : null,
              maxPrice: maxPrice ? Number(maxPrice) : null,
            },
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
              Bölgeni seç, portföyü otomatik oluştur
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              İl, ilçe ve ilan ayrıntılarını seç. Business AI Portföy Uzmanı
              yalnız sahibinden ilanlarını bulur, detayları sırayla işler ve
              portföyüne aktarır.
            </p>
          </div>
        </div>

        <form className="mt-5 space-y-4" onSubmit={startJob}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-slate-300">İşlem</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                onChange={(event) =>
                  setListingType(event.target.value as ListingType)
                }
                value={listingType}
              >
                <option value="SALE">Satılık</option>
                <option value="RENT">Kiralık</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Konut tipi</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                onChange={(event) =>
                  setPropertyType(event.target.value as PropertyType)
                }
                value={propertyType}
              >
                <option value="APARTMENT">Daire</option>
                <option value="RESIDENCE">Rezidans</option>
                <option value="VILLA">Villa</option>
                <option value="DETACHED_HOUSE">Müstakil ev</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Eşya durumu</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                onChange={(event) =>
                  setFurnished(event.target.value as FurnishedOption)
                }
                value={furnished}
              >
                <option value="ANY">Farketmez</option>
                <option value="YES">Eşyalı</option>
                <option value="NO">Eşyasız</option>
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <MapPin className="h-3.5 w-3.5" /> İl
              </span>
              <select
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                disabled={locationsLoading && !provinces.length}
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
                disabled={!provinceId || locationsLoading}
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
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-300">En düşük fiyat</span>
                <input
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  min="0"
                  onChange={(event) => setMinPrice(event.target.value)}
                  placeholder="₺"
                  type="number"
                  value={minPrice}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-medium text-slate-300">En yüksek fiyat</span>
                <input
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  min="0"
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder="₺"
                  type="number"
                  value={maxPrice}
                />
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
              <UserRoundCheck className="h-4 w-4" /> Kimden: Sahibinden
            </span>
            <Button
              className="h-10 bg-emerald-500 font-semibold text-emerald-950 hover:bg-emerald-400"
              disabled={loading || locationsLoading || !districtId}
              type="submit"
            >
              {loading ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SlidersHorizontal className="mr-2 h-4 w-4" />
              )}
              Portföyü oluşturmaya başla
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5 text-xs leading-5 text-sky-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Sayfa sınırı veya bekleme ayarı gerekmez. İşlem sunucuda tek tek ve
            kontrollü yürütülür; kaynak doğrulaması gösterirse güvenli biçimde
            duraklar. Yazılı CONTACT_READ yetkisi varsa sayfada görünür satıcı
            ve telefon bilgileri şifrelenerek kaydedilir.
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
