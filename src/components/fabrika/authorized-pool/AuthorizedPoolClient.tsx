'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  CirclePause,
  Clock3,
  Database,
  Filter,
  Handshake,
  Layers3,
  MapPin,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { useFabrikaSession } from '@/components/fabrika/FabrikaSessionContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import {
  formatPoolDate,
  formatPoolPrice,
  requestStatusLabels,
  shareStatusLabels,
} from './format';
import type {
  AuthorizedPoolListing,
  AuthorizedPoolPayload,
  AvailablePoolProperty,
  IncomingPoolRequest,
  OwnedPoolShare,
  PoolFilters,
  PoolShareStatus,
} from './types';
import { EMPTY_POOL_FILTERS } from './types';

type PoolTab = 'pool' | 'sharing' | 'requests';

type RequestDialogState =
  | { type: 'contact'; listing: AuthorizedPoolListing }
  | { type: 'publish'; property: AvailablePoolProperty }
  | { type: 'revoke'; share: OwnedPoolShare }
  | { type: 'decision'; request: IncomingPoolRequest; decision: 'APPROVED' | 'REJECTED' }
  | null;

const fieldClass =
  'min-h-12 rounded-xl border-[#23445c] bg-[#071522] text-base text-[#f6fbff] placeholder:text-[#6f8799] focus-visible:border-[#39d8bd] focus-visible:ring-[#39d8bd]/20';

const panelClass =
  'rounded-2xl border border-[#1a364a] bg-[linear-gradient(145deg,rgba(13,32,48,.96),rgba(7,20,33,.96))] shadow-[0_22px_70px_rgba(0,0,0,.16)]';

function statusClass(status: PoolShareStatus | IncomingPoolRequest['status']) {
  if (status === 'ACTIVE' || status === 'APPROVED') {
    return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100';
  }
  if (status === 'PENDING' || status === 'PAUSED') {
    return 'border-amber-300/25 bg-amber-300/10 text-amber-100';
  }
  return 'border-rose-300/25 bg-rose-300/10 text-rose-100';
}

function LoadingCards() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Portföyler yükleniyor">
      {[0, 1, 2].map((item) => (
        <div key={item} className={`${panelClass} overflow-hidden p-3`}>
          <Skeleton className="h-48 w-full rounded-xl bg-[#153047]" />
          <Skeleton className="mt-4 h-5 w-2/3 bg-[#153047]" />
          <Skeleton className="mt-3 h-4 w-full bg-[#153047]" />
          <Skeleton className="mt-5 h-12 w-full rounded-xl bg-[#153047]" />
        </div>
      ))}
    </div>
  );
}

function FriendlyEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Database;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${panelClass} flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center`}>
      <span className="grid size-14 place-items-center rounded-2xl border border-[#39d8bd]/25 bg-[#39d8bd]/10 text-[#66ead4]">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-2 max-w-xl text-base leading-7 text-[#95aabd]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function PoolListingCard({
  listing,
  onRequest,
}: {
  listing: AuthorizedPoolListing;
  onRequest: (listing: AuthorizedPoolListing) => void;
}) {
  const requestLabel = listing.request
    ? requestStatusLabels[listing.request.status]
    : 'İletişim iste';
  const requestDisabled =
    listing.request?.status === 'PENDING' || listing.request?.status === 'APPROVED';

  return (
    <article className={`${panelClass} group overflow-hidden p-3 transition duration-200 hover:-translate-y-0.5 hover:border-[#39d8bd]/45`}>
      <div className="relative h-52 overflow-hidden rounded-xl bg-[#071522]">
        {listing.imageUrl ? (
          <Image
            src={listing.imageUrl}
            alt={`${listing.title} portföy görseli`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-[1.015]"
            unoptimized
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_top,#17364a,#071522_72%)] text-[#688399]">
            <Building2 className="size-10" aria-hidden="true" />
            <span className="text-sm">Görsel eklenmemiş</span>
          </div>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-[#06121e]/90 px-3 py-1.5 text-xs font-semibold text-emerald-100 backdrop-blur">
          <BadgeCheck className="size-4" aria-hidden="true" />
          Yetkisi doğrulandı
        </span>
        {listing.duplicateCount > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-[#58d6ff]/25 bg-[#06121e]/90 px-3 py-1.5 text-xs font-semibold text-[#b9ecff] backdrop-blur">
            <Layers3 className="size-4" aria-hidden="true" />
            {listing.duplicateCount} mükerrer kayıt birleştirildi
          </span>
        )}
      </div>

      <div className="px-2 pb-2 pt-4">
        <p className="text-sm font-semibold text-[#66ead4]">{listing.ownerCompanyName}</p>
        <h2 className="mt-1 line-clamp-2 min-h-14 text-xl font-semibold leading-7 text-white">
          {listing.title}
        </h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-[#9ab0c1]">
          <MapPin className="size-4 shrink-0 text-[#58d6ff]" aria-hidden="true" />
          {listing.location || 'Konum belirtilmedi'}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-lg border border-[#23445c] bg-[#071522] px-3 py-2 text-sm text-[#c8d7e2]">
            {listing.propertyType || 'Gayrimenkul'}
          </span>
          {listing.roomCount && (
            <span className="rounded-lg border border-[#23445c] bg-[#071522] px-3 py-2 text-sm text-[#c8d7e2]">
              {listing.roomCount}
            </span>
          )}
          {listing.area && (
            <span className="rounded-lg border border-[#23445c] bg-[#071522] px-3 py-2 text-sm text-[#c8d7e2]">
              {listing.area} m²
            </span>
          )}
        </div>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-[#1a364a] pt-4">
          <div>
            <span className="text-xs text-[#7890a3]">Satış fiyatı</span>
            <strong className="mt-1 block text-xl text-white">{formatPoolPrice(listing.price)}</strong>
          </div>
          <span className="text-right text-xs leading-5 text-[#7890a3]">
            Yetki bitişi<br />{formatPoolDate(listing.authorityExpiresAt)}
          </span>
        </div>

        {listing.isOwn ? (
          <div className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#2d4d62] bg-[#071522] px-4 text-sm font-semibold text-[#9ab0c1]">
            <ShieldCheck className="size-4" aria-hidden="true" /> Şirketinizin portföyü
          </div>
        ) : (
          <Button
            type="button"
            className="mt-4 min-h-12 w-full rounded-xl bg-[#39d8bd] px-5 text-base font-bold text-[#031611] hover:bg-[#66ead4]"
            disabled={requestDisabled}
            onClick={() => onRequest(listing)}
          >
            <Handshake className="size-5" aria-hidden="true" />
            {requestLabel}
            {!requestDisabled && <ChevronRight className="ml-auto size-5" aria-hidden="true" />}
          </Button>
        )}
      </div>
    </article>
  );
}

export function AuthorizedPoolView({
  data,
  error,
  filters,
  isOwner,
  loading,
  activeTab = 'pool',
  onTabChange = () => undefined,
  onFiltersChange,
  onRefresh,
  onRequest,
  onShareStatus,
  onOpenDialog,
}: {
  data: AuthorizedPoolPayload | null;
  error: string | null;
  filters: PoolFilters;
  isOwner: boolean;
  loading: boolean;
  activeTab?: PoolTab;
  onTabChange?: (tab: PoolTab) => void;
  onFiltersChange: (filters: PoolFilters) => void;
  onRefresh: () => void;
  onRequest: (listing: AuthorizedPoolListing) => void;
  onShareStatus: (share: OwnedPoolShare, status: 'ACTIVE' | 'PAUSED') => void;
  onOpenDialog: (dialog: Exclude<RequestDialogState, null>) => void;
}) {
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const management = data?.management;
  const availableProperties = management?.availableProperties || [];
  const publishableProperties = availableProperties.filter(
    (property) =>
      !property.share ||
      property.share.status === 'REVOKED' ||
      property.share.status === 'EXPIRED'
  );
  const activeShares = management?.ownedShares.filter((share) => share.status === 'ACTIVE').length || 0;
  const pendingCount = management?.incomingRequests.filter((request) => request.status === 'PENDING').length || 0;
  const mergedCount = data?.listings.reduce((total, listing) => total + listing.duplicateCount, 0) || 0;
  const hasActiveFilters = Object.values(filters).some((value) => value.trim());

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_12%_0%,rgba(28,91,105,.18),transparent_31%),#06111d]">
      <div className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="relative overflow-hidden rounded-3xl border border-[#1c4053] bg-[linear-gradient(120deg,#0c2b35_0%,#0a1c2b_48%,#081522_100%)] px-5 py-7 shadow-[0_32px_90px_rgba(0,0,0,.22)] sm:px-8 lg:px-10 lg:py-9">
          <div className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full border border-[#39d8bd]/10 bg-[#39d8bd]/5" />
          <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#39d8bd]/25 bg-[#39d8bd]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#7bead8]">
                <Sparkles className="size-4" aria-hidden="true" /> AI Yetkili Portföy Havuzu
              </span>
              <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
                Tüm yetkili portföyler, <span className="text-[#66ead4]">tek ve temiz bir havuzda.</span>
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#a7bac8] sm:text-lg">
                Business CEO AI kullanan ofislerin paylaşım izni verilmiş portföylerini bulun. Aynı ilanlar otomatik birleştirilir; kişisel bilgiler yalnızca onaylı iletişim talebinden sonra paylaşılır.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <span className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 text-sm font-semibold text-emerald-100">
                <BadgeCheck className="size-5" aria-hidden="true" /> Mükerrer kontrolü açık
              </span>
              <Button
                type="button"
                variant="outline"
                className="min-h-12 rounded-xl border-[#34546a] bg-[#071522]/70 px-5 text-base text-white hover:bg-[#102c3e] hover:text-white"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCcw className={`size-5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                Yenile
              </Button>
            </div>
          </div>

          <div className="relative mt-8 grid gap-2 border-t border-white/10 pt-5 sm:grid-cols-3">
            {[
              ['1', 'Portföyü bulun'],
              ['2', 'İletişim isteyin'],
              ['3', 'Sahibi onaylasın'],
            ].map(([number, label]) => (
              <div key={number} className="flex items-center gap-3 rounded-xl bg-white/[0.035] px-4 py-3 text-sm font-medium text-[#c6d5df]">
                <b className="grid size-7 place-items-center rounded-full bg-[#39d8bd] text-xs text-[#031611]">{number}</b>
                {label}
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Havuz özeti">
          {[
            { label: 'Tekil portföy', value: data?.listings.length ?? 0, detail: 'Havuzda görüntülenen', icon: Database },
            { label: 'Birleştirilen tekrar', value: mergedCount, detail: 'Aynı ilan yeniden gösterilmedi', icon: Layers3 },
            { label: 'Paylaşımlarım', value: activeShares, detail: 'Şu anda havuzda', icon: ShieldCheck },
            { label: 'Bekleyen talep', value: pendingCount, detail: 'Yanıtınızı bekliyor', icon: UserRoundCheck },
          ].map(({ label, value, detail, icon: Icon }) => (
            <div key={label} className={`${panelClass} flex items-center gap-4 p-4 sm:p-5`}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#39d8bd]/20 bg-[#39d8bd]/10 text-[#66ead4]">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <span className="text-sm text-[#8fa6b7]">{label}</span>
                <div className="flex items-baseline gap-2">
                  <strong className="text-2xl text-white">{value}</strong>
                  <small className="hidden text-xs text-[#6f8799] 2xl:inline">{detail}</small>
                </div>
              </div>
            </div>
          ))}
        </section>

        {error && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-rose-100">Havuz verileri alınamadı</p>
              <p className="mt-1 text-sm text-rose-100/75">{error}</p>
            </div>
            <Button type="button" variant="outline" className="min-h-11 border-rose-300/30 text-rose-100" onClick={onRefresh}>
              <RotateCcw aria-hidden="true" /> Yeniden dene
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as PoolTab)} className="flex w-full min-w-0 flex-col gap-6">
          <TabsList
            data-pool-navigation="true"
            className="grid h-auto w-full grid-cols-1 gap-2 rounded-2xl border border-[#1a364a] bg-[#071522] p-2 sm:grid-cols-3"
          >
            <TabsTrigger value="pool" className="min-h-14 justify-start rounded-xl px-4 text-base text-[#91a8b9] data-active:bg-[#39d8bd] data-active:text-[#031611]">
              <Database className="size-5" aria-hidden="true" /> Havuzu keşfet
              <small className="ml-auto rounded-full bg-black/10 px-2 py-0.5">{data?.listings.length ?? 0}</small>
            </TabsTrigger>
            {isOwner && (
              <>
                <TabsTrigger value="sharing" className="min-h-14 justify-start rounded-xl px-4 text-base text-[#91a8b9] data-active:bg-[#39d8bd] data-active:text-[#031611]">
                  <ShieldCheck className="size-5" aria-hidden="true" /> Portföylerim
                  <small className="ml-auto rounded-full bg-black/10 px-2 py-0.5">{activeShares}</small>
                </TabsTrigger>
                <TabsTrigger value="requests" className="min-h-14 justify-start rounded-xl px-4 text-base text-[#91a8b9] data-active:bg-[#39d8bd] data-active:text-[#031611]">
                  <Handshake className="size-5" aria-hidden="true" /> Gelen talepler
                  <small className="ml-auto rounded-full bg-black/10 px-2 py-0.5">{pendingCount}</small>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="pool" className="w-full min-w-0 space-y-5">
            <form
              className={`${panelClass} p-4 sm:p-5`}
              onSubmit={(event) => {
                event.preventDefault();
                onRefresh();
              }}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="flex-1">
                  <span className="mb-2 block text-sm font-semibold text-[#c7d7e2]">Ne arıyorsunuz?</span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#71899a]" aria-hidden="true" />
                    <Input
                      className={`${fieldClass} pl-12`}
                      value={filters.query}
                      placeholder="Başlık, konum veya referans yazın"
                      onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
                    />
                  </div>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12 rounded-xl border-[#34546a] bg-[#071522] px-5 text-base text-white hover:bg-[#102c3e] hover:text-white"
                  aria-expanded={advancedFiltersOpen}
                  onClick={() => setAdvancedFiltersOpen((open) => !open)}
                >
                  <Filter className="size-5" aria-hidden="true" />
                  Filtreler {hasActiveFilters ? '•' : ''}
                </Button>
                <Button type="submit" className="min-h-12 rounded-xl bg-[#39d8bd] px-6 text-base font-bold text-[#031611] hover:bg-[#66ead4]">
                  <Search className="size-5" aria-hidden="true" /> Ara
                </Button>
              </div>

              {advancedFiltersOpen && (
                <div className="mt-5 grid gap-3 border-t border-[#1a364a] pt-5 sm:grid-cols-2 lg:grid-cols-5">
                  <label>
                    <span className="mb-2 block text-sm text-[#91a8b9]">Konum</span>
                    <Input className={fieldClass} value={filters.location} placeholder="Örn. Alanya" onChange={(event) => onFiltersChange({ ...filters, location: event.target.value })} />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm text-[#91a8b9]">Oda</span>
                    <Input className={fieldClass} value={filters.roomCount} placeholder="Örn. 3+1" onChange={(event) => onFiltersChange({ ...filters, roomCount: event.target.value })} />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm text-[#91a8b9]">Gayrimenkul türü</span>
                    <Input className={fieldClass} value={filters.propertyType} placeholder="Daire, villa..." onChange={(event) => onFiltersChange({ ...filters, propertyType: event.target.value })} />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm text-[#91a8b9]">En düşük fiyat</span>
                    <Input className={fieldClass} type="number" min="0" inputMode="numeric" value={filters.minPrice} placeholder="₺" onChange={(event) => onFiltersChange({ ...filters, minPrice: event.target.value })} />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm text-[#91a8b9]">En yüksek fiyat</span>
                    <Input className={fieldClass} type="number" min="0" inputMode="numeric" value={filters.maxPrice} placeholder="₺" onChange={(event) => onFiltersChange({ ...filters, maxPrice: event.target.value })} />
                  </label>
                  <div className="flex items-end sm:col-span-2 lg:col-span-5 lg:justify-end">
                    <Button type="button" variant="ghost" className="min-h-11 text-[#91a8b9] hover:bg-[#102c3e] hover:text-white" onClick={() => onFiltersChange(EMPTY_POOL_FILTERS)}>
                      <X aria-hidden="true" /> Filtreleri temizle
                    </Button>
                  </div>
                </div>
              )}
            </form>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Yetkili portföyler</h2>
                <p className="mt-1 text-sm text-[#849bad]">Yalnızca geçerli yetkisi ve paylaşım izni bulunan tekil kayıtlar gösterilir.</p>
              </div>
              {mergedCount > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[#58d6ff]/20 bg-[#58d6ff]/10 px-3 py-2 text-sm text-[#bceeff]">
                  <Layers3 className="size-4" aria-hidden="true" /> {mergedCount} tekrar gizlendi
                </span>
              )}
            </div>

            {loading && !data ? (
              <LoadingCards />
            ) : data?.listings.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {data.listings.map((listing) => (
                  <PoolListingCard key={listing.id} listing={listing} onRequest={onRequest} />
                ))}
              </div>
            ) : (
              <FriendlyEmptyState
                icon={Database}
                title="Henüz eşleşen portföy yok"
                description="Filtreleri temizleyebilir veya şirketinizin yetkili portföyünü havuza ekleyerek ilk paylaşımı başlatabilirsiniz."
                action={
                  isOwner ? (
                    <Button type="button" className="min-h-12 bg-[#39d8bd] px-5 font-bold text-[#031611] hover:bg-[#66ead4]" onClick={() => onTabChange('sharing')}>
                      <ShieldCheck aria-hidden="true" /> Portföylerime git
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" className="min-h-12 border-[#34546a] text-white" onClick={() => onFiltersChange(EMPTY_POOL_FILTERS)}>
                      Filtreleri temizle
                    </Button>
                  )
                }
              />
            )}
          </TabsContent>

          {isOwner && (
            <TabsContent value="sharing" className="w-full min-w-0 space-y-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Portföylerim</h2>
                  <p className="mt-2 max-w-3xl text-base leading-7 text-[#91a8b9]">
                    Yetkisi doğrulanmış portföyünüzü seçin, paylaşım iznini onaylayın; gerisini sistem halletsin.
                  </p>
                </div>
                <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#39d8bd]/20 bg-[#39d8bd]/10 px-4 text-sm text-[#a8f2e5]">
                  <ShieldCheck className="size-5" aria-hidden="true" /> Telefon ve özel notlar paylaşılmaz
                </span>
              </div>

              <section className="space-y-3" aria-labelledby="publishable-pool-properties">
                <div>
                  <h3 id="publishable-pool-properties" className="text-lg font-semibold text-white">Havuza eklenmeye hazır</h3>
                  <p className="mt-1 text-sm text-[#849bad]">Satış yetkisi doğrulanmış uygun portföyleriniz.</p>
                </div>
                {publishableProperties.length === 0 ? (
                  <FriendlyEmptyState icon={BadgeCheck} title="Yeni uygun portföy yok" description="Satış yetkisi doğrulanan yeni portföyler burada otomatik görünür." />
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {publishableProperties.map((property) => (
                      <article key={property.id} className={`${panelClass} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold uppercase tracking-wider text-[#66ead4]">Paylaşıma hazır</span>
                          <h4 className="mt-1 truncate text-lg font-semibold text-white">{property.title}</h4>
                          <p className="mt-2 text-sm text-[#8da4b6]">{property.referenceCode || 'Referans yok'} · {property.location || 'Konum belirtilmedi'}</p>
                          <p className="mt-1 text-xs text-[#71899a]">Yetki: {formatPoolDate(property.authorityExpiresAt)}</p>
                        </div>
                        <Button type="button" className="min-h-12 shrink-0 rounded-xl bg-[#39d8bd] px-5 font-bold text-[#031611] hover:bg-[#66ead4]" onClick={() => onOpenDialog({ type: 'publish', property })}>
                          <ShieldCheck aria-hidden="true" /> Havuza ekle
                        </Button>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3 border-t border-[#1a364a] pt-6" aria-labelledby="active-pool-shares">
                <div>
                  <h3 id="active-pool-shares" className="text-lg font-semibold text-white">Paylaşım geçmişim</h3>
                  <p className="mt-1 text-sm text-[#849bad]">Yayındaki, duraklatılmış ve sona ermiş kayıtlar.</p>
                </div>
                {!management?.ownedShares.length ? (
                  <FriendlyEmptyState icon={ShieldCheck} title="Henüz paylaşımınız yok" description="Yukarıdaki uygun portföylerden birini seçerek kolayca başlayabilirsiniz." />
                ) : (
                  <div className="space-y-3">
                    {management.ownedShares.map((share) => (
                      <article key={share.id} className={`${panelClass} flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between`}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-base font-semibold text-white">{share.property.title}</h4>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(share.status)}`}>{shareStatusLabels[share.status]}</span>
                          </div>
                          <p className="mt-2 text-sm text-[#8da4b6]">{share.property.referenceCode || 'Referans yok'} · Yetki {formatPoolDate(share.authorityExpiresAt)} · {share.requestCount} talep</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {share.status === 'ACTIVE' && (
                            <Button type="button" variant="outline" className="min-h-11 border-amber-300/25 text-amber-100" onClick={() => onShareStatus(share, 'PAUSED')}>
                              <CirclePause aria-hidden="true" /> Duraklat
                            </Button>
                          )}
                          {share.status === 'PAUSED' && (
                            <Button type="button" variant="outline" className="min-h-11 border-[#39d8bd]/25 text-[#a8f2e5]" onClick={() => onShareStatus(share, 'ACTIVE')}>
                              <Check aria-hidden="true" /> Yeniden aç
                            </Button>
                          )}
                          {!['REVOKED', 'EXPIRED'].includes(share.status) && (
                            <Button type="button" variant="destructive" className="min-h-11" onClick={() => onOpenDialog({ type: 'revoke', share })}>
                              <X aria-hidden="true" /> Havuzdan kaldır
                            </Button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </TabsContent>
          )}

          {isOwner && (
            <TabsContent value="requests" className="w-full min-w-0 space-y-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Gelen iletişim talepleri</h2>
                <p className="mt-2 text-base text-[#91a8b9]">Talebi inceleyin; uygun bulursanız onaylayın. Tek yapmanız gereken bu.</p>
              </div>
              {!management?.incomingRequests.length ? (
                <FriendlyEmptyState icon={Handshake} title="Henüz talep yok" description="Diğer şirketlerden gelen güvenli iletişim talepleri burada görünecek." />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {management.incomingRequests.map((request) => (
                    <article key={request.id} className={`${panelClass} p-5`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#66ead4]">{request.requesterCompanyName}</p>
                          <h3 className="mt-1 text-lg font-semibold text-white">{request.property.title}</h3>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(request.status)}`}>{requestStatusLabels[request.status]}</span>
                      </div>
                      <div className="mt-4 rounded-xl border border-[#1a364a] bg-[#071522] p-4">
                        <p className="text-sm leading-6 text-[#a5b9c8]">{request.message || 'Bu şirket portföy için sizinle iletişim kurmak istiyor.'}</p>
                      </div>
                      <p className="mt-3 flex items-center gap-2 text-xs text-[#71899a]"><Clock3 className="size-4" aria-hidden="true" /> {formatPoolDate(request.createdAt)}</p>
                      {request.status === 'PENDING' && (
                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <Button type="button" variant="outline" className="min-h-12 border-rose-300/25 text-rose-100" onClick={() => onOpenDialog({ type: 'decision', request, decision: 'REJECTED' })}>Reddet</Button>
                          <Button type="button" className="min-h-12 bg-[#39d8bd] font-bold text-[#031611] hover:bg-[#66ead4]" onClick={() => onOpenDialog({ type: 'decision', request, decision: 'APPROVED' })}>Onayla</Button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export default function AuthorizedPoolClient() {
  const session = useFabrikaSession();
  const isOwner = session.principalType === 'OWNER';
  const [data, setData] = useState<AuthorizedPoolPayload | null>(null);
  const [filters, setFilters] = useState<PoolFilters>(EMPTY_POOL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<PoolFilters>(EMPTY_POOL_FILTERS);
  const [activeTab, setActiveTab] = useState<PoolTab>('pool');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<RequestDialogState>(null);
  const [dialogMessage, setDialogMessage] = useState('');
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(appliedFilters).forEach(([key, value]) => {
      if (value.trim()) params.set(key, value.trim());
    });
    return params.toString();
  }, [appliedFilters]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/fabrika/authorized-pool${queryString ? `?${queryString}` : ''}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error || 'Havuz verileri alınamadı.');
      setData({ listings: body.listings, management: body.management });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Havuz verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/fabrika/authorized-pool${queryString ? `?${queryString}` : ''}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error || 'Havuz verileri alınamadı.');
        return body;
      })
      .then((body) => setData({ listings: body.listings, management: body.management }))
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Havuz verileri alınamadı.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [queryString]);

  function openDialog(next: Exclude<RequestDialogState, null>) {
    setDialog(next);
    setDialogMessage('');
    setPermissionConfirmed(false);
  }

  async function mutate(method: 'POST' | 'PATCH', body: Record<string, unknown>, successMessage: string) {
    setSubmitting(true);
    try {
      const response = await fetch('/api/fabrika/authorized-pool', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'İşlem tamamlanamadı.');
      toast.success(successMessage);
      setDialog(null);
      await loadData();
    } catch (mutationError) {
      toast.error(mutationError instanceof Error ? mutationError.message : 'İşlem tamamlanamadı.');
    } finally {
      setSubmitting(false);
    }
  }

  function requestContact(listing: AuthorizedPoolListing) {
    if (!listing.request || ['REJECTED', 'CANCELLED'].includes(listing.request.status)) {
      openDialog({ type: 'contact', listing });
    }
  }

  async function submitDialog() {
    if (!dialog) return;
    if (dialog.type === 'contact') {
      await mutate('POST', {
        action: 'request-contact',
        shareId: dialog.listing.id,
        message: dialogMessage || undefined,
        idempotencyKey: `pool-contact:${dialog.listing.id}:${crypto.randomUUID()}`,
      }, 'İletişim talebiniz portföy sahibi şirkete iletildi.');
      return;
    }
    if (dialog.type === 'publish') {
      if (!permissionConfirmed) {
        toast.error('Paylaşım iznini açıkça onaylamalısınız.');
        return;
      }
      await mutate('POST', {
        action: 'publish',
        propertyId: dialog.property.id,
        sharePermissionConfirmed: true,
        permissionReference: dialogMessage || undefined,
      }, 'Portföy güvenli havuzda yayına alındı.');
      return;
    }
    if (dialog.type === 'revoke') {
      await mutate('PATCH', {
        action: 'update-share',
        shareId: dialog.share.id,
        status: 'REVOKED',
        reason: dialogMessage || undefined,
      }, 'Portföy paylaşımı kaldırıldı.');
      return;
    }
    await mutate('PATCH', {
      action: 'decide-contact',
      requestId: dialog.request.id,
      decision: dialog.decision,
      note: dialogMessage || undefined,
    }, dialog.decision === 'APPROVED' ? 'İletişim talebi onaylandı.' : 'İletişim talebi reddedildi.');
  }

  const dialogCopy = dialog?.type === 'contact'
    ? {
        title: 'Portföy sahibiyle iletişim isteyin',
        description: 'Kısa bir not ekleyin. Talebiniz karşı ofise güvenli biçimde iletilir; kişisel bilgiler doğrudan gösterilmez.',
        label: 'Talep notu (isteğe bağlı)',
        placeholder: 'Müşterinizin genel ihtiyacını kişisel veri eklemeden yazın.',
      }
    : dialog?.type === 'publish'
      ? {
          title: 'Portföyü havuza ekleyin',
          description: 'Satış yetkisi ve paylaşım izni doğrulandıktan sonra portföy tüm kullanıcıların ortak havuzunda görünür.',
          label: 'İzin referansı (isteğe bağlı)',
          placeholder: 'Kısa bir kayıt notu ekleyin.',
        }
      : dialog?.type === 'revoke'
        ? {
            title: 'Portföyü havuzdan kaldırın',
            description: 'Portföy ortak havuzdan hemen kaldırılır. Bu işlem geçmişte kayıtlı kalır.',
            label: 'Kaldırma nedeni (isteğe bağlı)',
            placeholder: 'Kısa bir neden yazın.',
          }
        : {
            title: dialog?.decision === 'APPROVED' ? 'Talebi onaylayın' : 'Talebi reddedin',
            description: 'Kararınız kayıt altına alınır. İletişim bilgileri yalnızca güvenli süreç içinde kullanılır.',
            label: 'Karar notu (isteğe bağlı)',
            placeholder: 'Kısa bir not ekleyin.',
          };

  return (
    <>
      <AuthorizedPoolView
        data={data}
        error={error}
        filters={filters}
        isOwner={isOwner}
        loading={loading}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onFiltersChange={(nextFilters) => {
          setFilters(nextFilters);
          if (nextFilters === EMPTY_POOL_FILTERS) {
            setAppliedFilters(EMPTY_POOL_FILTERS);
            if (appliedFilters === EMPTY_POOL_FILTERS) void loadData();
          }
        }}
        onRefresh={() => {
          setAppliedFilters(filters);
          if (JSON.stringify(filters) === JSON.stringify(appliedFilters)) void loadData();
        }}
        onRequest={requestContact}
        onShareStatus={(share, status) => void mutate(
          'PATCH',
          { action: 'update-share', shareId: share.id, status },
          status === 'ACTIVE' ? 'Portföy paylaşımı yeniden açıldı.' : 'Portföy paylaşımı duraklatıldı.'
        )}
        onOpenDialog={openDialog}
      />

      <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="border border-[#29485d] bg-[#0b1d2c] p-5 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="pr-8 text-xl">{dialogCopy.title}</DialogTitle>
            <DialogDescription className="text-base leading-7 text-[#9db1c1]">{dialogCopy.description}</DialogDescription>
          </DialogHeader>
          {dialog?.type === 'publish' && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#39d8bd]/25 bg-[#39d8bd]/10 p-4">
              <input type="checkbox" className="mt-1 size-5 accent-[#39d8bd]" checked={permissionConfirmed} onChange={(event) => setPermissionConfirmed(event.target.checked)} />
              <span className="text-sm leading-6 text-[#c4d4df]">Bu portföy için şirketler arası paylaşım izninin alındığını ve satış yetkisinin geçerli olduğunu onaylıyorum.</span>
            </label>
          )}
          <label>
            <span className="mb-2 block text-sm font-semibold text-[#dce8f0]">{dialogCopy.label}</span>
            <Textarea
              className={`${fieldClass} min-h-32`}
              value={dialogMessage}
              maxLength={dialog?.type === 'publish' ? 240 : 1200}
              onChange={(event) => setDialogMessage(event.target.value)}
              placeholder={dialogCopy.placeholder}
            />
          </label>
          <p aria-live="polite" className="text-right text-xs text-[#71899a]">{dialogMessage.length} / {dialog?.type === 'publish' ? 240 : 1200}</p>
          <DialogFooter className="border-[#29485d] bg-[#071522]">
            <Button type="button" variant="ghost" className="min-h-11 text-[#9db1c1]" onClick={() => setDialog(null)}>Vazgeç</Button>
            <Button type="button" className="min-h-11 bg-[#39d8bd] px-5 font-bold text-[#031611] hover:bg-[#66ead4]" disabled={submitting || (dialog?.type === 'publish' && !permissionConfirmed)} onClick={() => void submitDialog()}>
              {submitting ? 'İşleniyor…' : 'Onayla ve devam et'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
