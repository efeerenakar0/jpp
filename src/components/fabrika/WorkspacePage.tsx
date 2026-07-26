'use client';

import Link from 'next/link';
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ContactRound,
  ExternalLink,
  Home,
  Kanban,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import EmptyState from '@/components/fabrika/EmptyState';
import PageHeader from '@/components/fabrika/PageHeader';
import StatCard from '@/components/fabrika/StatCard';
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

export type WorkspaceMode =
  | 'crm'
  | 'portfoyler'
  | 'satis'
  | 'eslestirme'
  | 'takvim'
  | 'satici-portali'
  | 'sirket';

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: 'OWNER' | 'MANAGER' | 'AGENT' | 'VIEWER';
  active: boolean;
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

type Match = {
  id: string;
  score: number;
  reasons: string[];
  status: string;
  contact: Pick<Contact, 'id' | 'name' | 'phone' | 'desiredLocation' | 'desiredRoomCount'>;
  property: Pick<Property, 'id' | 'title' | 'location' | 'price' | 'roomCount' | 'imageUrl'>;
};

type ActivityItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  createdAt: string;
};

type Workspace = {
  account: {
    id: string;
    companyName: string;
    ownerName: string;
    ownerEmail: string | null;
    slug: string;
    subscriptionPlan: string;
    subscriptionStatus: string;
    subscriptionEndsAt: string | null;
    workspaceEnabled: boolean;
    createdAt: string;
  };
  members: Member[];
  contacts: Contact[];
  properties: Property[];
  deals: Deal[];
  tasks: Task[];
  matches: Match[];
  activities: ActivityItem[];
  metrics: {
    contacts: number;
    activeProperties: number;
    openDeals: number;
    overdueTasks: number;
    pipelineValue: number;
    wonCommission: number;
    averageMatchScore: number;
  };
};

type DialogKind = 'contact' | 'property' | 'deal' | 'task' | 'member' | null;

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
  eslestirme: {
    title: 'Akıllı Eşleştirme',
    description: 'Müşteri tercihlerini aktif portföylerle karşılaştırın ve en güçlü fırsatları öne çıkarın.',
    eyebrow: 'AI satış desteği',
    icon: Sparkles,
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

function SelectField({
  name,
  children,
  defaultValue,
  required,
}: {
  name: string;
  children: React.ReactNode;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <select
      className={fieldClass}
      defaultValue={defaultValue}
      name={name}
      required={required}
    >
      {children}
    </select>
  );
}

export default function WorkspacePage({ mode }: { mode: WorkspaceMode }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [query, setQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [renderedAt] = useState(Date.now);
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Veriler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(loadWorkspace, 0);
    return () => window.clearTimeout(initialLoad);
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
      setDialog(null);
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
    return workspace.contacts.filter((contact) =>
      [contact.name, contact.phone, contact.email, contact.desiredLocation]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('tr-TR').includes(normalized))
    );
  }, [query, workspace]);

  const selectedContact =
    workspace?.contacts.find((contact) => contact.id === selectedContactId) ||
    filteredContacts[0] ||
    null;

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

  const headerAction =
    mode === 'crm'
      ? () => setDialog('contact')
      : mode === 'portfoyler'
        ? () => setDialog('property')
        : mode === 'satis'
          ? () => setDialog('deal')
          : mode === 'takvim'
            ? () => setDialog('task')
            : mode === 'sirket'
              ? () => setDialog('member')
              : null;

  const actionLabels: Partial<Record<WorkspaceMode, string>> = {
    crm: 'Müşteri ekle',
    portfoyler: 'Portföy ekle',
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
            {mode === 'eslestirme' && (
              <>
                <Button
                  className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  disabled={saving}
                  onClick={() =>
                    postAction(
                      { action: 'sync-modules' },
                      'Asistan ve Avcı verileri CRM ile eşitlendi.'
                    )
                  }
                  variant="outline"
                >
                  <RefreshCw className={saving ? 'animate-spin' : ''} />
                  Modülleri eşitle
                </Button>
                <Button
                  className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                  disabled={saving}
                  onClick={() =>
                    postAction(
                      { action: 'recompute-matches' },
                      'Müşteri-portföy eşleşmeleri yenilendi.'
                    )
                  }
                >
                  <Sparkles />
                  Eşleşmeleri hesapla
                </Button>
              </>
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

      {mode === 'crm' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(20rem,.75fr)]">
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Müşteri kayıtları</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {filteredContacts.length} profil gösteriliyor
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
            {filteredContacts.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Users}
                  title="Henüz müşteri yok"
                  description="İlk müşteriyi ekleyin veya Akıllı Eşleştirme sayfasından Asistan konuşmalarını CRM’e aktarın."
                />
              </div>
            ) : (
              <div className="custom-scrollbar overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">Müşteri</th>
                      <th className="px-4 py-3 font-medium">Tür</th>
                      <th className="px-4 py-3 font-medium">Tercih</th>
                      <th className="px-4 py-3 font-medium">Aşama</th>
                      <th className="px-4 py-3 font-medium">Puan</th>
                      <th className="px-4 py-3 font-medium">İzin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredContacts.map((contact) => (
                      <tr
                        className={`cursor-pointer transition hover:bg-slate-800/60 ${
                          selectedContact?.id === contact.id ? 'bg-emerald-500/5' : ''
                        }`}
                        key={contact.id}
                        onClick={() => setSelectedContactId(contact.id)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-100">{contact.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {contact.phone || contact.email || 'İletişim bilgisi yok'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{contact.type}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {[contact.desiredLocation, contact.desiredRoomCount]
                            .filter(Boolean)
                            .join(' · ') || 'Belirtilmedi'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300">
                            {contact.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-300">
                          {contact.score}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              contact.consentStatus === 'GRANTED'
                                ? 'text-emerald-400'
                                : contact.consentStatus === 'REVOKED'
                                  ? 'text-rose-400'
                                  : 'text-amber-300'
                            }
                          >
                            {contact.consentStatus === 'GRANTED'
                              ? 'Onaylı'
                              : contact.consentStatus === 'REVOKED'
                                ? 'Geri çekildi'
                                : 'Bilinmiyor'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            {selectedContact ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
                      Müşteri profili
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-white">
                      {selectedContact.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {selectedContact.phone || selectedContact.email || 'İletişim bilgisi yok'}
                    </p>
                  </div>
                  <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300">
                    {selectedContact.score}/100
                  </span>
                </div>
                <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  {[
                    ['Müşteri türü', selectedContact.type],
                    ['Satış aşaması', selectedContact.stage],
                    ['İstenen bölge', selectedContact.desiredLocation || '—'],
                    ['Oda tercihi', selectedContact.desiredRoomCount || '—'],
                    [
                      'Bütçe',
                      selectedContact.budgetMin || selectedContact.budgetMax
                        ? `${money(selectedContact.budgetMin)} – ${money(selectedContact.budgetMax)}`
                        : '—',
                    ],
                    ['Danışman', selectedContact.assignedMember?.name || 'Atanmadı'],
                  ].map(([label, value]) => (
                    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3" key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 font-medium text-slate-200">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                  <p className="text-xs font-medium text-slate-500">Notlar ve AI özeti</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                    {selectedContact.notes || 'Bu müşteri için henüz not bulunmuyor.'}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={ContactRound}
                title="Profil seçin"
                description="Detaylarını görmek için müşteri listesinden bir kayıt seçin."
              />
            )}
          </aside>
        </div>
      )}

      {mode === 'portfoyler' && (
        workspace.properties.length === 0 ? (
          <EmptyState
            icon={Home}
            title="Henüz portföy yok"
            description="Manuel portföy ekleyin veya Avcı kayıtlarını Akıllı Eşleştirme ekranından içe aktarın."
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
                    <Link
                      className="flex items-center gap-1 text-emerald-300 hover:text-emerald-200"
                      href={`/portfoy-takip/${property.sellerPortalToken}`}
                      target="_blank"
                    >
                      Portal <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {mode === 'satis' && (
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

      {mode === 'eslestirme' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-emerald-400" />
              <div>
                <h2 className="text-sm font-semibold text-white">Eşleştirme motoru</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Bölge, oda sayısı ve bütçeyi karşılaştırır. Son karar ve müşteri iletişimi danışmanın onayındadır.
                </p>
              </div>
            </div>
          </div>
          {workspace.matches.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Henüz eşleşme hesaplanmadı"
              description="Önce Asistan ve Avcı verilerini eşitleyin; ardından eşleşmeleri hesaplayın."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {workspace.matches.map((match) => (
                <article className="rounded-xl border border-slate-800 bg-slate-900 p-4" key={match.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-emerald-400">Müşteri</p>
                      <h2 className="mt-1 font-semibold text-white">{match.contact.name}</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {match.contact.desiredLocation || 'Bölge yok'} ·{' '}
                        {match.contact.desiredRoomCount || 'Oda tercihi yok'}
                      </p>
                    </div>
                    <span className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xl font-semibold text-emerald-300">
                      %{match.score}
                    </span>
                  </div>
                  <div className="my-4 flex items-center gap-2 text-slate-600">
                    <div className="h-px flex-1 bg-slate-800" />
                    <Link2 className="h-4 w-4" />
                    <div className="h-px flex-1 bg-slate-800" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-sky-400">Portföy</p>
                    <h3 className="mt-1 font-semibold text-white">{match.property.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {match.property.location || 'Konum yok'} · {match.property.roomCount || 'Oda yok'} ·{' '}
                      {money(match.property.price)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {match.reasons.map((reason) => (
                      <span
                        className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300"
                        key={reason}
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
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

      {mode === 'satici-portali' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 h-5 w-5 text-sky-400" />
              <div>
                <h2 className="text-sm font-semibold text-white">Paylaşılabilir müşteri raporu</h2>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Her bağlantı yalnızca ilgili portföyün performansını gösterir; şirket paneline erişim vermez.
                </p>
              </div>
            </div>
          </div>
          {workspace.properties.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="Portal oluşturulacak portföy yok"
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
                      <th className="px-4 py-3">Portal</th>
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
                                  toast.success('Portal bağlantısı kopyalandı.');
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
          </section>
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 p-4">
              <h2 className="text-sm font-semibold text-white">Ekip üyeleri</h2>
              <p className="mt-1 text-xs text-slate-500">{workspace.members.length} kullanıcı</p>
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
                  <div className="flex items-center gap-3 p-4" key={member.id}>
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200">
                      {member.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{member.name}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {member.email || member.phone || 'İletişim bilgisi yok'}
                      </p>
                    </div>
                    <span className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <WorkspaceDialog
        dialog={dialog}
        members={workspace.members}
        contacts={workspace.contacts}
        properties={workspace.properties}
        deals={workspace.deals}
        saving={saving}
        onClose={() => setDialog(null)}
        onSubmit={postAction}
      />
    </div>
  );
}

function WorkspaceDialog({
  dialog,
  members,
  contacts,
  properties,
  deals,
  saving,
  onClose,
  onSubmit,
}: {
  dialog: DialogKind;
  members: Member[];
  contacts: Contact[];
  properties: Property[];
  deals: Deal[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>, message: string) => Promise<boolean>;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = Object.fromEntries(data.entries());

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
    if (dialog === 'property') {
      await onSubmit(
        {
          action: 'create-property',
          ...values,
          price: values.price || null,
          area: values.area || null,
          ownerContactId: values.ownerContactId || null,
          assignedMemberId: values.assignedMemberId || null,
        },
        'Portföy eklendi.'
      );
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
    if (dialog === 'member') {
      await onSubmit(
        { action: 'create-member', ...values },
        'Ekip üyesi eklendi.'
      );
    }
  }

  const dialogTitle = {
    contact: 'Yeni müşteri',
    property: 'Yeni portföy',
    deal: 'Yeni satış fırsatı',
    task: 'Yeni görev veya randevu',
    member: 'Yeni ekip üyesi',
  }[dialog || 'contact'];

  return (
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border border-slate-700 bg-slate-900 text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            Bilgileri daha sonra müşteri veya portföy profilinden geliştirebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" id="workspace-form" onSubmit={submit}>
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

          {dialog === 'property' && (
            <>
              <label className={`${labelClass} sm:col-span-2`}>
                Portföy başlığı
                <Input className={fieldClass} name="title" required />
              </label>
              <label className={labelClass}>
                Referans kodu
                <Input className={fieldClass} name="referenceCode" />
              </label>
              <label className={labelClass}>
                Konum
                <Input className={fieldClass} name="location" />
              </label>
              <label className={labelClass}>
                Fiyat
                <Input className={fieldClass} min="0" name="price" type="number" />
              </label>
              <label className={labelClass}>
                Oda sayısı
                <Input className={fieldClass} name="roomCount" placeholder="3+1" />
              </label>
              <label className={labelClass}>
                Alan (m²)
                <Input className={fieldClass} min="0" name="area" type="number" />
              </label>
              <label className={labelClass}>
                Durum
                <SelectField defaultValue="ACTIVE" name="status">
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
                <SelectField defaultValue="" name="ownerContactId">
                  <option value="">Atanmadı</option>
                  {contacts.filter((contact) => contact.type === 'SELLER').map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name}</option>
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
              <label className={`${labelClass} sm:col-span-2`}>
                Görsel adresi
                <Input className={fieldClass} name="imageUrl" type="url" />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Açıklama
                <textarea className={`${fieldClass} min-h-24 py-3`} name="description" />
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

          {dialog === 'member' && (
            <>
              <label className={`${labelClass} sm:col-span-2`}>
                Ad soyad
                <Input className={fieldClass} name="name" required />
              </label>
              <label className={labelClass}>
                E-posta
                <Input className={fieldClass} name="email" type="email" />
              </label>
              <label className={labelClass}>
                Telefon
                <Input className={fieldClass} name="phone" />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Rol
                <SelectField defaultValue="AGENT" name="role">
                  <option value="OWNER">Şirket sahibi</option>
                  <option value="MANAGER">Yönetici</option>
                  <option value="AGENT">Danışman</option>
                  <option value="VIEWER">Görüntüleyici</option>
                </SelectField>
              </label>
            </>
          )}
        </form>
        <DialogFooter className="border-slate-800 bg-slate-950/50">
          <Button onClick={onClose} type="button" variant="ghost">
            Vazgeç
          </Button>
          <Button
            className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
            disabled={saving}
            form="workspace-form"
            type="submit"
          >
            {saving && <Loader2 className="animate-spin" />}
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
