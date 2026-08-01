'use client';

import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  FilePlus2,
  Files,
  FileText,
  Heart,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/fabrika/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_LEGAL_NOTICE,
  type DocumentCategory,
} from '@/lib/document-center/types';
import DocumentWizard from './DocumentWizard';
import {
  documentStatusLabel,
  legalStatusLabel,
} from './helpers';
import {
  filterDocumentRecords,
  filterDocumentTemplates,
} from './filters';
import type {
  DocumentCenterPayload,
  DocumentRecordDTO,
  DocumentTemplateDTO,
} from './types';

type MainTab = 'catalog' | 'drafts' | 'completed' | 'archive';

const tabItems: Array<{
  id: MainTab;
  label: string;
  icon: typeof Files;
}> = [
  { id: 'catalog', label: 'Şablon kataloğu', icon: Files },
  { id: 'drafts', label: 'Taslaklar', icon: CalendarClock },
  { id: 'completed', label: 'Tamamlananlar', icon: CheckCircle2 },
  { id: 'archive', label: 'Arşiv ve çöp', icon: Archive },
];

const statusClasses = {
  DRAFT: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  GENERATED: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  ARCHIVED: 'border-slate-600 bg-slate-800 text-slate-300',
  CANCELLED: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-label="Belge Merkezi yükleniyor">
      <Skeleton className="h-24 w-full bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 bg-slate-800" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-56 bg-slate-800" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/35 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-400">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function TemplateCard({
  template,
  onOpen,
  onFavorite,
}: {
  template: DocumentTemplateDTO;
  onOpen: () => void;
  onFavorite: () => void;
}) {
  return (
    <article className="group flex min-h-72 flex-col rounded-2xl border border-slate-800 bg-slate-900/65 p-6 transition hover:border-emerald-500/35 hover:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <FileText className="h-5 w-5" />
        </span>
        <button
          type="button"
          onClick={onFavorite}
          aria-label={
            template.favorite ? 'Favorilerden kaldır' : 'Favorilere ekle'
          }
          className={`flex h-9 w-9 items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
            template.favorite
              ? 'border-rose-500/25 bg-rose-500/10 text-rose-400'
              : 'border-slate-700 text-slate-500 hover:text-rose-400'
          }`}
        >
          <Heart
            className="h-4 w-4"
            fill={template.favorite ? 'currentColor' : 'none'}
          />
        </button>
      </div>
      <div className="mt-4 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-400">
          {DOCUMENT_CATEGORY_LABELS[template.category]}
        </p>
        <h3 className="mt-2 text-lg font-semibold leading-7 text-white">
          {template.name}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
          {template.description}
        </p>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
        <div className="text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            ~{template.estimatedMinutes} dk.
          </span>
          <span className="mx-2">·</span>
          <span title={legalStatusLabel(template.legalStatus)}>
            Sürüm {template.version}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          Hazırla
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function DocumentList({
  documents,
  onOpen,
}: {
  documents: DocumentRecordDTO[];
  onOpen: (document: DocumentRecordDTO) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/55">
      <div className="hidden grid-cols-[minmax(250px,2fr)_minmax(160px,1fr)_130px_180px_48px] gap-4 border-b border-slate-800 bg-slate-950/40 px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 md:grid">
        <span>Belge</span>
        <span>Şablon</span>
        <span>Durum</span>
        <span>Son işlem</span>
        <span />
      </div>
      <div className="divide-y divide-slate-800">
        {documents.map((document) => (
          <button
            key={document.publicId}
            type="button"
            onClick={() => onOpen(document)}
            className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-slate-800/45 focus-visible:bg-slate-800/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 md:grid-cols-[minmax(250px,2fr)_minmax(160px,1fr)_130px_180px_48px] md:items-center md:gap-4 md:px-5"
          >
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold text-white">
                {document.title}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {document.documentNumber} · Sürüm {document.versionNumber}
              </span>
            </span>
            <span className="truncate text-sm text-slate-400">
              {document.template.name}
            </span>
            <span>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  statusClasses[document.status]
                }`}
              >
                {document.deletedAt
                  ? 'Çöp kutusunda'
                  : documentStatusLabel(document.status)}
              </span>
            </span>
            <span className="text-sm text-slate-500">
              {formatDate(document.updatedAt)}
              <span className="mt-0.5 block">· {document.lastEditedByName}</span>
            </span>
            <span className="hidden h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 md:flex">
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DocumentCenter() {
  const [data, setData] = useState<DocumentCenterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<MainTab>('catalog');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'ALL' | DocumentCategory>('ALL');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [archiveStatus, setArchiveStatus] = useState<
    'ALL' | 'ARCHIVED' | 'CANCELLED' | 'DELETED'
  >('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<DocumentTemplateDTO | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentRecordDTO | null>(null);
  const catalogRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch('/api/fabrika/documents', {
        cache: 'no-store',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(payload.data as DocumentCenterPayload);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Belge Merkezi verileri alınamadı.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(true), 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const filteredTemplates = useMemo(() => {
    if (!data) return [];
    return filterDocumentTemplates(data.templates, {
      query,
      category,
      favoritesOnly,
    });
  }, [category, data, favoritesOnly, query]);

  const tabDocuments = useMemo(() => {
    if (!data) return [];
    return filterDocumentRecords(data.documents, {
      tab,
      query,
      archiveStatus,
      fromDate,
      toDate,
    });
  }, [archiveStatus, data, fromDate, query, tab, toDate]);

  const recentDocuments = useMemo(
    () => data?.documents.filter((document) => !document.deletedAt).slice(0, 5) || [],
    [data]
  );

  const stats = useMemo(() => {
    const documents = data?.documents || [];
    return {
      templates: data?.templates.length || 0,
      drafts: documents.filter(
        (document) => document.status === 'DRAFT' && !document.deletedAt
      ).length,
      completed: documents.filter(
        (document) => document.status === 'GENERATED' && !document.deletedAt
      ).length,
      archive: documents.filter(
        (document) =>
          document.deletedAt ||
          ['ARCHIVED', 'CANCELLED'].includes(document.status)
      ).length,
    };
  }, [data]);

  async function toggleFavorite(template: DocumentTemplateDTO) {
    const favorite = !template.favorite;
    setData((current) =>
      current
        ? {
            ...current,
            templates: current.templates.map((item) =>
              item.key === template.key ? { ...item, favorite } : item
            ),
          }
        : current
    );
    try {
      const response = await fetch(
        `/api/fabrika/documents/templates/${encodeURIComponent(
          template.key
        )}/favorite`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ favorite }),
        }
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
    } catch (error) {
      setData((current) =>
        current
          ? {
              ...current,
              templates: current.templates.map((item) =>
                item.key === template.key ? { ...item, favorite: !favorite } : item
              ),
            }
          : current
      );
      toast.error(
        error instanceof Error ? error.message : 'Favori güncellenemedi.'
      );
    }
  }

  function openTemplate(template: DocumentTemplateDTO) {
    setSelectedDocument(null);
    setSelectedTemplate(template);
    setWizardOpen(true);
  }

  function openDocument(document: DocumentRecordDTO) {
    setSelectedTemplate(
      data?.templates.find((template) => template.key === document.templateKey) ||
        null
    );
    setSelectedDocument(document);
    setWizardOpen(true);
  }

  function switchToCatalog() {
    setTab('catalog');
    window.requestAnimationFrame(() =>
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  }

  if (loading || !data) return <LoadingState />;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="M6 · Operasyon araçları"
        title="Belge Merkezi"
        description="Sözleşme, tutanak, izin ve müşteri belgelerini şirket ve portföy kayıtlarınızla hazırlayın; sürümlü PDF veya DOCX olarak arşivleyin."
        icon={Files}
        actions={
          <Button
            onClick={switchToCatalog}
            className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
          >
            <FilePlus2 />
            Yeni belge
          </Button>
        }
      />

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/7 p-3 text-sm leading-6 text-amber-100/80">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <p className="font-semibold text-amber-200">Hukuki kontrol uyarısı</p>
          <p>{DOCUMENT_LEGAL_NOTICE}</p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Profesyonel şablon',
            value: stats.templates,
            icon: Files,
            tone: 'emerald',
          },
          {
            label: 'Otomatik kayıtlı taslak',
            value: stats.drafts,
            icon: CalendarClock,
            tone: 'amber',
          },
          {
            label: 'Tamamlanan belge',
            value: stats.completed,
            icon: FileCheck2,
            tone: 'emerald',
          },
          {
            label: 'Arşiv ve çöp',
            value: stats.archive,
            icon: Archive,
            tone: 'slate',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <article
              key={stat.label}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/55 p-4"
            >
              <div>
                <p className="text-xs text-slate-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {stat.value}
                </p>
              </div>
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                  stat.tone === 'amber'
                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                    : stat.tone === 'slate'
                      ? 'border-slate-700 bg-slate-800 text-slate-400'
                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
            </article>
          );
        })}
      </section>

      <div
        ref={catalogRef}
        className="sticky top-0 z-20 rounded-xl border border-slate-800 bg-[#07101f]/95 p-2 shadow-xl shadow-slate-950/30 backdrop-blur"
      >
        <div className="flex gap-1 overflow-x-auto">
          {tabItems.map((item) => {
            const Icon = item.icon;
            const count =
              item.id === 'catalog'
                ? stats.templates
                : item.id === 'drafts'
                  ? stats.drafts
                  : item.id === 'completed'
                    ? stats.completed
                    : stats.archive;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  tab === item.id
                    ? 'bg-emerald-500 text-emerald-950'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    tab === item.id ? 'bg-emerald-950/15' : 'bg-slate-800'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/45 p-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <span className="sr-only">Belge veya şablon ara</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                tab === 'catalog'
                  ? 'Şablon adı, kullanım amacı veya etiket ara…'
                  : 'Belge adı, numarası veya şablon ara…'
              }
              className="h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
            />
          </label>

          {tab === 'catalog' ? (
            <>
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as 'ALL' | DocumentCategory)
                }
                aria-label="Şablon kategorisi"
                className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
              >
                <option value="ALL">Tüm kategoriler</option>
                {DOCUMENT_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {DOCUMENT_CATEGORY_LABELS[item]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setFavoritesOnly((current) => !current)}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm transition ${
                  favoritesOnly
                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                    : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Heart
                  className="h-4 w-4"
                  fill={favoritesOnly ? 'currentColor' : 'none'}
                />
                Favoriler
              </button>
            </>
          ) : (
            <>
              {tab === 'archive' ? (
                <select
                  value={archiveStatus}
                  onChange={(event) =>
                    setArchiveStatus(
                      event.target.value as
                        | 'ALL'
                        | 'ARCHIVED'
                        | 'CANCELLED'
                        | 'DELETED'
                    )
                  }
                  aria-label="Arşiv durumu"
                  className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="ALL">Tüm arşiv</option>
                  <option value="ARCHIVED">Arşivlenenler</option>
                  <option value="CANCELLED">İptal edilenler</option>
                  <option value="DELETED">Çöp kutusu</option>
                </select>
              ) : null}
              <label className="flex items-center gap-2 text-xs text-slate-500">
                Başlangıç
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                Bitiş
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-2 text-sm text-slate-200 outline-none focus:border-emerald-500"
                />
              </label>
            </>
          )}
        </div>

        {tab === 'catalog' ? (
          <>
            {recentDocuments.length > 0 && !query && category === 'ALL' ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-white">Son belgeler</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Kaldığınız işe tek tıklamayla dönün.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('drafts')}
                    className="min-h-10 rounded-lg px-3 text-sm font-medium text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200"
                  >
                    Taslakları aç
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {recentDocuments.map((document) => (
                    <button
                      key={document.publicId}
                      type="button"
                      onClick={() => openDocument(document)}
                      className="min-h-32 rounded-xl border border-slate-800 bg-slate-900/45 p-4 text-left transition hover:border-emerald-500/30 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <span className="flex items-center justify-between">
                        <FileText className="h-4 w-4 text-emerald-400" />
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            statusClasses[document.status]
                          }`}
                        >
                          {documentStatusLabel(document.status)}
                        </span>
                      </span>
                      <span className="mt-3 block truncate text-sm font-semibold text-white">
                        {document.title}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {formatDate(document.updatedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Profesyonel Türkçe belge şablonları
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {filteredTemplates.length} şablon gösteriliyor.
                  </p>
                </div>
                <span className="hidden items-center gap-1 text-xs text-slate-500 sm:inline-flex">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  Şirket, CRM ve portföy verileriyle otomatik dolar
                </span>
              </div>
              {filteredTemplates.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {filteredTemplates.map((template) => (
                    <TemplateCard
                      key={template.key}
                      template={template}
                      onOpen={() => openTemplate(template)}
                      onFavorite={() => void toggleFavorite(template)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Search}
                  title="Şablon bulunamadı"
                  description="Arama metnini veya kategori filtresini değiştirin."
                />
              )}
            </section>
          </>
        ) : tabDocuments.length ? (
          <DocumentList documents={tabDocuments} onOpen={openDocument} />
        ) : (
          <EmptyState
            icon={
              tab === 'drafts'
                ? CalendarClock
                : tab === 'completed'
                  ? FileCheck2
                  : Archive
            }
            title={
              tab === 'drafts'
                ? 'Kaydedilmiş taslak yok'
                : tab === 'completed'
                  ? 'Tamamlanmış belge yok'
                  : 'Arşivde belge yok'
            }
            description={
              tab === 'drafts'
                ? 'Bir şablon seçtiğiniz anda taslak otomatik olarak oluşturulur.'
                : tab === 'completed'
                  ? 'Zorunlu alanları tamamlayıp belgeyi oluşturduğunuzda burada görünür.'
                  : 'Arşivlenen, iptal edilen veya yumuşak silinen belgeler burada tutulur.'
            }
            action={
              tab !== 'archive' ? (
                <Button
                  onClick={switchToCatalog}
                  className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                >
                  <FilePlus2 />
                  Şablon seç
                </Button>
              ) : undefined
            }
          />
        )}
      </section>

      {wizardOpen && selectedTemplate ? (
        <DocumentWizard
          open={wizardOpen}
          template={selectedTemplate}
          existing={selectedDocument}
          context={data.context}
          principalType={data.context.principal.type}
          onClose={() => {
            setWizardOpen(false);
            setSelectedTemplate(null);
            setSelectedDocument(null);
          }}
          onChanged={() => loadData(false)}
        />
      ) : null}
    </div>
  );
}
