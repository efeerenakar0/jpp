import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

const accountTypes = [
  {
    title: 'Patron girişi',
    description:
      'Şirket, ekip, abonelik, entegrasyonlar ve tüm operasyonları yönetin.',
    href: '/fabrika-giris/patron',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Çalışan girişi',
    description:
      'Müşteriler, portföyler, görüşmeler, görevler ve üretim araçlarına erişin.',
    href: '/fabrika-giris/calisan',
    icon: UserRound,
  },
];

export default function FabrikaGirisPage() {
  return (
    <main className="min-h-screen bg-[#080d17] px-5 py-10 text-slate-100">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center">
        <div className="w-full">
          <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10">
              <Building2 className="h-6 w-6 text-emerald-300" aria-hidden="true" />
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
              Jasmine AI Fabrikası
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Hesap türünüzü seçin
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Size verilen giriş bilgileriyle şirketinizin güvenli çalışma
              alanına bağlanın.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {accountTypes.map((accountType) => {
              const Icon = accountType.icon;
              return (
                <Link
                  className="group rounded-2xl border border-slate-800 bg-slate-950/80 p-6 transition-colors hover:border-emerald-400/40 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  href={accountType.href}
                  key={accountType.href}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition-colors group-hover:border-emerald-400/30 group-hover:text-emerald-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 text-lg font-semibold text-white">
                    {accountType.title}
                  </h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
                    {accountType.description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
                    Giriş ekranını aç
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"
              aria-hidden="true"
            />
            <p className="text-xs leading-5 text-slate-400">
              Her kullanıcı yalnızca kendi şirketinin verilerine ve hesabına
              tanımlanan yetkilere erişebilir. Oturumlar 12 saat sonra kapanır.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
