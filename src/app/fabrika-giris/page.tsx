'use client';

import { FormEvent, useState } from 'react';
import { Building2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';

export default function FabrikaGirisPage() {
  const [accessKey, setAccessKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/fabrika-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey, verificationCode }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error || 'Giriş yapılamadı.');
        return;
      }

      window.location.assign('/fabrika');
    } catch {
      setError('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080c14] px-5 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[120px]" />
        <div className="absolute bottom-[-16rem] right-[-8rem] h-[34rem] w-[34rem] rounded-full bg-amber-500/10 blur-[120px]" />
      </div>

      <section className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full rounded-[2rem] border border-slate-800/90 bg-slate-950/80 p-7 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-9">
          <div className="mb-8 flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-cyan-400 to-amber-500 opacity-70 blur" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-slate-950">
                <Building2 className="h-6 w-6 text-cyan-300" />
              </div>
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-400">
                Jasmine Group
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
                AI Fabrikası Girişi
              </h1>
            </div>
          </div>

          <div className="mb-7 flex gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <p className="text-sm leading-6 text-slate-300">
              Fabrika paneli ve operasyon API’leri yalnızca yetkili oturumlara açıktır.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                Giriş anahtarı
              </span>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  autoComplete="current-password"
                  className="h-13 w-full rounded-2xl border border-slate-800 bg-slate-900/90 py-3 pl-11 pr-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  onChange={(event) => setAccessKey(event.target.value)}
                  placeholder="Jasmine erişim anahtarını girin"
                  required
                  type="password"
                  value={accessKey}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">
                Doğrulama kodu
              </span>
              <input
                autoComplete="one-time-code"
                className="h-13 w-full rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-center font-mono text-lg font-black tracking-[0.35em] text-white outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10"
                inputMode="numeric"
                maxLength={8}
                onChange={(event) =>
                  setVerificationCode(event.target.value.replace(/\D/g, ''))
                }
                placeholder="••••••••"
                required
                type="password"
                value={verificationCode}
              />
            </label>

            {error && (
              <p
                className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Doğrulanıyor
                </>
              ) : (
                'Güvenli Giriş Yap'
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-slate-600">
            Oturum 12 saat sonra otomatik olarak kapanır.
          </p>
        </div>
      </section>
    </main>
  );
}
