'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Compass,
  FilePlus2,
  Info,
  Layers3,
  Loader2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import AvciV2Workspace from '@/components/fabrika/avci-v2/AvciV2Workspace';
import StatusBoard from '@/components/fabrika/StatusBoard';
import { ImportedListingsSummary } from '@/components/fabrika/portfolio-specialist/ImportedListingsSummary';
import { PortfolioWorkspace } from '@/components/fabrika/portfolio-specialist/PortfolioWorkspace';
import type {
  HuntingListing,
  HuntingStatus,
} from '@/components/fabrika/portfolio-specialist/types';
import styles from './avci.module.css';
import redesign from './avci-redesign.module.css';

type ActiveView = 'discover' | 'authorization' | 'portfolios';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const TIME_RANGE_OPTIONS = [
  { id: '1d', label: '1 Gün', days: 1, description: 'Son 24 saat' },
  { id: '7d', label: '1 Hafta', days: 7, description: 'Son 7 gün' },
  { id: '14d', label: '14 Gün', days: 14, description: 'Son 14 gün' },
  { id: '30d', label: '1 Ay', days: 30, description: 'Son 30 gün' },
] as const;

type TimeRange = (typeof TIME_RANGE_OPTIONS)[number]['id'];

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || 'İşlem tamamlanamadı.');
  }
  return payload;
}

export default function AvciPage() {
  const [activeView, setActiveView] = useState<ActiveView>('discover');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [rangeAnchor, setRangeAnchor] = useState(() => Date.now());
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
        error instanceof Error
          ? error.message
          : 'Portföy uzmanı kayıtları yüklenemedi.'
      );
    } finally {
      setLoadingBoard(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void apiJson<HuntingListing[]>('/api/fabrika/hunting/status', {
      signal: controller.signal,
    })
      .then(setListings)
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        toast.error(
          error instanceof Error
            ? error.message
            : 'Portföy uzmanı kayıtları yüklenemedi.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBoard(false);
      });
    return () => controller.abort();
  }, []);

  const activeRange = TIME_RANGE_OPTIONS.find(
    (option) => option.id === timeRange
  )!;
  const periodListings = useMemo(() => {
    const rangeStart = rangeAnchor - activeRange.days * DAY_IN_MS;
    return listings.filter((listing) => {
      const dateValue = listing.createdAt || listing.updatedAt || listing.lastSeenAt;
      if (!dateValue) return false;
      const timestamp = Date.parse(dateValue);
      return (
        Number.isFinite(timestamp) &&
        timestamp >= rangeStart &&
        timestamp <= rangeAnchor
      );
    });
  }, [activeRange.days, listings, rangeAnchor]);

  const counts = useMemo(
    () => ({
      total: periodListings.length,
      negotiation: periodListings.filter(
        (listing) => listing.status === 'YELLOW'
      ).length,
      authorized: periodListings.filter(
        (listing) => listing.status === 'AUTHORIZED'
      ).length,
      joined: periodListings.filter((listing) => listing.status === 'GREEN')
        .length,
    }),
    [periodListings]
  );

  async function handleStatusChange(
    id: string,
    status: HuntingStatus,
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
          body: JSON.stringify({
            id,
            status,
            ...details,
            idempotencyKey: `hunting-status:${id}:${status}:${crypto.randomUUID()}`,
          }),
        }
      );
      toast.success(result.message || 'Portföy durumu güncellendi.');
      await fetchListings();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Durum güncellenemedi.'
      );
    }
  }

  async function handlePortfolioJoin(
    _listingId: string,
    portfolioImportId: string
  ) {
    try {
      const result = await apiJson<{ message?: string }>(
        '/api/fabrika/portfolio-imports',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            id: portfolioImportId,
          }),
        }
      );
      toast.success(result.message || 'Kayıt şirket portföyüne eklendi.');
      await fetchListings();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Portföye katılım tamamlanamadı.'
      );
    }
  }

  const tabs = [
    { id: 'discover' as const, label: 'Keşfe Çık', icon: Compass },
    {
      id: 'authorization' as const,
      label: 'Satış Yetkisi Panosu',
      icon: BadgeCheck,
    },
    { id: 'portfolios' as const, label: 'Portföylerimiz', icon: Layers3 },
  ];

  return (
    <div className={`${styles.page} ${redesign.shell}`} data-avci-shell>
      <Toaster position="bottom-right" />

      <div
        className={styles.tabs}
        data-avci-tabs
        role="tablist"
        aria-label="AI Portföy Uzmanı bölümleri"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            aria-controls={`panel-${id}`}
            aria-selected={activeView === id}
            className={activeView === id ? styles.activeTab : styles.tab}
            id={`tab-${id}`}
            key={id}
            onClick={() => setActiveView(id)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <section
        aria-labelledby="statistics-period-title"
        className={styles.statsToolbar}
        data-avci-period
      >
        <div className={styles.statsToolbarCopy}>
          <span className={styles.statsToolbarIcon}>
            <CalendarDays aria-hidden="true" />
          </span>
          <span>
            <strong id="statistics-period-title">Analiz Dönemi</strong>
            <small aria-live="polite">
              {activeRange.description} içinde eklenen kayıtlar
            </small>
          </span>
        </div>
        <div
          aria-label="İstatistik tarih aralığı"
          className={styles.rangeSelector}
          data-avci-range
          role="group"
        >
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              aria-pressed={timeRange === option.id}
              className={
                timeRange === option.id
                  ? styles.activeRangeButton
                  : styles.rangeButton
              }
              key={option.id}
              onClick={() => {
                setTimeRange(option.id);
                setRangeAnchor(Date.now());
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section
        className={styles.metrics}
        data-avci-metrics
        aria-label="Portföy uzmanı özeti"
      >
        {[
          {
            label: 'Tespit edilen portföyler',
            value: counts.total,
            icon: Layers3,
            documentHref: null,
            info: null,
          },
          {
            label: 'Aktif & Olumlu portföy Görüşmeleri',
            value: counts.negotiation,
            icon: Sparkles,
            documentHref: null,
            info: null,
          },
          {
            label: 'Yetki onayı alınan portföyler',
            value: counts.authorized,
            icon: ShieldCheck,
            documentHref: '/fabrika/belgeler',
            info: null,
          },
          {
            label: 'Yetkili portföyler',
            value: counts.joined,
            icon: CheckCircle2,
            documentHref: null,
            info: 'Satış yetkisini aldığınız portföyler.',
          },
        ].map((metric) => (
          <article
            className={styles.metricCard}
            data-avci-metric
            key={metric.label}
          >
            <metric.icon aria-hidden="true" />
            <span>
              <span className={styles.metricLabelRow}>
                <small>{metric.label}</small>
                {metric.documentHref && (
                  <Link
                    aria-label="Satış yetkisi belgesi oluştur"
                    className={styles.metricDocumentAction}
                    href={metric.documentHref}
                    title="Belge oluştur"
                  >
                    <FilePlus2 aria-hidden="true" />
                  </Link>
                )}
                {metric.info && (
                  <span
                    aria-label={metric.info}
                    className={styles.metricInfo}
                    data-tooltip={metric.info}
                    role="img"
                    tabIndex={0}
                  >
                    <Info aria-hidden="true" />
                  </span>
                )}
              </span>
              <strong>{metric.value}</strong>
            </span>
          </article>
        ))}
      </section>

      {activeView === 'discover' && (
        <section
          aria-labelledby="tab-discover"
          className={styles.workspace}
          data-avci-workspace
          id="panel-discover"
          role="tabpanel"
        >
          <div className={styles.discoveryWorkspace} data-avci-discovery>
            <AvciV2Workspace />
          </div>
          <ImportedListingsSummary
            listings={periodListings}
            periodLabel={activeRange.description}
          />
        </section>
      )}

      {activeView === 'authorization' && (
        <section
          aria-labelledby="tab-authorization"
          className={styles.workspace}
          id="panel-authorization"
          role="tabpanel"
        >
          <div className={styles.infoBanner}>
            <ShieldCheck aria-hidden="true" />
            <p>
              Her durum değişikliği şirket hesabına bağlı denetim kaydıyla
              saklanır. İletişim ancak doğrulanmış izin ve insan onayı sonrasında
              başlatılabilir.
            </p>
          </div>
          {loadingBoard ? (
            <div className={styles.loadingPanel}>
              <Loader2 className="animate-spin" aria-hidden="true" /> Pano
              yükleniyor…
            </div>
          ) : periodListings.length === 0 ? (
            <div className={styles.emptyPanel}>
              <p>{activeRange.description} içinde eklenen portföy adayı yok.</p>
              <button onClick={() => setActiveView('discover')} type="button">
                Keşfe çık
              </button>
            </div>
          ) : (
            <div className={styles.boardWorkspace}>
              <StatusBoard
                listings={periodListings}
                onPortfolioJoin={handlePortfolioJoin}
                onStatusChange={handleStatusChange}
              />
            </div>
          )}
        </section>
      )}

      {activeView === 'portfolios' && (
        <section
          aria-labelledby="tab-portfolios"
          className={styles.workspace}
          id="panel-portfolios"
          role="tabpanel"
        >
          <PortfolioWorkspace
            listings={listings}
            onOpenAuthorizationBoard={() => setActiveView('authorization')}
          />
        </section>
      )}
    </div>
  );
}
