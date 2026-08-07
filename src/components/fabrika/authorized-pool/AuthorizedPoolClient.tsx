'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CirclePause,
  Clock3,
  Database,
  Filter,
  Handshake,
  MapPin,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCheck,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';

import EmptyState from '@/components/fabrika/EmptyState';
import PageHeader from '@/components/fabrika/PageHeader';
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

type RequestDialogState =
  | { type: 'contact'; listing: AuthorizedPoolListing }
  | { type: 'publish'; property: AvailablePoolProperty }
  | { type: 'revoke'; share: OwnedPoolShare }
  | { type: 'decision'; request: IncomingPoolRequest; decision: 'APPROVED' | 'REJECTED' }
  | null;

const inputClass =
  'min-h-11 border-[#1d3850] bg-[#071421] text-[#f3f8fc] placeholder:text-[#71869b] focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20';

function statusClass(status: PoolShareStatus | IncomingPoolRequest['status']) {
  if (status === 'ACTIVE' || status === 'APPROVED') {
    return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
  }
  if (status === 'PENDING' || status === 'PAUSED') {
    return 'border-amber-400/25 bg-amber-400/10 text-amber-200';
  }
  return 'border-rose-400/25 bg-rose-400/10 text-rose-200';
}

function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Portföyler yükleniyor">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-xl border border-[#1d3850] bg-[#091727] p-4">
          <Skeleton className="h-40 w-full bg-[#132a3e]" />
          <Skeleton className="mt-4 h-5 w-2/3 bg-[#132a3e]" />
          <Skeleton className="mt-2 h-4 w-full bg-[#132a3e]" />
          <Skeleton className="mt-5 h-10 w-full bg-[#132a3e]" />
        </div>
      ))}
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
    : 'Portföy sahibine ulaşma talebi gönder';

  return (
    <article className="group overflow-hidden rounded-xl border border-[#1d3850] bg-[#091727] shadow-[0_18px_44px_rgba(0,0,0,0.13)] transition-colors hover:border-cyan-300/35">
      <div className="relative h-44 overflow-hidden border-b border-[#1d3850] bg-[#071421]">
        {listing.imageUrl ? (
          <Image
            src={listing.imageUrl}
            alt={`${listing.title} portföy görseli`}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:opacity-95"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[#597187]">
            <Building2 className="size-10" aria-hidden="true" />
            <span className="sr-only">Görsel bulunmuyor</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-md border border-cyan-300/25 bg-[#06111f]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-200">
          Satış yetkisi doğrulandı
        </span>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <p className="text-xs font-medium text-cyan-200">{listing.ownerCompanyName}</p>
          <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-6 text-[#f3f8fc]">
            {listing.title}
          </h2>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-[#8ea3b8]">
            <MapPin className="size-3.5" aria-hidden="true" />
            {listing.location || 'Konum belirtilmedi'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-[#142c41] bg-[#071421] p-2.5">
            <span className="block text-[#71869b]">Fiyat</span>
            <strong className="mt-1 block text-[#f3f8fc]">{formatPoolPrice(listing.price)}</strong>
          </div>
          <div className="rounded-lg border border-[#142c41] bg-[#071421] p-2.5">
            <span className="block text-[#71869b]">Özellik</span>
            <strong className="mt-1 block text-[#f3f8fc]">
              {[listing.roomCount, listing.area ? `${listing.area} m²` : null]
                .filter(Boolean)
                .join(' · ') || 'Belirtilmedi'}
            </strong>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-xs text-[#8ea3b8]">
          <span>{listing.propertyType || 'Gayrimenkul'}</span>
          <span className="flex items-center gap-1">
            <Clock3 className="size-3.5" aria-hidden="true" />
            Yetki: {formatPoolDate(listing.authorityExpiresAt)}
          </span>
        </div>
        {listing.isOwn ? (
          <div className="flex min-h-10 items-center justify-center rounded-lg border border-[#1d3850] bg-[#071421] px-3 text-sm font-medium text-[#8ea3b8]">
            Şirketinize ait portföy
          </div>
        ) : (
          <Button
            type="button"
            className="min-h-10 w-full border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15"
            disabled={listing.request?.status === 'PENDING' || listing.request?.status === 'APPROVED'}
            onClick={() => onRequest(listing)}
          >
            <Handshake aria-hidden="true" />
            {requestLabel}
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
  onFiltersChange: (filters: PoolFilters) => void;
  onRefresh: () => void;
  onRequest: (listing: AuthorizedPoolListing) => void;
  onShareStatus: (share: OwnedPoolShare, status: 'ACTIVE' | 'PAUSED') => void;
  onOpenDialog: (dialog: Exclude<RequestDialogState, null>) => void;
}) {
  const management = data?.management;
  const availableProperties = management?.availableProperties || [];
  const publishableProperties = availableProperties.filter(
    (property) =>
      !property.share ||
      property.share.status === 'REVOKED' ||
      property.share.status === 'EXPIRED'
  );
  const pendingCount = management?.incomingRequests.filter((request) => request.status === 'PENDING').length || 0;

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="AI Yetkili Portföy Havuzu"
        title="İzinli portföyleri güvenle paylaşın"
        description="Yalnız satış yetkisi ve açık paylaşım izni doğrulanan portföyleri inceleyin. Kişisel iletişim bilgileri yerine güvenli ulaşma talebi kullanılır."
        icon={ShieldCheck}
        actions={
          <Button
            type="button"
            variant="outline"
            className="min-h-10 border-[#1d3850] bg-[#091727] text-[#f3f8fc] hover:bg-[#0d2034]"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCcw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Yenile
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Havuz özeti">
        {[
          { label: 'Paylaşıma açık portföy', value: data?.listings.length ?? 0, icon: Database },
          { label: 'Sizin paylaşımlarınız', value: management?.ownedShares.length ?? 0, icon: ShieldCheck },
          { label: 'Yanıt bekleyen talep', value: pendingCount, icon: UserRoundCheck },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-[#1d3850] bg-[#091727] p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#8ea3b8]">{label}</span>
              <Icon className="size-4 text-cyan-200" aria-hidden="true" />
            </div>
            <strong className="mt-2 block text-2xl font-semibold text-[#f3f8fc]">{value}</strong>
          </div>
        ))}
      </section>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-rose-100">Havuz verileri alınamadı</p>
            <p className="mt-1 text-sm text-rose-200/80">{error}</p>
          </div>
          <Button type="button" variant="outline" className="border-rose-300/30 text-rose-100" onClick={onRefresh}>
            <RotateCcw aria-hidden="true" /> Yeniden dene
          </Button>
        </div>
      )}

      <Tabs defaultValue="pool" className="space-y-5">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-xl border border-[#1d3850] bg-[#071421] p-1 sm:w-fit">
          <TabsTrigger value="pool" className="min-h-10 px-4 text-[#8ea3b8] data-active:text-cyan-100">
            <Database aria-hidden="true" /> Portföy havuzu
          </TabsTrigger>
          {isOwner && (
            <>
              <TabsTrigger value="sharing" className="min-h-10 px-4 text-[#8ea3b8] data-active:text-cyan-100">
                <ShieldCheck aria-hidden="true" /> Paylaşım yönetimi
              </TabsTrigger>
              <TabsTrigger value="requests" className="min-h-10 px-4 text-[#8ea3b8] data-active:text-cyan-100">
                <Handshake aria-hidden="true" /> Gelen talepler {pendingCount > 0 ? `(${pendingCount})` : ''}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="pool" className="space-y-5">
          <form
            className="rounded-xl border border-[#1d3850] bg-[#091727] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              onRefresh();
            }}
          >
            <div className="mb-3 flex items-center gap-2">
              <Filter className="size-4 text-cyan-200" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#f3f8fc]">Portföyleri filtreleyin</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2">
                <span className="mb-1.5 block text-xs font-medium text-[#8ea3b8]">Başlık veya referans</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#71869b]" aria-hidden="true" />
                  <Input className={`${inputClass} pl-9`} value={filters.query} placeholder="Portföy ara" onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })} />
                </div>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#8ea3b8]">Konum</span>
                <Input className={inputClass} value={filters.location} placeholder="Örn. Alanya" onChange={(event) => onFiltersChange({ ...filters, location: event.target.value })} />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#8ea3b8]">Oda</span>
                <Input className={inputClass} value={filters.roomCount} placeholder="Örn. 3+1" onChange={(event) => onFiltersChange({ ...filters, roomCount: event.target.value })} />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium text-[#8ea3b8]">Tür</span>
                <Input className={inputClass} value={filters.propertyType} placeholder="Villa, daire…" onChange={(event) => onFiltersChange({ ...filters, propertyType: event.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-2 xl:col-span-1">
                <label>
                  <span className="mb-1.5 block text-xs font-medium text-[#8ea3b8]">En az</span>
                  <Input className={inputClass} type="number" min="0" inputMode="numeric" value={filters.minPrice} placeholder="₺" onChange={(event) => onFiltersChange({ ...filters, minPrice: event.target.value })} />
                </label>
                <label>
                  <span className="mb-1.5 block text-xs font-medium text-[#8ea3b8]">En çok</span>
                  <Input className={inputClass} type="number" min="0" inputMode="numeric" value={filters.maxPrice} placeholder="₺" onChange={(event) => onFiltersChange({ ...filters, maxPrice: event.target.value })} />
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" className="min-h-10 text-[#8ea3b8] hover:bg-[#0d2034] hover:text-[#f3f8fc]" onClick={() => onFiltersChange(EMPTY_POOL_FILTERS)}>
                <X aria-hidden="true" /> Temizle
              </Button>
              <Button type="submit" className="min-h-10 bg-cyan-300 text-[#03111c] hover:bg-cyan-200">
                <SlidersHorizontal aria-hidden="true" /> Filtrele
              </Button>
            </div>
          </form>

          {loading && !data ? (
            <LoadingCards />
          ) : data?.listings.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.listings.map((listing) => (
                <PoolListingCard key={listing.id} listing={listing} onRequest={onRequest} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Database}
              title="Filtrelere uygun portföy bulunamadı"
              description="Havuz yalnız geçerli satış yetkisi ve açık paylaşım izni bulunan kayıtları gösterir. Filtreleri temizleyip yeniden deneyebilirsiniz."
              action={<Button type="button" variant="outline" className="border-[#1d3850] text-[#f3f8fc]" onClick={() => onFiltersChange(EMPTY_POOL_FILTERS)}>Filtreleri temizle</Button>}
            />
          )}
        </TabsContent>

        {isOwner && (
          <TabsContent value="sharing" className="space-y-4">
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm leading-6 text-[#a8c0d2]">
              <strong className="text-cyan-100">Açık izin zorunludur.</strong> Havuza ekleme yalnız doğrulanmış satış yetkisi olan portföylerde ve şirketinizin paylaşım onayıyla yapılır. Telefon, malik belgesi veya özel not paylaşılmaz.
            </div>
            <section className="space-y-3" aria-labelledby="active-pool-shares">
              <div>
                <h2 id="active-pool-shares" className="font-semibold text-[#f3f8fc]">Mevcut paylaşımlarınız</h2>
                <p className="mt-1 text-sm text-[#8ea3b8]">Yayındaki, duraklatılan ve yetkisi sona eren tüm kayıtlar.</p>
              </div>
              {!management?.ownedShares.length ? (
                <EmptyState icon={ShieldCheck} title="Henüz havuz paylaşımınız yok" description="Uygun bir portföyü aşağıdaki listeden açık izinle havuza ekleyebilirsiniz." />
              ) : (
                management.ownedShares.map((share) => (
                  <article key={share.id} className="flex flex-col gap-4 rounded-xl border border-[#1d3850] bg-[#091727] p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-[#f3f8fc]">{share.property.title}</h3>
                        <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusClass(share.status)}`}>{shareStatusLabels[share.status]}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#8ea3b8]">{share.property.referenceCode} · Yetki {formatPoolDate(share.authorityExpiresAt)} · {share.requestCount} ulaşma talebi</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {share.status === 'ACTIVE' && (
                        <Button type="button" variant="outline" className="min-h-10 border-amber-300/25 text-amber-100" onClick={() => onShareStatus(share, 'PAUSED')}>
                          <CirclePause aria-hidden="true" /> Duraklat
                        </Button>
                      )}
                      {share.status === 'PAUSED' && (
                        <Button type="button" variant="outline" className="min-h-10 border-cyan-300/25 text-cyan-100" onClick={() => onShareStatus(share, 'ACTIVE')}>
                          <Check aria-hidden="true" /> Yeniden aç
                        </Button>
                      )}
                      {!['REVOKED', 'EXPIRED'].includes(share.status) && (
                        <Button type="button" variant="destructive" className="min-h-10" onClick={() => onOpenDialog({ type: 'revoke', share })}>
                          <X aria-hidden="true" /> Paylaşımı kaldır
                        </Button>
                      )}
                    </div>
                  </article>
                ))
              )}
            </section>

            <section className="space-y-3 border-t border-[#1d3850] pt-5" aria-labelledby="publishable-pool-properties">
              <div>
                <h2 id="publishable-pool-properties" className="font-semibold text-[#f3f8fc]">Havuza eklenebilir portföyler</h2>
                <p className="mt-1 text-sm text-[#8ea3b8]">Aktif, süresi geçmemiş ve satış yetkisi doğrulanmış kayıtlar.</p>
              </div>
              {publishableProperties.length === 0 ? (
                <EmptyState icon={ShieldCheck} title="Paylaşıma uygun yeni portföy yok" description="Satış yetkisi doğrulanan yeni portföyler otomatik olarak bu listede görünür." />
              ) : (
                publishableProperties.map((property) => (
                  <article key={property.id} className="flex flex-col gap-4 rounded-xl border border-[#1d3850] bg-[#091727] p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[#f3f8fc]">{property.title}</h3>
                      <p className="mt-1 text-xs text-[#8ea3b8]">{property.referenceCode} · {property.location || 'Konum belirtilmedi'} · Yetki {formatPoolDate(property.authorityExpiresAt)}</p>
                    </div>
                    <Button type="button" className="min-h-10 bg-cyan-300 text-[#03111c] hover:bg-cyan-200" onClick={() => onOpenDialog({ type: 'publish', property })}>
                      <ShieldCheck aria-hidden="true" /> Havuza ekle
                    </Button>
                  </article>
                ))
              )}
            </section>
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="requests" className="space-y-3">
            {!management?.incomingRequests.length ? (
              <EmptyState icon={Handshake} title="Henüz ulaşma talebi yok" description="Diğer şirketlerden gelen güvenli iletişim talepleri burada değerlendirilir. İletişim bilgileri doğrudan paylaşılmaz." />
            ) : (
              management.incomingRequests.map((request) => (
                <article key={request.id} className="rounded-xl border border-[#1d3850] bg-[#091727] p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[#f3f8fc]">{request.property.title}</h3>
                        <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${statusClass(request.status)}`}>{requestStatusLabels[request.status]}</span>
                      </div>
                      <p className="mt-1 text-sm text-cyan-100">{request.requesterCompanyName}</p>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8ea3b8]">{request.message || 'Şirket bu portföy için iletişim kurmak istiyor.'}</p>
                      <p className="mt-2 text-xs text-[#71869b]">Talep: {formatPoolDate(request.createdAt)}</p>
                    </div>
                    {request.status === 'PENDING' && (
                      <div className="flex shrink-0 gap-2">
                        <Button type="button" variant="outline" className="min-h-10 border-rose-300/25 text-rose-100" onClick={() => onOpenDialog({ type: 'decision', request, decision: 'REJECTED' })}>Reddet</Button>
                        <Button type="button" className="min-h-10 bg-cyan-300 text-[#03111c] hover:bg-cyan-200" onClick={() => onOpenDialog({ type: 'decision', request, decision: 'APPROVED' })}>Onayla</Button>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function AuthorizedPoolClient() {
  const session = useFabrikaSession();
  const isOwner = session.principalType === 'OWNER';
  const [data, setData] = useState<AuthorizedPoolPayload | null>(null);
  const [filters, setFilters] = useState<PoolFilters>(EMPTY_POOL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<PoolFilters>(EMPTY_POOL_FILTERS);
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
        if (!response.ok || !body.success) {
          throw new Error(body.error || 'Havuz verileri alınamadı.');
        }
        return body;
      })
      .then((body) => {
        setData({ listings: body.listings, management: body.management });
      })
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
    if (listing.request?.status === 'REJECTED' || listing.request?.status === 'CANCELLED') {
      openDialog({ type: 'contact', listing });
      return;
    }
    if (!listing.request) openDialog({ type: 'contact', listing });
  }

  async function submitDialog() {
    if (!dialog) return;
    if (dialog.type === 'contact') {
      await mutate('POST', {
        action: 'request-contact',
        shareId: dialog.listing.id,
        message: dialogMessage || undefined,
        idempotencyKey: `pool-contact:${dialog.listing.id}:${crypto.randomUUID()}`,
      }, 'Ulaşma talebiniz portföy sahibi şirkete iletildi.');
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
    }, dialog.decision === 'APPROVED' ? 'Ulaşma talebi onaylandı.' : 'Ulaşma talebi reddedildi.');
  }

  return (
    <>
      <AuthorizedPoolView
        data={data}
        error={error}
        filters={filters}
        isOwner={isOwner}
        loading={loading}
        onFiltersChange={(nextFilters) => {
          setFilters(nextFilters);
          if (nextFilters === EMPTY_POOL_FILTERS) {
            setLoading(true);
            setError(null);
            setAppliedFilters(EMPTY_POOL_FILTERS);
            if (appliedFilters === EMPTY_POOL_FILTERS) void loadData();
          }
        }}
        onRefresh={() => {
          setLoading(true);
          setError(null);
          setAppliedFilters(filters);
          if (JSON.stringify(filters) === JSON.stringify(appliedFilters)) void loadData();
        }}
        onRequest={requestContact}
        onShareStatus={(share, status) => void mutate('PATCH', { action: 'update-share', shareId: share.id, status }, status === 'ACTIVE' ? 'Portföy paylaşımı yeniden açıldı.' : 'Portföy paylaşımı duraklatıldı.')}
        onOpenDialog={openDialog}
      />

      <Dialog open={Boolean(dialog)} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="border border-[#1d3850] bg-[#091727] text-[#f3f8fc] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === 'contact' && 'Portföy sahibine ulaşma talebi'}
              {dialog?.type === 'publish' && 'Portföyü yetkili havuza ekle'}
              {dialog?.type === 'revoke' && 'Paylaşımı kaldır'}
              {dialog?.type === 'decision' && (dialog.decision === 'APPROVED' ? 'Talebi onayla' : 'Talebi reddet')}
            </DialogTitle>
            <DialogDescription className="leading-6 text-[#8ea3b8]">
              {dialog?.type === 'contact' && 'Talebiniz karşı şirkete iletilir. Telefon, malik belgesi veya özel kayıtlar havuz ekranında gösterilmez.'}
              {dialog?.type === 'publish' && 'Yalnız doğrulanmış satış yetkisine ve açık paylaşım iznine sahip portföyler yayımlanabilir.'}
              {dialog?.type === 'revoke' && 'Kayıt havuzdan hemen kaldırılır. İşlem geçmişine kaydedilir.'}
              {dialog?.type === 'decision' && 'Karar kayıt altına alınır; kişisel iletişim bilgileri bu ekranda açıklanmaz.'}
            </DialogDescription>
          </DialogHeader>
          {dialog?.type === 'publish' && (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-3">
              <input type="checkbox" className="mt-1 size-4 accent-cyan-300" checked={permissionConfirmed} onChange={(event) => setPermissionConfirmed(event.target.checked)} />
              <span className="text-sm leading-6 text-[#b8cad8]">Bu portföy için şirketler arası paylaşım izninin açıkça alındığını ve yetki süresinin geçerli olduğunu onaylıyorum.</span>
            </label>
          )}
          <label>
            <span className="mb-1.5 block text-sm font-medium text-[#dce8f0]">
              {dialog?.type === 'contact' ? 'Talep notu (isteğe bağlı)' : dialog?.type === 'publish' ? 'İzin referansı (isteğe bağlı)' : 'Karar notu (isteğe bağlı)'}
            </span>
            <Textarea className={`${inputClass} min-h-28`} value={dialogMessage} maxLength={dialog?.type === 'publish' ? 240 : 1200} onChange={(event) => setDialogMessage(event.target.value)} placeholder={dialog?.type === 'contact' ? 'Müşterinizin genel ihtiyacını kişisel veri eklemeden açıklayın.' : 'Kısa bir kayıt notu ekleyin.'} />
          </label>
          <p aria-live="polite" className="text-xs text-[#71869b]">{dialogMessage.length} / {dialog?.type === 'publish' ? 240 : 1200}</p>
          <DialogFooter className="border-[#1d3850] bg-[#071421]">
            <Button type="button" variant="ghost" className="text-[#8ea3b8]" onClick={() => setDialog(null)}>Vazgeç</Button>
            <Button type="button" className="bg-cyan-300 text-[#03111c] hover:bg-cyan-200" disabled={submitting || (dialog?.type === 'publish' && !permissionConfirmed)} onClick={() => void submitDialog()}>
              {submitting ? 'İşleniyor…' : 'Onayla ve devam et'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
