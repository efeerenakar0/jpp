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
  ShieldCheck,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';

type IntegrationStatus =
  | 'SUBMITTED'
  | 'IN_PROGRESS'
  | 'READY_FOR_QA'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'DELIVERED'
  | 'FAILED';

type DeliveryType = 'ZIP_ONLY' | 'ADMIN_DEPLOYED' | 'CUSTOMER_DEPLOYS';

type WebsiteVersion = {
  id: string;
  version: number;
  workOrder: string;
  sourceFileName: string;
  sourceSize: number;
  sourceSha256: string;
  resultFileName: string | null;
  resultSize: number | null;
  resultSha256: string | null;
  buildReport: unknown;
  qaStatus: 'PENDING' | 'PASSED' | 'FAILED';
  qaReport: unknown;
  previewUrl: string | null;
  finalUrl: string | null;
  resultUploadedAt: string | null;
  approvedAt: string | null;
  deliveredAt: string | null;
  lastError: string | null;
};

type WebsiteIntegration = {
  id: string;
  displayName: string;
  websiteUrl: string;
  framework: string;
  hostingProvider: string;
  portfolioPath: string;
  sourceFileName: string;
  sourceSize: number;
  apiKeyHint: string;
  promptTemplate: string;
  status: IntegrationStatus;
  deliveryType: DeliveryType | null;
  previewUrl: string | null;
  finalUrl: string | null;
  lastError: string | null;
  submittedAt: string;
  approvedAt: string | null;
  deliveredAt: string | null;
  downloadUrl: string;
  versions: WebsiteVersion[];
  companyAccount: {
    id: string;
    companyName: string;
    slug: string;
    ownerName: string;
    ownerEmail: string | null;
  };
};

type SecretResult = {
  title: string;
  secret: string;
  secondary?: string;
};

type EditorState = {
  previewUrl: string;
  buildReport: string;
  qaReport: string;
  deliveryType: DeliveryType;
  finalUrl: string;
  recipientEmail: string;
};

const statusLabels: Record<IntegrationStatus, string> = {
  SUBMITTED: 'Gönderildi',
  IN_PROGRESS: 'Codex çalışması sürüyor',
  READY_FOR_QA: 'QA bekliyor',
  CHANGES_REQUESTED: 'Düzeltme istendi',
  APPROVED: 'QA onaylı',
  DELIVERED: 'Teslim edildi',
  FAILED: 'İşlem hatası',
};

const statusStyles: Record<IntegrationStatus, string> = {
  SUBMITTED: 'border-slate-600 text-slate-300',
  IN_PROGRESS: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200',
  READY_FOR_QA: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  CHANGES_REQUESTED: 'border-orange-400/40 bg-orange-400/10 text-orange-200',
  APPROVED: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  DELIVERED: 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100',
  FAILED: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatBytes(bytes: number | null) {
  if (bytes === null) return '—';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function initialEditor(integration: WebsiteIntegration): EditorState {
  return {
    previewUrl: integration.previewUrl || '',
    buildReport: '{\n  "build": "passed",\n  "tests": "passed"\n}',
    qaReport: '',
    deliveryType: integration.deliveryType || 'ZIP_ONLY',
    finalUrl: integration.finalUrl || '',
    recipientEmail: integration.companyAccount.ownerEmail || '',
  };
}

export default function PlatformWebsiteIntegrations() {
  const [integrations, setIntegrations] = useState<WebsiteIntegration[]>([]);
  const [editors, setEditors] = useState<Record<string, EditorState>>({});
  const [resultFiles, setResultFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [secretResult, setSecretResult] = useState<SecretResult | null>(null);

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
      setEditors((current) => {
        const next = { ...current };
        for (const integration of data.integrations || []) {
          next[integration.id] ||= initialEditor(integration);
        }
        return next;
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Site entegrasyonları alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function updateEditor(id: string, patch: Partial<EditorState>) {
    setEditors((current) => ({
      ...current,
      [id]: { ...(current[id] || initialEditor(integrations.find((item) => item.id === id)!)), ...patch },
    }));
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  async function deliveryAction(
    integration: WebsiteIntegration,
    payload: Record<string, unknown>
  ) {
    setSaving(integration.id);
    setError('');
    try {
      const response = await fetch(
        `/api/platform-admin/website-integrations/${integration.id}/delivery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = (await response.json()) as {
        error?: string;
        workOrder?: string;
        oneTimeProductionApiKey?: string;
        oneTimeDeliveryToken?: string;
        expiresAt?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Teslim işlemi tamamlanamadı.');
      if (data.workOrder) {
        setSecretResult({ title: `${integration.displayName} · Codex iş emri`, secret: data.workOrder });
      } else if (data.oneTimeProductionApiKey) {
        setSecretResult({
          title: `${integration.displayName} · production API anahtarı`,
          secret: data.oneTimeProductionApiKey,
          secondary: 'Bu anahtar yalnız bu ekranda bir kez gösterilir.',
        });
      } else if (data.oneTimeDeliveryToken) {
        const link = `${window.location.origin}/api/website-deliveries/${data.oneTimeDeliveryToken}`;
        setSecretResult({
          title: `${integration.displayName} · tek kullanımlık teslim bağlantısı`,
          secret: link,
          secondary: data.expiresAt ? `Son kullanım: ${formatDate(data.expiresAt)}` : undefined,
        });
      }
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Teslim işlemi tamamlanamadı.');
    } finally {
      setSaving(null);
    }
  }

  async function uploadResult(integration: WebsiteIntegration) {
    const file = resultFiles[integration.id];
    const editor = editors[integration.id];
    if (!file) {
      setError('Tamamlanmış ZIP dosyasını seçin.');
      return;
    }
    setSaving(integration.id);
    setError('');
    try {
      JSON.parse(editor.buildReport);
      const form = new FormData();
      form.set('result', file);
      form.set('buildReport', editor.buildReport);
      if (editor.previewUrl.trim()) form.set('previewUrl', editor.previewUrl.trim());
      const response = await fetch(
        `/api/platform-admin/website-integrations/${integration.id}/delivery`,
        { method: 'POST', body: form }
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Sonuç paketi yüklenemedi.');
      setResultFiles((current) => ({ ...current, [integration.id]: null }));
      await load();
    } catch (uploadError) {
      setError(
        uploadError instanceof SyntaxError
          ? 'Build raporu geçerli bir JSON nesnesi olmalıdır.'
          : uploadError instanceof Error
            ? uploadError.message
            : 'Sonuç paketi yüklenemedi.'
      );
    } finally {
      setSaving(null);
    }
  }

  async function rotateProductionKey(integration: WebsiteIntegration) {
    if (!window.confirm('Mevcut production anahtarı hemen iptal edilecek. Devam edilsin mi?')) return;
    setSaving(integration.id);
    setError('');
    try {
      const response = await fetch('/api/platform-admin/website-integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: integration.id, action: 'rotate_key' }),
      });
      const data = (await response.json()) as { oneTimeApiKey?: string; error?: string };
      if (!response.ok || !data.oneTimeApiKey) throw new Error(data.error || 'Anahtar yenilenemedi.');
      setSecretResult({
        title: `${integration.displayName} · yeni production API anahtarı`,
        secret: data.oneTimeApiKey,
        secondary: 'Eski anahtar iptal edildi; yeni anahtar tekrar gösterilmez.',
      });
      await load();
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : 'Anahtar yenilenemedi.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <main className="bg-[#07111f] px-4 pb-8 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl sm:p-7">
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <ServerCog className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Yazılım teslim hattı</p>
                <h2 className="mt-1 text-xl font-black text-white sm:text-2xl">Müşteri sitesi teslimleri</h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
                  Kaynak sürümünden Codex iş emrine, sonuç ZIP’inden QA ve güvenli teslimata kadar gerçek durum zinciri.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-bold text-slate-200">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Yenile
            </button>
          </header>

          {error ? <div role="alert" className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

          {secretResult ? (
            <section className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-black text-amber-100"><KeyRound className="h-4 w-4" />{secretResult.title}</h3>
                  {secretResult.secondary ? <p className="mt-1 text-xs text-amber-100/70">{secretResult.secondary}</p> : null}
                </div>
                <button type="button" onClick={() => setSecretResult(null)} aria-label="Güvenli sonucu kapat" className="rounded-lg p-2 text-amber-100"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-950/80 p-3">
                <pre className="max-h-64 min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-100">{secretResult.secret}</pre>
                <button type="button" onClick={() => void copy(secretResult.secret)} className="rounded-lg p-2 text-amber-200" aria-label="Kopyala"><Clipboard className="h-4 w-4" /></button>
              </div>
            </section>
          ) : null}

          {loading ? (
            <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-300" /></div>
          ) : integrations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-14 text-center"><Globe2 className="mx-auto h-9 w-9 text-slate-600" /><p className="mt-3 text-sm font-bold text-slate-300">Henüz site kodu gönderilmedi</p></div>
          ) : (
            <div className="space-y-5">
              {integrations.map((integration) => {
                const editor = editors[integration.id] || initialEditor(integration);
                const version = integration.versions[0];
                const busy = saving === integration.id;
                return (
                  <article key={integration.id} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">{integration.companyAccount.companyName}</p>
                        <h3 className="mt-1 text-base font-black text-white">{integration.displayName}</h3>
                        <a href={integration.websiteUrl} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-slate-400 hover:text-cyan-300">{integration.websiteUrl}</a>
                      </div>
                      <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black ${statusStyles[integration.status]}`}>{statusLabels[integration.status]}</span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-slate-950/70 p-3 text-xs"><span className="text-slate-500">Kaynak sürümü</span><p className="mt-1 font-bold text-slate-200">v{version?.version || integration.versions.length}</p><p className="truncate text-[10px] text-slate-500">{integration.sourceFileName} · {formatBytes(integration.sourceSize)}</p></div>
                      <div className="rounded-xl bg-slate-950/70 p-3 text-xs"><span className="text-slate-500">Sonuç paketi</span><p className="mt-1 font-bold text-slate-200">{version?.resultFileName || 'Henüz yüklenmedi'}</p><p className="truncate text-[10px] text-slate-500">SHA-256: {version?.resultSha256?.slice(0, 12) || '—'}</p></div>
                      <div className="rounded-xl bg-slate-950/70 p-3 text-xs"><span className="text-slate-500">QA</span><p className="mt-1 font-bold text-slate-200">{version?.qaStatus || 'PENDING'}</p><p className="text-[10px] text-slate-500">Onay: {formatDate(integration.approvedAt)}</p></div>
                      <div className="rounded-xl bg-slate-950/70 p-3 text-xs"><span className="text-slate-500">Teslim</span><p className="mt-1 font-bold text-slate-200">{integration.deliveryType || '—'}</p><p className="truncate text-[10px] text-slate-500">{integration.finalUrl || formatDate(integration.deliveredAt)}</p></div>
                    </div>

                    {integration.lastError || version?.lastError ? <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{integration.lastError || version?.lastError}</div> : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={integration.downloadUrl} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-[11px] font-bold text-slate-200"><Download className="h-4 w-4" /> Kaynağı indir</a>
                      <button type="button" onClick={() => void copy(version?.workOrder || integration.promptTemplate)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-[11px] font-bold text-slate-200"><Code2 className="h-4 w-4" /> İş emrini kopyala</button>
                      {(integration.status === 'SUBMITTED' || integration.status === 'CHANGES_REQUESTED' || integration.status === 'FAILED') ? <button type="button" disabled={busy} onClick={() => void deliveryAction(integration, { action: 'start_work' })} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-cyan-300 px-3 text-[11px] font-black text-slate-950 disabled:opacity-50"><ServerCog className="h-4 w-4" /> Çalışmayı başlat</button> : null}
                      {(integration.status === 'APPROVED' || integration.status === 'DELIVERED') ? <button type="button" disabled={busy} onClick={() => void rotateProductionKey(integration)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 text-[11px] font-black text-emerald-200 disabled:opacity-50"><RotateCw className="h-4 w-4" /> Production anahtarını yenile</button> : null}
                    </div>

                    {(integration.status === 'IN_PROGRESS' || integration.status === 'CHANGES_REQUESTED' || integration.status === 'FAILED') ? (
                      <section className="mt-4 rounded-xl border border-cyan-400/20 bg-slate-950/60 p-3">
                        <h4 className="flex items-center gap-2 text-xs font-black text-cyan-200"><UploadCloud className="h-4 w-4" /> Tamamlanmış ZIP ve build raporu</h4>
                        <div className="mt-3 grid gap-2 lg:grid-cols-3">
                          <input type="file" accept=".zip,application/zip" onChange={(event) => setResultFiles((current) => ({ ...current, [integration.id]: event.currentTarget.files?.[0] || null }))} className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
                          <input value={editor.previewUrl} onChange={(event) => updateEditor(integration.id, { previewUrl: event.target.value })} placeholder="Preview URL (opsiyonel)" className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs" />
                          <button type="button" disabled={busy} onClick={() => void uploadResult(integration)} className="min-h-10 rounded-lg bg-cyan-300 px-3 text-xs font-black text-slate-950 disabled:opacity-50">Sonuç sürümünü yükle</button>
                        </div>
                        <textarea value={editor.buildReport} onChange={(event) => updateEditor(integration.id, { buildReport: event.target.value })} rows={4} aria-label="Build ve test raporu JSON" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs" />
                      </section>
                    ) : null}

                    {integration.status === 'READY_FOR_QA' ? (
                      <section className="mt-4 rounded-xl border border-amber-400/20 bg-slate-950/60 p-3">
                        <h4 className="text-xs font-black text-amber-200">QA kararı</h4>
                        {version?.previewUrl ? <a href={version.previewUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-cyan-300">Preview’i aç</a> : null}
                        <textarea value={editor.qaReport} onChange={(event) => updateEditor(integration.id, { qaReport: event.target.value })} rows={3} placeholder="Build, test, güvenlik ve görsel QA özeti" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs" />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" disabled={busy} onClick={() => void deliveryAction(integration, { action: 'qa', result: 'PASSED', report: { summary: editor.qaReport || 'QA kontrolleri geçti.' } })} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-300 px-3 text-xs font-black text-slate-950 disabled:opacity-50"><ShieldCheck className="h-4 w-4" /> QA onayla</button>
                          <button type="button" disabled={busy} onClick={() => void deliveryAction(integration, { action: 'qa', result: 'FAILED', report: { summary: editor.qaReport || 'Düzeltme gerekiyor.' } })} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-400/30 px-3 text-xs font-black text-rose-200 disabled:opacity-50"><XCircle className="h-4 w-4" /> Düzeltme iste</button>
                        </div>
                      </section>
                    ) : null}

                    {integration.status === 'APPROVED' ? (
                      <section className="mt-4 rounded-xl border border-emerald-400/20 bg-slate-950/60 p-3">
                        <h4 className="flex items-center gap-2 text-xs font-black text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Onaylı paketi teslim et</h4>
                        <div className="mt-3 grid gap-2 lg:grid-cols-3">
                          <select value={editor.deliveryType} onChange={(event) => updateEditor(integration.id, { deliveryType: event.target.value as DeliveryType })} className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs"><option value="ZIP_ONLY">Yalnız ZIP</option><option value="CUSTOMER_DEPLOYS">Müşteri deploy eder</option><option value="ADMIN_DEPLOYED">Admin deploy etti</option></select>
                          <input value={editor.finalUrl} onChange={(event) => updateEditor(integration.id, { finalUrl: event.target.value })} placeholder="Final URL (admin deploy için zorunlu)" className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs" />
                          <button type="button" disabled={busy} onClick={() => void deliveryAction(integration, { action: 'deliver', deliveryType: editor.deliveryType, ...(editor.finalUrl.trim() ? { finalUrl: editor.finalUrl.trim() } : {}) })} className="min-h-10 rounded-lg bg-emerald-300 px-3 text-xs font-black text-slate-950 disabled:opacity-50">Teslimi tamamla</button>
                        </div>
                      </section>
                    ) : null}

                    {(integration.status === 'APPROVED' || integration.status === 'DELIVERED') ? (
                      <section className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-950/60 p-3 sm:flex-row">
                        <input type="email" value={editor.recipientEmail} onChange={(event) => updateEditor(integration.id, { recipientEmail: event.target.value })} placeholder="Teknik kişi e-postası (opsiyonel)" className="min-h-10 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs" />
                        <button type="button" disabled={busy} onClick={() => void deliveryAction(integration, { action: 'create_delivery_token', expiresInHours: 24, ...(editor.recipientEmail.trim() ? { recipientEmail: editor.recipientEmail.trim() } : {}) })} className="min-h-10 rounded-lg border border-emerald-400/30 px-3 text-xs font-black text-emerald-200 disabled:opacity-50">24 saatlik tek kullanım bağlantısı</button>
                      </section>
                    ) : null}

                    <footer className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-3 text-[10px] text-slate-500"><span className="flex items-center gap-1"><FileArchive className="h-3.5 w-3.5" />{integration.portfolioPath}</span><span>Gönderim: {formatDate(integration.submittedAt)}</span><span>Sonuç: {formatDate(version?.resultUploadedAt || null)}</span></footer>
                    {busy ? <p className="mt-2 flex items-center gap-2 text-xs text-cyan-200"><Loader2 className="h-3.5 w-3.5 animate-spin" /> İşlem kaydediliyor…</p> : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
