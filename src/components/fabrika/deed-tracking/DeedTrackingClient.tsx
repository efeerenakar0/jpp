'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FilePlus2,
  FileSearch,
  Files,
  FolderKanban,
  History,
  KeyRound,
  Landmark,
  ListChecks,
  RefreshCcw,
  RotateCcw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  WalletCards,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';

import DocumentCenter from '@/components/fabrika/documents/DocumentCenter';
import { useFabrikaSession } from '@/components/fabrika/FabrikaSessionContext';
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
import { Textarea } from '@/components/ui/textarea';

import {
  deedCaseDraft,
  deedChecklistSummary,
  deedStatusLabels,
  deedTypeLabels,
  formatDeedDate,
  nextDeedStatuses,
  toIsoOrNull,
} from './format';
import {
  DEED_OPERATION_STAGES,
  DEED_PROCESS_CATEGORIES,
  DEED_PROCESS_GUIDES,
  DEED_QUICK_TYPES,
  deedProcessCategoryLabels,
  getDeedProcessGuide,
  type DeedProcessCategory,
} from './process-catalog';
import styles from './DeedTrackingClient.module.css';
import type {
  DeedCase,
  DeedCaseDraft,
  DeedCaseStatus,
  DeedCaseType,
  DeedWorkspace,
} from './types';

const inputClass =
  'min-h-11 border-[#28475b] bg-[#06131f] text-[#f4f8fa] placeholder:text-[#718797] focus-visible:border-cyan-300 focus-visible:ring-cyan-300/20';

const EMPTY_WORKSPACE: DeedWorkspace = { properties: [], contacts: [], members: [] };

type WorkspaceSection = 'overview' | 'cases' | 'guides' | 'documents';

type CreateForm = {
  title: string;
  type: DeedCaseType;
  propertyId: string;
  contactId: string;
  assignedMemberId: string;
  appointmentAt: string;
  dueAt: string;
  notes: string;
};

const EMPTY_CREATE_FORM: CreateForm = {
  title: '',
  type: 'SALE',
  propertyId: '',
  contactId: '',
  assignedMemberId: '',
  appointmentAt: '',
  dueAt: '',
  notes: '',
};

const statusStageIndex: Record<DeedCaseStatus, number> = {
  DRAFT: 0,
  PREPARING: 2,
  DOCUMENTS_MISSING: 2,
  READY_FOR_APPOINTMENT: 4,
  APPOINTMENT_SCHEDULED: 5,
  COMPLETED: 6,
  CANCELLED: 0,
};

function statusTone(status: DeedCaseStatus) {
  if (status === 'COMPLETED') return 'teal';
  if (status === 'DOCUMENTS_MISSING' || status === 'CANCELLED') return 'rose';
  if (status === 'READY_FOR_APPOINTMENT' || status === 'APPOINTMENT_SCHEDULED') return 'cyan';
  return 'amber';
}

function isOpenCase(deedCase: DeedCase) {
  return !['COMPLETED', 'CANCELLED'].includes(deedCase.status);
}

function isDueSoon(value: string | null) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return time - Date.now() <= 3 * 24 * 60 * 60 * 1000;
}

function LoadingCases() {
  return (
    <div className={styles.loadingGrid} aria-label="Tapu takip dosyaları yükleniyor">
      {[0, 1, 2, 3].map((item) => (
        <div className={styles.loadingCard} key={item} />
      ))}
    </div>
  );
}

function DeedCaseCard({
  deedCase,
  onOpen,
}: {
  deedCase: DeedCase;
  onOpen: (item: DeedCase) => void;
}) {
  const summary = deedChecklistSummary(deedCase.checklist);
  const progress = summary.total > 0
    ? Math.round((summary.completed / summary.total) * 100)
    : 0;

  return (
    <article className={styles.caseCard}>
      <div className={styles.caseTop}>
        <div className={styles.caseBadges}>
          <span className={styles.statusBadge} data-tone={statusTone(deedCase.status)}>
            {deedStatusLabels[deedCase.status]}
          </span>
          <span className={styles.typeBadge}>{deedTypeLabels[deedCase.type]}</span>
        </div>
        {summary.missingRequired > 0 && isOpenCase(deedCase) ? (
          <span className={styles.riskBadge}>
            {summary.missingRequired} eksik
          </span>
        ) : null}
      </div>

      <h3 title={deedCase.title}>{deedCase.title}</h3>
      <p className={styles.caseProperty}>
        {deedCase.property
          ? `${deedCase.property.referenceCode} · ${deedCase.property.title}`
          : 'Henüz bir portföye bağlanmadı'}
      </p>

      <div className={styles.progressHead}>
        <span>Evrak hazırlığı</span>
        <span>{summary.completed}/{summary.total} tamamlandı</span>
      </div>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={`${deedCase.title} evrak ilerlemesi`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>

      <dl className={styles.caseMeta}>
        <div>
          <dt>Sorumlu</dt>
          <dd>{deedCase.assignedMember?.name || 'Henüz atanmadı'}</dd>
        </div>
        <div>
          <dt>Son tarih</dt>
          <dd>{formatDeedDate(deedCase.dueAt, false)}</dd>
        </div>
      </dl>

      <button className={styles.caseOpenButton} type="button" onClick={() => onOpen(deedCase)}>
        Dosyayı aç <ArrowRight aria-hidden="true" />
      </button>
    </article>
  );
}

function EmptyCases({ onCreate }: { onCreate: () => void }) {
  return (
    <div className={styles.emptyState}>
      <span><FolderKanban aria-hidden="true" /></span>
      <h2>Henüz tapu takip dosyası yok</h2>
      <p>
        İşlem türünü seçin; sistem size gerekli evrakı, sıradaki adımı, sorumluyu
        ve tarihleri tek tek göstersin.
      </p>
      <button className={styles.primaryButton} type="button" onClick={onCreate}>
        <FilePlus2 aria-hidden="true" /> İlk dosyayı oluştur
      </button>
    </div>
  );
}

export function DeedTrackingView({
  cases,
  error,
  loading,
  onCreate,
  onOpen,
  onRefresh,
  onStartGuide = onCreate,
}: {
  cases: DeedCase[];
  error: string | null;
  loading: boolean;
  onCreate: () => void;
  onOpen: (item: DeedCase) => void;
  onRefresh: () => void;
  onStartGuide?: (guideId?: string) => void;
}) {
  const [section, setSection] = useState<WorkspaceSection>('overview');
  const [caseQuery, setCaseQuery] = useState('');
  const [caseStatus, setCaseStatus] = useState<'ALL' | DeedCaseStatus>('ALL');
  const [caseType, setCaseType] = useState<'ALL' | DeedCaseType>('ALL');
  const [guideQuery, setGuideQuery] = useState('');
  const [guideCategory, setGuideCategory] = useState<'ALL' | DeedProcessCategory>('ALL');
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);

  const completed = cases.filter((item) => item.status === 'COMPLETED').length;
  const openCases = cases.filter(isOpenCase);
  const missing = openCases.filter(
    (item) => deedChecklistSummary(item.checklist).missingRequired > 0
  ).length;
  const appointments = openCases.filter(
    (item) => item.status === 'APPOINTMENT_SCHEDULED'
  ).length;

  const filteredCases = useMemo(() => {
    const normalized = caseQuery.trim().toLocaleLowerCase('tr-TR');
    return cases.filter((item) => {
      if (caseStatus !== 'ALL' && item.status !== caseStatus) return false;
      if (caseType !== 'ALL' && item.type !== caseType) return false;
      if (!normalized) return true;
      return [
        item.title,
        item.property?.title,
        item.property?.referenceCode,
        item.contact?.name,
        item.assignedMember?.name,
      ].some((value) => value?.toLocaleLowerCase('tr-TR').includes(normalized));
    });
  }, [caseQuery, caseStatus, caseType, cases]);

  const filteredGuides = useMemo(() => {
    const normalized = guideQuery.trim().toLocaleLowerCase('tr-TR');
    return DEED_PROCESS_GUIDES.filter((guide) => {
      if (guideCategory !== 'ALL' && guide.category !== guideCategory) return false;
      if (!normalized) return true;
      return [guide.title, guide.shortTitle, guide.description, guide.audience]
        .join(' ')
        .toLocaleLowerCase('tr-TR')
        .includes(normalized);
    });
  }, [guideCategory, guideQuery]);

  const priorityItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      detail: string;
      tone: 'rose' | 'amber' | 'cyan';
      icon: typeof AlertTriangle;
      deedCase: DeedCase;
    }> = [];

    openCases.forEach((item) => {
      const summary = deedChecklistSummary(item.checklist);
      if (summary.missingRequired > 0) {
        items.push({
          id: `missing-${item.id}`,
          title: `${summary.missingRequired} zorunlu evrak bekliyor`,
          detail: item.title,
          tone: 'rose',
          icon: AlertTriangle,
          deedCase: item,
        });
      }
      if (item.status === 'APPOINTMENT_SCHEDULED') {
        items.push({
          id: `appointment-${item.id}`,
          title: 'Tapu randevusu planlandı',
          detail: `${item.title} · ${formatDeedDate(item.appointmentAt)}`,
          tone: 'cyan',
          icon: CalendarClock,
          deedCase: item,
        });
      } else if (isDueSoon(item.dueAt)) {
        items.push({
          id: `due-${item.id}`,
          title: 'Son tarih yaklaşıyor',
          detail: `${item.title} · ${formatDeedDate(item.dueAt, false)}`,
          tone: 'amber',
          icon: Clock3,
          deedCase: item,
        });
      }
    });

    return items.slice(0, 5);
  }, [openCases]);

  const navItems: Array<{
    id: WorkspaceSection;
    label: string;
    icon: typeof Landmark;
    count?: number;
  }> = [
    { id: 'overview', label: 'Bugün', icon: Sparkles },
    { id: 'cases', label: 'Takip dosyaları', icon: FolderKanban, count: openCases.length },
    { id: 'guides', label: 'İşlem rehberi', icon: Workflow, count: DEED_PROCESS_GUIDES.length },
    { id: 'documents', label: 'Belge oluştur', icon: Files, count: 50 },
  ];

  const controlCards = [
    {
      title: 'Yetki ve kimlik',
      description: 'Malik, temsilci, vekâlet kapsamı ve taraf bilgilerinin birbiriyle uyuştuğunu doğrulayın.',
      icon: UserRoundCheck,
    },
    {
      title: 'Tapu ve takyidat',
      description: 'Güncel kayıt, pay, adres, ipotek, haciz, şerh ve kullanım haklarını resmî kaynaktan kontrol edin.',
      icon: FileSearch,
    },
    {
      title: 'Yapı ve sigorta',
      description: 'DASK, ruhsat, iskân, enerji kimliği ve proje-fiilî durum uyumunu dosyaya ekleyin.',
      icon: Building2,
    },
    {
      title: 'Bedel ve ödeme',
      description: 'Gerçek satış bedeli, belediye değeri, ödeme sahibi, harç ve masrafları açıkça kaydedin.',
      icon: WalletCards,
    },
    {
      title: 'Resmî başvuru',
      description: 'Web Tapu şifresi almayın; başvuru no, SMS, harç ve randevuyu kullanıcı beyanıyla takip edin.',
      icon: KeyRound,
    },
    {
      title: 'İnsan onayı',
      description: 'AI yalnız eksik ve çelişkiyi işaretler; hukuk, mali ve resmî kararları yetkili kişi verir.',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroMain}>
            <span className={styles.heroIcon}><Landmark aria-hidden="true" /></span>
            <div>
              <p className={styles.eyebrow}>AI TAPU TAKİP · OPERASYON MERKEZİ</p>
              <h1>Tapu işlemleriniz, sade ve kontrol altında</h1>
              <p className={styles.heroDescription}>
                Hangi evrakın gerektiğini, sıradaki adımı, sorumluyu ve randevuyu
                tek ekranda görün. Karmaşık resmî süreci anlaşılır görevlerle yönetin.
              </p>
            </div>
          </div>
          <div className={styles.heroActions}>
            <button className={styles.primaryButton} type="button" onClick={onCreate}>
              <FilePlus2 aria-hidden="true" /> Yeni tapu dosyası
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => setSection('documents')}>
              <Files aria-hidden="true" /> Belge oluştur
            </button>
            <button className={styles.quietButton} type="button" onClick={onRefresh} disabled={loading}>
              <RefreshCcw className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Yenile
            </button>
          </div>
          <div className={styles.heroFoot}>
            <div className={styles.trustItem}>
              <ShieldAlert aria-hidden="true" />
              <div>
                <strong>Resmî Tapu sistemi bağlantısı yok</strong>
                Bu alan ekip içi hazırlık ve takip içindir; Web Tapu’ya kendiliğinden işlem göndermez.
              </div>
            </div>
            <div className={styles.trustItem}>
              <BadgeCheck aria-hidden="true" />
              <div>
                <strong>Hukuki kontrol ve insan onayı gerekir</strong>
                İmza, resmî başvuru ve hukuki karar öncesinde yetkili uzman doğrulaması yapılır.
              </div>
            </div>
          </div>
        </header>

        <nav className={styles.nav} aria-label="AI Tapu Takip bölümleri">
          {navItems.map((item) => (
            <button
              className={section === item.id ? styles.navActive : undefined}
              key={item.id}
              type="button"
              aria-current={section === item.id ? 'page' : undefined}
              onClick={() => setSection(item.id)}
            >
              <item.icon aria-hidden="true" />
              {item.label}
              {typeof item.count === 'number' ? <span className={styles.navBadge}>{item.count}</span> : null}
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          {error ? (
            <div className={styles.errorPanel} role="alert">
              <div>
                <strong>Tapu takip verileri alınamadı</strong>
                <p>{error}</p>
              </div>
              <button className={styles.quietButton} type="button" onClick={onRefresh}>
                <RotateCcw aria-hidden="true" /> Yeniden dene
              </button>
            </div>
          ) : null}

          {section === 'overview' ? (
            <>
              <section className={styles.metrics} aria-label="Tapu takip özeti">
                {[
                  { label: 'Açık dosya', value: openCases.length, icon: FolderKanban, tone: 'cyan' },
                  { label: 'Eksik evraklı', value: missing, icon: AlertTriangle, tone: 'rose' },
                  { label: 'Planlı randevu', value: appointments, icon: CalendarClock, tone: 'amber' },
                  { label: 'Tamamlanan', value: completed, icon: CheckCircle2, tone: 'teal' },
                ].map(({ label, value, icon: Icon, tone }) => (
                  <article className={styles.metricCard} key={label}>
                    <span className={styles.metricIcon} data-tone={tone}><Icon aria-hidden="true" /></span>
                    <div className={styles.metricCopy}>
                      <small>{label}</small>
                      <strong>{value}</strong>
                    </div>
                  </article>
                ))}
              </section>

              <section className={styles.complianceStrip} aria-label="Güncel işlem notları">
                <article>
                  <span data-tone="amber"><CalendarClock aria-hidden="true" /></span>
                  <div>
                    <strong>Güvenli Ödeme: 1 Ekim 2026</strong>
                    <p>Satış bedelinin güvenli aktarım zorunluluğu bu tarihte başlayacak; dosyanızı şimdiden ödeme sahibi ve hesap bilgileriyle hazırlayın.</p>
                  </div>
                </article>
                <article>
                  <span data-tone="cyan"><Archive aria-hidden="true" /></span>
                  <div>
                    <strong>Yetki dosyasını en az 5 yıl saklayın</strong>
                    <p>Yetkilendirme sözleşmesini ve ilgili işlem belgelerini kapanıştan sonra da düzenli, erişilebilir ve şirket bazında arşivleyin.</p>
                  </div>
                </article>
              </section>

              <div className={styles.overviewGrid}>
                <section className={styles.panel} aria-labelledby="today-title">
                  <div className={styles.panelHeading}>
                    <div>
                      <h2 id="today-title">Bugün ne yapmalıyım?</h2>
                      <p>Önce dikkat isteyen işleri sizin için öne çıkardık.</p>
                    </div>
                    <span className={styles.headingIcon}><Sparkles aria-hidden="true" /></span>
                  </div>
                  {priorityItems.length ? (
                    <div className={styles.taskList}>
                      {priorityItems.map((item) => (
                        <div className={styles.taskRow} key={item.id}>
                          <span className={styles.taskTone} data-tone={item.tone}><item.icon aria-hidden="true" /></span>
                          <div className={styles.taskCopy}>
                            <strong>{item.title}</strong>
                            <span>{item.detail}</span>
                          </div>
                          <button className={styles.taskAction} type="button" onClick={() => onOpen(item.deedCase)}>
                            Aç
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.allClear}>
                      <CheckCircle2 aria-hidden="true" />
                      <strong>Bugün kritik bir iş görünmüyor</strong>
                      <p>Yeni dosya açabilir veya işlem rehberinden sıradaki tapu sürecinizi seçebilirsiniz.</p>
                    </div>
                  )}
                </section>

                <aside className={styles.panel} aria-labelledby="quick-title">
                  <div className={styles.panelHeading}>
                    <div>
                      <h2 id="quick-title">Hızlı başla</h2>
                      <p>En sık kullanılan üç işlem.</p>
                    </div>
                    <span className={styles.headingIcon}><ArrowRight aria-hidden="true" /></span>
                  </div>
                  <div className={styles.quickActions}>
                    <button className={styles.quickAction} type="button" onClick={onCreate}>
                      <span><FilePlus2 aria-hidden="true" /></span>
                      <span><strong>Yeni takip dosyası</strong><small>İşlem türünü seçip üç adımda açın</small></span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                    <button className={styles.quickAction} type="button" onClick={() => setSection('documents')}>
                      <span><Files aria-hidden="true" /></span>
                      <span><strong>Profesyonel belge hazırla</strong><small>50 şablondan seçip PDF indirin</small></span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                    <button className={styles.quickAction} type="button" onClick={() => setSection('guides')}>
                      <span><Workflow aria-hidden="true" /></span>
                      <span><strong>Hangi işlem olduğunu bul</strong><small>Sade açıklamalı işlem rehberine bakın</small></span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </aside>
              </div>

              <section className={`${styles.panel} ${styles.stagesSection}`} aria-labelledby="stages-title">
                <div className={styles.sectionHeading}>
                  <div>
                    <h2 id="stages-title">Tapu işlemi 6 kolay adımda</h2>
                    <p>Her dosyada aynı sade düzeni görürsünüz; nerede kaldığınızı kaybetmezsiniz.</p>
                  </div>
                </div>
                <div className={styles.stageRail}>
                  {DEED_OPERATION_STAGES.map((stage) => (
                    <article className={styles.stageCard} key={stage.id}>
                      <span className={styles.stageNumber}>{stage.number}</span>
                      <h3>{stage.title}</h3>
                      <p>{stage.description}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className={`${styles.panel} ${styles.controlsSection}`} aria-labelledby="control-title">
                <div className={styles.sectionHeading}>
                  <div>
                    <h2 id="control-title">Hiç atlanmaması gereken kontroller</h2>
                    <p>AI eksik veya çelişkili alanı işaretler; son kararı yetkili kişi verir.</p>
                  </div>
                </div>
                <div className={styles.controlsGrid}>
                  {controlCards.map(({ title, description, icon: Icon }) => (
                    <article className={styles.controlCard} key={title}>
                      <Icon aria-hidden="true" />
                      <h3>{title}</h3>
                      <p>{description}</p>
                    </article>
                  ))}
                </div>
              </section>

              {openCases.length ? (
                <section className={`${styles.panel} ${styles.casesSection}`} aria-labelledby="active-title">
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2 id="active-title">Aktif tapu dosyaları</h2>
                      <p>Sonuçlandırmanız gereken dosyalara hızlıca dönün.</p>
                    </div>
                    <button className={styles.quietButton} type="button" onClick={() => setSection('cases')}>
                      Tümünü göster <ArrowRight aria-hidden="true" />
                    </button>
                  </div>
                  <div className={styles.caseGrid}>
                    {openCases.slice(0, 4).map((deedCase) => (
                      <DeedCaseCard deedCase={deedCase} key={deedCase.id} onOpen={onOpen} />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {section === 'cases' ? (
            <section className={styles.panel} aria-labelledby="cases-title">
              <div className={styles.sectionHeading}>
                <div>
                  <h2 id="cases-title">Tapu takip dosyaları</h2>
                  <p>Hazırlık, eksik evrak, randevu ve tamamlanma durumunu tek listede izleyin.</p>
                </div>
                <button className={styles.primaryButton} type="button" onClick={onCreate}>
                  <FilePlus2 aria-hidden="true" /> Yeni dosya
                </button>
              </div>
              <div className={styles.toolbar}>
                <label className={styles.searchField}>
                  <Search aria-hidden="true" />
                  <span className="sr-only">Tapu dosyalarında ara</span>
                  <input value={caseQuery} onChange={(event) => setCaseQuery(event.target.value)} placeholder="Dosya, portföy veya müşteri ara" />
                </label>
                <select aria-label="Dosya durumu" value={caseStatus} onChange={(event) => setCaseStatus(event.target.value as 'ALL' | DeedCaseStatus)}>
                  <option value="ALL">Tüm durumlar</option>
                  {Object.entries(deedStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select aria-label="İşlem türü" value={caseType} onChange={(event) => setCaseType(event.target.value as 'ALL' | DeedCaseType)}>
                  <option value="ALL">Tüm işlemler</option>
                  {Object.entries(deedTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              {loading && !cases.length ? (
                <div className="mt-4"><LoadingCases /></div>
              ) : filteredCases.length ? (
                <div className={styles.caseGrid}>
                  {filteredCases.map((deedCase) => <DeedCaseCard deedCase={deedCase} key={deedCase.id} onOpen={onOpen} />)}
                </div>
              ) : (
                <div className="mt-4"><EmptyCases onCreate={onCreate} /></div>
              )}
            </section>
          ) : null}

          {section === 'guides' ? (
            <>
              <div className={styles.guideIntro}>
                <section className={`${styles.guidePanel} ${styles.guideHero}`}>
                  <p className={styles.eyebrow}>SADE İŞLEM REHBERİ</p>
                  <h2>Ne yapacağınızı bilmiyorsanız buradan başlayın</h2>
                  <p>
                    İşlem adını seçtiğinizde gereken ana adımları, evrakları ve riskleri gösteririz.
                    <strong> Resmî başvuru veya hukuki karar sizin onayınız olmadan yapılmaz.</strong>
                  </p>
                </section>
                <aside className={`${styles.guidePanel} ${styles.officialBoundary}`}>
                  <ShieldAlert aria-hidden="true" />
                  <div>
                    <h2>Şifre ve resmî belge sınırı</h2>
                    <p>Web Tapu/e-Devlet şifresi istenmez. Tapu senedi, DASK, rayiç, değerleme, vekâlet ve mahkeme/noter belgesi bu uygulamada üretilmez; yalnız resmî kaynaktan doğrulanır.</p>
                  </div>
                </aside>
              </div>
              <section className={`${styles.panel} ${styles.casesSection}`} aria-labelledby="guide-list-title">
                <div className={styles.sectionHeading}>
                  <div>
                    <h2 id="guide-list-title">Tapu işlem rehberi</h2>
                    <p>{filteredGuides.length} işlem türü gösteriliyor.</p>
                  </div>
                </div>
                <div className={styles.toolbar}>
                  <label className={styles.searchField}>
                    <Search aria-hidden="true" />
                    <span className="sr-only">Tapu işlemi ara</span>
                    <input value={guideQuery} onChange={(event) => setGuideQuery(event.target.value)} placeholder="Örn. ipotek, miras, yabancı satış" />
                  </label>
                </div>
                <div className={styles.categoryChips} aria-label="İşlem kategorileri">
                  <button className={guideCategory === 'ALL' ? styles.chipActive : undefined} type="button" onClick={() => setGuideCategory('ALL')}>Tümü</button>
                  {DEED_PROCESS_CATEGORIES.map((category) => (
                    <button className={guideCategory === category ? styles.chipActive : undefined} key={category} type="button" onClick={() => setGuideCategory(category)}>
                      {deedProcessCategoryLabels[category]}
                    </button>
                  ))}
                </div>
                {filteredGuides.length ? (
                  <div className={styles.guideGrid}>
                    {filteredGuides.map((guide) => (
                      <Fragment key={guide.id}>
                        <article className={styles.guideCard}>
                          <div className={styles.guideCardTop}>
                            <span className={styles.guideIcon}><Landmark aria-hidden="true" /></span>
                            <div className={styles.guideMeta}>
                              <span>{deedProcessCategoryLabels[guide.category]}</span>
                              <span>{guide.duration}</span>
                            </div>
                          </div>
                          <h3>{guide.title}</h3>
                          <p>{guide.description}</p>
                          <div className={styles.guideStats}>
                            <span><ListChecks aria-hidden="true" /> {guide.steps.length} adım</span>
                            <span><Files aria-hidden="true" /> {guide.documents.length} ana evrak</span>
                          </div>
                          <div className={styles.guideActions}>
                            <button className={styles.guideStart} type="button" onClick={() => onStartGuide(guide.id)}>
                              Bu işlemi başlat
                            </button>
                            <button className={styles.guideMore} type="button" aria-label={`${guide.title} ayrıntılarını ${expandedGuide === guide.id ? 'kapat' : 'aç'}`} aria-expanded={expandedGuide === guide.id} onClick={() => setExpandedGuide((current) => current === guide.id ? null : guide.id)}>
                              {expandedGuide === guide.id ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                            </button>
                          </div>
                        </article>
                        {expandedGuide === guide.id ? (
                          <div className={styles.guideDetails}>
                            <div>
                              <h3>Adım adım süreç</h3>
                              <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                            </div>
                            <div>
                              <h3>Hazırlanacak ana evrak</h3>
                              <ul>{guide.documents.map((document) => <li key={document}>{document}</li>)}</ul>
                            </div>
                            <div>
                              <h3>İnsan kontrolü isteyen riskler</h3>
                              <ul>{guide.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul>
                            </div>
                            <div className={styles.officialAction}>
                              <ShieldAlert aria-hidden="true" /> {guide.officialAction}
                            </div>
                          </div>
                        ) : null}
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <span><Search aria-hidden="true" /></span>
                    <h2>İşlem bulunamadı</h2>
                    <p>Arama kelimesini veya kategori seçimini değiştirin.</p>
                  </div>
                )}
              </section>
            </>
          ) : null}

          {section === 'documents' ? (
            <section className={styles.documentsPanel} aria-labelledby="documents-title">
              <header className={styles.documentsIntro}>
                <div>
                  <p className={styles.eyebrow}>YERLEŞİK BELGE STÜDYOSU</p>
                  <h2 id="documents-title">Belgeyi seçin, yalnız gerekli alanları doldurun</h2>
                  <p>
                    Başka sayfaya gitmeden şablonu açın; müşteri, şirket ve portföy bilgileri otomatik dolsun.
                    Canlı A4 önizlemeyi kontrol edip profesyonel PDF veya DOCX olarak indirin.
                  </p>
                </div>
                <div className={styles.documentCount}><strong>50</strong><small>profesyonel şablon</small></div>
              </header>
              <DocumentCenter variant="embedded" />
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CaseDetailDialog({
  deedCase,
  draft,
  isOwner,
  members,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  deedCase: DeedCase;
  draft: DeedCaseDraft;
  isOwner: boolean;
  members: DeedWorkspace['members'];
  saving: boolean;
  onChange: (draft: DeedCaseDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const summary = deedChecklistSummary(draft.checklist);
  const allowedStatuses = [deedCase.status, ...nextDeedStatuses[deedCase.status]];
  const currentStage = statusStageIndex[draft.status];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] overflow-hidden border border-[#28475b] bg-[#081622] p-0 text-[#f4f8fa] sm:max-w-6xl">
        <DialogHeader className="border-b border-[#28475b] px-5 py-4 pr-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">{deedTypeLabels[deedCase.type]}</span>
            <span className="text-xs text-[#8da5b4]">Sürüm {deedCase.version}</span>
          </div>
          <DialogTitle className="mt-2 text-xl">{deedCase.title}</DialogTitle>
          <DialogDescription className="text-[#9bb0be]">
            {deedCase.property?.referenceCode || 'Portföy bağlanmadı'} · {deedStatusLabels[draft.status]}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-[#28475b] bg-[#06131f] px-5 py-4">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Tapu işlem aşamaları">
            {DEED_OPERATION_STAGES.map((stage, index) => (
              <div className={`rounded-lg border px-3 py-2 ${index < currentStage ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : index === currentStage ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100' : 'border-[#1c3547] bg-[#081622] text-[#718797]'}`} key={stage.id}>
                <span className="text-[10px] font-bold">{stage.number}</span>
                <p className="mt-1 text-xs font-semibold">{stage.title}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5 border-b border-[#28475b] p-5 lg:border-b-0 lg:border-r">
            {summary.missingRequired > 0 ? (
              <div role="alert" className="flex gap-2 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Zorunlu {summary.missingRequired} evrak tamamlanmadı. Randevuya hazır veya tamamlandı durumuna geçilemez.
              </div>
            ) : (
              <div className="flex gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Zorunlu evraklar işaretlendi. Resmî kaynak ve yetkili uzman doğrulamasını unutmayın.
              </div>
            )}

            <section aria-labelledby="checklist-title">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="checklist-title" className="font-semibold">Evrak kontrol listesi</h3>
                  <p className="mt-1 text-xs text-[#8da5b4]">Elinizde veya resmî kaynaktan doğrulanmış olanları işaretleyin.</p>
                </div>
                <span className="shrink-0 rounded-full border border-[#28475b] px-2.5 py-1 text-xs text-[#9bb0be]">{summary.completed}/{summary.total}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {draft.checklist.map((item, index) => (
                  <label key={item.key} className="flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border border-[#1c3547] bg-[#06131f] p-3 transition-colors hover:border-cyan-300/30">
                    <input type="checkbox" className="mt-0.5 size-4 accent-cyan-300" checked={item.completed} onChange={(event) => onChange({ ...draft, checklist: draft.checklist.map((current, currentIndex) => currentIndex === index ? { ...current, completed: event.target.checked } : current) })} />
                    <span className="text-sm leading-5 text-[#dce8ed]">{item.label}{item.required ? <span className="ml-1 text-rose-300" aria-label="zorunlu">*</span> : <small className="ml-1 text-[#718797]">(isteğe bağlı)</small>}</span>
                  </label>
                ))}
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Süreç durumu</span>
                <select className={`${inputClass} w-full rounded-lg px-3`} value={draft.status} disabled={allowedStatuses.length <= 1} onChange={(event) => onChange({ ...draft, status: event.target.value as DeedCaseStatus })}>
                  {allowedStatuses.map((status) => <option key={status} value={status}>{deedStatusLabels[status]}</option>)}
                </select>
              </label>
              {isOwner ? (
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Sorumlu çalışan</span>
                  <select className={`${inputClass} w-full rounded-lg px-3`} value={draft.assignedMemberId} onChange={(event) => onChange({ ...draft, assignedMemberId: event.target.value })}>
                    <option value="">Atanmamış</option>
                    {members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </label>
              ) : null}
              <label>
                <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Tapu randevusu</span>
                <Input className={inputClass} type="datetime-local" value={draft.appointmentAt} onChange={(event) => onChange({ ...draft, appointmentAt: event.target.value })} />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Son tarih</span>
                <Input className={inputClass} type="datetime-local" value={draft.dueAt} onChange={(event) => onChange({ ...draft, dueAt: event.target.value })} />
              </label>
            </div>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Ekip notu</span>
              <Textarea className={`${inputClass} min-h-28`} maxLength={5000} value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} placeholder="Eksik evrakı, aranan kişiyi veya sıradaki adımı kısa ve açık yazın." />
            </label>
          </div>

          <aside className="space-y-5 bg-[#06131f] p-5" aria-labelledby="timeline-title">
            <section>
              <h3 className="font-semibold">Dosya özeti</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-lg border border-[#1c3547] bg-[#081622] p-3"><dt className="text-xs text-[#718797]">Müşteri</dt><dd className="mt-1 text-[#dce8ed]">{deedCase.contact?.name || 'Bağlanmadı'}</dd></div>
                <div className="rounded-lg border border-[#1c3547] bg-[#081622] p-3"><dt className="text-xs text-[#718797]">Portföy</dt><dd className="mt-1 text-[#dce8ed]">{deedCase.property?.title || 'Bağlanmadı'}</dd></div>
                <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3"><dt className="text-xs text-amber-200/70">Resmî entegrasyon</dt><dd className="mt-1 text-sm text-amber-100">Bağlı değil · manuel takip</dd></div>
              </dl>
            </section>
            <section aria-labelledby="timeline-title">
              <h3 id="timeline-title" className="flex items-center gap-2 font-semibold"><History className="size-4 text-cyan-200" aria-hidden="true" /> Süreç geçmişi</h3>
              {deedCase.events.length ? (
                <ol className="mt-4 space-y-4 border-l border-[#28475b] pl-4">
                  {deedCase.events.map((event) => (
                    <li className="relative" key={event.id}>
                      <span className="absolute -left-[1.21rem] top-1.5 size-2 rounded-full bg-cyan-300" aria-hidden="true" />
                      <p className="text-sm leading-5 text-[#dce8ed]">{event.message}</p>
                      <time className="mt-1 block text-xs text-[#718797]">{formatDeedDate(event.createdAt)}</time>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-3 text-sm text-[#718797]">Henüz süreç kaydı yok.</p>}
            </section>
          </aside>
        </div>
        <DialogFooter className="border-[#28475b] bg-[#081622]">
          <Button type="button" variant="ghost" className="text-[#9bb0be]" onClick={onClose}>Kapat</Button>
          <Button type="button" className="bg-emerald-300 text-[#031510] hover:bg-emerald-200" disabled={saving} onClick={onSave}>
            <Save aria-hidden="true" /> {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateCaseDialog({
  open,
  step,
  form,
  selectedGuideId,
  isOwner,
  workspace,
  saving,
  onOpenChange,
  onStepChange,
  onFormChange,
  onSubmit,
}: {
  open: boolean;
  step: 1 | 2 | 3;
  form: CreateForm;
  selectedGuideId: string | null;
  isOwner: boolean;
  workspace: DeedWorkspace;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: 1 | 2 | 3) => void;
  onFormChange: (form: CreateForm) => void;
  onSubmit: () => void;
}) {
  const guide = getDeedProcessGuide(selectedGuideId);
  const activeMembers = workspace.members.filter((member) => member.active);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto border border-[#28475b] bg-[#081622] p-0 text-[#f4f8fa] sm:max-w-4xl">
        <DialogHeader className="border-b border-[#28475b] px-5 py-4 pr-12">
          <DialogTitle className="text-xl">Yeni tapu takip dosyası</DialogTitle>
          <DialogDescription className="leading-6 text-[#9bb0be]">
            Üç kısa adımı tamamlayın. İşleme özel evrak listesi otomatik oluşsun.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 border-b border-[#28475b] bg-[#06131f] px-5 py-3" aria-label="Dosya oluşturma adımları">
          {[
            { value: 1, label: 'İşlem' },
            { value: 2, label: 'Kişi ve portföy' },
            { value: 3, label: 'Takip bilgileri' },
          ].map((item) => (
            <div className={`rounded-lg border px-3 py-2 text-center text-xs font-semibold ${step === item.value ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : step > item.value ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : 'border-[#1c3547] text-[#718797]'}`} key={item.value}>
              {item.value}. {item.label}
            </div>
          ))}
        </div>

        <div className="p-5">
          {guide ? (
            <div className="mb-4 flex gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-3">
              <Workflow className="mt-0.5 size-5 shrink-0 text-emerald-200" aria-hidden="true" />
              <div><strong className="text-sm text-emerald-100">Rehberden seçildi: {guide.title}</strong><p className="mt-1 text-xs leading-5 text-[#9bb0be]">{guide.description}</p></div>
            </div>
          ) : null}

          {step === 1 ? (
            <fieldset>
              <legend className="text-base font-semibold">Hangi işlemi takip edeceksiniz?</legend>
              <p className="mt-1 text-sm text-[#9bb0be]">En yakın seçeneği seçin; ayrıntıları daha sonra değiştirebilirsiniz.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {DEED_QUICK_TYPES.map((item) => {
                  const selected = form.type === item.type;
                  return (
                    <label className={`flex min-h-28 cursor-pointer flex-col rounded-xl border p-4 transition-colors ${selected ? 'border-cyan-300/45 bg-cyan-300/10' : 'border-[#28475b] bg-[#06131f] hover:border-cyan-300/25'}`} key={item.id}>
                      <input className="sr-only" type="radio" name="deed-type" value={item.type} checked={selected} onChange={() => onFormChange({ ...form, type: item.type })} />
                      <span className={`flex size-9 items-center justify-center rounded-lg border ${selected ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-200' : 'border-[#28475b] text-[#718797]'}`}><Landmark className="size-4" aria-hidden="true" /></span>
                      <strong className="mt-3 text-sm">{item.label}</strong>
                      <small className="mt-1 leading-5 text-[#8da5b4]">{item.description}</small>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          {step === 2 ? (
            <div>
              <h3 className="text-base font-semibold">Kişiyi ve portföyü bağlayın</h3>
              <p className="mt-1 text-sm text-[#9bb0be]">İsterseniz ikisini de daha sonra seçebilirsiniz.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Portföy</span>
                  <select className={`${inputClass} w-full rounded-lg px-3`} value={form.propertyId} onChange={(event) => onFormChange({ ...form, propertyId: event.target.value })}>
                    <option value="">Şimdilik seçme</option>
                    {workspace.properties.map((property) => <option key={property.id} value={property.id}>{property.referenceCode} · {property.title}</option>)}
                  </select>
                  <small className="mt-1.5 block text-[#718797]">Portföy seçilirse belge alanları daha hızlı dolar.</small>
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Müşteri / ilgili kişi</span>
                  <select className={`${inputClass} w-full rounded-lg px-3`} value={form.contactId} onChange={(event) => onFormChange({ ...form, contactId: event.target.value })}>
                    <option value="">Şimdilik seçme</option>
                    {workspace.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
                  </select>
                  <small className="mt-1.5 block text-[#718797]">Ana iletişim kurulacak kişiyi seçin.</small>
                </label>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h3 className="text-base font-semibold">Dosyaya bir ad verin ve takibi planlayın</h3>
              <p className="mt-1 text-sm text-[#9bb0be]">Yalnız dosya adı zorunludur; kalan alanları sonra da doldurabilirsiniz.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Dosya adı <span className="text-rose-300">*</span></span>
                  <Input className={inputClass} required minLength={3} maxLength={160} value={form.title} onChange={(event) => onFormChange({ ...form, title: event.target.value })} placeholder="Örn. P-104 satış ve tapu devri" />
                </label>
                {isOwner ? (
                  <label>
                    <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Sorumlu çalışan</span>
                    <select className={`${inputClass} w-full rounded-lg px-3`} value={form.assignedMemberId} onChange={(event) => onFormChange({ ...form, assignedMemberId: event.target.value })}>
                      <option value="">Daha sonra ata</option>
                      {activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                  </label>
                ) : null}
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Son tarih</span>
                  <Input className={inputClass} type="datetime-local" value={form.dueAt} onChange={(event) => onFormChange({ ...form, dueAt: event.target.value })} />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Tapu randevusu</span>
                  <Input className={inputClass} type="datetime-local" value={form.appointmentAt} onChange={(event) => onFormChange({ ...form, appointmentAt: event.target.value })} />
                </label>
                <label className="sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-[#dce8ed]">Ekip notu</span>
                  <Textarea className={`${inputClass} min-h-24`} maxLength={5000} value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} placeholder="Örn. Malik vekâletnameyi cuma günü gönderecek." />
                </label>
              </div>
              <div className="mt-4 flex gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100/80">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Oluşan liste hazırlık desteğidir; güncel resmî evrak listesinin ve yetkili uzman kontrolünün yerine geçmez.
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-[#28475b] bg-[#06131f]">
          <Button type="button" variant="ghost" className="text-[#9bb0be]" onClick={() => step === 1 ? onOpenChange(false) : onStepChange((step - 1) as 1 | 2)}>
            {step === 1 ? 'Vazgeç' : 'Geri'}
          </Button>
          {step < 3 ? (
            <Button type="button" className="bg-cyan-300 text-[#03131a] hover:bg-cyan-200" onClick={() => onStepChange((step + 1) as 2 | 3)}>
              Devam et <ArrowRight aria-hidden="true" />
            </Button>
          ) : (
            <Button type="button" className="bg-emerald-300 text-[#031510] hover:bg-emerald-200" disabled={saving} onClick={onSubmit}>
              <FilePlus2 aria-hidden="true" /> {saving ? 'Oluşturuluyor…' : 'Dosyayı oluştur'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DeedTrackingClient() {
  const session = useFabrikaSession();
  const isOwner = session.principalType === 'OWNER';
  const [cases, setCases] = useState<DeedCase[]>([]);
  const [workspace, setWorkspace] = useState<DeedWorkspace>(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE_FORM);
  const [selected, setSelected] = useState<DeedCase | null>(null);
  const [draft, setDraft] = useState<DeedCaseDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const applyPayloads = useCallback((caseBody: { cases?: DeedCase[] }, workspaceBody: { workspace?: DeedWorkspace }) => {
    setCases(caseBody.cases || []);
    setWorkspace({
      properties: workspaceBody.workspace?.properties || [],
      contacts: workspaceBody.workspace?.contacts || [],
      members: workspaceBody.workspace?.members || [],
    });
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [caseResponse, workspaceResponse] = await Promise.all([
        fetch('/api/fabrika/deed-tracking', { cache: 'no-store' }),
        fetch('/api/fabrika/workspace', { cache: 'no-store' }),
      ]);
      const [caseBody, workspaceBody] = await Promise.all([caseResponse.json(), workspaceResponse.json()]);
      if (!caseResponse.ok || !caseBody.success) throw new Error(caseBody.error || 'Tapu takip verileri alınamadı.');
      if (!workspaceResponse.ok || !workspaceBody.success) throw new Error(workspaceBody.error || 'Şirket kayıtları alınamadı.');
      applyPayloads(caseBody, workspaceBody);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Tapu takip verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [applyPayloads]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/fabrika/deed-tracking', { cache: 'no-store', signal: controller.signal }),
      fetch('/api/fabrika/workspace', { cache: 'no-store', signal: controller.signal }),
    ])
      .then(async ([caseResponse, workspaceResponse]) => {
        const [caseBody, workspaceBody] = await Promise.all([caseResponse.json(), workspaceResponse.json()]);
        if (!caseResponse.ok || !caseBody.success) throw new Error(caseBody.error || 'Tapu takip verileri alınamadı.');
        if (!workspaceResponse.ok || !workspaceBody.success) throw new Error(workspaceBody.error || 'Şirket kayıtları alınamadı.');
        return { caseBody, workspaceBody };
      })
      .then(({ caseBody, workspaceBody }) => applyPayloads(caseBody, workspaceBody))
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Tapu takip verileri alınamadı.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [applyPayloads]);

  function openCreate(guideId?: string) {
    const guide = getDeedProcessGuide(guideId || null);
    setSelectedGuideId(guide?.id || null);
    setCreateStep(1);
    setCreateForm({
      ...EMPTY_CREATE_FORM,
      type: guide?.caseType || 'SALE',
      title: guide ? `${guide.title} dosyası` : '',
      notes: guide ? `İşlem rehberi: ${guide.title}` : '',
    });
    setCreateOpen(true);
  }

  function openCase(item: DeedCase) {
    setSelected(item);
    setDraft(deedCaseDraft(item));
  }

  async function submitCreate() {
    if (createForm.title.trim().length < 3) {
      toast.error('Dosya adı en az 3 karakter olmalıdır.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/fabrika/deed-tracking', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          type: createForm.type,
          propertyId: createForm.propertyId || null,
          contactId: createForm.contactId || null,
          ...(isOwner ? { assignedMemberId: createForm.assignedMemberId || null } : {}),
          appointmentAt: toIsoOrNull(createForm.appointmentAt),
          dueAt: toIsoOrNull(createForm.dueAt),
          notes: createForm.notes.trim() || null,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Takip dosyası oluşturulamadı.');
      toast.success('Tapu takip dosyası oluşturuldu.');
      setCreateForm(EMPTY_CREATE_FORM);
      setSelectedGuideId(null);
      setCreateOpen(false);
      await loadData();
    } catch (createError) {
      toast.error(createError instanceof Error ? createError.message : 'Takip dosyası oluşturulamadı.');
    } finally {
      setSaving(false);
    }
  }

  async function saveCase() {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      const response = await fetch('/api/fabrika/deed-tracking', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          version: selected.version,
          status: draft.status,
          checklist: draft.checklist,
          ...(isOwner ? { assignedMemberId: draft.assignedMemberId || null } : {}),
          appointmentAt: toIsoOrNull(draft.appointmentAt),
          dueAt: toIsoOrNull(draft.dueAt),
          notes: draft.notes.trim() || null,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Takip dosyası güncellenemedi.');
      toast.success('Tapu takip dosyası güncellendi.');
      setSelected(null);
      setDraft(null);
      await loadData();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Takip dosyası güncellenemedi.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DeedTrackingView
        cases={cases}
        error={error}
        loading={loading}
        onCreate={() => openCreate()}
        onStartGuide={openCreate}
        onOpen={openCase}
        onRefresh={() => void loadData()}
      />

      <CreateCaseDialog
        open={createOpen}
        step={createStep}
        form={createForm}
        selectedGuideId={selectedGuideId}
        isOwner={isOwner}
        workspace={workspace}
        saving={saving}
        onOpenChange={setCreateOpen}
        onStepChange={setCreateStep}
        onFormChange={setCreateForm}
        onSubmit={() => void submitCreate()}
      />

      {selected && draft ? (
        <CaseDetailDialog
          deedCase={selected}
          draft={draft}
          isOwner={isOwner}
          members={workspace.members}
          saving={saving}
          onChange={setDraft}
          onClose={() => { setSelected(null); setDraft(null); }}
          onSave={() => void saveCase()}
        />
      ) : null}
    </>
  );
}
