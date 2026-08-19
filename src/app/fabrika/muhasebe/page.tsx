import Link from 'next/link';
import {
  ArrowRight,
  CircleDollarSign,
  FileSpreadsheet,
  Landmark,
  ReceiptText,
} from 'lucide-react';

const areas = [
  {
    title: 'Gelir ve komisyonlar',
    description: 'Kazanılan işlemleri ve komisyon kayıtlarını CRM üzerinden takip edin.',
    href: '/fabrika/crm?view=pipeline',
    icon: CircleDollarSign,
  },
  {
    title: 'Tahsilat takibi',
    description: 'Vadesi gelen ödemeleri, açık görevleri ve müşteri hareketlerini görün.',
    href: '/fabrika/crm?view=company-ceo',
    icon: ReceiptText,
  },
  {
    title: 'Belge merkezi',
    description: 'İşlem belgelerini ve doldurulmuş sözleşmeleri tek merkezde hazırlayın.',
    href: '/fabrika/belgeler',
    icon: FileSpreadsheet,
  },
] as const;

export default function AccountingPage() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(31,55,87,0.07)]">
        <div className="flex items-center gap-3 text-blue-600">
          <Landmark aria-hidden="true" className="h-6 w-6" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Finans merkezi</span>
        </div>
        <h1 className="mt-4 text-3xl font-bold text-slate-950">Muhasebe</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Gelir, komisyon ve tahsilat bilgilerini mevcut şirket kayıtlarınız üzerinden yönetin.
          Bu bölüm muhasebe programı yerine geçmez; operasyonel finans takibi sağlar.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {areas.map(({ title, description, href, icon: Icon }) => (
          <Link
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(31,55,87,0.06)] transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_18px_42px_rgba(31,90,190,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            href={href}
            key={title}
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <h2 className="mt-5 text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
              Bölümü aç <ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
