import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  Crown,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import BusinessCeoMark from '@/components/fabrika/BusinessCeoMark';

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
    <main className="relative min-h-screen overflow-hidden bg-[#06101d] px-5 py-8 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_80%,rgba(201,154,87,0.16),transparent_30rem),radial-gradient(circle_at_82%_18%,rgba(34,197,130,0.1),transparent_34rem)]" />
      <div className="absolute inset-y-0 right-0 hidden w-[38%] bg-[linear-gradient(90deg,#06101d_0%,transparent_55%),linear-gradient(180deg,rgba(6,16,29,.2),rgba(6,16,29,.92)),url('/uploads/studio/shoot_1784830670872_photo_0.jpg')] bg-cover bg-center opacity-55 lg:block" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#c99a57]/50 to-transparent" />

      <div className="relative mx-auto max-w-[1480px]">
        <div className="mb-8 flex items-center justify-between">
          <BusinessCeoMark />
          <p className="hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:block">Güvenli şirket erişimi</p>
        </div>
        <section className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <div className="w-full max-w-4xl rounded-[28px] border border-[#c99a57]/30 bg-[#0b1625]/90 p-6 shadow-[0_40px_120px_rgba(0,0,0,.48)] backdrop-blur-xl sm:p-10 lg:p-12">
          <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center text-[#e9bd79]">
              <Crown className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.26em] text-[#c99a57]">
              Business CEO AI
            </p>
            <h1 className="mt-3 font-serif text-3xl font-semibold tracking-wide text-[#f6f1e8] sm:text-5xl">
              Hesap türünüzü seçin
            </h1>
            <p className="mt-4 text-sm leading-6 text-slate-400 sm:text-base">
              Şirketinizin güvenli yönetim çalışma alanına bağlanın.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {accountTypes.map((accountType) => {
              const Icon = accountType.icon;
              return (
                <Link
                  className="group rounded-2xl border border-[#344258] bg-[#101b2b]/90 p-6 text-center transition duration-200 hover:-translate-y-0.5 hover:border-[#c99a57]/60 hover:bg-[#142136] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e9bd79]"
                  href={accountType.href}
                  key={accountType.href}
                >
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#c99a57]/60 bg-[#c99a57]/5 text-[#e9bd79] transition-colors group-hover:bg-[#c99a57]/10">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="mt-5 font-serif text-xl font-semibold text-[#f6f1e8]">
                    {accountType.title}
                  </h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
                    {accountType.description}
                  </p>
                  <span className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-200 transition group-hover:bg-emerald-500/25">
                    {accountType.title.replace('girişi', 'olarak devam et')}
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-3 border-t border-[#29384d] pt-6">
            <ShieldCheck
              className="h-5 w-5 shrink-0 text-[#e9bd79]"
              aria-hidden="true"
            />
            <p className="text-xs leading-5 text-slate-400">
              Her kullanıcı yalnızca yetkili olduğu şirket verilerine erişebilir.
            </p>
          </div>
        </div>
      </section>
      </div>
    </main>
  );
}
