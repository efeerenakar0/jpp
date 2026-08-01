'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clipboard,
  Code2,
  FileArchive,
  FolderOpen,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  MAX_SITE_SOURCE_BYTES,
  MAX_SITE_SOURCE_FILES,
  shouldIncludeWebsiteFile,
} from '@/lib/website-source-files';

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
  status: 'PENDING' | 'READY' | 'DELIVERED' | 'SUSPENDED';
  submittedAt: string;
  deliveredAt: string | null;
};

type CredentialResult = {
  oneTimeApiKey: string;
  codexPrompt: string;
};

type FormState = {
  displayName: string;
  websiteUrl: string;
  framework: string;
  hostingProvider: string;
  portfolioPath: string;
  technicalContactEmail: string;
  repositoryUrl: string;
  notes: string;
};

type Props = {
  onBack: () => void;
};

const initialForm: FormState = {
  displayName: '',
  websiteUrl: '',
  framework: '',
  hostingProvider: '',
  portfolioPath: '/portfoyler',
  technicalContactEmail: '',
  repositoryUrl: '',
  notes: '',
};

const statusLabels: Record<WebsiteIntegration['status'], string> = {
  PENDING: 'Admin incelemesinde',
  READY: 'API bağlantısına hazır',
  DELIVERED: 'Teslim edildi',
  SUSPENDED: 'Erişim durduruldu',
};

const statusStyles: Record<WebsiteIntegration['status'], string> = {
  PENDING: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  READY: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200',
  DELIVERED: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  SUSPENDED: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function sourcePath(file: File) {
  return (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name
  );
}

async function archiveFolder(files: File[]) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const file of files) {
    zip.file(sourcePath(file), file);
  }
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export default function ExistingWebsiteIntegration({ onBack }: Props) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [integrations, setIntegrations] = useState<WebsiteIntegration[]>([]);
  const [sourceZip, setSourceZip] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [sourceLabel, setSourceLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rotating, setRotating] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
    folderInputRef.current?.setAttribute('directory', '');
  }, []);

  const loadIntegrations = useCallback(async () => {
    try {
      const response = await fetch('/api/fabrika/website-integration', {
        cache: 'no-store',
      });
      const data = (await response.json()) as {
        integrations?: WebsiteIntegration[];
        error?: string;
      };
      if (!response.ok || !data.integrations) {
        throw new Error(data.error || 'Site bağlantıları alınamadı.');
      }
      setIntegrations(data.integrations);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Site bağlantıları alınamadı.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseZip(file: File | undefined) {
    if (!file) return;
    if (
      !file.name.toLocaleLowerCase('en-US').endsWith('.zip') ||
      file.size > MAX_SITE_SOURCE_BYTES
    ) {
      toast.error('En fazla 30 MB boyutunda bir ZIP dosyası seçin.');
      return;
    }
    setSourceZip(file);
    setFolderFiles([]);
    setSourceLabel(`${file.name} · ${formatBytes(file.size)}`);
  }

  function chooseFolder(files: File[]) {
    const included = files.filter((file) =>
      shouldIncludeWebsiteFile(sourcePath(file))
    );
    const totalBytes = included.reduce((total, file) => total + file.size, 0);
    if (included.length === 0) {
      toast.error('Klasörde yüklenebilir kaynak kodu bulunamadı.');
      return;
    }
    if (included.length > MAX_SITE_SOURCE_FILES) {
      toast.error(`En fazla ${MAX_SITE_SOURCE_FILES} kaynak dosyası yüklenebilir.`);
      return;
    }
    if (totalBytes > 100 * 1024 * 1024) {
      toast.error('Klasörün sıkıştırılmamış boyutu en fazla 100 MB olabilir.');
      return;
    }

    const excludedCount = files.length - included.length;
    setFolderFiles(included);
    setSourceZip(null);
    setSourceLabel(
      `${included.length} dosya · ${formatBytes(totalBytes)}${
        excludedCount ? ` · ${excludedCount} gereksiz/gizli dosya çıkarıldı` : ''
      }`
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceZip && folderFiles.length === 0) {
      toast.error('Site klasörünü veya ZIP paketini seçin.');
      return;
    }
    setSubmitting(true);
    try {
      let source = sourceZip;
      if (!source) {
        const blob = await archiveFolder(folderFiles);
        if (blob.size > MAX_SITE_SOURCE_BYTES) {
          throw new Error('Sıkıştırılmış site paketi 30 MB sınırını aşıyor.');
        }
        const root =
          sourcePath(folderFiles[0]).split('/')[0] || 'website-source';
        source = new File([blob], `${root}.zip`, { type: 'application/zip' });
      }

      const payload = new FormData();
      payload.set('metadata', JSON.stringify(form));
      payload.set('source', source);
      const response = await fetch('/api/fabrika/website-integration', {
        method: 'POST',
        body: payload,
      });
      const data = (await response.json()) as {
        integration?: WebsiteIntegration;
        oneTimeApiKey?: string;
        codexPrompt?: string;
        error?: string;
      };
      if (
        !response.ok ||
        !data.integration ||
        !data.oneTimeApiKey ||
        !data.codexPrompt
      ) {
        throw new Error(data.error || 'Site paketi gönderilemedi.');
      }

      setCredentials({
        oneTimeApiKey: data.oneTimeApiKey,
        codexPrompt: data.codexPrompt,
      });
      setForm(initialForm);
      setSourceZip(null);
      setFolderFiles([]);
      setSourceLabel('');
      await loadIntegrations();
      toast.success('Site kodları ve entegrasyon bilgileri admine gönderildi.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Site paketi gönderilemedi.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} kopyalandı.`);
  }

  function downloadPrompt() {
    if (!credentials) return;
    const url = URL.createObjectURL(
      new Blob([credentials.codexPrompt], { type: 'text/plain;charset=utf-8' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'jasmine-codex-entegrasyon-promptu.txt';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function rotateKey(integration: WebsiteIntegration) {
    if (
      !window.confirm(
        'Eski API anahtarı hemen geçersiz olacak. Yeni anahtar oluşturulsun mu?'
      )
    ) {
      return;
    }
    setRotating(integration.id);
    try {
      const response = await fetch('/api/fabrika/website-integration', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rotate_key', id: integration.id }),
      });
      const data = (await response.json()) as {
        oneTimeApiKey?: string;
        codexPrompt?: string;
        error?: string;
      };
      if (!response.ok || !data.oneTimeApiKey || !data.codexPrompt) {
        throw new Error(data.error || 'API anahtarı yenilenemedi.');
      }
      setCredentials({
        oneTimeApiKey: data.oneTimeApiKey,
        codexPrompt: data.codexPrompt,
      });
      await loadIntegrations();
      toast.success('Yeni API anahtarı oluşturuldu.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'API anahtarı yenilenemedi.'
      );
    } finally {
      setRotating(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-white">
            <Code2 className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            Mevcut siteyi bağla
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Site kodunu ve teknik bilgileri gönderin; şirketinize özel API ve
            Codex promptu otomatik hazırlansın.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          aria-label="Web sitesi seçimine dön"
          className="rounded-lg border border-slate-700 p-2 text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {credentials ? (
          <section className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-black text-emerald-200">
                  <ShieldCheck className="h-4 w-4" />
                  Tek seferlik entegrasyon paketi
                </h4>
                <p className="mt-1 text-[11px] leading-5 text-emerald-100/70">
                  Anahtarı şimdi güvenli biçimde saklayın. Tam hâli tekrar
                  gösterilmez.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCredentials(null)}
                className="rounded-lg p-1.5 text-emerald-100 hover:bg-white/10"
                aria-label="Entegrasyon paketini kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-slate-950/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/70">
                Şirkete özel API anahtarı
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-[11px] text-white">
                  {credentials.oneTimeApiKey}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    void copy(credentials.oneTimeApiKey, 'API anahtarı')
                  }
                  className="rounded-lg p-2 text-emerald-200 hover:bg-emerald-300/10"
                  aria-label="API anahtarını kopyala"
                >
                  <Clipboard className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copy(credentials.codexPrompt, 'Codex promptu')}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-3 text-xs font-black text-slate-950 transition hover:bg-emerald-200"
              >
                <Clipboard className="h-4 w-4" />
                Promptu kopyala
              </button>
              <button
                type="button"
                onClick={downloadPrompt}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-slate-950/50 px-3 text-xs font-bold text-emerald-100"
              >
                <FileArchive className="h-4 w-4" />
                Promptu indir
              </button>
            </div>
          </section>
        ) : null}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] font-bold text-slate-300">
              Site/proje adı
              <input
                value={form.displayName}
                onChange={(event) =>
                  updateField('displayName', event.target.value)
                }
                placeholder="Örn. Acme Emlak ana sitesi"
                required
                className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-300">
              Canlı site adresi
              <input
                type="url"
                value={form.websiteUrl}
                onChange={(event) =>
                  updateField('websiteUrl', event.target.value)
                }
                placeholder="https://ornek.com"
                required
                className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-300">
              Altyapı / framework
              <input
                value={form.framework}
                onChange={(event) =>
                  updateField('framework', event.target.value)
                }
                placeholder="Next.js, WordPress, PHP..."
                required
                className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-300">
              Hosting sağlayıcısı
              <input
                value={form.hostingProvider}
                onChange={(event) =>
                  updateField('hostingProvider', event.target.value)
                }
                placeholder="Vercel, cPanel, Netlify..."
                required
                className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-300">
              Portföy sayfası yolu
              <input
                value={form.portfolioPath}
                onChange={(event) =>
                  updateField('portfolioPath', event.target.value)
                }
                placeholder="/portfoyler"
                required
                className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-300">
              Teknik iletişim e-postası
              <input
                type="email"
                value={form.technicalContactEmail}
                onChange={(event) =>
                  updateField('technicalContactEmail', event.target.value)
                }
                placeholder="teknik@ornek.com"
                required
                className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-400"
              />
            </label>
          </div>

          <label className="block text-[11px] font-bold text-slate-300">
            Kod deposu adresi (opsiyonel)
            <input
              type="url"
              value={form.repositoryUrl}
              onChange={(event) =>
                updateField('repositoryUrl', event.target.value)
              }
              placeholder="https://github.com/..."
              className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="block text-[11px] font-bold text-slate-300">
            Teknik notlar
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              placeholder="Çalıştırma komutu, özel klasörler, dikkat edilmesi gerekenler..."
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-white outline-none focus:border-cyan-400"
            />
          </label>

          <div className="rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-4">
            <div className="flex items-start gap-3">
              <FileArchive className="mt-0.5 h-5 w-5 text-cyan-300" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-white">
                  Site kaynak kodunu yükleyin
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-400">
                  Klasör yüklemede node_modules, .git, derleme çıktıları ve .env
                  gizli dosyaları otomatik çıkarılır. ZIP yüklerken .env
                  dosyalarını siz kaldırın.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-300 px-3 text-[11px] font-black text-slate-950">
                    <FolderOpen className="h-4 w-4" />
                    Klasör seç
                    <input
                      ref={folderInputRef}
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(event) =>
                        chooseFolder(Array.from(event.currentTarget.files || []))
                      }
                    />
                  </label>
                  <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 text-[11px] font-bold text-slate-200">
                    <FileArchive className="h-4 w-4" />
                    ZIP seç
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      className="sr-only"
                      onChange={(event) =>
                        chooseZip(event.currentTarget.files?.[0])
                      }
                    />
                  </label>
                </div>
                {sourceLabel ? (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-950/70 px-3 py-2 text-[10px] leading-4 text-emerald-200">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {sourceLabel}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[10px] leading-4 text-amber-100/80">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            Şifre, özel anahtar, müşteri verisi ve üretim .env dosyalarını
            pakete eklemeyin. Kaynak kod yalnızca yetkili admin tarafından
            indirilebilir.
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:brightness-105 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {submitting
              ? 'Site paketi hazırlanıyor ve gönderiliyor...'
              : 'Kodları, API paketini ve promptu gönder'}
          </button>
        </form>

        <section className="border-t border-slate-800 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-black text-white">
                Gönderilen siteler
              </h4>
              <p className="mt-1 text-[10px] text-slate-500">
                Teslim durumunu ve API anahtarını buradan yönetin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadIntegrations()}
              aria-label="Site bağlantılarını yenile"
              className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-cyan-300"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
          {loading ? (
            <div className="flex min-h-24 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
            </div>
          ) : integrations.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-[11px] text-slate-500">
              Henüz gönderilmiş bir site yok.
            </p>
          ) : (
            <div className="space-y-3">
              {integrations.map((integration) => (
                <article
                  key={integration.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-black text-white">
                        {integration.displayName}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">
                        {integration.websiteUrl}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black ${statusStyles[integration.status]}`}
                    >
                      {statusLabels[integration.status]}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded-lg bg-slate-900 p-2 text-slate-400">
                      <FileArchive className="mb-1 h-3.5 w-3.5 text-cyan-300" />
                      <p className="truncate text-slate-200">
                        {integration.sourceFileName}
                      </p>
                      {formatBytes(integration.sourceSize)}
                    </div>
                    <div className="rounded-lg bg-slate-900 p-2 text-slate-400">
                      <KeyRound className="mb-1 h-3.5 w-3.5 text-emerald-300" />
                      <p className="truncate font-mono text-slate-200">
                        {integration.apiKeyHint}
                      </p>
                      Şirkete özel API
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void rotateKey(integration)}
                    disabled={rotating === integration.id}
                    className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 text-[10px] font-bold text-slate-300 transition hover:text-cyan-200 disabled:opacity-50"
                  >
                    {rotating === integration.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCw className="h-3.5 w-3.5" />
                    )}
                    API anahtarını ve promptu yenile
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
