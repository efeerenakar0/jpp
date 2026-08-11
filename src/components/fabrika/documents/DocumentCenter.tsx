'use client';

import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileSignature,
  FilePlus2,
  Files,
  FileText,
  Heart,
  History,
  PenLine,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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
import styles from './DocumentCenter.module.css';

type MainTab = 'catalog' | 'drafts' | 'completed' | 'archive';

export type DocumentCenterVariant = 'standalone' | 'embedded';

type DocumentCenterProps = {
  variant?: DocumentCenterVariant;
};

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
    <article className={styles.templateCard} data-category={template.category}>
      <div className={styles.templateTopRow}>
        <span className={styles.templateIcon}>
          <FileText aria-hidden="true" />
        </span>
        <button
          type="button"
          onClick={onFavorite}
          aria-label={
            template.favorite ? 'Favorilerden kaldır' : 'Favorilere ekle'
          }
          className={
            template.favorite
              ? styles.favoriteButtonActive
              : styles.favoriteButton
          }
        >
          <Heart
            fill={template.favorite ? 'currentColor' : 'none'}
          />
        </button>
      </div>
      <div className={styles.templateCopy}>
        <p className={styles.templateCategory}>
          {DOCUMENT_CATEGORY_LABELS[template.category]}
        </p>
        <h3>{template.name}</h3>
        <p className={styles.templateDescription}>
          {template.description}
        </p>
      </div>
      <div className={styles.templateFooter}>
        <div className={styles.templateMeta}>
          <span>
            <Clock3 aria-hidden="true" />
            ~{template.estimatedMinutes} dk.
          </span>
          <span title={legalStatusLabel(template.legalStatus)}>
            v{template.version}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className={styles.prepareButton}
        >
          Hazırla
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
    <div className={styles.documentList}>
      <div className="hidden grid-cols-[minmax(250px,2fr)_minmax(160px,1fr)_130px_180px_48px] gap-4 border-b border-slate-800 bg-slate-950/40 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 md:grid">
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
              <span className="block truncate text-sm font-semibold text-white">
                {document.title}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                {document.documentNumber} · Sürüm {document.versionNumber}
              </span>
            </span>
            <span className="truncate text-xs text-slate-400">
              {document.template.name}
            </span>
            <span>
              <span
                className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${
                  statusClasses[document.status]
                }`}
              >
                {document.deletedAt
                  ? 'Çöp kutusunda'
                  : documentStatusLabel(document.status)}
              </span>
            </span>
            <span className="text-xs text-slate-500">
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

export default function DocumentCenter({
  variant = 'standalone',
}: DocumentCenterProps) {
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
  const [quickTemplateKey, setQuickTemplateKey] = useState('');
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
      thisMonth: documents.filter((document) => {
        if (document.deletedAt) return false;
        const updatedAt = new Date(document.updatedAt);
        const now = new Date();
        return (
          updatedAt.getFullYear() === now.getFullYear() &&
          updatedAt.getMonth() === now.getMonth()
        );
      }).length,
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

  const embedded = variant === 'embedded';

  return (
    <div
      className={`${styles.page} ${embedded ? styles.embeddedPage : ''}`}
      data-variant={variant}
    >
      {!embedded ? (
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>M6 · SÖZLEŞME VE BELGELER</p>
            <div className={styles.titleRow}>
              <span className={styles.titleIcon} aria-hidden="true">
                <Files />
              </span>
              <div>
                <h1>Belge Merkezi</h1>
                <p>
                  Gayrimenkul sözleşmeleri ve formlarınızı hazırlayın, onay
                  süreçlerini yönetin ve sürümlü PDF veya DOCX olarak arşivleyin.
                </p>
              </div>
            </div>
          </div>
          <div className={styles.heroActions}>
            <button type="button" onClick={() => setTab('completed')}>
              <History aria-hidden="true" /> Geçmiş
            </button>
            <button type="button" onClick={switchToCatalog}>
              <Settings2 aria-hidden="true" /> Şablon yönetimi
            </button>
          </div>
        </header>
      ) : null}

      {!embedded ? (
        <section className={styles.actionBar}>
          <button
            type="button"
            onClick={switchToCatalog}
            className={styles.newDocumentButton}
          >
            <Plus aria-hidden="true" /> Yeni belge
          </button>
          <button
            type="button"
            onClick={switchToCatalog}
            className={styles.templateManagementButton}
          >
            <FileSignature aria-hidden="true" /> Şablon kataloğu
          </button>
          <div className={styles.legalNotice}>
            <ShieldCheck aria-hidden="true" />
            <span>
              Belgeleriniz ıslak imza, e-imza ve mevzuata uygunluk kontrolüne
              hazır biçimde saklanır. {DOCUMENT_LEGAL_NOTICE}
            </span>
          </div>
        </section>
      ) : null}

      <section className={styles.metrics} aria-label="Belge Merkezi özeti">
        {[
          { label: 'Şablon', value: stats.templates, icon: Files, tone: 'green' },
          { label: 'Taslak', value: stats.drafts, icon: FileText, tone: 'blue' },
          {
            label: 'Tamamlanan',
            value: stats.completed,
            icon: CheckCircle2,
            tone: 'green',
          },
          { label: 'Bu ay hazırlanan', value: stats.thisMonth, icon: PenLine, tone: 'cyan' },
          { label: 'Arşiv ve çöp', value: stats.archive, icon: Archive, tone: 'slate' },
        ].map((stat) => (
          <article className={styles.metricCard} data-tone={stat.tone} key={stat.label}>
            <span><stat.icon aria-hidden="true" /></span>
            <div>
              <small>{stat.label}</small>
              <strong>{stat.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <nav ref={catalogRef} className={styles.tabs} aria-label="Belge görünümü">
        {tabItems.map((item) => {
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
              className={tab === item.id ? styles.activeTab : styles.tab}
            >
              {item.label}
              <span>{count}</span>
            </button>
          );
        })}
      </nav>

      <section className={styles.filterBar}>
        <label className={styles.searchField}>
          <Search aria-hidden="true" />
          <span className="sr-only">Belge veya şablon ara</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              tab === 'catalog'
                ? 'Belge adı ile ara…'
                : 'Belge adı, numarası veya şablon ara…'
            }
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
            >
              <option value="ALL">Kategori: Tümü</option>
              {DOCUMENT_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {DOCUMENT_CATEGORY_LABELS[item]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setFavoritesOnly((current) => !current)}
              className={favoritesOnly ? styles.favoriteFilterActive : styles.favoriteFilter}
            >
              <Heart fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" />
              Sadece favoriler
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
              >
                <option value="ALL">Tüm arşiv</option>
                <option value="ARCHIVED">Arşivlenenler</option>
                <option value="CANCELLED">İptal edilenler</option>
                <option value="DELETED">Çöp kutusu</option>
              </select>
            ) : null}
            <label className={styles.dateField}>
              Başlangıç
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className={styles.dateField}>
              Bitiş
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </>
        )}
      </section>

      {tab === 'catalog' ? (
        <>
          <div className={styles.catalogLayout}>
            <main className={styles.catalogPanel}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>Şablon kataloğu</h2>
                  <p>{filteredTemplates.length} profesyonel Türkçe şablon</p>
                </div>
                <span><Sparkles aria-hidden="true" /> CRM ve portföy verileriyle dolar</span>
              </div>
              {filteredTemplates.length ? (
                <div className={styles.templateGrid}>
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
            </main>

            <aside className={styles.sideRail}>
              <section className={styles.recentPanel}>
                <div className={styles.sideHeading}>
                  <div>
                    <h2>Son belgeler</h2>
                    <p>Kaldığınız işe tek tıklamayla dönün.</p>
                  </div>
                  <button type="button" onClick={() => setTab('drafts')}>
                    Tümünü görüntüle
                  </button>
                </div>
                {recentDocuments.length ? (
                  <div className={styles.recentList}>
                    {recentDocuments.map((document) => (
                      <button
                        key={document.publicId}
                        type="button"
                        onClick={() => openDocument(document)}
                      >
                        <span className={styles.recentIcon}><FileText aria-hidden="true" /></span>
                        <span className={styles.recentCopy}>
                          <strong>{document.title}</strong>
                          <small>{document.template.name}</small>
                        </span>
                        <span className={`${styles.recentStatus} ${statusClasses[document.status]}`}>
                          {documentStatusLabel(document.status)}
                        </span>
                        <time>{formatDate(document.updatedAt)}</time>
                        <ChevronRight aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className={styles.noRecent}>Henüz hazırlanmış belge yok.</p>
                )}
              </section>

              <section className={styles.quickPanel}>
                <div className={styles.sideHeading}>
                  <div>
                    <h2>Hızlı belge</h2>
                    <p>CRM ve portföy verileriyle yeni belge oluşturun.</p>
                  </div>
                </div>
                <select
                  aria-label="Hızlı belge türü"
                  value={quickTemplateKey}
                  onChange={(event) => setQuickTemplateKey(event.target.value)}
                >
                  <option value="">Belge türü seçin</option>
                  {data.templates.map((template) => (
                    <option key={template.key} value={template.key}>{template.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className={styles.quickButton}
                  disabled={!quickTemplateKey}
                  onClick={() => {
                    const template = data.templates.find((item) => item.key === quickTemplateKey);
                    if (template) openTemplate(template);
                  }}
                >
                  <Plus aria-hidden="true" /> Oluştur ve düzenle
                </button>
                <ul>
                  <li><CheckCircle2 aria-hidden="true" /> Müşteri bilgileri otomatik dolar</li>
                  <li><CheckCircle2 aria-hidden="true" /> Portföy bilgileri eklenir</li>
                  <li><CheckCircle2 aria-hidden="true" /> Sürümlü taslak oluşturulur</li>
                </ul>
              </section>
            </aside>
          </div>

          {recentDocuments.length ? (
            <section className={styles.historyStrip}>
              <div className={styles.historyHeading}>
                <h2>Son işlemler &amp; belge geçmişi</h2>
                <button type="button" onClick={() => setTab('completed')}>Tüm geçmişi görüntüle</button>
              </div>
              <div className={styles.timeline}>
                {recentDocuments.map((document, index) => (
                  <button key={document.publicId} type="button" onClick={() => openDocument(document)}>
                    <i aria-hidden="true" data-active={index === 0} />
                    <span><FileText aria-hidden="true" /></span>
                    <strong>{document.title}</strong>
                    <small>{documentStatusLabel(document.status)} · {document.lastEditedByName}</small>
                    <time>{formatDate(document.updatedAt)}</time>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
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
              <Button onClick={switchToCatalog} className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                <FilePlus2 /> Şablon seç
              </Button>
            ) : undefined
          }
        />
      )}

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
