'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/platform-admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error || 'Giriş yapılamadı.');
        return;
      }

      router.push('/platform-admin');
      router.refresh();
    } catch {
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07111f] px-4 py-10 text-slate-100 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-16 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px]" />
        <div className="absolute -right-24 bottom-12 h-80 w-80 rounded-full bg-amber-400/10 blur-[110px]" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-slate-700/70 bg-slate-950/80 shadow-2xl shadow-black/40 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden border-r border-slate-800 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-amber-400/10 p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">
                <Building2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">
                Business CEO AI Platform
              </p>
              <h1 className="mt-4 max-w-md text-4xl font-black leading-tight text-white">
                Şirketleri ve abonelikleri tek merkezden yönetin.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-slate-400">
                Müşteri hesaplarını açın, askıya alın, abonelik durumlarını
                değiştirin ve güvenli giriş bilgileri üretin.
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              Ayrı yönetici oturumu · 8 saat · giriş denemesi korumalı
            </div>
          </section>

          <section className="p-6 sm:p-10 lg:p-12">
            <div className="mb-8 lg:hidden">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                Business CEO AI Platform
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-black text-white">
                Platform yöneticisi
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Yalnızca sistem sahibine açık güvenli yönetim alanı.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  htmlFor="platform-admin-username"
                  className="mb-2 block text-sm font-bold text-slate-200"
                >
                  Kullanıcı adı
                </label>
                <div className="relative">
                  <KeyRound
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    id="platform-admin-username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="h-13 w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pl-12 pr-4 text-white outline-none transition focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="platform-admin-password"
                  className="mb-2 block text-sm font-bold text-slate-200"
                >
                  Şifre
                </label>
                <div className="relative">
                  <LockKeyhole
                    className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    id="platform-admin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-13 w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pl-12 pr-4 text-white outline-none transition focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/30"
                    required
                  />
                </div>
              </div>

              <div aria-live="polite" aria-atomic="true">
                {error ? (
                  <p
                    role="alert"
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
                  >
                    {error}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <LoaderCircle
                    className="h-5 w-5 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                )}
                {submitting ? 'Giriş kontrol ediliyor' : 'Güvenli giriş yap'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
