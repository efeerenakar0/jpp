'use client';

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Flame,
  Gauge,
  HandCoins,
  KanbanSquare,
  ListChecks,
  LoaderCircle,
  Mail,
  MapPin,
  MessageCircleMore,
  MoreHorizontal,
  Phone,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import {
  FormEvent,
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import styles from './CrmWorkspace.module.css';
import type {
  ContactDetailTab,
  CrmContact,
  CrmDeal,
  CrmDealStage,
  CrmSection,
  CrmTask,
  CrmWorkspaceData,
  FinanceEntry,
} from './crm-types';
import {
  calculateFinanceSummary,
  contactStageLabels,
  contactTemperature,
  contactTypeLabels,
  dealStageLabels,
  dealStageOrder,
  dealsForContact,
  financeEntriesFromActivities,
  financeKindLabels,
  formatDate,
  formatMoney,
  initials,
  isTaskOverdue,
  nextDealStage,
  tasksForContact,
} from './crm-utils';

type ModalKind = 'contact' | 'edit-contact' | 'task' | 'deal' | 'note' | 'finance' | null;

type CrmWorkspaceProps = {
  initialSection?: CrmSection;
  initialWorkspace?: CrmWorkspaceData | null;
  autoLoad?: boolean;
};

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;

const navigation: Array<{
  id: CrmSection;
  label: string;
  description: string;
  icon: IconComponent;
}> = [
  { id: 'overview', label: 'Kumanda', description: 'Günün özeti', icon: Gauge },
  { id: 'customers', label: 'Müşteriler', description: '360° müşteri dosyası', icon: UsersRound },
  { id: 'pipeline', label: 'Satış hunisi', description: 'Fırsat ve kapanış', icon: KanbanSquare },
  { id: 'tasks', label: 'Takip merkezi', description: 'Görev ve randevular', icon: ListChecks },
  { id: 'finance', label: 'Para takibi', description: 'Cari, tahsilat, vade', icon: WalletCards },
  { id: 'insights', label: 'Raporlar', description: 'Dönüşüm ve performans', icon: TrendingUp },
];

const detailTabs: Array<{ id: ContactDetailTab; label: string }> = [
  { id: 'summary', label: 'Genel görünüm' },
  { id: 'requirements', label: 'Talep & eşleşme' },
  { id: 'activity', label: 'İletişim geçmişi' },
  { id: 'finance', label: 'Cari hesap' },
  { id: 'tasks', label: 'Görevler' },
  { id: 'deals', label: 'Fırsatlar' },
];

const openPipelineStages: CrmDealStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'MATCHED',
  'VIEWING',
  'OFFER',
  'CONTRACT',
];

const taskTypeLabels: Record<CrmTask['type'], string> = {
  CALL: 'Arama',
  MESSAGE: 'Mesaj',
  MEETING: 'Toplantı',
  VIEWING: 'Yer gösterimi',
  FOLLOW_UP: 'Takip',
  DOCUMENT: 'Belge',
  OTHER: 'Diğer',
};

function numberOrUndefined(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dateToInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoFromForm(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value) return null;
  return new Date(value).toISOString();
}

function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.modalBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        aria-describedby="crm-modal-description"
        aria-labelledby="crm-modal-title"
        aria-modal="true"
        className={styles.modal}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className={styles.modalHeader}>
          <div>
            <p className={styles.eyebrow}>CRM 360 hızlı işlem</p>
            <h2 id="crm-modal-title">{title}</h2>
            <p id="crm-modal-description">{description}</p>
          </div>
          <button aria-label="Pencereyi kapat" className={styles.iconButton} onClick={onClose} type="button">
            <X aria-hidden size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }: {
  icon: IconComponent;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}><Icon aria-hidden size={24} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function LoadingView() {
  return (
    <section aria-busy="true" aria-label="CRM yükleniyor" className={styles.loadingView}>
      <div className={styles.loadingHeader} />
      <div className={styles.loadingNav} />
      <div className={styles.loadingMetrics}>
        {[0, 1, 2, 3].map((item) => <span key={item} />)}
      </div>
      <div className={styles.loadingBody} />
    </section>
  );
}

export default function CrmWorkspace({
  initialSection = 'overview',
  initialWorkspace = null,
  autoLoad = true,
}: CrmWorkspaceProps) {
  const [workspace, setWorkspace] = useState<CrmWorkspaceData | null>(initialWorkspace);
  const [section, setSection] = useState<CrmSection>(initialSection);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    initialWorkspace?.contacts[0]?.id || null
  );
  const [detailTab, setDetailTab] = useState<ContactDetailTab>('summary');
  const [modal, setModal] = useState<ModalKind>(null);
  const [query, setQuery] = useState('');
  const [contactFilter, setContactFilter] = useState<'all' | 'hot' | 'follow-up' | 'won'>('all');
  const [loading, setLoading] = useState(!initialWorkspace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());

  const loadWorkspace = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/fabrika/workspace', { cache: 'no-store' });
      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
        workspace?: CrmWorkspaceData;
      };
      if (!response.ok || !body.success || !body.workspace) {
        throw new Error(body.error || 'CRM çalışma alanı yüklenemedi.');
      }
      setWorkspace(body.workspace);
      setSelectedContactId((current) =>
        current && body.workspace!.contacts.some((contact) => contact.id === current)
          ? current
          : body.workspace!.contacts[0]?.id || null
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'CRM çalışma alanı yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoLoad) return;
    const initialTimer = window.setTimeout(() => void loadWorkspace(Boolean(initialWorkspace)), 0);
    const refreshTimer = window.setInterval(() => void loadWorkspace(true), 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, [autoLoad, initialWorkspace, loadWorkspace]);

  const postWorkspaceAction = useCallback(async (
    payload: Record<string, unknown>,
    successMessage: string
  ) => {
    setBusy(true);
    try {
      const response = await fetch('/api/fabrika/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
        workspace?: CrmWorkspaceData;
      };
      if (!response.ok || !body.success || !body.workspace) {
        throw new Error(body.error || 'İşlem tamamlanamadı.');
      }
      setWorkspace(body.workspace);
      setModal(null);
      toast.success(successMessage);
      return true;
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'İşlem tamamlanamadı.');
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const postFinanceAction = useCallback(async (
    payload: Record<string, unknown>,
    successMessage: string
  ) => {
    setBusy(true);
    try {
      const response = await fetch('/api/fabrika/crm/finance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { success?: boolean; error?: string; message?: string };
      if (!response.ok || !body.success) {
        throw new Error(body.error || 'Para hareketi kaydedilemedi.');
      }
      await loadWorkspace(true);
      setModal(null);
      toast.success(body.message || successMessage);
      return true;
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : 'Para hareketi kaydedilemedi.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [loadWorkspace]);

  const financeEntries = useMemo(
    () => financeEntriesFromActivities(workspace?.activities || []),
    [workspace?.activities]
  );
  const financeSummary = useMemo(() => calculateFinanceSummary(financeEntries), [financeEntries]);

  const filteredContacts = useMemo(() => {
    if (!workspace) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');
    return workspace.contacts.filter((contact) => {
      const searchable = [
        contact.name,
        contact.phone,
        contact.email,
        contact.desiredLocation,
        contact.source,
        ...contact.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
      if (contactFilter === 'hot') return contact.score >= 60;
      if (contactFilter === 'follow-up') {
        return Boolean(contact.nextActionAt && new Date(contact.nextActionAt).getTime() <= renderedAt);
      }
      if (contactFilter === 'won') return contact.stage === 'WON';
      return true;
    });
  }, [contactFilter, query, renderedAt, workspace]);

  const selectedContact = workspace?.contacts.find((contact) => contact.id === selectedContactId)
    || filteredContacts[0]
    || null;
  const selectedTasks = selectedContact && workspace
    ? tasksForContact(workspace.tasks, selectedContact.id)
    : [];
  const selectedDeals = selectedContact && workspace
    ? dealsForContact(workspace.deals, selectedContact.id)
    : [];
  const selectedActivities = selectedContact && workspace
    ? workspace.activities.filter((activity) => activity.contact?.id === selectedContact.id)
    : [];
  const selectedFinanceEntries = selectedContact
    ? financeEntries.filter((entry) => entry.contactId === selectedContact.id)
    : [];
  const selectedFinanceSummary = calculateFinanceSummary(selectedFinanceEntries);
  const selectedMatches = selectedContact && workspace
    ? workspace.matches.filter((match) => match.contact.id === selectedContact.id)
    : [];

  const activeTasks = workspace?.tasks
    .filter((task) => task.status === 'OPEN')
    .sort((a, b) => {
      if (!a.dueAt) return 1;
      if (!b.dueAt) return -1;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    }) || [];

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace) return;
    const data = new FormData(event.currentTarget);

    if (modal === 'contact') {
      const created = await postWorkspaceAction({
        action: 'create-contact',
        name: String(data.get('name') || ''),
        phone: String(data.get('phone') || ''),
        email: String(data.get('email') || ''),
        type: String(data.get('type') || 'BUYER'),
        stage: String(data.get('stage') || 'NEW'),
        source: String(data.get('source') || ''),
        desiredLocation: String(data.get('desiredLocation') || ''),
        desiredRoomCount: String(data.get('desiredRoomCount') || ''),
        budgetMin: numberOrUndefined(data.get('budgetMin')),
        budgetMax: numberOrUndefined(data.get('budgetMax')),
        notes: String(data.get('notes') || ''),
        consentStatus: String(data.get('consentStatus') || 'UNKNOWN'),
        assignedMemberId: String(data.get('assignedMemberId') || '') || null,
      }, 'Yeni müşteri CRM’e eklendi.');
      if (created) setSection('customers');
      return;
    }

    if (!selectedContact) return;

    if (modal === 'edit-contact') {
      await postWorkspaceAction({
        action: 'update-contact',
        id: selectedContact.id,
        name: String(data.get('name') || ''),
        phone: String(data.get('phone') || ''),
        email: String(data.get('email') || ''),
        type: String(data.get('type') || selectedContact.type),
        stage: String(data.get('stage') || selectedContact.stage),
        source: String(data.get('source') || ''),
        desiredLocation: String(data.get('desiredLocation') || ''),
        desiredRoomCount: String(data.get('desiredRoomCount') || ''),
        budgetMin: numberOrUndefined(data.get('budgetMin')) ?? null,
        budgetMax: numberOrUndefined(data.get('budgetMax')) ?? null,
        notes: String(data.get('notes') || ''),
        tags: String(data.get('tags') || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        consentStatus: String(data.get('consentStatus') || 'UNKNOWN'),
        nextActionAt: isoFromForm(data.get('nextActionAt')),
        assignedMemberId: String(data.get('assignedMemberId') || '') || null,
      }, 'Müşteri dosyası güncellendi.');
      return;
    }

    if (modal === 'note') {
      await postWorkspaceAction({
        action: 'add-contact-note',
        id: selectedContact.id,
        note: String(data.get('note') || ''),
      }, 'Görüşme notu müşteri geçmişine eklendi.');
      return;
    }

    if (modal === 'task') {
      await postWorkspaceAction({
        action: 'create-task',
        title: String(data.get('title') || ''),
        type: String(data.get('type') || 'FOLLOW_UP'),
        description: String(data.get('description') || ''),
        dueAt: isoFromForm(data.get('dueAt')),
        priority: numberOrUndefined(data.get('priority')) || 2,
        contactId: selectedContact.id,
        dealId: String(data.get('dealId') || '') || null,
        propertyId: String(data.get('propertyId') || '') || null,
        assignedMemberId: String(data.get('assignedMemberId') || '') || null,
      }, 'Takip görevi oluşturuldu.');
      return;
    }

    if (modal === 'deal') {
      await postWorkspaceAction({
        action: 'create-deal',
        title: String(data.get('title') || ''),
        contactId: selectedContact.id,
        propertyId: String(data.get('propertyId') || '') || null,
        assignedMemberId: String(data.get('assignedMemberId') || '') || null,
        estimatedValue: numberOrUndefined(data.get('estimatedValue')),
        commissionRate: numberOrUndefined(data.get('commissionRate')),
        nextAction: String(data.get('nextAction') || ''),
      }, 'Yeni satış fırsatı açıldı.');
      return;
    }

    if (modal === 'finance') {
      await postFinanceAction({
        action: 'create-entry',
        contactId: selectedContact.id,
        dealId: String(data.get('dealId') || '') || null,
        propertyId: String(data.get('propertyId') || '') || null,
        kind: String(data.get('kind') || 'DEBIT'),
        status: String(data.get('status') || 'PLANNED'),
        amount: numberOrUndefined(data.get('amount')),
        currency: String(data.get('currency') || 'TRY'),
        occurredAt: isoFromForm(data.get('occurredAt')) || new Date().toISOString(),
        dueAt: isoFromForm(data.get('dueAt')),
        method: String(data.get('method') || '') || null,
        reference: String(data.get('reference') || '') || null,
        description: String(data.get('description') || '') || null,
      }, 'Para hareketi cari hesaba eklendi.');
    }
  };

  if (loading && !workspace) return <LoadingView />;

  if (error && !workspace) {
    return (
      <section className={styles.errorState} role="alert">
        <AlertCircle aria-hidden size={34} />
        <h1>CRM yüklenemedi</h1>
        <p>{error}</p>
        <button className={styles.primaryButton} onClick={() => void loadWorkspace()} type="button">
          <RefreshCw aria-hidden size={18} /> Yeniden dene
        </button>
      </section>
    );
  }

  if (!workspace) return null;

  const hotContacts = workspace.contacts
    .filter((contact) => contact.score >= 60 && !['WON', 'LOST'].includes(contact.stage))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const wonDeals = workspace.deals.filter((deal) => deal.stage === 'WON');
  const openDeals = workspace.deals.filter((deal) => !['WON', 'LOST'].includes(deal.stage));
  const expectedCommission = openDeals.reduce(
    (sum, deal) => sum + (deal.estimatedValue || 0) * ((deal.commissionRate || 0) / 100),
    0
  );

  return (
    <main className={styles.crmShell} id="crm-main">
      <header className={styles.pageHeader}>
        <div className={styles.headerCopy}>
          <div className={styles.productMark} aria-hidden>
            <span>J</span>
          </div>
          <div>
            <p className={styles.eyebrow}>JPP CRM 360 · {workspace.account.companyName}</p>
            <h1>Müşteri ve gelir merkezi</h1>
            <p>Müşterinin ilk temasından tahsilata kadar tüm hikâye tek, canlı dosyada.</p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.globalSearch}>
            <Search aria-hidden size={18} />
            <span className={styles.srOnly}>CRM içinde ara</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Müşteri, telefon, bölge ara"
              type="search"
              value={query}
            />
          </label>
          <button className={styles.refreshButton} onClick={() => void loadWorkspace(true)} type="button">
            <RefreshCw aria-hidden size={18} />
            <span>Yenile</span>
          </button>
          <button className={styles.primaryButton} onClick={() => setModal('contact')} type="button">
            <Plus aria-hidden size={18} /> Müşteri ekle
          </button>
        </div>
      </header>

      <nav aria-label="CRM bölümleri" className={styles.sectionNav}>
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              aria-current={section === item.id ? 'page' : undefined}
              className={section === item.id ? styles.activeNavItem : styles.navItem}
              key={item.id}
              onClick={() => setSection(item.id)}
              type="button"
            >
              <Icon aria-hidden size={20} />
              <span><b>{item.label}</b><small>{item.description}</small></span>
              {item.id === 'tasks' && workspace.metrics.overdueTasks > 0 ? (
                <em>{workspace.metrics.overdueTasks}</em>
              ) : null}
            </button>
          );
        })}
      </nav>

      {error ? <div className={styles.inlineAlert} role="status"><AlertCircle aria-hidden size={17} /> {error}</div> : null}

      {section === 'overview' ? (
        <section aria-labelledby="overview-title" className={styles.sectionBody}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Bugünün çalışma masası</p>
              <h2 id="overview-title">Kontrol sende, hiçbir müşteri unutulmaz</h2>
            </div>
            <span className={styles.liveBadge}><span /> Canlı CRM verisi</span>
          </div>

          <div className={styles.metricGrid}>
            <MetricCard
              icon={BriefcaseBusiness}
              label="Aktif satış hacmi"
              value={formatMoney(workspace.metrics.pipelineValue)}
              note={`${workspace.metrics.openDeals} açık fırsat`}
              tone="blue"
            />
            <MetricCard
              icon={HandCoins}
              label="Beklenen komisyon"
              value={formatMoney(expectedCommission)}
              note={`${wonDeals.length} tamamlanan işlem`}
              tone="violet"
            />
            <MetricCard
              icon={WalletCards}
              label="Müşteri bakiyesi"
              value={formatMoney(financeSummary.balance)}
              note={`${formatMoney(financeSummary.overdue)} gecikmiş`}
              tone="amber"
            />
            <MetricCard
              icon={BellRing}
              label="Bekleyen takip"
              value={String(activeTasks.length)}
              note={`${workspace.metrics.overdueTasks} gecikmiş görev`}
              tone="rose"
            />
          </div>

          <div className={styles.dashboardGrid}>
            <section className={styles.workQueue}>
              <div className={styles.panelHeading}>
                <div><p>Öncelikli çalışma listesi</p><h3>Sıradaki en iyi aksiyonlar</h3></div>
                <button onClick={() => setSection('tasks')} type="button">Tümünü gör <ArrowRight aria-hidden size={16} /></button>
              </div>
              {activeTasks.length ? (
                <div className={styles.queueList}>
                  {activeTasks.slice(0, 6).map((task, index) => (
                    <article className={styles.queueItem} key={task.id}>
                      <span className={styles.queueIndex}>{String(index + 1).padStart(2, '0')}</span>
                      <span className={styles.queueIcon} data-overdue={isTaskOverdue(task, renderedAt)}>
                        {task.type === 'CALL' ? <Phone aria-hidden size={17} /> : task.type === 'MESSAGE' ? <MessageCircleMore aria-hidden size={17} /> : <CalendarClock aria-hidden size={17} />}
                      </span>
                      <div>
                        <b>{task.title}</b>
                        <small>{task.contact?.name || 'Genel görev'} · {formatDate(task.dueAt, true)}</small>
                      </div>
                      <button
                        aria-label={`${task.title} görevini tamamla`}
                        className={styles.completeButton}
                        disabled={busy}
                        onClick={() => void postWorkspaceAction({ action: 'toggle-task', id: task.id, completed: true }, 'Görev tamamlandı.')}
                        type="button"
                      >
                        <Check aria-hidden size={17} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState icon={CheckCircle2} title="Çalışma listesi temiz" description="Yeni takip görevi oluştuğunda burada önceliklendirilir." />
              )}
            </section>

            <section className={styles.pipelinePulse}>
              <div className={styles.panelHeading}>
                <div><p>Satış nabzı</p><h3>Fırsatlar hangi aşamada?</h3></div>
                <button onClick={() => setSection('pipeline')} type="button">Huniyi aç <ArrowRight aria-hidden size={16} /></button>
              </div>
              <div className={styles.pipelineBars}>
                {openPipelineStages.map((stage) => {
                  const stageDeals = workspace.deals.filter((deal) => deal.stage === stage);
                  const width = openDeals.length ? Math.max(8, (stageDeals.length / openDeals.length) * 100) : 8;
                  return (
                    <div className={styles.pipelineBarRow} key={stage}>
                      <span>{dealStageLabels[stage]}</span>
                      <div><i style={{ width: `${width}%` }} /></div>
                      <b>{stageDeals.length}</b>
                    </div>
                  );
                })}
              </div>
              <div className={styles.conversionFooter}>
                <span><b>{workspace.contacts.length}</b><small>Toplam müşteri</small></span>
                <ChevronRight aria-hidden size={18} />
                <span><b>{openDeals.length}</b><small>Aktif fırsat</small></span>
                <ChevronRight aria-hidden size={18} />
                <span><b>{wonDeals.length}</b><small>Kazanılan</small></span>
              </div>
            </section>
          </div>

          <div className={styles.dashboardLowerGrid}>
            <section className={styles.hotCustomers}>
              <div className={styles.panelHeading}>
                <div><p>Müşteri sinyalleri</p><h3>Şimdi ilgilenmen gerekenler</h3></div>
              </div>
              {hotContacts.length ? hotContacts.map((contact) => (
                <button
                  className={styles.signalCustomer}
                  key={contact.id}
                  onClick={() => {
                    setSelectedContactId(contact.id);
                    setSection('customers');
                  }}
                  type="button"
                >
                  <span className={styles.avatar}>{initials(contact.name)}</span>
                  <span><b>{contact.name}</b><small>{contact.desiredLocation || 'Bölge belirtilmedi'} · {contactStageLabels[contact.stage]}</small></span>
                  <strong>{contact.score}</strong>
                </button>
              )) : <EmptyState icon={Flame} title="Sıcak müşteri sinyali yok" description="Müşteri puanları yenilendikçe öncelikler burada görünür." />}
            </section>
            <section className={styles.recentActivity}>
              <div className={styles.panelHeading}>
                <div><p>Canlı kayıt</p><h3>Son müşteri hareketleri</h3></div>
              </div>
              <ActivityList activities={workspace.activities.slice(0, 6)} />
            </section>
          </div>
        </section>
      ) : null}

      {section === 'customers' ? (
        <section aria-labelledby="customers-title" className={styles.sectionBody}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Müşteri 360</p>
              <h2 id="customers-title">Her müşteri için eksiksiz dijital dosya</h2>
            </div>
            <div className={styles.headingActions}>
              <button className={styles.secondaryButton} disabled={!selectedContact} onClick={() => setModal('task')} type="button">
                <CalendarClock aria-hidden size={17} /> Takip oluştur
              </button>
              <button className={styles.primaryButton} onClick={() => setModal('contact')} type="button">
                <Plus aria-hidden size={17} /> Yeni müşteri
              </button>
            </div>
          </div>

          <div className={styles.customerWorkspace}>
            <section className={styles.customerDirectory} aria-label="Müşteri listesi">
              <div className={styles.directoryTopbar}>
                <label>
                  <Search aria-hidden size={17} />
                  <span className={styles.srOnly}>Müşteri listesinde ara</span>
                  <input onChange={(event) => setQuery(event.target.value)} placeholder="İsim, telefon, bölge..." type="search" value={query} />
                </label>
                <span>{filteredContacts.length} kayıt</span>
              </div>
              <div className={styles.filterRow} aria-label="Müşteri filtreleri">
                {([
                  ['all', 'Tümü'],
                  ['hot', 'Sıcak'],
                  ['follow-up', 'Takibi gelen'],
                  ['won', 'Kazanılan'],
                ] as const).map(([value, label]) => (
                  <button aria-pressed={contactFilter === value} key={value} onClick={() => setContactFilter(value)} type="button">
                    {label}
                  </button>
                ))}
              </div>
              <div className={styles.customerList}>
                {filteredContacts.map((contact) => {
                  const temperature = contactTemperature(contact.score);
                  return (
                    <button
                      aria-current={selectedContact?.id === contact.id ? 'true' : undefined}
                      className={selectedContact?.id === contact.id ? styles.selectedCustomer : styles.customerRow}
                      key={contact.id}
                      onClick={() => {
                        setSelectedContactId(contact.id);
                        setDetailTab('summary');
                      }}
                      type="button"
                    >
                      <span className={styles.avatar}>{initials(contact.name)}</span>
                      <span className={styles.customerIdentity}>
                        <b>{contact.name}</b>
                        <small>{contact.phone || contact.email || 'İletişim bilgisi eksik'}</small>
                        <em>{contactTypeLabels[contact.type]} · {contact.assignedMember?.name || 'Atanmamış'}</em>
                      </span>
                      <span className={styles.customerSignal}>
                        <strong data-tone={temperature.tone}>{contact.score}</strong>
                        <small>{contactStageLabels[contact.stage]}</small>
                      </span>
                    </button>
                  );
                })}
                {!filteredContacts.length ? (
                  <EmptyState
                    action={<button className={styles.secondaryButton} onClick={() => setQuery('')} type="button">Filtreleri temizle</button>}
                    description="Arama veya filtreyi değiştirerek yeniden deneyin."
                    icon={Search}
                    title="Eşleşen müşteri yok"
                  />
                ) : null}
              </div>
            </section>

            {selectedContact ? (
              <article className={styles.customerProfile}>
                <CustomerProfileHeader
                  contact={selectedContact}
                  financeSummary={selectedFinanceSummary}
                  onEdit={() => setModal('edit-contact')}
                  onFinance={() => { setDetailTab('finance'); setModal('finance'); }}
                  onNote={() => setModal('note')}
                  onTask={() => setModal('task')}
                />
                <nav aria-label="Müşteri dosyası bölümleri" className={styles.detailTabs}>
                  {detailTabs.map((tab) => (
                    <button aria-selected={detailTab === tab.id} key={tab.id} onClick={() => setDetailTab(tab.id)} role="tab" type="button">
                      {tab.label}
                      {tab.id === 'tasks' && selectedTasks.filter((task) => task.status === 'OPEN').length ? (
                        <span>{selectedTasks.filter((task) => task.status === 'OPEN').length}</span>
                      ) : null}
                    </button>
                  ))}
                </nav>

                <div className={styles.profileBody} role="tabpanel">
                  {detailTab === 'summary' ? (
                    <CustomerSummary
                      activities={selectedActivities}
                      contact={selectedContact}
                      deals={selectedDeals}
                      financeSummary={selectedFinanceSummary}
                      tasks={selectedTasks}
                    />
                  ) : null}
                  {detailTab === 'requirements' ? (
                    <RequirementsView contact={selectedContact} matches={selectedMatches} />
                  ) : null}
                  {detailTab === 'activity' ? (
                    <div className={styles.tabSection}>
                      <div className={styles.tabHeading}><div><p>İletişim zaman akışı</p><h3>Müşteriyle yapılan her temas</h3></div><button className={styles.primaryButton} onClick={() => setModal('note')} type="button"><Plus aria-hidden size={16} /> Görüşme notu</button></div>
                      {selectedActivities.length ? <ActivityList activities={selectedActivities} detailed /> : <EmptyState icon={MessageCircleMore} title="Henüz görüşme kaydı yok" description="Arama, mesaj ve toplantı notları kronolojik olarak burada toplanır." />}
                    </div>
                  ) : null}
                  {detailTab === 'finance' ? (
                    <FinanceView
                      entries={selectedFinanceEntries}
                      onAdd={() => setModal('finance')}
                      onReverse={(entry) => void postFinanceAction({ action: 'reverse-entry', activityId: entry.activityId, reason: 'CRM üzerinden iptal edildi.' }, 'Cari hareket iptal edildi.')}
                      summary={selectedFinanceSummary}
                    />
                  ) : null}
                  {detailTab === 'tasks' ? (
                    <TaskView
                      busy={busy}
                      onAdd={() => setModal('task')}
                      onToggle={(task) => void postWorkspaceAction({ action: 'toggle-task', id: task.id, completed: task.status !== 'COMPLETED' }, task.status === 'COMPLETED' ? 'Görev yeniden açıldı.' : 'Görev tamamlandı.')}
                      tasks={selectedTasks}
                    />
                  ) : null}
                  {detailTab === 'deals' ? (
                    <DealView
                      busy={busy}
                      deals={selectedDeals}
                      onAdd={() => setModal('deal')}
                      onAdvance={(deal, stage) => void postWorkspaceAction({ action: 'move-deal', id: deal.id, stage }, `Fırsat ${dealStageLabels[stage]} aşamasına taşındı.`)}
                    />
                  ) : null}
                </div>
              </article>
            ) : (
              <section className={styles.noCustomerSelected}>
                <EmptyState icon={UsersRound} title="Bir müşteri seçin" description="Müşteri dosyasının tüm ayrıntıları burada açılır." />
              </section>
            )}
          </div>
        </section>
      ) : null}

      {section === 'pipeline' ? (
        <section aria-labelledby="pipeline-title" className={styles.sectionBody}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Satış hunisi</p><h2 id="pipeline-title">Her fırsatın bir sonraki adımı belli</h2></div>
            <button className={styles.primaryButton} disabled={!selectedContact} onClick={() => setModal('deal')} type="button"><Plus aria-hidden size={17} /> Fırsat ekle</button>
          </div>
          <div className={styles.pipelineSummary}>
            <span><small>Açık fırsat</small><b>{openDeals.length}</b></span>
            <span><small>Toplam potansiyel</small><b>{formatMoney(workspace.metrics.pipelineValue)}</b></span>
            <span><small>Ağırlıklı tahmin</small><b>{formatMoney(openDeals.reduce((sum, deal) => sum + (deal.estimatedValue || 0) * (deal.probability / 100), 0))}</b></span>
            <span><small>Kazanılan komisyon</small><b>{formatMoney(workspace.metrics.wonCommission)}</b></span>
          </div>
          <div className={styles.kanbanBoard}>
            {openPipelineStages.map((stage) => {
              const stageDeals = workspace.deals.filter((deal) => deal.stage === stage);
              return (
                <section className={styles.kanbanColumn} key={stage}>
                  <header><span>{dealStageLabels[stage]}</span><b>{stageDeals.length}</b></header>
                  <div>
                    {stageDeals.map((deal) => {
                      const nextStage = nextDealStage(stage);
                      return (
                        <article className={styles.dealCard} key={deal.id}>
                          <div className={styles.dealCardTop}><span>{deal.probability}%</span><button aria-label="Fırsat seçenekleri" type="button"><MoreHorizontal aria-hidden size={17} /></button></div>
                          <h3>{deal.title}</h3>
                          <p><UsersRound aria-hidden size={15} /> {deal.contact.name}</p>
                          <p><Building2 aria-hidden size={15} /> {deal.property?.title || 'Portföy bekleniyor'}</p>
                          <div className={styles.dealValue}><b>{formatMoney(deal.estimatedValue)}</b><small>%{deal.commissionRate || 0} komisyon</small></div>
                          {deal.nextAction ? <em><Target aria-hidden size={14} /> {deal.nextAction}</em> : null}
                          {nextStage ? (
                            <button disabled={busy} onClick={() => void postWorkspaceAction({ action: 'move-deal', id: deal.id, stage: nextStage }, `Fırsat ${dealStageLabels[nextStage]} aşamasına taşındı.`)} type="button">
                              {dealStageLabels[nextStage]} aşamasına geçir <ArrowRight aria-hidden size={15} />
                            </button>
                          ) : null}
                        </article>
                      );
                    })}
                    {!stageDeals.length ? <p className={styles.emptyColumn}>Bu aşamada fırsat yok</p> : null}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      ) : null}

      {section === 'tasks' ? (
        <section aria-labelledby="tasks-title" className={styles.sectionBody}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Takip ve ajanda</p><h2 id="tasks-title">Bugün kimi, neden arayacağını bil</h2></div>
            <button className={styles.primaryButton} disabled={!selectedContact} onClick={() => setModal('task')} type="button"><Plus aria-hidden size={17} /> Görev oluştur</button>
          </div>
          <div className={styles.taskDashboard}>
            <aside className={styles.taskSummaryRail}>
              <span data-tone="danger"><AlertCircle aria-hidden size={20} /><b>{workspace.metrics.overdueTasks}</b><small>Gecikmiş</small></span>
              <span data-tone="info"><CalendarClock aria-hidden size={20} /><b>{workspace.metrics.upcomingCriticalTasks}</b><small>Yaklaşan randevu</small></span>
              <span data-tone="success"><CheckCircle2 aria-hidden size={20} /><b>{workspace.tasks.filter((task) => task.status === 'COMPLETED').length}</b><small>Tamamlanan</small></span>
            </aside>
            <TaskView
              busy={busy}
              onAdd={() => setModal('task')}
              onToggle={(task) => void postWorkspaceAction({ action: 'toggle-task', id: task.id, completed: task.status !== 'COMPLETED' }, task.status === 'COMPLETED' ? 'Görev yeniden açıldı.' : 'Görev tamamlandı.')}
              tasks={workspace.tasks}
            />
          </div>
        </section>
      ) : null}

      {section === 'finance' ? (
        <section aria-labelledby="finance-title" className={styles.sectionBody}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>Müşteri finansı</p><h2 id="finance-title">Borç, tahsilat, kapora ve komisyon tek ekstrede</h2></div>
            <button className={styles.primaryButton} disabled={!selectedContact} onClick={() => setModal('finance')} type="button"><Plus aria-hidden size={17} /> Para hareketi</button>
          </div>
          <FinanceView
            entries={financeEntries}
            onAdd={() => setModal('finance')}
            onReverse={(entry) => void postFinanceAction({ action: 'reverse-entry', activityId: entry.activityId, reason: 'CRM üzerinden iptal edildi.' }, 'Cari hareket iptal edildi.')}
            showCustomer
            summary={financeSummary}
          />
        </section>
      ) : null}

      {section === 'insights' ? (
        <InsightsView contacts={workspace.contacts} deals={workspace.deals} financeSummary={financeSummary} tasks={workspace.tasks} />
      ) : null}

      {modal ? (
        <Modal
          description={modal === 'contact' ? 'İlk teması kaydedin; ayrıntıları müşteri dosyasında tamamlayın.' : selectedContact ? `${selectedContact.name} müşteri dosyasında işlem yapıyorsunuz.` : 'Bir müşteri seçerek devam edin.'}
          onClose={() => !busy && setModal(null)}
          title={{
            contact: 'Yeni müşteri',
            'edit-contact': 'Müşteri dosyasını düzenle',
            task: 'Takip görevi oluştur',
            deal: 'Satış fırsatı aç',
            note: 'Görüşme notu ekle',
            finance: 'Para hareketi kaydet',
          }[modal]}
        >
          <CrmActionForm
            busy={busy}
            contact={selectedContact}
            kind={modal}
            onCancel={() => setModal(null)}
            onSubmit={handleFormSubmit}
            workspace={workspace}
          />
        </Modal>
      ) : null}
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, note, tone }: {
  icon: IconComponent;
  label: string;
  value: string;
  note: string;
  tone: 'blue' | 'violet' | 'amber' | 'rose';
}) {
  return (
    <article className={styles.metricCard} data-tone={tone}>
      <span><Icon aria-hidden size={20} /></span>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function CustomerProfileHeader({ contact, financeSummary, onEdit, onFinance, onNote, onTask }: {
  contact: CrmContact;
  financeSummary: ReturnType<typeof calculateFinanceSummary>;
  onEdit: () => void;
  onFinance: () => void;
  onNote: () => void;
  onTask: () => void;
}) {
  const temperature = contactTemperature(contact.score);
  return (
    <header className={styles.profileHeader}>
      <div className={styles.profilePrimary}>
        <span className={styles.profileAvatar}>{initials(contact.name)}</span>
        <div>
          <span className={styles.profileLabel}>{contactTypeLabels[contact.type]} · {contactStageLabels[contact.stage]}</span>
          <h2>{contact.name}</h2>
          <div className={styles.profileContactLine}>
            {contact.phone ? <a href={`tel:${contact.phone}`}><Phone aria-hidden size={14} /> {contact.phone}</a> : null}
            {contact.email ? <a href={`mailto:${contact.email}`}><Mail aria-hidden size={14} /> {contact.email}</a> : null}
            {contact.desiredLocation ? <span><MapPin aria-hidden size={14} /> {contact.desiredLocation}</span> : null}
          </div>
        </div>
      </div>
      <div className={styles.profileSignals}>
        <span data-tone={temperature.tone}><small>Müşteri puanı</small><b>{contact.score}/100</b><em>{temperature.label}</em></span>
        <span><small>Kalan bakiye</small><b>{formatMoney(financeSummary.balance)}</b><em>{formatMoney(financeSummary.overdue)} gecikmiş</em></span>
        <span><small>Sorumlu</small><b>{contact.assignedMember?.name || 'Atanmadı'}</b><em>{formatDate(contact.nextActionAt, true)}</em></span>
      </div>
      <div className={styles.profileActions}>
        {contact.phone ? <a aria-label={`${contact.name} kişisini ara`} href={`tel:${contact.phone}`}><Phone aria-hidden size={17} /></a> : null}
        <button onClick={onNote} type="button"><MessageCircleMore aria-hidden size={17} /> Not</button>
        <button onClick={onTask} type="button"><CalendarClock aria-hidden size={17} /> Takip</button>
        <button onClick={onFinance} type="button"><CircleDollarSign aria-hidden size={17} /> Tahsilat</button>
        <button onClick={onEdit} type="button"><MoreHorizontal aria-hidden size={17} /> Düzenle</button>
      </div>
    </header>
  );
}

function CustomerSummary({ contact, activities, tasks, deals, financeSummary }: {
  contact: CrmContact;
  activities: CrmWorkspaceData['activities'];
  tasks: CrmTask[];
  deals: CrmDeal[];
  financeSummary: ReturnType<typeof calculateFinanceSummary>;
}) {
  const activeDeals = deals.filter((deal) => !['WON', 'LOST'].includes(deal.stage));
  const openTasks = tasks.filter((task) => task.status === 'OPEN');
  return (
    <div className={styles.profileOverview}>
      <section className={styles.profileNarrative}>
        <div className={styles.cardHeading}><span><Sparkles aria-hidden size={18} /></span><div><p>CRM özeti</p><h3>Müşterinin bugünkü resmi</h3></div></div>
        <p>{contact.notes || `${contact.name} için henüz ayrıntılı görüşme notu girilmedi. İhtiyaç analizi tamamlandıkça CRM özeti burada zenginleşir.`}</p>
        <div className={styles.summaryChips}>
          <span><MapPin aria-hidden size={14} /> {contact.desiredLocation || 'Bölge eksik'}</span>
          <span><Building2 aria-hidden size={14} /> {contact.desiredRoomCount || 'Oda bilgisi eksik'}</span>
          <span><Banknote aria-hidden size={14} /> {formatMoney(contact.budgetMin)} – {formatMoney(contact.budgetMax)}</span>
        </div>
      </section>
      <div className={styles.customerKpis}>
        <article><span><BriefcaseBusiness aria-hidden size={18} /></span><small>Aktif fırsat</small><b>{activeDeals.length}</b><em>{formatMoney(activeDeals.reduce((sum, deal) => sum + (deal.estimatedValue || 0), 0))}</em></article>
        <article><span><ListChecks aria-hidden size={18} /></span><small>Açık görev</small><b>{openTasks.length}</b><em>{openTasks.filter((task) => isTaskOverdue(task)).length} gecikmiş</em></article>
        <article><span><WalletCards aria-hidden size={18} /></span><small>Cari bakiye</small><b>{formatMoney(financeSummary.balance)}</b><em>{formatMoney(financeSummary.collected)} tahsil edildi</em></article>
      </div>
      <section className={styles.nextActionCard}>
        <div className={styles.cardHeading}><span><Target aria-hidden size={18} /></span><div><p>Sonraki en iyi aksiyon</p><h3>{openTasks[0]?.title || contactStageLabels[contact.stage]}</h3></div></div>
        <p>{openTasks[0]?.description || 'Müşteriyle bir sonraki temasın amacını belirleyip takip görevi oluşturun.'}</p>
        <div><Clock3 aria-hidden size={15} /> {formatDate(openTasks[0]?.dueAt || contact.nextActionAt, true)}</div>
      </section>
      <section className={styles.miniActivityCard}>
        <div className={styles.cardHeading}><span><Activity aria-hidden size={18} /></span><div><p>Son hareketler</p><h3>İletişim ve işlem izi</h3></div></div>
        <ActivityList activities={activities.slice(0, 4)} />
      </section>
    </div>
  );
}

function RequirementsView({ contact, matches }: {
  contact: CrmContact;
  matches: CrmWorkspaceData['matches'];
}) {
  return (
    <div className={styles.tabSection}>
      <div className={styles.tabHeading}><div><p>Aktif talep</p><h3>Aradığı gayrimenkulün net tarifi</h3></div><span className={styles.statusPill}><BadgeCheck aria-hidden size={15} /> CRM doğrulandı</span></div>
      <div className={styles.requirementGrid}>
        <article><small>İşlem amacı</small><b>{contactTypeLabels[contact.type]}</b><p>Satın alma/kiralama rolü müşteri profilinden yönetilir.</p></article>
        <article><small>Hedef bölge</small><b>{contact.desiredLocation || 'Belirtilmedi'}</b><p>İlçe ve mahalle tercihleri müşteri notlarıyla birlikte değerlendirilir.</p></article>
        <article><small>Bütçe aralığı</small><b>{formatMoney(contact.budgetMin)} – {formatMoney(contact.budgetMax)}</b><p>Finansman ve ödeme planı cari hesapta takip edilir.</p></article>
        <article><small>Oda tercihi</small><b>{contact.desiredRoomCount || 'Belirtilmedi'}</b><p>Portföy eşleştirme puanının ana kriterlerinden biridir.</p></article>
      </div>
      <div className={styles.matchesHeader}><div><p>Akıllı eşleştirme</p><h3>Bu müşteri için en uygun portföyler</h3></div><span>{matches.length} eşleşme</span></div>
      {matches.length ? (
        <div className={styles.matchGrid}>
          {matches.slice(0, 8).map((match) => (
            <article className={styles.matchCard} key={match.id}>
              <div className={styles.matchVisual}>
                {match.property.imageUrl ? (
                  <span
                    aria-hidden
                    className={styles.propertyImage}
                    style={{ backgroundImage: `url(${match.property.imageUrl})` }}
                  />
                ) : <Building2 aria-hidden size={26} />}
                <span>%{match.score} uyum</span>
              </div>
              <div><h4>{match.property.title}</h4><p><MapPin aria-hidden size={14} /> {match.property.location || 'Konum yok'}</p><b>{formatMoney(match.property.price)}</b><small>{match.reasons.slice(0, 2).join(' · ') || 'CRM kriterleriyle eşleşti'}</small></div>
            </article>
          ))}
        </div>
      ) : <EmptyState icon={Building2} title="Uygun portföy henüz yok" description="Talep kriterleri veya aktif portföyler güncellendiğinde eşleşmeler otomatik hesaplanır." />}
    </div>
  );
}

function ActivityList({ activities, detailed = false }: {
  activities: CrmWorkspaceData['activities'];
  detailed?: boolean;
}) {
  if (!activities.length) return <p className={styles.mutedCopy}>Henüz hareket kaydı yok.</p>;
  return (
    <ol className={detailed ? styles.detailedTimeline : styles.activityList}>
      {activities.map((activity) => (
        <li key={activity.id}>
          <span>{activity.type.includes('FINANCE') ? <ReceiptText aria-hidden size={15} /> : activity.type.includes('DEAL') ? <BriefcaseBusiness aria-hidden size={15} /> : <Activity aria-hidden size={15} />}</span>
          <div><b>{activity.title}</b><p>{activity.description || 'Ayrıntı girilmedi.'}</p><small>{activity.actorMember?.name || 'Sistem'} · {formatDate(activity.createdAt, true)}</small></div>
        </li>
      ))}
    </ol>
  );
}

function FinanceView({ entries, summary, onAdd, onReverse, showCustomer = false }: {
  entries: FinanceEntry[];
  summary: ReturnType<typeof calculateFinanceSummary>;
  onAdd: () => void;
  onReverse: (entry: FinanceEntry) => void;
  showCustomer?: boolean;
}) {
  return (
    <div className={styles.financeWorkspace}>
      <div className={styles.financeCards}>
        <article><span><ReceiptText aria-hidden size={19} /></span><small>Toplam tahakkuk</small><b>{formatMoney(summary.receivable)}</b><em>Komisyon, hizmet ve masraflar</em></article>
        <article><span><HandCoins aria-hidden size={19} /></span><small>Toplam tahsilat</small><b>{formatMoney(summary.collected)}</b><em>Ödenmiş kapora ve tahsilatlar</em></article>
        <article><span><WalletCards aria-hidden size={19} /></span><small>Kalan bakiye</small><b>{formatMoney(summary.balance)}</b><em>Müşteri cari bakiyesi</em></article>
        <article data-tone="danger"><span><AlertCircle aria-hidden size={19} /></span><small>Gecikmiş</small><b>{formatMoney(summary.overdue)}</b><em>Vadesi geçen planlı hareketler</em></article>
      </div>
      <section className={styles.ledgerPanel}>
        <div className={styles.tabHeading}><div><p>Denetlenebilir cari ekstre</p><h3>Tüm para hareketleri</h3></div><button className={styles.primaryButton} onClick={onAdd} type="button"><Plus aria-hidden size={16} /> Hareket ekle</button></div>
        {entries.length ? (
          <div className={styles.tableScroller}>
            <table className={styles.ledgerTable}>
              <thead><tr>{showCustomer ? <th>Müşteri</th> : null}<th>İşlem</th><th>Tarih / vade</th><th>Durum</th><th>Tutar</th><th>Açıklama</th><th><span className={styles.srOnly}>İşlem</span></th></tr></thead>
              <tbody>
                {entries.map((entry) => (
                  <tr data-reversed={entry.reversed} key={entry.activityId}>
                    {showCustomer ? <td><b>{entry.contactName}</b></td> : null}
                    <td><span className={styles.entryKind} data-kind={entry.kind}>{financeKindLabels[entry.kind]}</span><small>{entry.method || 'Yöntem belirtilmedi'}</small></td>
                    <td><b>{formatDate(entry.occurredAt)}</b><small>Vade: {formatDate(entry.dueAt)}</small></td>
                    <td><span className={styles.entryStatus} data-status={entry.reversed ? 'CANCELLED' : entry.status}>{entry.reversed ? 'İptal edildi' : { PLANNED: 'Planlandı', PAID: 'Ödendi', OVERDUE: 'Gecikmiş', CANCELLED: 'İptal' }[entry.status]}</span></td>
                    <td className={styles.moneyCell}>{formatMoney(entry.amount, entry.currency)}</td>
                    <td><b>{entry.description || 'Açıklama yok'}</b><small>{entry.reference || 'Referans yok'}</small></td>
                    <td>{!entry.reversed ? <button aria-label={`${financeKindLabels[entry.kind]} hareketini iptal et`} className={styles.tableAction} onClick={() => onReverse(entry)} type="button"><X aria-hidden size={16} /></button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState action={<button className={styles.secondaryButton} onClick={onAdd} type="button">İlk hareketi ekle</button>} icon={WalletCards} title="Cari hesap henüz boş" description="Borç, tahsilat, kapora, komisyon, masraf ve iadeleri burada yönetin." />}
      </section>
    </div>
  );
}

function TaskView({ tasks, busy, onAdd, onToggle }: {
  tasks: CrmTask[];
  busy: boolean;
  onAdd: () => void;
  onToggle: (task: CrmTask) => void;
}) {
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'OPEN' ? -1 : 1;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
  return (
    <section className={styles.taskPanel}>
      <div className={styles.tabHeading}><div><p>Takip çalışma listesi</p><h3>Aramalar, randevular ve yapılacaklar</h3></div><button className={styles.secondaryButton} onClick={onAdd} type="button"><Plus aria-hidden size={16} /> Görev ekle</button></div>
      {sortedTasks.length ? (
        <div className={styles.taskList}>
          {sortedTasks.map((task) => (
            <article data-completed={task.status === 'COMPLETED'} data-overdue={isTaskOverdue(task)} key={task.id}>
              <button aria-label={`${task.title} görev durumunu değiştir`} disabled={busy} onClick={() => onToggle(task)} type="button">{task.status === 'COMPLETED' ? <Check aria-hidden size={16} /> : null}</button>
              <span data-priority={task.priority}>{taskTypeLabels[task.type]}</span>
              <div><h4>{task.title}</h4><p>{task.description || 'Açıklama yok'}</p><small>{task.contact?.name || 'Genel görev'} · {task.assignedMember?.name || 'Atanmamış'}</small></div>
              <time dateTime={task.dueAt || undefined}><Clock3 aria-hidden size={14} /> {formatDate(task.dueAt, true)}</time>
            </article>
          ))}
        </div>
      ) : <EmptyState action={<button className={styles.secondaryButton} onClick={onAdd} type="button">İlk görevi oluştur</button>} icon={ListChecks} title="Görev bulunmuyor" description="Müşterinin sıradaki aksiyonunu kaydederek takibi başlatın." />}
    </section>
  );
}

function DealView({ deals, busy, onAdd, onAdvance }: {
  deals: CrmDeal[];
  busy: boolean;
  onAdd: () => void;
  onAdvance: (deal: CrmDeal, stage: CrmDealStage) => void;
}) {
  return (
    <section className={styles.dealListPanel}>
      <div className={styles.tabHeading}><div><p>Müşteri fırsatları</p><h3>Satış, kiralama ve komisyon potansiyeli</h3></div><button className={styles.primaryButton} onClick={onAdd} type="button"><Plus aria-hidden size={16} /> Fırsat aç</button></div>
      {deals.length ? (
        <div className={styles.dealList}>
          {deals.map((deal) => {
            const nextStage = nextDealStage(deal.stage);
            return (
              <article key={deal.id}>
                <div className={styles.dealProbability}><span style={{ '--progress': `${deal.probability}%` } as React.CSSProperties}>{deal.probability}%</span><small>Kazanma ihtimali</small></div>
                <div><span className={styles.stageBadge}>{dealStageLabels[deal.stage]}</span><h4>{deal.title}</h4><p>{deal.property?.title || 'Portföy seçilmedi'} · {deal.assignedMember?.name || 'Danışman atanmamış'}</p><small>{deal.nextAction || 'Sonraki aksiyon girilmedi'}</small></div>
                <div className={styles.dealListValue}><b>{formatMoney(deal.estimatedValue)}</b><small>{formatMoney((deal.estimatedValue || 0) * ((deal.commissionRate || 0) / 100))} komisyon</small>{nextStage ? <button disabled={busy} onClick={() => onAdvance(deal, nextStage)} type="button">İlerle <ArrowRight aria-hidden size={15} /></button> : null}</div>
              </article>
            );
          })}
        </div>
      ) : <EmptyState action={<button className={styles.primaryButton} onClick={onAdd} type="button">İlk fırsatı aç</button>} icon={BriefcaseBusiness} title="Satış fırsatı bulunmuyor" description="Müşterinin ilgilendiği portföyü ve tahmini işlem tutarını kaydedin." />}
    </section>
  );
}

function InsightsView({ contacts, deals, tasks, financeSummary }: {
  contacts: CrmContact[];
  deals: CrmDeal[];
  tasks: CrmTask[];
  financeSummary: ReturnType<typeof calculateFinanceSummary>;
}) {
  const sources = Object.entries(contacts.reduce<Record<string, number>>((accumulator, contact) => {
    const key = contact.source || 'Kaynak belirtilmedi';
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {})).sort((a, b) => b[1] - a[1]);
  const won = deals.filter((deal) => deal.stage === 'WON').length;
  const conversion = contacts.length ? Math.round((won / contacts.length) * 100) : 0;
  const taskCompletion = tasks.length ? Math.round((tasks.filter((task) => task.status === 'COMPLETED').length / tasks.length) * 100) : 0;
  return (
    <section aria-labelledby="insights-title" className={styles.sectionBody}>
      <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>CRM zekâsı</p><h2 id="insights-title">Satış ve müşteri performansını ölç</h2></div><span className={styles.liveBadge}><Sparkles aria-hidden size={14} /> Gerçek CRM verisi</span></div>
      <div className={styles.insightKpis}>
        <article><small>Müşteriden satışa dönüşüm</small><b>%{conversion}</b><span><i style={{ width: `${Math.min(100, conversion)}%` }} /></span><p>{won} kazanılan işlem / {contacts.length} müşteri</p></article>
        <article><small>Görev tamamlama oranı</small><b>%{taskCompletion}</b><span><i style={{ width: `${Math.min(100, taskCompletion)}%` }} /></span><p>{tasks.filter((task) => task.status === 'COMPLETED').length} görev tamamlandı</p></article>
        <article><small>Tahsilat oranı</small><b>%{financeSummary.receivable ? Math.min(100, Math.round((financeSummary.collected / financeSummary.receivable) * 100)) : 0}</b><span><i style={{ width: `${financeSummary.receivable ? Math.min(100, (financeSummary.collected / financeSummary.receivable) * 100) : 0}%` }} /></span><p>{formatMoney(financeSummary.collected)} tahsil edildi</p></article>
      </div>
      <div className={styles.insightGrid}>
        <section><div className={styles.panelHeading}><div><p>Kazanım kanalları</p><h3>Müşteriler nereden geliyor?</h3></div></div>{sources.length ? <div className={styles.sourceList}>{sources.map(([source, count]) => <div key={source}><span><b>{source}</b><small>{count} müşteri</small></span><div><i style={{ width: `${(count / contacts.length) * 100}%` }} /></div><strong>%{Math.round((count / contacts.length) * 100)}</strong></div>)}</div> : <EmptyState icon={Target} title="Kaynak verisi yok" description="Yeni müşteri eklerken kazanım kaynağını seçin." />}</section>
        <section><div className={styles.panelHeading}><div><p>Huni dönüşümü</p><h3>Aşamalardaki müşteri dağılımı</h3></div></div><div className={styles.stageDistribution}>{dealStageOrder.map((stage) => { const count = deals.filter((deal) => deal.stage === stage).length; return <div key={stage}><span>{dealStageLabels[stage]}</span><b>{count}</b><small>{deals.length ? `%${Math.round((count / deals.length) * 100)}` : '%0'}</small></div>; })}</div></section>
      </div>
    </section>
  );
}

function CrmActionForm({ kind, contact, workspace, busy, onSubmit, onCancel }: {
  kind: Exclude<ModalKind, null>;
  contact: CrmContact | null;
  workspace: CrmWorkspaceData;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const submitLabel = {
    contact: 'Müşteriyi kaydet',
    'edit-contact': 'Dosyayı güncelle',
    task: 'Görevi oluştur',
    deal: 'Fırsatı aç',
    note: 'Notu kaydet',
    finance: 'Hareketi kaydet',
  }[kind];

  return (
    <form className={styles.modalForm} onSubmit={onSubmit}>
      {(kind === 'contact' || kind === 'edit-contact') ? (
        <>
          <div className={styles.formGrid}>
            <label className={styles.fullField}><span>Ad soyad <b>*</b></span><input autoComplete="name" defaultValue={contact?.name || ''} minLength={2} name="name" required /></label>
            <label><span>Telefon</span><input autoComplete="tel" defaultValue={contact?.phone || ''} name="phone" type="tel" /></label>
            <label><span>E-posta</span><input autoComplete="email" defaultValue={contact?.email || ''} name="email" type="email" /></label>
            <label><span>Müşteri rolü</span><select defaultValue={contact?.type || 'BUYER'} name="type">{Object.entries(contactTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Satış aşaması</span><select defaultValue={contact?.stage || 'NEW'} name="stage">{Object.entries(contactStageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>Kazanım kaynağı</span><input defaultValue={contact?.source || ''} name="source" placeholder="Web sitesi, referans, WhatsApp..." /></label>
            <label><span>Sorumlu danışman</span><select defaultValue={contact?.assignedMember?.id || ''} name="assignedMemberId"><option value="">Atanmamış</option>{workspace.members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label><span>Hedef bölge</span><input defaultValue={contact?.desiredLocation || ''} name="desiredLocation" placeholder="İlçe, mahalle" /></label>
            <label><span>Oda tercihi</span><input defaultValue={contact?.desiredRoomCount || ''} name="desiredRoomCount" placeholder="3+1" /></label>
            <label><span>Minimum bütçe</span><input defaultValue={contact?.budgetMin ?? ''} min="0" name="budgetMin" step="1000" type="number" /></label>
            <label><span>Maksimum bütçe</span><input defaultValue={contact?.budgetMax ?? ''} min="0" name="budgetMax" step="1000" type="number" /></label>
            <label><span>İletişim izni</span><select defaultValue={contact?.consentStatus || 'UNKNOWN'} name="consentStatus"><option value="UNKNOWN">Henüz sorulmadı</option><option value="GRANTED">İzin verildi</option><option value="REVOKED">İzin geri çekildi</option></select></label>
            {kind === 'edit-contact' ? <label><span>Sonraki takip</span><input defaultValue={dateToInput(contact?.nextActionAt)} name="nextActionAt" type="datetime-local" /></label> : null}
            {kind === 'edit-contact' ? <label className={styles.fullField}><span>Etiketler</span><input defaultValue={contact?.tags.join(', ') || ''} name="tags" placeholder="VIP, yatırımcı, kredi hazır" /><small>Etiketleri virgülle ayırın.</small></label> : null}
            <label className={styles.fullField}><span>İhtiyaç ve görüşme notu</span><textarea defaultValue={contact?.notes || ''} name="notes" placeholder="Müşterinin karar kriterleri, itirazları ve özel notları" rows={4} /></label>
          </div>
        </>
      ) : null}

      {kind === 'note' ? <label className={styles.fullField}><span>Görüşme notu <b>*</b></span><textarea autoFocus minLength={2} name="note" placeholder="Ne konuşuldu, müşteri ne istedi ve sonraki adım ne?" required rows={7} /></label> : null}

      {kind === 'task' ? (
        <div className={styles.formGrid}>
          <label className={styles.fullField}><span>Görev başlığı <b>*</b></span><input autoFocus minLength={3} name="title" placeholder="Müşteriyi teklif için ara" required /></label>
          <label><span>Görev türü</span><select defaultValue="FOLLOW_UP" name="type">{Object.entries(taskTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Öncelik</span><select defaultValue="2" name="priority"><option value="1">Düşük</option><option value="2">Normal</option><option value="3">Kritik</option></select></label>
          <label><span>Tarih ve saat</span><input name="dueAt" type="datetime-local" /></label>
          <label><span>Sorumlu danışman</span><select defaultValue={contact?.assignedMember?.id || ''} name="assignedMemberId"><option value="">Atanmamış</option>{workspace.members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
          <label><span>İlgili fırsat</span><select name="dealId"><option value="">Fırsat seçilmedi</option>{workspace.deals.filter((deal) => deal.contact.id === contact?.id).map((deal) => <option key={deal.id} value={deal.id}>{deal.title}</option>)}</select></label>
          <label><span>İlgili portföy</span><select name="propertyId"><option value="">Portföy seçilmedi</option>{workspace.properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <label className={styles.fullField}><span>Açıklama</span><textarea name="description" placeholder="Görüşmede ele alınacak konu ve beklenen sonuç" rows={4} /></label>
        </div>
      ) : null}

      {kind === 'deal' ? (
        <div className={styles.formGrid}>
          <label className={styles.fullField}><span>Fırsat adı <b>*</b></span><input autoFocus minLength={3} name="title" placeholder={`${contact?.name || 'Müşteri'} · Satış fırsatı`} required /></label>
          <label><span>Portföy</span><select name="propertyId"><option value="">Henüz seçilmedi</option>{workspace.properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <label><span>Sorumlu danışman</span><select defaultValue={contact?.assignedMember?.id || ''} name="assignedMemberId"><option value="">Atanmamış</option>{workspace.members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
          <label><span>Tahmini işlem tutarı</span><input min="0" name="estimatedValue" step="1000" type="number" /></label>
          <label><span>Komisyon oranı (%)</span><input defaultValue="2" max="100" min="0" name="commissionRate" step="0.1" type="number" /></label>
          <label className={styles.fullField}><span>Sonraki aksiyon</span><input name="nextAction" placeholder="Portföy sunumu gönderilecek" /></label>
        </div>
      ) : null}

      {kind === 'finance' ? (
        <div className={styles.formGrid}>
          <label><span>Hareket türü <b>*</b></span><select defaultValue="PAYMENT" name="kind">{Object.entries(financeKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Durum</span><select defaultValue="PAID" name="status"><option value="PLANNED">Planlandı</option><option value="PAID">Ödendi</option><option value="OVERDUE">Gecikmiş</option></select></label>
          <label><span>Tutar <b>*</b></span><input autoFocus min="0.01" name="amount" required step="0.01" type="number" /></label>
          <label><span>Para birimi</span><select defaultValue="TRY" name="currency"><option value="TRY">TRY · Türk lirası</option><option value="USD">USD · Amerikan doları</option><option value="EUR">EUR · Euro</option><option value="GBP">GBP · İngiliz sterlini</option></select></label>
          <label><span>İşlem tarihi</span><input defaultValue={dateToInput(new Date().toISOString())} name="occurredAt" required type="datetime-local" /></label>
          <label><span>Vade tarihi</span><input name="dueAt" type="datetime-local" /></label>
          <label><span>Ödeme yöntemi</span><select name="method"><option value="">Belirtilmedi</option><option value="Nakit">Nakit</option><option value="Havale / EFT">Havale / EFT</option><option value="Kredi kartı">Kredi kartı</option><option value="Çek / senet">Çek / senet</option><option value="Ödeme linki">Ödeme linki</option></select></label>
          <label><span>Referans / makbuz no</span><input name="reference" placeholder="TRX-2026-..." /></label>
          <label><span>İlgili fırsat</span><select name="dealId"><option value="">Seçilmedi</option>{workspace.deals.filter((deal) => deal.contact.id === contact?.id).map((deal) => <option key={deal.id} value={deal.id}>{deal.title}</option>)}</select></label>
          <label><span>İlgili portföy</span><select name="propertyId"><option value="">Seçilmedi</option>{workspace.properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <label className={styles.fullField}><span>Açıklama</span><textarea name="description" placeholder="Kapora, hizmet bedeli, komisyon taksiti..." rows={3} /></label>
        </div>
      ) : null}

      <footer className={styles.modalFooter}>
        <button className={styles.secondaryButton} disabled={busy} onClick={onCancel} type="button">Vazgeç</button>
        <button className={styles.primaryButton} disabled={busy} type="submit">{busy ? <LoaderCircle aria-hidden className={styles.spinner} size={17} /> : <Check aria-hidden size={17} />}{busy ? 'Kaydediliyor…' : submitLabel}</button>
      </footer>
    </form>
  );
}
