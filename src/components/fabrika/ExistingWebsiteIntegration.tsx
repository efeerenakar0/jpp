"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clipboard,
  Code2,
  Download,
  FileArchive,
  FolderOpen,
  History,
  KeyRound,
  Loader2,
  PencilLine,
  RefreshCw,
  RotateCw,
  Save,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  MAX_SITE_SOURCE_BYTES,
  MAX_SITE_SOURCE_FILES,
  shouldIncludeWebsiteFile,
} from "@/lib/website-source-files";

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
  status:
    | "SUBMITTED"
    | "IN_PROGRESS"
    | "READY_FOR_QA"
    | "CHANGES_REQUESTED"
    | "APPROVED"
    | "DELIVERED"
    | "FAILED";
  deliveryType: "ZIP_ONLY" | "ADMIN_DEPLOYED" | "CUSTOMER_DEPLOYS" | null;
  previewUrl: string | null;
  finalUrl: string | null;
  approvedAt: string | null;
  lastError: string | null;
  submittedAt: string;
  deliveredAt: string | null;
  promptTemplate: string;
  versions: Array<{
    id: string;
    version: number;
    resultFileName: string | null;
    resultSha256: string | null;
    qaStatus: "PENDING" | "PASSED" | "FAILED";
    previewUrl: string | null;
    finalUrl: string | null;
    approvedAt: string | null;
    deliveredAt: string | null;
  }>;
  promptVersions: Array<{
    id: string;
    version: number;
    promptTemplate: string;
    source: string;
    createdByType: string;
    createdAt: string;
  }>;
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
  displayName: "",
  websiteUrl: "",
  framework: "",
  hostingProvider: "",
  portfolioPath: "/portfoyler",
  technicalContactEmail: "",
  repositoryUrl: "",
  notes: "",
};

const statusLabels: Record<WebsiteIntegration["status"], string> = {
  SUBMITTED: "Admin incelemesinde",
  IN_PROGRESS: "Site üzerinde çalışılıyor",
  READY_FOR_QA: "Kalite kontrolünde",
  CHANGES_REQUESTED: "Düzeltme yapılıyor",
  APPROVED: "Teslim paketi hazır",
  DELIVERED: "Teslim edildi",
  FAILED: "İşlem hatası",
};

const statusStyles: Record<WebsiteIntegration["status"], string> = {
  SUBMITTED: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  IN_PROGRESS: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  READY_FOR_QA: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  CHANGES_REQUESTED: "border-orange-400/30 bg-orange-400/10 text-orange-200",
  APPROVED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  DELIVERED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  FAILED: "border-rose-400/30 bg-rose-400/10 text-rose-200",
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
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const file of files) {
    zip.file(sourcePath(file), file);
  }
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export default function ExistingWebsiteIntegration({ onBack }: Props) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [integrations, setIntegrations] = useState<WebsiteIntegration[]>([]);
  const [sourceZip, setSourceZip] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [sourceLabel, setSourceLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rotating, setRotating] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [credentials, setCredentials] = useState<CredentialResult | null>(null);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  const loadIntegrations = useCallback(async () => {
    try {
      const response = await fetch("/api/fabrika/website-integration", {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        integrations?: WebsiteIntegration[];
        error?: string;
      };
      if (!response.ok || !data.integrations) {
        throw new Error(data.error || "Site bağlantıları alınamadı.");
      }
      setIntegrations(data.integrations);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Site bağlantıları alınamadı.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadIntegrations(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadIntegrations]);

  function updateField<K extends keyof FormState>(
    field: K,
    value: FormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function chooseZip(file: File | undefined) {
    if (!file) return;
    if (
      !file.name.toLocaleLowerCase("en-US").endsWith(".zip") ||
      file.size > MAX_SITE_SOURCE_BYTES
    ) {
      toast.error("En fazla 30 MB boyutunda bir ZIP dosyası seçin.");
      return;
    }
    setSourceZip(file);
    setFolderFiles([]);
    setSourceLabel(`${file.name} · ${formatBytes(file.size)}`);
  }

  function chooseFolder(files: File[]) {
    const included = files.filter((file) =>
      shouldIncludeWebsiteFile(sourcePath(file)),
    );
    const totalBytes = included.reduce((total, file) => total + file.size, 0);
    if (included.length === 0) {
      toast.error("Klasörde yüklenebilir kaynak kodu bulunamadı.");
      return;
    }
    if (included.length > MAX_SITE_SOURCE_FILES) {
      toast.error(
        `En fazla ${MAX_SITE_SOURCE_FILES} kaynak dosyası yüklenebilir.`,
      );
      return;
    }
    if (totalBytes > 100 * 1024 * 1024) {
      toast.error("Klasörün sıkıştırılmamış boyutu en fazla 100 MB olabilir.");
      return;
    }

    const excludedCount = files.length - included.length;
    setFolderFiles(included);
    setSourceZip(null);
    setSourceLabel(
      `${included.length} dosya · ${formatBytes(totalBytes)}${
        excludedCount
          ? ` · ${excludedCount} gereksiz/gizli dosya çıkarıldı`
          : ""
      }`,
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceZip && folderFiles.length === 0) {
      toast.error("Site klasörünü veya ZIP paketini seçin.");
      return;
    }
    setSubmitting(true);
    try {
      let source = sourceZip;
      if (!source) {
        const blob = await archiveFolder(folderFiles);
        if (blob.size > MAX_SITE_SOURCE_BYTES) {
          throw new Error("Sıkıştırılmış site paketi 30 MB sınırını aşıyor.");
        }
        const root =
          sourcePath(folderFiles[0]).split("/")[0] || "website-source";
        source = new File([blob], `${root}.zip`, { type: "application/zip" });
      }

      const payload = new FormData();
      payload.set("metadata", JSON.stringify(form));
      payload.set("source", source);
      const response = await fetch("/api/fabrika/website-integration", {
        method: "POST",
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
        throw new Error(data.error || "Site paketi gönderilemedi.");
      }

      setCredentials({
        oneTimeApiKey: data.oneTimeApiKey,
        codexPrompt: data.codexPrompt,
      });
      setForm(initialForm);
      setSourceZip(null);
      setFolderFiles([]);
      setSourceLabel("");
      await loadIntegrations();
      toast.success("Site kodları ve entegrasyon bilgileri admine gönderildi.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Site paketi gönderilemedi.",
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
      new Blob([credentials.codexPrompt], { type: "text/plain;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "jasmine-codex-entegrasyon-promptu.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function rotateKey(integration: WebsiteIntegration) {
    if (
      !window.confirm(
        "Eski API anahtarı hemen geçersiz olacak. Yeni anahtar oluşturulsun mu?",
      )
    ) {
      return;
    }
    setRotating(integration.id);
    try {
      const response = await fetch("/api/fabrika/website-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rotate_key", id: integration.id }),
      });
      const data = (await response.json()) as {
        oneTimeApiKey?: string;
        codexPrompt?: string;
        error?: string;
      };
      if (!response.ok || !data.oneTimeApiKey || !data.codexPrompt) {
        throw new Error(data.error || "API anahtarı yenilenemedi.");
      }
      setCredentials({
        oneTimeApiKey: data.oneTimeApiKey,
        codexPrompt: data.codexPrompt,
      });
      await loadIntegrations();
      toast.success("Yeni API anahtarı oluşturuldu.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "API anahtarı yenilenemedi.",
      );
    } finally {
      setRotating(null);
    }
  }

  function editPrompt(integration: WebsiteIntegration) {
    setEditingPromptId(integration.id);
    setPromptDraft(integration.promptTemplate);
  }

  async function savePrompt(integration: WebsiteIntegration) {
    if (promptDraft.trim().length < 120) {
      toast.error("Codex promptu en az 120 karakter olmalıdır.");
      return;
    }
    setSavingPrompt(true);
    try {
      const response = await fetch("/api/fabrika/website-integration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_prompt",
          id: integration.id,
          promptTemplate: promptDraft,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Codex promptu kaydedilemedi.");
      }
      setEditingPromptId(null);
      setPromptDraft("");
      await loadIntegrations();
      toast.success("Codex promptunun yeni sürümü kaydedildi.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Codex promptu kaydedilemedi.",
      );
    } finally {
      setSavingPrompt(false);
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
                    void copy(credentials.oneTimeApiKey, "API anahtarı")
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
                onClick={() =>
                  void copy(credentials.codexPrompt, "Codex promptu")
                }
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
                  updateField("displayName", event.target.value)
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
                  updateField("websiteUrl", event.target.value)
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
                  updateField("framework", event.target.value)
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
                  updateField("hostingProvider", event.target.value)
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
                  updateField("portfolioPath", event.target.value)
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
                  updateField("technicalContactEmail", event.target.value)
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
                updateField("repositoryUrl", event.target.value)
              }
              placeholder="https://github.com/..."
              className="mt-1.5 min-h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-400"
            />
          </label>

          <label className="block text-[11px] font-bold text-slate-300">
            Teknik notlar
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
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
                        chooseFolder(
                          Array.from(event.currentTarget.files || []),
                        )
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
              ? "Site paketi hazırlanıyor ve gönderiliyor..."
              : "Kodları, API paketini ve promptu gönder"}
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
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
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
                  {integration.lastError ? (
                    <p className="mt-3 rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-[10px] leading-4 text-rose-200">
                      {integration.lastError}
                    </p>
                  ) : null}
                  {integration.status === "APPROVED" ||
                  integration.status === "DELIVERED" ? (
                    <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-3">
                      <p className="flex items-center gap-2 text-[10px] font-black text-emerald-200">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Kalite kontrolden geçen teslim paketi hazır
                      </p>
                      <p className="mt-1 text-[9px] leading-4 text-emerald-100/70">
                        {integration.versions[0]?.resultFileName ||
                          "Onaylı site paketi"}
                        {integration.versions[0]?.resultSha256
                          ? ` · SHA-256 ${integration.versions[0].resultSha256.slice(0, 12)}…`
                          : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a
                          href={`/api/fabrika/website-integration/${integration.id}/download`}
                          className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-300 px-3 text-[10px] font-black text-slate-950"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Tamamlanmış ZIP’i indir
                        </a>
                        {integration.finalUrl ? (
                          <a
                            href={integration.finalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-400/30 px-3 text-[10px] font-bold text-emerald-100"
                          >
                            Yayındaki siteyi aç
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-[10px] leading-4 text-slate-400">
                      Tamamlanmış ZIP yalnız admin kalite kontrolünden sonra burada görünür.
                    </p>
                  )}
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-1.5 text-[10px] font-black text-slate-200">
                          <History className="h-3.5 w-3.5 text-cyan-300" />
                          Codex entegrasyon promptu
                        </p>
                        <p className="mt-1 text-[9px] text-slate-500">
                          {integration.promptVersions[0]
                            ? `Sürüm ${integration.promptVersions[0].version} · ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(integration.promptVersions[0].createdAt))}`
                            : "İlk sürüm hazırlanıyor"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => editPrompt(integration)}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 text-[9px] font-bold text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200"
                      >
                        <PencilLine className="h-3 w-3" /> Düzenle
                      </button>
                    </div>
                    {editingPromptId === integration.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={promptDraft}
                          onChange={(event) =>
                            setPromptDraft(event.target.value)
                          }
                          rows={12}
                          aria-label={`${integration.displayName} Codex promptu`}
                          className="w-full resize-y rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-[10px] leading-5 text-slate-200 outline-none focus:border-cyan-400"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingPromptId(null)}
                            className="min-h-9 rounded-lg border border-slate-700 px-3 text-[10px] font-bold text-slate-300"
                          >
                            Vazgeç
                          </button>
                          <button
                            type="button"
                            onClick={() => void savePrompt(integration)}
                            disabled={savingPrompt}
                            className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-cyan-300 px-3 text-[10px] font-black text-slate-950 disabled:opacity-60"
                          >
                            {savingPrompt ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Yeni sürümü kaydet
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {integration.promptVersions.length > 1 ? (
                      <details className="mt-3 border-t border-slate-800 pt-2 text-[9px] text-slate-400">
                        <summary className="cursor-pointer font-bold text-slate-300">
                          Sürüm geçmişini göster (
                          {integration.promptVersions.length})
                        </summary>
                        <ol className="mt-2 space-y-1.5">
                          {integration.promptVersions.map((version) => (
                            <li
                              key={version.id}
                              className="flex items-center justify-between gap-3 rounded-md bg-slate-950/70 px-2 py-1.5"
                            >
                              <span>
                                Sürüm {version.version} · {version.source}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  void copy(
                                    version.promptTemplate,
                                    `Prompt sürüm ${version.version}`,
                                  )
                                }
                                className="font-bold text-cyan-300"
                              >
                                Kopyala
                              </button>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                  </div>
                  {integration.status === "APPROVED" ||
                  integration.status === "DELIVERED" ? (
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
                      Production API anahtarını yenile
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
