'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  CircleX,
  Crosshair,
  Layers,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import AvciV2Workspace from '@/components/fabrika/avci-v2/AvciV2Workspace';
import FilterBar from '@/components/fabrika/FilterBar';
import PageHeader from '@/components/fabrika/PageHeader';
import StatCard from '@/components/fabrika/StatCard';
import StatusBoard from '@/components/fabrika/StatusBoard';

type HuntingListing = {
  id: string;
  title: string;
  price?: string | null;
  location?: string | null;
  ownerName?: string | null;
  sourceUrl: string;
  status: 'YELLOW' | 'AUTHORIZED' | 'GREEN' | 'RED';
  authorizationNote?: string | null;
  eliminationReason?: string | null;
  eliminationSummary?: string | null;
  portfolioImport?: {
    id: string;
    status: string;
    propertyId: string | null;
    reviewNote: string | null;
  } | null;
};

type ActiveView = 'kesif' | 'pano' | 'eklenti';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || 'İşlem tamamlanamadı.');
  }
  return payload as T;
}

export default function AvciPage() {
  const [activeView, setActiveView] = useState<ActiveView>('kesif');
  const [listings, setListings] = useState<HuntingListing[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);

  const fetchListings = useCallback(async () => {
    setLoadingBoard(true);
    try {
      setListings(
        await apiJson<HuntingListing[]>('/api/fabrika/hunting/status')
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Avcı kayıtları yüklenemedi.'
      );
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchListings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchListings]);

  const counts = useMemo(
    () => ({
      total: listings.length,
      yellow: listings.filter((listing) => listing.status === 'YELLOW').length,
      authorized: listings.filter(
        (listing) => listing.status === 'AUTHORIZED'
      ).length,
      green: listings.filter((listing) => listing.status === 'GREEN').length,
      red: listings.filter((listing) => listing.status === 'RED').length,
    }),
    [listings]
  );

  async function handleStatusChange(
    id: string,
    status: HuntingListing['status'],
    details?: {
      eliminationReason?: string;
      eliminationNote?: string;
      authorizationNote?: string;
    }
  ) {
    try {
      const result = await apiJson<{ message?: string }>(
        '/api/fabrika/hunting/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status, ...details }),
        }
      );
      toast.success(result.message || 'İlan durumu güncellendi.');
      await fetchListings();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Durum güncellenemedi.'
      );
    }
  }

  async function handleDeleteListing(id: string) {
    try {
      await apiJson(`/api/fabrika/hunting/delete-listing?id=${id}`, {
        method: 'DELETE',
      });
      setListings((current) =>
        current.filter((listing) => listing.id !== id)
      );
      toast.success('İlan kaldırıldı.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'İlan kaldırılamadı.'
      );
    }
  }

  return (
    <div className="space-y-5">
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0f172a',
            border: '1px solid #334155',
            color: '#e2e8f0',
          },
        }}
      />

      <PageHeader
        actions={
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
            onClick={() => void fetchListings()}
            type="button"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingBoard ? 'animate-spin' : ''}`}
            />
            Yenile
          </button>
        }
        description="İzinli kaynaklardan ilanları kuyrukla zenginleştirin; telefon, izin ve insan onayı kontrollerini tamamlamadan iletişim başlatmayın."
        eyebrow="M2 · GÜVENLİ PORTFÖY KEŞFİ"
        icon={Crosshair}
        title="Avcı v2"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={Layers}
          label="Toplam kayıt"
          status="success"
          value={counts.total}
        />
        <StatCard
          icon={Sparkles}
          label="Sıcak pazarlık"
          status="warning"
          value={counts.yellow}
        />
        <StatCard
          icon={BadgeCheck}
          label="Satış yetkisi"
          status="success"
          value={counts.authorized}
        />
        <StatCard
          icon={CheckCircle2}
          label="Portföye katıldı"
          status="success"
          value={counts.green}
        />
        <StatCard icon={CircleX} label="Pasif / elendi" value={counts.red} />
      </div>

      <FilterBar label="Avcı çalışma alanı">
        <div
          aria-label="Avcı görünümü"
          className="flex flex-wrap gap-1.5"
          role="tablist"
        >
          {[
            {
              id: 'kesif' as const,
              label: 'Keşif ve ilan detayları',
              icon: Crosshair,
            },
            {
              id: 'pano' as const,
              label: 'Satış yetkisi panosu',
              icon: Layers,
            },
            {
              id: 'eklenti' as const,
              label: 'Tarayıcı eklentisi',
              icon: Puzzle,
            },
          ].map(({ id, label, icon: Icon }) => (
            <button
              aria-selected={activeView === id}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition ${
                activeView === id
                  ? 'bg-emerald-500 text-emerald-950'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
              key={id}
              onClick={() => setActiveView(id)}
              role="tab"
              type="button"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </FilterBar>

      {activeView === 'kesif' && <AvciV2Workspace />}

      {activeView === 'pano' && (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs leading-5 text-sky-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Durum panosu portföy sürecini yönetir. Telefon bilgisi burada
            gösterilmez; iletişim yalnızca Avcı v2 detayındaki merkezî politika
            kontrolü ve insan onayından sonra açılır.
          </div>
          {loadingBoard ? (
            <div className="h-96 animate-pulse rounded-xl border border-slate-800 bg-slate-900" />
          ) : (
            <StatusBoard
              listings={listings}
              onDeleteListing={(id) => void handleDeleteListing(id)}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      )}

      {activeView === 'eklenti' && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-start gap-3">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <Puzzle className="h-5 w-5 text-emerald-300" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">
                  İnce ve güvenli tarayıcı eklentisi
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Eklenti yalnızca açık filtreli arama URL&apos;sini ve ekranda
                  görünen ilan satırlarının anlık görüntüsünü Avcı kuyruğuna
                  aktarır.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                {
                  number: '1',
                  title: 'Sonuçları filtreleyin',
                  body: 'Yetkili kaynakta ihtiyacınıza göre konum, fiyat ve kategori filtrelerini uygulayın.',
                },
                {
                  number: '2',
                  title: 'Tek sekmede aktarın',
                  body: 'Eklentiden “Bu aramayı Avcı’ya aktar” seçeneğini kullanın. Yeni sekmeler açılmaz.',
                },
                {
                  number: '3',
                  title: 'İşi panelden izleyin',
                  body: 'Job bağlantısını açarak bulunan, tamamlanan, kısmi ve hatalı kayıtları takip edin.',
                },
              ].map((step) => (
                <div
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  key={step.number}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-xs font-bold text-emerald-300">
                    {step.number}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-100">
              Eklenti telefon butonlarına tıklamaz, sayfa metninde telefon
              aramaz, CAPTCHA veya kaynak güvenlik kontrollerini aşmaya çalışmaz.
              Bir doğrulama engeli görülürse iş güvenli biçimde duraklatılır.
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
