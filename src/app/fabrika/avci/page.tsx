'use client';

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Compass,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import AvciV2Workspace from '@/components/fabrika/avci-v2/AvciV2Workspace';
import StatusBoard from '@/components/fabrika/StatusBoard';
import { ExtensionImportPanel } from '@/components/fabrika/portfolio-specialist/ExtensionImportPanel';
import { ImportedListingsSummary } from '@/components/fabrika/portfolio-specialist/ImportedListingsSummary';
import { PortfolioWorkspace } from '@/components/fabrika/portfolio-specialist/PortfolioWorkspace';
import { QuickPortfolioWizardLauncher } from '@/components/fabrika/portfolio-specialist/QuickPortfolioWizardLauncher';
import type {
  HuntingListing,
  HuntingStatus,
} from '@/components/fabrika/portfolio-specialist/types';
import styles from './avci.module.css';

type ActiveView = 'discover' | 'authorization' | 'portfolios';

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
  const [listings, setListings] = useState<HuntingListing[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

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

  const counts = useMemo(
    () => ({
      total: listings.length,
      negotiation: listings.filter((listing) => listing.status === 'YELLOW')
        .length,
      authorized: listings.filter(
        (listing) => listing.status === 'AUTHORIZED'
      ).length,
      joined: listings.filter((listing) => listing.status === 'GREEN').length,
    }),
    [listings]
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

  async function handleImportPackage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLocaleLowerCase('tr-TR');
    if (!lowerName.endsWith('.zip') && !lowerName.endsWith('.json')) {
      toast.error(
        'Yalnızca eklentinin oluşturduğu ZIP veya JSON dosyası yüklenebilir.'
      );
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('İçe aktarma dosyası en fazla 10 MB olabilir.');
      input.value = '';
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const result = await apiJson<{
        added: number;
        skipped: number;
        ignoredSensitiveFieldCount: number;
      }>('/api/fabrika/hunting/bulk-import', {
        method: 'POST',
        body: formData,
      });
      toast.success(
        `${result.added} ilan eklendi${
          result.skipped ? `, ${result.skipped} tekrar atlandı` : ''
        }.`
      );
      if (result.ignoredSensitiveFieldCount > 0) {
        toast(
          `${result.ignoredSensitiveFieldCount} kayıttaki hassas alan güvenlik politikası gereği içe alınmadı.`,
          { icon: 'ℹ️' }
        );
      }
      await fetchListings();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'İlan paketi yüklenemedi.'
      );
    } finally {
      setIsImporting(false);
      input.value = '';
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
    <div className={styles.page}>
      <Toaster position="bottom-right" />

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>AI PORTFÖY UZMANI</p>
          <h1>Portföy keşfinden yayına kadar tek akış</h1>
          <p>
            İzinli kaynaklardan gelen ilanları inceleyin, satış yetkisi sürecini
            yönetin ve doğrulanmış portföyleri şirket sitenizde yayınlayın.
          </p>
        </div>
        <div className={styles.heroActions}>
          <QuickPortfolioWizardLauncher />
          <button
            className={styles.refreshButton}
            disabled={loadingBoard}
            onClick={() => void fetchListings()}
            type="button"
          >
            <RefreshCw
              className={loadingBoard ? 'animate-spin' : ''}
              aria-hidden="true"
            />
            Yenile
          </button>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Portföy uzmanı özeti">
        {[
          { label: 'Toplam kayıt', value: counts.total, icon: Layers3 },
          { label: 'Sıcak pazarlık', value: counts.negotiation, icon: Sparkles },
          { label: 'Satış yetkisi', value: counts.authorized, icon: ShieldCheck },
          { label: 'Portföye katıldı', value: counts.joined, icon: CheckCircle2 },
        ].map((metric) => (
          <article className={styles.metricCard} key={metric.label}>
            <metric.icon aria-hidden="true" />
            <span>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
            </span>
          </article>
        ))}
      </section>

      <div className={styles.tabs} role="tablist" aria-label="AI Portföy Uzmanı bölümleri">
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

      {activeView === 'discover' && (
        <section
          aria-labelledby="tab-discover"
          className={styles.workspace}
          id="panel-discover"
          role="tabpanel"
        >
          <div className={styles.discoveryWorkspace}>
            <AvciV2Workspace />
          </div>
          <ExtensionImportPanel
            isImporting={isImporting}
            onImport={handleImportPackage}
          />
          <ImportedListingsSummary listings={listings} />
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
              Her durum değişikliği şirket hesabına bağlı denetim kaydıyla saklanır.
              İletişim ancak doğrulanmış izin ve insan onayı sonrasında başlatılabilir.
            </p>
          </div>
          {loadingBoard ? (
            <div className={styles.loadingPanel}>
              <Loader2 className="animate-spin" aria-hidden="true" /> Pano yükleniyor…
            </div>
          ) : listings.length === 0 ? (
            <div className={styles.emptyPanel}>
              <p>Panoya eklenmiş portföy adayı yok.</p>
              <button onClick={() => setActiveView('discover')} type="button">
                Keşfe çık
              </button>
            </div>
          ) : (
            <div className={styles.boardWorkspace}>
              <StatusBoard
                listings={listings}
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
