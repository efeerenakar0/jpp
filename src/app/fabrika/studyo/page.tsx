'use client';

import Link from 'next/link';
import Image from 'next/image';
import { upload } from '@vercel/blob/client';
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  EllipsisVertical,
  FileImage,
  Filter,
  FolderOpen,
  Grid2X2,
  History,
  Home,
  Image as ImageIcon,
  ImagePlus,
  Images,
  List,
  Loader2,
  Maximize2,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
  DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
  STUDIO_ENHANCEMENT_PRESETS,
  type StudioEnhancementPreset,
  type StudioEnhancementPresetId,
} from '@/lib/studio-enhancement';
import {
  groupStudioBatchHistory,
  summarizeStudioBatchHistory,
  type StudioHistoryEntry,
} from '@/lib/studio-history';
import {
  isStudioImageType,
  STUDIO_MAX_FILE_BYTES,
  STUDIO_MAX_PHOTOS,
  STUDIO_MAX_TOTAL_BYTES,
  studioUploadFileName,
  type StudioUploadedFile,
} from '@/lib/studio-upload';
import {
  runStudioProcessingQueue,
  STUDIO_PROCESSING_CONCURRENCY,
} from '@/lib/studio-processing-queue';
import styles from './studio-v2.module.css';

type StudioTab = 'enhancer' | 'history';
type StudioScreen = 'upload' | 'results';
type StudioSource = 'portfolio' | 'computer';
type HistoryFilter = 'all' | StudioSource;
type HistoryView = 'grid' | 'list';

type WorkspaceProperty = {
  id: string;
  title: string;
  referenceCode?: string | null;
  location: string | null;
  price?: number | null;
  roomCount?: string | null;
  propertyType?: string | null;
  area?: number | null;
  listingType?: 'SALE' | 'RENT' | null;
  status: string;
  imageUrl?: string | null;
};

type PropertyMediaSummary = {
  id: string;
  url: string;
  fileName: string;
  isCover: boolean;
  variantType: 'ORIGINAL' | 'ENHANCED' | 'CREATIVE';
  usageRightsStatus: 'CONFIRMED' | 'UNVERIFIED' | 'RESTRICTED';
  mediaType: 'PHOTO' | 'POSTER' | 'MARKETING_ASSET';
};

type StudioBatchItem = {
  id: string;
  title?: string | null;
  originalUrl: string;
  originalFileName: string;
  outputUrl: string | null;
  outputFileName: string | null;
  status:
    | 'PENDING'
    | 'UPLOADING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'ATTACHED';
  errorMessage: string | null;
  attachedMediaId: string | null;
};

type StudioResult = {
  itemId: string;
  name: string;
  previewUrl: string;
  downloadUrl: string;
  sourceUrl: string;
  attachedMediaId: string | null;
};

type StudioBatchSummary = {
  id: string;
  title?: string | null;
  status:
    | 'PENDING'
    | 'UPLOADING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'PARTIAL'
    | 'FAILED'
    | 'ATTACHED';
  createdAt: string;
  expiresAt: string | null;
  property: { id: string; title: string; location: string | null } | null;
  items: Array<{
    id: string;
    title?: string | null;
    status: StudioBatchItem['status'];
    originalFileName: string;
    originalUrl: string;
    outputUrl: string | null;
    outputFileName: string | null;
    attachedMediaId: string | null;
    attemptCount: number;
    errorMessage: string | null;
  }>;
};

const STUDIO_DRAFT_KEY = 'business-ceo-ai:studio-enhancer-v2-draft';
const MAX_PHOTOS = STUDIO_MAX_PHOTOS;

const SIMPLE_PRESETS = STUDIO_ENHANCEMENT_PRESETS.filter((preset) =>
  ['professional-camera', 'light-color', 'natural'].includes(preset.id)
);

function formatStudioDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPropertyPrice(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Belirtilmemiş';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

function isEligiblePhoto(item: PropertyMediaSummary) {
  return (
    item.mediaType === 'PHOTO' &&
    item.variantType !== 'CREATIVE' &&
    item.usageRightsStatus !== 'RESTRICTED'
  );
}

function fileTitle(fileName: string) {
  const value = fileName.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return value || 'Yeni fotoğraf çalışması';
}

async function responseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function studioResultsFromItems(items: StudioBatchItem[]): StudioResult[] {
  return items
    .filter(
      (item) =>
        item.outputUrl &&
        item.outputFileName &&
        ['COMPLETED', 'ATTACHED'].includes(item.status)
    )
    .map((item) => ({
      itemId: item.id,
      name: item.outputFileName!,
      previewUrl: item.outputUrl!,
      downloadUrl: item.outputUrl!,
      sourceUrl: item.originalUrl,
      attachedMediaId: item.attachedMediaId,
    }));
}

export default function StudioPage() {
  const [layoutVersion] = useState<'studio-grid'>('studio-grid');
  const [activeTab, setActiveTab] = useState<StudioTab>('enhancer');
  const [screen, setScreen] = useState<StudioScreen>('upload');
  const [source, setSource] = useState<StudioSource>('computer');
  const [workspaceProperties, setWorkspaceProperties] = useState<WorkspaceProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [propertyMedia, setPropertyMedia] = useState<PropertyMediaSummary[]>([]);
  const [selectedSourceMediaIds, setSelectedSourceMediaIds] = useState<string[]>([]);
  const [requestedMediaIds, setRequestedMediaIds] = useState<string[]>([]);
  const [isLoadingPropertyMedia, setIsLoadingPropertyMedia] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [selectedPresetId, setSelectedPresetId] =
    useState<StudioEnhancementPresetId>('professional-camera');
  const [enhancementInstruction, setEnhancementInstruction] = useState(
    DEFAULT_STUDIO_ENHANCEMENT_PROMPT
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadedFileCount, setUploadedFileCount] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<StudioBatchItem[]>([]);
  const [results, setResults] = useState<StudioResult[]>([]);
  const [selectedResultItemIds, setSelectedResultItemIds] = useState<string[]>([]);
  const [activeResult, setActiveResult] = useState(0);
  const [comparePosition, setComparePosition] = useState(50);
  const [recentBatches, setRecentBatches] = useState<StudioBatchSummary[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyView, setHistoryView] = useState<HistoryView>('grid');
  const [historySearch, setHistorySearch] = useState('');
  const [showOnlyReady, setShowOnlyReady] = useState(false);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [portfolioSearch, setPortfolioSearch] = useState('');
  const [portfolioStatus, setPortfolioStatus] = useState<'all' | 'ACTIVE' | 'DRAFT'>('all');
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [attachBatchId, setAttachBatchId] = useState<string | null>(null);
  const [attachTargetPropertyId, setAttachTargetPropertyId] = useState('');
  const [attachTargetMedia, setAttachTargetMedia] = useState<PropertyMediaSummary[]>([]);
  const [attachCandidates, setAttachCandidates] = useState<StudioResult[]>([]);
  const [selectedAttachItemIds, setSelectedAttachItemIds] = useState<string[]>([]);
  const [isLoadingAttachTargetMedia, setIsLoadingAttachTargetMedia] = useState(false);
  const [isPortfolioDrawerOpen, setIsPortfolioDrawerOpen] = useState(false);
  const [drawerListingType, setDrawerListingType] = useState<'SALE' | 'RENT'>('SALE');
  const [drawerPrice, setDrawerPrice] = useState('');
  const [drawerStatus, setDrawerStatus] = useState<'ACTIVE' | 'DRAFT'>('DRAFT');
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isPreparingZip, setIsPreparingZip] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [newPropertyTitle, setNewPropertyTitle] = useState('');
  const [newPropertyLocation, setNewPropertyLocation] = useState('');
  const [attachedPropertyId, setAttachedPropertyId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const loadedHistoryRef = useRef(false);
  const notifiedBatchIdsRef = useRef(new Set<string>());
  const attachMediaRequestRef = useRef(0);

  const filePreviews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );

  const selectedProperty = workspaceProperties.find(
    (property) => property.id === selectedPropertyId
  );
  const eligiblePropertyMedia = propertyMedia.filter(isEligiblePhoto);
  const selectedPropertyMedia = eligiblePropertyMedia.filter((item) =>
    selectedSourceMediaIds.includes(item.id)
  );
  const totalSelected = selectedSourceMediaIds.length + files.length;
  const batchReadyCount = batchItems.filter((item) =>
    ['COMPLETED', 'ATTACHED'].includes(item.status)
  ).length;
  const batchFailedCount = batchItems.filter((item) => item.status === 'FAILED').length;
  const batchFinishedCount = batchReadyCount + batchFailedCount;
  const batchTotalCount = batchItems.length;
  const batchHasPendingItems = batchItems.some((item) =>
    ['PENDING', 'UPLOADING', 'PROCESSING'].includes(item.status)
  );
  const batchProgress = batchTotalCount
    ? Math.round((batchFinishedCount / batchTotalCount) * 100)
    : 0;
  const isSelectionReady =
    totalSelected > 0 && (source === 'computer' || Boolean(selectedPropertyId));
  const activePhoto = results[activeResult];
  const mediaEditorPropertyId = attachedPropertyId || selectedPropertyId;
  const attachTargetProperty = workspaceProperties.find(
    (property) => property.id === attachTargetPropertyId
  );
  const attachTargetPhotos = attachTargetMedia.filter(
    (item) => item.mediaType === 'PHOTO'
  );
  const attachableCandidates = attachCandidates.filter(
    (result) => !result.attachedMediaId
  );
  const allAttachableCandidatesSelected =
    attachableCandidates.length > 0 &&
    selectedAttachItemIds.length === attachableCandidates.length;

  const applyBatchSnapshot = useCallback((nextItems: StudioBatchItem[]) => {
    const completed = studioResultsFromItems(nextItems);
    setBatchItems(nextItems);
    setResults(completed);
    setSelectedResultItemIds((current) => {
      const readyIds = completed.map((item) => item.itemId);
      return [...new Set([...current.filter((id) => readyIds.includes(id)), ...readyIds])];
    });
    setActiveResult((current) =>
      completed.length ? Math.min(current, completed.length - 1) : 0
    );
  }, []);

  const historyEntries = useMemo<StudioHistoryEntry[]>(() => {
    return groupStudioBatchHistory(recentBatches);
  }, [recentBatches]);

  const visibleHistoryEntries = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase('tr-TR');
    return historyEntries
      .filter((entry) => historyFilter === 'all' || entry.source === historyFilter)
      .filter((entry) => !showOnlyReady || entry.summary.ready)
      .filter((entry) => {
        if (!query) return true;
        return entry.searchableText.includes(query);
      })
      .slice(0, 48);
  }, [historyEntries, historyFilter, historySearch, showOnlyReady]);

  const filteredWorkspaceProperties = useMemo(() => {
    const query = portfolioSearch.trim().toLocaleLowerCase('tr-TR');
    return workspaceProperties.filter((property) => {
      const matchesStatus = portfolioStatus === 'all' || property.status === portfolioStatus;
      const matchesQuery =
        !query ||
        [property.title, property.referenceCode, property.location]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [portfolioSearch, portfolioStatus, workspaceProperties]);

  const loadRecentBatches = useCallback(async () => {
    try {
      const response = await fetch('/api/fabrika/studio/batches', { cache: 'no-store' });
      const data = await responseJson<{ success?: boolean; error?: string; batches?: StudioBatchSummary[] }>(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Geçmiş çalışmalar yüklenemedi.');
      }
      const nextBatches = data.batches || [];
      const finishedIds = nextBatches
        .filter((batch) =>
          ['COMPLETED', 'PARTIAL', 'FAILED', 'ATTACHED'].includes(batch.status)
        )
        .map((batch) => batch.id);
      if (!loadedHistoryRef.current) {
        finishedIds.forEach((id) => notifiedBatchIdsRef.current.add(id));
        loadedHistoryRef.current = true;
      } else {
        const newlyFinished = finishedIds.filter(
          (id) => !notifiedBatchIdsRef.current.has(id)
        );
        newlyFinished.forEach((id) => notifiedBatchIdsRef.current.add(id));
        if (newlyFinished.length) {
          toast.success(
            newlyFinished.length === 1
              ? 'Fotoğraflarınız hazır. Geçmiş Çalışmalarım bölümünden açabilirsiniz.'
              : `${newlyFinished.length} çalışmanız tamamlandı.`
          );
        }
      }
      setRecentBatches(nextBatches);
    } catch {
      // The enhancer stays usable if history is temporarily unavailable.
    } finally {
      setIsLoadingBatches(false);
    }
  }, []);

  useEffect(() => {
    return () => filePreviews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [filePreviews]);

  useEffect(() => {
    async function loadWorkspace() {
      try {
        const response = await fetch('/api/fabrika/workspace', { cache: 'no-store' });
        const data = await responseJson<{
          success?: boolean;
          workspace?: { properties?: WorkspaceProperty[] };
        }>(response);
        if (response.ok && data.success) {
          setWorkspaceProperties(
            (data.workspace?.properties || []).filter((property) =>
              ['ACTIVE', 'RESERVED', 'DRAFT'].includes(property.status)
            )
          );
        }
      } catch {
        // Computer uploads remain available without a workspace response.
      }
    }
    void loadWorkspace();
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void loadRecentBatches(), 0);
    const interval = window.setInterval(() => void loadRecentBatches(), 8_000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(interval);
    };
  }, [loadRecentBatches]);

  useEffect(() => {
    if (!batchId || !isProcessing || screen !== 'results') return;
    let disposed = false;
    const sync = async () => {
      try {
        const response = await fetch(
          `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}`,
          { cache: 'no-store' }
        );
        const data = await responseJson<{
          success?: boolean;
          batch?: { items?: StudioBatchItem[] };
        }>(response);
        if (!disposed && response.ok && data.success && data.batch?.items) {
          applyBatchSnapshot(data.batch.items);
        }
      } catch {
        // Individual item requests still update the screen immediately.
      }
    };
    const timer = window.setInterval(() => void sync(), 2_000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [applyBatchSnapshot, batchId, isProcessing, screen]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = new URLSearchParams(window.location.search);
      const propertyId = search.get('propertyId');
      const mediaIds = (search.get('mediaIds') || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (search.get('area') === 'history') setActiveTab('history');
      if (propertyId) {
        setSource('portfolio');
        setSelectedPropertyId(propertyId);
      }
      if (mediaIds.length) setRequestedMediaIds(mediaIds);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const requestedPropertyId = new URLSearchParams(window.location.search).get(
          'propertyId'
        );
        const raw = window.sessionStorage.getItem(STUDIO_DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw) as Record<string, unknown>;
        if (
          !requestedPropertyId &&
          (draft.source === 'portfolio' || draft.source === 'computer')
        ) {
          setSource(draft.source);
        }
        if (!requestedPropertyId && typeof draft.selectedPropertyId === 'string') {
          setSelectedPropertyId(draft.selectedPropertyId);
        }
        if (
          typeof draft.selectedPresetId === 'string' &&
          STUDIO_ENHANCEMENT_PRESETS.some((preset) => preset.id === draft.selectedPresetId)
        ) {
          setSelectedPresetId(draft.selectedPresetId as StudioEnhancementPresetId);
        }
        if (typeof draft.enhancementInstruction === 'string') {
          setEnhancementInstruction(draft.enhancementInstruction.slice(0, 10_000));
        }
      } catch {
        window.sessionStorage.removeItem(STUDIO_DRAFT_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (screen !== 'upload') return;
    const timer = window.setTimeout(() => {
      window.sessionStorage.setItem(
        STUDIO_DRAFT_KEY,
        JSON.stringify({
          source,
          selectedPropertyId,
          selectedPresetId,
          enhancementInstruction,
          savedAt: new Date().toISOString(),
        })
      );
    }, 300);
    return () => window.clearTimeout(timer);
  }, [enhancementInstruction, screen, selectedPresetId, selectedPropertyId, source]);

  useEffect(() => {
    if (!selectedPropertyId || source !== 'portfolio') return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsLoadingPropertyMedia(true);
      fetch(`/api/fabrika/properties/${encodeURIComponent(selectedPropertyId)}/media`, {
        cache: 'no-store',
      })
        .then(async (response) => {
          const data = await responseJson<{
            success?: boolean;
            error?: string;
            items?: PropertyMediaSummary[];
          }>(response);
          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Portföy fotoğrafları yüklenemedi.');
          }
          if (cancelled) return;
          const items = data.items || [];
          const eligible = items.filter(isEligiblePhoto);
          const requested = requestedMediaIds.filter((id) =>
            eligible.some((item) => item.id === id)
          );
          setPropertyMedia(items);
          setSelectedSourceMediaIds(
            (requested.length ? requested : eligible.map((item) => item.id)).slice(
              0,
              MAX_PHOTOS
            )
          );
          setRequestedMediaIds([]);
        })
        .catch((error) => {
          if (!cancelled) {
            toast.error(
              error instanceof Error
                ? error.message
                : 'Portföy fotoğrafları yüklenemedi.'
            );
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoadingPropertyMedia(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [requestedMediaIds, selectedPropertyId, source]);

  function chooseSource(nextSource: StudioSource) {
    setSource(nextSource);
    if (nextSource === 'computer') {
      setSelectedPropertyId('');
      setPropertyMedia([]);
      setSelectedSourceMediaIds([]);
    }
  }

  function addFiles(nextFiles: File[]) {
    const images = nextFiles.filter(
      (file) => isStudioImageType(file.type) && file.size > 0 && file.size <= STUDIO_MAX_FILE_BYTES
    );
    if (images.length !== nextFiles.length) {
      toast.error('Yalnızca JPG, PNG veya WebP ve dosya başına en fazla 9 MB yükleyebilirsiniz.');
    }
    if (!images.length) return;
    setFiles((current) => {
      const known = new Set(
        current.map((file) => `${file.name}-${file.size}-${file.lastModified}`)
      );
      const combined = [
        ...current,
        ...images.filter(
          (file) => !known.has(`${file.name}-${file.size}-${file.lastModified}`)
        ),
      ];
      const available = Math.max(0, MAX_PHOTOS - selectedSourceMediaIds.length);
      if (combined.length > available) {
        toast.error(`Tek çalışmada en fazla ${MAX_PHOTOS} fotoğraf işleyebilirsiniz.`);
      }
      const withinCount = combined.slice(0, available);
      let totalBytes = 0;
      const withinSize = withinCount.filter((file) => {
        if (totalBytes + file.size > STUDIO_MAX_TOTAL_BYTES) return false;
        totalBytes += file.size;
        return true;
      });
      if (withinSize.length !== withinCount.length) {
        toast.error('Seçilen fotoğrafların toplam boyutu en fazla 120 MB olabilir.');
      }
      return withinSize;
    });
  }

  async function uploadComputerFiles(): Promise<StudioUploadedFile[]> {
    if (!files.length) return [];
    const prefixResponse = await fetch('/api/fabrika/studio/uploads', {
      cache: 'no-store',
    });
    const prefixData = await responseJson<{
      success?: boolean;
      prefix?: string;
      error?: string;
    }>(prefixResponse);
    if (!prefixResponse.ok || !prefixData.success || !prefixData.prefix) {
      throw new Error(prefixData.error || 'Fotoğraf yükleme alanı hazırlanamadı.');
    }

    const results = new Array<StudioUploadedFile>(files.length);
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < files.length) {
        const index = nextIndex;
        nextIndex += 1;
        const file = files[index];
        const pathname = `${prefixData.prefix}/${String(index + 1).padStart(2, '0')}-${crypto.randomUUID()}-${studioUploadFileName(file.name)}`;
        const blob = await upload(pathname, file, {
          access: 'public',
          handleUploadUrl: '/api/fabrika/studio/uploads',
          contentType: file.type,
          multipart: file.size > 4 * 1024 * 1024,
        });
        results[index] = {
          url: blob.url,
          pathname: blob.pathname,
          fileName: file.name,
          mimeType: file.type,
          byteSize: file.size,
        };
        setUploadedFileCount((current) => current + 1);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(3, files.length) }, () => worker())
    );
    return results;
  }

  function applyProcessedItem(item: StudioBatchItem) {
    setBatchItems((current) =>
      current.map((candidate) => (candidate.id === item.id ? item : candidate))
    );
    if (!item.outputUrl || !item.outputFileName) return;
    const result: StudioResult = {
      itemId: item.id,
      name: item.outputFileName,
      previewUrl: item.outputUrl,
      downloadUrl: item.outputUrl,
      sourceUrl: item.originalUrl,
      attachedMediaId: item.attachedMediaId,
    };
    setResults((current) => {
      const existingIndex = current.findIndex((candidate) => candidate.itemId === item.id);
      if (existingIndex < 0) return [...current, result];
      return current.map((candidate) =>
        candidate.itemId === item.id ? result : candidate
      );
    });
    setSelectedResultItemIds((current) =>
      current.includes(item.id) ? current : [...current, item.id]
    );
  }

  async function requestBatchItemProcessing(
    targetBatchId: string,
    itemId: string
  ): Promise<StudioBatchItem> {
    setBatchItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, status: 'PROCESSING', errorMessage: null }
          : item
      )
    );
    for (let capacityAttempt = 0; capacityAttempt < 360; capacityAttempt += 1) {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(targetBatchId)}/items/${encodeURIComponent(itemId)}/process`,
        { method: 'POST' }
      );
      const data = await responseJson<{
        success?: boolean;
        error?: string;
        item?: StudioBatchItem;
      }>(response);
      if (response.status === 409) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
        continue;
      }
      if (response.status === 429) {
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
        continue;
      }
      if (!response.ok || !data.success || !data.item) {
        throw new Error(data.error || 'Fotoğraf iyileştirilemedi.');
      }
      applyProcessedItem(data.item);
      return data.item;
    }
    throw new Error('Fotoğraf işleme sırası zaman aşımına uğradı.');
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files || []));
    event.target.value = '';
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (!event.dataTransfer.types.includes('Files')) return;
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  function selectPreset(preset: StudioEnhancementPreset) {
    setSelectedPresetId(preset.id);
    setEnhancementInstruction(preset.prompt);
  }

  async function createDraftProperty(
    title: string,
    location: string,
    options: {
      listingType?: 'SALE' | 'RENT';
      price?: number | null;
      status?: 'ACTIVE' | 'DRAFT';
    } = {}
  ) {
    const safeTitle = title.trim();
    if (safeTitle.length < 3) {
      throw new Error('Yeni portföy için en az 3 karakterlik bir ad yazın.');
    }
    const referenceCode = `ST-${window.crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const response = await fetch('/api/fabrika/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create-property',
        title: safeTitle,
        referenceCode,
        location: location.trim() || null,
        listingType: options.listingType || 'SALE',
        price: options.price ?? null,
        status: options.status || 'DRAFT',
      }),
    });
    const data = await responseJson<{
      success?: boolean;
      error?: string;
      workspace?: { properties?: WorkspaceProperty[] };
    }>(response);
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Yeni portföy oluşturulamadı.');
    }
    const properties = data.workspace?.properties || [];
    const created = properties.find((property) => property.referenceCode === referenceCode);
    if (!created) throw new Error('Portföy oluşturuldu ancak yeni kayıt açılamadı.');
    setWorkspaceProperties(properties);
    setSelectedPropertyId(created.id);
    return created.id;
  }

  async function startProcessing() {
    if (source === 'portfolio' && !selectedPropertyId) {
      toast.error('Önce bir portföy seçin.');
      return;
    }
    if (!totalSelected) {
      toast.error('İyileştirmek için en az bir fotoğraf ekleyin.');
      fileInputRef.current?.focus();
      return;
    }
    if (!enhancementInstruction.trim()) {
      toast.error('Bir iyileştirme seçeneği belirleyin.');
      return;
    }

    setIsProcessing(true);
    setUploadedFileCount(0);
    setErrorMessage('');
    try {
      const uploadedFiles = await uploadComputerFiles();
      const response = await fetch('/api/fabrika/studio/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          prompt: enhancementInstruction.trim(),
          preset: selectedPresetId,
          title:
            selectedProperty?.title ||
            fileTitle(files[0]?.name || 'Yeni fotoğraf çalışması'),
          propertyId: selectedPropertyId || null,
          mediaIds: selectedSourceMediaIds,
          uploadedFiles,
        }),
      });
      const data = await responseJson<{
        success?: boolean;
        error?: string;
        batch?: { id: string; items?: StudioBatchItem[] };
      }>(response);
      if (!response.ok || !data.success || !data.batch) {
        throw new Error(data.error || 'Fotoğraf iyileştirme başlatılamadı.');
      }
      const nextBatchId = data.batch.id;
      const nextItems = data.batch.items || [];
      setBatchId(nextBatchId);
      applyBatchSnapshot(nextItems);
      setSelectedResultItemIds([]);
      setActiveResult(0);
      setComparePosition(50);
      setFiles([]);
      setSelectedSourceMediaIds([]);
      window.sessionStorage.removeItem(STUDIO_DRAFT_KEY);
      setScreen('results');
      setActiveTab('enhancer');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      await runStudioProcessingQueue({
        items: nextItems,
        concurrency: STUDIO_PROCESSING_CONCURRENCY,
        process: (item) => requestBatchItemProcessing(nextBatchId, item.id),
        onSettled: (result, item) => {
          if (result.status === 'fulfilled') return;
          const message =
            result.reason instanceof Error
              ? result.reason.message
              : 'Fotoğraf iyileştirilemedi.';
          setBatchItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? { ...candidate, status: 'FAILED', errorMessage: message }
                : candidate
            )
          );
        },
      });

      const finalResponse = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(nextBatchId)}`,
        { cache: 'no-store' }
      );
      const finalData = await responseJson<{
        success?: boolean;
        batch?: { items?: StudioBatchItem[] };
      }>(finalResponse);
      const finalItems =
        finalResponse.ok && finalData.success && finalData.batch?.items
          ? finalData.batch.items
          : nextItems;
      applyBatchSnapshot(finalItems);
      await loadRecentBatches();
      const failureCount = finalItems.filter((item) => item.status === 'FAILED').length;
      const readyCount = finalItems.filter((item) =>
        ['COMPLETED', 'ATTACHED'].includes(item.status)
      ).length;
      if (failureCount) {
        toast.error(
          `${readyCount}/${nextItems.length} fotoğraf hazır; ${failureCount} fotoğraf tekrar denenebilir.`
        );
      } else {
        toast.success(`${readyCount}/${nextItems.length} fotoğraf tamamlandı.`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Fotoğraflar işleme alınamadı.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
      setUploadedFileCount(0);
    }
  }

  async function openBatch(
    nextBatchId: string,
    destination: 'results' | 'portfolio' = 'results',
    preferredItemId?: string
  ) {
    setErrorMessage('');
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(nextBatchId)}`,
        { cache: 'no-store' }
      );
      const data = await responseJson<{
        success?: boolean;
        error?: string;
        batch?: { propertyId?: string | null; items?: StudioBatchItem[] };
      }>(response);
      if (!response.ok || !data.success || !data.batch) {
        throw new Error(data.error || 'Çalışma açılamadı.');
      }
      const nextItems = data.batch.items || [];
      const completed = studioResultsFromItems(nextItems);
      setBatchId(nextBatchId);
      setBatchItems(nextItems);
      setResults(completed);
      setSelectedResultItemIds(
        preferredItemId && completed.some((item) => item.itemId === preferredItemId)
          ? [preferredItemId]
          : completed.map((item) => item.itemId)
      );
      setSelectedPropertyId(data.batch.propertyId || '');
      setAttachedPropertyId(
        completed.some((item) => item.attachedMediaId)
          ? data.batch.propertyId || ''
          : ''
      );
      setActiveResult(0);
      setComparePosition(50);
      if (destination === 'portfolio') {
        const preferred = completed.find((item) => item.itemId === preferredItemId);
        setNewPropertyTitle(
          data.batch.propertyId
            ? selectedProperty?.title || fileTitle(preferred?.name || completed[0]?.name || '')
            : fileTitle(preferred?.name || completed[0]?.name || '')
        );
        setNewPropertyLocation('');
        setDrawerListingType('SALE');
        setDrawerPrice('');
        setDrawerStatus('DRAFT');
        setIsPortfolioDrawerOpen(true);
      } else {
        setScreen('results');
        setActiveTab('enhancer');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Çalışma açılamadı.');
    }
  }

  async function renameBatch(batchIdToRename: string) {
    const title = editingTitle.trim();
    if (!title) {
      toast.error('Çalışma adı boş bırakılamaz.');
      return;
    }
    setIsSavingTitle(true);
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchIdToRename)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        }
      );
      const data = await responseJson<{ success?: boolean; error?: string }>(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Çalışma adı kaydedilemedi.');
      }
      setRecentBatches((current) =>
        current.map((batch) =>
          batch.id !== batchIdToRename
            ? batch
            : {
                ...batch,
                title,
              }
        )
      );
      setEditingBatchId(null);
      toast.success('Çalışma adı güncellendi.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Çalışma adı kaydedilemedi.');
    } finally {
      setIsSavingTitle(false);
    }
  }

  async function loadAttachTargetMedia(propertyId: string) {
    const requestId = ++attachMediaRequestRef.current;
    setIsLoadingAttachTargetMedia(true);
    setAttachTargetMedia([]);
    try {
      const response = await fetch(
        `/api/fabrika/properties/${encodeURIComponent(propertyId)}/media`,
        { cache: 'no-store' }
      );
      const data = await responseJson<{
        success?: boolean;
        error?: string;
        items?: PropertyMediaSummary[];
      }>(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Portföy galerisi yüklenemedi.');
      }
      if (requestId === attachMediaRequestRef.current) {
        setAttachTargetMedia(data.items || []);
      }
    } catch (error) {
      if (requestId === attachMediaRequestRef.current) {
        setAttachTargetMedia([]);
        toast.error(error instanceof Error ? error.message : 'Portföy galerisi yüklenemedi.');
      }
    } finally {
      if (requestId === attachMediaRequestRef.current) {
        setIsLoadingAttachTargetMedia(false);
      }
    }
  }

  function showAttachModal(
    nextBatchId: string,
    targetPropertyId: string,
    candidates: StudioResult[],
    preferredItemIds?: string[]
  ) {
    const selectableIds = candidates
      .filter((result) => !result.attachedMediaId)
      .map((result) => result.itemId);
    const preferredIds = (preferredItemIds || []).filter((itemId) =>
      selectableIds.includes(itemId)
    );

    setAttachBatchId(nextBatchId);
    setAttachTargetPropertyId(targetPropertyId);
    setAttachCandidates(candidates);
    setSelectedAttachItemIds(preferredIds.length ? preferredIds : selectableIds);
    setIsAttachModalOpen(true);
    void loadAttachTargetMedia(targetPropertyId);
  }

  function openCurrentAttachModal(targetPropertyId: string) {
    if (!batchId || !targetPropertyId || !results.length) return;
    showAttachModal(batchId, targetPropertyId, results, selectedResultItemIds);
  }

  async function attachHistoryBatch(entry: StudioHistoryEntry) {
    if (!entry.property?.id) {
      await openBatch(entry.batchId, 'portfolio');
      return;
    }
    if (!entry.attachableItemIds.length) return;

    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(entry.batchId)}`,
        { cache: 'no-store' }
      );
      const data = await responseJson<{
        success?: boolean;
        error?: string;
        batch?: { items?: StudioBatchItem[] };
      }>(response);
      if (!response.ok || !data.success || !data.batch) {
        throw new Error(data.error || 'Çalışma fotoğrafları açılamadı.');
      }
      const candidates = studioResultsFromItems(data.batch.items || []);
      showAttachModal(
        entry.batchId,
        entry.property.id,
        candidates,
        entry.attachableItemIds
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Çalışma fotoğrafları açılamadı.');
    }
  }

  async function confirmAttachSelection() {
    if (
      !attachBatchId ||
      !attachTargetPropertyId ||
      !selectedAttachItemIds.length ||
      isAttaching
    ) {
      return;
    }

    setIsAttaching(true);
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(attachBatchId)}/attach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: attachTargetPropertyId,
            itemIds: selectedAttachItemIds,
          }),
        }
      );
      const data = await responseJson<{
        success?: boolean;
        error?: string;
        items?: Array<{ id: string; fingerprint: string }>;
      }>(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Fotoğraflar portföye eklenemedi.');
      }

      const attachedByItem = new Map(
        (data.items || []).map((item) => [
          item.fingerprint.replace(/^studio-item:/, ''),
          item.id,
        ])
      );
      if (batchId === attachBatchId) {
        setResults((current) =>
          current.map((result) => ({
            ...result,
            attachedMediaId:
              attachedByItem.get(result.itemId) || result.attachedMediaId,
          }))
        );
      }
      setRecentBatches((current) =>
        current.map((batch) =>
          batch.id !== attachBatchId
            ? batch
            : {
                ...batch,
                property: attachTargetProperty
                  ? {
                      id: attachTargetProperty.id,
                      title: attachTargetProperty.title,
                      location: attachTargetProperty.location,
                    }
                  : batch.property,
                items: batch.items.map((item) => ({
                  ...item,
                  attachedMediaId:
                    attachedByItem.get(item.id) || item.attachedMediaId,
                })),
              }
        )
      );
      setSelectedPropertyId(attachTargetPropertyId);
      setAttachedPropertyId(attachTargetPropertyId);
      setIsAttachModalOpen(false);
      await loadRecentBatches();
      toast.success(`${data.items?.length || selectedAttachItemIds.length} fotoğraf portföye eklendi.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fotoğraflar portföye eklenemedi.');
    } finally {
      setIsAttaching(false);
    }
  }

  async function downloadSelectedResults() {
    if (!batchId || !selectedResultItemIds.length || isPreparingZip) return;
    setIsPreparingZip(true);
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}/zip`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemIds: selectedResultItemIds }),
        }
      );
      if (!response.ok) {
        const data = await responseJson<{ error?: string }>(response);
        throw new Error(data.error || 'İndirme dosyası hazırlanamadı.');
      }
      const archive = await response.blob();
      const archiveUrl = URL.createObjectURL(archive);
      const anchor = document.createElement('a');
      anchor.href = archiveUrl;
      anchor.download = 'Business_CEO_AI_Studio_Fotograflar.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(archiveUrl), 1_000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fotoğraflar indirilemedi.');
    } finally {
      setIsPreparingZip(false);
    }
  }

  async function attachSelectedResults(
    targetPropertyId = selectedPropertyId,
    makeCover = false
  ) {
    if (!batchId || !targetPropertyId || !selectedResultItemIds.length) return false;
    setIsAttaching(true);
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}/attach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: targetPropertyId,
            itemIds: selectedResultItemIds,
          }),
        }
      );
      const data = await responseJson<{
        success?: boolean;
        error?: string;
        items?: Array<{ id: string; fingerprint: string }>;
      }>(response);
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Fotoğraflar portföye eklenemedi.');
      }
      const attachedByItem = new Map(
        (data.items || []).map((item) => [
          item.fingerprint.replace('studio-item:', ''),
          item.id,
        ])
      );
      setResults((current) =>
        current.map((result) => ({
          ...result,
          attachedMediaId: attachedByItem.get(result.itemId) || result.attachedMediaId,
        }))
      );
      if (makeCover) {
        const firstId = selectedResultItemIds[0];
        const coverMediaId =
          attachedByItem.get(firstId) ||
          results.find((result) => result.itemId === firstId)?.attachedMediaId;
        if (coverMediaId) {
          const coverResponse = await fetch(
            `/api/fabrika/properties/${encodeURIComponent(targetPropertyId)}/media/${encodeURIComponent(coverMediaId)}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ isCover: true }),
            }
          );
          const coverData = await responseJson<{ success?: boolean; error?: string }>(
            coverResponse
          );
          if (!coverResponse.ok || !coverData.success) {
            throw new Error(coverData.error || 'Kapak fotoğrafı ayarlanamadı.');
          }
        }
      }
      setSelectedPropertyId(targetPropertyId);
      setAttachedPropertyId(targetPropertyId);
      await loadRecentBatches();
      toast.success(`${data.items?.length || 0} fotoğraf portföye eklendi.`);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Fotoğraflar portföye eklenemedi.'
      );
      return false;
    } finally {
      setIsAttaching(false);
    }
  }

  async function createPortfolioAndAttach() {
    setIsCreatingPortfolio(true);
    try {
      const propertyId = await createDraftProperty(
        newPropertyTitle,
        newPropertyLocation,
        {
          listingType: drawerListingType,
          price: drawerPrice.trim() ? Number(drawerPrice.replace(/\D/g, '')) : null,
          status: drawerStatus,
        }
      );
      if (!batchId || !selectedResultItemIds.length) {
        setIsPortfolioDrawerOpen(false);
        toast.success('Yeni portföy oluşturuldu.');
        return;
      }
      const attached = await attachSelectedResults(propertyId);
      if (attached) {
        toast.success('Yeni portföy hazır. Fotoğrafları sıralayabilirsiniz.');
        setIsPortfolioDrawerOpen(false);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Yeni portföy oluşturulamadı.');
    } finally {
      setIsCreatingPortfolio(false);
    }
  }

  async function retryBatchItem(itemId: string) {
    if (!batchId) return;
    setBatchItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? { ...item, status: 'PROCESSING', errorMessage: null }
          : item
      )
    );
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}/process`,
        { method: 'POST' }
      );
      const data = await responseJson<{
        success?: boolean;
        error?: string;
        item?: StudioBatchItem;
      }>(response);
      if (!response.ok || !data.success || !data.item?.outputUrl) {
        throw new Error(data.error || 'Fotoğraf yeniden işlenemedi.');
      }
      const item = data.item;
      setBatchItems((current) =>
        current.map((candidate) => (candidate.id === item.id ? item : candidate))
      );
      const result = {
        itemId: item.id,
        name: item.outputFileName || item.originalFileName,
        previewUrl: item.outputUrl!,
        downloadUrl: item.outputUrl!,
        sourceUrl: item.originalUrl,
        attachedMediaId: item.attachedMediaId,
      };
      setResults((current) =>
        current.some((candidate) => candidate.itemId === item.id)
          ? current
          : [...current, result]
      );
      setSelectedResultItemIds((current) =>
        current.includes(item.id) ? current : [...current, item.id]
      );
      toast.success('Fotoğraf yeniden işlendi.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Fotoğraf yeniden işlenemedi.';
      setBatchItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? { ...item, status: 'FAILED', errorMessage: message }
            : item
        )
      );
      toast.error(message);
    }
  }

  function resetStudio() {
    setScreen('upload');
    setActiveTab('enhancer');
    setFiles([]);
    setResults([]);
    setBatchId(null);
    setBatchItems([]);
    setSelectedResultItemIds([]);
    setActiveResult(0);
    setAttachedPropertyId('');
    setErrorMessage('');
  }

  return layoutVersion === 'studio-grid' ? (
    <div className={styles.studioWorkspace}>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        id="studio-photo-upload"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      {screen === 'upload' ? (
        <main className={styles.studioGrid}>
          <aside className={styles.uploadRail} aria-label="Yeni fotoğraf çalışması">
            <button
              className={styles.portfolioSelectButton}
              onClick={() => {
                chooseSource('portfolio');
                setIsPortfolioModalOpen(true);
              }}
              type="button"
            >
              <span className={styles.portfolioSelectIcon}><Building2 aria-hidden="true" /></span>
              <span>
                <b>Portföyden Seç</b>
                <small>Mevcut portföyünüzün fotoğraflarıyla devam edin.</small>
              </span>
            </button>

            <div className={styles.orDivider}><span>veya</span></div>

            <section
              aria-describedby="studio-upload-help"
              className={styles.dropStudio}
              data-dragging={isDraggingFiles}
              data-has-selection={totalSelected > 0}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={(event) => {
                chooseSource('computer');
                handleDrop(event);
              }}
            >
              <span className={styles.dropStudioArtwork} aria-hidden="true">
                <Image
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 920px) 100vw, 360px"
                  src="/studio/upload-villa-blue-hour.png"
                />
              </span>
              <span className={styles.dropStudioShade} aria-hidden="true" />
              <button
                className={styles.dropStudioPicker}
                onClick={() => {
                  chooseSource('computer');
                  fileInputRef.current?.click();
                }}
                type="button"
              >
                <span className={styles.uploadCloud}><UploadCloud aria-hidden="true" /></span>
                <span className={styles.dropTitle}>
                  <b>{isDraggingFiles ? 'FOTOĞRAFLARI ŞİMDİ' : 'DOSYAYI BURAYA'}</b>
                  <strong>{isDraggingFiles ? 'BIRAK' : 'SÜRÜKLE'}</strong>
                </span>
                <span className={styles.dropDescription}>
                  Fotoğraflarınızı buraya bırakın<br />veya dosyalarınızdan seçin.
                </span>
                <span className={styles.fileSelectButton}>
                  <FolderOpen aria-hidden="true" /> {totalSelected ? 'Başka Fotoğraf Ekle' : 'Dosya Seç'}
                </span>
                <small className={styles.dropRules} id="studio-upload-help">
                  JPG, PNG ve WEBP · En fazla {MAX_PHOTOS} fotoğraf
                </small>
              </button>

              {totalSelected > 0 && (
                <div className={styles.selectionTray} aria-label="Seçilen fotoğraflar">
                <div className={styles.selectionTrayHeader}>
                  <span><Images aria-hidden="true" /></span>
                  <div>
                    <b>{totalSelected} fotoğraf hazır</b>
                    <small>
                      {selectedProperty
                        ? `${selectedProperty.title} portföyünden ve cihazınızdan seçildi.`
                        : 'Bilgisayarınızdan seçildi.'}
                    </small>
                  </div>
                  <button
                    aria-label="Seçimi temizle"
                    onClick={() => {
                      setFiles([]);
                      setSelectedSourceMediaIds([]);
                    }}
                    type="button"
                  ><X aria-hidden="true" /></button>
                </div>

                <div className={styles.selectionPreviewStrip}>
                  {selectedPropertyMedia.slice(0, 4).map((item) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" key={item.id} src={item.url} />
                  ))}
                  {filePreviews.slice(0, Math.max(0, 4 - selectedPropertyMedia.length)).map(({ file, url }) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" key={`${file.name}-${file.lastModified}`} src={url} />
                  ))}
                  {totalSelected > 4 && <span>+{totalSelected - 4}</span>}
                </div>

                <details className={styles.specialInstruction}>
                  <summary><SlidersHorizontal aria-hidden="true" /> Özel talimat ekle</summary>
                  <textarea
                    aria-label="Özel iyileştirme talimatı"
                    maxLength={10_000}
                    onChange={(event) => {
                      setEnhancementInstruction(event.target.value);
                      setSelectedPresetId('custom');
                    }}
                    placeholder="Örneğin: Manzarayı değiştirmeden odayı daha aydınlık göster."
                    rows={3}
                    value={selectedPresetId === 'custom' ? enhancementInstruction : ''}
                  />
                </details>

                {errorMessage && <p className={styles.inlineError} role="alert">{errorMessage}</p>}
                <button
                  className={styles.processButton}
                  disabled={!isSelectionReady || isProcessing}
                  onClick={() => void startProcessing()}
                  type="button"
                >
                  {isProcessing ? <Loader2 className={styles.spin} /> : <Sparkles />}
                  {isProcessing
                    ? files.length && uploadedFileCount < files.length
                      ? `Fotoğraflar yükleniyor · ${uploadedFileCount}/${files.length}`
                      : 'Çalışma başlatılıyor…'
                    : 'Fotoğrafları otomatik iyileştir'}
                  {!isProcessing && <ArrowRight aria-hidden="true" />}
                </button>
                </div>
              )}
            </section>
          </aside>

          <section className={styles.historyWorkspace} aria-labelledby="studio-history-title">
            <div className={styles.workspaceTopline}>
              <div>
                <h1 id="studio-history-title">Geçmiş Çalışmalarım</h1>
                <p>İyileştirdiğiniz fotoğrafları açın, yeniden adlandırın veya portföye bağlayın.</p>
              </div>
              <button
                className={styles.refreshButton}
                onClick={() => void loadRecentBatches()}
                type="button"
              ><RefreshCw aria-hidden="true" /> Yenile</button>
            </div>

            <div className={styles.historyToolbar}>
              <div className={styles.sourceTabs} role="tablist" aria-label="Çalışma kaynağı">
                {([
                  ['all', 'Tümü', Grid2X2],
                  ['computer', 'Bilgisayarınızdan', Monitor],
                  ['portfolio', 'Portföyünüzden', Building2],
                ] as const).map(([value, label, Icon]) => (
                  <button
                    aria-selected={historyFilter === value}
                    key={value}
                    onClick={() => setHistoryFilter(value)}
                    role="tab"
                    type="button"
                  ><Icon aria-hidden="true" /> {label}</button>
                ))}
              </div>

              <div className={styles.toolbarActions}>
                <label className={styles.historySearch}>
                  <Search aria-hidden="true" />
                  <span className="sr-only">Çalışmalarda ara</span>
                  <input
                    onChange={(event) => setHistorySearch(event.target.value)}
                    placeholder="Çalışma ara…"
                    type="search"
                    value={historySearch}
                  />
                </label>
                <button
                  aria-pressed={showOnlyReady}
                  className={styles.filterButton}
                  onClick={() => setShowOnlyReady((current) => !current)}
                  type="button"
                ><Filter aria-hidden="true" /> Hazır olanlar</button>
                <div className={styles.viewSwitch} aria-label="Görünüm" role="group">
                  <button
                    aria-label="Kart görünümü"
                    aria-pressed={historyView === 'grid'}
                    onClick={() => setHistoryView('grid')}
                    type="button"
                  ><Grid2X2 aria-hidden="true" /></button>
                  <button
                    aria-label="Liste görünümü"
                    aria-pressed={historyView === 'list'}
                    onClick={() => setHistoryView('list')}
                    type="button"
                  ><List aria-hidden="true" /></button>
                </div>
              </div>
            </div>

            {visibleHistoryEntries.length > 0 ? (
              <div className={styles.historyCards} data-view={historyView}>
                {visibleHistoryEntries.map((entry) => {
                  const summary = entry.summary;
                  const isReady = summary.ready;
                  const isEditing = editingBatchId === entry.batchId;
                  return (
                    <article className={styles.workCard} key={entry.id}>
                      <div className={styles.cardMedia}>
                        {/* Tenant-owned media URLs are displayed directly. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={`${entry.batchTitle} orijinal fotoğrafı`} src={entry.originalUrl} />
                        {entry.outputUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            alt={`${entry.batchTitle} iyileştirilmiş fotoğrafı`}
                            className={styles.cardAfterImage}
                            src={entry.outputUrl}
                          />
                        )}
                        {entry.outputUrl && (
                          <span className={styles.cardCompareLine} aria-hidden="true"><i /></span>
                        )}
                        <span className={styles.batchPhotoCount}>
                          <Images aria-hidden="true" /> {entry.itemCount} fotoğraf
                        </span>
                        <button
                          aria-label={`${entry.batchTitle} çalışmasını aç`}
                          className={styles.cardOpenOverlay}
                          disabled={!summary.openable}
                          onClick={() => void openBatch(entry.batchId)}
                          type="button"
                        />
                        <button className={styles.cardMenu} title="Çalışmayı aç" onClick={() => void openBatch(entry.batchId)} type="button">
                          <EllipsisVertical aria-hidden="true" />
                        </button>
                        {!isReady && (
                          <span className={styles.processingBadge}>
                            <Loader2 className={styles.spin} /> {summary.label}
                          </span>
                        )}
                      </div>

                      <div className={styles.cardBody}>
                        <div className={styles.cardTitleRow}>
                          {isEditing ? (
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                void renameBatch(entry.batchId);
                              }}
                            >
                              <input
                                aria-label="Çalışma adı"
                                autoFocus
                                maxLength={180}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                value={editingTitle}
                              />
                              <button aria-label="Kaydet" disabled={isSavingTitle} type="submit"><Check /></button>
                              <button aria-label="Vazgeç" onClick={() => setEditingBatchId(null)} type="button"><X /></button>
                            </form>
                          ) : (
                            <>
                              <h2>{entry.batchTitle}</h2>
                              <button
                                aria-label={`${entry.batchTitle} adını değiştir`}
                                onClick={() => {
                                  setEditingBatchId(entry.batchId);
                                  setEditingTitle(entry.batchTitle);
                                }}
                                type="button"
                              ><Pencil aria-hidden="true" /></button>
                            </>
                          )}
                        </div>
                        <div className={styles.cardMeta}>
                          <span><CalendarDays aria-hidden="true" /> {formatStudioDate(entry.createdAt)}</span>
                          <span data-ready={isReady}>
                            {isReady ? <Check aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
                            {isReady ? 'Tamamlandı' : summary.label}
                          </span>
                        </div>
                        <div className={styles.cardActions}>
                          {entry.allReadyItemsAttached ? (
                            <span className={styles.attachedState}><CheckCircle2 /> Tümü portföye bağlı</span>
                          ) : (
                            <button
                              disabled={!isReady || isAttaching}
                              onClick={() => void attachHistoryBatch(entry)}
                              type="button"
                            >
                              {entry.property ? <ImagePlus /> : <Building2 />}
                              {entry.property
                                ? `${entry.attachableItemIds.length} fotoğrafı portföye ekle`
                                : 'Portföy oluştur'}
                            </button>
                          )}
                          <button
                            aria-label={`${entry.batchTitle} çalışmasındaki ${entry.itemCount} fotoğrafı aç`}
                            className={styles.cardOpenButton}
                            disabled={!summary.openable}
                            onClick={() => void openBatch(entry.batchId)}
                            type="button"
                          >
                            <Maximize2 aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : isLoadingBatches ? (
              <div className={styles.historyEmpty} role="status">
                <Loader2 className={styles.spin} /> Çalışmalar yükleniyor…
              </div>
            ) : (
              <div className={styles.historyEmpty}>
                <span><FileImage aria-hidden="true" /></span>
                <h2>{historyEntries.length ? 'Bu filtrede çalışma yok' : 'Henüz çalışma yok'}</h2>
                <p>
                  {historyEntries.length
                    ? 'Aramayı veya filtreyi temizleyerek diğer çalışmalarınızı görebilirsiniz.'
                    : 'Soldan fotoğraf seçtiğinizde ilk çalışmanız burada görünecek.'}
                </p>
                {historyEntries.length > 0 && (
                  <button onClick={() => { setHistoryFilter('all'); setHistorySearch(''); setShowOnlyReady(false); }} type="button">
                    Filtreleri temizle
                  </button>
                )}
              </div>
            )}
          </section>
        </main>
      ) : (
        <main className={styles.resultWorkspace}>
          <div className={styles.resultTopbar}>
            <button onClick={resetStudio} type="button"><ArrowRight className={styles.backArrow} /> Geçmiş çalışmalara dön</button>
            <div>
              <span>
                <CheckCircle2 />
                {batchFailedCount
                  ? `${batchReadyCount}/${batchTotalCount} fotoğraf hazır`
                  : 'Çalışma tamamlandı'}
              </span>
              <button className={styles.newWorkCompact} onClick={resetStudio} type="button"><Plus /> Yeni çalışma</button>
            </div>
          </div>

          {activePhoto ? (
            <section className={styles.resultDetail}>
              <div className={styles.resultCompare}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Orijinal fotoğraf" src={activePhoto.sourceUrl} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="İyileştirilmiş fotoğraf"
                  className={styles.resultAfter}
                  src={activePhoto.previewUrl}
                  style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}
                />
                <span className={styles.resultBeforeLabel}>Önce</span>
                <span className={styles.resultAfterLabel}>Sonra</span>
                <i className={styles.resultCompareLine} style={{ left: `${comparePosition}%` }}><Maximize2 /></i>
                <input
                  aria-label="Önce ve sonra karşılaştırma çizgisi"
                  max="100"
                  min="0"
                  onChange={(event) => setComparePosition(Number(event.target.value))}
                  type="range"
                  value={comparePosition}
                />
              </div>
              <aside className={styles.resultActions}>
                <span>Seçili fotoğraf</span>
                <h1>{activePhoto.name}</h1>
                <p>Orijinal görüntü korunarak otomatik olarak iyileştirildi.</p>
                <a download={activePhoto.name} href={activePhoto.downloadUrl}><Download /> Bu fotoğrafı indir</a>
                <button onClick={() => void openBatch(batchId || '', 'portfolio', activePhoto.itemId)} type="button"><Building2 /> Portföye ekle veya oluştur</button>
                <button onClick={() => void downloadSelectedResults()} type="button"><Images /> Seçili fotoğrafları ZIP indir</button>
              </aside>
            </section>
          ) : (
            <div className={styles.historyEmpty}>Hazır bir sonuç bulunamadı.</div>
          )}

          {results.length > 1 && (
            <section className={styles.resultThumbs}>
              {results.map((result, index) => (
                <button data-active={activeResult === index} key={result.itemId} onClick={() => setActiveResult(index)} type="button">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={result.name} src={result.previewUrl} />
                </button>
              ))}
            </section>
          )}

          {batchItems.some((item) => item.status === 'FAILED') && (
            <section className={styles.retryCard}>
              <h3>Bir fotoğraf güvenli biçimde tamamlanamadı</h3>
              <p>
                Hazır sonuçlar korunur. Güvenlik kontrolünde reddedilen fotoğraf,
                güvenli yerel düzenlemeyle tamamlanır.
              </p>
              {batchItems
                .filter((item) => item.status === 'FAILED')
                .map((item) => (
                  <div key={item.id}>
                    <span>
                      <b>{item.originalFileName}</b>
                      <small>{item.errorMessage || 'Fotoğraf işlenemedi.'}</small>
                    </span>
                    <button onClick={() => void retryBatchItem(item.id)} type="button">
                      <RefreshCw /> Tekrar tamamla
                    </button>
                  </div>
                ))}
            </section>
          )}
        </main>
      )}

      {isPortfolioModalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsPortfolioModalOpen(false);
        }}>
          <section aria-labelledby="portfolio-modal-title" aria-modal="true" className={styles.portfolioModal} role="dialog">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="portfolio-modal-title">Portföyden Fotoğraf Seç</h2>
                <p>Mevcut portföyünüzü ve üzerinde çalışacağınız fotoğrafları seçin.</p>
              </div>
              <button aria-label="Kapat" onClick={() => setIsPortfolioModalOpen(false)} type="button"><X /></button>
            </div>

            <div className={styles.modalContent}>
              <aside className={styles.propertyListPanel}>
                <div className={styles.propertyListTools}>
                  <label><Search /><span className="sr-only">Portföy ara</span><input onChange={(event) => setPortfolioSearch(event.target.value)} placeholder="Portföy ara…" value={portfolioSearch} /></label>
                  <div>
                    {(['all', 'ACTIVE', 'DRAFT'] as const).map((status) => (
                      <button aria-pressed={portfolioStatus === status} key={status} onClick={() => setPortfolioStatus(status)} type="button">
                        {status === 'all' ? 'Tümü' : status === 'ACTIVE' ? 'Aktif' : 'Taslak'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.propertyList}>
                  {filteredWorkspaceProperties.map((property) => (
                    <button
                      aria-pressed={selectedPropertyId === property.id}
                      key={property.id}
                      onClick={() => {
                        setSelectedPropertyId(property.id);
                        setPropertyMedia([]);
                        setSelectedSourceMediaIds([]);
                      }}
                      type="button"
                    >
                      <span className={styles.propertyThumb}>
                        {property.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" src={property.imageUrl} />
                        ) : <Building2 />}
                      </span>
                      <span>
                        <b>{property.title}</b>
                        <small>{property.referenceCode || 'Referans kodu yok'}</small>
                        <small>{property.location || 'Konum eklenmemiş'}</small>
                        <i data-status={property.status.toLowerCase()}>{property.status === 'ACTIVE' ? 'Aktif' : 'Taslak'}</i>
                      </span>
                      {selectedPropertyId === property.id && <Check aria-hidden="true" />}
                    </button>
                  ))}
                </div>
                {!filteredWorkspaceProperties.length && (
                  <p className={styles.propertyListEmpty}>Aramanıza uygun portföy bulunamadı.</p>
                )}
                <button
                  className={styles.newPropertyFromModal}
                  onClick={() => {
                    setIsPortfolioModalOpen(false);
                    setBatchId(null);
                    setSelectedResultItemIds([]);
                    setNewPropertyTitle('');
                    setNewPropertyLocation('');
                    setIsPortfolioDrawerOpen(true);
                  }}
                  type="button"
                ><Plus /> Yeni Portföy Oluştur</button>
              </aside>

              <section className={styles.propertyPhotoPanel}>
                {selectedProperty ? (
                  <>
                    <div className={styles.selectedPropertySummary}>
                      <span className={styles.selectedPropertyCover}>
                        {selectedProperty.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" src={selectedProperty.imageUrl} />
                        ) : <Building2 />}
                      </span>
                      <div>
                        <h3>{selectedProperty.title}</h3>
                        <p>{selectedProperty.referenceCode || 'Referans kodu yok'}</p>
                        <span>{selectedProperty.location || 'Konum eklenmemiş'}</span>
                      </div>
                      <i data-status={selectedProperty.status.toLowerCase()}>{selectedProperty.status === 'ACTIVE' ? 'Aktif' : 'Taslak'}</i>
                    </div>
                    <div className={styles.photoPanelHeader}>
                      <h3>Portföydeki Fotoğraflar</h3>
                      <span>{selectedSourceMediaIds.length} fotoğraf seçildi</span>
                    </div>
                    {isLoadingPropertyMedia ? (
                      <div className={styles.propertyPhotosLoading}><Loader2 className={styles.spin} /> Fotoğraflar yükleniyor…</div>
                    ) : (
                      <div className={styles.propertyPhotos}>
                        {eligiblePropertyMedia.map((item) => {
                          const selected = selectedSourceMediaIds.includes(item.id);
                          return (
                            <button
                              aria-pressed={selected}
                              key={item.id}
                              onClick={() => setSelectedSourceMediaIds((current) =>
                                current.includes(item.id)
                                  ? current.filter((id) => id !== item.id)
                                  : current.length + files.length < MAX_PHOTOS
                                    ? [...current, item.id]
                                    : current
                              )}
                              type="button"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img alt={item.fileName} src={item.url} />
                              <span>{selected && <Check />}</span>
                            </button>
                          );
                        })}
                        <button className={styles.addPropertyPhoto} onClick={() => fileInputRef.current?.click()} type="button">
                          <UploadCloud /><span>Yeni Fotoğraf Ekle</span>
                        </button>
                      </div>
                    )}
                    <p className={styles.modalInfo}><ImagePlus /> Cihazdan eklediğiniz fotoğraflar da aynı çalışmada işlenir.</p>
                  </>
                ) : (
                  <div className={styles.choosePropertyEmpty}><Building2 /><h3>Bir portföy seçin</h3><p>Soldaki listeden portföye dokunduğunuzda fotoğrafları burada açılır.</p></div>
                )}
              </section>
            </div>

            <footer className={styles.modalFooter}>
              <button onClick={() => setIsPortfolioModalOpen(false)} type="button">Vazgeç</button>
              <button
                disabled={!selectedPropertyId || !selectedSourceMediaIds.length}
                onClick={() => {
                  setSource('portfolio');
                  setIsPortfolioModalOpen(false);
                }}
                type="button"
              >Seçilenlerle Devam Et <ArrowRight /></button>
            </footer>
          </section>
        </div>
      )}

      {isAttachModalOpen && (
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isAttaching) {
              setIsAttachModalOpen(false);
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="attach-portfolio-modal-title"
            aria-modal="true"
            className={styles.attachPortfolioModal}
            role="dialog"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="attach-portfolio-modal-title">Portföye Eklenecek Fotoğrafları Seç</h2>
                <p>Portföyün mevcut galerisini görün; bu çalışmadan yalnız istediğiniz fotoğrafları ekleyin.</p>
              </div>
              <button
                aria-label="Kapat"
                disabled={isAttaching}
                onClick={() => setIsAttachModalOpen(false)}
                type="button"
              ><X /></button>
            </div>

            <div className={styles.attachModalContent}>
              <aside className={styles.attachPortfolioPanel}>
                <label className={styles.attachPropertySelect}>
                  <span>Eklenecek portföy</span>
                  <span>
                    <select
                      onChange={(event) => {
                        const nextPropertyId = event.target.value;
                        setAttachTargetPropertyId(nextPropertyId);
                        if (nextPropertyId) void loadAttachTargetMedia(nextPropertyId);
                      }}
                      value={attachTargetPropertyId}
                    >
                      {workspaceProperties.map((property) => (
                        <option key={property.id} value={property.id}>{property.title}</option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" />
                  </span>
                </label>

                {attachTargetProperty ? (
                  <>
                  <div className={styles.attachPropertySummary}>
                    <span className={styles.attachPropertyCover}>
                      {attachTargetProperty.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" src={attachTargetProperty.imageUrl} />
                      ) : <Building2 aria-hidden="true" />}
                    </span>
                    <div>
                      <h3>{attachTargetProperty.title}</h3>
                      <p>{attachTargetProperty.referenceCode || 'Referans kodu yok'}</p>
                      <small>{attachTargetProperty.location || 'Konum eklenmemiş'}</small>
                    </div>
                    <i data-status={attachTargetProperty.status.toLowerCase()}>
                      {attachTargetProperty.status === 'ACTIVE' ? 'Aktif' : 'Taslak'}
                    </i>
                  </div>
                  <dl className={styles.attachPropertyFacts}>
                    <div><dt>İlan türü</dt><dd>{attachTargetProperty.listingType === 'RENT' ? 'Kiralık' : attachTargetProperty.listingType === 'SALE' ? 'Satılık' : 'Belirtilmemiş'}</dd></div>
                    <div><dt>Mülk türü</dt><dd>{attachTargetProperty.propertyType || 'Belirtilmemiş'}</dd></div>
                    <div><dt>Oda / Alan</dt><dd>{attachTargetProperty.roomCount || '—'}{attachTargetProperty.area ? ` · ${attachTargetProperty.area} m²` : ''}</dd></div>
                    <div><dt>Fiyat</dt><dd>{formatPropertyPrice(attachTargetProperty.price)}</dd></div>
                  </dl>
                  </>
                ) : (
                  <div className={styles.attachPropertyMissing}>Portföy bilgileri bulunamadı.</div>
                )}

                <div className={styles.attachGalleryHeading}>
                  <div>
                    <h3>Portföydeki mevcut fotoğraflar</h3>
                    <p>Bu fotoğraflar silinmez veya değiştirilmez.</p>
                  </div>
                  <span>{attachTargetPhotos.length} fotoğraf</span>
                </div>

                {isLoadingAttachTargetMedia ? (
                  <div className={styles.attachGalleryLoading} role="status">
                    <Loader2 className={styles.spin} /> Galeri yükleniyor…
                  </div>
                ) : attachTargetPhotos.length ? (
                  <div className={styles.attachExistingGallery}>
                    {attachTargetPhotos.map((item) => (
                      <figure key={item.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={item.fileName} loading="lazy" src={item.url} />
                        {item.isCover && <figcaption>Kapak</figcaption>}
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className={styles.attachGalleryEmpty}>
                    <ImageIcon aria-hidden="true" />
                    <span>Bu portföyde henüz fotoğraf yok.</span>
                  </div>
                )}

                {attachTargetPropertyId && (
                  <Link
                    className={styles.attachManageGallery}
                    href={`/fabrika/portfoyler?propertyId=${encodeURIComponent(attachTargetPropertyId)}&media=1`}
                  >
                    Mevcut galeriyi düzenle <ArrowRight aria-hidden="true" />
                  </Link>
                )}
              </aside>

              <section className={styles.attachCandidatePanel}>
                <div className={styles.attachCandidateHeader}>
                  <div>
                    <h3>Bu çalışmadan eklenecekler</h3>
                    <p>İstemediğiniz fotoğrafın seçimini kaldırabilirsiniz.</p>
                  </div>
                  <div>
                    <span>{selectedAttachItemIds.length} / {attachableCandidates.length} seçili</span>
                    <button
                      disabled={!attachableCandidates.length}
                      onClick={() =>
                        setSelectedAttachItemIds(
                          allAttachableCandidatesSelected
                            ? []
                            : attachableCandidates.map((result) => result.itemId)
                        )
                      }
                      type="button"
                    >
                      {allAttachableCandidatesSelected
                        ? 'Seçimi kaldır'
                        : 'Tümünü seç'}
                    </button>
                  </div>
                </div>

                <div className={styles.attachCandidateGallery}>
                  {attachCandidates.map((result) => {
                    const alreadyAttached = Boolean(result.attachedMediaId);
                    const selected = selectedAttachItemIds.includes(result.itemId);
                    return (
                      <button
                        aria-label={
                          alreadyAttached
                            ? `${result.name} zaten portföye bağlı`
                            : `${result.name} fotoğrafını ${selected ? 'seçimden çıkar' : 'seç'}`
                        }
                        aria-pressed={selected}
                        data-attached={alreadyAttached}
                        disabled={alreadyAttached}
                        key={result.itemId}
                        onClick={() =>
                          setSelectedAttachItemIds((current) =>
                            current.includes(result.itemId)
                              ? current.filter((itemId) => itemId !== result.itemId)
                              : [...current, result.itemId]
                          )
                        }
                        type="button"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" loading="lazy" src={result.previewUrl} />
                        <span className={styles.attachCandidateCheck}>
                          {alreadyAttached ? <CheckCircle2 /> : selected ? <Check /> : null}
                        </span>
                        <span className={styles.attachCandidateName}>{result.name}</span>
                        {alreadyAttached && <i>Zaten portföyde</i>}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>

            <footer className={styles.attachModalFooter}>
              <p>
                <CheckCircle2 aria-hidden="true" />
                Portföydeki {attachTargetPhotos.length} mevcut fotoğraf korunacak.
              </p>
              <div>
                <button
                  disabled={isAttaching}
                  onClick={() => setIsAttachModalOpen(false)}
                  type="button"
                >Vazgeç</button>
                <button
                  disabled={!attachTargetPropertyId || !selectedAttachItemIds.length || isAttaching}
                  onClick={() => void confirmAttachSelection()}
                  type="button"
                >
                  {isAttaching ? <Loader2 className={styles.spin} /> : <ImagePlus />}
                  {selectedAttachItemIds.length} fotoğrafı portföye ekle
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}

      {isPortfolioDrawerOpen && (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsPortfolioDrawerOpen(false);
        }}>
          <aside aria-labelledby="portfolio-drawer-title" aria-modal="true" className={styles.portfolioDrawer} role="dialog">
            <div className={styles.drawerHeader}>
              <div><h2 id="portfolio-drawer-title">Bu Çalışmadan Portföy Oluştur</h2><p>Çalışmanız ve seçili fotoğraflar yeni portföye bağlanır.</p></div>
              <button aria-label="Kapat" onClick={() => setIsPortfolioDrawerOpen(false)} type="button"><X /></button>
            </div>
            {activePhoto && (
              <div className={styles.drawerPreview}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Seçilen çalışma" src={activePhoto.previewUrl} />
                <span>{activePhoto.name}</span>
              </div>
            )}
            <label>Portföy Adı <b>*</b><input maxLength={180} onChange={(event) => setNewPropertyTitle(event.target.value)} value={newPropertyTitle} /></label>
            <label>İlan Türü <b>*</b><span className={styles.drawerSelect}><select onChange={(event) => setDrawerListingType(event.target.value as 'SALE' | 'RENT')} value={drawerListingType}><option value="SALE">Satılık</option><option value="RENT">Kiralık</option></select><ChevronDown /></span></label>
            <label>Konum <b>*</b><input maxLength={240} onChange={(event) => setNewPropertyLocation(event.target.value)} placeholder="Alanya, Antalya" value={newPropertyLocation} /></label>
            <div className={styles.drawerRow}>
              <label>Fiyat<input inputMode="decimal" onChange={(event) => setDrawerPrice(event.target.value)} placeholder="₺ 28.500.000" value={drawerPrice} /></label>
              <label>Durum <b>*</b><span className={styles.drawerSelect}><select onChange={(event) => setDrawerStatus(event.target.value as 'ACTIVE' | 'DRAFT')} value={drawerStatus}><option value="DRAFT">Taslak</option><option value="ACTIVE">Aktif</option></select><ChevronDown /></span></label>
            </div>
            <label className={styles.drawerCheck}><input defaultChecked type="checkbox" /> <span>İyileştirilen fotoğrafları portföye ekle</span></label>
            <label>Mevcut portföye ekle <small>(isteğe bağlı)</small><span className={styles.drawerSelect}><select onChange={(event) => setSelectedPropertyId(event.target.value)} value={selectedPropertyId}><option value="">Yeni portföy oluştur</option>{workspaceProperties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select><ChevronDown /></span></label>
            <div className={styles.drawerFooter}>
              <button onClick={() => setIsPortfolioDrawerOpen(false)} type="button">Vazgeç</button>
              {selectedPropertyId ? (
                <button disabled={!selectedResultItemIds.length || isAttaching} onClick={() => {
                  setIsPortfolioDrawerOpen(false);
                  openCurrentAttachModal(selectedPropertyId);
                }} type="button">{isAttaching ? <Loader2 className={styles.spin} /> : <ImagePlus />} Portföye Ekle</button>
              ) : (
                <button disabled={newPropertyTitle.trim().length < 3 || isCreatingPortfolio || isAttaching || (Boolean(batchId) && !selectedResultItemIds.length)} onClick={() => void createPortfolioAndAttach()} type="button">{isCreatingPortfolio || isAttaching ? <Loader2 className={styles.spin} /> : <FolderOpen />} Portföyü Oluştur</button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  ) : (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>AI FOTOĞRAF STÜDYOSU</span>
          <h1>Fotoğraflarınızı tek dokunuşla iyileştirin.</h1>
          <p>
            Portföyünüzü seçin veya fotoğrafları yükleyin. Işık, renk, netlik ve
            kalite ayarlarını sistem otomatik yapsın.
          </p>
        </div>
        {screen === 'results' && (
          <button className={styles.newWorkButton} onClick={resetStudio} type="button">
            <Plus aria-hidden="true" /> Yeni çalışma
          </button>
        )}
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="AI Stüdyo bölümleri">
        <button
          aria-selected={activeTab === 'enhancer'}
          onClick={() => setActiveTab('enhancer')}
          role="tab"
          type="button"
        >
          <span><Sparkles aria-hidden="true" /></span>
          <b>Fotoğraf İyileştirici</b>
          <small>Yeni bir çalışma başlatın</small>
        </button>
        <button
          aria-selected={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          role="tab"
          type="button"
        >
          <span><History aria-hidden="true" /></span>
          <b>Geçmiş Çalışmalarım</b>
          <small>Eski sonuçları görüntüleyin</small>
        </button>
      </nav>

      {activeTab === 'enhancer' && screen === 'upload' && (
        <main className={styles.flow} role="tabpanel">
          <ol className={styles.steps} aria-label="Fotoğraf iyileştirme adımları">
            <li aria-current={!isSelectionReady ? 'step' : undefined} data-active="true">
              <span>1</span><b>Fotoğraf ekle</b>
            </li>
            <li
              aria-current={isSelectionReady ? 'step' : undefined}
              data-active={isSelectionReady}
            >
              <span>2</span><b>Kontrol et</b>
            </li>
            <li data-active={isSelectionReady}><span>3</span><b>İyileştir</b></li>
          </ol>

          <section className={styles.flowCard}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionNumber}>1</span>
              <div>
                <h2>Önce fotoğrafları ekleyin</h2>
                <p>En kolay yol bilgisayarınızdan seçmek. İsterseniz kayıtlı bir portföyden de alabilirsiniz.</p>
              </div>
            </div>

            <div className={styles.sourceChoices} role="group" aria-label="Fotoğraf kaynağı">
              <button
                aria-pressed={source === 'computer'}
                onClick={() => chooseSource('computer')}
                type="button"
              >
                <span><UploadCloud aria-hidden="true" /></span>
                <b>Bilgisayardan yükle</b>
                <small>En kolay yol: cihazınızdaki fotoğrafları seçin.</small>
                <CheckCircle2 className={styles.choiceCheck} aria-hidden="true" />
              </button>
              <button
                aria-pressed={source === 'portfolio'}
                onClick={() => chooseSource('portfolio')}
                type="button"
              >
                <span><Home aria-hidden="true" /></span>
                <b>Portföyden fotoğraf al</b>
                <small>Kayıtlı portföyü seçin; fotoğrafları otomatik gelsin.</small>
                <CheckCircle2 className={styles.choiceCheck} aria-hidden="true" />
              </button>
            </div>

            {source === 'portfolio' && (
              <div className={styles.portfolioPicker}>
                <label htmlFor="studio-property">Hangi portföy?</label>
                <div className={styles.selectShell}>
                  <Home aria-hidden="true" />
                  <select
                    id="studio-property"
                    onChange={(event) => {
                      setSelectedPropertyId(event.target.value);
                      setPropertyMedia([]);
                      setSelectedSourceMediaIds([]);
                    }}
                    value={selectedPropertyId}
                  >
                    <option value="">Portföy seçin</option>
                    {workspaceProperties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.title}{property.location ? ` · ${property.location}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronRight aria-hidden="true" />
                </div>
                {isLoadingPropertyMedia && (
                  <p className={styles.inlineStatus} role="status">
                    <Loader2 className={styles.spin} aria-hidden="true" /> Fotoğraflar getiriliyor…
                  </p>
                )}
                {!isLoadingPropertyMedia && selectedProperty && (
                  <p className={styles.inlineSuccess} role="status">
                    <CheckCircle2 aria-hidden="true" />
                    {selectedSourceMediaIds.length
                      ? `${selectedSourceMediaIds.length} uygun fotoğraf otomatik seçildi.`
                      : 'Bu portföyde iyileştirilebilecek fotoğraf bulunamadı.'}
                  </p>
                )}
              </div>
            )}

            {(source === 'computer' || selectedPropertyId) && (
              <>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  id="studio-photo-upload"
                  multiple
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  tabIndex={-1}
                  type="file"
                />
                <button
                  aria-describedby="studio-upload-help"
                  aria-label={
                    source === 'portfolio'
                      ? 'Portföye ek fotoğraf seç'
                      : 'Bilgisayardan fotoğraf seç'
                  }
                  className={styles.dropZone}
                  data-dragging={isDraggingFiles}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  type="button"
                >
                  <span><UploadCloud aria-hidden="true" /></span>
                  <span aria-live="polite" className={styles.dropCopy}>
                    <b>
                      {isDraggingFiles
                        ? 'Fotoğrafları şimdi bırakın'
                        : source === 'portfolio'
                        ? 'Bu portföye başka fotoğraf ekleyin'
                        : 'Fotoğrafları buraya sürükleyin veya tıklayın'}
                    </b>
                    <small>
                      {isDraggingFiles
                        ? 'Bıraktığınız fotoğraflar otomatik olarak önizlemeye eklenecek.'
                        : source === 'portfolio'
                        ? 'Cihazınızdaki ek fotoğrafları da aynı çalışmaya katabilirsiniz.'
                        : 'Dosya Gezgini’nden sürükleyebilir veya cihazınızdan seçebilirsiniz.'}
                    </small>
                  </span>
                  <span className={styles.uploadAction}>
                    {isDraggingFiles
                      ? 'Fotoğrafları bırak'
                      : source === 'portfolio'
                        ? 'Ek fotoğraf seç'
                        : 'Bilgisayardan fotoğraf seç'}
                    <ArrowRight aria-hidden="true" />
                  </span>
                  <small className={styles.uploadRules} id="studio-upload-help">
                    JPG, PNG veya WEBP · En fazla {MAX_PHOTOS} fotoğraf
                  </small>
                </button>
              </>
            )}

            {!isSelectionReady && (
              <div className={styles.firstUseHint}>
                <span><Sparkles aria-hidden="true" /></span>
                <div>
                  <b>
                    {source === 'portfolio' && !selectedPropertyId
                      ? 'Önce yukarıdan bir portföy seçin.'
                      : 'Ayarlarla uğraşmanız gerekmiyor.'}
                  </b>
                  <small>
                    {source === 'portfolio' && !selectedPropertyId
                      ? 'Portföyü seçtiğinizde içindeki uygun fotoğraflar otomatik olarak hazırlanır.'
                      : 'Fotoğrafı seçtikten sonra önizleme açılır; “İyileştir” düğmesine basmanız yeterlidir.'}
                  </small>
                </div>
              </div>
            )}
          </section>

          {isSelectionReady && (
            <section className={styles.flowCard}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>2</span>
                <div>
                  <h2>Fotoğrafları kontrol edin</h2>
                  <p>{totalSelected} fotoğraf hazır. İstemediğinizi kaldırabilirsiniz.</p>
                </div>
                <span className={styles.countBadge}>{totalSelected}/{MAX_PHOTOS}</span>
              </div>

              <div className={styles.photoGrid}>
                {selectedPropertyMedia.map((item) => (
                  <article key={item.id}>
                    {/* Tenant-owned media URLs are displayed directly. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={item.fileName} loading="lazy" src={item.url} />
                    <span>{item.isCover ? 'Kapak fotoğrafı' : 'Portföy fotoğrafı'}</span>
                    <button
                      aria-label={`${item.fileName} fotoğrafını kaldır`}
                      onClick={() =>
                        setSelectedSourceMediaIds((current) =>
                          current.filter((id) => id !== item.id)
                        )
                      }
                      type="button"
                    ><X aria-hidden="true" /></button>
                  </article>
                ))}
                {filePreviews.map(({ file, url }, index) => (
                  <article key={`${file.name}-${file.lastModified}`}>
                    {/* Local object URLs require a native image element. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={file.name} src={url} />
                    <span>Bilgisayardan eklendi</span>
                    <button
                      aria-label={`${file.name} fotoğrafını kaldır`}
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      type="button"
                    ><X aria-hidden="true" /></button>
                  </article>
                ))}
                {totalSelected < MAX_PHOTOS && (
                  <button
                    className={styles.addMorePhoto}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <Plus aria-hidden="true" />
                    <span>Fotoğraf ekle</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {isSelectionReady && (
            <section className={styles.flowCard}>
              <div className={styles.sectionHeading}>
                <span className={styles.sectionNumber}>3</span>
                <div>
                  <h2>Nasıl iyileştirilsin?</h2>
                  <p>Önerilen “Otomatik” seçeneği çoğu fotoğraf için yeterlidir.</p>
                </div>
              </div>

              <div className={styles.presetChoices}>
                {SIMPLE_PRESETS.map((preset) => (
                  <button
                    aria-pressed={selectedPresetId === preset.id}
                    key={preset.id}
                    onClick={() => selectPreset(preset)}
                    type="button"
                  >
                    <span>
                      {preset.id === 'professional-camera' ? (
                        <WandSparkles aria-hidden="true" />
                      ) : preset.id === 'light-color' ? (
                        <SlidersHorizontal aria-hidden="true" />
                      ) : (
                        <ImageIcon aria-hidden="true" />
                      )}
                    </span>
                    <b>
                      {preset.id === 'professional-camera' ? 'Otomatik' : preset.label}
                    </b>
                    <small>{preset.description}</small>
                    <Check className={styles.presetCheck} aria-hidden="true" />
                  </button>
                ))}
              </div>

              <div className={styles.autoEngine}>
                <div>
                  <span><Sparkles aria-hidden="true" /></span>
                  <div>
                    <b>Akıllı analiz açık</b>
                    <small>Sistem her fotoğrafı ayrı analiz edip gereken ayarı uygular.</small>
                  </div>
                </div>
                <ul>
                  <li><Check /> Işık ve pozlama</li>
                  <li><Check /> Renk ve beyaz dengesi</li>
                  <li><Check /> Netlik ve detay</li>
                  <li><Check /> Kontrast ve gölgeler</li>
                </ul>
              </div>

              <details className={styles.advancedSettings}>
                <summary><SlidersHorizontal aria-hidden="true" /> İleri ayarlar</summary>
                <div>
                  <div className={styles.allPresets}>
                    {STUDIO_ENHANCEMENT_PRESETS.map((preset) => (
                      <button
                        aria-pressed={selectedPresetId === preset.id}
                        key={preset.id}
                        onClick={() => selectPreset(preset)}
                        type="button"
                      >{preset.label}</button>
                    ))}
                  </div>
                  <label htmlFor="studio-instruction">Özel iyileştirme talimatı</label>
                  <textarea
                    id="studio-instruction"
                    maxLength={10_000}
                    onChange={(event) => {
                      setEnhancementInstruction(event.target.value);
                      setSelectedPresetId('custom');
                    }}
                    rows={5}
                    value={enhancementInstruction}
                  />
                </div>
              </details>

              {errorMessage && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}

              <div className={styles.startBar}>
                <div>
                  <b>{totalSelected ? `${totalSelected} fotoğraf hazır` : 'Henüz fotoğraf seçilmedi'}</b>
                  <small>İşlem arka planda devam eder; sayfada beklemeniz gerekmez.</small>
                </div>
                <button
                  disabled={!totalSelected || isProcessing || (source === 'portfolio' && !selectedPropertyId)}
                  onClick={() => void startProcessing()}
                  type="button"
                >
                  {isProcessing ? <Loader2 className={styles.spin} /> : <WandSparkles />}
                  {isProcessing ? 'Başlatılıyor…' : 'Fotoğrafları iyileştir'}
                  {!isProcessing && <ArrowRight aria-hidden="true" />}
                </button>
              </div>
            </section>
          )}
        </main>
      )}

      {activeTab === 'enhancer' && screen === 'results' && (
        <main className={styles.results} role="tabpanel">
          <section className={styles.resultHero}>
            <div>
              <span>
                {batchHasPendingItems ? (
                  <Loader2 className={styles.spin} aria-hidden="true" />
                ) : (
                  <CheckCircle2 aria-hidden="true" />
                )}
                {batchHasPendingItems ? 'Fotoğraflar işleniyor' : 'Çalışma tamamlandı'}
              </span>
              <h2>
                {batchTotalCount
                  ? `${batchReadyCount}/${batchTotalCount} fotoğraf hazır`
                  : 'İyileştirilmiş fotoğraflarınız hazır.'}
              </h2>
              <p>
                {batchHasPendingItems
                  ? `Aynı anda en fazla ${STUDIO_PROCESSING_CONCURRENCY} fotoğraf işlenir; biten sonuçlar aşağıda anında görünür.`
                  : 'Ortadaki çizgiyi sürükleyerek önce ve sonra görünümünü karşılaştırın.'}
              </p>
            </div>
            <button
              disabled={!selectedResultItemIds.length || isPreparingZip}
              onClick={() => void downloadSelectedResults()}
              type="button"
            >
              {isPreparingZip ? <Loader2 className={styles.spin} /> : <Download />}
              Seçili fotoğrafları indir
            </button>
          </section>

          {batchTotalCount > 0 && (
            <section className={styles.liveProgress} aria-live="polite">
              <div>
                <div>
                  <b>{batchReadyCount}/{batchTotalCount} tamamlandı</b>
                  <span>
                    {batchReadyCount} hazır
                    {batchFailedCount ? ` · ${batchFailedCount} hata` : ''}
                  </span>
                </div>
                <strong>{batchProgress}%</strong>
              </div>
              <div
                aria-label={`Fotoğraf işleme ilerlemesi yüzde ${batchProgress}`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={batchProgress}
                role="progressbar"
              >
                <i style={{ width: `${batchProgress}%` }} />
              </div>
            </section>
          )}

          {activePhoto ? (
            <section className={styles.comparisonCard}>
              <div className={styles.compareCanvas}>
                {/* Studio result URLs are tenant-owned generated media. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Orijinal fotoğraf" src={activePhoto.sourceUrl} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt="İyileştirilmiş fotoğraf"
                  className={styles.enhancedImage}
                  src={activePhoto.previewUrl}
                  style={{ clipPath: `inset(0 0 0 ${comparePosition}%)` }}
                />
                <span className={styles.beforeLabel}>Önce</span>
                <span className={styles.afterLabel}>Sonra</span>
                <i className={styles.compareLine} style={{ left: `${comparePosition}%` }}>
                  <b><Maximize2 aria-hidden="true" /></b>
                </i>
                <input
                  aria-label="Önce ve sonra karşılaştırma çizgisi"
                  max="100"
                  min="0"
                  onChange={(event) => setComparePosition(Number(event.target.value))}
                  type="range"
                  value={comparePosition}
                />
              </div>
              <aside>
                <span>Seçili fotoğraf</span>
                <h3>{activePhoto.name}</h3>
                <a download={activePhoto.name} href={activePhoto.downloadUrl}>
                  <Download aria-hidden="true" /> Bu fotoğrafı indir
                </a>
                <button
                  onClick={() => {
                    setResults((current) =>
                      current.filter((result) => result.itemId !== activePhoto.itemId)
                    );
                    setSelectedResultItemIds((current) =>
                      current.filter((id) => id !== activePhoto.itemId)
                    );
                    setActiveResult((current) => Math.max(0, current - 1));
                  }}
                  type="button"
                ><X aria-hidden="true" /> Bu sonucu kaldır</button>
              </aside>
            </section>
          ) : batchHasPendingItems ? (
            <section className={styles.processingPlaceholder}>
              <Loader2 className={styles.spin} aria-hidden="true" />
              <h3>İlk fotoğraf hazırlanıyor</h3>
              <p>Hazır olan görsel burada beklemeden açılacak.</p>
            </section>
          ) : (
            <p className={styles.errorMessage}>Hazır bir sonuç bulunamadı.</p>
          )}

          {batchTotalCount > 1 && (
            <section className={styles.resultGallery}>
              <div>
                <h3>Çalışma fotoğrafları</h3>
                <span>
                  {batchReadyCount}/{batchTotalCount} hazır
                  {batchHasPendingItems ? ' · Bitenler hemen açılabilir' : ''}
                </span>
                <button
                  onClick={() =>
                    setSelectedResultItemIds((current) =>
                      current.length === results.length
                        ? []
                        : results.map((result) => result.itemId)
                    )
                  }
                  type="button"
                >
                  {selectedResultItemIds.length === results.length
                    ? 'Seçimi kaldır'
                    : 'Hazır olanların tümünü seç'}
                </button>
              </div>
              <div>
                {batchItems.map((item) => {
                  const result = results.find((candidate) => candidate.itemId === item.id);
                  const resultIndex = result
                    ? results.findIndex((candidate) => candidate.itemId === item.id)
                    : -1;
                  const ready = Boolean(result);
                  const selected = selectedResultItemIds.includes(item.id);
                  return (
                    <article
                      data-active={ready && activeResult === resultIndex}
                      data-status={item.status.toLowerCase()}
                      key={item.id}
                    >
                      <button
                        aria-label={ready ? `${item.originalFileName} sonucunu aç` : `${item.originalFileName} işleniyor`}
                        disabled={!ready}
                        onClick={() => {
                          if (resultIndex >= 0) setActiveResult(resultIndex);
                        }}
                        type="button"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={item.originalFileName}
                          loading="lazy"
                          src={result?.previewUrl || item.originalUrl}
                        />
                        {!ready ? (
                          <span>
                            {item.status === 'FAILED' ? 'Tekrar denenecek' : 'İşleniyor…'}
                          </span>
                        ) : null}
                      </button>
                      <button
                        aria-label={`${item.originalFileName} sonucunu seç`}
                        aria-pressed={selected}
                        disabled={!ready}
                        onClick={() =>
                          setSelectedResultItemIds((current) =>
                            current.includes(item.id)
                              ? current.filter((id) => id !== item.id)
                              : [...current, item.id]
                          )
                        }
                        type="button"
                      ><Check /></button>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {batchItems.some((item) => item.status === 'FAILED') && (
            <section className={styles.retryCard}>
              <h3>Bazı fotoğraflar tamamlanamadı</h3>
              <p>Hazır sonuçlar korunur. Yalnızca hata veren fotoğrafı tekrar deneyin.</p>
              {batchItems
                .filter((item) => item.status === 'FAILED')
                .map((item) => (
                  <div key={item.id}>
                    <span>
                      <b>{item.originalFileName}</b>
                      <small>{item.errorMessage || 'Fotoğraf işlenemedi.'}</small>
                    </span>
                    <button onClick={() => void retryBatchItem(item.id)} type="button">
                      <RefreshCw /> Tekrar dene
                    </button>
                  </div>
                ))}
            </section>
          )}

          <section className={styles.destinationSection}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionNumber}><FolderOpen /></span>
              <div>
                <h2>Fotoğraflarla ne yapmak istersiniz?</h2>
                <p>İndirin, var olan portföye ekleyin veya yeni portföy oluşturun.</p>
              </div>
            </div>
            <div className={styles.destinationGrid}>
              <article>
                <span><Download /></span>
                <h3>Bilgisayarıma indir</h3>
                <p>Seçtiğiniz fotoğrafları tek ZIP dosyası olarak alın.</p>
                <button
                  disabled={!selectedResultItemIds.length || isPreparingZip}
                  onClick={() => void downloadSelectedResults()}
                  type="button"
                >
                  {isPreparingZip ? <Loader2 className={styles.spin} /> : <Download />}
                  Fotoğrafları indir
                </button>
              </article>

              <article>
                <span><Home /></span>
                <h3>Mevcut portföye ekle</h3>
                <p>Portföyü seçin; fotoğraflar medya alanına eklensin.</p>
                <select
                  aria-label="Fotoğrafların ekleneceği portföy"
                  onChange={(event) => setSelectedPropertyId(event.target.value)}
                  value={selectedPropertyId}
                >
                  <option value="">Portföy seçin</option>
                  {workspaceProperties.map((property) => (
                    <option key={property.id} value={property.id}>{property.title}</option>
                  ))}
                </select>
                <button
                  disabled={!selectedPropertyId || !selectedResultItemIds.length || isAttaching}
                  onClick={() => openCurrentAttachModal(selectedPropertyId)}
                  type="button"
                >
                  {isAttaching ? <Loader2 className={styles.spin} /> : <ImagePlus />}
                  Portföye ekle
                </button>
              </article>

              <article>
                <span><Plus /></span>
                <h3>Yeni portföy oluştur</h3>
                <p>Fotoğraflarla birlikte yeni bir portföy taslağı açın.</p>
                <input
                  aria-label="Yeni portföy adı"
                  maxLength={180}
                  onChange={(event) => setNewPropertyTitle(event.target.value)}
                  placeholder="Portföy adı"
                  value={newPropertyTitle}
                />
                <input
                  aria-label="Yeni portföy konumu"
                  maxLength={240}
                  onChange={(event) => setNewPropertyLocation(event.target.value)}
                  placeholder="Konum (isteğe bağlı)"
                  value={newPropertyLocation}
                />
                <button
                  disabled={
                    newPropertyTitle.trim().length < 3 ||
                    !selectedResultItemIds.length ||
                    isCreatingPortfolio ||
                    isAttaching
                  }
                  onClick={() => void createPortfolioAndAttach()}
                  type="button"
                >
                  {isCreatingPortfolio || isAttaching ? (
                    <Loader2 className={styles.spin} />
                  ) : (
                    <Plus />
                  )}
                  Oluştur ve fotoğrafları ekle
                </button>
              </article>
            </div>

            {mediaEditorPropertyId && results.some((result) => result.attachedMediaId) && (
              <div className={styles.mediaEditorCallout}>
                <span><Images aria-hidden="true" /></span>
                <div>
                  <b>Fotoğraflar portföye eklendi</b>
                  <small>Sıralamayı değiştirin, kapak fotoğrafını seçin veya istemediğinizi kaldırın.</small>
                </div>
                <Link
                  href={`/fabrika/portfoyler?propertyId=${encodeURIComponent(mediaEditorPropertyId)}&media=1`}
                >
                  Fotoğrafları düzenle <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            )}
          </section>
        </main>
      )}

      {activeTab === 'history' && (
        <main className={styles.historyPanel} role="tabpanel">
          <div className={styles.historyHeader}>
            <div>
              <span className={styles.eyebrow}>GEÇMİŞ ÇALIŞMALARIM</span>
              <h2>Tüm çalışmalarınız tek yerde.</h2>
              <p>İşlemler arka planda devam eder. Hazır olduğunda buradan açabilirsiniz.</p>
            </div>
            <button onClick={() => void loadRecentBatches()} type="button">
              <RefreshCw aria-hidden="true" /> Yenile
            </button>
          </div>

          <div className={styles.historyGrid}>
            {recentBatches.map((batch) => {
              const summary = summarizeStudioBatchHistory({
                batchStatus: batch.status,
                itemStatuses: batch.items.map((item) => item.status),
              });
              const cover = batch.items.find((item) => item.outputUrl)?.outputUrl ||
                batch.items[0]?.originalUrl;
              return (
                <article key={batch.id}>
                  <div className={styles.historyCover}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" loading="lazy" src={cover} />
                    ) : (
                      <ImageIcon aria-hidden="true" />
                    )}
                    <span data-status={summary.ready ? 'ready' : batch.status.toLowerCase()}>
                      {summary.label}
                    </span>
                  </div>
                  <div className={styles.historyContent}>
                    <span><Clock3 /> {formatStudioDate(batch.createdAt)}</span>
                    <h3>{batch.property?.title || 'Portföysüz fotoğraf çalışması'}</h3>
                    <p>{summary.completed}/{batch.items.length} fotoğraf hazır</p>
                    <div className={styles.progressTrack}>
                      <i style={{ width: `${summary.progress}%` }} />
                    </div>
                    <button
                      disabled={!summary.openable}
                      onClick={() => void openBatch(batch.id)}
                      type="button"
                    >
                      {summary.ready
                        ? 'Sonuçları aç'
                        : summary.failed
                          ? 'Aç ve tekrar dene'
                          : 'Arka planda işleniyor'}
                      {summary.openable ? <ArrowRight /> : <Loader2 className={styles.spin} />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {!recentBatches.length && !isLoadingBatches && (
            <div className={styles.emptyHistory}>
              <span><ImagePlus aria-hidden="true" /></span>
              <h3>Henüz çalışma yok</h3>
              <p>İlk fotoğraflarınızı iyileştirdiğinizde sonuçlar burada görünecek.</p>
              <button onClick={() => setActiveTab('enhancer')} type="button">
                İlk çalışmayı başlat <ArrowRight />
              </button>
            </div>
          )}

          {isLoadingBatches && (
            <div className={styles.loadingHistory} role="status">
              <Loader2 className={styles.spin} /> Çalışmalar yükleniyor…
            </div>
          )}
        </main>
      )}
    </div>
  );
}
