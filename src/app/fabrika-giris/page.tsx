import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import BusinessCeoMark from '@/components/fabrika/BusinessCeoMark';

const accountTypes = [
  {
    title: 'Patron olarak gir',
    label: 'Şirket yönetimi',
    description: 'Ekip, müşteriler, portföyler, raporlar ve tüm ayarlar.',
    href: '/fabrika-giris/patron',
    icon: Crown,
    accent: 'border-cyan-400/35 bg-cyan-400/10 text-cyan-200',
  },
  {
    title: 'Çalışan olarak gir',
    label: 'Günlük çalışma alanı',
    description: 'Sohbetler, görevler, portföyler ve üretim araçları.',
    href: '/fabrika-giris/calisan',
    icon: UserRound,
    accent: 'border-violet-400/35 bg-violet-400/10 text-violet-200',
  },
] as const;

export default function FabrikaGirisPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020914] px-4 py-5 text-slate-100 sm:px-7 lg:px-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(24,154,255,.16),transparent_27rem),radial-gradient(circle_at_82%_78%,rgba(139,92,246,.12),transparent_30rem),linear-gradient(rgba(67,144,197,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(67,144,197,.035)_1px,transparent_1px)] bg-[size:auto,auto,42px_42px,42px_42px]" />

      <div className="relative mx-auto max-w-[1460px]">
        <header className="flex h-16 items-center justify-between border-b border-slate-800/80">
          <BusinessCeoMark />
          <span className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 sm:inline-flex">
            <i className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
            Güvenli şirket erişimi
          </span>
        </header>

        <section className="grid min-h-[calc(100vh-6.5rem)] items-center gap-8 py-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,.82fr)] lg:gap-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> Business CEO AI · Real Estate
            </span>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-[1.06] tracking-[-.045em] text-white sm:text-5xl lg:text-6xl">
              Şirketinizin operasyon merkezine bağlanın.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
              Müşteri konuşmaları, portföyler, ekip görevleri ve yapay zekâ çalışanları tek güvenli çalışma alanında.
            </p>

            <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
              {[
                ['Canlı sohbet', 'WhatsApp ve müşteri talepleri'],
                ['Ekip takibi', 'Görev ve sonuç görünürlüğü'],
                ['AI araçları', 'Stüdyo, pazarlama ve satış'],
              ].map(([title, description]) => (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4 backdrop-blur" key={title}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <strong className="mt-3 block text-sm text-slate-100">{title}</strong>
                  <span className="mt-1 block text-[11px] leading-5 text-slate-500">{description}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 hidden max-w-xl overflow-hidden rounded-2xl border border-slate-800 bg-[#061421]/80 sm:block">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <span className="text-xs font-semibold text-slate-200">Canlı operasyon akışı</span>
                <span className="text-[10px] text-emerald-300">Sistem hazır</span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 p-4 text-center text-[10px] text-slate-400">
                <span className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-4"><MessageSquareText className="mx-auto mb-2 h-5 w-5 text-cyan-300" />Müşteri talebi</span>
                <ArrowRight className="h-4 w-4 text-slate-600" />
                <span className="rounded-xl border border-violet-400/20 bg-violet-400/5 px-3 py-4"><Sparkles className="mx-auto mb-2 h-5 w-5 text-violet-300" />AI işlemde</span>
                <ArrowRight className="h-4 w-4 text-slate-600" />
                <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-3 py-4"><CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-300" />Sonuç hazır</span>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-700/80 bg-[linear-gradient(145deg,rgba(8,24,39,.97),rgba(3,14,25,.98))] p-5 shadow-[0_35px_100px_rgba(0,0,0,.42)] sm:p-7">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-cyan-300">Giriş adımı 1/2</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-.025em] text-white">Nasıl giriş yapacaksınız?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">Size verilen hesap türünü seçin.</p>
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300"><LockKeyhole className="h-5 w-5" /></span>
            </div>

            <div className="mt-6 space-y-3">
              {accountTypes.map((accountType) => {
                const Icon = accountType.icon;
                return (
                  <Link
                    className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-slate-700/80 bg-slate-900/65 p-4 transition hover:-translate-y-0.5 hover:border-cyan-400/45 hover:bg-slate-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    href={accountType.href}
                    key={accountType.href}
                  >
                    <span className={`grid h-12 w-12 place-items-center rounded-xl border ${accountType.accent}`}><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <small className="block text-[10px] font-semibold uppercase tracking-[.12em] text-slate-500">{accountType.label}</small>
                      <strong className="mt-1 block text-base text-white">{accountType.title}</strong>
                      <span className="mt-1 block text-[11px] leading-5 text-slate-400">{accountType.description}</span>
                    </span>
                    <ArrowRight className="h-5 w-5 text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
                  </Link>
                );
              })}
            </div>

            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/[.05] p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              <p className="text-[11px] leading-5 text-slate-400">Her kullanıcı yalnızca kendi şirketine ve rolüne izin verilen verilere erişir.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
