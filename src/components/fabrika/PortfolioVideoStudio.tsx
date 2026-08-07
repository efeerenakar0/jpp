"use client";

import { Player } from "@remotion/player";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  Download,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { LocalRuleCreativeDirector } from "@/lib/portfolio-video/creative-director";
import {
  createPortfolioVideoPlanFingerprint,
} from "@/lib/portfolio-video/plan-diversity";
import {
  initialPortfolioVideoRenderState,
  portfolioVideoRenderReducer,
  shouldRequestFreshPortfolioVideoPlan,
  toPortfolioVideoRenderError,
} from "@/lib/portfolio-video/render-state";
import { buildPortfolioStoryboard } from "@/lib/portfolio-video/storyboard";
import {
  portfolioVideoCatalogSchema,
  portfolioVideoStoryboardSchema,
  type PortfolioVideoCreativeChoice,
  type PortfolioVideoPortfolio,
  type PortfolioVideoStoryboard,
} from "@/lib/portfolio-video/types";
import { PortfolioPromoVideo } from "@/remotion/portfolio-video/PortfolioPromoVideo";
import {
  PORTFOLIO_PROMO_VIDEO_DURATION,
  PORTFOLIO_PROMO_VIDEO_FPS,
  PORTFOLIO_PROMO_VIDEO_HEIGHT,
  PORTFOLIO_PROMO_VIDEO_ID,
  PORTFOLIO_PROMO_VIDEO_WIDTH,
} from "@/remotion/portfolio-video/constants";
import styles from "./PortfolioVideoStudio.module.css";

const STYLE_OPTIONS: Array<{
  id: PortfolioVideoCreativeChoice;
  label: string;
  command: string;
  description: string;
}> = [
  {
    id: "BOLD",
    label: "Dikkat çekici",
    command: "Dikkat çekici ve enerjik yap",
    description: "Hızlı kesmeler ve güçlü vurgu",
  },
  {
    id: "CINEMATIC",
    label: "Lüks",
    command: "Lüks ve sinematik olsun",
    description: "Zarif akış ve editoryal görünüm",
  },
  {
    id: "FAMILY",
    label: "Aile",
    command: "Ailelere hitap etsin",
    description: "Sıcak ve yaşam odaklı",
  },
  {
    id: "INVESTMENT",
    label: "Yatırım",
    command: "Yatırım fırsatını ve getiriyi öne çıkar",
    description: "Fiyat ve veri odaklı",
  },
  {
    id: "MINIMAL",
    label: "Minimal",
    command: "Sade ve minimal olsun",
    description: "Az efektli ve temiz",
  },
  {
    id: "CUSTOM",
    label: "Özel",
    command: "",
    description: "Sahne sırasını kendiniz tarif edin",
  },
];

const directResponseSchema = z.object({
  success: z.literal(true),
  storyboard: portfolioVideoStoryboardSchema,
  fingerprint: z.string().min(1).max(80),
  seed: z.number().int().nonnegative(),
  director: z.object({
    source: z.string().max(80),
    usedFallback: z.boolean(),
    diversified: z.boolean().optional(),
  }),
});

const browserVideoJobSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  title: z.string().min(1),
  status: z.enum([
    "QUEUED",
    "SUBMITTING",
    "GENERATING",
    "PERSISTING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
  ]),
  progress: z.number().min(0).max(100),
  fingerprint: z.string().nullable(),
  seed: z.number().int().nullable(),
  outputFileName: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.coerce.date(),
});

const browserVideoJobsResponseSchema = z.object({
  jobs: z.array(browserVideoJobSchema),
});

type BrowserVideoJob = z.infer<typeof browserVideoJobSchema>;

type LocalVideoWork = {
  id: string;
  propertyId: string;
  createdAt: string;
  title: string;
  fingerprint: string;
  seed: number;
  status: BrowserVideoJob["status"];
  downloadUrl: string | null;
  error: string | null;
};

const FINGERPRINT_STORAGE_KEY = "business-ceo-ai:portfolio-video:fingerprints";

function readFingerprints() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FINGERPRINT_STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string").slice(-12)
      : [];
  } catch {
    return [];
  }
}

function saveFingerprint(value: string) {
  const next = [...new Set([...readFingerprints(), value])].slice(-12);
  window.localStorage.setItem(FINGERPRINT_STORAGE_KEY, JSON.stringify(next));
}

function createSeed() {
  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return (values[0] ?? Date.now()) & 0x7fffffff;
}

function fileNameFor(portfolio: PortfolioVideoPortfolio) {
  const safe = portfolio.title
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70)
    .toLowerCase();
  return `${safe || "portfoy"}-tanitim.mp4`;
}

function formatRemainingTime(value: number | null) {
  if (!value || !Number.isFinite(value)) return null;
  const seconds = Math.max(1, Math.round(value / 1000));
  if (seconds < 60) return `Yaklaşık ${seconds} sn`;
  return `Yaklaşık ${Math.ceil(seconds / 60)} dk`;
}

async function fetchPortfolioVideoCatalog() {
  const response = await fetch("/api/fabrika/studio/video/portfolios", {
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (!response.ok || !data || typeof data !== "object") {
    throw new Error("Portföyler yüklenemedi.");
  }
  const payload = data as { success?: unknown; error?: unknown; portfolios?: unknown };
  if (payload.success !== true) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "Portföyler yüklenemedi.",
    );
  }
  return portfolioVideoCatalogSchema.parse({ portfolios: payload.portfolios });
}

async function fetchBrowserVideoJobs() {
  const response = await fetch("/api/fabrika/studio/video/browser-jobs", {
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (!response.ok) throw new Error("Video geçmişi yüklenemedi.");
  return browserVideoJobsResponseSchema.parse(data).jobs;
}

async function updateBrowserVideoJob(
  jobId: string,
  input: {
    stage:
      | "CHECKING"
      | "RENDERING"
      | "ENCODING"
      | "COMPLETED"
      | "FAILED"
      | "CANCELLED";
    progress: number;
    outputFileName?: string;
    outputMimeType?: "video/mp4";
    outputByteSize?: number;
    errorMessage?: string;
  },
) {
  const response = await fetch(
    `/api/fabrika/studio/video/browser-jobs/${encodeURIComponent(jobId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) throw new Error("Video iş durumu kaydedilemedi.");
}

function videoWorkStatusLabel(status: LocalVideoWork["status"]) {
  if (status === "COMPLETED") return "Hazır";
  if (status === "FAILED") return "Başarısız";
  if (status === "CANCELLED") return "İptal edildi";
  if (status === "EXPIRED") return "Süresi doldu";
  return "İşleniyor";
}

export default function PortfolioVideoStudio() {
  const director = useMemo(() => new LocalRuleCreativeDirector(), []);
  const [portfolios, setPortfolios] = useState<PortfolioVideoPortfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [command, setCommand] = useState("Dikkat çekici ve enerjik yap");
  const [creativeChoice, setCreativeChoice] =
    useState<PortfolioVideoCreativeChoice>("BOLD");
  const [showPrice, setShowPrice] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [directedStoryboard, setDirectedStoryboard] =
    useState<PortfolioVideoStoryboard | null>(null);
  const [activeFingerprint, setActiveFingerprint] = useState("");
  const [activeSeed, setActiveSeed] = useState(0);
  const [directorStatus, setDirectorStatus] = useState<{
    status: "IDLE" | "LOADING" | "SUCCESS" | "ERROR";
    error: string;
    source: string;
    diversified: boolean;
  }>({ status: "IDLE", error: "", source: "", diversified: false });
  const [renderState, dispatchRender] = useReducer(
    portfolioVideoRenderReducer,
    initialPortfolioVideoRenderState,
  );
  const [works, setWorks] = useState<LocalVideoWork[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeServerJobIdRef = useRef<string | null>(null);
  const downloadUrlsRef = useRef<Set<string>>(new Set());
  const commandInputRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedPortfolio = useMemo(
    () =>
      portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null,
    [portfolios, selectedPortfolioId],
  );

  const direction = useMemo(
    () =>
      director.direct({
        command,
        preferredStyle: creativeChoice === "CUSTOM" ? undefined : creativeChoice,
      }),
    [command, creativeChoice, director],
  );

  const localStoryboard = useMemo(() => {
    if (!selectedPortfolio) return null;
    return buildPortfolioStoryboard({
      portfolio: selectedPortfolio,
      direction,
      selectedPhotoIds,
      showPrice: showPrice && direction.showPrice,
      showLocation,
    });
  }, [direction, selectedPhotoIds, selectedPortfolio, showLocation, showPrice]);

  const storyboard = directedStoryboard ?? localStoryboard;
  const selectedPhotos = selectedPhotoIds
    .map((id) => selectedPortfolio?.photos.find((photo) => photo.id === id))
    .filter(Boolean) as NonNullable<PortfolioVideoPortfolio["photos"][number]>[];
  const isRendering = ["CHECKING", "RENDERING"].includes(renderState.status);

  const retryCatalog = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const [parsed, savedJobs] = await Promise.all([
        fetchPortfolioVideoCatalog(),
        fetchBrowserVideoJobs(),
      ]);
      setPortfolios(parsed.portfolios);
      const first = parsed.portfolios[0];
      setSelectedPortfolioId(first?.id ?? "");
      setSelectedPhotoIds(first?.photos.slice(0, 6).map((photo) => photo.id) ?? []);
      setWorks(
        savedJobs.map((job) => ({
          id: job.id,
          propertyId: job.propertyId,
          createdAt: job.createdAt.toISOString(),
          title: job.title,
          fingerprint: job.fingerprint || "",
          seed: job.seed || 0,
          status: job.status,
          downloadUrl: null,
          error: job.errorMessage,
        })),
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Portföyler yüklenemedi.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void retryCatalog(), 0);
    return () => window.clearTimeout(timer);
  }, [retryCatalog]);

  useEffect(() => {
    const downloadUrls = downloadUrlsRef.current;
    return () => {
      abortControllerRef.current?.abort();
      for (const url of downloadUrls) URL.revokeObjectURL(url);
      downloadUrls.clear();
    };
  }, []);

  function clearDirectedStoryboard() {
    setDirectedStoryboard(null);
    setActiveFingerprint("");
    setActiveSeed(0);
    setDirectorStatus({
      status: "IDLE",
      error: "",
      source: "",
      diversified: false,
    });
    dispatchRender({ type: "RESET" });
  }

  function chooseStyle(option: (typeof STYLE_OPTIONS)[number]) {
    clearDirectedStoryboard();
    setCreativeChoice(option.id);
    setCommand(option.command);
    if (option.id === "CUSTOM") {
      requestAnimationFrame(() => commandInputRef.current?.focus());
    }
  }

  function selectPortfolio(portfolioId: string) {
    const portfolio = portfolios.find((item) => item.id === portfolioId);
    setSelectedPortfolioId(portfolioId);
    setSelectedPhotoIds(portfolio?.photos.slice(0, 6).map((photo) => photo.id) ?? []);
    clearDirectedStoryboard();
  }

  function togglePhoto(photoId: string) {
    clearDirectedStoryboard();
    setSelectedPhotoIds((current) => {
      if (current.includes(photoId)) return current.filter((id) => id !== photoId);
      if (current.length >= 8) return current;
      return [...current, photoId];
    });
  }

  function movePhoto(photoId: string, directionValue: -1 | 1) {
    clearDirectedStoryboard();
    setSelectedPhotoIds((current) => {
      const index = current.indexOf(photoId);
      const target = index + directionValue;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function applyCreativeDirection() {
    if (!selectedPortfolio || selectedPhotoIds.length === 0 || command.trim().length < 3) {
      setDirectorStatus({
        status: "ERROR",
        error: "Önce bir portföy, en az bir fotoğraf ve yaratıcı talimat seçin.",
        source: "",
        diversified: false,
      });
      return null;
    }
    setDirectorStatus({
      status: "LOADING",
      error: "",
      source: "",
      diversified: false,
    });
    const seed = createSeed();
    try {
      const response = await fetch("/api/fabrika/studio/video/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: selectedPortfolio.id,
          command,
          ...(creativeChoice === "CUSTOM" ? {} : { preferredStyle: creativeChoice }),
          selectedPhotoIds,
          showPrice,
          showLocation,
          seed,
          previousFingerprints: readFingerprints(),
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Yaratıcı talimat videoya uygulanamadı.";
        throw new Error(message);
      }
      const parsed = directResponseSchema.parse(data);
      setDirectedStoryboard(parsed.storyboard);
      setActiveFingerprint(parsed.fingerprint);
      setActiveSeed(parsed.seed);
      setDirectorStatus({
        status: "SUCCESS",
        error: "",
        source: parsed.director.source,
        diversified: Boolean(parsed.director.diversified),
      });
      saveFingerprint(parsed.fingerprint);
      dispatchRender({ type: "RESET" });
      return parsed.storyboard;
    } catch (error) {
      setDirectorStatus({
        status: "ERROR",
        error:
          error instanceof z.ZodError
            ? "Video planı güvenlik doğrulamasından geçemedi. Yeniden deneyin."
            : error instanceof Error
              ? error.message
              : "Yaratıcı talimat videoya uygulanamadı.",
        source: "",
        diversified: false,
      });
      return null;
    }
  }

  async function renderVideo(options: { forceNewVariation?: boolean } = {}) {
    const requestFreshPlan = shouldRequestFreshPortfolioVideoPlan({
      hasDirectedStoryboard: Boolean(directedStoryboard),
      forceNewVariation: Boolean(options.forceNewVariation),
    });
    const renderStoryboard = requestFreshPlan
      ? await applyCreativeDirection()
      : directedStoryboard;
    if (!renderStoryboard || !selectedPortfolio || selectedPhotoIds.length === 0) return;
    const fingerprint =
      activeFingerprint ||
      createPortfolioVideoPlanFingerprint({
        summary: renderStoryboard.planSummary,
        seed: renderStoryboard.seed,
        palette: renderStoryboard.palette,
        typography: renderStoryboard.typography,
        scenes: renderStoryboard.scenes.map((scene) => ({
          id: scene.id,
          type: scene.type,
          durationInFrames: scene.toFrame - scene.fromFrame,
          photoIndices: scene.photoIndices,
          layout: scene.layout,
          transition: scene.transition,
          photoMotion: scene.photoMotion,
          headline: scene.headline,
          body: scene.body,
          overlays: scene.overlays,
        })),
      });
    const seed = activeSeed || renderStoryboard.seed;
    dispatchRender({ type: "CHECK" });
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let workId = "";
    try {
      const createResponse = await fetch(
        "/api/fabrika/studio/video/browser-jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: selectedPortfolio.id,
            mediaIds: selectedPhotoIds,
            command,
            storyboard: renderStoryboard,
            fingerprint,
            seed,
            idempotencyKey: `browser:${selectedPortfolio.id}:${window.crypto.randomUUID()}`,
          }),
        },
      );
      const created: unknown = await createResponse.json();
      if (!createResponse.ok || !created || typeof created !== "object" || !("job" in created)) {
        throw new Error("Video işi güvenli geçmişe kaydedilemedi.");
      }
      const serverJob = browserVideoJobSchema.parse(created.job);
      workId = serverJob.id;
      activeServerJobIdRef.current = serverJob.id;
      await updateBrowserVideoJob(serverJob.id, {
        stage: "CHECKING",
        progress: 0,
      });
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import(
        "@remotion/web-renderer"
      );
      const support = await canRenderMediaOnWeb({
        container: "mp4",
        videoCodec: "h264",
        audioCodec: null,
        width: PORTFOLIO_PROMO_VIDEO_WIDTH,
        height: PORTFOLIO_PROMO_VIDEO_HEIGHT,
        muted: true,
      });
      if (!support.canRender) {
        throw new Error(support.issues.map((issue) => issue.message).join("; "));
      }
      if (controller.signal.aborted) {
        throw new DOMException("Render iptal edildi.", "AbortError");
      }
      dispatchRender({ type: "START" });
      await updateBrowserVideoJob(serverJob.id, {
        stage: "RENDERING",
        progress: 1,
      });
      let lastPersistedProgress = 1;
      const result = await renderMediaOnWeb({
        composition: {
          id: PORTFOLIO_PROMO_VIDEO_ID,
          component: PortfolioPromoVideo,
          defaultProps: { storyboard: renderStoryboard },
          durationInFrames: PORTFOLIO_PROMO_VIDEO_DURATION,
          fps: PORTFOLIO_PROMO_VIDEO_FPS,
          width: PORTFOLIO_PROMO_VIDEO_WIDTH,
          height: PORTFOLIO_PROMO_VIDEO_HEIGHT,
        },
        inputProps: { storyboard: renderStoryboard },
        container: "mp4",
        videoCodec: "h264",
        audioCodec: null,
        muted: true,
        pageResponsiveness: "medium",
        signal: controller.signal,
        onProgress: ({ progress, renderEstimatedTime }) => {
          dispatchRender({
            type: "PROGRESS",
            progress,
            estimatedTimeMs: renderEstimatedTime,
          });
          const percent = Math.min(94, Math.max(1, Math.round(progress * 100)));
          if (percent >= lastPersistedProgress + 10) {
            lastPersistedProgress = percent;
            void updateBrowserVideoJob(serverJob.id, {
              stage: "RENDERING",
              progress: percent,
            }).catch(() => undefined);
          }
        },
      });
      let blob: Blob;
      try {
        await updateBrowserVideoJob(serverJob.id, {
          stage: "ENCODING",
          progress: 95,
        });
        blob = await result.getBlob();
      } finally {
        result.internalState[Symbol.dispose]();
      }
      if (controller.signal.aborted) {
        throw new DOMException("Render iptal edildi.", "AbortError");
      }
      const downloadUrl = URL.createObjectURL(blob);
      downloadUrlsRef.current.add(downloadUrl);
      const outputFileName = fileNameFor(selectedPortfolio);
      await updateBrowserVideoJob(serverJob.id, {
        stage: "COMPLETED",
        progress: 100,
        outputFileName,
        outputMimeType: "video/mp4",
        outputByteSize: blob.size,
      });
      dispatchRender({ type: "SUCCESS", downloadUrl });
      setWorks((current) => [
        {
          id: workId,
          propertyId: selectedPortfolio.id,
          createdAt: new Date().toISOString(),
          title: selectedPortfolio.title,
          fingerprint,
          seed,
          status: "COMPLETED",
          downloadUrl,
          error: null,
        },
        ...current.filter((item) => item.downloadUrl !== downloadUrl).slice(0, 5),
      ]);
    } catch (error) {
      const cancelled =
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError");
      if (cancelled) {
        if (workId) {
          await updateBrowserVideoJob(workId, {
            stage: "CANCELLED",
            progress: 0,
          }).catch(() => undefined);
        }
        dispatchRender({ type: "CANCEL" });
      } else {
        const message = toPortfolioVideoRenderError(error);
        if (workId) {
          await updateBrowserVideoJob(workId, {
            stage: "FAILED",
            progress: 0,
            errorMessage: message,
          }).catch(() => undefined);
        }
        dispatchRender({ type: "ERROR", error: message });
        setWorks((current) => [
          {
            id: workId,
            propertyId: selectedPortfolio.id,
            createdAt: new Date().toISOString(),
            title: selectedPortfolio.title,
            fingerprint: activeFingerprint,
            seed: activeSeed,
            status: "FAILED",
            downloadUrl: null,
            error: message,
          },
          ...current.slice(0, 5),
        ]);
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
      if (activeServerJobIdRef.current === workId) activeServerJobIdRef.current = null;
    }
  }

  function cancelRender() {
    abortControllerRef.current?.abort();
    dispatchRender({ type: "CANCEL" });
  }

  if (isLoading) {
    return (
      <div className={styles.loadingPanel} role="status">
        <Loader2 aria-hidden="true" /> Portföyler hazırlanıyor…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.errorPanel} role="alert">
        <b>Video stüdyosu açılamadı</b>
        <span>{loadError}</span>
        <button type="button" onClick={() => void retryCatalog()}>
          <RotateCcw /> Yeniden dene
        </button>
      </div>
    );
  }

  if (!portfolios.length) {
    return (
      <div className={styles.emptyPanel}>
        <Film aria-hidden="true" />
        <h2>Önce bir portföy ekleyin</h2>
        <p>Video oluşturmak için şirket hesabınızda bir portföy bulunmalıdır.</p>
        <a href="/fabrika/portfoyler">Portföylere git</a>
      </div>
    );
  }

  return (
    <section className={styles.videoStudio} aria-labelledby="portfolio-video-title">
      <header className={styles.videoHeader}>
        <div>
          <span>
            <Clapperboard aria-hidden="true" /> Güvenli Remotion planı
          </span>
          <h2 id="portfolio-video-title">Portföy Video Stüdyosu</h2>
          <p>
            Türkçe talimatınız sahne sırası, zamanlama, hareket, renk ve tipografiye
            dönüştürülür. Serbest kod çalıştırılmaz.
          </p>
        </div>
        <div className={styles.specs} aria-label="Video teknik özellikleri">
          <span>9:16</span>
          <span>1080p</span>
          <span>15 sn</span>
        </div>
      </header>

      <div className={styles.workspaceGrid}>
        <div className={styles.controlsColumn}>
          <section className={styles.card}>
            <div className={styles.sectionTitle}>
              <span>1</span>
              <div>
                <h3>Portföyü seçin</h3>
                <p>Yalnızca şirket hesabınızdaki kayıtlar listelenir.</p>
              </div>
            </div>
            <label className={styles.fieldLabel} htmlFor="video-portfolio">
              Portföy
            </label>
            <select
              id="video-portfolio"
              className={styles.select}
              value={selectedPortfolioId}
              onChange={(event) => selectPortfolio(event.target.value)}
            >
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.title}
                </option>
              ))}
            </select>
            {selectedPortfolio && (
              <div className={styles.portfolioSummary}>
                <div>
                  <b>{selectedPortfolio.title}</b>
                  <span>
                    <MapPin /> {selectedPortfolio.location || "Konum belirtilmedi"}
                  </span>
                </div>
                <small>{selectedPortfolio.photos.length} fotoğraf</small>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionTitle}>
              <span>2</span>
              <div>
                <h3>Yaratıcı yönü belirleyin</h3>
                <p>Hazır bir başlangıç seçin veya videoyu sahne sahne tarif edin.</p>
              </div>
            </div>
            <div className={styles.styleGrid} role="group" aria-label="Video stili">
              {STYLE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={creativeChoice === option.id ? styles.styleActive : undefined}
                  aria-pressed={creativeChoice === option.id}
                  onClick={() => chooseStyle(option)}
                >
                  <b>{option.label}</b>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
            <label className={styles.fieldLabel} htmlFor="video-command">
              {creativeChoice === "CUSTOM" ? "Özel yaratıcı talimatınız" : "Video komutu"}
            </label>
            <textarea
              ref={commandInputRef}
              id="video-command"
              className={styles.command}
              value={command}
              maxLength={1000}
              rows={5}
              onChange={(event) => {
                clearDirectedStoryboard();
                setCommand(event.target.value);
                setCreativeChoice("CUSTOM");
              }}
              placeholder="Örn. İlk fotoğrafla sakin başla, fiyat bir anda belirsin; diğer fotoğraflara geç ve finalde Instagram adresini animasyonla göster."
            />
            <div className={styles.commandMeta}>
              <span>
                <Sparkles /> Komut güvenli bir VideoPlan JSON’una dönüştürülür
              </span>
              <small>{command.length}/1000</small>
            </div>
            <div className={styles.toggles}>
              <label>
                <input
                  type="checkbox"
                  checked={showPrice && direction.showPrice}
                  disabled={!direction.showPrice}
                  onChange={(event) => {
                    clearDirectedStoryboard();
                    setShowPrice(event.target.checked);
                  }}
                />
                Fiyatı göster
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(event) => {
                    clearDirectedStoryboard();
                    setShowLocation(event.target.checked);
                  }}
                />
                Konumu göster
              </label>
            </div>
            <div className={styles.directorPanel}>
              <p>
                Her üretimde yeni seed kullanılır. Aynı sahne dizilimi tekrar ederse
                planın paleti, hareketi ve fotoğraf sırası güvenli biçimde çeşitlendirilir.
              </p>
              <button
                type="button"
                disabled={directorStatus.status === "LOADING" || selectedPhotoIds.length === 0}
                onClick={() => void applyCreativeDirection()}
              >
                {directorStatus.status === "LOADING" ? (
                  <Loader2 className={styles.spin} />
                ) : (
                  <Sparkles />
                )}
                {directedStoryboard ? "Yeni plan üret" : "Video planını hazırla"}
              </button>
            </div>
            {directorStatus.status === "ERROR" && (
              <div className={styles.directorError} role="alert">
                {directorStatus.error}
              </div>
            )}
            {directorStatus.status === "SUCCESS" && storyboard && (
              <div className={styles.planPreview} aria-live="polite">
                <b>Plan hazır · {storyboard.scenes.length} sahne</b>
                <span>
                  {storyboard.planSummary} · {storyboard.palette.replaceAll("_", " ")}
                </span>
                <ol>
                  {storyboard.scenes.map((scene, index) => (
                    <li key={scene.id}>
                      <span>{index + 1}</span>
                      <div>
                        <b>{scene.type}</b>
                        <small>
                          {((scene.toFrame - scene.fromFrame) / storyboard.fps).toFixed(1)} sn · {scene.transition} · {scene.photoMotion}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionTitle}>
              <span>3</span>
              <div>
                <h3>Fotoğrafları seçin ve sıralayın</h3>
                <p>En fazla sekiz fotoğraf. Sıra videodaki akışı belirler.</p>
              </div>
            </div>
            {selectedPortfolio?.photos.length ? (
              <>
                <div className={styles.photoGrid}>
                  {selectedPortfolio.photos.map((photo) => {
                    const selectedIndex = selectedPhotoIds.indexOf(photo.id);
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        aria-pressed={selectedIndex >= 0}
                        onClick={() => togglePhoto(photo.id)}
                      >
                        {/* Tenant media URLs intentionally use native image preview. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photo.fileName} />
                        {selectedIndex >= 0 && (
                          <span>
                            {selectedIndex + 1}
                            <Check />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <ol className={styles.photoOrder} aria-label="Seçilen fotoğraf sırası">
                  {selectedPhotos.map((photo, index) => (
                    <li key={photo.id}>
                      <span>{index + 1}</span>
                      <div>
                        <ImageIcon /> <b>{photo.fileName}</b>
                      </div>
                      <div>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => movePhoto(photo.id, -1)}
                          aria-label={`${photo.fileName} yukarı taşı`}
                        >
                          <ArrowUp />
                        </button>
                        <button
                          type="button"
                          disabled={index === selectedPhotos.length - 1}
                          onClick={() => movePhoto(photo.id, 1)}
                          aria-label={`${photo.fileName} aşağı taşı`}
                        >
                          <ArrowDown />
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePhoto(photo.id)}
                          aria-label={`${photo.fileName} seçimini kaldır`}
                        >
                          <X />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <div className={styles.noPhotos}>
                <ImageIcon />
                <p>Bu portföyde kullanılabilir fotoğraf yok.</p>
              </div>
            )}
          </section>
        </div>

        <aside className={styles.previewColumn}>
          <section className={styles.previewCard}>
            <div className={styles.previewTitle}>
              <div>
                <h3>Canlı önizleme</h3>
                <p>Plan değiştikçe sahne yapısı ve görsel yön de değişir.</p>
              </div>
              <span>{storyboard?.palette.replaceAll("_", " ") || direction.style}</span>
            </div>
            <div className={styles.playerFrame}>
              {storyboard && (
                <Player
                  component={PortfolioPromoVideo}
                  inputProps={{ storyboard }}
                  durationInFrames={PORTFOLIO_PROMO_VIDEO_DURATION}
                  fps={PORTFOLIO_PROMO_VIDEO_FPS}
                  compositionWidth={PORTFOLIO_PROMO_VIDEO_WIDTH}
                  compositionHeight={PORTFOLIO_PROMO_VIDEO_HEIGHT}
                  controls
                  loop
                  initiallyMuted
                  acknowledgeRemotionLicense
                  style={{ width: "100%", height: "100%" }}
                />
              )}
            </div>
          </section>

          <section className={styles.renderCard}>
            <div className={styles.renderHeading}>
              <Film />
              <div>
                <h3>MP4 oluştur</h3>
                <p>
                  Render tarayıcınızda çalışır. Sekmeyi açık tutarken diğer panel
                  alanlarını kullanabilirsiniz.
                </p>
              </div>
            </div>
            {renderState.status !== "IDLE" && (
              <div className={styles.renderStatus} aria-live="polite">
                {renderState.status === "ERROR" ? (
                  <div className={styles.renderError} role="alert">
                    <b>Video oluşturulamadı</b>
                    <span>{renderState.error}</span>
                  </div>
                ) : renderState.status === "CANCELLED" ? (
                  <div className={styles.renderCancelled}>İşlem iptal edildi. Ayarlarınız korunuyor.</div>
                ) : renderState.status === "SUCCESS" ? (
                  <div className={styles.renderSuccess}>
                    <Check /> Video hazır. MP4 dosyasını indirebilirsiniz.
                  </div>
                ) : (
                  <>
                    <div className={styles.progressLabels}>
                      <span>
                        {renderState.status === "CHECKING"
                          ? "Tarayıcı kontrol ediliyor…"
                          : renderState.progress > 0.92
                            ? "MP4 kodlanıyor…"
                            : "Sahneler render ediliyor…"}
                      </span>
                      <b>{Math.round(renderState.progress * 100)}%</b>
                    </div>
                    <div
                      className={styles.progressTrack}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(renderState.progress * 100)}
                    >
                      <span style={{ width: `${renderState.progress * 100}%` }} />
                    </div>
                    {formatRemainingTime(renderState.estimatedTimeMs) && (
                      <small>{formatRemainingTime(renderState.estimatedTimeMs)}</small>
                    )}
                  </>
                )}
              </div>
            )}
            <div className={styles.renderActions}>
              {isRendering ? (
                <button type="button" className={styles.cancelButton} onClick={cancelRender}>
                  <Square /> İptal et
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.renderButton}
                  disabled={selectedPhotoIds.length === 0 || directorStatus.status === "LOADING"}
                  onClick={() =>
                    void renderVideo({
                      forceNewVariation: renderState.status === "SUCCESS",
                    })
                  }
                >
                  {renderState.status === "SUCCESS" ? <RotateCcw /> : <Clapperboard />}
                  {renderState.status === "SUCCESS" ? "Yeni varyasyon oluştur" : "Planla ve MP4 oluştur"}
                </button>
              )}
              {renderState.status === "SUCCESS" && renderState.downloadUrl && selectedPortfolio && (
                <a
                  className={styles.downloadButton}
                  href={renderState.downloadUrl}
                  download={fileNameFor(selectedPortfolio)}
                >
                  <Download /> MP4 indir
                </a>
              )}
            </div>
          </section>

          <section className={`${styles.renderCard} ${styles.aiHistory}`}>
            <div className={styles.renderHeading}>
              <Clapperboard />
              <div>
                <h3>Eski çalışmalarım</h3>
                <p>İş durumu hesabınızda saklanır; MP4 dosyası yalnız oluşturulduğu cihazda indirilebilir.</p>
              </div>
            </div>
            {works.length ? (
              <div className={styles.aiHistoryList}>
                {works.map((work) => (
                  <div key={work.id} className={styles.localHistoryItem}>
                    <span>
                      <b>{work.title}</b>
                      <small>
                        {new Date(work.createdAt).toLocaleTimeString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })} · {videoWorkStatusLabel(work.status)}
                      </small>
                    </span>
                    {work.downloadUrl ? (
                      <a href={work.downloadUrl} download="portfoy-tanitim.mp4" aria-label={`${work.title} videosunu indir`}>
                        <Download />
                      </a>
                    ) : work.status === "FAILED" || work.status === "CANCELLED" ? (
                      <small>Ayarları seçip yeniden oluşturun</small>
                    ) : (
                      <small>Bu cihazda dosya yok</small>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.aiEmptyState}>
                <Film />
                <p>İlk videonuz hazır olduğunda burada görünecek.</p>
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
