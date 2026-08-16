'use client';

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Download,
  FileImage,
  ImagePlus,
  MapPin,
  Megaphone,
  RefreshCcw,
  Save,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { useState } from 'react';
import type {
  ExecutivePortfolioAction,
  ExecutivePortfolioDraft,
  ExecutivePortfolioMedia,
  ExecutiveWorkflowSource,
} from '../../../lib/executive-portfolio-workflow';
import {
  createExecutivePortfolioDownload,
  EXECUTIVE_WORKFLOW_STEPS,
  getExecutiveWorkflowResultState,
} from '../../../lib/executive-portfolio-workflow';
import {
  Dialog,
  DialogContent,
  DialogDescription as RadixDialogDescription,
  DialogTitle as RadixDialogTitle,
} from '../../ui/dialog';

type EntryMode = ExecutiveWorkflowSource;

type PortfolioWorkflowContentProps = {
  draft: ExecutivePortfolioDraft;
  entryMode: EntryMode;
  onAction: (action: ExecutivePortfolioAction) => void;
  onFilesSelected: (files: File[]) => Promise<void>;
  onRetryMedia: (media: ExecutivePortfolioMedia) => Promise<void>;
  onContinue: () => Promise<void>;
  onClose: () => void;
};

const stepLabels = [
  'Başlangıç',
  'Portföy',
  'AI Stüdyo',
  'Reklam',
  'Pazarlama',
  'Sonuç',
];

const countryOptions = ['Türkiye', 'Almanya', 'Birleşik Krallık'];
const channelOptions = ['Instagram', 'Google', 'WhatsApp'];

function WorkflowTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-semibold text-white">{children}</h2>;
}

function WorkflowDescription({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-6 text-slate-400">{children}</p>;
}

function mediaStatus(media: ExecutivePortfolioMedia) {
  if (media.removed) return 'Kaldırıldı';
  switch (media.status) {
    case 'queued':
      return 'Sırada';
    case 'uploading':
      return `Yükleniyor · %${media.progress}`;
    case 'processing':
      return `İşleniyor · %${media.progress}`;
    case 'ready':
      return 'Hazır';
    case 'error':
      return media.error || 'İşlem başarısız';
  }
}

function StepHeader({ draft }: { draft: ExecutivePortfolioDraft }) {
  const currentIndex = EXECUTIVE_WORKFLOW_STEPS.indexOf(draft.currentStep);
  return (
    <div className="border-b border-slate-800/90 px-5 pb-4 pt-5 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Adım {currentIndex + 1} / {EXECUTIVE_WORKFLOW_STEPS.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">{stepLabels[currentIndex]}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-medium text-emerald-200">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Otomatik kaydedildi
        </span>
      </div>
      <div className="mt-4 grid grid-cols-6 gap-1" aria-label="İşlem ilerlemesi">
        {EXECUTIVE_WORKFLOW_STEPS.map((step, index) => (
          <span
            key={step}
            className={`h-1 rounded-full ${
              index <= currentIndex ? 'bg-cyan-400' : 'bg-slate-800'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function SourceStep({
  entryMode,
  onAction,
}: Pick<PortfolioWorkflowContentProps, 'entryMode' | 'onAction'>) {
  if (entryMode === 'hunter') {
    return (
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <WorkflowTitle>
            AI Portföy Uzmanı ile başla
          </WorkflowTitle>
          <WorkflowDescription>
            Arama ölçütlerini belirle, bulunan portföyü seç ve ortak taslağa ekle.
          </WorkflowDescription>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="/fabrika/avci"
            className="rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.07] p-4 transition hover:border-cyan-300/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <MapPin className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            <strong className="mt-4 block text-sm text-white">Yeni portföy ara</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              Konum, bütçe ve mülk türüyle AI aramasını aç.
            </span>
          </a>
          <button
            type="button"
            className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 text-left transition hover:border-cyan-300/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            onClick={() => onAction({ type: 'choose-source', source: 'hunter' })}
          >
            <BriefcaseBusiness className="h-5 w-5 text-rose-300" aria-hidden="true" />
            <strong className="mt-4 block text-sm text-white">Bulunan portföyü ekle</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              Sonuç bilgilerini Portföyler taslağına aktar.
            </span>
          </button>
        </div>
      </div>
    );
  }

  const studioChoices = [
    {
      title: 'Mevcut portföyünü seç',
      description: 'Kayıtlı bir portföyün görselleriyle devam et.',
      href: '/fabrika/portfoyler',
      icon: BriefcaseBusiness,
    },
    {
      title: 'Sadece resim düzenlemek istiyorum',
      description: 'Portföy oluşturmadan Stüdyo araçlarını kullan.',
      href: '/fabrika/studyo',
      icon: FileImage,
    },
  ];

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div>
        <WorkflowTitle>
          AI Stüdyo ile ne yapmak istersin?
        </WorkflowTitle>
        <WorkflowDescription>
          Tek bir seçim yap; sonraki adımlar aynı küçük pencerenin içinde açılır.
        </WorkflowDescription>
      </div>
      <div className="grid gap-3">
        {studioChoices.map(({ title, description, href, icon: Icon }) => (
          <a
            key={title}
            href={href}
            className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/70 p-4 transition hover:border-blue-300/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-400/10 text-blue-200">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <strong className="block text-sm text-white">{title}</strong>
              <span className="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
            </span>
          </a>
        ))}
        <button
          type="button"
          className="flex items-center gap-4 rounded-2xl border border-cyan-300/35 bg-cyan-400/[0.08] p-4 text-left transition hover:border-cyan-200/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          onClick={() => onAction({ type: 'choose-source', source: 'studio' })}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
            <ImagePlus className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <strong className="block text-sm text-white">Yeni bir portföy</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-400">
              Görselleri yükle, bilgileri tamamla ve sıralı akışı başlat.
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

function PortfolioStep({
  draft,
  onAction,
  onFilesSelected,
  onRetryMedia,
}: Pick<
  PortfolioWorkflowContentProps,
  'draft' | 'onAction' | 'onFilesSelected' | 'onRetryMedia'
>) {
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    void onFilesSelected(Array.from(files));
  };

  const completeDetailsWithAi = async () => {
    setAiBusy(true);
    setAiMessage('');
    try {
      const response = await fetch('/api/fabrika/seo-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:
            draft.details.title.trim() ||
            `${draft.details.propertyType.trim() || 'Gayrimenkul'} portföyü`,
          location: draft.details.location,
          price: draft.details.price,
          roomCount: '',
          area: '',
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'AI önerisi oluşturulamadı.');
      }
      const description = String(data.htmlDescription || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      onAction({
        type: 'update-details',
        details: {
          title: String(data.seoTitle || draft.details.title),
          description: description || String(data.metaDescription || ''),
        },
      });
      setAiMessage('AI önerileri alanlara eklendi; istersen düzenleyebilirsin.');
    } catch (error) {
      setAiMessage(
        error instanceof Error ? error.message : 'AI önerisi oluşturulamadı.'
      );
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div>
        <WorkflowTitle>
          Portföy görselleri ve bilgileri
        </WorkflowTitle>
        <WorkflowDescription>
          Görseller Arka planda işlenir; beklerken portföy bilgilerini doldurabilirsin.
        </WorkflowDescription>
      </div>

      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/35 bg-cyan-400/[0.05] px-4 text-center transition hover:border-cyan-300/70 focus-within:ring-2 focus-within:ring-cyan-300">
        <UploadCloud className="h-7 w-7 text-cyan-300" aria-hidden="true" />
        <strong className="mt-2 text-sm text-white">Görselleri seç veya buraya bırak</strong>
        <span className="mt-1 text-xs text-slate-500">Her dosyanın ilerlemesi ayrı gösterilir.</span>
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => handleFiles(event.currentTarget.files)}
        />
      </label>

      {draft.media.length > 0 && (
        <div className="space-y-2" aria-label="Yüklenen görseller">
          {draft.media.map((media) => (
            <div key={media.id} className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-white">{media.name}</p>
                  <p className={`mt-1 text-[10px] ${media.status === 'error' ? 'text-rose-300' : 'text-slate-500'}`}>
                    {mediaStatus(media)}
                  </p>
                </div>
                {media.status === 'error' && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/25 px-2.5 py-1.5 text-[10px] text-rose-200"
                    onClick={() => void onRetryMedia(media)}
                  >
                    <RefreshCcw className="h-3 w-3" /> Yeniden dene
                  </button>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <span
                  className={`block h-full rounded-full ${media.status === 'error' ? 'bg-rose-400' : 'bg-cyan-400'}`}
                  style={{ width: `${media.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="text-xs text-slate-400">İlan türü</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Portföy ilan türü">
            {([
              ['SALE', 'Satılık'],
              ['RENT', 'Kiralık'],
            ] as const).map(([value, label]) => {
              const selected = draft.details.listingType === value;
              return (
                <label
                  key={value}
                  className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-cyan-300 ${
                    selected
                      ? 'border-cyan-300 bg-cyan-400/15 text-cyan-100'
                      : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="portfolio-listing-type"
                    value={value}
                    checked={selected}
                    onChange={() =>
                      onAction({
                        type: 'update-details',
                        details: { listingType: value },
                      })
                    }
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="text-xs text-slate-400">
          Portföy başlığı
          <input
            value={draft.details.title}
            onChange={(event) => onAction({ type: 'update-details', details: { title: event.target.value } })}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-cyan-300"
            placeholder="Örn. Kestel deniz manzaralı villa"
          />
        </label>
        <label className="text-xs text-slate-400">
          Konum
          <input
            value={draft.details.location}
            onChange={(event) => onAction({ type: 'update-details', details: { location: event.target.value } })}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-cyan-300"
            placeholder="İl / İlçe"
          />
        </label>
        <label className="text-xs text-slate-400">
          Mülk türü
          <input
            value={draft.details.propertyType}
            onChange={(event) => onAction({ type: 'update-details', details: { propertyType: event.target.value } })}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-cyan-300"
            placeholder="Villa, daire, arsa…"
          />
        </label>
        <label className="text-xs text-slate-400">
          Fiyat
          <input
            value={draft.details.price}
            onChange={(event) => onAction({ type: 'update-details', details: { price: event.target.value } })}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-cyan-300"
            placeholder="₺"
          />
        </label>
      </div>
      <label className="block text-xs text-slate-400">
        Açıklama
        <textarea
          value={draft.details.description}
          onChange={(event) => onAction({ type: 'update-details', details: { description: event.target.value } })}
          className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/70 p-3 text-sm leading-6 text-white outline-none focus:border-cyan-300"
          placeholder="Portföyü öne çıkaran özellikleri yaz…"
        />
      </label>
      <button
        type="button"
        disabled={aiBusy}
        onClick={() => void completeDetailsWithAi()}
        className="inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/[0.07] px-3 py-2 text-xs text-violet-200 disabled:cursor-wait disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" />
        {aiBusy ? 'AI önerileri hazırlanıyor…' : 'AI ile açıklamayı ve eksikleri tamamla'}
      </button>
      {aiMessage ? <p className="text-xs text-slate-400" role="status">{aiMessage}</p> : null}
    </div>
  );
}

function ReviewStep({
  draft,
  onAction,
  onRetryMedia,
}: Pick<PortfolioWorkflowContentProps, 'draft' | 'onAction' | 'onRetryMedia'>) {
  const visibleMedia = draft.media.filter((media) => !media.removed);
  const readyMedia = visibleMedia.filter((media) => media.status === 'ready');
  const activeMedia = visibleMedia.filter((media) =>
    ['queued', 'uploading', 'processing'].includes(media.status)
  );
  const failedMedia = visibleMedia.filter((media) => media.status === 'error');
  const averageProgress = visibleMedia.length
    ? Math.round(
        visibleMedia.reduce((total, media) => total + media.progress, 0) /
          visibleMedia.length
      )
    : 0;

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div>
        <WorkflowTitle>AI Stüdyo</WorkflowTitle>
        <WorkflowDescription>
          Görseller ışık, renk, perspektif ve netlik açısından arka planda iyileştirilir.
          Hazır sonuçlarda AI sürümüyle orijinal arasında seçim yapabilir, kapağı belirleyebilirsin.
        </WorkflowDescription>
      </div>

      <section
        aria-label="AI Stüdyo işlem durumu"
        className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">
                {activeMedia.length
                  ? `AI Stüdyo çalışıyor · %${averageProgress}`
                  : draft.studioBatchId
                    ? `${readyMedia.length} görsel hazır`
                    : 'AI Stüdyo çalışması bekleniyor'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                {draft.studioBatchId
                  ? 'İşlem sunucudaki güvenli Stüdyo kuyruğunda yürütülür; bu pencereyi kapatsan da devam eder.'
                  : 'Bir önceki adımda görsel yüklediğinde gerçek AI Stüdyo işlemi otomatik olarak başlar.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-emerald-200">
              {readyMedia.length} hazır
            </span>
            {activeMedia.length > 0 ? (
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-cyan-200">
                {activeMedia.length} işleniyor
              </span>
            ) : null}
            {failedMedia.length > 0 ? (
              <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-rose-200">
                {failedMedia.length} hata
              </span>
            ) : null}
          </div>
        </div>
        {activeMedia.length > 0 ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-900/80">
            <span
              className="block h-full rounded-full bg-cyan-300 transition-[width]"
              style={{ width: `${averageProgress}%` }}
            />
          </div>
        ) : null}
      </section>

      {draft.media.length === 0 ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
          <AlertCircle className="mr-2 inline h-4 w-4" /> Henüz görsel eklenmedi. Geri dönerek görsel yükleyebilirsin.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {draft.media.map((media) => (
            <article key={media.id} className={`overflow-hidden rounded-2xl border ${media.removed ? 'border-rose-400/25 opacity-60' : 'border-slate-700'} bg-slate-900/70`}>
              <div className="flex aspect-[16/8] items-center justify-center bg-slate-950/70">
                {media.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.previewUrl} alt={media.name} className="h-full w-full object-cover" />
                ) : (
                  <FileImage className="h-8 w-8 text-slate-600" />
                )}
              </div>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-xs font-medium text-white">{media.name}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                      media.status === 'error'
                        ? 'bg-rose-400/10 text-rose-200'
                        : media.status === 'ready'
                          ? 'bg-emerald-400/10 text-emerald-200'
                          : 'bg-cyan-400/10 text-cyan-200'
                    }`}
                  >
                    {media.status === 'ready' && media.outputUrl
                      ? media.restoredToOriginal
                        ? 'Orijinal kullanılıyor'
                        : 'AI ile iyileştirildi'
                      : mediaStatus(media)}
                  </span>
                </div>
                {media.status !== 'ready' ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <span
                      className={`block h-full rounded-full ${media.status === 'error' ? 'bg-rose-400' : 'bg-cyan-400'}`}
                      style={{ width: `${media.progress}%` }}
                    />
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!media.removed && (
                    <button type="button" onClick={() => onAction({ type: 'select-cover', id: media.id })} className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/25 px-2 py-1 text-[10px] text-cyan-200">
                      <Star className="h-3 w-3" /> {draft.coverMediaId === media.id ? 'Kapak seçildi' : 'Kapak seç'}
                    </button>
                  )}
                  {media.outputUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        onAction({
                          type: media.restoredToOriginal
                            ? 'use-enhanced'
                            : 'restore-original',
                          id: media.id,
                        })
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] text-slate-300"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      {media.restoredToOriginal ? 'AI sürümünü kullan' : 'Orijinali kullan'}
                    </button>
                  ) : null}
                  {media.status === 'error' ? (
                    <button
                      type="button"
                      onClick={() => void onRetryMedia(media)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-400/25 px-2 py-1 text-[10px] text-amber-200"
                    >
                      <RefreshCcw className="h-3 w-3" /> Yeniden dene
                    </button>
                  ) : null}
                  <button type="button" onClick={() => onAction(media.removed ? { type: 'restore-original', id: media.id } : { type: 'remove-media', id: media.id })} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/25 px-2 py-1 text-[10px] text-rose-200">
                    <Trash2 className="h-3 w-3" /> {media.removed ? 'Geri al' : 'Kaldır'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500">{visibleMedia.length} görsel onayda · {draft.media.length - visibleMedia.length} görsel kaldırıldı</p>
    </div>
  );
}

function AdvertisingStep({ draft, onAction }: Pick<PortfolioWorkflowContentProps, 'draft' | 'onAction'>) {
  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div>
        <WorkflowTitle>AI Reklam Tasarımı</WorkflowTitle>
        <WorkflowDescription>
          Onaylanan görsellerle poster hazırla veya bu isteğe bağlı aşamayı atla.
        </WorkflowDescription>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href="/fabrika/reklam-tasarimi" className="rounded-2xl border border-blue-400/25 bg-blue-400/[0.07] p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300">
          <ImagePlus className="h-6 w-6 text-blue-300" />
          <strong className="mt-4 block text-sm text-white">Poster hazırla</strong>
          <span className="mt-1 block text-xs leading-5 text-slate-400">Reklam tasarımı çalışma alanını aç.</span>
        </a>
        <button type="button" onClick={() => onAction({ type: 'skip-advertising' })} className={`rounded-2xl border p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${draft.advertising.skipped ? 'border-cyan-300/50 bg-cyan-300/[0.08]' : 'border-slate-700 bg-slate-900/70'}`}>
          <ArrowRight className="h-6 w-6 text-cyan-300" />
          <strong className="mt-4 block text-sm text-white">Bu aşamayı atla</strong>
          <span className="mt-1 block text-xs leading-5 text-slate-400">Doğrudan pazarlama seçimlerine geç.</span>
        </button>
      </div>
    </div>
  );
}

function ToggleGroup({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-medium text-slate-300">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? selected.filter((item) => item !== option) : [...selected, option])}
              className={`rounded-full border px-3 py-2 text-xs transition ${active ? 'border-cyan-300/55 bg-cyan-300/10 text-cyan-100' : 'border-slate-700 text-slate-400 hover:border-slate-500'}`}
            >
              {active && <Check className="mr-1 inline h-3 w-3" />} {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function MarketingStep({ draft, onAction }: Pick<PortfolioWorkflowContentProps, 'draft' | 'onAction'>) {
  const update = (patch: Partial<ExecutivePortfolioDraft['marketing']>) => onAction({
    type: 'set-marketing',
    countries: patch.countries || draft.marketing.countries,
    channels: patch.channels || draft.marketing.channels,
    copy: patch.copy ?? draft.marketing.copy,
  });
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div>
        <WorkflowTitle>AI Pazarlama Uzmanı</WorkflowTitle>
        <WorkflowDescription>
          Yurt içi veya yurt dışı hedeflerini ve yayın kanallarını seç.
        </WorkflowDescription>
      </div>
      <ToggleGroup label="Hedef ülkeler" options={countryOptions} selected={draft.marketing.countries} onChange={(countries) => update({ countries })} />
      <ToggleGroup label="Kanallar" options={channelOptions} selected={draft.marketing.channels} onChange={(channels) => update({ channels })} />
      <label className="block text-xs font-medium text-slate-300">
        Pazarlama metni
        <textarea
          value={draft.marketing.copy}
          onChange={(event) => update({ copy: event.target.value })}
          placeholder="İlan ve kampanya metnini yaz veya AI Pazarlama Uzmanı'nda oluştur…"
          rows={4}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-300"
        />
      </label>
      <a href="/fabrika/pazarlamaci" className="inline-flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-xs text-amber-100">
        <Megaphone className="h-4 w-4" /> Ayrıntılı pazarlama alanını aç
      </a>
    </div>
  );
}

function ResultsStep({ draft, onAction }: Pick<PortfolioWorkflowContentProps, 'draft' | 'onAction'>) {
  const approved = draft.media.filter((media) => !media.removed);
  const removed = draft.media.filter((media) => media.removed);
  const resultState = getExecutiveWorkflowResultState(draft);
  const download = createExecutivePortfolioDownload(draft);
  const downloadHref = `data:${download.mimeType};charset=utf-8,${encodeURIComponent(download.content)}`;
  return (
    <div className="space-y-4 p-5 sm:p-6">
      <div>
        <WorkflowTitle>
          {resultState.ready ? 'Çıktılar doğrulandı' : 'Tamamlanacak işler var'}
        </WorkflowTitle>
        <WorkflowDescription>
          {resultState.ready
            ? 'Portföy ve seçilen çıktılar sunucu kayıtlarıyla doğrulandı.'
            : 'Yalnızca gerçekten kaydedilen çıktılar tamamlandı olarak gösterilir.'}
        </WorkflowDescription>
      </div>
      {!resultState.ready && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4" role="status">
          <p className="text-xs font-semibold text-amber-100">Sonraki adımlar</p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/80">
            {resultState.nextSteps.map((step) => (
              <li key={step}>• {step}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ['Oluşturulan portföy', draft.details.title || 'İsimsiz taslak'],
          ['Onaylanan fotoğraflar', `${approved.length} görsel`],
          ['Kaldırılan fotoğraflar', `${removed.length} görsel`],
          ['Kapak fotoğrafı', draft.coverMediaId ? 'Seçildi' : 'Seçilmedi'],
          ['Hazırlanmış posterler', `${draft.advertising.posters.length} poster`],
          ['Pazarlama metinleri', draft.marketing.copy || 'Henüz oluşturulmadı'],
          ['Seçilen ülke ve kanallar', `${draft.marketing.countries.length} ülke · ${draft.marketing.channels.length} kanal`],
        ].map(([label, value]) => (
          <div key={label} className={`rounded-xl border border-slate-800 bg-slate-950/50 p-3 ${label === 'Pazarlama metinleri' ? 'sm:col-span-2' : ''}`}>
            <p className="text-[10px] text-slate-500">{label}</p>
            <p className="mt-1 text-xs font-medium text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={draft.propertyId ? `/fabrika/portfoyler?propertyId=${encodeURIComponent(draft.propertyId)}` : '/fabrika/portfoyler'} className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200">Portföyü görüntüle</a>
        {draft.propertyId ? (
          <a
            href={downloadHref}
            download={download.fileName}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200"
          >
            <Download className="h-3.5 w-3.5" /> Özeti indir
          </a>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-slate-800 px-3 py-2 text-xs text-slate-500" aria-disabled="true">
            <Download className="h-3.5 w-3.5" /> Kayıttan sonra indir
          </span>
        )}
        <a href="/fabrika/pazarlamaci" className="rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-xs text-amber-100">Pazarlamaya geç</a>
        <button type="button" onClick={() => onAction({ type: 'reset' })} className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.07] px-3 py-2 text-xs text-cyan-100">Yeni işlem başlat</button>
      </div>
    </div>
  );
}

function WorkflowBody(props: PortfolioWorkflowContentProps) {
  switch (props.draft.currentStep) {
    case 'source':
      return <SourceStep entryMode={props.entryMode} onAction={props.onAction} />;
    case 'portfolio':
      return (
        <PortfolioStep
          draft={props.draft}
          onAction={props.onAction}
          onFilesSelected={props.onFilesSelected}
          onRetryMedia={props.onRetryMedia}
        />
      );
    case 'review':
      return (
        <ReviewStep
          draft={props.draft}
          onAction={props.onAction}
          onRetryMedia={props.onRetryMedia}
        />
      );
    case 'advertising':
      return <AdvertisingStep draft={props.draft} onAction={props.onAction} />;
    case 'marketing':
      return <MarketingStep draft={props.draft} onAction={props.onAction} />;
    case 'results':
      return <ResultsStep draft={props.draft} onAction={props.onAction} />;
  }
}

function WorkflowFooter({
  draft,
  entryMode,
  onAction,
  onContinue,
  onClose,
}: PortfolioWorkflowContentProps) {
  const [continuing, setContinuing] = useState(false);
  const atStart = draft.currentStep === 'source';
  const atResults = draft.currentStep === 'results';
  const continueFlow = async () => {
    setContinuing(true);
    try {
      if (atStart) {
        onAction({ type: 'choose-source', source: entryMode });
      } else {
        await onContinue();
      }
    } finally {
      setContinuing(false);
    }
  };
  return (
    <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-800 bg-[#091525]/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <button
        type="button"
        onClick={() => (atStart ? onClose() : onAction({ type: 'back' }))}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <ArrowLeft className="h-4 w-4" /> Geri
      </button>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <Save className="h-4 w-4" /> Kaydet ve çık
        </button>
        {!atResults && (
          <button
            type="button"
            disabled={continuing}
            onClick={() => void continueFlow()}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            {continuing ? 'Kaydediliyor…' : 'Devam et'} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function PortfolioWorkflowContent(props: PortfolioWorkflowContentProps) {
  return (
    <div className="flex h-[min(92dvh,920px)] min-h-0 flex-col overflow-hidden">
      <StepHeader draft={props.draft} />
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <WorkflowBody {...props} />
      </div>
      <WorkflowFooter {...props} />
    </div>
  );
}

export function PortfolioWorkflowDialog({
  open,
  onOpenChange,
  ...contentProps
}: PortfolioWorkflowContentProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="w-[min(96vw,1040px)] max-w-none gap-0 overflow-hidden border border-slate-700 bg-[#091525] p-0 text-slate-100 shadow-2xl shadow-black/60 ring-0"
      >
        <RadixDialogTitle className="sr-only">Portföy işlem akışı</RadixDialogTitle>
        <RadixDialogDescription className="sr-only">
          Portföy oluşturma, görsel kontrolü, reklam ve pazarlama adımları.
        </RadixDialogDescription>
        <PortfolioWorkflowContent {...contentProps} />
      </DialogContent>
    </Dialog>
  );
}
