'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Home,
  ImagePlus,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import PageHeader from '@/components/fabrika/PageHeader';
import { useFabrikaSession } from '@/components/fabrika/FabrikaSessionContext';
import PosterMaker from '@/components/fabrika/PosterMaker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
  STUDIO_ENHANCEMENT_PRESETS,
  type StudioEnhancementPreset,
  type StudioEnhancementPresetId,
} from '@/lib/studio-enhancement';
import toast from 'react-hot-toast';

type StudioScreen = 'upload' | 'results';

type StudioResult = {
  itemId: string;
  name: string;
  previewUrl: string;
  downloadUrl: string;
  sourceUrl: string;
  attachedMediaId: string | null;
};

type StudioProvider = 'OPENAI' | 'GEMINI';

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
  status: 'PENDING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'ATTACHED';
  errorMessage: string | null;
  attachedMediaId: string | null;
};

type ProviderStatus = {
  provider: StudioProvider;
  configured: boolean;
  active: boolean;
  keyHint: string | null;
  model: string;
};

const PROVIDER_DETAILS: Record<StudioProvider, {
  label: string;
  description: string;
  keyUrl: string;
  keyUrlLabel: string;
  defaultModel: string;
  steps: string[];
  note: string;
}> = {
  OPENAI: {
    label: 'OpenAI GPT Image',
    description: 'GPT Image ile yüksek kaliteli portföy görseli düzenleme.',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyUrlLabel: 'OpenAI API anahtarı al',
    defaultModel: 'gpt-image-1',
    steps: [
      'OpenAI Platform hesabınıza giriş yapın.',
      'Sol menüden ilgili proje alanını seçin ve API Keys sayfasını açın.',
      '+ Create new secret key düğmesine basın.',
      'Anahtara Jasmine Studio gibi anlaşılır bir ad verin.',
      'Oluşan anahtarı hemen kopyalayın; OpenAI bu anahtarı daha sonra tekrar tam olarak göstermez.',
      'Bu ekrandaki API anahtarı alanına yapıştırıp ayarları kaydedin.',
    ],
    note: 'Görsel düzenleme için hesabınızda API kullanımı ve yeterli bakiye/limit bulunmalıdır.',
  },
  GEMINI: {
    label: 'Google Gemini',
    description: 'Gemini Flash Image ile hızlı görsel düzenleme.',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyUrlLabel: 'Gemini API anahtarı al',
    defaultModel: 'gemini-2.5-flash-image',
    steps: [
      'Google hesabınızla Google AI Studio sayfasına giriş yapın.',
      'API keys sayfasını açın.',
      'Create API key düğmesine basın.',
      'Yeni bir proje seçin veya AI Studio tarafından oluşturulan projeyi kullanın.',
      'Billing bölümünü açıp bu proje için ücretli API kullanımını etkinleştirin.',
      'Oluşan Gemini API anahtarını kopyalayın.',
      'Bu ekrandaki API anahtarı alanına yapıştırıp ayarları kaydedin.',
    ],
    note: 'Gemini 2.5 Flash Image ücretsiz pakette kullanılamaz. Görsel üretmek için API anahtarının bağlı olduğu Google projesinde faturalandırma açık olmalıdır.',
  },
};

export default function StudioPage() {
  const { permissions } = useFabrikaSession();
  const [studioArea, setStudioArea] = useState<'enhancer' | 'poster'>('enhancer');
  const [screen, setScreen] = useState<StudioScreen>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [results, setResults] = useState<StudioResult[]>([]);
  const [isPreparingZip, setIsPreparingZip] = useState(false);
  const [activeResult, setActiveResult] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [provider, setProvider] = useState<StudioProvider>('OPENAI');
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PROVIDER_DETAILS.OPENAI.defaultModel);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [workspaceProperties, setWorkspaceProperties] = useState<WorkspaceProperty[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [propertyMedia, setPropertyMedia] = useState<PropertyMediaSummary[]>([]);
  const [selectedSourceMediaIds, setSelectedSourceMediaIds] = useState<string[]>([]);
  const [requestedMediaIds, setRequestedMediaIds] = useState<string[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<StudioBatchItem[]>([]);
  const [selectedResultItemIds, setSelectedResultItemIds] = useState<string[]>([]);
  const [isAttaching, setIsAttaching] = useState(false);
  const [selectedPresetId, setSelectedPresetId] =
    useState<StudioEnhancementPresetId>('professional-camera');
  const [enhancementInstruction, setEnhancementInstruction] = useState(
    DEFAULT_STUDIO_ENHANCEMENT_PROMPT
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const instructionRef = useRef<HTMLTextAreaElement>(null);

  const filePreviews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
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
        const response = await fetch('/api/fabrika/workspace', { cache: 'no-store' });
        const data = await response.json();
        if (response.ok && data.success) {
          setWorkspaceProperties(
            (data.workspace.properties || []).filter((property: WorkspaceProperty) =>
              ['ACTIVE', 'RESERVED', 'DRAFT'].includes(property.status)
            )
          );
        }
      } catch {
        // Studio remains available when no workspace record exists yet.
      }
    }
    void loadProperties();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = new URLSearchParams(window.location.search);
      const area = search.get('area');
      const propertyId = search.get('propertyId');
      const mediaIds = (search.get('mediaIds') || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      if (area === 'poster') setStudioArea('poster');
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
      { cache: 'no-store' }
    )
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Portföy görselleri yüklenemedi.');
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
              : 'Portföy görselleri yüklenemedi.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [requestedMediaIds, selectedPropertyId]);

  const addFiles = (newFiles: File[]) => {
    const images = newFiles.filter((file) => file.type.startsWith('image/'));
    if (images.length !== newFiles.length) toast.error('Yalnızca görsel dosyaları yükleyebilirsiniz.');
    if (!images.length) return;

    setFiles((current) => {
      const known = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const combined = [
        ...current,
        ...images.filter(
          (file) =>
            !known.has(`${file.name}-${file.size}-${file.lastModified}`)
        ),
      ];
      const available = Math.max(0, 12 - selectedSourceMediaIds.length);
      if (combined.length > available) {
        toast.error(
          'Portföy görselleriyle birlikte tek işlemde en fazla 12 fotoğraf seçebilirsiniz.'
        );
      }
      return combined.slice(0, available);
    });
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(Array.from(event.dataTransfer.files));
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const changeSelectedProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setPropertyMedia([]);
    setSelectedSourceMediaIds([]);
  };

  const selectEnhancementPreset = (preset: StudioEnhancementPreset) => {
    setSelectedPresetId(preset.id);
    setEnhancementInstruction(preset.prompt);
    if (preset.id === 'custom') {
      requestAnimationFrame(() => instructionRef.current?.focus());
    }
  };

  const selectedProviderStatus = providerStatuses.find(
    (statusItem) => statusItem.provider === provider
  );
  const activeProviderStatus = providerStatuses.find((statusItem) => statusItem.active);
  const selectedWorkspaceProperty = workspaceProperties.find(
    (property) => property.id === selectedPropertyId
  );

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch('/api/fabrika/studio/settings', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'API ayarları yüklenemedi.');
      const statuses = (data.providers || []) as ProviderStatus[];
      setProviderStatuses(statuses);
      const active = statuses.find((statusItem) => statusItem.active);
      const nextProvider = active?.provider || provider;
      setProvider(nextProvider);
      setModel(
        statuses.find((statusItem) => statusItem.provider === nextProvider)?.model ||
          PROVIDER_DETAILS[nextProvider].defaultModel
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'API ayarları yüklenemedi.');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const openSettings = () => {
    setSettingsOpen(true);
    setApiKey('');
    void loadSettings();
  };

  const selectProvider = (nextProvider: StudioProvider) => {
    setProvider(nextProvider);
    setApiKey('');
    setModel(
      providerStatuses.find((statusItem) => statusItem.provider === nextProvider)?.model ||
        PROVIDER_DETAILS[nextProvider].defaultModel
    );
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const response = await fetch('/api/fabrika/studio/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model, active: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'API ayarları kaydedilemedi.');
      toast.success(`${PROVIDER_DETAILS[provider].label} ayarları kaydedildi.`);
      setApiKey('');
      setSettingsOpen(false);
      await loadSettings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'API ayarları kaydedilemedi.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const startProcessing = async () => {
    if (!files.length && !selectedSourceMediaIds.length) {
      toast.error('Bilgisayarınızdan veya portföyden en az bir fotoğraf seçin.');
      return;
    }
    const safeInstruction = enhancementInstruction.trim();
    if (!safeInstruction) {
      toast.error('İyileştirme talimatınızı yazın veya hazır seçeneklerden birini seçin.');
      instructionRef.current?.focus();
      return;
    }
    if (safeInstruction.length > 10_000) {
      toast.error('İyileştirme talimatı en fazla 10.000 karakter olabilir.');
      instructionRef.current?.focus();
      return;
    }

    setIsProcessing(true);
    setErrorMessage('');
    setProgress(5);
    setStatus('Görseller kalıcı Stüdyo işlemine yükleniyor…');

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('photos', file));
      formData.set('prompt', safeInstruction);
      formData.set('preset', selectedPresetId);
      if (selectedPropertyId) formData.set('propertyId', selectedPropertyId);
      formData.set('mediaIdsJson', JSON.stringify(selectedSourceMediaIds));
      const createResponse = await fetch('/api/fabrika/studio/batches', {
        method: 'POST',
        body: formData,
      });
      const created = await createResponse.json();
      if (!createResponse.ok || !created.success || !created.batch) {
        throw new Error(created.error || 'Stüdyo işlemi başlatılamadı.');
      }
      const nextBatchId = String(created.batch.id);
      setBatchId(nextBatchId);
      const batchItems = (created.batch.items || []) as StudioBatchItem[];
      setBatchItems(batchItems);
      const failures: string[] = [];

      for (const [index, item] of batchItems.entries()) {
        setBatchItems((current) =>
          current.map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, status: 'PROCESSING', errorMessage: null }
              : candidate
          )
        );
        setProgress(Math.round(10 + (index / batchItems.length) * 85));
        setStatus(
          `Stable Image Ultra, ${index + 1}/${batchItems.length} fotoğrafı özgün yapıyı koruyarak iyileştiriyor…`
        );
        try {
          const response = await fetch(
            `/api/fabrika/studio/batches/${encodeURIComponent(nextBatchId)}/items/${encodeURIComponent(item.id)}/process`,
            { method: 'POST' }
          );
          const data = await response.json();
          if (!response.ok || !data.success) {
            failures.push(data.error || `${item.originalFileName} işlenemedi.`);
            setBatchItems((current) =>
              current.map((candidate) =>
                candidate.id === item.id
                  ? {
                      ...candidate,
                      status: 'FAILED',
                      errorMessage:
                        data.error || `${item.originalFileName} işlenemedi.`,
                    }
                  : candidate
              )
            );
          } else {
            setBatchItems((current) =>
              current.map((candidate) =>
                candidate.id === item.id ? data.item : candidate
              )
            );
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : `${item.originalFileName} işlenemedi.`;
          failures.push(message);
          setBatchItems((current) =>
            current.map((candidate) =>
              candidate.id === item.id
                ? { ...candidate, status: 'FAILED', errorMessage: message }
                : candidate
            )
          );
        }
      }

      const batchResponse = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(nextBatchId)}`,
        { cache: 'no-store' }
      );
      const batchData = await batchResponse.json();
      if (!batchResponse.ok || !batchData.success) {
        throw new Error(batchData.error || 'Stüdyo sonuçları yüklenemedi.');
      }
      const refreshedItems = batchData.batch.items as StudioBatchItem[];
      setBatchItems(refreshedItems);
      const completed = refreshedItems
        .filter(
          (item) =>
            item.outputUrl &&
            item.outputFileName &&
            (item.status === 'COMPLETED' || item.status === 'ATTACHED')
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
          failures[0] ||
            batchData.batch.errorSummary ||
            'Hiçbir görsel iyileştirilemedi.'
        );
      }
      setProgress(100);
      setStatus('Kalıcı ve indirilebilir görseller hazır.');
      setResults(completed);
      setSelectedResultItemIds(completed.map((item) => item.itemId));
      setActiveResult(0);
      setScreen('results');
      if (failures.length) {
        setErrorMessage(
          `${completed.length} görsel hazır, ${failures.length} görsel başarısız. Başarısız görselleri yeniden deneyebilirsiniz.`
        );
        toast.error(`${failures.length} görsel işlenemedi; başarılı sonuçlar korundu.`);
      } else {
        toast.success(`${completed.length} fotoğrafınız iyileştirildi.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'İşlem sırasında bir hata oluştu.';
      setErrorMessage(message);
      setProgress(0);
      setStatus('');
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadAllResults = async () => {
    if (!results.length || !batchId || isPreparingZip) return;
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
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'ZIP dosyası hazırlanamadı.');
      }
      const archive = await response.blob();
      const archiveUrl = URL.createObjectURL(archive);
      const anchor = document.createElement('a');
      anchor.href = archiveUrl;
      anchor.download = 'Jasmine_Studio_AI_Iyilestirilmis.zip';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(archiveUrl), 1_000);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'ZIP dosyası hazırlanamadı. Görselleri tek tek indirebilirsiniz.'
      );
    } finally {
      setIsPreparingZip(false);
    }
  };

  const resetStudio = () => {
    setScreen('upload');
    setFiles([]);
    setResults([]);
    setBatchId(null);
    setBatchItems([]);
    setSelectedResultItemIds([]);
    setActiveResult(0);
    setProgress(0);
    setErrorMessage('');
    setSelectedPresetId('professional-camera');
    setEnhancementInstruction(DEFAULT_STUDIO_ENHANCEMENT_PROMPT);
  };

  const activePhoto = results[activeResult];
  const activeOriginal = activePhoto
    ? { url: activePhoto.sourceUrl }
    : undefined;

  const attachSelectedResults = async (makeCover = false) => {
    if (!batchId || !selectedPropertyId || !selectedResultItemIds.length) return;
    setIsAttaching(true);
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}/attach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: selectedPropertyId,
            itemIds: selectedResultItemIds,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Görseller portföye eklenemedi.');
      }
      const attachedByItem = new Map<string, string>(
        (data.items || []).map(
          (item: { id: string; fingerprint: string }): [string, string] => [
            item.fingerprint.replace('studio-item:', ''),
            item.id,
          ]
        )
      );
      setResults((current) =>
        current.map((result) => ({
          ...result,
          attachedMediaId:
            attachedByItem.get(result.itemId) || result.attachedMediaId,
        }))
      );
      if (makeCover) {
        const firstSelectedItemId = selectedResultItemIds[0];
        const coverMediaId =
          attachedByItem.get(firstSelectedItemId) ||
          results.find((result) => result.itemId === firstSelectedItemId)
            ?.attachedMediaId;
        if (!coverMediaId) {
          throw new Error('Kapak yapılacak görsel portföye bağlanamadı.');
        }
        const coverResponse = await fetch(
          `/api/fabrika/properties/${encodeURIComponent(selectedPropertyId)}/media/${encodeURIComponent(coverMediaId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCover: true }),
          }
        );
        const coverData = await coverResponse.json();
        if (!coverResponse.ok || !coverData.success) {
          throw new Error(
            coverData.error || 'Görsel kapak olarak belirlenemedi.'
          );
        }
      }
      toast.success(`${data.items.length} görsel portföye eklendi.`);
      if (makeCover) {
        toast.success('İlk seçili görsel portföy kapağı yapıldı.');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Görseller portföye eklenemedi.'
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
          ? { ...item, status: 'PROCESSING', errorMessage: null }
          : item
      )
    );
    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(itemId)}/process`,
        { method: 'POST' }
      );
      const data = await response.json();
      if (!response.ok || !data.success || !data.item?.outputUrl) {
        throw new Error(data.error || 'Görsel yeniden işlenemedi.');
      }
      const item = data.item as StudioBatchItem;
      setBatchItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? item : candidate
        )
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
        current.includes(item.id) ? current : [...current, item.id]
      );
      toast.success(`${item.originalFileName} yeniden işlendi.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Görsel yeniden işlenemedi.';
      setBatchItems((current) =>
        current.map((item) =>
          item.id === itemId
            ? { ...item, status: 'FAILED', errorMessage: message }
            : item
        )
      );
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6 overflow-x-hidden pb-8 text-slate-100">
      <PageHeader
        eyebrow="Görsel operasyonu"
        title="Stüdyo"
        description={studioArea === 'enhancer'
          ? 'Portföy fotoğraflarını profesyonel yayın standardına göre iyileştirin ve indirilebilir çıktılar hazırlayın.'
          : 'Gayrimenkul görsellerinizden şirket kimliğinize uygun reklam posterleri ve paylaşım metinleri oluşturun.'}
        icon={Aperture}
        actions={
          <>
            <div role="tablist" aria-label="Stüdyo çalışma alanları" className="flex rounded-lg border border-slate-700 bg-slate-900 p-1">
              <button type="button" role="tab" aria-selected={studioArea === 'enhancer'} onClick={() => setStudioArea('enhancer')} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${studioArea === 'enhancer' ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-400 hover:text-white'}`}>Resim iyileştirici</button>
              <button type="button" role="tab" aria-selected={studioArea === 'poster'} onClick={() => setStudioArea('poster')} className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${studioArea === 'poster' ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-400 hover:text-white'}`}>Poster yapıcı</button>
            </div>
            {studioArea === 'poster' && permissions.canManageSecrets && (
              <button
                type="button"
                onClick={openSettings}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <KeyRound className="h-3.5 w-3.5" /> API ayarları
              </button>
            )}
            <span className="hidden items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />{' '}
              {studioArea === 'enhancer'
                ? 'Stable Image Ultra'
                : permissions.canManageSecrets
                ? activeProviderStatus
                  ? PROVIDER_DETAILS[activeProviderStatus.provider].label
                  : 'AI sağlayıcısı seçin'
                : 'Şirket AI sağlayıcısı'}
            </span>
            {studioArea === 'enhancer' && screen === 'results' && (
              <button
                type="button"
                onClick={resetStudio}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Yeni yükleme
              </button>
            )}
          </>
        }
      />


      <main>
        {studioArea === 'poster' ? <PosterMaker /> : screen === 'upload' ? (
          <section className="mx-auto max-w-4xl">
            <div className="mb-7 text-center">
              <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-300 text-[10px] text-emerald-950">1</span>
                Görselleri yükleyin
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Portföy fotoğraflarınızı öne çıkarın</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Ham fotoğraflarınızı yükleyin; stüdyo ışık, renk, netlik ve genel kaliteyi otomatik olarak iyileştirsin.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-5">
              <label className="mb-4 flex flex-col gap-1.5 rounded-lg border border-slate-800 bg-slate-950/50 p-3 sm:flex-row sm:items-center sm:justify-between" htmlFor="studio-property">
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
                      {property.title}{property.location ? ` · ${property.location}` : ''}
                    </option>
                  ))}
                </select>
              </label>

              {selectedPropertyId && (
                <section className="mb-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] p-4">
                  {selectedWorkspaceProperty && (
                    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-cyan-300/15 bg-slate-950/45 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-extrabold text-white">
                          {selectedWorkspaceProperty.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {selectedWorkspaceProperty.location ||
                            'Konum bilgisi girilmemiş'}
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
                            item.mediaType === 'PHOTO' &&
                            item.variantType !== 'CREATIVE' &&
                            item.usageRightsStatus !== 'RESTRICTED'
                        );
                        setSelectedSourceMediaIds((current) =>
                          current.length === eligible.length
                            ? []
                            : eligible
                                .slice(0, Math.max(0, 12 - files.length))
                                .map((item) => item.id)
                        );
                      }}
                      type="button"
                    >
                      {selectedSourceMediaIds.length
                        ? 'Seçimi kaldır'
                        : 'Uygun görselleri seç'}
                    </button>
                  </div>
                  {propertyMedia.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {propertyMedia
                        .filter(
                          (item) =>
                            item.mediaType === 'PHOTO' &&
                            item.variantType !== 'CREATIVE' &&
                            item.usageRightsStatus !== 'RESTRICTED'
                        )
                        .map((item) => {
                          const selected = selectedSourceMediaIds.includes(item.id);
                          const disabled =
                            !selected &&
                            selectedSourceMediaIds.length + files.length >= 12;
                          return (
                            <button
                              aria-pressed={selected}
                              className={`group relative aspect-[4/3] overflow-hidden rounded-lg border text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 ${
                                selected
                                  ? 'border-cyan-300 ring-2 ring-cyan-300/20'
                                  : 'border-slate-700 hover:border-slate-500'
                              }`}
                              disabled={disabled}
                              key={item.id}
                              onClick={() =>
                                setSelectedSourceMediaIds((current) =>
                                  current.includes(item.id)
                                    ? current.filter((id) => id !== item.id)
                                    : [...current, item.id]
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
                                    ? 'border-cyan-100 bg-cyan-300 text-cyan-950'
                                    : 'border-white/40 bg-slate-950/70 text-transparent'
                                }`}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </span>
                              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-5 text-[9px] font-semibold text-white">
                                {item.isCover ? 'Kapak · ' : ''}
                                {item.variantType === 'ENHANCED'
                                  ? 'İyileştirilmiş'
                                  : 'Orijinal'}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="mt-4 rounded-lg border border-dashed border-slate-700 p-5 text-center text-xs text-slate-400">
                      Bu portföyde uygun fotoğraf yok. Aşağıdan bilgisayarınızdan
                      yükleyebilirsiniz.
                    </p>
                  )}
                </section>
              )}

              <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/55 p-4 sm:p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <label
                      htmlFor="studio-enhancement-instruction"
                      className="text-sm font-bold text-white"
                    >
                      İyileştirme talimatı
                    </label>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Hazır bir seçenek kullanın veya metni ihtiyacınıza göre düzenleyin.
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">
                    {enhancementInstruction.length.toLocaleString('tr-TR')} / 10.000
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
                          ? 'border-emerald-300/50 bg-emerald-300/15 text-emerald-100'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white'
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
                        (preset) => preset.id === selectedPresetId
                      )?.prompt !== event.target.value
                    ) {
                      setSelectedPresetId('custom');
                    }
                  }}
                  placeholder="Görselde nasıl bir iyileştirme istediğinizi yazın…"
                  className="mt-4 min-h-44 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/15"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Kaynak görsel image-to-image olarak işlenir. Düşük dönüşüm gücü, mimariyi ve mevcut nesneleri korumaya yardımcı olur.
                </p>
              </div>

              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => event.key === 'Enter' && fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="group cursor-pointer rounded-lg border border-dashed border-emerald-500/35 bg-emerald-500/5 px-5 py-12 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-500/10 sm:px-10"
              >
                <input ref={fileInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileChange} />
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl bg-emerald-500 text-emerald-950">
                  <UploadCloud className="h-8 w-8 stroke-[2.5]" />
                </div>
                <h2 className="mt-5 text-lg font-extrabold text-white">Fotoğrafları buraya bırakın</h2>
                <p className="mt-1 text-sm text-slate-400">veya bilgisayarınızdan seçmek için tıklayın</p>
                <p className="mt-4 text-xs font-medium text-slate-500">JPG, PNG veya WEBP · Birden fazla fotoğraf seçebilirsiniz</p>
              </div>

              {filePreviews.length > 0 && (
                <div className="px-2 pb-2 pt-5 sm:px-3">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-bold text-white">Yüklenecek fotoğraflar <span className="text-emerald-300">({files.length})</span></p>
                    <button type="button" onClick={() => setFiles([])} className="text-xs font-bold text-slate-400 transition hover:text-white">Tümünü kaldır</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {filePreviews.map(({ file, url }, index) => (
                      <div key={`${file.name}-${file.lastModified}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-slate-900">
                        {/* Native img is used because this is a local, user-selected object URL. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={file.name} className="h-full w-full object-cover" />
                        <button type="button" onClick={(event) => { event.stopPropagation(); removeFile(index); }} className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white opacity-100 transition hover:bg-rose-500 sm:opacity-0 sm:group-hover:opacity-100" aria-label={`${file.name} dosyasını kaldır`}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-[10px] font-medium text-white">{file.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mt-5 flex flex-col gap-4 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
                  <div>
                    <p className="text-sm font-bold text-rose-100">İşlem tamamlanamadı</p>
                    <p className="mt-1 text-xs leading-5 text-rose-100/80">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            {batchItems.length > 0 && screen === 'upload' && (
              <section
                aria-live="polite"
                className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Görsel işlem durumu
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">{status}</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-200">
                    %{progress}
                  </span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-300 transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {batchItems.map((item) => {
                    const label =
                      item.status === 'COMPLETED' ||
                      item.status === 'ATTACHED'
                        ? 'Hazır'
                        : item.status === 'FAILED'
                          ? 'Başarısız'
                          : item.status === 'PROCESSING'
                            ? 'İşleniyor'
                            : item.status === 'UPLOADING'
                              ? 'Yükleniyor'
                              : 'Bekliyor';
                    return (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2"
                      >
                        <span className="truncate text-xs text-slate-300">
                          {item.originalFileName}
                        </span>
                        <span
                          className={`shrink-0 text-[10px] font-bold ${
                            item.status === 'FAILED'
                              ? 'text-rose-300'
                              : item.status === 'COMPLETED' ||
                                  item.status === 'ATTACHED'
                                ? 'text-emerald-300'
                                : 'text-amber-200'
                          }`}
                        >
                          {item.status === 'PROCESSING' && (
                            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                          )}
                          {label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 sm:flex-row sm:px-5">
              <div className="flex items-center gap-2 text-xs leading-5 text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" /> Stability API anahtarı yalnızca sunucuda kullanılır ve hiçbir zaman tarayıcıya gönderilmez.</div>
              <button type="button" onClick={startProcessing} disabled={(!files.length && !selectedSourceMediaIds.length) || isProcessing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3.5 text-sm font-extrabold text-emerald-950 shadow-lg shadow-emerald-500/15 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {files.length + selectedSourceMediaIds.length} görseli AI ile iyileştir <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : (
          <section>
            <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4" /> İşlem tamamlandı</div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Portföye hazır görselleriniz.</h1>
                <p className="mt-2 text-sm text-slate-400">İyileştirilmiş sonucu inceleyin veya tüm görselleri tek ZIP dosyası halinde indirin.</p>
              </div>
              {results.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedResultItemIds((current) =>
                        current.length === results.length
                          ? []
                          : results.map((result) => result.itemId)
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-slate-500 hover:text-white"
                  >
                    <Check className="h-4 w-4" />
                    {selectedResultItemIds.length === results.length
                      ? 'Seçimi kaldır'
                      : 'Tümünü seç'}
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
                        Seçili {selectedResultItemIds.length} görseli portföye ekle
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
                    disabled={
                      isPreparingZip || !selectedResultItemIds.length
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPreparingZip ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {isPreparingZip
                      ? 'ZIP hazırlanıyor…'
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
                      {property.location ? ` · ${property.location}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {batchItems.some((item) => item.status === 'FAILED') && (
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
                    .filter((item) => item.status === 'FAILED')
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
                            {item.errorMessage || 'Görsel işlenemedi.'}
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
              <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/50 shadow-2xl shadow-black/30 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="relative min-h-[22rem] bg-black">
                  {/* The result is a short-lived generated Blob/remote URL. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activePhoto.previewUrl} alt={`${activePhoto.name} iyileştirilmiş`} className="h-full max-h-[39rem] min-h-[22rem] w-full object-contain" />
                  <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-300 px-3 py-1.5 text-xs font-extrabold text-emerald-950"><Sparkles className="h-3.5 w-3.5" /> AI iyileştirildi</div>
                </div>
                <div className="flex flex-col p-5 sm:p-7">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">Seçili görsel</p>
                  <h2 className="mt-2 break-all text-xl font-extrabold text-white">{activePhoto.name}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">Stable Image Ultra; ışık, renk dengesi, netlik ve genel sunum kalitesini seçtiğiniz talimata göre yeniden işledi.</p>
                  {activeOriginal && (
                    <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
                      {/* The original may be a local object URL or tenant Blob URL. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activeOriginal.url}
                        alt="İşlem öncesi"
                        className="aspect-[16/10] w-full object-cover"
                      />
                      <p className="border-t border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">
                        İşlem öncesi
                      </p>
                    </div>
                  )}
                  {activePhoto.attachedMediaId && <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Portföye eklendi</div>}
                  <a href={activePhoto.downloadUrl} download={activePhoto.name} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-extrabold text-emerald-200 transition hover:bg-emerald-300/20"><Download className="h-4 w-4" /> Bu görseli indir</a>
                </div>
              </div>
            ) : <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-6 text-sm text-rose-100">İşlenmiş görseller alınamadı. Lütfen yeni bir işlem başlatın.</div>}

            {results.length > 1 && (
              <div className="mt-6">
                <p className="mb-3 text-sm font-bold text-white">Diğer sonuçlar</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {results.map((result, index) => {
                    const selected = selectedResultItemIds.includes(result.itemId);
                    return (
                      <article
                        key={result.itemId}
                        className={`relative overflow-hidden rounded-xl border transition ${
                          activeResult === index
                            ? 'border-emerald-300 ring-2 ring-emerald-300/25'
                            : 'border-white/10 hover:border-white/30'
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
                              ? 'border-emerald-100 bg-emerald-300 text-emerald-950'
                              : 'border-white/40 bg-slate-950/75 text-transparent'
                          }`}
                          onClick={() =>
                            setSelectedResultItemIds((current) =>
                              current.includes(result.itemId)
                                ? current.filter((id) => id !== result.itemId)
                                : [...current, result.itemId]
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

      {permissions.canManageSecrets && (
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-slate-700 bg-slate-950 p-0 text-slate-100 shadow-2xl">
          <DialogHeader className="border-b border-slate-800 p-6 pr-12">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white"><KeyRound className="h-5 w-5 text-emerald-300" /> Stüdyo API ayarları</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-slate-400">
              Her şirket kendi sağlayıcısını ve anahtarını ekler. Anahtar şifreli olarak sunucuda saklanır, tarayıcıya gönderilmez ve kayıt sonrası tekrar açık şekilde gösterilmez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 p-6">
            <fieldset disabled={isLoadingSettings || isSavingSettings}>
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Görsel AI sağlayıcısı</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(PROVIDER_DETAILS) as StudioProvider[]).map((providerOption) => {
                  const detail = PROVIDER_DETAILS[providerOption];
                  const statusItem = providerStatuses.find((item) => item.provider === providerOption);
                  return (
                    <button
                      key={providerOption}
                      type="button"
                      onClick={() => selectProvider(providerOption)}
                      aria-pressed={provider === providerOption}
                      className={`rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${provider === providerOption ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-slate-700 bg-slate-900 hover:border-slate-600'}`}
                    >
                      <span className="block text-sm font-bold text-white">{detail.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">{detail.description}</span>
                      {statusItem?.configured && <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${statusItem.active ? 'bg-emerald-400/15 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>{statusItem.active ? 'Aktif' : 'Yapılandırıldı'} · {statusItem.keyHint}</span>}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <p className="text-sm font-bold text-white">{PROVIDER_DETAILS[provider].label} anahtarı</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{selectedProviderStatus?.configured ? `Mevcut anahtar: ${selectedProviderStatus.keyHint}. Değiştirmek için yeni anahtar girin.` : 'İlk kullanım için API anahtarınızı ekleyin.'}</p>
                </div>
                <a href={PROVIDER_DETAILS[provider].keyUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
                  {PROVIDER_DETAILS[provider].keyUrlLabel} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <div className="mt-4 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-200">Anahtarı nasıl alırsınız?</p>
                <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-300">
                  {PROVIDER_DETAILS[provider].steps.map((step, index) => (
                    <li key={step} className="flex gap-2">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-300 text-[10px] font-black text-emerald-950">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs leading-5 text-slate-400">
                  {PROVIDER_DETAILS[provider].note}
                </p>
              </div>
              <label htmlFor="studio-api-key" className="mt-4 block text-xs font-bold text-slate-300">API anahtarı</label>
              <Input
                id="studio-api-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={selectedProviderStatus?.configured ? 'Yalnızca değiştirmek isterseniz yeni anahtar girin' : 'API anahtarınızı yapıştırın'}
                className="mt-2 h-11 border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus-visible:border-emerald-300 focus-visible:ring-emerald-300/20"
              />
              <label htmlFor="studio-model" className="mt-4 block text-xs font-bold text-slate-300">Görsel model</label>
              <Input
                id="studio-model"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder={PROVIDER_DETAILS[provider].defaultModel}
                className="mt-2 h-11 border-slate-700 bg-slate-950 text-white placeholder:text-slate-500 focus-visible:border-emerald-300 focus-visible:ring-emerald-300/20"
              />
              <p className="mt-3 text-xs leading-5 text-slate-500">Kaydettiğiniz sağlayıcı Stüdyo için aktif olur. İsterseniz sonra diğer sağlayıcıya geçebilirsiniz.</p>
            </div>
          </div>

          <DialogFooter className="border-slate-800 bg-slate-900 p-4">
            <button type="button" onClick={() => setSettingsOpen(false)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">Vazgeç</button>
            <button type="button" onClick={saveSettings} disabled={isSavingSettings || (!apiKey && !selectedProviderStatus?.configured)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-sm font-bold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100">
              {isSavingSettings && <Loader2 className="h-4 w-4 animate-spin" />} Ayarları kaydet
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {isProcessing && <div className="fixed inset-0 z-50 grid place-items-center bg-[#07120f]/80 px-4 backdrop-blur-sm"><div role="status" aria-live="polite" className="w-full max-w-md rounded-3xl border border-emerald-300/20 bg-slate-950 p-7 text-center shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-300/15 text-emerald-300"><Loader2 className="h-8 w-8 animate-spin" /></div><h2 className="mt-5 text-xl font-extrabold text-white">Görselleriniz işleniyor</h2><p className="mt-2 text-sm leading-6 text-slate-400">{status}</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-teal-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs font-bold text-emerald-300">%{progress}</p></div></div>}
    </div>
  );
}
