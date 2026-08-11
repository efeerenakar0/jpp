'use client';

import Link from 'next/link';
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
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FolderOpen,
  History,
  Home,
  Image as ImageIcon,
  ImagePlus,
  Images,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
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
import { summarizeStudioBatchHistory } from '@/lib/studio-history';
import styles from './studio-v2.module.css';

type StudioTab = 'enhancer' | 'history';
type StudioScreen = 'upload' | 'results';
type StudioSource = 'portfolio' | 'computer';

type WorkspaceProperty = {
  id: string;
  title: string;
  referenceCode?: string | null;
  location: string | null;
  status: string;
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
const MAX_PHOTOS = 12;

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

function isEligiblePhoto(item: PropertyMediaSummary) {
  return (
    item.mediaType === 'PHOTO' &&
    item.variantType !== 'CREATIVE' &&
    item.usageRightsStatus !== 'RESTRICTED'
  );
}

async function responseJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>('enhancer');
  const [screen, setScreen] = useState<StudioScreen>('upload');
  const [source, setSource] = useState<StudioSource>('portfolio');
  const [workspaceProperties, setWorkspaceProperties] = useState<WorkspaceProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [propertyMedia, setPropertyMedia] = useState<PropertyMediaSummary[]>([]);
  const [selectedSourceMediaIds, setSelectedSourceMediaIds] = useState<string[]>([]);
  const [requestedMediaIds, setRequestedMediaIds] = useState<string[]>([]);
  const [isLoadingPropertyMedia, setIsLoadingPropertyMedia] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedPresetId, setSelectedPresetId] =
    useState<StudioEnhancementPresetId>('professional-camera');
  const [enhancementInstruction, setEnhancementInstruction] = useState(
    DEFAULT_STUDIO_ENHANCEMENT_PROMPT
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<StudioBatchItem[]>([]);
  const [results, setResults] = useState<StudioResult[]>([]);
  const [selectedResultItemIds, setSelectedResultItemIds] = useState<string[]>([]);
  const [activeResult, setActiveResult] = useState(0);
  const [comparePosition, setComparePosition] = useState(50);
  const [recentBatches, setRecentBatches] = useState<StudioBatchSummary[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);
  const [isPreparingZip, setIsPreparingZip] = useState(false);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);
  const [newPropertyTitle, setNewPropertyTitle] = useState('');
  const [newPropertyLocation, setNewPropertyLocation] = useState('');
  const [attachedPropertyId, setAttachedPropertyId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedHistoryRef = useRef(false);
  const notifiedBatchIdsRef = useRef(new Set<string>());

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
  const activePhoto = results[activeResult];
  const mediaEditorPropertyId = attachedPropertyId || selectedPropertyId;

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
    const images = nextFiles.filter((file) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    );
    if (images.length !== nextFiles.length) {
      toast.error('Yalnızca JPG, PNG veya WebP fotoğraf yükleyebilirsiniz.');
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
      return combined.slice(0, available);
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files || []));
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  }

  function selectPreset(preset: StudioEnhancementPreset) {
    setSelectedPresetId(preset.id);
    setEnhancementInstruction(preset.prompt);
  }

  async function createDraftProperty(title: string, location: string) {
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
        status: 'DRAFT',
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
    setErrorMessage('');
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('photos', file));
      formData.set('prompt', enhancementInstruction.trim());
      formData.set('preset', selectedPresetId);
      if (selectedPropertyId) formData.set('propertyId', selectedPropertyId);
      formData.set('mediaIdsJson', JSON.stringify(selectedSourceMediaIds));
      const response = await fetch('/api/fabrika/studio/batches', {
        method: 'POST',
        body: formData,
      });
      const data = await responseJson<{
        success?: boolean;
        error?: string;
        batch?: { id: string; items?: StudioBatchItem[] };
      }>(response);
      if (!response.ok || !data.success || !data.batch) {
        throw new Error(data.error || 'Fotoğraf iyileştirme başlatılamadı.');
      }
      setBatchId(data.batch.id);
      setBatchItems(data.batch.items || []);
      setFiles([]);
      setSelectedSourceMediaIds([]);
      window.sessionStorage.removeItem(STUDIO_DRAFT_KEY);
      await loadRecentBatches();
      setActiveTab('history');
      toast.success('Fotoğraflar işleme alındı. Bu sayfada beklemeniz gerekmiyor.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Fotoğraflar işleme alınamadı.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function openBatch(nextBatchId: string) {
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
      const completed = nextItems
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
      setBatchId(nextBatchId);
      setBatchItems(nextItems);
      setResults(completed);
      setSelectedResultItemIds(completed.map((item) => item.itemId));
      setSelectedPropertyId(data.batch.propertyId || '');
      setAttachedPropertyId(
        completed.some((item) => item.attachedMediaId)
          ? data.batch.propertyId || ''
          : ''
      );
      setActiveResult(0);
      setComparePosition(50);
      setScreen('results');
      setActiveTab('enhancer');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Çalışma açılamadı.');
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
        newPropertyLocation
      );
      const attached = await attachSelectedResults(propertyId);
      if (attached) {
        toast.success('Yeni portföy hazır. Fotoğrafları sıralayabilirsiniz.');
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

  return (
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
            <li data-active="true"><span>1</span><b>Kaynağı seçin</b></li>
            <li data-active={totalSelected > 0}><span>2</span><b>Fotoğrafları kontrol edin</b></li>
            <li data-active={totalSelected > 0}><span>3</span><b>İyileştirmeyi başlatın</b></li>
          </ol>

          <section className={styles.flowCard}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionNumber}>1</span>
              <div>
                <h2>Fotoğraflar nereden gelsin?</h2>
                <p>Size uygun olan seçeneğe bir kez dokunmanız yeterli.</p>
              </div>
            </div>

            <div className={styles.sourceChoices} role="group" aria-label="Fotoğraf kaynağı">
              <button
                aria-pressed={source === 'portfolio'}
                onClick={() => chooseSource('portfolio')}
                type="button"
              >
                <span><Home aria-hidden="true" /></span>
                <b>Portföyümden seç</b>
                <small>Portföyü seçince fotoğraflar otomatik gelir.</small>
                <CheckCircle2 className={styles.choiceCheck} aria-hidden="true" />
              </button>
              <button
                aria-pressed={source === 'computer'}
                onClick={() => chooseSource('computer')}
                type="button"
              >
                <span><UploadCloud aria-hidden="true" /></span>
                <b>Bilgisayarımdan yükle</b>
                <small>JPG, PNG veya WebP fotoğrafları ekleyin.</small>
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
                  multiple
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
                <div
                  className={styles.dropZone}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span><UploadCloud aria-hidden="true" /></span>
                  <div>
                    <b>
                      {source === 'portfolio'
                        ? 'İsterseniz başka fotoğraf da ekleyin'
                        : 'Fotoğrafları buraya bırakın'}
                    </b>
                    <small>veya bilgisayardan seçmek için tıklayın</small>
                  </div>
                  <button tabIndex={-1} type="button">Fotoğraf seç</button>
                </div>
              </>
            )}
          </section>

          {totalSelected > 0 && (
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
        </main>
      )}

      {activeTab === 'enhancer' && screen === 'results' && (
        <main className={styles.results} role="tabpanel">
          <section className={styles.resultHero}>
            <div>
              <span><CheckCircle2 aria-hidden="true" /> Çalışma tamamlandı</span>
              <h2>İyileştirilmiş fotoğraflarınız hazır.</h2>
              <p>Ortadaki çizgiyi sürükleyerek önce ve sonra görünümünü karşılaştırın.</p>
            </div>
            <button onClick={() => void downloadSelectedResults()} type="button">
              {isPreparingZip ? <Loader2 className={styles.spin} /> : <Download />}
              Seçili fotoğrafları indir
            </button>
          </section>

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
          ) : (
            <p className={styles.errorMessage}>Hazır bir sonuç bulunamadı.</p>
          )}

          {results.length > 1 && (
            <section className={styles.resultGallery}>
              <div>
                <h3>Tüm sonuçlar</h3>
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
                    : 'Tümünü seç'}
                </button>
              </div>
              <div>
                {results.map((result, index) => {
                  const selected = selectedResultItemIds.includes(result.itemId);
                  return (
                    <article data-active={activeResult === index} key={result.itemId}>
                      <button onClick={() => setActiveResult(index)} type="button">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={result.name} loading="lazy" src={result.previewUrl} />
                      </button>
                      <button
                        aria-label={`${result.name} sonucunu seç`}
                        aria-pressed={selected}
                        onClick={() =>
                          setSelectedResultItemIds((current) =>
                            current.includes(result.itemId)
                              ? current.filter((id) => id !== result.itemId)
                              : [...current, result.itemId]
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
                    <span>{item.originalFileName}</span>
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
                  onClick={() => void attachSelectedResults(selectedPropertyId)}
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
