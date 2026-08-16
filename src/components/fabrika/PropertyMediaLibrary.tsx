'use client';

import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  ImagePlus,
  Images,
  Loader2,
  Megaphone,
  Sparkles,
  Star,
  UploadCloud,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import MediaVariantBadge, {
  type MediaVariant,
} from '@/components/fabrika/MediaVariantBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type PropertyMediaItem = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  byteSize: number | null;
  sortOrder: number;
  isCover: boolean;
  mediaType: 'PHOTO' | 'POSTER' | 'MARKETING_ASSET';
  source: 'MANUAL_UPLOAD' | 'HUNTER' | 'STUDIO_ENHANCED' | 'POSTER';
  variantType: MediaVariant;
  parentMediaId: string | null;
  usageRightsStatus: 'CONFIRMED' | 'UNVERIFIED' | 'RESTRICTED';
  archivedAt: string | null;
  variants: Array<{
    id: string;
    url: string;
    fileName: string;
    variantType: MediaVariant;
  }>;
  parentMedia: {
    id: string;
    url: string;
    fileName: string;
    variantType: MediaVariant;
  } | null;
};

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_BYTES = 15 * 1024 * 1024;

function readableBytes(value: number | null) {
  if (!value) return 'Boyut bilinmiyor';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export default function PropertyMediaLibrary({
  open,
  onOpenChange,
  propertyId,
  propertyTitle,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  propertyTitle: string;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PropertyMediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState(false);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/fabrika/properties/${encodeURIComponent(propertyId)}/media`,
        { cache: 'no-store' }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Portföy görselleri yüklenemedi.');
      }
      setItems(data.items || []);
      setSelectedIds((current) =>
        current.filter((id) =>
          (data.items || []).some((item: PropertyMediaItem) => item.id === id)
        )
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Portföy görselleri yüklenemedi.'
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadMedia(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMedia, open]);

  function validateFiles(files: File[]) {
    if (files.length > 12) {
      toast.error('Tek seferde en fazla 12 görsel yükleyebilirsiniz.');
      return false;
    }
    const invalid = files.find(
      (file) => !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_BYTES
    );
    if (invalid) {
      toast.error(
        `${invalid.name} desteklenmiyor veya 15 MB sınırını aşıyor.`
      );
      return false;
    }
    return files.length > 0;
  }

  async function upload(files: File[]) {
    if (!validateFiles(files)) return;
    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.set('usageRightsStatus', 'CONFIRMED');
      const response = await fetch(
        `/api/fabrika/properties/${encodeURIComponent(propertyId)}/media`,
        { method: 'POST', body: formData }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Görseller yüklenemedi.');
      }
      toast.success(`${data.items.length} görsel portföye eklendi.`);
      await loadMedia();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Görseller yüklenemedi.');
    } finally {
      setUploading(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void upload(Array.from(event.target.files ?? []));
    event.target.value = '';
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void upload(Array.from(event.dataTransfer.files));
  }

  function toggle(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    );
  }

  async function patchMedia(
    mediaId: string,
    body: Record<string, unknown>,
    successMessage: string
  ) {
    setBusyAction(mediaId);
    try {
      const response = await fetch(
        `/api/fabrika/properties/${encodeURIComponent(propertyId)}/media/${encodeURIComponent(mediaId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Görsel güncellenemedi.');
      }
      toast.success(successMessage);
      await loadMedia();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Görsel güncellenemedi.');
    } finally {
      setBusyAction(null);
    }
  }

  async function move(mediaId: string, direction: -1 | 1) {
    const currentIndex = items.findIndex((item) => item.id === mediaId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    const ordered = [...items];
    [ordered[currentIndex], ordered[nextIndex]] = [
      ordered[nextIndex],
      ordered[currentIndex],
    ];
    setBusyAction(mediaId);
    try {
      const response = await fetch(
        `/api/fabrika/properties/${encodeURIComponent(propertyId)}/media/bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reorder',
            mediaIds: ordered.map((item) => item.id),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Görsel sırası güncellenemedi.');
      }
      setItems(ordered.map((item, sortOrder) => ({ ...item, sortOrder })));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Görsel sırası güncellenemedi.'
      );
      await loadMedia();
    } finally {
      setBusyAction(null);
    }
  }

  async function archiveSelected() {
    setBusyAction('archive');
    try {
      const response = await fetch(
        `/api/fabrika/properties/${encodeURIComponent(propertyId)}/media/bulk`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'archive', mediaIds: selectedIds }),
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Görseller arşivlenemedi.');
      }
      toast.success(`${data.archivedCount} görsel arşivlendi.`);
      setSelectedIds([]);
      setPendingArchive(false);
      await loadMedia();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Görseller arşivlenemedi.');
    } finally {
      setBusyAction(null);
    }
  }

  async function downloadZip() {
    setBusyAction('zip');
    try {
      const response = await fetch(
        `/api/fabrika/properties/${encodeURIComponent(propertyId)}/media/zip`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaIds: selectedIds }),
        }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'ZIP hazırlanamadı.');
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${propertyTitle}-gorseller.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('ZIP indirmesi hazırlandı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ZIP hazırlanamadı.');
    } finally {
      setBusyAction(null);
    }
  }

  function openStudio(area: 'enhancer' | 'poster') {
    const params = new URLSearchParams({
      area,
      propertyId,
      mediaIds: selectedIds.join(','),
    });
    onOpenChange(false);
    const pathname =
      area === 'poster' ? '/fabrika/reklam-tasarimi' : '/fabrika/studyo';
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-dvh w-screen max-w-none flex-col overflow-hidden rounded-none border-slate-700 bg-slate-950 p-0 text-slate-100 sm:h-[min(92dvh,60rem)] sm:w-[min(96vw,80rem)] sm:max-w-none sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b border-slate-800 px-5 py-4 pr-14 sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Images className="h-5 w-5 text-emerald-300" />
              {propertyTitle} · Medya kütüphanesi
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Orijinalleri koruyun; iyileştirilmiş ve kreatif varyantları aynı
              portföyde yönetin.
            </DialogDescription>
          </DialogHeader>

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                ref={inputRef}
                accept={ACCEPTED_TYPES.join(',')}
                className="sr-only"
                multiple
                onChange={onFileChange}
                type="file"
              />
              <Button
                className="bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="mr-2 h-4 w-4" />
                )}
                {uploading ? 'Yükleniyor…' : 'Fotoğraf yükle'}
              </Button>
              <Button
                disabled={!items.length}
                onClick={() =>
                  setSelectedIds(
                    selectedIds.length === items.length
                      ? []
                      : items.map((item) => item.id)
                  )
                }
                type="button"
                variant="outline"
              >
                <Check className="mr-2 h-4 w-4" />
                {selectedIds.length === items.length
                  ? 'Seçimi kaldır'
                  : 'Tümünü seç'}
              </Button>
              <span className="ml-auto text-xs text-slate-400">
                {selectedIds.length} seçili · {items.length} medya
              </span>
            </div>

            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) =>
                (event.key === 'Enter' || event.key === ' ') &&
                inputRef.current?.click()
              }
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className="mb-4 flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-emerald-400/30 bg-emerald-400/[0.04] px-4 py-5 text-center transition hover:border-emerald-300 hover:bg-emerald-400/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <UploadCloud className="h-6 w-6 text-emerald-300" />
              <p className="mt-2 text-xs font-bold text-white">
                Görselleri buraya bırakın veya bilgisayarınızdan seçin
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                JPG, PNG, WebP veya AVIF · dosya başına 15 MB
              </p>
            </div>

            {loading ? (
              <div className="grid min-h-72 place-items-center rounded-xl border border-slate-800 bg-slate-900/40">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-300" />
              </div>
            ) : items.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {items.map((item, index) => (
                  <article
                    className={`group overflow-hidden rounded-xl border bg-slate-900 transition ${
                      selected.has(item.id)
                        ? 'border-emerald-300 ring-2 ring-emerald-300/15'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                    key={item.id}
                  >
                    <button
                      aria-pressed={selected.has(item.id)}
                      className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-950 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300"
                      onClick={() => toggle(item.id)}
                      type="button"
                    >
                      {/* Public tenant-scoped Blob URLs are intentionally rendered lazily. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={item.fileName}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                        loading="lazy"
                        src={item.url}
                      />
                      <span
                        className={`absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border ${
                          selected.has(item.id)
                            ? 'border-emerald-200 bg-emerald-300 text-emerald-950'
                            : 'border-white/30 bg-slate-950/75 text-transparent'
                        }`}
                      >
                        <Check className="h-4 w-4" />
                      </span>
                      {item.isCover && (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-emerald-300 px-2 py-1 text-[10px] font-bold text-emerald-950">
                          <Star className="h-3 w-3 fill-current" /> Kapak
                        </span>
                      )}
                    </button>
                    <div className="space-y-3 p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <MediaVariantBadge variant={item.variantType} />
                        {item.usageRightsStatus !== 'CONFIRMED' && (
                          <span className="rounded border border-amber-400/25 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-200">
                            Hak: {item.usageRightsStatus}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="truncate text-xs font-semibold text-white">
                          {item.fileName}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          {readableBytes(item.byteSize)}
                          {item.variants.length
                            ? ` · ${item.variants.length} varyant`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          aria-label="Yukarı taşı"
                          className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-30"
                          disabled={index === 0 || busyAction === item.id}
                          onClick={() => void move(item.id, -1)}
                          type="button"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          aria-label="Aşağı taşı"
                          className="grid h-8 w-8 place-items-center rounded-md border border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-white disabled:opacity-30"
                          disabled={index === items.length - 1 || busyAction === item.id}
                          onClick={() => void move(item.id, 1)}
                          type="button"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-slate-700 px-2 text-[10px] font-semibold text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200 disabled:opacity-40"
                          disabled={
                            item.isCover ||
                            item.mediaType !== 'PHOTO' ||
                            item.variantType === 'CREATIVE' ||
                            busyAction === item.id
                          }
                          onClick={() =>
                            void patchMedia(
                              item.id,
                              { isCover: true },
                              'Kapak fotoğrafı güncellendi.'
                            )
                          }
                          type="button"
                        >
                          <Star className="h-3 w-3" /> Kapak yap
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
                <div>
                  <ImagePlus className="mx-auto h-10 w-10 text-slate-600" />
                  <p className="mt-3 font-semibold text-white">Henüz fotoğraf yok</p>
                  <p className="mt-1 text-sm text-slate-400">
                    İlk görsel otomatik olarak portföy kapağı yapılır.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 flex-col gap-2 border-t border-slate-800 bg-slate-950 px-5 py-4 sm:flex-row sm:px-6">
            <Button
              disabled={!selectedIds.length || busyAction === 'archive'}
              onClick={() => setPendingArchive(true)}
              type="button"
              variant="destructive"
            >
              <Archive className="mr-2 h-4 w-4" /> Arşivle
            </Button>
            <Button
              disabled={!selectedIds.length || busyAction === 'zip'}
              onClick={() => void downloadZip()}
              type="button"
              variant="outline"
            >
              {busyAction === 'zip' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              ZIP indir
            </Button>
            <Button
              disabled={!selectedIds.length}
              onClick={() => openStudio('enhancer')}
              type="button"
              variant="outline"
            >
              <Sparkles className="mr-2 h-4 w-4" /> Stüdyo’ya gönder
            </Button>
            <Button
              disabled={!selectedIds.length}
              onClick={() => openStudio('poster')}
              type="button"
              variant="outline"
            >
              <Megaphone className="mr-2 h-4 w-4" /> Poster oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingArchive} onOpenChange={setPendingArchive}>
        <DialogContent className="border-slate-700 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Seçili görseller arşivlensin mi?</DialogTitle>
            <DialogDescription className="text-slate-400">
              {selectedIds.length} görsel görünümden kaldırılır. Blob dosyaları
              fiziksel olarak silinmez ve kayıtlar daha sonra kurtarılabilir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingArchive(false)} variant="outline">
              <X className="mr-2 h-4 w-4" /> Vazgeç
            </Button>
            <Button
              disabled={busyAction === 'archive'}
              onClick={() => void archiveSelected()}
              variant="destructive"
            >
              {busyAction === 'archive' && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Arşivle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
