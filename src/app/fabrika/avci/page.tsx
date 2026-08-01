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
  Crosshair,
  Database,
  Download,
  FileArchive,
  Gem,
  Layers,
  Loader2,
  PhoneCall,
  Puzzle,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRoundCheck,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import AvciV2Workspace from '@/components/fabrika/avci-v2/AvciV2Workspace';
import StatusBoard from '@/components/fabrika/StatusBoard';
import styles from './avci.module.css';

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
  const [isImporting, setIsImporting] = useState(false);

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

  async function handleImportPackage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLocaleLowerCase('tr-TR');
    if (!lowerName.endsWith('.zip') && !lowerName.endsWith('.json')) {
      toast.error('Yalnızca eklentinin oluşturduğu ZIP veya JSON dosyası yüklenebilir.');
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
          `${result.ignoredSensitiveFieldCount} kayıttaki telefon alanı güvenlik nedeniyle içe alınmadı.`,
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

  return (
    <div className={styles.page}>
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

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>M2 · GÜVENLİ PORTFÖY KEŞFİ</p>
          <div className={styles.titleRow}>
            <span className={styles.titleIcon} aria-hidden="true">
              <Crosshair />
            </span>
            <div>
              <h1>Avcı v2</h1>
              <p>
                Yasal olarak izin verilen ilan kaynaklarını içe aktarın,
                veriyi zenginleştirin ve iletişim öncesinde insan onayından
                geçirin.
              </p>
            </div>
          </div>
        </div>

        <div className={styles.heroOperations}>
          <div className={styles.planRow}>
            <span className={styles.paidBadge}>
              <Gem aria-hidden="true" /> Ücretli modül
            </span>
            <span className={styles.planBadge}>
              Plan: Growth <i aria-hidden="true" /> Aktif
            </span>
            <button
              className={styles.refreshButton}
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

          <div className={styles.pipeline} aria-label="Avcı veri işleme hattı">
            {[
              { icon: Database, label: 'Kaynak', value: counts.total },
              { icon: SearchCheck, label: 'Detay', value: counts.yellow },
              {
                icon: ShieldCheck,
                label: 'Doğrulama',
                value: counts.authorized,
              },
              {
                icon: UserRoundCheck,
                label: 'İnsan onayı',
                value: counts.green,
              },
            ].map((step, index) => (
              <div className={styles.pipelineStep} key={step.label}>
                <span className={styles.pipelineIcon}>
                  <step.icon aria-hidden="true" />
                </span>
                <span>
                  <small>{step.label}</small>
                  <strong>{step.value}</strong>
                </span>
                {index < 3 && <i aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Avcı özet metrikleri">
        {[
          {
            icon: Layers,
            label: 'Toplanan ilan',
            value: counts.total,
            tone: 'neutral',
          },
          {
            icon: Sparkles,
            label: 'İnceleme bekleyen',
            value: counts.yellow,
            tone: 'warning',
          },
          {
            icon: PhoneCall,
            label: 'İletişime hazır',
            value: counts.authorized,
            tone: 'success',
          },
          {
            icon: BadgeCheck,
            label: 'Satış yetkisi',
            value: counts.authorized,
            tone: 'success',
          },
          {
            icon: CheckCircle2,
            label: 'Portföye katıldı',
            value: counts.green,
            tone: 'info',
          },
        ].map((metric) => (
          <article
            className={styles.metricCard}
            data-tone={metric.tone}
            key={metric.label}
          >
            <span className={styles.metricIcon}>
              <metric.icon aria-hidden="true" />
            </span>
            <span>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
            </span>
          </article>
        ))}
      </section>

      <nav className={styles.tabs} aria-label="Avcı çalışma alanı">
        {[
          {
            id: 'kesif' as const,
            label: 'Keşif ve ilanlar',
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
            aria-current={activeView === id ? 'page' : undefined}
            className={activeView === id ? styles.activeTab : styles.tab}
            key={id}
            onClick={() => setActiveView(id)}
            type="button"
          >
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>

      {activeView === 'kesif' && (
        <div className={styles.discoveryWorkspace}>
          <AvciV2Workspace />
        </div>
      )}

      {activeView === 'pano' && (
        <div className={styles.boardWorkspace}>
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
        <section className={`${styles.extensionWorkspace} rounded-xl border border-slate-800 bg-slate-900 p-5 sm:p-7`}>
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

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300">
                    <Download className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Business CEO AI Avcı eklentisini kurun
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Paketi indirin, ZIP&apos;i klasöre çıkarın ve Chrome
                      uzantılar ekranından klasörü yükleyin.
                    </p>
                  </div>
                </div>
                <ol className="mt-4 space-y-2 text-xs leading-5 text-slate-400">
                  <li>1. Aşağıdaki kurulum paketini indirin ve arşivden çıkarın.</li>
                  <li>
                    2. Chrome&apos;da{' '}
                    <code className="rounded bg-slate-900 px-1.5 py-0.5 text-slate-300">
                      chrome://extensions
                    </code>{' '}
                    adresini açın.
                  </li>
                  <li>
                    3. Geliştirici modunu açıp “Paketlenmemiş öğe yükle” ile{' '}
                    <strong className="font-semibold text-slate-300">
                      jasmine-extension
                    </strong>{' '}
                    klasörünü seçin.
                  </li>
                </ol>
                <a
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-xs font-bold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  download
                  href="/downloads/jasmine-extension.zip"
                >
                  <Download className="h-4 w-4" />
                  Eklentiyi indir
                </a>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-5">
                <div className="flex items-start gap-3">
                  <span className="rounded-lg bg-sky-500/10 p-2 text-sky-300">
                    <FileArchive className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Toplanan ilan paketini yükleyin
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Eklentinin dışa aktardığı en fazla 10 MB boyutundaki ZIP
                      veya JSON dosyasını Avcı&apos;ya alın.
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 p-4 text-center">
                  <p className="text-xs leading-5 text-slate-400">
                    Eklenti kurulum ZIP&apos;i burada kullanılmaz. Yalnızca
                    ilanları içeren dışa aktarma paketini seçin.
                  </p>
                  <label
                    className={`mt-3 inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 text-xs font-bold text-sky-200 transition hover:bg-sky-500/15 focus-within:ring-2 focus-within:ring-sky-300 ${
                      isImporting ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    {isImporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UploadCloud className="h-4 w-4" />
                    )}
                    {isImporting ? 'İlanlar aktarılıyor…' : 'ZIP / JSON seç'}
                    <input
                      accept=".zip,.json,application/zip,application/json"
                      className="sr-only"
                      disabled={isImporting}
                      onChange={(event) => void handleImportPackage(event)}
                      type="file"
                    />
                  </label>
                </div>
              </div>
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
