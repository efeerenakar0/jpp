'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Aperture,
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import PageHeader from '@/components/fabrika/PageHeader';
import toast from 'react-hot-toast';

type StudioScreen = 'upload' | 'results';

type StudioResult = {
  name: string;
  previewUrl: string;
  downloadUrl: string;
};

const AUTO_PROMPT =
  'Bu resimler portföyümün sitesinde yayınlanacak. Her birini yapay zeka ile muhteşem hale getir; ışıklandırmayı, renkleri, netliği ve genel kaliteyi profesyonel emlak fotoğrafçılığı standardında iyileştir. Mimariyi, mobilyaları, perspektifi ve mülkün gerçek özelliklerini koru; yeni nesneler, kişiler, yazılar veya logolar ekleme.';

export default function StudioPage() {
  const [screen, setScreen] = useState<StudioScreen>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [results, setResults] = useState<StudioResult[]>([]);
  const [zipUrl, setZipUrl] = useState('');
  const [activeResult, setActiveResult] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filePreviews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );

  useEffect(() => {
    return () => filePreviews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [filePreviews]);

  const addFiles = (newFiles: File[]) => {
    const images = newFiles.filter((file) => file.type.startsWith('image/'));
    if (images.length !== newFiles.length) toast.error('Yalnızca görsel dosyaları yükleyebilirsiniz.');
    if (!images.length) return;

    setFiles((current) => {
      const known = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...images.filter((file) => !known.has(`${file.name}-${file.size}-${file.lastModified}`))];
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

  const startProcessing = async () => {
    if (!files.length) {
      toast.error('Önce en az bir fotoğraf yükleyin.');
      return;
    }

    setIsProcessing(true);
    setProgress(12);
    setStatus('Fotoğraflar güvenli olarak stüdyoya yükleniyor…');

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('photos', file));
      const uploadResponse = await fetch('/api/fabrika/studio/upload', { method: 'POST', body: formData });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(uploadData.error || 'Fotoğraflar yüklenemedi.');

      setProgress(38);
      setStatus('GPT Image, portföy kalitesini koruyarak ışık ve renkleri iyileştiriyor…');
      const processResponse = await fetch('/api/fabrika/studio/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shootId: uploadData.shootId }),
      });
      const processData = await processResponse.json();
      if (!processResponse.ok) throw new Error(processData.error || 'Görseller işlenemedi.');

      setProgress(100);
      setStatus('İndirilebilir görseller hazırlanıyor…');
      setResults(processData.results ?? []);
      setZipUrl(processData.zipUrl ?? '');
      setActiveResult(0);
      setScreen('results');
      toast.success(`${processData.processedCount} fotoğrafınız iyileştirildi.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem sırasında bir hata oluştu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetStudio = () => {
    setScreen('upload');
    setFiles([]);
    setResults([]);
    setZipUrl('');
    setActiveResult(0);
    setProgress(0);
  };

  const activePhoto = results[activeResult];
  const activeOriginal = filePreviews[activeResult];

  return (
    <div className="space-y-6 overflow-x-hidden pb-8 text-slate-100">
      <PageHeader
        eyebrow="Görsel operasyonu"
        title="Stüdyo"
        description="Portföy fotoğraflarını profesyonel yayın standardına göre iyileştirin ve indirilebilir çıktılar hazırlayın."
        icon={Aperture}
        actions={
          <>
            <span className="hidden items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5" /> GPT Image destekli
            </span>
            {screen === 'results' && (
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
        {screen === 'upload' ? (
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Sparkles className="h-4 w-4" /></div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">Otomatik AI talimatı</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">“{AUTO_PROMPT}”</p>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col items-center justify-between gap-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-4 sm:flex-row sm:px-5">
              <div className="flex items-center gap-2 text-xs leading-5 text-slate-400"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" /> Görseller yalnızca işlem için kullanılır; API anahtarı tarayıcıya gönderilmez.</div>
              <button type="button" onClick={startProcessing} disabled={!files.length || isProcessing} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3.5 text-sm font-extrabold text-emerald-950 shadow-lg shadow-emerald-500/15 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto">
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                AI ile iyileştir <ArrowRight className="h-4 w-4" />
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
              {zipUrl && <a href={zipUrl} download="Jasmine_Studio_AI_Iyilestirilmis.zip" className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-200"><Download className="h-4 w-4" /> Tümünü ZIP indir</a>}
            </div>

            {activePhoto ? (
              <div className="grid overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/50 shadow-2xl shadow-black/30 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="relative min-h-[22rem] bg-black">
                  <img src={activePhoto.previewUrl} alt={`${activePhoto.name} iyileştirilmiş`} className="h-full max-h-[39rem] min-h-[22rem] w-full object-contain" />
                  <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-300 px-3 py-1.5 text-xs font-extrabold text-emerald-950"><Sparkles className="h-3.5 w-3.5" /> AI iyileştirildi</div>
                </div>
                <div className="flex flex-col p-5 sm:p-7">
                  <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">Seçili görsel</p>
                  <h2 className="mt-2 break-all text-xl font-extrabold text-white">{activePhoto.name}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">Işık, renk dengesi, netlik ve genel sunum kalitesi portföy yayın standardına göre yeniden işlendi.</p>
                  {activeOriginal && <div className="mt-6 overflow-hidden rounded-xl border border-white/10"><img src={activeOriginal.url} alt="İşlem öncesi" className="aspect-[16/10] w-full object-cover" /><p className="border-t border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">İşlem öncesi</p></div>}
                  <a href={activePhoto.downloadUrl} download={activePhoto.name} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-extrabold text-emerald-200 transition hover:bg-emerald-300/20"><Download className="h-4 w-4" /> Bu görseli indir</a>
                </div>
              </div>
            ) : <div className="rounded-3xl border border-rose-400/30 bg-rose-400/10 p-6 text-sm text-rose-100">İşlenmiş görseller alınamadı. Lütfen yeni bir işlem başlatın.</div>}

            {results.length > 1 && <div className="mt-6"><p className="mb-3 text-sm font-bold text-white">Diğer sonuçlar</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{results.map((result, index) => <button type="button" key={result.previewUrl} onClick={() => setActiveResult(index)} className={`group relative aspect-[4/3] overflow-hidden rounded-xl border transition ${activeResult === index ? 'border-emerald-300 ring-2 ring-emerald-300/25' : 'border-white/10 hover:border-white/30'}`}><img src={result.previewUrl} alt={result.name} className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-left text-[10px] font-bold text-white">Görsel {index + 1}</span></button>)}</div></div>}
          </section>
        )}
      </main>

      {isProcessing && <div className="fixed inset-0 z-50 grid place-items-center bg-[#07120f]/80 px-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl border border-emerald-300/20 bg-slate-950 p-7 text-center shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-300/15 text-emerald-300"><Loader2 className="h-8 w-8 animate-spin" /></div><h2 className="mt-5 text-xl font-extrabold text-white">Görselleriniz işleniyor</h2><p className="mt-2 text-sm leading-6 text-slate-400">{status}</p><div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-teal-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs font-bold text-emerald-300">%{progress}</p></div></div>}
    </div>
  );
}
