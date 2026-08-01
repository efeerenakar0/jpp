'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Crown,
  KeyRound,
  Loader2,
  UserRound,
} from 'lucide-react';
import BusinessCeoMark from './BusinessCeoMark';

type LoginVariant = 'owner' | 'employee';

const variants = {
  owner: {
    title: 'Patron girişi',
    description:
      'Platform yöneticisinin şirketiniz için oluşturduğu patron bilgilerini kullanın.',
    firstLabel: 'Giriş anahtarı',
    firstPlaceholder: 'Şirket giriş anahtarını girin',
    secondLabel: 'Doğrulama kodu',
    endpoint: '/api/fabrika-auth/login',
    icon: BriefcaseBusiness,
  },
  employee: {
    title: 'Çalışan girişi',
    description:
      'Patronunuzun veya platform yöneticisinin oluşturduğu çalışan bilgilerini kullanın.',
    firstLabel: 'Kullanıcı adı',
    firstPlaceholder: 'ornek-sirket.ayse',
    secondLabel: 'Giriş kodu',
    endpoint: '/api/fabrika-auth/employee-login',
    icon: UserRound,
  },
} satisfies Record<
  LoginVariant,
  {
    title: string;
    description: string;
    firstLabel: string;
    firstPlaceholder: string;
    secondLabel: string;
    endpoint: string;
    icon: typeof UserRound;
  }
>;

export default function FabrikaLoginForm({
  variant,
}: {
  variant: LoginVariant;
}) {
  const config = variants[variant];
  const Icon = config.icon;
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          variant === 'owner'
            ? { accessKey: identifier, verificationCode: code }
            : { username: identifier, temporaryCode: code }
        ),
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
    <main className="relative min-h-screen overflow-hidden bg-[#06101d] px-5 py-8 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_80%,rgba(201,154,87,0.16),transparent_30rem),radial-gradient(circle_at_82%_18%,rgba(34,197,130,0.1),transparent_34rem)]" />
      <div className="relative mx-auto flex max-w-[1480px] items-center justify-between">
        <BusinessCeoMark />
      </div>
      <section className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-md items-center">
        <div className="w-full">
          <Link
            className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            href="/fabrika-giris"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Hesap türüne dön
          </Link>

          <div className="rounded-[24px] border border-[#c99a57]/30 bg-[#0b1625]/92 p-7 shadow-[0_40px_100px_rgba(0,0,0,.45)] backdrop-blur-xl sm:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#c99a57]/35 bg-[#c99a57]/10">
                <Icon className="h-6 w-6 text-[#e9bd79]" aria-hidden="true" />
              </span>
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#c99a57]">
                  <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                  Business CEO AI
                </p>
                <h1 className="mt-1 font-serif text-2xl font-semibold tracking-wide text-[#f6f1e8]">
                  {config.title}
                </h1>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-400">
              {config.description}
            </p>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              <div>
                <label
                  className="mb-2 block text-xs font-semibold text-slate-300"
                  htmlFor={`${variant}-identifier`}
                >
                  {config.firstLabel}
                </label>
                <div className="relative">
                  <KeyRound
                    className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    autoCapitalize="none"
                    autoComplete={
                      variant === 'employee' ? 'username' : 'current-password'
                    }
                    className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400/25"
                    id={`${variant}-identifier`}
                    onChange={(event) => setIdentifier(event.target.value)}
                    placeholder={config.firstPlaceholder}
                    required
                    spellCheck={false}
                    type={variant === 'owner' ? 'password' : 'text'}
                    value={identifier}
                  />
                </div>
              </div>

              <div>
                <label
                  className="mb-2 block text-xs font-semibold text-slate-300"
                  htmlFor={`${variant}-code`}
                >
                  {config.secondLabel}
                </label>
                <input
                  autoComplete="one-time-code"
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-center font-mono text-lg font-bold tracking-[0.3em] text-white outline-none transition placeholder:text-slate-600 focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-400/25"
                  id={`${variant}-code`}
                  inputMode="numeric"
                  maxLength={8}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ''))
                  }
                  placeholder="••••••"
                  required
                  type="password"
                  value={code}
                />
              </div>

              <div aria-live="polite">
                {error ? (
                  <p
                    className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
              </div>

              <button
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-emerald-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
                type="submit"
              >
                {loading ? (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : null}
                {loading ? 'Doğrulanıyor' : 'Güvenli giriş yap'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
