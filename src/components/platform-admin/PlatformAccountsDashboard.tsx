'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  Building2,
  CheckCircle2,
  Clipboard,
  Clock3,
  KeyRound,
  LoaderCircle,
  LogOut,
  PauseCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';

type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED';

type CompanyAccount = {
  id: string;
  companyName: string;
  slug: string;
  ownerName: string;
  ownerEmail: string | null;
  accessKeyHint: string | null;
  verificationCodeHint: string | null;
  status: AccountStatus;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: string;
  subscriptionEndsAt: string | null;
  workspaceEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  total: number;
  active: number;
  pausedSubscriptions: number;
  pendingWorkspaces: number;
};

type OneTimeCredentials = {
  accessKey: string;
  verificationCode: string;
};

const accountStatusLabels: Record<AccountStatus, string> = {
  ACTIVE: 'Açık',
  SUSPENDED: 'Askıda',
  CLOSED: 'Kapalı',
};

const subscriptionLabels: Record<SubscriptionStatus, string> = {
  TRIAL: 'Deneme',
  ACTIVE: 'Aktif',
  PAUSED: 'Durduruldu',
  CANCELLED: 'İptal',
  EXPIRED: 'Süresi doldu',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function PlatformAccountsDashboard() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<CompanyAccount[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    pausedSubscriptions: 0,
    pendingWorkspaces: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [credentials, setCredentials] =
    useState<OneTimeCredentials | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState('standard');

  const loadAccounts = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/platform-admin/accounts', {
        cache: 'no-store',
      });
      const data = (await response.json()) as {
        accounts?: CompanyAccount[];
        stats?: Stats;
        error?: string;
      };

      if (response.status === 401) {
        router.push('/platform-admin/giris');
        return;
      }

      if (!response.ok || !data.accounts || !data.stats) {
        setError(data.error || 'Şirket hesapları alınamadı.');
        return;
      }

      setAccounts(data.accounts);
      setStats(data.stats);
    } catch {
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;

    fetch('/api/platform-admin/accounts', { cache: 'no-store' })
      .then(async (response) => ({
        response,
        data: (await response.json()) as {
          accounts?: CompanyAccount[];
          stats?: Stats;
          error?: string;
        },
      }))
      .then(({ response, data }) => {
        if (!active) return;

        if (response.status === 401) {
          router.push('/platform-admin/giris');
          return;
        }

        if (!response.ok || !data.accounts || !data.stats) {
          setError(data.error || 'Şirket hesapları alınamadı.');
          return;
        }

        setAccounts(data.accounts);
        setStats(data.stats);
      })
      .catch(() => {
        if (active) setError('Sunucuya bağlanılamadı.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving('create');
    setError('');

    try {
      const response = await fetch('/api/platform-admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          ownerName,
          ownerEmail,
          subscriptionPlan,
        }),
      });
      const data = (await response.json()) as {
        oneTimeCredentials?: OneTimeCredentials;
        error?: string;
      };

      if (!response.ok || !data.oneTimeCredentials) {
        setError(data.error || 'Şirket hesabı oluşturulamadı.');
        return;
      }

      setCredentials(data.oneTimeCredentials);
      setCompanyName('');
      setOwnerName('');
      setOwnerEmail('');
      setSubscriptionPlan('standard');
      setShowCreate(false);
      await loadAccounts();
    } catch {
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setSaving(null);
    }
  }

  async function updateAccount(
    id: string,
    payload:
      | { action: 'account_status'; status: AccountStatus }
      | {
          action: 'subscription_status';
          subscriptionStatus: SubscriptionStatus;
        }
      | { action: 'reset_credentials' }
  ) {
    if (
      payload.action === 'reset_credentials' &&
      !window.confirm(
        'Eski giriş anahtarı ve doğrulama kodu hemen geçersiz olacak. Devam edilsin mi?'
      )
    ) {
      return;
    }

    setSaving(id);
    setError('');

    try {
      const response = await fetch('/api/platform-admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      });
      const data = (await response.json()) as {
        oneTimeCredentials?: OneTimeCredentials;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error || 'Hesap güncellenemedi.');
        return;
      }

      if (data.oneTimeCredentials) {
        setCredentials(data.oneTimeCredentials);
      }
      await loadAccounts();
    } catch {
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setSaving(null);
    }
  }

  async function logout() {
    await fetch('/api/platform-admin/logout', { method: 'POST' });
    router.push('/platform-admin/giris');
    router.refresh();
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  const metricCards = [
    {
      label: 'Toplam şirket',
      value: stats.total,
      icon: Building2,
      color: 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
    },
    {
      label: 'Açık hesap',
      value: stats.active,
      icon: CheckCircle2,
      color: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
    },
    {
      label: 'Duran abonelik',
      value: stats.pausedSubscriptions,
      icon: PauseCircle,
      color: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
    },
    {
      label: 'Hazırlanan alan',
      value: stats.pendingWorkspaces,
      icon: Clock3,
      color: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
    },
  ];

  return (
    <main className="min-h-screen bg-[#07111f] px-4 py-6 text-slate-100 sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-8 flex flex-col gap-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl sm:p-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                Jasmine AI Platform
              </p>
              <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
                Şirket ve abonelik yönetimi
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Müşteri erişimlerini, abonelik durumlarını ve tek kullanımlık
                giriş bilgilerini yönetin.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Yeni şirket
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:border-rose-400/50 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Çıkış
            </button>
          </div>
        </header>

        <section
          aria-label="Hesap özeti"
          className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <article
                key={metric.label}
                className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:p-5"
              >
                <div
                  className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${metric.color}`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-2xl font-black text-white sm:text-3xl">
                  {metric.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  {metric.label}
                </p>
              </article>
            );
          })}
        </section>

        <div aria-live="polite" aria-atomic="true">
          {error ? (
            <div
              role="alert"
              className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-200"
            >
              {error}
            </div>
          ) : null}

          {credentials ? (
            <section className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-black text-amber-200">
                    Tek seferlik giriş bilgileri
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-amber-100/70">
                    Bu bilgiler kapatıldıktan sonra tam hâliyle tekrar
                    gösterilmez.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCredentials(null)}
                  aria-label="Giriş bilgilerini kapat"
                  className="rounded-lg p-2 text-amber-100 transition hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Giriş anahtarı', credentials.accessKey],
                  ['Doğrulama kodu', credentials.verificationCode],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-slate-950/60 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200/70">
                        {label}
                      </p>
                      <p className="truncate font-mono text-sm text-white">
                        {value}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copy(value)}
                      aria-label={`${label} bilgisini kopyala`}
                      className="rounded-lg p-2 text-amber-200 transition hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    >
                      <Clipboard className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {showCreate ? (
          <section className="mb-8 rounded-3xl border border-cyan-400/20 bg-slate-950/80 p-5 sm:p-7">
            <div className="mb-6">
              <h2 className="text-xl font-black text-white">
                Yeni şirket hesabı
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Çalışma alanı, veri izolasyonu tamamlanana kadar güvenli biçimde
                kilitli oluşturulur.
              </p>
            </div>
            <form
              onSubmit={createAccount}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            >
              <div>
                <label
                  htmlFor="company-name"
                  className="mb-2 block text-xs font-bold text-slate-300"
                >
                  Şirket adı
                </label>
                <input
                  id="company-name"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="owner-name"
                  className="mb-2 block text-xs font-bold text-slate-300"
                >
                  Hesap sahibi
                </label>
                <input
                  id="owner-name"
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="owner-email"
                  className="mb-2 block text-xs font-bold text-slate-300"
                >
                  E-posta
                </label>
                <input
                  id="owner-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(event) => setOwnerEmail(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                />
              </div>
              <div>
                <label
                  htmlFor="subscription-plan"
                  className="mb-2 block text-xs font-bold text-slate-300"
                >
                  Abonelik planı
                </label>
                <select
                  id="subscription-plan"
                  value={subscriptionPlan}
                  onChange={(event) => setSubscriptionPlan(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                >
                  <option value="standard">Standart</option>
                  <option value="professional">Profesyonel</option>
                  <option value="enterprise">Kurumsal</option>
                </select>
              </div>
              <div className="md:col-span-2 xl:col-span-4">
                <button
                  type="submit"
                  disabled={saving === 'create'}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
                >
                  {saving === 'create' ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  )}
                  Hesabı ve giriş bilgilerini oluştur
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section aria-labelledby="accounts-title">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2
                id="accounts-title"
                className="text-xl font-black text-white"
              >
                Şirket hesapları
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Tam kimlik bilgileri saklanmaz; yalnızca maskeli ipuçları
                gösterilir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadAccounts();
              }}
              aria-label="Şirket hesaplarını yenile"
              className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-300 transition hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading ? 'animate-spin motion-reduce:animate-none' : ''
                }`}
                aria-hidden="true"
              />
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-52 items-center justify-center rounded-3xl border border-slate-800 bg-slate-950/60">
              <LoaderCircle
                className="h-8 w-8 animate-spin text-cyan-300 motion-reduce:animate-none"
                aria-label="Şirket hesapları yükleniyor"
              />
            </div>
          ) : accounts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 px-6 py-16 text-center">
              <Building2
                className="mx-auto h-10 w-10 text-slate-600"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-bold text-slate-300">
                Henüz şirket hesabı yok
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {accounts.map((account) => (
                <article
                  key={account.id}
                  className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg sm:p-6"
                >
                  <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                        <Building2 className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black text-white">
                          {account.companyName}
                        </h3>
                        <p className="truncate text-xs text-slate-500">
                          {account.slug}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-[11px] font-black ${
                        account.workspaceEnabled
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                          : 'border-violet-400/30 bg-violet-400/10 text-violet-300'
                      }`}
                    >
                      {account.workspaceEnabled
                        ? 'Çalışma alanı hazır'
                        : 'İzolasyon bekliyor'}
                    </span>
                  </div>

                  <dl className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
                    <div>
                      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
                        Hesap sahibi
                      </dt>
                      <dd className="mt-1 truncate text-sm font-semibold text-slate-200">
                        {account.ownerName}
                      </dd>
                      <dd className="truncate text-xs text-slate-500">
                        {account.ownerEmail || 'E-posta eklenmedi'}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                        Giriş bilgileri
                      </dt>
                      <dd className="mt-1 font-mono text-xs text-slate-300">
                        {account.accessKeyHint || 'Henüz üretilmedi'}
                      </dd>
                      <dd className="font-mono text-xs text-slate-500">
                        Kod: {account.verificationCodeHint || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Plan
                      </dt>
                      <dd className="mt-1 text-sm font-semibold capitalize text-slate-200">
                        {account.subscriptionPlan}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Son giriş
                      </dt>
                      <dd className="mt-1 text-xs text-slate-300">
                        {formatDate(account.lastLoginAt)}
                      </dd>
                    </div>
                  </dl>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`account-status-${account.id}`}
                        className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
                      >
                        Hesap durumu
                      </label>
                      <select
                        id={`account-status-${account.id}`}
                        value={account.status}
                        disabled={saving === account.id}
                        onChange={(event) =>
                          void updateAccount(account.id, {
                            action: 'account_status',
                            status: event.target.value as AccountStatus,
                          })
                        }
                        className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-slate-200 outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30 disabled:opacity-60"
                      >
                        {Object.entries(accountStatusLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor={`subscription-${account.id}`}
                        className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500"
                      >
                        Abonelik
                      </label>
                      <select
                        id={`subscription-${account.id}`}
                        value={account.subscriptionStatus}
                        disabled={saving === account.id}
                        onChange={(event) =>
                          void updateAccount(account.id, {
                            action: 'subscription_status',
                            subscriptionStatus: event.target
                              .value as SubscriptionStatus,
                          })
                        }
                        className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-slate-200 outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30 disabled:opacity-60"
                      >
                        {Object.entries(subscriptionLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {account.status === 'ACTIVE' ? (
                        <CheckCircle2
                          className="h-4 w-4 text-emerald-400"
                          aria-hidden="true"
                        />
                      ) : account.status === 'SUSPENDED' ? (
                        <Ban
                          className="h-4 w-4 text-amber-400"
                          aria-hidden="true"
                        />
                      ) : (
                        <Ban
                          className="h-4 w-4 text-rose-400"
                          aria-hidden="true"
                        />
                      )}
                      {accountStatusLabels[account.status]} ·{' '}
                      {subscriptionLabels[account.subscriptionStatus]}
                    </div>
                    <button
                      type="button"
                      disabled={saving === account.id}
                      onClick={() =>
                        void updateAccount(account.id, {
                          action: 'reset_credentials',
                        })
                      }
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
                    >
                      {saving === account.id ? (
                        <LoaderCircle
                          className="h-4 w-4 animate-spin motion-reduce:animate-none"
                          aria-hidden="true"
                        />
                      ) : (
                        <KeyRound className="h-4 w-4" aria-hidden="true" />
                      )}
                      Giriş bilgilerini yenile
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-8 flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Kimlik bilgileri tek yönlü şifrelenir.
          </span>
          <span className="flex items-center gap-2">
            <WalletCards className="h-4 w-4 text-cyan-400" />
            Abonelik değişiklikleri yeni girişleri anında etkiler.
          </span>
        </footer>
      </div>
    </main>
  );
}
