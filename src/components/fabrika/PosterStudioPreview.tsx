import { Check, Download } from 'lucide-react';

type PosterStudioPreviewProps = {
  name: string;
  previewUrl: string;
  format: 'post' | 'story';
  mode: 'faithful' | 'creative';
};

function posterFilename(name: string) {
  return `${name.replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ]+/gi, '_') || 'jasmine_poster'}.jpg`;
}

export function PosterStudioPreview({
  name,
  previewUrl,
  format,
  mode,
}: PosterStudioPreviewProps) {
  return (
    <section
      aria-label="Son oluşturulan poster"
      className="mt-5 overflow-hidden rounded-xl border border-emerald-300/30 bg-slate-950 shadow-xl shadow-black/20"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-3 py-2.5">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-200">
            <Check className="h-3.5 w-3.5" /> Son oluşturulan poster
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{name}</p>
        </div>
        <a
          href={previewUrl}
          download={posterFilename(name)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-300 px-3 py-2 text-xs font-extrabold text-emerald-950 transition hover:bg-emerald-200"
        >
          <Download className="h-3.5 w-3.5" /> Posteri indir
        </a>
      </div>
      <div className="relative bg-black">
        <img
          src={previewUrl}
          alt={`${name} poster ön izlemesi`}
          className="max-h-[44rem] w-full object-contain"
          style={{ aspectRatio: format === 'story' ? '9 / 16' : '4 / 5' }}
        />
        <span className={`absolute left-3 top-3 rounded-full border px-2 py-1 text-[10px] font-bold ${
          mode === 'creative'
            ? 'border-amber-200/30 bg-amber-950/90 text-amber-100'
            : 'border-sky-200/20 bg-slate-950/90 text-sky-100'
        }`}>
          {mode === 'creative' ? 'TEMSİLİ AI GÖRSELİ' : 'GERÇEK FOTOĞRAFLAR'}
        </span>
      </div>
    </section>
  );
}
