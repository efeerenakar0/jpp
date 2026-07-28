'use client';

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  Download,
  LayoutTemplate,
  Loader2,
  MessageCircle,
  Share2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFabrikaSession } from '@/components/fabrika/FabrikaSessionContext';

type PosterFormat = 'post' | 'story';

type PosterResult = {
  id: string;
  name: string;
  previewUrl: string;
  whatsapp?: string;
  instagram?: string;
  campaignLoading?: boolean;
  campaignSource?: 'ai' | 'template';
};

type PosterForm = {
  companyName: string;
  area: string;
  price: string;
  details: string;
  format: PosterFormat;
  posterName: string;
};

const INITIAL_FORM: PosterForm = {
  companyName: '',
  area: '',
  price: '',
  details: '',
  format: 'post',
  posterName: '',
};

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  const scale = Math.max(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  context.drawImage(image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.slice(0, maxLines).forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
  return y + Math.max(lines.length, 1) * lineHeight;
}

async function createFinalPoster(input: {
  backgroundUrl: string;
  photoUrls: string[];
  logoUrl: string | null;
  form: PosterForm;
}) {
  const width = 1080;
  const height = input.form.format === 'story' ? 1920 : 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Poster yüzeyi oluşturulamadı.');

  const background = await loadImage(input.backgroundUrl);
  drawCover(context, background, width, height);
  const gradient = context.createLinearGradient(0, height * 0.2, 0, height);
  gradient.addColorStop(0, 'rgba(3, 12, 24, 0.06)');
  gradient.addColorStop(0.55, 'rgba(3, 12, 24, 0.2)');
  gradient.addColorStop(1, 'rgba(3, 12, 24, 0.94)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const pad = 72;
  let textTop = height - (input.form.format === 'story' ? 560 : 420);
  context.fillStyle = '#d1fae5';
  context.font = '700 25px Arial';
  context.fillText((input.form.companyName || 'GAYRİMENKUL').toLocaleUpperCase('tr-TR'), pad, textTop);
  textTop += 56;
  context.fillStyle = '#ffffff';
  context.font = '800 62px Arial';
  textTop = drawWrappedText(
    context,
    input.form.posterName || 'Özel gayrimenkul fırsatı',
    pad,
    textTop,
    width - pad * 2,
    72,
    2
  );
  const facts = [input.form.area ? `${input.form.area} m²` : '', input.form.price].filter(Boolean).join('  ·  ');
  if (facts) {
    textTop += 20;
    context.fillStyle = '#e2e8f0';
    context.font = '600 29px Arial';
    context.fillText(facts, pad, textTop);
    textTop += 42;
  }
  if (input.form.details) {
    context.fillStyle = '#cbd5e1';
    context.font = '400 24px Arial';
    textTop += 10;
    drawWrappedText(context, input.form.details, pad, textTop, width - pad * 2, 32, 2);
  }

  context.fillStyle = '#34d399';
  context.fillRect(pad, height - 58, 290, 7);
  context.fillStyle = '#e2e8f0';
  context.font = '700 20px Arial';
  context.fillText('DETAY VE RANDEVU İÇİN İLETİŞİME GEÇİN', pad, height - 84);

  if (input.logoUrl) {
    try {
      const logo = await loadImage(input.logoUrl);
      const ratio = Math.min(170 / logo.width, 88 / logo.height, 1);
      const logoWidth = logo.width * ratio;
      const logoHeight = logo.height * ratio;
      context.fillStyle = 'rgba(255,255,255,0.94)';
      context.fillRect(width - pad - logoWidth - 24, 54, logoWidth + 24, logoHeight + 24);
      context.drawImage(logo, width - pad - logoWidth - 12, 66, logoWidth, logoHeight);
    } catch {
      // A poster can still be prepared if the optional logo cannot be rendered.
    }
  }

  const thumbnails = input.photoUrls.slice(1, 4);
  if (thumbnails.length) {
    const thumbWidth = 150;
    const thumbHeight = 105;
    for (const [index, photoUrl] of thumbnails.entries()) {
      try {
        const photo = await loadImage(photoUrl);
        const x = width - pad - (thumbWidth + 16) * (index + 1) + 16;
        const y = height - 205;
        context.fillStyle = 'rgba(255,255,255,0.95)';
        context.fillRect(x - 5, y - 5, thumbWidth + 10, thumbHeight + 10);
        context.save();
        context.beginPath();
        context.rect(x, y, thumbWidth, thumbHeight);
        context.clip();
        const scale = Math.max(thumbWidth / photo.width, thumbHeight / photo.height);
        const renderedWidth = photo.width * scale;
        const renderedHeight = photo.height * scale;
        context.drawImage(photo, x + (thumbWidth - renderedWidth) / 2, y + (thumbHeight - renderedHeight) / 2, renderedWidth, renderedHeight);
        context.restore();
      } catch {
        // Additional photos are optional visual accents.
      }
    }
  }
  return canvas.toDataURL('image/jpeg', 0.94);
}

export default function PosterMaker() {
  const { permissions } = useFabrikaSession();
  const [form, setForm] = useState<PosterForm>(INITIAL_FORM);
  const [photos, setPhotos] = useState<File[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [savedLogoUrl, setSavedLogoUrl] = useState<string | null>(null);
  const [rememberLogo, setRememberLogo] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [results, setResults] = useState<PosterResult[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const photoPreviews = useMemo(
    () => photos.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [photos]
  );
  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : savedLogoUrl), [logoFile, savedLogoUrl]);

  useEffect(() => () => photoPreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [photoPreviews]);
  useEffect(() => () => { if (logoFile && logoPreview) URL.revokeObjectURL(logoPreview); }, [logoFile, logoPreview]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/fabrika/studio/poster', { cache: 'no-store' });
        const data = await response.json();
        if (response.ok) {
          setForm((current) => ({ ...current, companyName: data.companyName || current.companyName }));
          setSavedLogoUrl(data.logoDataUrl || null);
        }
      } catch {
        // The form stays usable; only the automatic company identity fill is unavailable.
      }
    })();
  }, []);

  const update = <Key extends keyof PosterForm>(key: Key, value: PosterForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addPhotos = (incoming: File[]) => {
    const images = incoming.filter((file) => file.type.startsWith('image/'));
    if (incoming.length !== images.length) toast.error('Yalnızca görsel dosyaları ekleyebilirsiniz.');
    setPhotos((current) => {
      const keys = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      return [...current, ...images.filter((file) => !keys.has(`${file.name}-${file.size}-${file.lastModified}`))].slice(0, 6);
    });
  };

  const onPhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    addPhotos(Array.from(event.target.files || []));
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addPhotos(Array.from(event.dataTransfer.files));
  };

  const createPoster = async () => {
    if (!photos.length) {
      toast.error('Önce en az bir gayrimenkul görseli yükleyin.');
      return;
    }
    setIsCreating(true);
    try {
      const data = new FormData();
      photos.forEach((photo) => data.append('photos', photo));
      if (logoFile) data.append('logo', logoFile);
      data.append('companyName', form.companyName);
      data.append('area', form.area);
      data.append('price', form.price);
      data.append('details', form.details);
      data.append('format', form.format);
      data.append('rememberLogo', String(rememberLogo && permissions.canManageSecrets));
      const response = await fetch('/api/fabrika/studio/poster', { method: 'POST', body: data });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Poster üretilemedi.');
      const previewUrl = await createFinalPoster({
        backgroundUrl: body.backgroundDataUrl,
        photoUrls: photoPreviews.map((item) => item.url),
        logoUrl: body.logoDataUrl || logoPreview,
        form,
      });
      const name = form.posterName.trim() || `Portföy posteri ${results.length + 1}`;
      setResults((current) => [{ id: crypto.randomUUID(), name, previewUrl }, ...current]);
      if (body.logoDataUrl) setSavedLogoUrl(body.logoDataUrl);
      toast.success('Posteriniz hazır. Şimdi buna özel kampanya metinleri üretebilirsiniz.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Poster üretilemedi.');
    } finally {
      setIsCreating(false);
    }
  };

  const createCampaign = async (id: string) => {
    setResults((current) => current.map((item) => item.id === id ? { ...item, campaignLoading: true } : item));
    try {
      const response = await fetch('/api/fabrika/studio/poster', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Kampanya metinleri üretilemedi.');
      setResults((current) => current.map((item) => item.id === id ? {
        ...item,
        whatsapp: body.whatsapp,
        instagram: body.instagram,
        campaignSource: body.source,
        campaignLoading: false,
      } : item));
      toast.success('Bu postere özel WhatsApp ve Instagram metinleri hazır.');
    } catch (error) {
      setResults((current) => current.map((item) => item.id === id ? { ...item, campaignLoading: false } : item));
      toast.error(error instanceof Error ? error.message : 'Kampanya metinleri üretilemedi.');
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} kopyalandı.`);
    } catch {
      toast.error('Kopyalama başarısız oldu. Metni seçip manuel kopyalayabilirsiniz.');
    }
  };

  return (
    <section className="space-y-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,.85fr)]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><LayoutTemplate className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-bold text-white">Gayrimenkul reklam posteri</h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">Yapay zekâ görselinizi reklam estetiğine taşır; şirket kimliği ve tüm ilan bilgileri poster üzerinde net biçimde yer alır.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-300">Şirket adı <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Şirket adınız" />
            </label>
            <label className="text-xs font-bold text-slate-300">Poster adı <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.posterName} onChange={(event) => update('posterName', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Örn. Kestel deniz manzaralı villa" />
            </label>
            <label className="text-xs font-bold text-slate-300">Metrekare <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.area} onChange={(event) => update('area', event.target.value)} inputMode="numeric" className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Örn. 185" />
            </label>
            <label className="text-xs font-bold text-slate-300">Fiyat <span className="font-normal text-slate-500">(isteğe bağlı)</span>
              <input value={form.price} onChange={(event) => update('price', event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Örn. 12.500.000 TL" />
            </label>
          </div>

          <label className="mt-4 block text-xs font-bold text-slate-300">Ek bilgiler <span className="font-normal text-slate-500">(isteğe bağlı)</span>
            <textarea value={form.details} onChange={(event) => update('details', event.target.value)} className="mt-2 min-h-24 w-full resize-y rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none transition focus:border-emerald-400" placeholder="Konum, oda sayısı, manzara, teslim durumu veya posterde öne çıkarmak istediğiniz özellikler..." />
          </label>

          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <fieldset>
              <legend className="text-xs font-bold text-slate-300">Tasarım boyutu</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([['post', 'Post · 4:5'], ['story', 'Story · 9:16']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => update('format', value)} aria-pressed={form.format === value} className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${form.format === value ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200' : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'}`}>{label}</button>
                ))}
              </div>
            </fieldset>
            <div>
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => setLogoFile(event.target.files?.[0] || null)} />
              <button type="button" onClick={() => logoInputRef.current?.click()} className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200 transition hover:border-slate-600 sm:w-auto"><Building2 className="h-4 w-4 text-emerald-300" /> {logoPreview ? 'Logoyu değiştir' : 'Şirket logosu ekle'}</button>
              {logoPreview && <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-400"><img src={logoPreview} alt="Şirket logosu ön izlemesi" className="h-5 w-8 rounded bg-white object-contain p-0.5" /> Logo hazır {permissions.canManageSecrets && <label className="ml-1 inline-flex items-center gap-1"><input type="checkbox" checked={rememberLogo} onChange={(event) => setRememberLogo(event.target.checked)} className="accent-emerald-400" /> Profilde hatırla</label>}</div>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6">
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={onPhotoChange} />
          <div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && photoInputRef.current?.click()} onClick={() => photoInputRef.current?.click()} className="grid min-h-56 cursor-pointer place-items-center rounded-xl border border-dashed border-emerald-400/40 bg-emerald-400/[0.05] p-6 text-center transition hover:bg-emerald-400/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
            <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-300 text-emerald-950"><UploadCloud className="h-6 w-6" /></span><p className="mt-4 text-sm font-bold text-white">Gayrimenkul görsellerini yükleyin</p><p className="mt-1 text-xs leading-5 text-slate-400">Bir veya birden çok görsel bırakın ya da seçmek için tıklayın. En fazla 6 görsel.</p></div>
          </div>
          {photoPreviews.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2">{photoPreviews.map(({ file, url }, index) => <div key={`${file.name}-${file.lastModified}`} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-700"><img src={url} alt={file.name} className="h-full w-full object-cover" /><button type="button" onClick={(event) => { event.stopPropagation(); setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-slate-950/80 text-white transition hover:bg-rose-500" aria-label={`${file.name} görselini kaldır`}><X className="h-3.5 w-3.5" /></button></div>)}</div>}
          <p className="mt-4 text-xs leading-5 text-slate-500">İlk görsel AI için ana görsel olur; diğerleri posterde seçili detay kareleri olarak kullanılabilir. Görselleriniz yalnızca poster üretimi için sunucuda işlenir.</p>
          <button type="button" onClick={createPoster} disabled={isCreating || !photos.length} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-3.5 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-45">{isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {isCreating ? 'Poster hazırlanıyor…' : 'AI ile poster oluştur'}</button>
        </div>
      </div>

      {results.length > 0 && <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold text-white">Oluşturulan posterler</h2><p className="mt-1 text-sm text-slate-400">Her postere özel, ayrı kampanya metinleri üretebilirsiniz.</p></div><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200"><Check className="h-3.5 w-3.5" /> {results.length} hazır</span></div><div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{results.map((result) => <article key={result.id} className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950"><img src={result.previewUrl} alt={result.name} className="aspect-[4/5] w-full object-cover" /><div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold text-white">{result.name}</h3><a href={result.previewUrl} download={`${result.name.replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '_') || 'jasmine_poster'}.jpg`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200" aria-label="Posteri indir"><Download className="h-4 w-4" /></a></div><button type="button" onClick={() => createCampaign(result.id)} disabled={result.campaignLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2.5 text-xs font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-50">{result.campaignLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} AI ile reklam kampanyası oluştur</button>{result.whatsapp && <div className="rounded-lg border border-slate-800 bg-slate-900 p-3"><div className="flex items-center justify-between gap-2"><p className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp mesajı</p><button type="button" onClick={() => copy(result.whatsapp || '', 'WhatsApp mesajı')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white"><Copy className="h-3 w-3" /> Kopyala</button></div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{result.whatsapp}</p></div>}{result.instagram && <div className="rounded-lg border border-slate-800 bg-slate-900 p-3"><div className="flex items-center justify-between gap-2"><p className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-200"><Share2 className="h-3.5 w-3.5" /> Instagram açıklaması</p><button type="button" onClick={() => copy(result.instagram || '', 'Instagram açıklaması')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-300 hover:text-white"><Copy className="h-3 w-3" /> Kopyala</button></div><p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-300">{result.instagram}</p><a href="https://www.instagram.com/create/select/" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-pink-200 hover:text-pink-100"><Share2 className="h-3.5 w-3.5" /> Instagram’da paylaşımı aç</a></div>}</div></article>)}</div></div>}
    </section>
  );
}
