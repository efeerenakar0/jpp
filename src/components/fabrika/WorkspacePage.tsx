'use client';

import Link from 'next/link';
import {
  Activity,
  BadgeCheck,
  BrainCircuit,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Clock3,
  ContactRound,
  Edit3,
  ExternalLink,
  Flame,
  Home,
  ImagePlus,
  Kanban,
  KeyRound,
  ListChecks,
  Loader2,
  MessageSquareText,
  Network,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Target,
  UploadCloud,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';
import EmptyState from '@/components/fabrika/EmptyState';
import PageHeader from '@/components/fabrika/PageHeader';
import StatCard from '@/components/fabrika/StatCard';
import PortfolioSourcesPanel from '@/components/fabrika/PortfolioSourcesPanel';
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  buildMemberOperationalPayload,
  MEMBER_WORK_DAYS,
  type MemberWorkDay,
} from '@/lib/company-member-form';

export type WorkspaceMode =
  | 'crm'
  | 'portfoyler'
  | 'satis'
  | 'takvim'
  | 'satici-portali'
  | 'sirket';

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phoneNormalized: string | null;
  canReceiveWhatsAppTasks: boolean;
  allowAutomaticInternalMessages: boolean;
  preferredLanguage: string;
  workHours: {
    timezone: string;
    days: Array<{
      day: MemberWorkDay;
      enabled: boolean;
      start: string;
      end: string;
    }>;
  } | null;
  availability: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'OFFLINE';
  specialtyRegions: string[];
  specialties: string[];
  maxActiveTaskCapacity: number;
  lastAssignedAt: string | null;
  role: 'OWNER' | 'MANAGER' | 'AGENT' | 'VIEWER';
  active: boolean;
  username: string | null;
  lastLoginAt: string | null;
  credentialsUpdatedAt: string | null;
};

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  type: 'BUYER' | 'SELLER' | 'INVESTOR' | 'TENANT' | 'OTHER';
  stage: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'VIEWING' | 'OFFER' | 'WON' | 'LOST';
  source: string | null;
  desiredLocation: string | null;
  desiredRoomCount: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  notes: string | null;
  tags: string[];
  score: number;
  scoreReasons: string[];
  scoreSource: 'AI' | 'RULES' | null;
  scoreUpdatedAt: string | null;
  consentStatus: 'UNKNOWN' | 'GRANTED' | 'REVOKED';
  nextActionAt: string | null;
  assignedMember: Pick<Member, 'id' | 'name'> | null;
  updatedAt: string;
};

type Property = {
  id: string;
  title: string;
  referenceCode: string | null;
  location: string | null;
  price: number | null;
  roomCount: string | null;
  area: number | null;
  status: 'DRAFT' | 'ACTIVE' | 'RESERVED' | 'SOLD' | 'RENTED' | 'ARCHIVED';
  description: string | null;
  imageUrl: string | null;
  sellerPortalToken: string;
  sellerPortalEnabled: boolean;
  listingViews: number;
  inquiryCount: number;
  showingCount: number;
  offerCount: number;
  ownerContact: Pick<Contact, 'id' | 'name'> | null;
  assignedMember: Pick<Member, 'id' | 'name'> | null;
};

type DealStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'MATCHED'
  | 'VIEWING'
  | 'OFFER'
  | 'CONTRACT'
  | 'WON'
  | 'LOST';

type Deal = {
  id: string;
  title: string;
  stage: DealStage;
  estimatedValue: number | null;
  commissionRate: number | null;
  probability: number;
  nextAction: string | null;
  contact: Pick<Contact, 'id' | 'name' | 'phone'>;
  property: Pick<Property, 'id' | 'title' | 'location'> | null;
  assignedMember: Pick<Member, 'id' | 'name'> | null;
};

type Task = {
  id: string;
  title: string;
  type: 'CALL' | 'MESSAGE' | 'MEETING' | 'VIEWING' | 'FOLLOW_UP' | 'DOCUMENT' | 'OTHER';
  description: string | null;
  dueAt: string | null;
  priority: number;
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  contact: Pick<Contact, 'id' | 'name'> | null;
  property: Pick<Property, 'id' | 'title'> | null;
  deal: Pick<Deal, 'id' | 'title'> | null;
  assignedMember: Pick<Member, 'id' | 'name'> | null;
};

type ActivityItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  metadata: string | null;
  contact: Pick<Contact, 'id' | 'name'> | null;
  property: Pick<Property, 'id' | 'title'> | null;
  deal: Pick<Deal, 'id' | 'title'> | null;
  actorMember: Pick<Member, 'id' | 'name'> | null;
  createdAt: string;
};

type Workspace = {
  account: {
    id: string;
    companyName: string;
    ownerName: string;
    ownerEmail: string | null;
    slug: string;
    subscriptionPlan: string | null;
    subscriptionStatus: string | null;
    subscriptionEndsAt: string | null;
    workspaceEnabled: boolean;
    createdAt: string;
  };
  permissions: {
    canManageTeam: boolean;
    canManageSecrets: boolean;
    canViewSubscription: boolean;
    canEditReports: boolean;
  };
  members: Member[];
  contacts: Contact[];
  properties: Property[];
  deals: Deal[];
  tasks: Task[];
  activities: ActivityItem[];
  metrics: {
    contacts: number;
    activeProperties: number;
    openDeals: number;
    overdueTasks: number;
    upcomingCriticalTasks: number;
    pipelineValue: number;
    wonCommission: number;
    averageMatchScore: number;
  };
};

type DialogKind =
  | 'contact'
  | 'contact-edit'
  | 'property'
  | 'property-edit'
  | 'deal'
  | 'task'
  | 'member'
  | 'member-edit'
  | null;

type OneTimeMemberCredentials = {
  username: string;
  temporaryCode: string;
};

export type WorkspaceInitialView =
  | 'customers'
  | 'pipeline'
  | 'properties'
  | 'owner-reports'
  | 'sources';

const pageMeta: Record<
  WorkspaceMode,
  { title: string; description: string; eyebrow: string; icon: typeof Users }
> = {
  crm: {
    title: 'Merkezi CRM',
    description: 'Müşterilerin tercihlerini, iletişim geçmişini ve satış potansiyelini tek profilde yönetin.',
    eyebrow: 'Müşteri hafızası',
    icon: Users,
  },
  portfoyler: {
    title: 'Portföy Yönetimi',
    description: 'Satılık ve kiralık portföyleri, sahiplerini, performanslarını ve sorumlu danışmanları yönetin.',
    eyebrow: 'Portföy merkezi',
    icon: Home,
  },
  satis: {
    title: 'Satış Hunisi',
    description: 'Her fırsatın hangi aşamada olduğunu, tahmini değerini ve sonraki işlemini görün.',
    eyebrow: 'Gelir operasyonu',
    icon: Kanban,
  },
  takvim: {
    title: 'Randevular ve Görevler',
    description: 'Arama, mesaj, gösterim, toplantı ve takip işlerini tek çalışma listesinde yönetin.',
    eyebrow: 'Günlük plan',
    icon: CalendarDays,
  },
  'satici-portali': {
    title: 'Satıcı Müşteri Portalı',
    description: 'Mülk sahipleriyle görüntülenme, talep, gösterim ve teklif ilerlemesini şeffaf biçimde paylaşın.',
    eyebrow: 'Müşteri deneyimi',
    icon: Share2,
  },
  sirket: {
    title: 'Şirket ve Ekip',
    description: 'Şirket hesabını, ekip rollerini, abonelik durumunu ve çalışma alanı erişimini yönetin.',
    eyebrow: 'Organizasyon',
    icon: Settings2,
  },
};

const stageLabels: Record<DealStage, string> = {
  NEW: 'Yeni',
  CONTACTED: 'İletişim',
  QUALIFIED: 'Nitelikli',
  MATCHED: 'Eşleşti',
  VIEWING: 'Gösterim',
  OFFER: 'Teklif',
  CONTRACT: 'Sözleşme',
  WON: 'Kazanıldı',
  LOST: 'Kaybedildi',
};

const visibleStages: DealStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'MATCHED',
  'VIEWING',
  'OFFER',
  'CONTRACT',
  'WON',
];

const contactStageLabels: Record<Contact['stage'], string> = {
  NEW: 'Yeni',
  CONTACTED: 'İletişimde',
  QUALIFIED: 'Nitelikli',
  VIEWING: 'Gösterim',
  OFFER: 'Teklif',
  WON: 'Kazanıldı',
  LOST: 'Kaybedildi',
};

const contactTypeLabels: Record<Contact['type'], string> = {
  BUYER: 'Alıcı',
  SELLER: 'Satıcı',
  INVESTOR: 'Yatırımcı',
  TENANT: 'Kiracı',
  OTHER: 'Diğer',
};

const memberRoleLabels: Record<Member['role'], string> = {
  OWNER: 'Patron',
  MANAGER: 'Yönetici',
  AGENT: 'Danışman',
  VIEWER: 'Gözlemci',
};

const memberAvailabilityLabels: Record<Member['availability'], string> = {
  AVAILABLE: 'Müsait',
  BUSY: 'Meşgul',
  ON_LEAVE: 'İzinli',
  OFFLINE: 'Çevrimdışı',
};

function customerHeat(score: number) {
  if (score >= 80) {
    return {
      label: 'Çok sıcak',
      className: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
    };
  }
  if (score >= 60) {
    return {
      label: 'Sıcak',
      className: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    };
  }
  return {
    label: 'Takipte',
    className: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  };
}

const fieldClass =
  'h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';

const labelClass = 'space-y-1.5 text-xs font-medium text-slate-300';

function money(value: number | null | undefined) {
  if (value == null) return 'Belirtilmedi';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value: string | null) {
  if (!value) return 'Tarih yok';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function dateTimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function SelectField({
  name,
  children,
  defaultValue,
  required,
  value,
  disabled,
  onChange,
}: {
  name: string;
  children: React.ReactNode;
  defaultValue?: string;
  required?: boolean;
  value?: string;
  disabled?: boolean;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <select
      className={fieldClass}
      defaultValue={defaultValue}
      disabled={disabled}
      name={name}
      onChange={onChange}
      required={required}
      value={value}
    >
      {children}
    </select>
  );
}

type LocationOption = {
  id: number;
  name: string;
};

const roomCountOptions = [
  '1+0',
  '1+1',
  '2+0',
  '2+1',
  '2+2',
  '3+1',
  '3+2',
  '4+1',
  '4+2',
  '5+1',
  '5+2',
  '6+1',
  '6+2',
  '7+1',
  '7+2',
  '8+',
];

async function fetchLocationOptions(
  level: 'provinces' | 'districts' | 'neighborhoods',
  parentId?: string
) {
  const search = new URLSearchParams({ level });
  if (parentId) search.set('parentId', parentId);

  const response = await fetch(`/api/fabrika/locations?${search.toString()}`);
  const body = (await response.json()) as {
    success?: boolean;
    items?: LocationOption[];
    error?: string;
  };
  if (!response.ok || !body.success || !body.items) {
    throw new Error(body.error || 'Konumlar yüklenemedi.');
  }
  return body.items;
}

export default function WorkspacePage({
  mode,
  initialView,
}: {
  mode: WorkspaceMode;
  initialView?: WorkspaceInitialView;
}) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [memberCredentials, setMemberCredentials] =
    useState<OneTimeMemberCredentials | null>(null);
  const [query, setQuery] = useState('');
  const [crmFilter, setCrmFilter] = useState<'all' | 'hot' | 'follow-up'>('all');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [profileView, setProfileView] = useState<
    'overview' | 'activity'
  >('overview');
  const [renderedAt] = useState(Date.now);
  const [crmView, setCrmView] = useState<'customers' | 'pipeline'>(
    initialView === 'pipeline' ? 'pipeline' : 'customers'
  );
  const [portfolioView, setPortfolioView] = useState<
    'properties' | 'owner-reports' | 'sources'
  >(
    initialView === 'owner-reports'
      ? 'owner-reports'
      : initialView === 'sources'
        ? 'sources'
        : 'properties'
  );
  const meta = pageMeta[mode];

  async function loadWorkspace() {
    try {
      const response = await fetch('/api/fabrika/workspace', {
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Çalışma alanı yüklenemedi.');
      }
      setWorkspace(data.workspace);
      if (data.oneTimeCredentials) {
        setMemberCredentials(data.oneTimeCredentials);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(loadWorkspace, 0);
    const refreshInterval = window.setInterval(loadWorkspace, 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refreshInterval);
    };
  }, []);

  async function postAction(payload: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    try {
      const response = await fetch('/api/fabrika/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'İşlem tamamlanamadı.');
      }
      setWorkspace(data.workspace);
      if (data.oneTimeCredentials) {
        setMemberCredentials(data.oneTimeCredentials);
      }
      setDialog(null);
      setSelectedMemberId(null);
      setSelectedPropertyId(null);
      toast.success(data.message || successMessage);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  const filteredContacts = useMemo(() => {
    if (!workspace) return [];
    const normalized = query.toLocaleLowerCase('tr-TR');
    const now = new Date();
    return workspace.contacts.filter((contact) => {
      const matchesQuery = [contact.name, contact.phone, contact.email, contact.desiredLocation]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('tr-TR').includes(normalized));
      if (!matchesQuery) return false;
      if (crmFilter === 'hot') return contact.score >= 60;
      if (crmFilter === 'follow-up') {
        return (
          ['NEW', 'CONTACTED'].includes(contact.stage) ||
          (contact.nextActionAt !== null && new Date(contact.nextActionAt) <= now)
        );
      }
      return true;
    });
  }, [crmFilter, query, workspace]);

  const selectedContact =
    workspace?.contacts.find((contact) => contact.id === selectedContactId) ||
    filteredContacts[0] ||
    null;
  const selectedContactActivities = selectedContact
    ? workspace?.activities.filter(
        (activity) => activity.contact?.id === selectedContact.id
      ) || []
    : [];
  const selectedContactDeals = selectedContact
    ? workspace?.deals.filter((deal) => deal.contact.id === selectedContact.id) || []
    : [];
  const selectedContactTasks = selectedContact
    ? workspace?.tasks.filter((task) => task.contact?.id === selectedContact.id) || []
    : [];
  const selectedMember =
    workspace?.members.find((member) => member.id === selectedMemberId) || null;
  const selectedProperty =
    workspace?.properties.find(
      (property) => property.id === selectedPropertyId
    ) || null;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full bg-slate-900" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28 bg-slate-900" />
          ))}
        </div>
        <Skeleton className="h-96 w-full bg-slate-900" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <EmptyState
        icon={Activity}
        title="Çalışma alanı yüklenemedi"
        description="Sayfayı yenileyin. Sorun devam ederse oturumu kapatıp yeniden giriş yapın."
        action={
          <Button onClick={loadWorkspace} variant="outline">
            Yeniden dene
          </Button>
        }
      />
    );
  }

  const hotContactCount = workspace.contacts.filter((contact) => contact.score >= 60).length;
  const followUpContactCount = workspace.contacts.filter(
    (contact) =>
      ['NEW', 'CONTACTED'].includes(contact.stage) ||
      (contact.nextActionAt !== null && new Date(contact.nextActionAt) <= new Date())
  ).length;

  const headerAction =
    mode === 'crm'
      ? crmView === 'pipeline'
        ? () => setDialog('deal')
        : () => setDialog('contact')
      : mode === 'portfoyler'
        ? portfolioView === 'properties'
          ? () => setDialog('property')
          : null
        : mode === 'satis'
          ? () => setDialog('deal')
          : mode === 'takvim'
            ? () => setDialog('task')
            : mode === 'sirket' && workspace.permissions.canManageTeam
              ? () => setDialog('member')
              : null;

  const actionLabels: Partial<Record<WorkspaceMode, string>> = {
    crm: crmView === 'pipeline' ? 'Fırsat ekle' : 'Müşteri ekle',
    portfoyler:
      portfolioView === 'properties' ? 'Portföy ekle' : undefined,
    satis: 'Fırsat ekle',
    takvim: 'Görev ekle',
    sirket: 'Ekip üyesi ekle',
  };
  const actionLabel = actionLabels[mode];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={meta.title}
        description={meta.description}
        eyebrow={meta.eyebrow}
        icon={meta.icon}
        actions={
          <>
            {mode === 'crm' && crmView === 'customers' && (
              <Button
                className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                disabled={saving}
                onClick={() =>
                  postAction(
                    { action: 'sync-modules' },
                    'Asistan görüşmeleri CRM ile eşitlendi.'
                  )
                }
                variant="outline"
              >
                <RefreshCw className={saving ? 'animate-spin' : ''} />
                Asistan&apos;dan aktar
              </Button>
            )}
            {headerAction && actionLabel && (
              <Button
                className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                onClick={headerAction}
              >
                <Plus />
                {actionLabel}
              </Button>
            )}
          </>
        }
      />

      {mode === 'crm' ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Tüm müşteriler" value={workspace.metrics.contacts} icon={ContactRound} />
          <StatCard label="Sıcak takip" value={hotContactCount} icon={Flame} status="warning" />
          <StatCard label="Takip bekliyor" value={followUpContactCount} icon={Clock3} status={followUpContactCount > 0 ? 'warning' : 'default'} />
          <StatCard label="Açık fırsat" value={workspace.metrics.openDeals} icon={Target} status="success" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Toplam müşteri"
            value={workspace.metrics.contacts}
            icon={ContactRound}
          />
          <StatCard
            label="Aktif portföy"
            value={workspace.metrics.activeProperties}
            icon={Building2}
            status="success"
          />
          <StatCard
            label="Açık fırsat"
            value={workspace.metrics.openDeals}
            icon={Target}
          />
          <StatCard
            label={mode === 'satis' ? 'Tahmini satış hacmi' : 'Geciken görev'}
            value={
              mode === 'satis'
                ? money(workspace.metrics.pipelineValue)
                : workspace.metrics.overdueTasks
            }
            icon={mode === 'satis' ? CircleDollarSign : Clock3}
            status={workspace.metrics.overdueTasks > 0 ? 'warning' : 'default'}
          />
        </div>
      )}

      {mode === 'crm' ? (
        <Tabs
          onValueChange={(value) =>
            setCrmView(value as 'customers' | 'pipeline')
          }
          value={crmView}
        >
          <TabsList
            aria-label="CRM çalışma alanı"
            className="grid h-11 w-full max-w-md grid-cols-2 border border-slate-800 bg-slate-900"
          >
            <TabsTrigger value="customers">
              <Users aria-hidden="true" className="h-4 w-4" />
              Müşteriler
            </TabsTrigger>
            <TabsTrigger value="pipeline">
              <Kanban aria-hidden="true" className="h-4 w-4" />
              Satış süreci
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {mode === 'portfoyler' ? (
        <Tabs
          onValueChange={(value) =>
            setPortfolioView(
              value as 'properties' | 'owner-reports' | 'sources'
            )
          }
          value={portfolioView}
        >
          <TabsList
            aria-label="Portföy çalışma alanı"
            className="grid h-11 w-full max-w-2xl grid-cols-3 border border-slate-800 bg-slate-900"
          >
            <TabsTrigger value="properties">
              <Home aria-hidden="true" className="h-4 w-4" />
              Portföyler
            </TabsTrigger>
            <TabsTrigger value="owner-reports">
              <Share2 aria-hidden="true" className="h-4 w-4" />
              Malik raporları
            </TabsTrigger>
            <TabsTrigger value="sources">
              <Network aria-hidden="true" className="h-4 w-4" />
              Kaynaklar ve onay
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {mode === 'crm' && crmView === 'customers' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(22rem,.78fr)_minmax(0,1.35fr)]">
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Müşteri listesi</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredContacts.length} müşteri gösteriliyor
                </p>
              </div>
              <label className="relative block sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  aria-label="Müşterilerde ara"
                  className="h-10 border-slate-700 bg-slate-950 pl-9 text-slate-100"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ad, telefon, bölge..."
                  value={query}
                />
              </label>
            </div>
            <div className="flex gap-2 overflow-x-auto border-b border-slate-800 bg-slate-950/40 px-4 py-3" aria-label="Müşteri filtreleri">
              {[
                { value: 'all', label: 'Tümü' },
                { value: 'hot', label: 'Sıcak takip' },
                { value: 'follow-up', label: 'Takip bekleyen' },
              ].map((filter) => (
                <button
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    crmFilter === filter.value
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}
                  key={filter.value}
                  onClick={() => setCrmFilter(filter.value as 'all' | 'hot' | 'follow-up')}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {filteredContacts.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Users}
                  title="Henüz müşteri yok"
                  description="İlk müşteriyi ekleyin veya Asistan görüşmelerini üstteki aktar düğmesinden CRM’e alın."
                />
              </div>
            ) : (
              <div className="custom-scrollbar max-h-[760px] overflow-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Müşteri</th>
                      <th className="px-4 py-3 font-medium">Aşama</th>
                      <th className="px-4 py-3 font-medium">Sıcaklık</th>
                      <th className="px-4 py-3 font-medium">Son hareket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredContacts.map((contact) => {
                      const heat = customerHeat(contact.score);
                      return (
                        <tr
                          className={`cursor-pointer transition hover:bg-slate-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500 ${
                            selectedContact?.id === contact.id
                              ? 'bg-emerald-500/5'
                              : ''
                          }`}
                          key={contact.id}
                          onClick={() => {
                            setSelectedContactId(contact.id);
                            setProfileView('overview');
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedContactId(contact.id);
                              setProfileView('overview');
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-100">
                              {contact.name}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {contact.phone ||
                                contact.email ||
                                'İletişim bilgisi yok'}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-600">
                              {contactTypeLabels[contact.type]} ·{' '}
                              {contact.desiredLocation || 'Bölge yok'}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] text-slate-300">
                              {contactStageLabels[contact.stage]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${heat.className}`}
                            >
                              <Flame className="h-3 w-3" />
                              {heat.label} · {contact.score}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">
                            {dateTime(contact.updatedAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            {selectedContact ? (
              <div className="min-h-[680px]">
                <div className="border-b border-slate-800 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
                          360° müşteri profili
                        </p>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${customerHeat(selectedContact.score).className}`}
                        >
                          {customerHeat(selectedContact.score).label}
                        </span>
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        {selectedContact.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {selectedContact.phone ||
                          selectedContact.email ||
                          'İletişim bilgisi yok'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        aria-label="Müşteri profilini düzenle"
                        onClick={() => setDialog('contact-edit')}
                        size="sm"
                        variant="outline"
                      >
                        <Edit3 className="h-4 w-4" />
                        Düzenle
                      </Button>
                      <Button
                        className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                        disabled={saving}
                        onClick={() =>
                          postAction(
                            {
                              action: 'score-contact',
                              id: selectedContact.id,
                            },
                            'Müşteri öncelik puanı yenilendi.'
                          )
                        }
                        size="sm"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <BrainCircuit className="h-4 w-4" />
                        )}
                        AI puanla
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div>
                      <p className="text-xs text-emerald-300">
                        Satış öncelik puanı
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedContact.scoreSource === 'AI'
                          ? 'Yapay zekâ değerlendirmesi'
                          : selectedContact.scoreSource === 'RULES'
                            ? 'Akıllı kural yedeği'
                            : 'Başlangıç puanı'}
                        {selectedContact.scoreUpdatedAt
                          ? ` · ${dateTime(selectedContact.scoreUpdatedAt)}`
                          : ''}
                      </p>
                    </div>
                    <p className="text-3xl font-semibold text-emerald-300">
                      {selectedContact.score}
                      <span className="text-sm text-emerald-500">/100</span>
                    </p>
                  </div>
                </div>

                <Tabs
                  className="border-b border-slate-800 px-5 pt-4"
                  onValueChange={(value) =>
                    setProfileView(
                      value as 'overview' | 'activity'
                    )
                  }
                  value={profileView}
                >
                  <TabsList
                    aria-label="Müşteri profil bölümleri"
                    className="grid h-10 w-full max-w-md grid-cols-2 bg-slate-950"
                  >
                    <TabsTrigger value="overview">Genel bakış</TabsTrigger>
                    <TabsTrigger value="activity">
                      Zaman çizelgesi
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {profileView === 'overview' && (
                  <div className="custom-scrollbar max-h-[620px] space-y-4 overflow-y-auto p-5">
                    <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-3">
                      {[
                        ['Müşteri türü', contactTypeLabels[selectedContact.type]],
                        [
                          'Satış aşaması',
                          contactStageLabels[selectedContact.stage],
                        ],
                        [
                          'İstenen bölge',
                          selectedContact.desiredLocation || '—',
                        ],
                        ['Oda tercihi', selectedContact.desiredRoomCount || '—'],
                        [
                          'Bütçe',
                          selectedContact.budgetMin ||
                          selectedContact.budgetMax
                            ? `${money(selectedContact.budgetMin)} – ${money(selectedContact.budgetMax)}`
                            : '—',
                        ],
                        [
                          'Danışman',
                          selectedContact.assignedMember?.name || 'Atanmadı',
                        ],
                      ].map(([label, value]) => (
                        <div
                          className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                          key={label}
                        >
                          <dt className="text-xs text-slate-500">{label}</dt>
                          <dd className="mt-1 font-medium text-slate-200">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    <section
                      aria-labelledby="score-reasons-title"
                      className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
                    >
                      <div className="flex items-center gap-2">
                        <BrainCircuit className="h-4 w-4 text-emerald-400" />
                        <h3
                          className="text-sm font-semibold text-slate-100"
                          id="score-reasons-title"
                        >
                          Puanın nedenleri
                        </h3>
                      </div>
                      {selectedContact.scoreReasons.length > 0 ? (
                        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                          {selectedContact.scoreReasons.map((reason) => (
                            <li
                              className="flex gap-2 text-xs leading-5 text-slate-300"
                              key={reason}
                            >
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          Açıklamalı değerlendirme için “AI puanla” düğmesini
                          kullanın.
                        </p>
                      )}
                    </section>

                    <section
                      aria-labelledby="customer-notes-title"
                      className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
                    >
                      <h3
                        className="text-sm font-semibold text-slate-100"
                        id="customer-notes-title"
                      >
                        Danışman notları
                      </h3>
                      <p className="mt-2 max-h-36 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {selectedContact.notes ||
                          'Bu müşteri için henüz not bulunmuyor.'}
                      </p>
                      <form
                        className="mt-3 flex flex-col gap-2 sm:flex-row"
                        key={selectedContact.id}
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const form = event.currentTarget;
                          const note = String(
                            new FormData(form).get('note') || ''
                          );
                          const saved = await postAction(
                            {
                              action: 'add-contact-note',
                              id: selectedContact.id,
                              note,
                            },
                            'Müşteri notu kaydedildi.'
                          );
                          if (saved) form.reset();
                        }}
                      >
                        <Input
                          aria-label="Yeni müşteri notu"
                          className="border-slate-700 bg-slate-950 text-slate-100"
                          name="note"
                          placeholder="Görüşmeden kısa bir not ekleyin..."
                          required
                        />
                        <Button disabled={saving} type="submit" variant="outline">
                          <MessageSquareText className="h-4 w-4" />
                          Not ekle
                        </Button>
                      </form>
                    </section>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <Target className="h-4 w-4 text-emerald-400" />
                            Satış süreci
                          </h3>
                          <span className="text-xs text-slate-500">
                            {selectedContactDeals.length} fırsat
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {selectedContactDeals.length > 0 ? (
                            selectedContactDeals.slice(0, 4).map((deal) => (
                              <div
                                className="rounded-md border border-slate-800 bg-slate-900 p-3"
                                key={deal.id}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-xs font-medium text-slate-200">
                                    {deal.title}
                                  </p>
                                  <span className="text-[10px] text-emerald-300">
                                    %{deal.probability}
                                  </span>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  {stageLabels[deal.stage]} ·{' '}
                                  {money(deal.estimatedValue)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs leading-5 text-slate-500">
                              Bu müşteri için henüz satış fırsatı açılmadı.
                            </p>
                          )}
                        </div>
                      </section>

                      <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                            <ListChecks className="h-4 w-4 text-sky-400" />
                            Görevler
                          </h3>
                          <span className="text-xs text-slate-500">
                            {
                              selectedContactTasks.filter(
                                (task) => task.status === 'OPEN'
                              ).length
                            }{' '}
                            açık
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {selectedContactTasks.length > 0 ? (
                            selectedContactTasks.slice(0, 4).map((task) => (
                              <div
                                className="rounded-md border border-slate-800 bg-slate-900 p-3"
                                key={task.id}
                              >
                                <p className="text-xs font-medium text-slate-200">
                                  {task.title}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  {dateTime(task.dueAt)} · Öncelik{' '}
                                  {task.priority}/3
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs leading-5 text-slate-500">
                              Bu müşteriye bağlı görev bulunmuyor.
                            </p>
                          )}
                        </div>
                      </section>
                    </div>
                  </div>
                )}

                {profileView === 'activity' && (
                  <div className="custom-scrollbar max-h-[620px] overflow-y-auto p-5">
                    {selectedContactActivities.length > 0 ? (
                      <ol className="relative ml-2 border-l border-slate-800">
                        {selectedContactActivities.map((activity) => (
                          <li className="relative mb-5 ml-6" key={activity.id}>
                            <span className="absolute -left-[31px] top-1 flex h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400" />
                            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="text-sm font-semibold text-slate-100">
                                  {activity.title}
                                </h3>
                                <time className="text-[10px] text-slate-500">
                                  {dateTime(activity.createdAt)}
                                </time>
                              </div>
                              {activity.description && (
                                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-400">
                                  {activity.description}
                                </p>
                              )}
                              <p className="mt-2 text-[10px] text-slate-600">
                                {activity.actorMember?.name ||
                                  (activity.type === 'AI_SCORE_UPDATED'
                                    ? 'Jasmine AI'
                                    : 'Sistem')}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <EmptyState
                        icon={Activity}
                        title="Henüz aktivite yok"
                        description="Notlar, profil güncellemeleri ve satış hareketleri burada kronolojik olarak görünür."
                      />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5">
                <EmptyState
                  icon={ContactRound}
                  title="Profil seçin"
                  description="Detaylarını görmek için müşteri listesinden bir kayıt seçin."
                />
              </div>
            )}
          </aside>
        </div>
      )}

      {mode === 'portfoyler' && portfolioView === 'properties' && (
        workspace.properties.length === 0 ? (
          <EmptyState
            icon={Home}
            title="Henüz portföy yok"
            description="Manuel portföy ekleyin veya Avcı üzerinden satış yetkisi alınan kayıtları içe aktarın."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workspace.properties.map((property) => (
              <article
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
                key={property.id}
              >
                <div className="flex h-36 items-center justify-center bg-slate-950">
                  {property.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      src={property.imageUrl}
                    />
                  ) : (
                    <Home className="h-9 w-9 text-slate-700" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-white">{property.title}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {property.location || 'Konum yok'} · {property.roomCount || 'Oda bilgisi yok'}
                      </p>
                    </div>
                    <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                      {property.status}
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-slate-100">
                    {money(property.price)}
                  </p>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    {[
                      ['Görüntü', property.listingViews],
                      ['Talep', property.inquiryCount],
                      ['Gösterim', property.showingCount],
                      ['Teklif', property.offerCount],
                    ].map(([label, value]) => (
                      <div className="rounded-lg bg-slate-950 p-2" key={label}>
                        <p className="text-sm font-semibold text-white">{value}</p>
                        <p className="mt-0.5 text-[9px] text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
                    <span className="text-slate-500">
                      {property.ownerContact?.name || 'Mülk sahibi atanmadı'}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
                        onClick={() => {
                          setSelectedPropertyId(property.id);
                          setDialog('property-edit');
                        }}
                        type="button"
                      >
                        <Edit3 className="h-3 w-3" />
                        Düzenle
                      </button>
                      <Link
                        className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                        href={`/portfoy-takip/${property.sellerPortalToken}`}
                        target="_blank"
                      >
                        Malik raporu <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {mode === 'portfoyler' && portfolioView === 'sources' && (
        <PortfolioSourcesPanel onPortfolioChanged={loadWorkspace} />
      )}

      {(mode === 'satis' || (mode === 'crm' && crmView === 'pipeline')) && (
        <section className="custom-scrollbar overflow-x-auto pb-3">
          <div className="grid min-w-[1480px] grid-cols-8 gap-3">
            {visibleStages.map((stage) => {
              const stageDeals = workspace.deals.filter((deal) => deal.stage === stage);
              return (
                <div className="rounded-xl border border-slate-800 bg-slate-900/60" key={stage}>
                  <div className="flex items-center justify-between border-b border-slate-800 px-3 py-3">
                    <h2 className="text-xs font-semibold text-slate-200">{stageLabels[stage]}</h2>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className="space-y-2 p-2">
                    {stageDeals.map((deal) => {
                      const currentIndex = visibleStages.indexOf(stage);
                      const nextStage = visibleStages[currentIndex + 1];
                      return (
                        <article className="rounded-lg border border-slate-800 bg-slate-950 p-3" key={deal.id}>
                          <h3 className="text-xs font-semibold text-white">{deal.title}</h3>
                          <p className="mt-1 text-[11px] text-slate-500">{deal.contact.name}</p>
                          <p className="mt-3 text-sm font-semibold text-emerald-300">
                            {money(deal.estimatedValue)}
                          </p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${deal.probability}%` }}
                            />
                          </div>
                          {nextStage && (
                            <button
                              className="mt-3 w-full rounded-md border border-slate-700 px-2 py-1.5 text-[10px] font-medium text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                              disabled={saving}
                              onClick={() =>
                                postAction(
                                  { action: 'move-deal', id: deal.id, stage: nextStage },
                                  `Fırsat ${stageLabels[nextStage]} aşamasına taşındı.`
                                )
                              }
                              type="button"
                            >
                              Sonraki aşama
                            </button>
                          )}
                        </article>
                      );
                    })}
                    {stageDeals.length === 0 && (
                      <p className="px-2 py-8 text-center text-[11px] text-slate-600">Fırsat yok</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {mode === 'takvim' && (
        workspace.tasks.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Henüz görev yok"
            description="Arama, mesaj, toplantı veya portföy gösterimi için ilk görevi oluşturun."
          />
        ) : (
          <div className="grid gap-3">
            {workspace.tasks.map((task) => {
              const overdue =
                task.status === 'OPEN' &&
                task.dueAt &&
                new Date(task.dueAt).getTime() < renderedAt;
              return (
                <article
                  className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center ${
                    overdue
                      ? 'border-amber-500/25 bg-amber-500/5'
                      : 'border-slate-800 bg-slate-900'
                  }`}
                  key={task.id}
                >
                  <button
                    aria-label={task.status === 'COMPLETED' ? 'Görevi yeniden aç' : 'Görevi tamamla'}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                      task.status === 'COMPLETED'
                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                        : 'border-slate-700 bg-slate-950 text-slate-500 hover:text-emerald-300'
                    }`}
                    onClick={() =>
                      postAction(
                        {
                          action: 'toggle-task',
                          id: task.id,
                          completed: task.status !== 'COMPLETED',
                        },
                        task.status === 'COMPLETED' ? 'Görev yeniden açıldı.' : 'Görev tamamlandı.'
                      )
                    }
                    type="button"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={`font-semibold ${
                          task.status === 'COMPLETED'
                            ? 'text-slate-500 line-through'
                            : 'text-white'
                        }`}
                      >
                        {task.title}
                      </h2>
                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                        {task.type}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {[task.contact?.name, task.property?.title, task.assignedMember?.name]
                        .filter(Boolean)
                        .join(' · ') || 'Bağlı kayıt yok'}
                    </p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className={overdue ? 'text-sm text-amber-300' : 'text-sm text-slate-300'}>
                      {dateTime(task.dueAt)}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">Öncelik {task.priority}/3</p>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {(mode === 'satici-portali' ||
        (mode === 'portfoyler' && portfolioView === 'owner-reports')) && (
        <div className="space-y-4">
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 h-5 w-5 text-sky-400" />
              <div>
                <h2 className="text-sm font-semibold text-white">Paylaşılabilir malik raporu</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Her bağlantı yalnızca ilgili portföyün performansını gösterir; şirket paneline erişim vermez.
                </p>
              </div>
            </div>
          </div>
          {workspace.properties.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="Malik raporu oluşturulacak portföy yok"
              description="Önce Portföy Yönetimi sayfasından bir portföy ekleyin."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <div className="custom-scrollbar overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Portföy</th>
                      <th className="px-4 py-3">Mülk sahibi</th>
                      <th className="px-4 py-3">Toplam etkileşim</th>
                      <th className="px-4 py-3">Malik raporu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {workspace.properties.map((property) => {
                      const portalPath = `/portfoy-takip/${property.sellerPortalToken}`;
                      return (
                        <tr key={property.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-white">{property.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{property.location || 'Konum yok'}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {property.ownerContact?.name || 'Atanmadı'}
                          </td>
                          <td className="px-4 py-3 text-slate-300">
                            {property.listingViews +
                              property.inquiryCount +
                              property.showingCount +
                              property.offerCount}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button
                                className="border-slate-700 bg-slate-950 text-slate-200"
                                onClick={async () => {
                                  await navigator.clipboard.writeText(
                                    `${window.location.origin}${portalPath}`
                                  );
                                  toast.success('Malik raporu bağlantısı kopyalandı.');
                                }}
                                size="sm"
                                variant="outline"
                              >
                                Bağlantıyı kopyala
                              </Button>
                              <Button asChild size="sm" variant="ghost">
                                <Link href={portalPath} target="_blank">
                                  <ExternalLink />
                                </Link>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'sirket' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)]">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">Şirket hesabı</p>
            <h2 className="mt-2 text-xl font-semibold text-white">{workspace.account.companyName}</h2>
            <p className="mt-1 text-sm text-slate-400">{workspace.account.ownerName}</p>
            {workspace.permissions.canViewSubscription ? (
              <dl className="mt-6 space-y-3">
                {[
                  ['Abonelik', workspace.account.subscriptionStatus],
                  ['Paket', workspace.account.subscriptionPlan],
                  [
                    'Bitiş tarihi',
                    workspace.account.subscriptionEndsAt
                      ? dateTime(workspace.account.subscriptionEndsAt)
                      : 'Süresiz',
                  ],
                  ['Çalışma alanı', workspace.account.workspaceEnabled ? 'Aktif' : 'Beklemede'],
                ].map(([label, value]) => (
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-sm" key={label}>
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-medium text-slate-200">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-sm font-semibold text-emerald-200">
                  Çalışan erişimi
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Operasyon kayıtları ve ekip listesi görünür. Abonelik,
                  entegrasyon anahtarları ve hesap yönetimi patrona özeldir.
                </p>
              </div>
            )}
          </section>
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Çalışan hesapları</h2>
                <p className="mt-1 text-xs text-slate-500">{workspace.members.length} çalışan</p>
              </div>
              {!workspace.permissions.canManageTeam && (
                <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-400">
                  Salt okunur
                </span>
              )}
            </div>
            {workspace.members.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Users}
                  title="Ekip üyesi yok"
                  description="Danışmanları ve yöneticileri şirket çalışma alanına ekleyin."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {workspace.members.map((member) => (
                  <div
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start"
                    key={member.id}
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200">
                        {member.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-white">{member.name}</p>
                          <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">
                            {memberRoleLabels[member.role]}
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] ${
                              member.active
                                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                                : 'border-rose-500/25 bg-rose-500/10 text-rose-300'
                            }`}
                          >
                            {member.active ? 'Aktif' : 'Kapalı'}
                          </span>
                          <span className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300">
                            {memberAvailabilityLabels[member.availability]}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {member.email ||
                            member.phoneNormalized ||
                            member.phone ||
                            'İletişim bilgisi yok'}
                        </p>
                        <p className="mt-1 truncate font-mono text-[11px] text-emerald-300">
                          {member.username ||
                            'Giriş bilgisi henüz oluşturulmadı'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-400">
                            WhatsApp görevi:{' '}
                            {member.canReceiveWhatsAppTasks ? 'Açık' : 'Kapalı'}
                          </span>
                          <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-400">
                            Otomatik iç mesaj:{' '}
                            {member.allowAutomaticInternalMessages
                              ? 'Açık'
                              : 'Kapalı'}
                          </span>
                          <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-400">
                            Kapasite: {member.maxActiveTaskCapacity}
                          </span>
                          <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-400">
                            Telefon: {member.phoneNormalized || member.phone ? 'Tanımlı' : 'Eksik'}
                          </span>
                          {member.specialtyRegions.length > 0 && (
                            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-400">
                              Bölgeler: {member.specialtyRegions.join(', ')}
                            </span>
                          )}
                          {member.specialties.length > 0 && (
                            <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-400">
                              Uzmanlık: {member.specialties.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {workspace.permissions.canManageTeam &&
                      member.role !== 'OWNER' && (
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 self-end sm:self-start">
                          <Button
                            aria-label={`${member.name} profilini düzenle`}
                            disabled={saving}
                            onClick={() => {
                              setSelectedMemberId(member.id);
                              setDialog('member-edit');
                            }}
                            size="icon"
                            title="Çalışan profilini düzenle"
                            variant="outline"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label={`${member.name} giriş kodunu yenile`}
                            disabled={saving}
                            onClick={() =>
                              postAction(
                                {
                                  action: 'reset-member-credentials',
                                  id: member.id,
                                },
                                'Çalışan giriş kodu yenilendi.'
                              )
                            }
                            size="icon"
                            title="Giriş kodunu yenile"
                            variant="outline"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            aria-label={`${member.name} hesabını ${member.active ? 'kapat' : 'aç'}`}
                            disabled={saving}
                            onClick={() =>
                              postAction(
                                {
                                  action: 'set-member-active',
                                  id: member.id,
                                  active: !member.active,
                                },
                                `Çalışan hesabı ${member.active ? 'kapatıldı' : 'açıldı'}.`
                              )
                            }
                            size="icon"
                            title={
                              member.active ? 'Hesabı kapat' : 'Hesabı aç'
                            }
                            variant="outline"
                          >
                            {member.active ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <WorkspaceDialog
        key={`${dialog || 'closed'}-${selectedMember?.id || selectedProperty?.id || 'new'}`}
        dialog={dialog}
        members={workspace.members}
        contacts={workspace.contacts}
        properties={workspace.properties}
        deals={workspace.deals}
        selectedContact={selectedContact}
        selectedProperty={selectedProperty}
        selectedMember={selectedMember}
        saving={saving}
        onClose={() => {
          setDialog(null);
          setSelectedMemberId(null);
          setSelectedPropertyId(null);
        }}
        onSubmit={postAction}
      />
      <Dialog
        open={Boolean(memberCredentials)}
        onOpenChange={(open) => !open && setMemberCredentials(null)}
      >
        <DialogContent className="border border-slate-700 bg-slate-900 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Çalışan giriş bilgileri hazır</DialogTitle>
            <DialogDescription>
              Bu kod yalnızca şimdi gösterilir. Çalışana güvenli bir kanaldan
              iletin.
            </DialogDescription>
          </DialogHeader>
          {memberCredentials && (
            <div className="space-y-3">
              {[
                ['Kullanıcı adı', memberCredentials.username],
                ['Geçici giriş kodu', memberCredentials.temporaryCode],
              ].map(([label, value]) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3"
                  key={label}
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-white">
                      {value}
                    </p>
                  </div>
                  <Button
                    aria-label={`${label} bilgisini kopyala`}
                    onClick={async () => {
                      await navigator.clipboard.writeText(value);
                      toast.success(`${label} kopyalandı.`);
                    }}
                    size="icon"
                    variant="outline"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              onClick={() => setMemberCredentials(null)}
              type="button"
            >
              Bilgileri kaydettim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkspaceDialog({
  dialog,
  members,
  contacts,
  properties,
  deals,
  selectedContact,
  selectedProperty,
  selectedMember,
  saving,
  onClose,
  onSubmit,
}: {
  dialog: DialogKind;
  members: Member[];
  contacts: Contact[];
  properties: Property[];
  deals: Deal[];
  selectedContact: Contact | null;
  selectedProperty: Property | null;
  selectedMember: Member | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
}) {
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<LocationOption[]>([]);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [neighborhoodId, setNeighborhoodId] = useState('');
  const [locationLoading, setLocationLoading] = useState<
    'provinces' | 'districts' | 'neighborhoods' | null
  >(dialog === 'property' ? 'provinces' : null);
  const [propertyImage, setPropertyImage] = useState<File | null>(null);
  const [propertySubmitting, setPropertySubmitting] = useState(false);
  const propertyImagePreview = useMemo(
    () => (propertyImage ? URL.createObjectURL(propertyImage) : null),
    [propertyImage]
  );
  const displayedPropertyImage =
    propertyImagePreview ||
    (dialog === 'property-edit' ? selectedProperty?.imageUrl : null);

  useEffect(() => {
    if (dialog !== 'property') return;

    let cancelled = false;
    fetchLocationOptions('provinces')
      .then((items) => {
        if (!cancelled) setProvinces(items);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error ? error.message : 'İller yüklenemedi.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLocationLoading(null);
      });

    return () => {
      cancelled = true;
    };
  }, [dialog]);

  useEffect(() => {
    return () => {
      if (propertyImagePreview) URL.revokeObjectURL(propertyImagePreview);
    };
  }, [propertyImagePreview]);

  async function selectProvince(event: ChangeEvent<HTMLSelectElement>) {
    const nextId = event.target.value;
    setProvinceId(nextId);
    setDistrictId('');
    setNeighborhoodId('');
    setDistricts([]);
    setNeighborhoods([]);
    if (!nextId) return;

    try {
      setLocationLoading('districts');
      setDistricts(await fetchLocationOptions('districts', nextId));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'İlçeler yüklenemedi.'
      );
    } finally {
      setLocationLoading(null);
    }
  }

  async function selectDistrict(event: ChangeEvent<HTMLSelectElement>) {
    const nextId = event.target.value;
    setDistrictId(nextId);
    setNeighborhoodId('');
    setNeighborhoods([]);
    if (!nextId) return;

    try {
      setLocationLoading('neighborhoods');
      setNeighborhoods(await fetchLocationOptions('neighborhoods', nextId));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Mahalleler yüklenemedi.'
      );
    } finally {
      setLocationLoading(null);
    }
  }

  function selectPropertyImage(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0] || null;
    if (!image) {
      setPropertyImage(null);
      return;
    }
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(
        image.type
      )
    ) {
      toast.error('Yalnızca JPG, PNG, WebP veya AVIF yükleyebilirsiniz.');
      event.target.value = '';
      return;
    }
    if (image.size > 15 * 1024 * 1024) {
      toast.error('Görsel boyutu 15 MB veya daha küçük olmalıdır.');
      event.target.value = '';
      return;
    }
    setPropertyImage(image);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || propertySubmitting) return;
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(data.entries());
    const text = (value: FormDataEntryValue | undefined) =>
      typeof value === 'string' ? value.trim() : '';

    if (dialog === 'contact') {
      await onSubmit(
        {
          action: 'create-contact',
          ...values,
          budgetMin: values.budgetMin || null,
          budgetMax: values.budgetMax || null,
          assignedMemberId: values.assignedMemberId || null,
        },
        'Müşteri CRM’e eklendi.'
      );
    }
    if (dialog === 'contact-edit' && selectedContact) {
      const nextActionAt = values.nextActionAt
        ? new Date(String(values.nextActionAt)).toISOString()
        : null;
      await onSubmit(
        {
          action: 'update-contact',
          id: selectedContact.id,
          ...values,
          budgetMin: values.budgetMin || null,
          budgetMax: values.budgetMax || null,
          assignedMemberId: values.assignedMemberId || null,
          nextActionAt,
          tags: String(values.tags || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
        'Müşteri profili güncellendi.'
      );
    }
    if (
      dialog === 'property' ||
      (dialog === 'property-edit' && selectedProperty)
    ) {
      const province =
        dialog === 'property'
          ? provinces.find((item) => String(item.id) === provinceId)?.name
          : null;
      const district =
        dialog === 'property'
          ? districts.find((item) => String(item.id) === districtId)?.name
          : null;
      const neighborhood =
        dialog === 'property'
          ? neighborhoods.find((item) => String(item.id) === neighborhoodId)
              ?.name
          : null;

      if (
        dialog === 'property' &&
        (!province || !district || !neighborhood)
      ) {
        toast.error('İl, ilçe ve mahalle seçimini tamamlayın.');
        return;
      }

      try {
        setPropertySubmitting(true);
        let imageUrl =
          dialog === 'property-edit' ? selectedProperty?.imageUrl || '' : '';
        if (propertyImage) {
          const imageData = new FormData();
          imageData.append('image', propertyImage);
          const uploadResponse = await fetch(
            '/api/fabrika/portfolio-image',
            {
              method: 'POST',
              body: imageData,
            }
          );
          const uploadBody = (await uploadResponse.json()) as {
            success?: boolean;
            url?: string;
            error?: string;
          };
          if (!uploadResponse.ok || !uploadBody.success || !uploadBody.url) {
            throw new Error(uploadBody.error || 'Görsel yüklenemedi.');
          }
          imageUrl = uploadBody.url;
        }

        await onSubmit(
          {
            action:
              dialog === 'property-edit'
                ? 'update-property'
                : 'create-property',
            ...(dialog === 'property-edit'
              ? { id: selectedProperty!.id }
              : {}),
            ...values,
            location:
              dialog === 'property'
                ? [province, district, neighborhood].join(' / ')
                : values.location,
            imageUrl,
            price: values.price || null,
            area: values.area || null,
            ownerContactId: values.ownerContactId || null,
            assignedMemberId: values.assignedMemberId || null,
          },
          dialog === 'property-edit'
            ? 'Portföy güncellendi; bağlı web sitesi yeni veriyi API üzerinden alacak.'
            : 'Portföy eklendi ve bağlı web sitesi için API verisi güncellendi.'
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Portföy kaydedilemedi.'
        );
      } finally {
        setPropertySubmitting(false);
      }
    }
    if (dialog === 'deal') {
      await onSubmit(
        {
          action: 'create-deal',
          ...values,
          propertyId: values.propertyId || null,
          assignedMemberId: values.assignedMemberId || null,
          estimatedValue: values.estimatedValue || null,
          commissionRate: values.commissionRate || null,
        },
        'Satış fırsatı açıldı.'
      );
    }
    if (dialog === 'task') {
      const dueAt = values.dueAt
        ? new Date(String(values.dueAt)).toISOString()
        : null;
      await onSubmit(
        {
          action: 'create-task',
          ...values,
          dueAt,
          contactId: values.contactId || null,
          propertyId: values.propertyId || null,
          dealId: values.dealId || null,
          assignedMemberId: values.assignedMemberId || null,
        },
        'Görev oluşturuldu.'
      );
    }
    if (dialog === 'member' || (dialog === 'member-edit' && selectedMember)) {
      const operational = buildMemberOperationalPayload(values);
      await onSubmit(
        dialog === 'member'
          ? {
              action: 'create-member',
              name: text(values.name),
              email: text(values.email),
              phone: text(values.phone),
              username: text(values.username),
              ...operational,
            }
          : {
              action: 'update-member-profile',
              id: selectedMember!.id,
              name: text(values.name),
              email: text(values.email),
              phone: text(values.phone),
              ...operational,
            },
        dialog === 'member'
          ? 'Ekip üyesi eklendi.'
          : 'Çalışan profili güncellendi.'
      );
    }
  }

  const dialogTitle = {
    contact: 'Yeni müşteri',
    'contact-edit': 'Müşteri profilini düzenle',
    property: 'Yeni portföy',
    'property-edit': 'Portföyü düzenle',
    deal: 'Yeni satış fırsatı',
    task: 'Yeni görev veya randevu',
    member: 'Yeni ekip üyesi',
    'member-edit': 'Çalışan profilini düzenle',
  }[dialog || 'contact'];

  return (
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={`max-h-[90vh] overflow-y-auto border border-slate-700 bg-slate-900 text-slate-100 ${
          dialog === 'property' ||
          dialog === 'property-edit' ||
          dialog === 'member' ||
          dialog === 'member-edit'
            ? 'sm:max-w-3xl'
            : 'sm:max-w-2xl'
        }`}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialog === 'property' || dialog === 'property-edit'
              ? 'Kaydedilen değişiklikler bağlı müşteri web sitesinde API üzerinden otomatik görünür.'
              : dialog === 'member' || dialog === 'member-edit'
                ? 'Rol, çalışma düzeni ve WhatsApp görev izinleri yalnızca patron tarafından yönetilir.'
                : 'Bilgileri daha sonra müşteri veya portföy profilinden geliştirebilirsiniz.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 sm:grid-cols-2"
          id="workspace-form"
          key={`${dialog}-${selectedContact?.id || selectedProperty?.id || selectedMember?.id || 'new'}`}
          onSubmit={submit}
        >
          {dialog === 'contact' && (
            <>
              <label className={labelClass}>
                Ad soyad
                <Input className={fieldClass} name="name" required />
              </label>
              <label className={labelClass}>
                Telefon
                <Input className={fieldClass} name="phone" />
              </label>
              <label className={labelClass}>
                E-posta
                <Input className={fieldClass} name="email" type="email" />
              </label>
              <label className={labelClass}>
                Müşteri türü
                <SelectField defaultValue="BUYER" name="type">
                  <option value="BUYER">Alıcı</option>
                  <option value="SELLER">Satıcı</option>
                  <option value="INVESTOR">Yatırımcı</option>
                  <option value="TENANT">Kiracı</option>
                  <option value="OTHER">Diğer</option>
                </SelectField>
              </label>
              <label className={labelClass}>
                İstenen bölge
                <Input className={fieldClass} name="desiredLocation" />
              </label>
              <label className={labelClass}>
                Oda tercihi
                <Input className={fieldClass} name="desiredRoomCount" placeholder="2+1" />
              </label>
              <label className={labelClass}>
                Minimum bütçe
                <Input className={fieldClass} min="0" name="budgetMin" type="number" />
              </label>
              <label className={labelClass}>
                Maksimum bütçe
                <Input className={fieldClass} min="0" name="budgetMax" type="number" />
              </label>
              <label className={labelClass}>
                İletişim izni
                <SelectField defaultValue="UNKNOWN" name="consentStatus">
                  <option value="UNKNOWN">Bilinmiyor</option>
                  <option value="GRANTED">Onaylı</option>
                  <option value="REVOKED">Geri çekildi</option>
                </SelectField>
              </label>
              <label className={labelClass}>
                Sorumlu danışman
                <SelectField defaultValue="" name="assignedMemberId">
                  <option value="">Atanmadı</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </SelectField>
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Notlar
                <textarea className={`${fieldClass} min-h-24 py-3`} name="notes" />
              </label>
            </>
          )}

          {dialog === 'contact-edit' && selectedContact && (
            <>
              <label className={labelClass}>
                Ad soyad
                <Input
                  className={fieldClass}
                  defaultValue={selectedContact.name}
                  name="name"
                  required
                />
              </label>
              <label className={labelClass}>
                Telefon
                <Input
                  className={fieldClass}
                  defaultValue={selectedContact.phone || ''}
                  name="phone"
                />
              </label>
              <label className={labelClass}>
                E-posta
                <Input
                  className={fieldClass}
                  defaultValue={selectedContact.email || ''}
                  name="email"
                  type="email"
                />
              </label>
              <label className={labelClass}>
                Müşteri türü
                <SelectField
                  defaultValue={selectedContact.type}
                  name="type"
                >
                  <option value="BUYER">Alıcı</option>
                  <option value="SELLER">Satıcı</option>
                  <option value="INVESTOR">Yatırımcı</option>
                  <option value="TENANT">Kiracı</option>
                  <option value="OTHER">Diğer</option>
                </SelectField>
              </label>
              <label className={labelClass}>
                Satış aşaması
                <SelectField
                  defaultValue={selectedContact.stage}
                  name="stage"
                >
                  {Object.entries(contactStageLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Kaynak
                <Input
                  className={fieldClass}
                  defaultValue={selectedContact.source || ''}
                  name="source"
                  placeholder="Asistan, web sitesi, referans..."
                />
              </label>
              <label className={labelClass}>
                İstenen bölge
                <Input
                  className={fieldClass}
                  defaultValue={selectedContact.desiredLocation || ''}
                  name="desiredLocation"
                />
              </label>
              <label className={labelClass}>
                Oda tercihi
                <Input
                  className={fieldClass}
                  defaultValue={selectedContact.desiredRoomCount || ''}
                  name="desiredRoomCount"
                  placeholder="2+1"
                />
              </label>
              <label className={labelClass}>
                Minimum bütçe
                <Input
                  className={fieldClass}
                  defaultValue={selectedContact.budgetMin ?? ''}
                  min="0"
                  name="budgetMin"
                  type="number"
                />
              </label>
              <label className={labelClass}>
                Maksimum bütçe
                <Input
                  className={fieldClass}
                  defaultValue={selectedContact.budgetMax ?? ''}
                  min="0"
                  name="budgetMax"
                  type="number"
                />
              </label>
              <label className={labelClass}>
                İletişim izni
                <SelectField
                  defaultValue={selectedContact.consentStatus}
                  name="consentStatus"
                >
                  <option value="UNKNOWN">Bilinmiyor</option>
                  <option value="GRANTED">Onaylı</option>
                  <option value="REVOKED">Geri çekildi</option>
                </SelectField>
              </label>
              <label className={labelClass}>
                Sorumlu danışman
                <SelectField
                  defaultValue={selectedContact.assignedMember?.id || ''}
                  name="assignedMemberId"
                >
                  <option value="">Atanmadı</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Sonraki takip zamanı
                <Input
                  className={fieldClass}
                  defaultValue={dateTimeLocal(selectedContact.nextActionAt)}
                  name="nextActionAt"
                  type="datetime-local"
                />
              </label>
              <label className={labelClass}>
                Etiketler
                <Input
                  className={fieldClass}
                  defaultValue={selectedContact.tags.join(', ')}
                  name="tags"
                  placeholder="yatırımcı, deniz manzarası"
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Profil notları
                <textarea
                  className={`${fieldClass} min-h-28 py-3`}
                  defaultValue={selectedContact.notes || ''}
                  name="notes"
                />
              </label>
            </>
          )}

          {(dialog === 'property' ||
            (dialog === 'property-edit' && selectedProperty)) && (
            <>
              <label className={`${labelClass} sm:col-span-2`}>
                Portföy başlığı
                <Input
                  className={fieldClass}
                  defaultValue={selectedProperty?.title || ''}
                  name="title"
                  required
                />
              </label>
              <label className={labelClass}>
                Referans kodu
                <Input
                  className={fieldClass}
                  defaultValue={selectedProperty?.referenceCode || ''}
                  name="referenceCode"
                />
              </label>
              {dialog === 'property' ? (
                <fieldset className="grid gap-3 rounded-xl border border-slate-700/80 bg-slate-950/45 p-4 sm:col-span-2 sm:grid-cols-3">
                <legend className="px-1 text-xs font-semibold text-slate-200">
                  Portföy konumu
                </legend>
                <label className={labelClass}>
                  İl
                  <SelectField
                    disabled={locationLoading === 'provinces'}
                    name="provinceId"
                    onChange={selectProvince}
                    required
                    value={provinceId}
                  >
                    <option value="">
                      {locationLoading === 'provinces'
                        ? 'İller yükleniyor…'
                        : 'İl seçin'}
                    </option>
                    {provinces.map((province) => (
                      <option key={province.id} value={province.id}>
                        {province.name}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <label className={labelClass}>
                  İlçe
                  <SelectField
                    disabled={
                      !provinceId || locationLoading === 'districts'
                    }
                    name="districtId"
                    onChange={selectDistrict}
                    required
                    value={districtId}
                  >
                    <option value="">
                      {locationLoading === 'districts'
                        ? 'İlçeler yükleniyor…'
                        : 'İlçe seçin'}
                    </option>
                    {districts.map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <label className={labelClass}>
                  Mahalle
                  <SelectField
                    disabled={
                      !districtId || locationLoading === 'neighborhoods'
                    }
                    name="neighborhoodId"
                    onChange={(event) =>
                      setNeighborhoodId(event.target.value)
                    }
                    required
                    value={neighborhoodId}
                  >
                    <option value="">
                      {locationLoading === 'neighborhoods'
                        ? 'Mahalleler yükleniyor…'
                        : 'Mahalle seçin'}
                    </option>
                    {neighborhoods.map((neighborhood) => (
                      <option key={neighborhood.id} value={neighborhood.id}>
                        {neighborhood.name}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <p className="text-[11px] leading-5 text-slate-500 sm:col-span-3">
                  Bu seçim Asistan’ın “Mahmutlar’da 2+1” gibi müşteri
                  taleplerini doğru portföyle eşleştirmesini sağlar.
                </p>
                </fieldset>
              ) : (
                <label className={`${labelClass} sm:col-span-2`}>
                  Konum
                  <Input
                    className={fieldClass}
                    defaultValue={selectedProperty?.location || ''}
                    name="location"
                    placeholder="İl / İlçe / Mahalle"
                    required
                  />
                </label>
              )}
              <label className={labelClass}>
                Fiyat
                <Input
                  className={fieldClass}
                  defaultValue={selectedProperty?.price ?? ''}
                  min="0"
                  name="price"
                  type="number"
                />
              </label>
              <label className={labelClass}>
                Oda sayısı
                <SelectField
                  defaultValue={selectedProperty?.roomCount || ''}
                  name="roomCount"
                  required
                >
                  <option value="">Oda sayısını seçin</option>
                  {roomCountOptions.map((roomCount) => (
                    <option key={roomCount} value={roomCount}>
                      {roomCount}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Alan (m²)
                <Input
                  className={fieldClass}
                  defaultValue={selectedProperty?.area ?? ''}
                  min="0"
                  name="area"
                  type="number"
                />
              </label>
              <label className={labelClass}>
                Durum
                <SelectField
                  defaultValue={selectedProperty?.status || 'ACTIVE'}
                  name="status"
                >
                  <option value="DRAFT">Taslak</option>
                  <option value="ACTIVE">Aktif</option>
                  <option value="RESERVED">Rezerve</option>
                  <option value="SOLD">Satıldı</option>
                  <option value="RENTED">Kiralandı</option>
                  <option value="ARCHIVED">Arşiv</option>
                </SelectField>
              </label>
              <label className={labelClass}>
                Mülk sahibi
                <SelectField
                  defaultValue={selectedProperty?.ownerContact?.id || ''}
                  name="ownerContactId"
                >
                  <option value="">Atanmadı</option>
                  {contacts.filter((contact) => contact.type === 'SELLER').map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Sorumlu danışman
                <SelectField
                  defaultValue={selectedProperty?.assignedMember?.id || ''}
                  name="assignedMemberId"
                >
                  <option value="">Atanmadı</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </SelectField>
              </label>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-300">
                    Portföy görseli
                  </span>
                  <span className="text-[11px] text-slate-500">
                    JPG, PNG, WebP veya AVIF · en fazla 15 MB
                  </span>
                </div>
                <div className="group flex min-h-32 items-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-950/60 p-2 transition hover:border-emerald-500/70 hover:bg-emerald-500/[0.04] focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                  <label
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-lg p-2"
                    htmlFor="property-image"
                  >
                    <input
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      className="sr-only"
                      id="property-image"
                      key={propertyImage?.name || 'empty'}
                      onChange={selectPropertyImage}
                      type="file"
                    />
                    {displayedPropertyImage ? (
                      <div
                        aria-label="Seçilen portföy görselinin önizlemesi"
                        className="h-24 w-32 shrink-0 rounded-lg bg-cover bg-center shadow-inner"
                        role="img"
                        style={{
                          backgroundImage: `url("${displayedPropertyImage}")`,
                        }}
                      />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-emerald-300">
                        <UploadCloud aria-hidden="true" className="h-6 w-6" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-100">
                        {propertyImage
                          ? propertyImage.name
                          : selectedProperty?.imageUrl
                            ? 'Mevcut görsel · değiştirmek için seçin'
                            : 'Bilgisayardan görsel seçin'}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">
                        {propertyImage
                          ? `${(propertyImage.size / 1024 / 1024).toFixed(2)} MB · Kalite değiştirilmeden yüklenecek`
                          : 'Dosyaya tıklayın veya klavyeyle seçin. Görsel kalıcı bir bağlantıya dönüştürülür.'}
                      </span>
                    </span>
                    {!propertyImage && (
                      <ImagePlus
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-slate-500 transition group-hover:text-emerald-300"
                      />
                    )}
                  </label>
                  {propertyImage ? (
                    <Button
                      aria-label="Seçilen görseli kaldır"
                      className="shrink-0"
                      onClick={() => setPropertyImage(null)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <X aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <p
                  aria-live="polite"
                  className="text-[11px] leading-5 text-slate-500"
                >
                  Görsel yalnızca sizin şirketinizin portföy kaydına bağlanır;
                  uygulama sunucusunun geçici diskinde tutulmaz.
                </p>
              </div>
              <label className={`${labelClass} sm:col-span-2`}>
                Açıklama
                <textarea
                  className={`${fieldClass} min-h-24 py-3`}
                  defaultValue={selectedProperty?.description || ''}
                  name="description"
                />
              </label>
            </>
          )}

          {dialog === 'deal' && (
            <>
              <label className={`${labelClass} sm:col-span-2`}>
                Fırsat başlığı
                <Input className={fieldClass} name="title" required />
              </label>
              <label className={labelClass}>
                Müşteri
                <SelectField name="contactId" required>
                  <option value="">Seçin</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Portföy
                <SelectField defaultValue="" name="propertyId">
                  <option value="">Portföy seçilmedi</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.title}</option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Tahmini satış değeri
                <Input className={fieldClass} min="0" name="estimatedValue" type="number" />
              </label>
              <label className={labelClass}>
                Komisyon oranı (%)
                <Input className={fieldClass} defaultValue="2" min="0" max="100" name="commissionRate" step="0.1" type="number" />
              </label>
              <label className={labelClass}>
                Sorumlu danışman
                <SelectField defaultValue="" name="assignedMemberId">
                  <option value="">Atanmadı</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Sonraki işlem
                <Input className={fieldClass} name="nextAction" />
              </label>
            </>
          )}

          {dialog === 'task' && (
            <>
              <label className={`${labelClass} sm:col-span-2`}>
                Görev başlığı
                <Input className={fieldClass} name="title" required />
              </label>
              <label className={labelClass}>
                Tür
                <SelectField defaultValue="FOLLOW_UP" name="type">
                  <option value="CALL">Arama</option>
                  <option value="MESSAGE">Mesaj</option>
                  <option value="MEETING">Toplantı</option>
                  <option value="VIEWING">Portföy gösterimi</option>
                  <option value="FOLLOW_UP">Takip</option>
                  <option value="DOCUMENT">Belge</option>
                  <option value="OTHER">Diğer</option>
                </SelectField>
              </label>
              <label className={labelClass}>
                Tarih ve saat
                <Input className={fieldClass} name="dueAt" type="datetime-local" />
              </label>
              <label className={labelClass}>
                Müşteri
                <SelectField defaultValue="" name="contactId">
                  <option value="">Bağlı müşteri yok</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Portföy
                <SelectField defaultValue="" name="propertyId">
                  <option value="">Bağlı portföy yok</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>{property.title}</option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Satış fırsatı
                <SelectField defaultValue="" name="dealId">
                  <option value="">Bağlı fırsat yok</option>
                  {deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>{deal.title}</option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Sorumlu danışman
                <SelectField defaultValue="" name="assignedMemberId">
                  <option value="">Atanmadı</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </SelectField>
              </label>
              <label className={labelClass}>
                Öncelik
                <SelectField defaultValue="2" name="priority">
                  <option value="1">Düşük</option>
                  <option value="2">Normal</option>
                  <option value="3">Yüksek</option>
                </SelectField>
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Açıklama
                <textarea className={`${fieldClass} min-h-24 py-3`} name="description" />
              </label>
            </>
          )}

          {(dialog === 'member' || dialog === 'member-edit') && (
            <MemberProfileFields
              creating={dialog === 'member'}
              member={selectedMember}
            />
          )}

        </form>
        <DialogFooter className="border-slate-800 bg-slate-950/50">
          <Button onClick={onClose} type="button" variant="ghost">
            Vazgeç
          </Button>
          <Button
            className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
            disabled={saving || propertySubmitting}
            form="workspace-form"
            type="submit"
          >
            {(saving || propertySubmitting) && (
              <Loader2 aria-hidden="true" className="animate-spin" />
            )}
            {propertySubmitting
              ? propertyImage
                ? 'Görsel yükleniyor…'
                : 'Portföy kaydediliyor…'
              : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberProfileFields({
  creating,
  member,
}: {
  creating: boolean;
  member: Member | null;
}) {
  const scheduleDays = member?.workHours?.days || [];
  const scheduleDay = (day: MemberWorkDay) =>
    scheduleDays.find((item) => item.day === day);

  return (
    <>
      <label className={labelClass}>
        Ad soyad
        <Input
          className={fieldClass}
          defaultValue={member?.name || ''}
          name="name"
          required
        />
      </label>
      <label className={labelClass}>
        Rol
        <SelectField
          defaultValue={
            member?.role && member.role !== 'OWNER' ? member.role : 'AGENT'
          }
          name="role"
        >
          <option value="MANAGER">Yönetici</option>
          <option value="AGENT">Danışman</option>
          <option value="VIEWER">Gözlemci</option>
        </SelectField>
      </label>
      <label className={labelClass}>
        E-posta
        <Input
          className={fieldClass}
          defaultValue={member?.email || ''}
          name="email"
          type="email"
        />
      </label>
      <label className={labelClass}>
        Telefon
        <Input
          autoComplete="tel"
          className={fieldClass}
          defaultValue={member?.phoneNormalized || member?.phone || ''}
          name="phone"
          placeholder="+905551112233"
          type="tel"
        />
        <span className="block text-[11px] font-normal leading-5 text-slate-500">
          WhatsApp görevleri için ülke koduyla birlikte yazın.
        </span>
      </label>
      {creating && (
        <label className={`${labelClass} sm:col-span-2`}>
          Kullanıcı adı için kısa ad (isteğe bağlı)
          <Input
            autoCapitalize="none"
            className={fieldClass}
            name="username"
            placeholder="ayse-yilmaz"
            spellCheck={false}
          />
          <span className="block text-[11px] font-normal leading-5 text-slate-500">
            Tam kullanıcı adı şirket koduyla birlikte otomatik oluşturulur.
          </span>
        </label>
      )}
      <p className={`${labelClass} rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-5 text-slate-400`}>
        Telefon numarası kaydedildiğinde WhatsApp görevleri için kullanılabilir. Tek kullanımlık kod istenmez.
      </p>
      <label className={labelClass}>
        Çalışma durumu
        <SelectField
          defaultValue={member?.availability || 'AVAILABLE'}
          name="availability"
        >
          <option value="AVAILABLE">Müsait</option>
          <option value="BUSY">Meşgul</option>
          <option value="ON_LEAVE">İzinli</option>
          <option value="OFFLINE">Çevrimdışı</option>
        </SelectField>
      </label>
      <label className={labelClass}>
        Tercih edilen dil
        <Input
          className={fieldClass}
          defaultValue={member?.preferredLanguage || 'tr'}
          maxLength={16}
          name="preferredLanguage"
          pattern="[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*"
          placeholder="tr veya tr-TR"
          required
        />
      </label>
      <label className={labelClass}>
        Azami aktif görev
        <Input
          className={fieldClass}
          defaultValue={member?.maxActiveTaskCapacity || 10}
          max={100}
          min={1}
          name="maxActiveTaskCapacity"
          required
          type="number"
        />
      </label>
      <label className={labelClass}>
        Uzmanlık bölgeleri
        <Input
          className={fieldClass}
          defaultValue={member?.specialtyRegions.join(', ') || ''}
          name="specialtyRegions"
          placeholder="Alanya, Kestel, Mahmutlar"
        />
      </label>
      <label className={labelClass}>
        Uzmanlık alanları
        <Input
          className={fieldClass}
          defaultValue={member?.specialties.join(', ') || ''}
          name="specialties"
          placeholder="Villa, kiralık, ticari"
        />
      </label>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
        <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3">
          <input
            className="mt-0.5 h-4 w-4 accent-emerald-500"
            defaultChecked={member?.canReceiveWhatsAppTasks ?? true}
            name="canReceiveWhatsAppTasks"
            type="checkbox"
          />
          <span>
            <span className="block text-xs font-semibold text-slate-200">
              WhatsApp görevi alabilir
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-slate-500">
              Görev ataması için doğrulanabilir bir çalışan telefonu gerekir.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3">
          <input
            className="mt-0.5 h-4 w-4 accent-emerald-500"
            defaultChecked={
              member?.allowAutomaticInternalMessages ?? false
            }
            name="allowAutomaticInternalMessages"
            type="checkbox"
          />
          <span>
            <span className="block text-xs font-semibold text-slate-200">
              Otomatik iç mesaj alabilir
            </span>
            <span className="mt-1 block text-[11px] leading-5 text-slate-500">
              Yalnızca WhatsApp görevi açık çalışanlarda etkinleşir.
            </span>
          </span>
        </label>
      </div>
      <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950/70 p-4 sm:col-span-2">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <label className="flex cursor-pointer items-center gap-3 text-xs font-semibold text-slate-200">
            <input
              className="h-4 w-4 accent-emerald-500"
              defaultChecked={Boolean(member?.workHours)}
              name="workHoursEnabled"
              type="checkbox"
            />
            Çalışma saatlerini görev atamalarında kullan
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-400">
            Saat dilimi
            <Input
              className="h-8 w-44 border-slate-700 bg-slate-900 text-xs"
              defaultValue={
                member?.workHours?.timezone || 'Europe/Istanbul'
              }
              name="workHoursTimezone"
            />
          </label>
        </div>
        <div className="space-y-2">
          {MEMBER_WORK_DAYS.map(({ value, label }, index) => {
            const configuredDay = scheduleDay(value);
            const defaultEnabled = member?.workHours
              ? Boolean(configuredDay?.enabled)
              : index < 5;
            return (
              <div
                className="grid grid-cols-[minmax(0,1fr)_7.5rem_7.5rem] items-center gap-2"
                key={value}
              >
                <label className="flex min-w-0 cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <input
                    className="h-4 w-4 accent-emerald-500"
                    defaultChecked={defaultEnabled}
                    name={`workDay_${value}`}
                    type="checkbox"
                  />
                  <span className="truncate">{label}</span>
                </label>
                <Input
                  aria-label={`${label} başlangıç saati`}
                  className="h-8 border-slate-700 bg-slate-900 px-2 text-xs"
                  defaultValue={configuredDay?.start || '09:00'}
                  name={`workHoursStart_${value}`}
                  type="time"
                />
                <Input
                  aria-label={`${label} bitiş saati`}
                  className="h-8 border-slate-700 bg-slate-900 px-2 text-xs"
                  defaultValue={configuredDay?.end || '18:00'}
                  name={`workHoursEnd_${value}`}
                  type="time"
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
