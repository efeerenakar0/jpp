'use client';

import type { ChangeEvent } from 'react';
import { Download, FileArchive, Loader2, Puzzle, UploadCloud } from 'lucide-react';

export function ExtensionImportPanel({
  isImporting,
  onImport,
}: {
  isImporting: boolean;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
}) {
  return (
    <details className="group rounded-2xl border border-slate-800 bg-slate-950/55">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 sm:px-5">
        <span className="flex items-center gap-3">
          <span className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-300">
            <Puzzle className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>
            <strong className="block text-sm text-white">Tarayıcı eklentisi ve paket aktarımı</strong>
            <small className="mt-0.5 block text-xs text-slate-500">
              Eklentiyi kurun veya daha önce dışa aktarılan paketi yükleyin.
            </small>
          </span>
        </span>
        <span className="text-xs font-semibold text-cyan-300 group-open:hidden">Aç</span>
        <span className="hidden text-xs font-semibold text-cyan-300 group-open:inline">Kapat</span>
      </summary>

      <div className="grid gap-3 border-t border-slate-800 p-4 sm:p-5 lg:grid-cols-2">
        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-5 w-5 text-cyan-300" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-white">Eklentiyi indir</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                ZIP&apos;i çıkarın, Chrome uzantılarında geliştirici modunu açın ve
                <strong className="text-slate-200"> business-ceo-ai-extension</strong> klasörünü yükleyin.
              </p>
            </div>
          </div>
          <a
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 text-xs font-bold text-cyan-100 transition hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            download
            href="/downloads/business-ceo-ai-extension.zip"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Eklentiyi indir
          </a>
        </article>

        <article className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-start gap-3">
            <FileArchive className="mt-0.5 h-5 w-5 text-violet-300" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-white">İlan paketini içe aktar</h3>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Eklentinin oluşturduğu en fazla 10 MB boyutundaki ZIP veya JSON paketini seçin.
              </p>
            </div>
          </div>
          <label
            className={`mt-4 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-400/25 bg-violet-400/10 px-4 text-xs font-bold text-violet-100 transition hover:bg-violet-400/15 focus-within:ring-2 focus-within:ring-violet-300 ${
              isImporting ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
            )}
            {isImporting ? 'Aktarılıyor…' : 'ZIP / JSON seç'}
            <input
              accept=".zip,.json,application/zip,application/json"
              className="sr-only"
              disabled={isImporting}
              onChange={(event) => void onImport(event)}
              type="file"
            />
          </label>
        </article>

        <p className="text-xs leading-5 text-slate-500 lg:col-span-2">
          Eklenti yalnızca ekranda görünen ilan bilgilerini aktarır; doğrulama engellerini aşmaz ve iletişim izni olmadan mesaj göndermez.
        </p>
      </div>
    </details>
  );
}
