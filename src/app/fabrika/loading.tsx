import { LoaderCircle } from 'lucide-react';

export default function FabrikaLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Business CEO AI çalışma alanı yükleniyor"
      className="flex min-h-[70dvh] items-center justify-center px-4 py-12"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-cyan-400/20 bg-slate-950/80 p-7 text-center shadow-2xl shadow-cyan-950/20"
        role="status"
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
          <LoaderCircle
            aria-hidden="true"
            className="size-6 animate-spin motion-reduce:animate-none"
          />
        </span>
        <p className="mt-4 text-base font-semibold text-slate-100">
          Çalışma alanınız hazırlanıyor
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          Şirket bilgileriniz ve güncel operasyonlarınız yükleniyor.
        </p>
      </div>
    </main>
  );
}
