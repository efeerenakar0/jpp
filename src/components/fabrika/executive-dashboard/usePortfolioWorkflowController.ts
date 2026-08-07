'use client';

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';

import {
  createExecutivePortfolioDraft,
  deserializeExecutivePortfolioDraft,
  executivePortfolioReducer,
  EXECUTIVE_WORKFLOW_STEPS,
  getExecutiveWorkflowResultState,
  resolveExecutiveWorkflowEntryStep,
  serializeExecutivePortfolioDraft,
  type ExecutivePortfolioAction,
  type ExecutivePortfolioDraft,
  type ExecutivePortfolioMedia,
  type ExecutiveWorkflowSource,
  type ExecutiveWorkflowStep,
} from '@/lib/executive-portfolio-workflow';
import {
  isExecutiveStudioBatchTerminal,
  mapStudioBatchItems,
  type ExecutiveStudioBatchItem,
} from '@/lib/executive-studio-client';
import {
  parseStoredPortfolioWorkflowIntent,
  PORTFOLIO_WORKFLOW_INTENT_STORAGE_KEY,
  resolvePortfolioWorkflowLaunch,
  type PortfolioWorkflowLaunchIntent,
} from '@/lib/portfolio-workflow-intent';

export const PORTFOLIO_WORKFLOW_DRAFT_STORAGE_KEY =
  'business-ceo:executive-portfolio-draft:v1';

export type PortfolioWorkflowStatus = {
  step: number;
  progress: number;
  label: string;
};

export function getPortfolioWorkflowStatus(
  draft: ExecutivePortfolioDraft
): PortfolioWorkflowStatus | null {
  if (!draft.source) return null;
  const step = EXECUTIVE_WORKFLOW_STEPS.indexOf(draft.currentStep) + 1;
  const activeMedia = draft.media.filter((media) => !media.removed);
  const progress =
    activeMedia.length === 0
      ? 0
      : Math.round(
          activeMedia.reduce((total, media) => total + media.progress, 0) /
            activeMedia.length
        );
  const labels: Record<ExecutiveWorkflowStep, string> = {
    source: 'Başlangıç seçiliyor',
    portfolio: activeMedia.some((media) => media.status === 'processing')
      ? 'Görseller işleniyor'
      : 'Portföy hazırlanıyor',
    review: 'Görseller kontrol ediliyor',
    advertising: 'Reklam tasarımı hazırlanıyor',
    marketing: 'Pazarlama seçimleri yapılıyor',
    results: getExecutiveWorkflowResultState(draft).ready
      ? 'Çıktılar doğrulandı'
      : 'Tamamlanacak işler var',
  };
  return { step, progress, label: labels[draft.currentStep] };
}

type UsePortfolioWorkflowControllerOptions = {
  initialIntent?: PortfolioWorkflowLaunchIntent | null;
};

export function usePortfolioWorkflowController({
  initialIntent = null,
}: UsePortfolioWorkflowControllerOptions = {}) {
  const [draft, dispatch] = useReducer(
    executivePortfolioReducer,
    undefined,
    createExecutivePortfolioDraft
  );
  const draftRef = useRef(draft);
  const storageReadyRef = useRef(false);
  const notifiedBatchRef = useRef<string | null>(null);
  const previewUrlsRef = useRef(new Set<string>());
  const initialIntentRef = useRef(initialIntent);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entryMode, setEntryMode] =
    useState<ExecutiveWorkflowSource>('studio');

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    const timer = window.setTimeout(() => {
      let saved: ExecutivePortfolioDraft | null = null;
      let storedIntent: PortfolioWorkflowLaunchIntent | null = null;
      try {
        saved = deserializeExecutivePortfolioDraft(
          window.localStorage.getItem(PORTFOLIO_WORKFLOW_DRAFT_STORAGE_KEY)
        );
        storedIntent = parseStoredPortfolioWorkflowIntent(
          window.localStorage.getItem(PORTFOLIO_WORKFLOW_INTENT_STORAGE_KEY)
        );
        window.localStorage.removeItem(PORTFOLIO_WORKFLOW_INTENT_STORAGE_KEY);
      } catch {
        // Private browsing or storage policies can disable localStorage.
      }

      const baseDraft = saved ?? draftRef.current;
      if (saved) {
        draftRef.current = saved;
        dispatch({ type: 'replace-draft', draft: saved });
      }
      storageReadyRef.current = true;

      const intent = initialIntentRef.current ?? storedIntent;
      if (!intent) return;

      const launch = resolvePortfolioWorkflowLaunch(baseDraft, intent);
      setEntryMode(launch.source);
      dispatch({
        type: 'go-to-step',
        step: launch.step,
      });
      setDialogOpen(true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      for (const url of previewUrls) URL.revokeObjectURL(url);
      previewUrls.clear();
    };
  }, []);

  useEffect(() => {
    if (!storageReadyRef.current) return;
    try {
      window.localStorage.setItem(
        PORTFOLIO_WORKFLOW_DRAFT_STORAGE_KEY,
        serializeExecutivePortfolioDraft(draft)
      );
    } catch {
      // The workflow remains usable in-memory when storage is unavailable.
    }
  }, [draft]);

  const handleAction = useCallback((action: ExecutivePortfolioAction) => {
    dispatch(action);
  }, []);

  const syncStudioBatch = useCallback(
    (batchId: string, items: ExecutiveStudioBatchItem[]) => {
      dispatch({
        type: 'sync-studio-batch',
        batchId,
        media: mapStudioBatchItems(items, draftRef.current.media),
      });
    },
    []
  );

  const loadStudioBatch = useCallback(
    async (batchId: string) => {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}`,
        { cache: 'no-store' }
      );
      const data = await response.json();
      if (!response.ok || !data.success || !data.batch) {
        throw new Error(data.error || 'Stüdyo çalışması yüklenemedi.');
      }
      const items = (data.batch.items || []) as ExecutiveStudioBatchItem[];
      syncStudioBatch(batchId, items);
      return items;
    },
    [syncStudioBatch]
  );

  useEffect(() => {
    const batchId = draft.studioBatchId;
    if (!batchId) return;

    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const items = await loadStudioBatch(batchId);
        if (cancelled) return;
        if (isExecutiveStudioBatchTerminal(items)) {
          if (notifiedBatchRef.current !== batchId) {
            notifiedBatchRef.current = batchId;
            toast.success(
              'Stüdyo görsel işlemleri tamamlandı. Sonuçları kontrol edebilirsin.'
            );
          }
          return;
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Stüdyo çalışma durumu alınamadı.'
          );
        }
      }
      if (!cancelled) timer = window.setTimeout(() => void poll(), 4_000);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [draft.studioBatchId, loadStudioBatch]);

  const uploadStudioFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const localMedia = files.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrlsRef.current.add(previewUrl);
        return {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          previewUrl,
        };
      });
      dispatch({ type: 'add-media', media: localMedia });
      localMedia.forEach((media) =>
        dispatch({
          type: 'update-media',
          id: media.id,
          progress: 5,
          status: 'uploading',
        })
      );

      try {
        const formData = new FormData();
        files.forEach((file) => formData.append('photos', file));
        formData.set(
          'prompt',
          'Gayrimenkul fotoğraflarını doğal ışık, doğru perspektif ve gerçekçi renklerle profesyonel biçimde iyileştir. Yapısal unsurları değiştirme.'
        );
        formData.set('preset', 'professional-camera');
        const response = await fetch('/api/fabrika/studio/batches', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.batch) {
          throw new Error(data.error || 'Stüdyo işlemi başlatılamadı.');
        }
        const batchId = String(data.batch.id);
        syncStudioBatch(
          batchId,
          (data.batch.items || []) as ExecutiveStudioBatchItem[]
        );
        toast.success(
          'Görseller arka planda işleniyor; portföy bilgilerini doldurmaya devam edebilirsin.'
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Görseller yüklenemedi.';
        localMedia.forEach((media) =>
          dispatch({
            type: 'update-media',
            id: media.id,
            progress: 0,
            status: 'error',
            error: message,
          })
        );
        toast.error(message);
      }
    },
    [syncStudioBatch]
  );

  const retryStudioMedia = useCallback(
    async (media: ExecutivePortfolioMedia) => {
      const batchId = draftRef.current.studioBatchId;
      if (!batchId) {
        dispatch({ type: 'retry-media', id: media.id });
        toast.error(
          'Bu görselin Stüdyo çalışması bulunamadı; dosyayı yeniden seç.'
        );
        return;
      }
      dispatch({ type: 'retry-media', id: media.id });
      try {
        const response = await fetch(
          `/api/fabrika/studio/batches/${encodeURIComponent(batchId)}/items/${encodeURIComponent(media.id)}/process`,
          { method: 'POST' }
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Görsel yeniden işlenemedi.');
        }
        notifiedBatchRef.current = null;
        await loadStudioBatch(batchId);
        toast.success('Görsel yeniden işleme sırasına alındı.');
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Görsel yeniden işlenemedi.';
        dispatch({
          type: 'update-media',
          id: media.id,
          progress: media.progress,
          status: 'error',
          error: message,
        });
        toast.error(message);
      }
    },
    [loadStudioBatch]
  );

  const ensurePortfolioRecord = useCallback(async () => {
    const currentDraft = draftRef.current;
    if (currentDraft.details.title.trim().length < 3) {
      toast.error(
        'Devam etmek için en az 3 karakterlik bir portföy başlığı yaz.'
      );
      return null;
    }

    const referenceCode = `FLOW-${currentDraft.id
      .replace(/[^a-z0-9]/gi, '')
      .slice(-12)
      .toUpperCase()}`;
    try {
      const existingResponse = await fetch('/api/fabrika/workspace', {
        cache: 'no-store',
      });
      const existingData = await existingResponse.json();
      if (!existingResponse.ok || !existingData.workspace) {
        throw new Error(
          existingData.error || 'Portföy kayıtları doğrulanamadı.'
        );
      }
      if (currentDraft.propertyId) {
        const persistedProperty = existingData.workspace.properties?.find(
          (property: { id: string }) =>
            property.id === currentDraft.propertyId
        );
        if (persistedProperty?.id) return String(persistedProperty.id);
        dispatch({ type: 'set-property-id', propertyId: null });
      }
      const existingProperty = existingData.workspace?.properties?.find(
        (property: { id: string; referenceCode?: string | null }) =>
          property.referenceCode === referenceCode
      );
      if (existingResponse.ok && existingProperty?.id) {
        dispatch({
          type: 'set-property-id',
          propertyId: existingProperty.id,
        });
        return String(existingProperty.id);
      }

      const numericPrice = Number(
        currentDraft.details.price.replace(/[^0-9]/g, '')
      );
      const response = await fetch('/api/fabrika/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-property',
          title: currentDraft.details.title,
          referenceCode,
          location: currentDraft.details.location || null,
          price:
            Number.isFinite(numericPrice) && numericPrice > 0
              ? numericPrice
              : null,
          roomCount: null,
          area: null,
          status: 'DRAFT',
          description: [
            currentDraft.details.propertyType,
            currentDraft.details.description,
          ]
            .filter(Boolean)
            .join('\n\n'),
          imageUrl: '',
          ownerContactId: null,
          assignedMemberId: null,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Portföy kaydı oluşturulamadı.');
      }
      const property = data.workspace?.properties?.find(
        (item: { id: string; referenceCode?: string | null }) =>
          item.referenceCode === referenceCode
      );
      if (!property?.id) {
        throw new Error('Oluşturulan portföy kaydı doğrulanamadı.');
      }
      dispatch({ type: 'set-property-id', propertyId: String(property.id) });
      toast.success('Portföy taslağı güvenle oluşturuldu.');
      return String(property.id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Portföy kaydı oluşturulamadı.'
      );
      return null;
    }
  }, []);

  const attachReadyStudioMedia = useCallback(async () => {
    const currentDraft = draftRef.current;
    if (!currentDraft.propertyId || !currentDraft.studioBatchId) return;
      const itemIds = currentDraft.media
      .filter(
        (media) =>
          media.status === 'ready' && !media.removed && !media.attachedMediaId
      )
      .map((media) => media.id);
      if (!itemIds.length) return;
      const originalItemIds = currentDraft.media
        .filter(
          (media) =>
            itemIds.includes(media.id) && media.restoredToOriginal
        )
        .map((media) => media.id);

    try {
      const response = await fetch(
        `/api/fabrika/studio/batches/${encodeURIComponent(currentDraft.studioBatchId)}/attach`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: currentDraft.propertyId,
            itemIds,
            originalItemIds,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Hazır görseller portföye eklenemedi.');
      }
      const items = await loadStudioBatch(currentDraft.studioBatchId);
      const coverItem = items.find(
        (item) => item.id === currentDraft.coverMediaId && item.attachedMediaId
      );
      if (coverItem?.attachedMediaId) {
        const coverResponse = await fetch(
          `/api/fabrika/properties/${encodeURIComponent(currentDraft.propertyId)}/media/${encodeURIComponent(coverItem.attachedMediaId)}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isCover: true }),
          }
        );
        const coverData = await coverResponse.json();
        if (!coverResponse.ok || !coverData.success) {
          throw new Error(coverData.error || 'Kapak fotoğrafı kaydedilemedi.');
        }
      }
      toast.success('Onaylanan Stüdyo görselleri portföye eklendi.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Hazır görseller portföye eklenemedi.'
      );
    }
  }, [loadStudioBatch]);

  useEffect(() => {
    if (draft.currentStep !== 'results') return;
    void attachReadyStudioMedia();
  }, [attachReadyStudioMedia, draft.currentStep, draft.media]);

  const continuePortfolioWorkflow = useCallback(async () => {
    if (draftRef.current.currentStep === 'portfolio') {
      const propertyId = await ensurePortfolioRecord();
      if (!propertyId) return;
    }
    dispatch({ type: 'next' });
  }, [ensurePortfolioRecord]);

  const openWorkflow = useCallback(
    (
      source: ExecutiveWorkflowSource,
      step: ExecutiveWorkflowStep = 'source'
    ) => {
      setEntryMode(source);
      dispatch({
        type: 'go-to-step',
        step: resolveExecutiveWorkflowEntryStep(draftRef.current, step),
      });
      setDialogOpen(true);
    },
    []
  );

  const resumeWorkflow = useCallback(() => {
    const currentDraft = draftRef.current;
    openWorkflow(
      currentDraft.source ?? 'studio',
      currentDraft.source ? currentDraft.currentStep : 'source'
    );
  }, [openWorkflow]);

  return {
    draft,
    entryMode,
    dialogOpen,
    status: getPortfolioWorkflowStatus(draft),
    onAction: handleAction,
    onClose: () => setDialogOpen(false),
    onContinue: continuePortfolioWorkflow,
    onFilesSelected: uploadStudioFiles,
    onOpenChange: setDialogOpen,
    onRetryMedia: retryStudioMedia,
    openWorkflow,
    resumeWorkflow,
  };
}
