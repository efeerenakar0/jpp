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
import { LocalRuleCreativeDirector } from "@/lib/portfolio-video/creative-director";
import {
  initialPortfolioVideoRenderState,
  portfolioVideoRenderReducer,
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
    description: "Hızlı ve güçlü",
  },
  {
    id: "CINEMATIC",
    label: "Lüks",
    command: "Lüks ve sinematik olsun",
    description: "Zarif ve yavaş",
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
    description: "Fiyat ve getiri odaklı",
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
    description: "Aklınızdaki fikri yazın",
  },
];

type StudioMode = "QUICK_TEMPLATE" | "AI_CINEMATIC";

type AiVideoJobStatus =
  | "QUEUED"
  | "SUBMITTING"
  | "GENERATING"
  | "PERSISTING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

type AiVideoJob = {
  id: string;
  propertyId: string;
  userCommand: string;
  status: AiVideoJobStatus;
  progress: number;
  outputFileName: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  createdAt: string;
  artifactHref: string | null;
};

const ACTIVE_AI_JOB_STATUSES: AiVideoJobStatus[] = [
  "QUEUED",
  "SUBMITTING",
  "GENERATING",
  "PERSISTING",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function configuredFromResponse(value: unknown) {
  if (!isRecord(value)) return null;
  if (typeof value.configured === "boolean") return value.configured;
  if (typeof value.providerConfigured === "boolean")
    return value.providerConfigured;
  if (
    isRecord(value.readiness) &&
    typeof value.readiness.configured === "boolean"
  ) {
    return value.readiness.configured;
  }
  if (
    isRecord(value.provider) &&
    typeof value.provider.configured === "boolean"
  ) {
    return value.provider.configured;
  }
  return null;
}

function jobsFromResponse(value: unknown): AiVideoJob[] {
  if (!isRecord(value) || !Array.isArray(value.jobs)) return [];
  return value.jobs.filter(
    (job): job is AiVideoJob =>
      isRecord(job) &&
      typeof job.id === "string" &&
      typeof job.status === "string",
  );
}

function jobFromResponse(value: unknown): AiVideoJob | null {
  if (!isRecord(value) || !isRecord(value.job)) return null;
  return typeof value.job.id === "string" &&
    typeof value.job.status === "string"
    ? (value.job as AiVideoJob)
    : null;
}

function responseError(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : fallback;
}

function aiJobStatusLabel(status: AiVideoJobStatus) {
  if (status === "QUEUED") return "Sırada";
  if (status === "SUBMITTING") return "Sağlayıcıya gönderiliyor";
  if (status === "GENERATING") return "Görüntüler üretiliyor";
  if (status === "PERSISTING") return "Video güvenle kaydediliyor";
  if (status === "COMPLETED") return "Hazır";
  if (status === "FAILED") return "Oluşturulamadı";
  if (status === "CANCELLED") return "İptal edildi";
  return "Süresi doldu";
}

function formatJobDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Portföyler yüklenemedi.");
  }
  return portfolioVideoCatalogSchema.parse({ portfolios: data.portfolios });
}

export default function PortfolioVideoStudio() {
  const director = useMemo(() => new LocalRuleCreativeDirector(), []);
  const [studioMode, setStudioMode] = useState<StudioMode>("QUICK_TEMPLATE");
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
  const [directorStatus, setDirectorStatus] = useState<{
    status: "IDLE" | "LOADING" | "SUCCESS" | "ERROR";
    error: string;
    source: string;
    usedFallback: boolean;
  }>({ status: "IDLE", error: "", source: "", usedFallback: false });
  const [renderState, dispatchRender] = useReducer(
    portfolioVideoRenderReducer,
    initialPortfolioVideoRenderState,
  );
  const [aiJobs, setAiJobs] = useState<AiVideoJob[]>([]);
  const [activeAiJobId, setActiveAiJobId] = useState("");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [aiJobsLoading, setAiJobsLoading] = useState(false);
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const [aiCancelling, setAiCancelling] = useState(false);
  const [aiError, setAiError] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const downloadUrlRef = useRef<string | null>(null);
  const commandInputRef = useRef<HTMLTextAreaElement | null>(null);
  const aiSubmissionRef = useRef<{
    signature: string;
    idempotencyKey: string;
  } | null>(null);

  const selectedPortfolio = useMemo(
    () =>
      portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ??
      null,
    [portfolios, selectedPortfolioId],
  );

  const direction = useMemo(
    () =>
      director.direct({
        command,
        preferredStyle:
          creativeChoice === "CUSTOM" ? undefined : creativeChoice,
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
  const activeAiJob = useMemo(
    () => aiJobs.find((job) => job.id === activeAiJobId) ?? null,
    [activeAiJobId, aiJobs],
  );

  const loadAiJobs = useCallback(async () => {
    setAiJobsLoading(true);
    setAiError("");
    try {
      const response = await fetch("/api/fabrika/studio/video/jobs", {
        cache: "no-store",
      });
      const data: unknown = await response.json();
      if (!response.ok || (isRecord(data) && data.success === false)) {
        throw new Error(responseError(data, "AI video işleri yüklenemedi."));
      }
      const jobs = jobsFromResponse(data);
      setAiJobs(jobs);
      setActiveAiJobId((current) => {
        if (jobs.some((job) => job.id === current)) return current;
        return (
          jobs.find((job) => ACTIVE_AI_JOB_STATUSES.includes(job.status))?.id ??
          jobs[0]?.id ??
          ""
        );
      });
      const configured = configuredFromResponse(data);
      if (configured !== null) setAiConfigured(configured);
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "AI video işleri yüklenemedi.",
      );
    } finally {
      setAiJobsLoading(false);
    }
  }, []);

  function clearDirectedStoryboard() {
    setDirectedStoryboard(null);
    setDirectorStatus({
      status: "IDLE",
      error: "",
      source: "",
      usedFallback: false,
    });
  }

  async function applyCreativeDirection(): Promise<PortfolioVideoStoryboard | null> {
    if (
      !selectedPortfolio ||
      selectedPhotoIds.length === 0 ||
      command.trim().length < 3
    ) {
      setDirectorStatus({
        status: "ERROR",
        error: "Önce en az bir fotoğraf seçin ve yaratıcı talimatınızı yazın.",
        source: "",
        usedFallback: false,
      });
      return null;
    }
    setDirectorStatus({
      status: "LOADING",
      error: "",
      source: "",
      usedFallback: false,
    });
    try {
      const response = await fetch("/api/fabrika/studio/video/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: selectedPortfolio.id,
          command,
          ...(creativeChoice === "CUSTOM"
            ? {}
            : { preferredStyle: creativeChoice }),
          selectedPhotoIds,
          showPrice,
          showLocation,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Yaratıcı talimat videoya uygulanamadı.");
      }
      const nextStoryboard = portfolioVideoStoryboardSchema.parse(
        data.storyboard,
      );
      setDirectedStoryboard(nextStoryboard);
      setDirectorStatus({
        status: "SUCCESS",
        error: "",
        source: data.director?.source || "RULE_ENGINE",
        usedFallback: Boolean(data.director?.usedFallback),
      });
      dispatchRender({ type: "RESET" });
      return nextStoryboard;
    } catch (error) {
      setDirectorStatus({
        status: "ERROR",
        error:
          error instanceof Error
            ? error.message
            : "Yaratıcı talimat videoya uygulanamadı.",
        source: "",
        usedFallback: false,
      });
      return null;
    }
  }

  async function retryCatalog() {
    setIsLoading(true);
    setLoadError("");
    try {
      const parsed = await fetchPortfolioVideoCatalog();
      setPortfolios(parsed.portfolios);
      const first = parsed.portfolios[0];
      setSelectedPortfolioId(first?.id ?? "");
      setSelectedPhotoIds(
        first?.photos.slice(0, 6).map((photo) => photo.id) ?? [],
      );
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Portföyler yüklenemedi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchPortfolioVideoCatalog()
      .then((parsed) => {
        if (!active) return;
        setPortfolios(parsed.portfolios);
        const first = parsed.portfolios[0];
        setSelectedPortfolioId(first?.id ?? "");
        setSelectedPhotoIds(
          first?.photos.slice(0, 6).map((photo) => photo.id) ?? [],
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(
          error instanceof Error ? error.message : "Portföyler yüklenemedi.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (
      studioMode !== "AI_CINEMATIC" ||
      !activeAiJob ||
      !ACTIVE_AI_JOB_STATUSES.includes(activeAiJob.status)
    ) {
      return;
    }
    let active = true;
    const pollJob = async () => {
      try {
        const response = await fetch(
          `/api/fabrika/studio/video/jobs/${encodeURIComponent(activeAiJob.id)}`,
          { cache: "no-store" },
        );
        const data: unknown = await response.json();
        if (!response.ok || (isRecord(data) && data.success === false)) {
          throw new Error(responseError(data, "AI video durumu alınamadı."));
        }
        const job = jobFromResponse(data);
        if (!active || !job) return;
        setAiJobs((current) => {
          const exists = current.some((item) => item.id === job.id);
          return exists
            ? current.map((item) => (item.id === job.id ? job : item))
            : [job, ...current];
        });
        const configured = configuredFromResponse(data);
        if (configured !== null) setAiConfigured(configured);
        setAiError("");
      } catch (error) {
        if (active) {
          setAiError(
            error instanceof Error
              ? error.message
              : "AI video durumu alınamadı.",
          );
        }
      }
    };
    const interval = window.setInterval(() => void pollJob(), 6_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeAiJob, studioMode]);

  function chooseStyle(option: (typeof STYLE_OPTIONS)[number]) {
    clearDirectedStoryboard();
    setCreativeChoice(option.id);
    setCommand(option.command);
    if (option.id === "CUSTOM") {
      requestAnimationFrame(() => commandInputRef.current?.focus());
    }
  }

  function selectStudioMode(mode: StudioMode) {
    setStudioMode(mode);
    if (mode === "AI_CINEMATIC") void loadAiJobs();
  }

  function selectPortfolio(portfolioId: string) {
    const portfolio = portfolios.find((item) => item.id === portfolioId);
    setSelectedPortfolioId(portfolioId);
    setSelectedPhotoIds(
      portfolio?.photos.slice(0, 6).map((photo) => photo.id) ?? [],
    );
    clearDirectedStoryboard();
    dispatchRender({ type: "RESET" });
  }

  function togglePhoto(photoId: string) {
    clearDirectedStoryboard();
    setSelectedPhotoIds((current) => {
      if (current.includes(photoId))
        return current.filter((id) => id !== photoId);
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

  async function renderVideo() {
    let renderStoryboard = storyboard;
    if (creativeChoice === "CUSTOM" && !directedStoryboard) {
      renderStoryboard = await applyCreativeDirection();
    }
    if (
      !renderStoryboard ||
      !selectedPortfolio ||
      selectedPhotoIds.length === 0
    )
      return;
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
    dispatchRender({ type: "CHECK" });
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } =
        await import("@remotion/web-renderer");
      const support = await canRenderMediaOnWeb({
        container: "mp4",
        videoCodec: "h264",
        audioCodec: null,
        width: PORTFOLIO_PROMO_VIDEO_WIDTH,
        height: PORTFOLIO_PROMO_VIDEO_HEIGHT,
        muted: true,
      });
      if (!support.canRender) {
        throw new Error(
          support.issues
            .map((issue) => `${issue.type}: ${issue.message}`)
            .join("; "),
        );
      }
      if (controller.signal.aborted) return;
      dispatchRender({ type: "START" });
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
        },
      });
      let blob: Blob;
      try {
        blob = await result.getBlob();
      } finally {
        result.internalState[Symbol.dispose]();
      }
      if (controller.signal.aborted) return;
      const downloadUrl = URL.createObjectURL(blob);
      downloadUrlRef.current = downloadUrl;
      dispatchRender({ type: "SUCCESS", downloadUrl });
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        dispatchRender({ type: "CANCEL" });
      } else {
        dispatchRender({
          type: "ERROR",
          error: toPortfolioVideoRenderError(error),
        });
      }
    } finally {
      if (abortControllerRef.current === controller)
        abortControllerRef.current = null;
    }
  }

  function cancelRender() {
    abortControllerRef.current?.abort();
    dispatchRender({ type: "CANCEL" });
  }

  async function createAiVideo() {
    if (
      !selectedPortfolio ||
      !selectedPhotoIds.length ||
      command.trim().length < 3
    ) {
      setAiError(
        "Önce bir portföy, en az bir fotoğraf ve yaratıcı talimat seçin.",
      );
      return;
    }
    if (aiConfigured === false) {
      setAiError("AI Sinematik Video hizmeti henüz yapılandırılmadı.");
      return;
    }
    setAiSubmitting(true);
    setAiError("");
    const signature = JSON.stringify({
      propertyId: selectedPortfolio.id,
      mediaIds: selectedPhotoIds,
      command: command.trim(),
      durationSeconds: 10,
      ratio: "9:16",
      resolution: "720p",
    });
    if (aiSubmissionRef.current?.signature !== signature) {
      aiSubmissionRef.current = {
        signature,
        idempotencyKey: crypto.randomUUID(),
      };
    }
    const idempotencyKey = aiSubmissionRef.current.idempotencyKey;
    try {
      const response = await fetch("/api/fabrika/studio/video/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedPortfolio.id,
          mediaIds: selectedPhotoIds,
          command: command.trim(),
          durationSeconds: 10,
          ratio: "9:16",
          resolution: "720p",
          generateAudio: false,
          idempotencyKey,
        }),
      });
      const data: unknown = await response.json();
      const configured = configuredFromResponse(data);
      if (configured !== null) setAiConfigured(configured);
      if (!response.ok || (isRecord(data) && data.success === false)) {
        throw new Error(responseError(data, "AI video işi başlatılamadı."));
      }
      const job = jobFromResponse(data);
      if (!job)
        throw new Error("AI video işi başlatıldı ancak iş bilgisi alınamadı.");
      setAiJobs((current) => [
        job,
        ...current.filter((item) => item.id !== job.id),
      ]);
      setActiveAiJobId(job.id);
      aiSubmissionRef.current = null;
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "AI video işi başlatılamadı.",
      );
    } finally {
      setAiSubmitting(false);
    }
  }

  async function cancelAiVideo() {
    if (!activeAiJob || !ACTIVE_AI_JOB_STATUSES.includes(activeAiJob.status))
      return;
    setAiCancelling(true);
    setAiError("");
    try {
      const response = await fetch(
        `/api/fabrika/studio/video/jobs/${encodeURIComponent(activeAiJob.id)}`,
        { method: "DELETE" },
      );
      const data: unknown = await response.json();
      if (!response.ok || (isRecord(data) && data.success === false)) {
        throw new Error(responseError(data, "AI video işi iptal edilemedi."));
      }
      const job = jobFromResponse(data);
      if (job) {
        setAiJobs((current) =>
          current.map((item) => (item.id === job.id ? job : item)),
        );
      } else {
        await loadAiJobs();
      }
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : "AI video işi iptal edilemedi.",
      );
    } finally {
      setAiCancelling(false);
    }
  }

  const isRendering = ["CHECKING", "RENDERING"].includes(renderState.status);
  const isAiJobActive = activeAiJob
    ? ACTIVE_AI_JOB_STATUSES.includes(activeAiJob.status)
    : false;
  const selectedPhotos = selectedPhotoIds
    .map((id) => selectedPortfolio?.photos.find((photo) => photo.id === id))
    .filter(Boolean) as NonNullable<
    PortfolioVideoPortfolio["photos"][number]
  >[];

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
        <p>
          Video oluşturmak için şirket hesabınızda taslak veya aktif bir portföy
          bulunmalıdır.
        </p>
        <a href="/fabrika/portfoyler">Portföylere git</a>
      </div>
    );
  }

  return (
    <section
      className={styles.videoStudio}
      aria-labelledby="portfolio-video-title"
    >
      <header className={styles.videoHeader}>
        <div>
          <span>
            <Clapperboard aria-hidden="true" />{" "}
            {studioMode === "QUICK_TEMPLATE"
              ? "Tarayıcıda MP4"
              : "Üretken AI video"}
          </span>
          <h2 id="portfolio-video-title">Portföy Video Stüdyosu</h2>
          <p>
            {studioMode === "QUICK_TEMPLATE"
              ? "Portföy verilerinizden 15 saniyelik dikey tanıtım videosu hazırlayın."
              : "Fotoğraflarınızı referans alan, prompta göre değişen yeni bir video üretin."}
          </p>
        </div>
        <div className={styles.specs} aria-label="Video teknik özellikleri">
          <span>9:16</span>
          <span>{studioMode === "QUICK_TEMPLATE" ? "1080p" : "720p"}</span>
          <span>{studioMode === "QUICK_TEMPLATE" ? "15 sn" : "10 sn"}</span>
        </div>
      </header>

      <div
        className={styles.modeSwitcher}
        role="group"
        aria-label="Video oluşturma yöntemi"
      >
        <button
          type="button"
          aria-pressed={studioMode === "QUICK_TEMPLATE"}
          onClick={() => selectStudioMode("QUICK_TEMPLATE")}
        >
          <Clapperboard aria-hidden="true" />
          <span>
            <b>Hızlı Şablon</b>
            <small>Portföydeki gerçek metinler · cihazda MP4</small>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={studioMode === "AI_CINEMATIC"}
          onClick={() => selectStudioMode("AI_CINEMATIC")}
        >
          <Sparkles aria-hidden="true" />
          <span>
            <b>AI Sinematik Video</b>
            <small>Prompta özel yeni görüntü · arka planda üretim</small>
          </span>
        </button>
      </div>

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
                    <MapPin />{" "}
                    {selectedPortfolio.location || "Konum belirtilmedi"}
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
                <p>
                  {studioMode === "QUICK_TEMPLATE"
                    ? "Hazır bir stil seçin veya Türkçe komutunuzu yazın."
                    : "Stili başlangıç noktası olarak seçin; sonucu tarif eden kısa bir Türkçe prompt yazın."}
                </p>
              </div>
            </div>
            <div
              className={styles.styleGrid}
              role="group"
              aria-label="Video stili"
            >
              {STYLE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={
                    creativeChoice === option.id
                      ? styles.styleActive
                      : undefined
                  }
                  aria-pressed={creativeChoice === option.id}
                  onClick={() => chooseStyle(option)}
                >
                  <b>{option.label}</b>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
            <label className={styles.fieldLabel} htmlFor="video-command">
              {creativeChoice === "CUSTOM"
                ? "Özel yaratıcı talimatınız"
                : "Video komutu"}
            </label>
            <textarea
              ref={commandInputRef}
              id="video-command"
              className={styles.command}
              value={command}
              maxLength={1000}
              rows={4}
              onChange={(event) => {
                clearDirectedStoryboard();
                setCommand(event.target.value);
                setCreativeChoice("CUSTOM");
              }}
              placeholder={
                creativeChoice === "CUSTOM"
                  ? studioMode === "QUICK_TEMPLATE"
                    ? "Örn. İlk karede havuzu göster, sakin başlayıp son bölümde iletişim bilgilerini öne çıkar; fiyatı gösterme."
                    : "Örn. Gün batımında, sakin kamera hareketleri ve sıcak iç mekân ışıklarıyla zarif bir atmosfer."
                  : "Örn. Lüks ve sinematik olsun, fiyatı gösterme"
              }
            />
            <div className={styles.commandMeta}>
              <span>
                <Sparkles />{" "}
                {direction.style === "BOLD"
                  ? "Hızlı ve güçlü"
                  : direction.style === "CINEMATIC"
                    ? "Zarif ve yavaş"
                    : direction.style === "FAMILY"
                      ? "Sıcak ve yaşam odaklı"
                      : direction.style === "INVESTMENT"
                        ? "Yatırım odaklı"
                        : direction.style === "MINIMAL"
                          ? "Az efektli"
                          : "Dengeli"}
              </span>
              <small>{command.length}/1000</small>
            </div>
            {studioMode === "AI_CINEMATIC" && (
              <div
                className={styles.aiPromptNote}
                role="note"
                aria-label="AI video hakkında önemli bilgi"
              >
                <Sparkles aria-hidden="true" />
                <p>
                  <b>
                    Prompt videonun hareketini, sahnelerini ve atmosferini
                    yönlendirir.
                  </b>{" "}
                  Üretken sonuçlar her oluşturma işleminde değişebilir; belirli
                  bir kamera hareketi veya sahne birebir garanti edilmez.
                  İstediğiniz ekran yazısını promptta aynen belirtebilirsiniz;
                  üretken model yazımı birebir koruyamayabileceği için kesin
                  fiyat, konum, logo ve iletişim metinlerinde Hızlı Şablon
                  modunu kullanın.
                </p>
              </div>
            )}
            {studioMode === "QUICK_TEMPLATE" && creativeChoice === "CUSTOM" && (
              <div className={styles.directorPanel}>
                <p>
                  Portföy fotoğrafları ve kayıtlı bilgiler otomatik kullanılır.
                  Yönetmen; sahne sırasını, yazıların geliş anını ve
                  animasyonları talimatınıza göre yeniden kurar.
                </p>
                <button
                  type="button"
                  onClick={() => void applyCreativeDirection()}
                  disabled={
                    directorStatus.status === "LOADING" ||
                    command.trim().length < 3 ||
                    selectedPhotoIds.length === 0
                  }
                >
                  {directorStatus.status === "LOADING" ? (
                    <Loader2 className={styles.spin} />
                  ) : (
                    <Sparkles />
                  )}
                  {directorStatus.status === "LOADING"
                    ? "Sahne planı hazırlanıyor…"
                    : "Özel talimatı videoya uygula"}
                </button>
                {directorStatus.status === "ERROR" && (
                  <span role="alert" className={styles.directorError}>
                    {directorStatus.error}
                  </span>
                )}
                {directorStatus.status === "SUCCESS" && (
                  <span className={styles.directorSuccess}>
                    <Check /> Talimat uygulandı ·{" "}
                    {directorStatus.usedFallback
                      ? "Güvenli yerel plan"
                      : "AI yaratıcı yönetmen"}
                  </span>
                )}
              </div>
            )}
            {studioMode === "QUICK_TEMPLATE" && (
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
                  <span>Fiyatı göster</span>
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
                  <span>Konumu göster</span>
                </label>
              </div>
            )}
            {studioMode === "QUICK_TEMPLATE" && !direction.showPrice && (
              <p className={styles.inlineNote}>
                Komutunuzdaki “fiyatı gösterme” talimatı uygulanıyor.
              </p>
            )}
            {studioMode === "QUICK_TEMPLATE" && storyboard && (
              <div className={styles.planPreview} aria-live="polite">
                <b>Uygulanacak akış</b>
                <span>{storyboard.planSummary}</span>
                <ol>
                  {storyboard.scenes.map((scene) => (
                    <li key={scene.id}>
                      <small>
                        {Math.round((scene.toFrame - scene.fromFrame) / 3) / 10}{" "}
                        sn
                      </small>
                      {scene.type === "HOOK"
                        ? "Açılış"
                        : scene.type === "GALLERY"
                          ? "Fotoğraf akışı"
                          : scene.type === "FEATURES"
                            ? "Özellikler"
                            : scene.type === "DETAILS"
                              ? "Fiyat ve detay"
                              : "Kapanış"}
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
                <p>
                  {studioMode === "QUICK_TEMPLATE"
                    ? "En fazla 8 fotoğraf. İlk fotoğraf açılış sahnesidir."
                    : "En fazla 8 fotoğraf görsel referans olarak kullanılır; sıralama sonucun birebir akışını garanti etmez."}
                </p>
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
                        aria-label={`${photo.fileName} ${selectedIndex >= 0 ? "seçimini kaldır" : "seç"}`}
                        onClick={() => togglePhoto(photo.id)}
                      >
                        {/* Tenant tarafından yetkilendirilmiş medya URL'si. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" />
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
                <ol
                  className={styles.photoOrder}
                  aria-label="Seçilen fotoğraf sırası"
                >
                  {selectedPhotos.map((photo, index) => (
                    <li key={photo.id}>
                      <span>{index + 1}</span>
                      <div>
                        <ImageIcon />
                        <b>{photo.fileName}</b>
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
                <p>
                  Bu portföyde kullanılabilir fotoğraf yok. Portföy medya
                  alanından fotoğraf ekleyin.
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className={styles.previewColumn}>
          {studioMode === "QUICK_TEMPLATE" ? (
            <>
              <section className={styles.previewCard}>
                <div className={styles.previewTitle}>
                  <div>
                    <h3>Canlı önizleme</h3>
                    <p>
                      Özel talimat uygulandığında sahne planı baştan kurulur.
                    </p>
                  </div>
                  <span>
                    {directorStatus.status === "SUCCESS"
                      ? directorStatus.source
                      : direction.style}
                  </span>
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
                      Video cihazınızda hazırlanır; fotoğraflar render için
                      başka bir sunucuya yüklenmez.
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
                      <div className={styles.renderCancelled}>
                        İşlem iptal edildi. Ayarlarınız korunuyor.
                      </div>
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
                              : "Video oluşturuluyor…"}
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
                          <span
                            style={{ width: `${renderState.progress * 100}%` }}
                          />
                        </div>
                        {formatRemainingTime(renderState.estimatedTimeMs) && (
                          <small>
                            {formatRemainingTime(renderState.estimatedTimeMs)}
                          </small>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div className={styles.renderActions}>
                  {isRendering ? (
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={cancelRender}
                    >
                      <Square /> İptal et
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={styles.renderButton}
                      disabled={
                        !storyboard ||
                        selectedPhotoIds.length === 0 ||
                        directorStatus.status === "LOADING"
                      }
                      onClick={() => void renderVideo()}
                    >
                      {renderState.status === "SUCCESS" ? (
                        <RotateCcw />
                      ) : (
                        <Clapperboard />
                      )}
                      {renderState.status === "SUCCESS"
                        ? "Yeniden oluştur"
                        : "MP4 oluştur"}
                    </button>
                  )}
                  {renderState.status === "SUCCESS" &&
                    renderState.downloadUrl &&
                    selectedPortfolio && (
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
            </>
          ) : (
            <section className={`${styles.renderCard} ${styles.aiJobCard}`}>
              <div className={styles.renderHeading}>
                <Sparkles aria-hidden="true" />
                <div>
                  <h3>AI üretim işi</h3>
                  <p>
                    İş sunucuda devam eder; bu sayfadan ayrılıp daha sonra geri
                    dönebilirsiniz.
                  </p>
                </div>
              </div>

              <div
                className={styles.aiReadiness}
                data-ready={aiConfigured === true}
                aria-live="polite"
              >
                {aiJobsLoading && aiConfigured === null ? (
                  <Loader2 className={styles.spin} aria-hidden="true" />
                ) : (
                  <span aria-hidden="true" />
                )}
                <div>
                  <b>
                    {aiConfigured === null
                      ? "Hizmet durumu kontrol ediliyor"
                      : aiConfigured
                        ? "AI video sağlayıcısı hazır"
                        : "AI video sağlayıcısı hazır değil"}
                  </b>
                  <small>
                    {aiConfigured === false
                      ? "Platform yöneticisinin sağlayıcı bağlantısını yapılandırması gerekir."
                      : "Üretim sağlayıcıda yapılır ve tamamlanan video güvenli olarak saklanır."}
                  </small>
                </div>
              </div>

              {aiError && (
                <div className={styles.renderError} role="alert">
                  <b>İşlem tamamlanamadı</b>
                  <span>{aiError}</span>
                </div>
              )}

              {activeAiJob ? (
                <div className={styles.aiJobDetail} aria-live="polite">
                  <div className={styles.aiJobHeading}>
                    <div>
                      <small>Seçili iş</small>
                      <b>{aiJobStatusLabel(activeAiJob.status)}</b>
                    </div>
                    <span>
                      {Math.round(
                        Math.max(0, Math.min(100, activeAiJob.progress)),
                      )}
                      %
                    </span>
                  </div>
                  {activeAiJob.status === "COMPLETED" &&
                  activeAiJob.artifactHref ? (
                    <video
                      className={styles.aiVideo}
                      src={activeAiJob.artifactHref}
                      controls
                      preload="metadata"
                      aria-label="Oluşturulan AI sinematik portföy videosu"
                    >
                      Tarayıcınız video oynatmayı desteklemiyor.
                    </video>
                  ) : (
                    <div className={styles.aiProgressVisual}>
                      <Sparkles aria-hidden="true" />
                      <p>
                        {isAiJobActive
                          ? "Hareketli görüntüler hazırlanıyor. Sayfayı açık tutmanız gerekmez."
                          : aiJobStatusLabel(activeAiJob.status)}
                      </p>
                    </div>
                  )}
                  <div
                    className={styles.progressTrack}
                    role="progressbar"
                    aria-label="AI video üretim ilerlemesi"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(
                      Math.max(0, Math.min(100, activeAiJob.progress)),
                    )}
                  >
                    <span
                      style={{
                        width: `${Math.max(0, Math.min(100, activeAiJob.progress))}%`,
                      }}
                    />
                  </div>
                  {activeAiJob.errorMessage && (
                    <p className={styles.aiJobError}>
                      {activeAiJob.errorMessage}
                    </p>
                  )}
                  {activeAiJob.status === "COMPLETED" && (
                    <p className={styles.retentionNotice}>
                      Video 7 gün saklanır
                      {formatJobDate(activeAiJob.expiresAt)
                        ? ` · ${formatJobDate(activeAiJob.expiresAt)} tarihine kadar`
                        : ""}
                      . Süre dolmadan indirin.
                    </p>
                  )}
                </div>
              ) : (
                <div className={styles.aiEmptyState}>
                  <Sparkles aria-hidden="true" />
                  <p>
                    İlk sinematik videonuz için portföy, prompt ve fotoğrafları
                    seçip üretimi başlatın.
                  </p>
                </div>
              )}

              <div className={styles.renderActions}>
                <button
                  type="button"
                  className={styles.renderButton}
                  disabled={
                    aiConfigured !== true ||
                    aiSubmitting ||
                    isAiJobActive ||
                    selectedPhotoIds.length === 0 ||
                    command.trim().length < 3
                  }
                  onClick={() => void createAiVideo()}
                >
                  {aiSubmitting ? (
                    <Loader2 className={styles.spin} />
                  ) : (
                    <Sparkles />
                  )}
                  {aiSubmitting
                    ? "İş başlatılıyor…"
                    : activeAiJob
                      ? "Yeni video üret"
                      : "AI video üret"}
                </button>
                {isAiJobActive && (
                  <button
                    type="button"
                    className={styles.cancelButton}
                    disabled={aiCancelling}
                    onClick={() => void cancelAiVideo()}
                  >
                    {aiCancelling ? (
                      <Loader2 className={styles.spin} />
                    ) : (
                      <Square />
                    )}
                    {aiCancelling ? "İptal ediliyor…" : "İşi iptal et"}
                  </button>
                )}
                {activeAiJob?.status === "COMPLETED" &&
                  activeAiJob.artifactHref && (
                    <a
                      className={styles.downloadButton}
                      href={activeAiJob.artifactHref}
                      download={
                        activeAiJob.outputFileName || "ai-sinematik-video.mp4"
                      }
                    >
                      <Download /> Videoyu indir
                    </a>
                  )}
              </div>

              <p className={styles.retentionFootnote}>
                Tamamlanan AI videoları 7 gün sonra otomatik silinir. Hızlı
                Şablon çıktıları yalnız cihazınızda kalır.
              </p>

              {aiJobs.length > 0 && (
                <div className={styles.aiHistory}>
                  <div>
                    <b>Son AI işleri</b>
                    <button
                      type="button"
                      onClick={() => void loadAiJobs()}
                      disabled={aiJobsLoading}
                      aria-label="AI video işlerini yenile"
                    >
                      <RotateCcw
                        className={aiJobsLoading ? styles.spin : undefined}
                      />
                    </button>
                  </div>
                  <div className={styles.aiHistoryList}>
                    {aiJobs.slice(0, 5).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        aria-current={
                          job.id === activeAiJobId ? "true" : undefined
                        }
                        onClick={() => setActiveAiJobId(job.id)}
                      >
                        <span>
                          <b>{aiJobStatusLabel(job.status)}</b>
                          <small>
                            {formatJobDate(job.createdAt) || "Tarih yok"}
                          </small>
                        </span>
                        <small>
                          {Math.round(Math.max(0, Math.min(100, job.progress)))}
                          %
                        </small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}
