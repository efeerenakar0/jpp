'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Camera,
  Edit3,
  ExternalLink,
  Globe2,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { buildPortfolioRows, filterPortfolioRows } from './portfolio-specialist-data';
import { QuickPortfolioWizardLauncher } from './QuickPortfolioWizardLauncher';
import type {
  HuntingListing,
  PortfolioFilter,
  PropertyStatus,
  WorkspacePayload,
} from './types';

const filters: Array<{ id: PortfolioFilter; label: string }> = [
  { id: 'all', label: 'Hepsi' },
  { id: 'negotiation', label: 'Pazarlıkta' },
  { id: 'authorized', label: 'Satış yetkisi alınanlar' },
  { id: 'joined', label: 'Portföye katılanlar' },
  { id: 'eliminated', label: 'Elenenler' },
  { id: 'published', label: 'Sitede yayında' },
];

const stageLabel = {
  YELLOW: 'Sıcak pazarlıkta',
  AUTHORIZED: 'Satış yetkisi alındı',
  GREEN: 'Portföye katıldı',
  RED: 'Pasif / elendi',
  PORTFOLIO: 'Kendi portföyümüz',
} as const;

const propertyStatusLabel: Record<PropertyStatus, string> = {
  DRAFT: 'Taslak',
  ACTIVE: 'Sitede yayında',
  RESERVED: 'Rezerve',
  SOLD: 'Satıldı',
  RENTED: 'Kiralandı',
  ARCHIVED: 'Arşivde',
};

function dateLabel(value: string | null) {
  if (!value) return 'Planlanmadı';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Planlanmadı';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || 'İşlem tamamlanamadı.');
  return payload;
}

export function PortfolioWorkspace({
  listings,
  onOpenAuthorizationBoard,
}: {
  listings: HuntingListing[];
  onOpenAuthorizationBoard: () => void;
}) {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PortfolioFilter>('all');
  const [query, setQuery] = useState('');
  const [savingPropertyId, setSavingPropertyId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadWorkspace() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiJson<{ workspace: WorkspacePayload }>(
          '/api/fabrika/workspace',
          { signal: controller.signal }
        );
        setWorkspace(response.workspace);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Portföyler yüklenemedi.'
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadWorkspace();
    return () => controller.abort();
  }, []);

  const rows = useMemo(
    () => buildPortfolioRows(listings, workspace?.properties || [], workspace?.tasks || []),
    [listings, workspace]
  );
  const visibleRows = useMemo(
    () => filterPortfolioRows(rows, filter, query),
    [filter, query, rows]
  );

  async function togglePublication(propertyId: string, isPublished: boolean) {
    setSavingPropertyId(propertyId);
    try {
      const response = await apiJson<{ workspace: WorkspacePayload; message?: string }>(
        '/api/fabrika/workspace',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set-property-status',
            id: propertyId,
            status: isPublished ? 'DRAFT' : 'ACTIVE',
            idempotencyKey: `portfolio-specialist:${propertyId}:${isPublished ? 'unpublish' : 'publish'}:${crypto.randomUUID()}`,
          }),
        }
      );
      setWorkspace(response.workspace);
      toast.success(
        isPublished
          ? 'Portföy yayından kaldırıldı.'
          : 'Portföy yayın koşulları doğrulandı ve yayına alındı.'
      );
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : 'Yayın durumu değiştirilemedi.'
      );
    } finally {
      setSavingPropertyId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-800 bg-slate-950/50">
        <span className="inline-flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Portföyler yükleniyor…
        </span>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6 text-center">
        <p className="text-sm font-semibold text-rose-100">Portföyler yüklenemedi</p>
        <p className="mt-1 text-xs text-rose-200/70">{error || 'Beklenmeyen bir hata oluştu.'}</p>
        <button
          className="mt-4 rounded-xl border border-rose-300/30 px-4 py-2 text-xs font-semibold text-rose-100"
          onClick={() => window.location.reload()}
          type="button"
        >
          Yeniden dene
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-cyan-300/25 bg-[linear-gradient(135deg,rgba(8,47,73,0.58),rgba(2,6,23,0.92)_55%)] p-5 shadow-[0_18px_50px_rgba(2,132,199,0.08)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <Plus className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                Şirket portföyü
              </p>
              <h2 className="mt-1 text-xl font-black text-white">
                Kendi Portföyümüzü Ekle
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Portföy bilgilerini ve görsellerini girin, yayın kontrollerini tamamlayın ve ilanı şirket web sitesinde yayınlanmaya hazırlayın.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 xl:items-end">
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2">
                <ImagePlus className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                Görseller
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2">
                <ShieldCheck className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                Bilgiler
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2">
                <Globe2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                Web yayını
              </span>
            </div>
            <QuickPortfolioWizardLauncher />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/55 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Portföy filtreleri">
          {filters.map((item) => (
            <button
              aria-pressed={filter === item.id}
              className={`min-h-9 shrink-0 rounded-xl border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
                filter === item.id
                  ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                  : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white'
              }`}
              key={item.id}
              onClick={() => setFilter(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <span className="sr-only">Portföy ara</span>
          <input
            className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-300/50"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Portföy, konum veya çalışan ara"
            value={query}
          />
        </label>
      </div>

      {visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/40 p-10 text-center">
          <p className="text-sm font-semibold text-white">Bu filtrede kayıt yok</p>
          <p className="mt-1 text-xs text-slate-500">Başka bir filtre seçin veya keşif akışından yeni kayıt ekleyin.</p>
        </div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleRows.map((row) => {
            const property = row.property;
            const isPublished = property?.status === 'ACTIVE';
            const publicationLocked = Boolean(
              property && ['SOLD', 'RENTED'].includes(property.status)
            );
            return (
              <article className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4" key={row.key}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-200">
                        {stageLabel[row.stage]}
                      </span>
                      {property && (
                        <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] text-slate-400">
                          {propertyStatusLabel[property.status]}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 truncate text-sm font-semibold text-white">{row.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.location || 'Konum belirtilmedi'} · {row.price || 'Fiyat belirtilmedi'}
                    </p>
                  </div>
                  {row.listing && (
                    <a
                      aria-label={`${row.title} kaynak ilanını aç`}
                      className="rounded-xl border border-slate-700 p-2 text-slate-400 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      href={row.listing.sourceUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
                    <dt className="flex items-center gap-1.5 text-slate-500"><UserRound className="h-3.5 w-3.5" /> Sorumlu çalışan</dt>
                    <dd className="mt-1 font-medium text-slate-200">{row.assignedMember?.name || 'Henüz atanmadı'}</dd>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-3">
                    <dt className="flex items-center gap-1.5 text-slate-500"><CalendarClock className="h-3.5 w-3.5" /> Sonraki işlem</dt>
                    <dd className="mt-1 font-medium text-slate-200">{dateLabel(row.nextActionAt)}</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
                  {property ? (
                    <>
                      <button
                        className="min-h-9 rounded-xl bg-cyan-300 px-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={publicationLocked || savingPropertyId === property.id}
                        onClick={() => void togglePublication(property.id, isPublished)}
                        type="button"
                      >
                        {savingPropertyId === property.id
                          ? 'Kaydediliyor…'
                          : isPublished
                            ? 'Yayından kaldır'
                            : 'Siteye al'}
                      </button>
                      <Link
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:text-white"
                        href="/fabrika/portfoyler"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> Düzenle
                      </Link>
                      <Link
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:text-white"
                        href="/fabrika/portfoyler"
                      >
                        <Camera className="h-3.5 w-3.5" aria-hidden="true" /> Görselleri görüntüle
                      </Link>
                    </>
                  ) : (
                    <button
                      className="min-h-9 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 text-xs font-semibold text-cyan-100"
                      onClick={onOpenAuthorizationBoard}
                      type="button"
                    >
                      Yetki panosunda ilerlet
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
