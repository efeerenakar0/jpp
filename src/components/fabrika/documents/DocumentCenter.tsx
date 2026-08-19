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
  type DocumentCategory,
} from '@/lib/document-center/types';
import DocumentWizard from './DocumentWizard';
import {
  documentStatusLabel,
  findQuickStartTemplate,
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
  initialData?: DocumentCenterPayload;
  loadRemote?: boolean;
};

const quickStartSuggestions = [
  'Satış yetkilendirme sözleşmesi',
  'Kiralama yetkilendirme sözleşmesi',
  'Açık rıza metni',
] as const;

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
  initialData,
  loadRemote = true,
}: DocumentCenterProps) {
  const [data, setData] = useState<DocumentCenterPayload | null>(initialData ?? null);
  const [loading, setLoading] = useState(loadRemote && !initialData);
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
  const [quickPrompt, setQuickPrompt] = useState('');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<DocumentTemplateDTO | null>(null);
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentRecordDTO | null>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  const quickPromptRef = useRef<HTMLInputElement>(null);

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
    if (!loadRemote) return;
    const timer = window.setTimeout(() => void loadData(true), 0);
    return () => window.clearTimeout(timer);
  }, [loadData, loadRemote]);

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

  const visibleTemplates = useMemo(() => {
    const hasActiveFilter = Boolean(query.trim()) || category !== 'ALL' || favoritesOnly;
    return showAllTemplates || hasActiveFilter
      ? filteredTemplates
      : filteredTemplates.slice(0, 4);
  }, [category, favoritesOnly, filteredTemplates, query, showAllTemplates]);

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

  function focusQuickStart() {
    setTab('catalog');
    window.requestAnimationFrame(() => quickPromptRef.current?.focus());
  }

  function startFromPrompt() {
    const template = findQuickStartTemplate(data?.templates || [], quickPrompt);
    if (template) {
      openTemplate(template);
      return;
    }

    if (!quickPrompt.trim()) {
      toast.info('Hazırlamak istediğiniz belgeyi yazın.');
      quickPromptRef.current?.focus();
      return;
    }

    setQuery(quickPrompt);
    toast.info('İfadenizle eşleşen şablonları listeledim.');
    window.requestAnimationFrame(() =>
      catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  }

  if (loading || !data) return <LoadingState />;

  const embedded = variant === 'embedded';
  const filterControls = (
    <section className={styles.filterBar}>
      <label className={styles.searchField}>
        <Search aria-hidden="true" />
        <span className="sr-only">Belge veya şablon ara</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            tab === 'catalog'
              ? 'Şablon ara…'
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
  );

  return (
    <div
      className={`${styles.page} ${
        embedded ? styles.embeddedPage : styles.standalonePage
      }`}
      data-variant={variant}
    >
      {!embedded ? (
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>BELGE VE SÖZLEŞME ASİSTANI</p>
            <div className={styles.titleRow}>
              <span className={styles.titleIcon} aria-hidden="true">
                <Files />
              </span>
              <div>
                <h1>Belgelerinizi güvenle hazırlayın</h1>
                <p>
                  Sözleşmelerinizi oluşturun, düzenleyin ve tek merkezden yönetin.
                </p>
              </div>
            </div>
          </div>
          <div className={styles.heroActions}>
            <button
              type="button"
              onClick={focusQuickStart}
              className={styles.newDocumentButton}
            >
              <Plus aria-hidden="true" /> Yeni belge
            </button>
            <button
              type="button"
              onClick={switchToCatalog}
              className={styles.templateManagementButton}
            >
              <Settings2 aria-hidden="true" /> Şablon yönetimi
            </button>
          </div>
        </header>
      ) : null}

      {!embedded && tab === 'catalog' ? (
        <section className={styles.assistantCard} aria-labelledby="quick-start-title">
          <span className={styles.assistantIcon} aria-hidden="true">
            <Sparkles />
          </span>
          <div className={styles.assistantContent}>
            <h2 id="quick-start-title">Ne hazırlamak istiyorsunuz?</h2>
            <div className={styles.promptRow}>
              <label className={styles.promptField}>
                <span className="sr-only">Hazırlamak istediğiniz belge</span>
                <input
                  ref={quickPromptRef}
                  value={quickPrompt}
                  onChange={(event) => setQuickPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') startFromPrompt();
                  }}
                  placeholder="Örn. Kiralama yetkilendirme sözleşmesi hazırla"
                />
              </label>
              <button type="button" className={styles.quickStartButton} onClick={startFromPrompt}>
                <Sparkles aria-hidden="true" /> Oluşturmaya başla
              </button>
            </div>
            <div className={styles.suggestionRow} aria-label="Belge önerileri">
              <span>Öneriler:</span>
              {quickStartSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setQuickPrompt(suggestion);
                    quickPromptRef.current?.focus();
                  }}
                >
                  {suggestion.replace(' yetkilendirme', '')}
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.metrics} aria-label="Belge Merkezi özeti">
        {embedded
          ? [
              { label: 'Şablon', value: stats.templates, icon: Files, tone: 'green' },
              { label: 'Taslak', value: stats.drafts, icon: FileText, tone: 'blue' },
              { label: 'Tamamlanan', value: stats.completed, icon: CheckCircle2, tone: 'green' },
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
            ))
          : [
              { label: 'Taslaklar', value: stats.drafts, icon: FileText, tone: 'blue', tab: 'drafts' as MainTab },
              { label: 'Tamamlanan', value: stats.completed, icon: CheckCircle2, tone: 'green', tab: 'completed' as MainTab },
              { label: 'Bu ay', value: stats.thisMonth, icon: CalendarClock, tone: 'violet', tab: 'completed' as MainTab },
              { label: 'Arşiv', value: stats.archive, icon: Archive, tone: 'slate', tab: 'archive' as MainTab },
            ].map((stat) => (
              <button
                type="button"
                className={styles.metricCard}
                data-tone={stat.tone}
                data-active={tab === stat.tab}
                key={stat.label}
                onClick={() => setTab(stat.tab)}
              >
                <span><stat.icon aria-hidden="true" /></span>
                <div>
                  <small>{stat.label}</small>
                  <strong>{stat.value}</strong>
                </div>
              </button>
            ))}
      </section>

      <nav
        ref={catalogRef}
        className={`${styles.tabs} ${!embedded ? styles.standaloneTabs : ''}`}
        aria-label="Belge görünümü"
      >
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

      {embedded || tab !== 'catalog' ? filterControls : null}

      {tab === 'catalog' ? (
        <>
          <div className={styles.catalogLayout}>
            <main className={styles.catalogPanel}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>{embedded ? 'Şablon kataloğu' : 'Önerilen şablonlar'}</h2>
                  <p>{filteredTemplates.length} profesyonel Türkçe şablon</p>
                </div>
                {!embedded && filteredTemplates.length > 4 ? (
                  <button
                    type="button"
                    className={styles.showAllButton}
                    onClick={() => setShowAllTemplates((current) => !current)}
                  >
                    {showAllTemplates ? 'Daha az göster' : 'Tüm şablonları gör'}
                  </button>
                ) : (
                  <span><Sparkles aria-hidden="true" /> CRM ve portföy verileriyle dolar</span>
                )}
              </div>
              {!embedded ? filterControls : null}
              {filteredTemplates.length ? (
                <div className={styles.templateGrid}>
                  {(embedded ? filteredTemplates : visibleTemplates).map((template) => (
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
                    <h2>{embedded ? 'Son belgeler' : 'Son çalışmalar'}</h2>
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
                        <span
                          className={`${styles.recentStatus} ${statusClasses[document.status]}`}
                          data-status={document.status}
                        >
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
                {!embedded ? (
                  <div className={styles.compactLegalNotice}>
                    <ShieldCheck aria-hidden="true" />
                    <span>
                      Belgeleriniz güvenli biçimde saklanır. Kullanım öncesi hukuki uygunluğu kontrol edin.
                    </span>
                  </div>
                ) : null}
              </section>

              {embedded ? <section className={styles.quickPanel}>
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
              </section> : null}
            </aside>
          </div>

          {embedded && recentDocuments.length ? (
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
