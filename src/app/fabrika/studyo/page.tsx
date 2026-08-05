"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Aperture,
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Film,
  History,
  Home,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import PosterMaker from "@/components/fabrika/PosterMaker";
import {
  DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
  STUDIO_ENHANCEMENT_PRESETS,
  type StudioEnhancementPreset,
  type StudioEnhancementPresetId,
} from "@/lib/studio-enhancement";
import toast from "react-hot-toast";
import styles from "./studio.module.css";

const PortfolioVideoStudio = dynamic(
  () => import("@/components/fabrika/PortfolioVideoStudio"),
  { ssr: false },
);

type StudioScreen = "upload" | "results";

type StudioResult = {
  itemId: string;
  name: string;
  previewUrl: string;
  downloadUrl: string;
  sourceUrl: string;
  attachedMediaId: string | null;
};

type WorkspaceProperty = {
  id: string;
  title: string;
  location: string | null;
  status: string;
};

type PropertyMediaSummary = {
  id: string;
  url: string;
  fileName: string;
  isCover: boolean;
  variantType: "ORIGINAL" | "ENHANCED" | "CREATIVE";
  usageRightsStatus: "CONFIRMED" | "UNVERIFIED" | "RESTRICTED";
  mediaType: "PHOTO" | "POSTER" | "MARKETING_ASSET";
};

type StudioBatchItem = {
  id: string;
  originalUrl: string;
  originalFileName: string;
  outputUrl: string | null;
  outputFileName: string | null;
  status:
    | "PENDING"
    | "UPLOADING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | "ATTACHED";
  errorMessage: string | null;
  attachedMediaId: string | null;
};

type StudioBatchSummary = {
  id: string;
  status:
    | "PENDING"
    | "UPLOADING"
    | "PROCESSING"
    | "COMPLETED"
    | "PARTIAL"
    | "FAILED"
    | "ATTACHED";
  createdAt: string;
  expiresAt: string | null;
  property: { id: string; title: string; location: string | null } | null;
  items: Array<{ id: string; status: StudioBatchItem["status"] }>;
};

export default function StudioPage() {
  const [studioArea, setStudioArea] = useState<"enhancer" | "poster" | "video">(
    "enhancer",
  );
  const [screen, setScreen] = useState<StudioScreen>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [results, setResults] = useState<StudioResult[]>([]);
  const [isPreparingZip, setIsPreparingZip] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const [workspaceProperties, setWorkspaceProperties] = useState<
    WorkspaceProperty[]
  >([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [propertyMedia, setPropertyMedia] = useState<PropertyMediaSummary[]>(
    [],
  );
  const [selectedSourceMediaIds, setSelectedSourceMediaIds] = useState<
    string[]
  >([]);
  const [requestedMediaIds, setRequestedMediaIds] = useState<string[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<StudioBatchItem[]>([]);
  const [selectedResultItemIds, setSelectedResultItemIds] = useState<string[]>(
    [],
  );
  const [recentBatches, setRecentBatches] = useState<StudioBatchSummary[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [comparePosition, setComparePosition] = useState(50);
  const [isAttaching, setIsAttaching] = useState(false);
  const [selectedPresetId, setSelectedPresetId] =
    useState<StudioEnhancementPresetId>("professional-camera");
  const [enhancementInstruction, setEnhancementInstruction] = useState(
    DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const instructionRef = useRef<HTMLTextAreaElement>(null);

  const loadRecentBatches = useCallback(async () => {
    try {
      const response = await fetch("/api/fabrika/studio/batches", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Son çalışmalar yüklenemedi.");
      }
      setRecentBatches((data.batches || []) as StudioBatchSummary[]);
    } catch {
      // The creation and editor flows remain usable if history cannot load.
    } finally {
      setIsLoadingBatches(false);
    }
  }, []);

  const filePreviews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => filePreviews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [filePreviews]);

  useEffect(() => {
    return () =>
      results.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
  }, [results]);

  useEffect(() => {
    async function loadProperties() {
      try {
        const response = await fetch("/api/fabrika/workspace", {
          cache: "no-store",
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setWorkspaceProperties(
            (data.workspace.properties || []).filter(
              (property: WorkspaceProperty) =>
                ["ACTIVE", "RESERVED", "DRAFT"].includes(property.status),
            ),
          );
        }
      } catch {
        // Studio remains available when no workspace record exists yet.
      }
    }
    void loadProperties();
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void loadRecentBatches(), 0);
    const interval = window.setInterval(() => void loadRecentBatches(), 8_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [loadRecentBatches]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = new URLSearchParams(window.location.search);
      const area = search.get("area");
      const propertyId = search.get("propertyId");
      const mediaIds = (search.get("mediaIds") || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (area === "poster") setStudioArea("poster");
      if (area === "video") setStudioArea("video");
      if (propertyId) setSelectedPropertyId(propertyId);
      if (mediaIds.length) setRequestedMediaIds(mediaIds);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedPropertyId) return;
    let cancelled = false;
    fetch(
      `/api/fabrika/properties/${encodeURIComponent(selectedPropertyId)}/media`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Portföy görselleri yüklenemedi.");
        }
        if (cancelled) return;
        const items = (data.items || []) as PropertyMediaSummary[];
        setPropertyMedia(items);
        setSelectedSourceMediaIds((current) => {
          const wanted = requestedMediaIds.length ? requestedMediaIds : current;
          return wanted.filter((id) => items.some((item) => item.id === id));
        });
        setRequestedMediaIds([]);
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Portföy görselleri yüklenemedi.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestedMediaIds, selectedPropertyId]);

  const addFiles = (newFiles: File[]) => {
    const images = newFiles.filter((file) => file.type.startsWith("image/"));
    if (images.length !== newFiles.length)
      toast.error("Yalnızca görsel dosyaları yükleyebilirsiniz.");
    if (!images.length) return;

    setFiles((current) => {
      const known = new Set(
        current.map((file) => `${file.name}-${file.size}-${file.lastModified}`),
      );
      const combined = [
        ...current,
        ...images.filter(
          (file) =>
            !known.has(`${file.name}-${file.size}-${file.lastModified}`),
        ),
      ];
      const available = Math.max(0, 12 - selectedSourceMediaIds.length);
      if (combined.length > available) {
        toast.error(
          "Portföy görselleriyle birlikte tek işlemde en fazla 12 fotoğraf seçebilirsiniz.",
        );
      }
      return combined.slice(0, available);
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  };

  const removeFile = (index: number) => {
    setFiles((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const changeSelectedProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setPropertyMedia([]);
    setSelectedSourceMediaIds([]);
  };

  const selectEnhancementPreset = (preset: StudioEnhancementPreset) => {
    setSelectedPresetId(preset.id);
    setEnhancementInstruction(preset.prompt);
    if (preset.id === "custom") {
      requestAnimationFrame(() => instructionRef.current?.focus());
    }
  };

  const selectedWorkspaceProperty = workspaceProperties.find(
    (property) => property.id === selectedPropertyId,
  );

  const startProcessing = async () => {
    if (!files.length && !selectedSourceMediaIds.length) {
      toast.error(
        "Bilgisayarınızdan veya portföyden en az bir fotoğraf seçin.",
      );
      return;
    }
    const safeInstruction = enhancementInstruction.trim();
    if (!safeInstruction) {
      toast.error(
        "İyileştirme talimatınızı yazın veya hazır seçeneklerden birini seçin.",
      );
      instructionRef.current?.focus();
      return;
    }
    if (safeInstruction.length > 10_000) {
      toast.error("İyileştirme talimatı en fazla 10.000 karakter olabilir.");
      instructionRef.current?.focus();
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("photos", file));
      formData.set("prompt", safeInstruction);
      formData.set("preset", selectedPresetId);
      if (selectedPropertyId) formData.set("propertyId", selectedPropertyId);
      formData.set("mediaIdsJson", JSON.stringify(selectedSourceMediaIds));
      const createResponse = await fetch("/api/fabrika/studio/batches", {
        method: "POST",
        body: formData,
      });
      const created = await createResponse.json();
      if (!createResponse.ok || !created.success || !created.batch) {
        throw new Error(created.error || "Stüdyo işlemi başlatılamadı.");
      }
      const nextBatchId = String(created.batch.id);
      setBatchId(nextBatchId);
      setBatchItems((created.batch.items || []) as StudioBatchItem[]);
      setFiles([]);
      setSelectedSourceMediaIds([]);
      toast.success(
        "Görseller sıraya alındı. Bu sayfada beklemeniz gerekmez; tamamlandığında Son çalışmalar bölümünden açabilirsiniz.",
      );
      await loadRecentBatches();
      document.getElementById("studio-recent")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "İşlem sırasında bir hata oluştu.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openBatch = async (nextBatchId: string) => {
    setErrorMessage("");
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(nextBatchId)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok || !data.success || !data.batch) {
        throw new Error(data.error || "Stüdyo çalışması açılamadı.");
      }
      const nextItems = (data.batch.items || []) as StudioBatchItem[];
      const completed = nextItems
        .filter(
          (item) =>
            item.outputUrl &&
            item.outputFileName &&
            (item.status === "COMPLETED" || item.status === "ATTACHED"),
        )
        .map((item) => ({
          itemId: item.id,
          name: item.outputFileName!,
          previewUrl: item.outputUrl!,
          downloadUrl: item.outputUrl!,
          sourceUrl: item.originalUrl,
          attachedMediaId: item.attachedMediaId,
        }));
      if (!completed.length) {
        throw new Error(
          "Bu çalışmanın indirilebilir sonucu henüz hazır değil.",
        );
      }
      setBatchId(nextBatchId);
      setBatchItems(nextItems);
      setResults(completed);
      setSelectedResultItemIds(completed.map((item) => item.itemId));
      setSelectedPropertyId(data.batch.propertyId || "");
      setActiveResult(0);
      setComparePosition(50);
      setScreen("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Stüdyo çalışması açılamadı.",
      );
    }
  };

  const downloadAllResults = async () => {
    if (!results.length || !batchId || isPreparingZip) return;
    setIsPreparingZip(true);
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}/zip`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: selectedResultItemIds }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "ZIP dosyası hazırlanamadı.");
      }
      const archive = await response.blob();
      const archiveUrl = URL.createObjectURL(archive);
      const anchor = document.createElement("a");
      anchor.href = archiveUrl;
      anchor.download = "Business_CEO_AI_Studio_Iyilestirilmis.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(archiveUrl), 1_000);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "ZIP dosyası hazırlanamadı. Görselleri tek tek indirebilirsiniz.",
      );
    } finally {
      setIsPreparingZip(false);
    }
  };

  const resetStudio = () => {
    setScreen("upload");
    setFiles([]);
    setResults([]);
    setBatchId(null);
    setBatchItems([]);
    setSelectedResultItemIds([]);
    setActiveResult(0);
    setErrorMessage("");
    setSelectedPresetId("professional-camera");
    setEnhancementInstruction(DEFAULT_STUDIO_ENHANCEMENT_PROMPT);
  };

  const activePhoto = results[activeResult];

  const attachSelectedResults = async (makeCover = false) => {
    if (!batchId || !selectedPropertyId || !selectedResultItemIds.length)
      return;
    setIsAttaching(true);
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}/attach`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            propertyId: selectedPropertyId,
            itemIds: selectedResultItemIds,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Görseller portföye eklenemedi.");
      }
      const attachedByItem = new Map<string, string>(
        (data.items || []).map(
          (item: { id: string; fingerprint: string }): [string, string] => [
            item.fingerprint.replace("studio-item:", ""),
            item.id,
          ],
        ),
      );
      setResults((current) =>
        current.map((result) => ({
          ...result,
          attachedMediaId:
            attachedByItem.get(result.itemId) || result.attachedMediaId,
        })),
      );
      if (makeCover) {
        const firstSelectedItemId = selectedResultItemIds[0];
        const coverMediaId =
          attachedByItem.get(firstSelectedItemId) ||
          results.find((result) => result.itemId === firstSelectedItemId)
            ?.attachedMediaId;
        if (!coverMediaId) {
          throw new Error("Kapak yapılacak görsel portföye bağlanamadı.");
        }
        const coverResponse = await fetch(
          `/api/fabrika/properties/${encodeURIComponent(selectedPropertyId)}/media/${encodeURIComponent(coverMediaId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isCover: true }),
          },
        );
        const coverData = await coverResponse.json();
        if (!coverResponse.ok || !coverData.success) {
          throw new Error(
            coverData.error || "Görsel kapak olarak belirlenemedi.",
          );
        }
      }
      toast.success(`${data.items.length} görsel portföye eklendi.`);
      if (makeCover) {
        toast.success("İlk seçili görsel portföy kapağı yapıldı.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Görseller portföye eklenemedi.",
      );
    } finally {
      setIsAttaching(false);
    }
  };

  const retryBatchItem = async (itemId: string) => {
    if (!batchId) return;
    setBatchItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, status: "PROCESSING", errorMessage: null }
          : item,
      ),
    );
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}/process`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok || !data.success || !data.item?.outputUrl) {
        throw new Error(data.error || "Görsel yeniden işlenemedi.");
      }
      const item = data.item as StudioBatchItem;
      setBatchItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? item : candidate,
        ),
      );
      setResults((current) => {
        if (current.some((result) => result.itemId === item.id)) return current;
        return [
          ...current,
          {
            itemId: item.id,
            name: item.outputFileName || item.originalFileName,
            previewUrl: item.outputUrl!,
            downloadUrl: item.outputUrl!,
            sourceUrl: item.originalUrl,
            attachedMediaId: item.attachedMediaId,
          },
        ];
      });
      setSelectedResultItemIds((current) =>
        current.includes(item.id) ? current : [...current, item.id],
      );
      toast.success(`${item.originalFileName} yeniden işlendi.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Görsel yeniden işlenemedi.";
      setBatchItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? { ...item, status: "FAILED", errorMessage: message }
            : item,
        ),
      );
      toast.error(message);
    }
  };

  const eligiblePropertyMedia = propertyMedia.filter(
    (item) =>
      item.mediaType === "PHOTO" &&
      item.variantType !== "CREATIVE" &&
      item.usageRightsStatus !== "RESTRICTED",
  );
  const selectedPropertyMedia = eligiblePropertyMedia.filter((item) =>
    selectedSourceMediaIds.includes(item.id),
  );
  const sourceCandidates = [
    ...selectedPropertyMedia.map((item) => ({
      id: item.id,
      url: item.url,
      name: item.fileName,
      kind: "portfolio" as const,
    })),
    ...filePreviews.map(({ file, url }) => ({
      id: `${file.name}-${file.lastModified}`,
      url,
      name: file.name,
      kind: "upload" as const,
    })),
  ];
  const activeSourceUrl =
    activePhoto?.sourceUrl || sourceCandidates[0]?.url || "";
  const activeOutputUrl = activePhoto?.previewUrl || activeSourceUrl;
  const totalSelected = files.length + selectedSourceMediaIds.length;
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>M5 · Görsel üretim</p>
          <h1>Stüdyo</h1>
          <p>
            Emlak görsellerinizi profesyonelce iyileştirin, en yüksek kaliteyi
            yakalayın
          </p>
          <p>ve kampanyalarınıza hazır etkileyici posterler oluşturun.</p>
        </div>
        <div className={styles.heroActions}>
          <button
            type="button"
            onClick={() =>
              screen === "results"
                ? resetStudio()
                : document
                    .getElementById("studio-recent")
                    ?.scrollIntoView({ behavior: "smooth" })
            }
            className={styles.secondaryButton}
          >
            {screen === "results" ? <RefreshCw /> : <History />}
            {screen === "results" ? "Yeni çalışma" : "Geçmiş"}
          </button>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Stüdyo çalışma alanları"
        className={styles.studioTabs}
      >
        <button
          type="button"
          role="tab"
          aria-selected={studioArea === "enhancer"}
          onClick={() => setStudioArea("enhancer")}
        >
          <Sparkles /> Resim İyileştirici
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={studioArea === "poster"}
          onClick={() => setStudioArea("poster")}
        >
          <ImagePlus /> Poster Yapıcı
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={studioArea === "video"}
          onClick={() => setStudioArea("video")}
        >
          <Film /> Video Stüdyosu
        </button>
      </div>

      <main className={styles.studioBody}>
        {studioArea === "video" ? (
          <section className={styles.posterWorkspace}>
            <PortfolioVideoStudio />
          </section>
        ) : studioArea === "poster" ? (
          <section className={styles.posterWorkspace}>
            <PosterMaker />
          </section>
        ) : screen === "upload" ? (
          <section className={styles.enhancerWorkspace}>
            <div className={styles.hiddenIntro}>
              <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-300 text-[10px] text-emerald-950">
                  1
                </span>
                Görselleri yükleyin
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Portföy fotoğraflarınızı öne çıkarın
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Ham fotoğraflarınızı yükleyin; stüdyo ışık, renk, netlik ve
                genel kaliteyi otomatik olarak iyileştirsin.
              </p>
            </div>

            <div className={styles.controlPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <b>Görseller</b>
                  <span>{totalSelected} seçili kaynak</span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus /> Görsel ekle
                </button>
              </div>
              <input
                ref={fileInputRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileChange}
              />
              <div className={styles.sourceThumbs}>
                {sourceCandidates.slice(0, 3).map((item, index) => (
                  <div key={item.id} data-active={index === 0}>
                    {/* Local object URLs and tenant media URLs require a native image element. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.name} />
                    {index === 0 && (
                      <span>
                        <Check />
                      </span>
                    )}
                  </div>
                ))}
                {!sourceCandidates.length && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={styles.emptyThumb}
                  >
                    <UploadCloud />
                    <span>Görsel seçin</span>
                  </button>
                )}
              </div>

              <div className={styles.selectedOriginal}>
                <span>Seçili görsel (orijinal)</span>
                {activeSourceUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={activeSourceUrl} alt="Seçili orijinal kaynak" />
                ) : (
                  <div>
                    <ImagePlus />
                    <small>Karşılaştırma için bir fotoğraf ekleyin</small>
                  </div>
                )}
              </div>
              <label
                className={styles.propertySelect}
                htmlFor="studio-property"
              >
                <span className="flex items-center gap-2 text-xs text-slate-300">
                  <Home className="h-4 w-4 text-emerald-400" />
                  Bu görseller bir portföye mi ait?
                </span>
                <select
                  id="studio-property"
                  value={selectedPropertyId}
                  onChange={(event) =>
                    changeSelectedProperty(event.target.value)
                  }
                  className="min-w-0 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-emerald-500"
                >
                  <option value="">Portföysüz devam et</option>
                  {workspaceProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.title}
                      {property.location ? ` · ${property.location}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPropertyId && (
                <section className={styles.propertyMedia}>
                  {selectedWorkspaceProperty && (
                    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-cyan-300/15 bg-slate-950/45 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-extrabold text-white">
                          {selectedWorkspaceProperty.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {selectedWorkspaceProperty.location ||
                            "Konum bilgisi girilmemiş"}
                        </p>
                      </div>
                      <span className="w-fit rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-bold text-cyan-100">
                        {propertyMedia.length} medya
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">
                        Portföyden seç
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Bilgisayardan yüklenenlerle birlikte en fazla 12 görsel
                        işlenir. Kreatif ve kısıtlı medya listelenmez.
                      </p>
                    </div>
                    <button
                      className="text-xs font-semibold text-cyan-200 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      onClick={() => {
                        const eligible = propertyMedia.filter(
                          (item) =>
                            item.mediaType === "PHOTO" &&
                            item.variantType !== "CREATIVE" &&
                            item.usageRightsStatus !== "RESTRICTED",
                        );
                        setSelectedSourceMediaIds((current) =>
                          current.length === eligible.length
                            ? []
                            : eligible
                                .slice(0, Math.max(0, 12 - files.length))
                                .map((item) => item.id),
                        );
                      }}
                      type="button"
                    >
                      {selectedSourceMediaIds.length
                        ? "Seçimi kaldır"
                        : "Uygun görselleri seç"}
                    </button>
                  </div>
                  {propertyMedia.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {propertyMedia
                        .filter(
                          (item) =>
                            item.mediaType === "PHOTO" &&
                            item.variantType !== "CREATIVE" &&
                            item.usageRightsStatus !== "RESTRICTED",
                        )
                        .map((item) => {
                          const selected = selectedSourceMediaIds.includes(
                            item.id,
                          );
                          const disabled =
                            !selected &&
                            selectedSourceMediaIds.length + files.length >= 12;
                          return (
                            <button
                              aria-pressed={selected}
                              className={`group relative aspect-[4/3] overflow-hidden rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 ${
                                selected
                                  ? "border-cyan-300 ring-2 ring-cyan-300/20"
                                  : "border-slate-700 hover:border-slate-500"
                              }`}
                              disabled={disabled}
                              key={item.id}
                              onClick={() =>
                                setSelectedSourceMediaIds((current) =>
                                  current.includes(item.id)
                                    ? current.filter((id) => id !== item.id)
                                    : [...current, item.id],
                                )
                              }
                              type="button"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                alt={item.fileName}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                src={item.url}
                              />
                              <span
                                className={`absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border ${
                                  selected
                                    ? "border-cyan-100 bg-cyan-300 text-cyan-950"
                                    : "border-white/40 bg-slate-950/70 text-transparent"
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </span>
                              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5 text-[9px] font-semibold text-white">
                                {item.isCover ? "Kapak · " : ""}
                                {item.variantType === "ENHANCED"
                                  ? "İyileştirilmiş"
                                  : "Orijinal"}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-center text-xs text-slate-400">
                      Bu portföyde uygun fotoğraf yok. Aşağıdan
                      bilgisayarınızdan yükleyebilirsiniz.
                    </p>
                  )}
                </section>
              )}

              <div className={styles.instructionPanel}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <label
                      htmlFor="studio-enhancement-instruction"
                      className="text-sm font-bold text-white"
                    >
                      İyileştirme talimatı
                    </label>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Hazır bir seçenek kullanın veya metni ihtiyacınıza göre
                      düzenleyin.
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    {enhancementInstruction.length.toLocaleString("tr-TR")} /
                    10.000
                  </span>
                </div>

                <div
                  className="mt-4 flex flex-wrap gap-2"
                  aria-label="Hazır iyileştirme talimatları"
                >
                  {STUDIO_ENHANCEMENT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={selectedPresetId === preset.id}
                      title={preset.description}
                      onClick={() => selectEnhancementPreset(preset)}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                        selectedPresetId === preset.id
                          ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-100"
                          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <textarea
                  ref={instructionRef}
                  id="studio-enhancement-instruction"
                  value={enhancementInstruction}
                  maxLength={10_000}
                  rows={8}
                  onChange={(event) => {
                    setEnhancementInstruction(event.target.value);
                    if (
                      STUDIO_ENHANCEMENT_PRESETS.find(
                        (preset) => preset.id === selectedPresetId,
                      )?.prompt !== event.target.value
                    ) {
                      setSelectedPresetId("custom");
                    }
                  }}
                  placeholder="Görselde nasıl bir iyileştirme istediğinizi yazın…"
                  className="mt-4 min-h-44 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Kaynak görsel image-to-image olarak işlenir. Düşük dönüşüm
                  gücü, mimariyi ve mevcut nesneleri korumaya yardımcı olur.
                </p>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) =>
                  event.key === "Enter" && fileInputRef.current?.click()
                }
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className={styles.dropZone}
              >
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-emerald-500 text-emerald-950">
                  <UploadCloud className="h-8 w-8 stroke-[2.5]" />
                </div>
                <h2 className="mt-5 text-lg font-extrabold text-white">
                  Fotoğrafları buraya bırakın
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  veya bilgisayarınızdan seçmek için tıklayın
                </p>
                <p className="mt-4 text-xs font-medium text-slate-500">
                  JPG, PNG veya WEBP · Birden fazla fotoğraf seçebilirsiniz
                </p>
              </div>

              {filePreviews.length > 0 && (
                <div className={styles.uploadedFiles}>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-white">
                      Yüklenecek fotoğraflar{" "}
                      <span className="text-emerald-300">({files.length})</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setFiles([])}
                      className="text-xs font-bold text-slate-400 transition hover:text-white"
                    >
                      Tümünü kaldır
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {filePreviews.map(({ file, url }, index) => (
                      <div
                        key={`${file.name}-${file.lastModified}`}
                        className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-slate-900"
                      >
                        {/* Native img is used because this is a local, user-selected object URL. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={file.name}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeFile(index);
                          }}
                          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white opacity-100 transition hover:bg-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label={`${file.name} dosyasını kaldır`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-[10px] font-medium text-white">
                          {file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.controlFooter}>
                <span>
                  İşlem arka planda devam eder; sayfada beklemeniz gerekmez.
                </span>
                <button
                  type="button"
                  onClick={startProcessing}
                  disabled={!totalSelected || isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <WandSparkles />
                  )}
                  {totalSelected || 0} görseli iyileştir
                </button>
              </div>
            </div>

            <section
              className={styles.comparePanel}
              aria-label="Önce ve sonra karşılaştırması"
            >
              <div className={styles.compareCanvas}>
                {activeSourceUrl ? (
                  <>
                    {/* Tenant media and generated result URLs require native image elements. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeSourceUrl}
                      alt="Orijinal görsel"
                      className={styles.originalImage}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeOutputUrl}
                      alt="İyileştirilmiş görsel"
                      className={styles.enhancedImage}
                      style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}
                    />
                    <span className={styles.originalLabel}>Orijinal</span>
                    <span className={styles.enhancedLabel}>
                      {activePhoto ? "İyileştirilmiş" : "Önizleme"}
                    </span>
                    <i
                      className={styles.compareDivider}
                      style={{ left: `${comparePosition}%` }}
                    >
                      <b>‹ ›</b>
                    </i>
                    <input
                      className={styles.compareRange}
                      type="range"
                      min="0"
                      max="100"
                      value={comparePosition}
                      onChange={(event) =>
                        setComparePosition(Number(event.target.value))
                      }
                      aria-label="Önce ve sonra karşılaştırma çizgisi"
                    />
                  </>
                ) : (
                  <div className={styles.emptyCompare}>
                    <Aperture />
                    <h2>Karşılaştırma alanı</h2>
                    <p>
                      Bir portföy fotoğrafı seçtiğinizde orijinal ve
                      iyileştirilmiş görüntü burada yan yana açılır.
                    </p>
                  </div>
                )}
              </div>
              {results.length > 1 && (
                <div className={styles.resultStrip}>
                  {results.map((result, index) => (
                    <button
                      key={result.itemId}
                      type="button"
                      data-active={activeResult === index}
                      onClick={() => setActiveResult(index)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={result.previewUrl} alt={result.name} />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <aside className={styles.rightRail}>
              <section className={styles.downloadCard}>
                <div className={styles.railTitle}>
                  <span>İndirme seçenekleri</span>
                  <Download />
                </div>
                {activePhoto ? (
                  <>
                    <a
                      href={activePhoto.downloadUrl}
                      download={activePhoto.name}
                    >
                      <span>Yüksek çözünürlük</span>
                      <Download />
                    </a>
                    <a
                      href={activePhoto.downloadUrl}
                      download={activePhoto.name}
                    >
                      <span>Web için görsel</span>
                      <Download />
                    </a>
                  </>
                ) : (
                  <>
                    <button type="button" disabled>
                      Yüksek çözünürlük
                    </button>
                    <button type="button" disabled>
                      Web için görsel
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={downloadAllResults}
                  disabled={
                    !results.length ||
                    isPreparingZip ||
                    !selectedResultItemIds.length
                  }
                >
                  {isPreparingZip ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Download />
                  )}{" "}
                  Pazarlama paketi (ZIP)
                </button>
              </section>
            </aside>

            {errorMessage && (
              <div role="alert" className={styles.errorBanner}>
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
                  <div>
                    <p className="text-sm font-bold text-rose-100">
                      İşlem tamamlanamadı
                    </p>
                    <p className="mt-1 text-xs leading-5 text-rose-100/80">
                      {errorMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className={styles.resultsWorkspace}>
            <div className={styles.resultsHeader}>
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" /> İşlem tamamlandı
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Portföye hazır görselleriniz.
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  İyileştirilmiş sonucu inceleyin veya tüm görselleri tek ZIP
                  dosyası halinde indirin.
                </p>
              </div>
              {results.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedResultItemIds((current) =>
                        current.length === results.length
                          ? []
                          : results.map((result) => result.itemId),
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-slate-500 hover:text-white"
                  >
                    <Check className="h-4 w-4" />
                    {selectedResultItemIds.length === results.length
                      ? "Seçimi kaldır"
                      : "Tümünü seç"}
                  </button>
                  {selectedPropertyId && (
                    <>
                      <button
                        type="button"
                        onClick={() => void attachSelectedResults()}
                        disabled={!selectedResultItemIds.length || isAttaching}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-extrabold text-emerald-200 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {isAttaching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImagePlus className="h-4 w-4" />
                        )}
                        Seçili {selectedResultItemIds.length} görseli portföye
                        ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => void attachSelectedResults(true)}
                        disabled={!selectedResultItemIds.length || isAttaching}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-extrabold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Home className="h-4 w-4" />
                        İlk seçiliyi kapak yap
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={downloadAllResults}
                    disabled={isPreparingZip || !selectedResultItemIds.length}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPreparingZip ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isPreparingZip
                      ? "ZIP hazırlanıyor…"
                      : `Seçili ${selectedResultItemIds.length} görseli ZIP indir`}
                  </button>
                </div>
              )}
            </div>

            {!selectedPropertyId && (
              <label className="mb-6 flex flex-col gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4 text-xs font-bold text-cyan-100 sm:flex-row sm:items-center sm:justify-between">
                Sonuçları kaydetmek için portföy seçin
                <select
                  value={selectedPropertyId}
                  onChange={(event) =>
                    changeSelectedProperty(event.target.value)
                  }
                  className="h-10 min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-cyan-300 sm:min-w-72"
                >
                  <option value="">Portföy seçin</option>
                  {workspaceProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.title}
                      {property.location ? ` · ${property.location}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {batchItems.some((item) => item.status === "FAILED") && (
              <section className="mb-6 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] p-4">
                <h2 className="text-sm font-bold text-rose-100">
                  Yeniden denenebilecek görseller
                </h2>
                <p className="mt-1 text-xs leading-5 text-rose-100/70">
                  Başarılı sonuçlar korunur; yalnızca hata veren görsel yeniden
                  işlenir.
                </p>
                <ul className="mt-3 space-y-2">
                  {batchItems
                    .filter((item) => item.status === "FAILED")
                    .map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-2 rounded-lg border border-rose-300/15 bg-slate-950/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-white">
                            {item.originalFileName}
                          </p>
                          <p className="mt-1 text-[11px] text-rose-200/75">
                            {item.errorMessage || "Görsel işlenemedi."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void retryBatchItem(item.id)}
                          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-rose-300/30 px-3 py-2 text-xs font-bold text-rose-100 transition hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Tekrar dene
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {activePhoto ? (
              <div className={styles.resultsCompare}>
                <div className={`${styles.compareCanvas} min-h-[28rem]`}>
                  {/* Tenant media and generated result URLs require native image elements. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activePhoto.sourceUrl}
                    alt="Orijinal görsel"
                    className={styles.originalImage}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activePhoto.previewUrl}
                    alt="İyileştirilmiş görsel"
                    className={styles.enhancedImage}
                    style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}
                  />
                  <span className={styles.originalLabel}>Orijinal</span>
                  <span className={styles.enhancedLabel}>İyileştirilmiş</span>
                  <i
                    className={styles.compareDivider}
                    style={{ left: `${comparePosition}%` }}
                  >
                    <b>‹ ›</b>
                  </i>
                  <input
                    className={styles.compareRange}
                    type="range"
                    min="0"
                    max="100"
                    value={comparePosition}
                    onChange={(event) =>
                      setComparePosition(Number(event.target.value))
                    }
                    aria-label="Önce ve sonra karşılaştırma çizgisi"
                  />
                </div>
                <div className="flex flex-col p-5 sm:p-7">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    Seçili sonuç
                  </p>
                  <h2 className="mt-2 break-all text-lg font-semibold text-white">
                    {activePhoto.name}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Ortadaki çizgiyi sürükleyerek işlem öncesi ve sonrası
                    arasındaki farkı inceleyin.
                  </p>
                  {activePhoto.attachedMediaId && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-200">
                      <CheckCircle2 className="h-4 w-4" /> Portföye eklendi
                    </div>
                  )}
                  <a
                    href={activePhoto.downloadUrl}
                    download={activePhoto.name}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-extrabold text-emerald-200 transition hover:bg-emerald-300/20"
                  >
                    <Download className="h-4 w-4" /> Bu görseli indir
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-6 text-sm text-rose-100">
                İşlenmiş görseller alınamadı. Lütfen yeni bir işlem başlatın.
              </div>
            )}

            {results.length > 1 && (
              <div className={styles.otherResults}>
                <p className="mb-3 text-sm font-bold text-white">
                  Diğer sonuçlar
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {results.map((result, index) => {
                    const selected = selectedResultItemIds.includes(
                      result.itemId,
                    );
                    return (
                      <article
                        key={result.itemId}
                        className={`relative overflow-hidden rounded-xl border transition ${
                          activeResult === index
                            ? "border-emerald-300 ring-2 ring-emerald-300/25"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveResult(index)}
                          className="group relative block aspect-[4/3] w-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={result.previewUrl}
                            alt={result.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-left text-[10px] font-bold text-white">
                            Görsel {index + 1}
                          </span>
                        </button>
                        <button
                          aria-label={`${result.name} sonucunu seç`}
                          aria-pressed={selected}
                          className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border ${
                            selected
                              ? "border-emerald-100 bg-emerald-300 text-emerald-950"
                              : "border-white/40 bg-slate-950/75 text-transparent"
                          }`}
                          onClick={() =>
                            setSelectedResultItemIds((current) =>
                              current.includes(result.itemId)
                                ? current.filter((id) => id !== result.itemId)
                                : [...current, result.itemId],
                            )
                          }
                          type="button"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      {studioArea === "enhancer" && (
        <section id="studio-recent" className={styles.recentWorks}>
          <div className={styles.recentHeader}>
            <div>
              <h2>Son çalışmalar</h2>
              <p>
                İşlemler arka planda sürer. Çalışmalar ve çıktılar 7 gün
                saklanır.
              </p>
            </div>
            <span>{recentBatches.length} çalışma</span>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {recentBatches.map((item) => {
              const completed = item.items.filter((batchItem) =>
                ["COMPLETED", "ATTACHED"].includes(batchItem.status),
              ).length;
              const failed = item.items.filter(
                (batchItem) => batchItem.status === "FAILED",
              ).length;
              const progressValue = item.items.length
                ? Math.round(((completed + failed) / item.items.length) * 100)
                : 0;
              const ready =
                completed > 0 &&
                ["COMPLETED", "PARTIAL", "ATTACHED"].includes(item.status);
              const statusLabel = ready
                ? "Hazır"
                : item.status === "FAILED"
                  ? "Başarısız"
                  : item.status === "PROCESSING"
                    ? "İşleniyor"
                    : "Sırada";
              return (
                <article
                  key={item.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/55 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {item.property?.title || "Portföysüz görsel çalışması"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(item.createdAt).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                        ready
                          ? "bg-emerald-400/10 text-emerald-300"
                          : item.status === "FAILED"
                            ? "bg-rose-400/10 text-rose-300"
                            : "bg-amber-400/10 text-amber-200"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-[width]"
                      style={{
                        width: `${Math.max(item.status === "PROCESSING" ? 8 : 0, progressValue)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {completed}/{item.items.length} görsel hazır
                    </span>
                    <span>%{progressValue}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => void openBatch(item.id)}
                    className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-emerald-400/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {ready ? "Sonuçları aç" : "Arka planda devam ediyor"}
                  </button>
                </article>
              );
            })}
            {!recentBatches.length && !isLoadingBatches && (
              <div className={styles.emptyRecent}>
                <ImagePlus />
                <span>İlk iyileştirme çalışmanız burada görünecek.</span>
              </div>
            )}
            {isLoadingBatches && (
              <div className="rounded-lg border border-slate-800 p-5 text-sm text-slate-400">
                Son çalışmalar yükleniyor…
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
