'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  Code2,
  Download,
  FileArchive,
  Globe2,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCw,
  ServerCog,
  X,
} from 'lucide-react';

type IntegrationStatus = 'PENDING' | 'READY' | 'DELIVERED' | 'SUSPENDED';

type WebsiteIntegration = {
  id: string;
  displayName: string;
  websiteUrl: string;
  framework: string;
  hostingProvider: string;
  portfolioPath: string;
  technicalContactEmail: string;
  repositoryUrl: string | null;
  notes: string | null;
  sourceFileName: string;
  sourceSize: number;
  apiKeyHint: string;
  promptTemplate: string;
  status: IntegrationStatus;
  submittedAt: string;
  deliveredAt: string | null;
  downloadUrl: string;
  companyAccount: {
    id: string;
    companyName: string;
    slug: string;
    ownerName: string;
    ownerEmail: string | null;
  };
};

type Credentials = {
  oneTimeApiKey: string;
  codexPrompt: string;
  integrationName: string;
};

const statusLabels: Record<IntegrationStatus, string> = {
  PENDING: 'Dosya bekliyor',
  READY: 'API hazır',
  DELIVERED: 'Teslim edildi',
  SUSPENDED: 'Durduruldu',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function PlatformWebsiteIntegrations() {
  const [integrations, setIntegrations] = useState<WebsiteIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/platform-admin/website-integrations', {
        cache: 'no-store',
      });
      const data = (await response.json()) as {
        integrations?: WebsiteIntegration[];
        error?: string;
      };
      if (!response.ok || !data.integrations) {
        throw new Error(data.error || 'Site entegrasyonları alınamadı.');
      }
      setIntegrations(data.integrations);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Site entegrasyonları alınamadı.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  async function update(
    integration: WebsiteIntegration,
    payload:
      | { action: 'status'; status: IntegrationStatus }
      | { action: 'rotate_key' }
  ) {
    if (
      payload.action === 'rotate_key' &&
      !window.confirm(
        'Mevcut site API anahtarı geçersiz olacak. Admin teslim paketi için yeni anahtar oluşturulsun mu?'
      )
    ) {
      return;
    }

    setSaving(integration.id);
    setError('');
    try {
      const response = await fetch('/api/platform-admin/website-integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: integration.id, ...payload }),
      });
      const data = (await response.json()) as {
        oneTimeApiKey?: string;
        codexPrompt?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'Site entegrasyonu güncellenemedi.');
      }
      if (data.oneTimeApiKey && data.codexPrompt) {
        setCredentials({
          oneTimeApiKey: data.oneTimeApiKey,
          codexPrompt: data.codexPrompt,
          integrationName: integration.displayName,
        });
      }
      await load();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'Site entegrasyonu güncellenemedi.'
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="bg-[#07111f] px-4 pb-8 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl sm:p-7">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <ServerCog className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
                  Yazılım teslim hattı
                </p>
                <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">
                  Müşteri web sitesi entegrasyonları
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                  Kaynak kodunu indirin, şirkete özel API + Codex promptu üretin
                  ve teslim durumunu yönetin.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void load();
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-bold text-slate-200 hover:text-emerald-200"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
              Yenile
            </button>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
            >
              {error}
            </div>
          ) : null}

          {credentials ? (
            <section className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 font-black text-amber-100">
                    <KeyRound className="h-4 w-4" />
                    {credentials.integrationName} · tek seferlik teslim paketi
                  </h3>
                  <p className="mt-1 text-xs text-amber-100/70">
                    Prompt gerçek API anahtarını içerir. Codex’e yapıştırmadan
                    önce güvenli çalışma ortamında olduğunuzu kontrol edin.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCredentials(null)}
                  aria-label="Teslim paketini kapat"
                  className="rounded-lg p-2 text-amber-100 hover:bg-amber-300/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-xl border border-amber-400/20 bg-slate-950/70 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/70">
                    Şirkete özel API anahtarı
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 break-all text-xs text-white">
                      {credentials.oneTimeApiKey}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy(credentials.oneTimeApiKey)}
                      aria-label="API anahtarını kopyala"
                      className="rounded-lg p-2 text-amber-200 hover:bg-amber-300/10"
                    >
                      <Clipboard className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-400/20 bg-slate-950/70 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/70">
                    Codex entegrasyon promptu
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-5 text-slate-300">
                      {credentials.codexPrompt}
                    </p>
                    <button
                      type="button"
                      onClick={() => void copy(credentials.codexPrompt)}
                      className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-amber-300 px-3 text-xs font-black text-slate-950"
                    >
                      <Clipboard className="h-4 w-4" />
                      Promptu kopyala
                    </button>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
            </div>
          ) : integrations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center">
              <Globe2 className="mx-auto h-9 w-9 text-slate-600" />
              <p className="mt-3 text-sm font-bold text-slate-300">
                Henüz site kodu gönderilmedi
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {integrations.map((integration) => (
                <article
                  key={integration.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                        {integration.companyAccount.companyName}
                      </p>
                      <h3 className="mt-1 truncate text-base font-black text-white">
                        {integration.displayName}
                      </h3>
                      <a
                        href={integration.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block truncate text-xs text-slate-400 hover:text-cyan-300"
                      >
                        {integration.websiteUrl}
                      </a>
                    </div>
                    <span className="shrink-0 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-black text-slate-300">
                      {statusLabels[integration.status]}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-950/70 p-3">
                      <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                        Teknik altyapı
                      </dt>
                      <dd className="mt-1 font-bold text-slate-200">
                        {integration.framework}
                      </dd>
                      <dd className="text-[11px] text-slate-500">
                        {integration.hostingProvider}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-950/70 p-3">
                      <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                        Kaynak paketi
                      </dt>
                      <dd className="mt-1 truncate font-bold text-slate-200">
                        {integration.sourceFileName}
                      </dd>
                      <dd className="text-[11px] text-slate-500">
                        {formatBytes(integration.sourceSize)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-950/70 p-3">
                      <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                        API anahtarı
                      </dt>
                      <dd className="mt-1 truncate font-mono text-[11px] text-emerald-200">
                        {integration.apiKeyHint}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-950/70 p-3">
                      <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                        Gönderim
                      </dt>
                      <dd className="mt-1 text-[11px] text-slate-300">
                        {formatDate(integration.submittedAt)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <a
                      href={integration.downloadUrl}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 text-[11px] font-black text-slate-950"
                    >
                      <Download className="h-4 w-4" />
                      Siteyi indir
                    </a>
                    <button
                      type="button"
                      onClick={() =>
                        void update(integration, { action: 'rotate_key' })
                      }
                      disabled={saving === integration.id}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-[11px] font-black text-emerald-200 disabled:opacity-50"
                    >
                      {saving === integration.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCw className="h-4 w-4" />
                      )}
                      API + prompt
                    </button>
                    <button
                      type="button"
                      onClick={() => void copy(integration.promptTemplate)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-[11px] font-bold text-slate-200"
                    >
                      <Code2 className="h-4 w-4" />
                      Şablon prompt
                    </button>
                  </div>

                  <div className="mt-3">
                    <label
                      htmlFor={`integration-status-${integration.id}`}
                      className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      Teslim durumu
                    </label>
                    <select
                      id={`integration-status-${integration.id}`}
                      value={integration.status}
                      disabled={saving === integration.id}
                      onChange={(event) =>
                        void update(integration, {
                          action: 'status',
                          status: event.target.value as IntegrationStatus,
                        })
                      }
                      className="min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs font-bold text-slate-200 outline-none focus:border-emerald-400 disabled:opacity-50"
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-800 pt-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <FileArchive className="h-3.5 w-3.5" />
                      {integration.portfolioPath}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Teslim: {formatDate(integration.deliveredAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
