import { notFound } from 'next/navigation';
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  Eye,
  Home,
  MapPin,
  MessageCircle,
  Presentation,
  Tag,
} from 'lucide-react';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function money(value: number | null) {
  if (value == null) return 'Fiyat bilgisi paylaşılmadı';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function SellerPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const property = await prisma.crmProperty.findFirst({
    where: {
      sellerPortalToken: token,
      sellerPortalEnabled: true,
    },
    include: {
      companyAccount: {
        select: {
          companyName: true,
          ownerName: true,
          ownerEmail: true,
        },
      },
      ownerContact: {
        select: {
          name: true,
        },
      },
      assignedMember: {
        select: {
          name: true,
          phone: true,
          email: true,
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!property) notFound();

  const metrics = [
    { label: 'İlan görüntülenmesi', value: property.listingViews, icon: Eye },
    { label: 'Müşteri talebi', value: property.inquiryCount, icon: MessageCircle },
    { label: 'Portföy gösterimi', value: property.showingCount, icon: Presentation },
    { label: 'Gelen teklif', value: property.offerCount, icon: Tag },
  ];

  return (
    <main className="min-h-screen bg-[#07101f] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <Building2 className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-400">
                  {property.companyAccount.companyName}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Portföy faaliyet raporu
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Portföyünüz için gerçekleştirilen çalışmalar ve güncel performans bilgileri.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
              <BadgeCheck className="h-4 w-4" />
              Güvenli müşteri görünümü
            </span>
          </div>
        </header>

        <section className="grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:grid-cols-[16rem_1fr] sm:p-7">
          <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-xl bg-slate-950">
            {property.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={property.title}
                className="h-full w-full object-cover"
                src={property.imageUrl}
              />
            ) : (
              <Home className="h-12 w-12 text-slate-700" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {property.referenceCode || 'Portföy'}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">{property.title}</h2>
              </div>
              <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-300">
                {property.status}
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold text-white">{money(property.price)}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {property.location || 'Konum paylaşılmadı'}
              </span>
              <span>{property.roomCount || 'Oda bilgisi yok'}</span>
              <span>{property.area ? `${property.area} m²` : 'Alan bilgisi yok'}</span>
            </div>
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-500">Sorumlu danışman</p>
              <p className="mt-1 font-medium text-white">
                {property.assignedMember?.name || property.companyAccount.ownerName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {property.assignedMember?.phone ||
                  property.assignedMember?.email ||
                  property.companyAccount.ownerEmail ||
                  'İletişim bilgisi paylaşılmadı'}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(({ label, value, icon: Icon }) => (
            <article className="rounded-xl border border-slate-800 bg-slate-900 p-4" key={label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4 sm:px-7">
            <Activity className="h-5 w-5 text-emerald-400" />
            <div>
              <h2 className="font-semibold text-white">Yapılan çalışmalar</h2>
              <p className="mt-0.5 text-xs text-slate-500">En güncel faaliyetler üstte gösterilir</p>
            </div>
          </div>
          {property.activities.length === 0 ? (
            <div className="px-5 py-14 text-center sm:px-7">
              <CalendarDays className="mx-auto h-8 w-8 text-slate-700" />
              <p className="mt-3 text-sm font-medium text-slate-300">İlk faaliyetler hazırlanıyor</p>
              <p className="mt-1 text-xs text-slate-500">
                Danışmanınız yeni bir çalışma eklediğinde burada görünecek.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800 px-5 sm:px-7">
              {property.activities.map((activity) => (
                <article className="flex gap-3 py-4" key={activity.id}>
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-white">{activity.title}</h3>
                    {activity.description && (
                      <p className="mt-1 text-sm leading-6 text-slate-400">{activity.description}</p>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-slate-600">
                    {new Intl.DateTimeFormat('tr-TR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    }).format(activity.createdAt)}
                  </time>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="pb-4 text-center text-xs text-slate-600">
          Bu sayfa yalnızca size özel portföy performans bilgilerini gösterir.
        </footer>
      </div>
    </main>
  );
}
