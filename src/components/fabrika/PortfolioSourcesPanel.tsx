'use client';

import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCode2,
  Globe2,
  KeyRound,
  Loader2,
  Network,
  Plus,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unplug,
  X,
  type LucideIcon,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/fabrika/ConfirmDialog';
import EmptyState from '@/components/fabrika/EmptyState';
import { Badge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';

type SourceType = 'JASMINE_API' | 'WORDPRESS' | 'SITEMAP' | 'HTML';
type ImportStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type PortfolioSource = {
  id: string;
  name: string;
  type: SourceType;
  baseUrl: string | null;
  feedPath: string | null;
  credentialHint: string | null;
  active: boolean;
  lastSyncStatus: string;
  lastSyncError: string | null;
  lastSyncedAt: string | null;
  _count: { imports: number };
};

type ImportItem = {
  id: string;
  sourceUrl: string | null;
  title: string;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  description: string | null;
  imageUrl: string | null;
  status: ImportStatus;
  reviewNote: string | null;
  createdAt: string;
  source: { id: string; name: string; type: string } | null;
  huntedListing: {
    id: string;
    ownerName: string | null;
    ownerPhone: string | null;
    authorizationNote: string | null;
  } | null;
  property: {
    id: string;
    title: string;
    status: string;
    referenceCode: string | null;
  } | null;
};

type SourcesResponse = {
  sources: PortfolioSource[];
  permissions: { canManageSecrets: boolean };
  metrics: {
    activeSources: number;
    pendingImports: number;
    approvedImports: number;
    sourceErrors: number;
  };
};

type ImportsResponse = {
  items: ImportItem[];
  metrics: { pending: number; approved: number; rejected: number };
};

const sourceMeta: Record<
  SourceType,
  {
    label: string;
    short: string;
    defaultPath: string;
    icon: typeof Globe2;
  }
> = {
  JASMINE_API: {
    label: 'Jasmine site API',
    short: 'Jasmine tarafından hazırlanan siteler için doğrudan bağlantı.',
    defaultPath: '/api/jasmine/portfolios',
    icon: Network,
  },
  WORDPRESS: {
    label: 'WordPress REST',
    short: 'WordPress portföy içerik türünü REST API üzerinden okur.',
    defaultPath: '/wp-json/wp/v2/property?per_page=50&_embed=1',
    icon: Globe2,
  },
  SITEMAP: {
    label: 'Sitemap + JSON-LD',
    short: 'Sitemap içindeki ilan sayfalarını güvenli önizlemeye alır.',
    defaultPath: '/sitemap.xml',
    icon: SearchCheck,
  },
  HTML: {
    label: 'JSON-LD / HTML',
    short: 'Tek bir sayfadaki yapılandırılmış ilan verisini okur.',
    defaultPath: '/',
    icon: FileCode2,
  },
};

const inputClass =
  'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20';
const selectClass =
  'h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';

function money(value: number | null) {
  if (value == null) return 'Fiyat belirtilmedi';
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: string | null) {
  if (!value) return 'Henüz eşitlenmedi';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function responseMessage(response: Response) {
  const data = (await response.json()) as {
    success?: boolean;
    error?: string;
    message?: string;
  };
  if (!response.ok || data.success === false) {
    throw new Error(data.error || 'İşlem tamamlanamadı.');
  }
  return data;
}

export default function PortfolioSourcesPanel({
  onPortfolioChanged,
}: {
  onPortfolioChanged?: () => void | Promise<void>;
}) {
  const [sourcesData, setSourcesData] = useState<SourcesResponse | null>(null);
  const [importsData, setImportsData] = useState<ImportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [rejecting, setRejecting] = useState<ImportItem | null>(null);
  const [filter, setFilter] = useState<ImportStatus>('PENDING');
  const [sourceType, setSourceType] = useState<SourceType>('JASMINE_API');
  const [helpType, setHelpType] = useState<SourceType>('JASMINE_API');
  const [helpAnswer, setHelpAnswer] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [sourcesResponse, importsResponse] = await Promise.all([
        fetch('/api/fabrika/portfolio-sources', { cache: 'no-store' }),
        fetch('/api/fabrika/portfolio-imports', { cache: 'no-store' }),
      ]);
      if (!sourcesResponse.ok || !importsResponse.ok) {
        throw new Error('Portföy bağlantı verileri yüklenemedi.');
      }
      const sourcesJson = (await sourcesResponse.json()) as {
        data: SourcesResponse;
      };
      const importsJson = (await importsResponse.json()) as {
        data: ImportsResponse;
      };
      setSourcesData(sourcesJson.data);
      setImportsData(importsJson.data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Bağlantı verileri yüklenemedi.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const filteredImports = useMemo(
    () =>
      (importsData?.items || []).filter((item) => item.status === filter),
    [filter, importsData?.items]
  );

  async function createSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey('create');
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/fabrika/portfolio-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          type: sourceType,
          baseUrl: form.get('baseUrl'),
          feedPath: form.get('feedPath') || null,
          apiKey: form.get('apiKey') || null,
        }),
      });
      const data = await responseMessage(response);
      toast.success(data.message || 'Kaynak eklendi.');
      setCreateOpen(false);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kaynak eklenemedi.');
    } finally {
      setBusyKey(null);
    }
  }

  async function sourceAction(
    source: PortfolioSource,
    action: 'sync' | 'toggle'
  ) {
    setBusyKey(`${action}:${source.id}`);
    try {
      const response = await fetch('/api/fabrika/portfolio-sources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'sync'
            ? { action, id: source.id }
            : { action, id: source.id, active: !source.active }
        ),
      });
      const data = await responseMessage(response);
      toast.success(data.message || 'Kaynak güncellendi.');
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Kaynak işlemi tamamlanamadı.'
      );
      await loadData();
    } finally {
      setBusyKey(null);
    }
  }

  async function deleteSource(id: string) {
    setBusyKey(`delete:${id}`);
    try {
      const response = await fetch(
        `/api/fabrika/portfolio-sources?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      const data = await responseMessage(response);
      toast.success(data.message || 'Kaynak kaldırıldı.');
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Kaynak kaldırılamadı.'
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function approveImport(item: ImportItem) {
    setBusyKey(`approve:${item.id}`);
    try {
      const response = await fetch('/api/fabrika/portfolio-imports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', id: item.id }),
      });
      const data = await responseMessage(response);
      toast.success(data.message || 'Portföy onaylandı.');
      await Promise.all([loadData(), onPortfolioChanged?.()]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Portföy onaylanamadı.'
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function rejectImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejecting) return;
    setBusyKey(`reject:${rejecting.id}`);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/fabrika/portfolio-imports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          id: rejecting.id,
          note: form.get('note'),
        }),
      });
      const data = await responseMessage(response);
      toast.success(data.message || 'Kayıt reddedildi.');
      setRejecting(null);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Kayıt reddedilemedi.'
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function askHelper(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey('help');
    setHelpAnswer(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/fabrika/portfolio-sources/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: helpType,
          question: form.get('question'),
        }),
      });
      const data = (await response.json()) as {
        success: boolean;
        answer?: string;
        error?: string;
      };
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Yardımcı yanıt veremedi.');
      }
      setHelpAnswer(data.answer || null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Yardımcı yanıt veremedi.'
      );
    } finally {
      setBusyKey(null);
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton className="h-48 rounded-xl bg-slate-800" key={index} />
        ))}
      </div>
    );
  }

  if (!sourcesData || !importsData) {
    return (
      <EmptyState
        icon={Unplug}
        title="Bağlantı verileri yüklenemedi"
        description="Sayfayı yenileyerek tekrar deneyin."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Kontrollü portföy bağlantısı
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
                Dış kaynaklar ve Avcı kayıtları önce önizlemeye gelir. Açık
                onayınız olmadan şirket portföyüne veya web sitesine
                yayınlanmaz.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
              onClick={() => setHelpOpen(true)}
              variant="outline"
            >
              <Bot className="h-4 w-4 text-sky-400" />
              Bağlantı yardımcısı
            </Button>
            {sourcesData.permissions.canManageSecrets && (
              <Button
                className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Kaynak ekle
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['Aktif kaynak', sourcesData.metrics.activeSources, Database],
          ['Onay bekleyen', importsData.metrics.pending, SearchCheck],
          ['Onaylanan', importsData.metrics.approved, CheckCircle2],
          ['Bağlantı hatası', sourcesData.metrics.sourceErrors, AlertTriangle],
        ] satisfies Array<[string, number, LucideIcon]>).map(
          ([label, value, Icon]) => (
          <div
            className="rounded-xl border border-slate-800 bg-slate-900 p-4"
            key={label}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">{label}</p>
              <Icon className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-white">
              {value}
            </p>
          </div>
          )
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(20rem,.8fr)_minmax(0,1.3fr)]">
        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-white">
              Bağlı web kaynakları
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {sourcesData.sources.length} kaynak tanımlı
            </p>
          </div>
          <div className="custom-scrollbar max-h-[760px] space-y-3 overflow-y-auto p-4">
            {sourcesData.sources.length === 0 ? (
              <EmptyState
                icon={Database}
                title="Henüz web kaynağı yok"
                description="Jasmine API, WordPress, sitemap veya JSON-LD bağlantısı ekleyin."
              />
            ) : (
              sourcesData.sources.map((source) => {
                const meta = sourceMeta[source.type];
                const Icon = meta?.icon || Globe2;
                const syncing = busyKey === `sync:${source.id}`;
                return (
                  <article
                    className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                    key={source.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <div className="rounded-lg border border-slate-700 bg-slate-900 p-2">
                          <Icon className="h-4 w-4 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-100">
                            {source.name}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            {meta?.label || source.type} ·{' '}
                            {source._count.imports} kayıt
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={
                          source.lastSyncStatus === 'ERROR'
                            ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                            : source.active
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-800 text-slate-400'
                        }
                        variant="outline"
                      >
                        {source.lastSyncStatus === 'ERROR'
                          ? 'Hata'
                          : source.active
                            ? 'Aktif'
                            : 'Durduruldu'}
                      </Badge>
                    </div>
                    <p className="mt-3 truncate text-xs text-slate-400">
                      {source.baseUrl}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                      <span>{dateTime(source.lastSyncedAt)}</span>
                      {source.credentialHint && (
                        <span className="inline-flex items-center gap-1">
                          <KeyRound className="h-3 w-3" />
                          {source.credentialHint}
                        </span>
                      )}
                    </div>
                    {source.lastSyncError && (
                      <p className="mt-3 rounded-md border border-rose-500/20 bg-rose-500/5 p-2 text-[11px] leading-4 text-rose-300">
                        {source.lastSyncError}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        className="h-8 border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800"
                        disabled={!source.active || syncing}
                        onClick={() => void sourceAction(source, 'sync')}
                        size="sm"
                        variant="outline"
                      >
                        {syncing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Eşitle
                      </Button>
                      {sourcesData.permissions.canManageSecrets && (
                        <>
                          <Button
                            className="h-8 border-slate-700 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800"
                            disabled={busyKey === `toggle:${source.id}`}
                            onClick={() => void sourceAction(source, 'toggle')}
                            size="sm"
                            variant="outline"
                          >
                            {source.active ? 'Durdur' : 'Etkinleştir'}
                          </Button>
                          <ConfirmDialog
                            confirmLabel="Kaynağı kaldır"
                            description="Onay geçmişi korunur; bu kaynaktan yeni eşitleme yapılamaz."
                            destructive
                            onConfirm={async () => {
                              await deleteSource(source.id);
                            }}
                            title="Portföy kaynağı kaldırılsın mı?"
                            trigger={
                              <Button
                                aria-label={`${source.name} kaynağını kaldır`}
                                className="h-8 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                                size="icon-sm"
                                variant="ghost"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        </>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Önizleme ve onay kuyruğu
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Avcı ve web kaynaklarından gelen kayıtları denetleyin
              </p>
            </div>
            <div
              aria-label="Portföy onay durumu"
              className="grid grid-cols-3 rounded-lg border border-slate-800 bg-slate-950 p-1"
              role="tablist"
            >
              {[
                ['PENDING', `Bekleyen ${importsData.metrics.pending}`],
                ['APPROVED', `Onaylı ${importsData.metrics.approved}`],
                ['REJECTED', `Red ${importsData.metrics.rejected}`],
              ].map(([status, label]) => (
                <button
                  aria-selected={filter === status}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition ${
                    filter === status
                      ? 'bg-emerald-500 text-emerald-950'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                  key={status}
                  onClick={() => setFilter(status as ImportStatus)}
                  role="tab"
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="custom-scrollbar max-h-[760px] space-y-3 overflow-y-auto p-4">
            {filteredImports.length === 0 ? (
              <EmptyState
                icon={SearchCheck}
                title="Bu durumda kayıt yok"
                description="Yeni eşitlemeler ve satış yetkisi alınan Avcı ilanları burada görünür."
              />
            ) : (
              filteredImports.map((item) => (
                <article
                  className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/50 p-4 sm:grid-cols-[6rem_minmax(0,1fr)]"
                  key={item.id}
                >
                  <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={item.imageUrl}
                      />
                    ) : (
                      <FileCode2 className="h-6 w-6 text-slate-700" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                          {item.huntedListing
                            ? 'Avcı · Satış yetkisi'
                            : item.source?.name || 'Web kaynağı'}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-100">
                          {item.title}
                        </h3>
                      </div>
                      {item.sourceUrl && (
                        <a
                          aria-label={`${item.title} kaynak sayfasını aç`}
                          className="inline-flex items-center gap-1 text-[10px] text-sky-300 hover:text-sky-200"
                          href={item.sourceUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Kaynak <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      {item.location || 'Konum yok'} ·{' '}
                      {item.roomCount || 'Oda yok'} · {money(item.price)}
                    </p>
                    {item.huntedListing && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Malik: {item.huntedListing.ownerName || 'Belirtilmedi'}
                        {item.huntedListing.ownerPhone
                          ? ` · ${item.huntedListing.ownerPhone}`
                          : ''}
                      </p>
                    )}
                    {item.reviewNote && (
                      <p className="mt-2 rounded-md border border-rose-500/20 bg-rose-500/5 p-2 text-[11px] text-rose-300">
                        {item.reviewNote}
                      </p>
                    )}
                    {item.status === 'PENDING' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          className="h-8 bg-emerald-500 text-xs text-emerald-950 hover:bg-emerald-400"
                          disabled={busyKey === `approve:${item.id}`}
                          onClick={() => void approveImport(item)}
                          size="sm"
                        >
                          {busyKey === `approve:${item.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Portföye onayla
                        </Button>
                        <Button
                          className="h-8 border-slate-700 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800"
                          onClick={() => setRejecting(item)}
                          size="sm"
                          variant="outline"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reddet
                        </Button>
                      </div>
                    )}
                    {item.property && (
                      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {item.property.referenceCode || 'Portföy'} ·{' '}
                        {item.property.status}
                      </p>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>Yeni portföy kaynağı</DialogTitle>
            <DialogDescription className="text-slate-400">
              Bağlantı ilk eşitlemede yalnızca önizleme kayıtları oluşturur.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={createSource}>
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Kaynak türü</span>
              <select
                className={selectClass}
                onChange={(event) =>
                  setSourceType(event.target.value as SourceType)
                }
                value={sourceType}
              >
                {Object.entries(sourceMeta).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs leading-5 text-sky-200">
              {sourceMeta[sourceType].short}
            </div>
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Bağlantı adı</span>
              <Input
                className={inputClass}
                name="name"
                placeholder="Örn. Akar Group web sitesi"
                required
              />
            </label>
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Web sitesi adresi</span>
              <Input
                className={inputClass}
                name="baseUrl"
                placeholder="https://ornekemlak.com"
                required
                type="url"
              />
            </label>
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Kaynak yolu</span>
              <Input
                className={inputClass}
                defaultValue={sourceMeta[sourceType].defaultPath}
                key={sourceType}
                name="feedPath"
              />
              <span className="block text-[10px] text-slate-500">
                Standart kurulumda bu değeri değiştirmeniz gerekmez.
              </span>
            </label>
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>API anahtarı — isteğe bağlı</span>
              <Input
                autoComplete="new-password"
                className={inputClass}
                name="apiKey"
                placeholder="Yalnızca kaynak site anahtar istiyorsa"
                type="password"
              />
              <span className="block text-[10px] text-slate-500">
                Anahtar şifrelenerek sunucuda saklanır ve tarayıcıya geri
                gönderilmez.
              </span>
            </label>
            <DialogFooter className="border-slate-700 bg-slate-950/60">
              <Button
                onClick={() => setCreateOpen(false)}
                type="button"
                variant="outline"
              >
                Vazgeç
              </Button>
              <Button
                className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                disabled={busyKey === 'create'}
                type="submit"
              >
                {busyKey === 'create' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Kaynağı kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setHelpOpen} open={helpOpen}>
        <DialogContent className="max-w-xl border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>AI bağlantı yardımcısı</DialogTitle>
            <DialogDescription className="text-slate-400">
              API anahtarı veya parola paylaşmadan kurulum sorunuzu yazın.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={askHelper}>
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Bağlantı türü</span>
              <select
                className={selectClass}
                onChange={(event) =>
                  setHelpType(event.target.value as SourceType)
                }
                value={helpType}
              >
                {Object.entries(sourceMeta).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Sorunuz</span>
              <Textarea
                className="min-h-24 border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                name="question"
                placeholder="WordPress portföy içerik türümü nasıl bulabilirim?"
                required
              />
            </label>
            {helpAnswer && (
              <div
                aria-live="polite"
                className="whitespace-pre-wrap rounded-lg border border-sky-500/20 bg-sky-500/5 p-4 text-xs leading-6 text-sky-100"
              >
                {helpAnswer}
              </div>
            )}
            <DialogFooter className="border-slate-700 bg-slate-950/60">
              <Button
                className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                disabled={busyKey === 'help'}
                type="submit"
              >
                {busyKey === 'help' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Adımları hazırla
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setRejecting(null)}
        open={Boolean(rejecting)}
      >
        <DialogContent className="max-w-md border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>Önizleme kaydını reddet</DialogTitle>
            <DialogDescription className="text-slate-400">
              {rejecting?.title} şirket portföyüne eklenmeyecek.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={rejectImport}>
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Reddetme notu</span>
              <Textarea
                className="min-h-24 border-slate-700 bg-slate-950 text-slate-100"
                name="note"
                placeholder="Örn. Fiyat bilgisi güncel değil; kaynakla tekrar kontrol edilecek."
                required
              />
            </label>
            <DialogFooter className="border-slate-700 bg-slate-950/60">
              <Button
                onClick={() => setRejecting(null)}
                type="button"
                variant="outline"
              >
                Vazgeç
              </Button>
              <Button
                className="bg-rose-500 text-white hover:bg-rose-400"
                disabled={Boolean(
                  rejecting && busyKey === `reject:${rejecting.id}`
                )}
                type="submit"
              >
                Kaydı reddet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
