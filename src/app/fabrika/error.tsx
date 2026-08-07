'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function FabrikaError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // Next.js provides the captured error, but this customer-facing boundary
  // intentionally avoids rendering or logging potentially sensitive details.
  void error;
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-4 py-12">
      <section
        aria-labelledby="fabrika-error-title"
        className="w-full max-w-lg rounded-2xl border border-rose-400/20 bg-slate-950/85 p-7 text-center shadow-2xl shadow-rose-950/20"
      >
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-300">
          <AlertTriangle aria-hidden="true" className="size-6" />
        </span>
        <h1
          className="mt-4 text-xl font-semibold text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          id="fabrika-error-title"
          ref={headingRef}
          tabIndex={-1}
        >
          Bu bölüm şu anda açılamadı
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Kayıtlarınız korunuyor. Bağlantıyı yenileyip bu bölümü tekrar deneyebilirsiniz.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            href="/fabrika"
          >
            Ana ekrana dön
          </Link>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            onClick={() => unstable_retry()}
            type="button"
          >
            <RefreshCw aria-hidden="true" className="size-4" /> Yeniden dene
          </button>
        </div>
      </section>
    </main>
  );
}
