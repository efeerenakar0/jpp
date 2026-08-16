'use client';

import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  CirclePause,
  Compass,
  Crosshair,
  FileText,
  Gauge,
  ImageIcon,
  Layers3,
  MapPin,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';
import avciStyles from '@/app/fabrika/avci/avci.module.css';
import {
  getHuntPropertyLabel,
  HuntCategoryPicker,
  normalizeHuntQuotaResponse,
} from '@/components/fabrika/avci-v2/HuntQuotaGuide';
import type { HuntPropertyType } from '@/lib/hunting-v2/property-types';
import styles from './preview.module.css';

const MOCK_QUOTAS = normalizeHuntQuotaResponse({
  items: [
    { propertyType: 'KONUT', perRunLimit: 50, monthlyLimit: 500, used: 80, remaining: 420 },
    { propertyType: 'ISYERI', perRunLimit: 5, monthlyLimit: 15, used: 5, remaining: 10 },
    { propertyType: 'ARSA', perRunLimit: 5, monthlyLimit: 15, used: 0, remaining: 15 },
    { propertyType: 'KONUT_PROJELERI', perRunLimit: 5, monthlyLimit: 15, used: 10, remaining: 5 },
    { propertyType: 'BINA', perRunLimit: 5, monthlyLimit: 15, used: 5, remaining: 10 },
    { propertyType: 'DEVREN_MULK', perRunLimit: 5, monthlyLimit: 15, used: 0, remaining: 15 },
    { propertyType: 'TURISTIK_TESIS', perRunLimit: 5, monthlyLimit: 15, used: 5, remaining: 10 },
  ],
});

const MOCK_LISTINGS = [
  {
    id: 'preview-1',
    title: 'Deniz manzaralı geniş balkonlu 3+1 daire',
    location: 'Antalya / Alanya / Kestel',
    price: '8.500.000 TL',
    completeness: 94,
    status: 'İletişime hazır',
    accent: 'cyan',
  },
  {
    id: 'preview-2',
    title: 'Site içerisinde yatırımlık eşyalı 1+1',
    location: 'Antalya / Alanya / Mahmutlar',
    price: '4.750.000 TL',
    completeness: 86,
    status: 'İzin kontrolü gerekli',
    accent: 'emerald',
  },
  {
    id: 'preview-3',
    title: 'Merkezi konumda müstakil bahçeli villa',
    location: 'Antalya / Alanya / Oba',
    price: '17.900.000 TL',
    completeness: 78,
    status: 'İnsan onayı bekliyor',
    accent: 'amber',
  },
] as const;

type PreviewMode = 'READY' | 'RUNNING';

export function LocalAvciPreview() {
  const [selectedType, setSelectedType] = useState<HuntPropertyType>('KONUT');
  const [mode, setMode] = useState<PreviewMode>('READY');
  const [query, setQuery] = useState('');
  const quota = MOCK_QUOTAS.find((item) => item.propertyType === selectedType)!;
  const isRunning = mode === 'RUNNING';
  const foundCount = isRunning ? Math.min(28, quota.perRunLimit) : quota.perRunLimit;
  const progress = isRunning ? 56 : 100;
  const filteredListings = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('tr-TR');
    if (!normalized) return MOCK_LISTINGS;
    return MOCK_LISTINGS.filter((listing) =>
      `${listing.title} ${listing.location}`
        .toLocaleLowerCase('tr-TR')
        .includes(normalized)
    );
  }, [query]);

  return (
    <main className={styles.previewPage}>
      <section aria-label="Yerel önizleme kontrolleri" className={styles.previewBar}>
        <span className={styles.previewIdentity}>
          <span className={styles.previewPulse} />
          Yalnız localhost · Tamamen örnek veri
        </span>
        <div className={styles.previewActions} role="group" aria-label="Önizleme durumu">
          <button
            aria-pressed={!isRunning}
            className={!isRunning ? styles.previewActionActive : styles.previewAction}
            onClick={() => setMode('READY')}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" /> Hazır görünüm
          </button>
          <button
            aria-pressed={isRunning}
            className={isRunning ? styles.previewActionActive : styles.previewAction}
            onClick={() => setMode('RUNNING')}
            type="button"
          >
            <CirclePause aria-hidden="true" /> Aktif tarama
          </button>
        </div>
      </section>

      <header className={styles.productHeader}>
        <span className={styles.productMark}>
          <Crosshair aria-hidden="true" />
        </span>
        <span>
          <small>BUSINESS CEO AI</small>
          <h1>AI Portföy Uzmanı</h1>
          <p>
            AI portföy uzmanı yeni portföy fırsatlarını keşfeder ve Sizin yerinize
            malikler ile konuşarak satış yetkisi almaya çalışır.
          </p>
        </span>
      </header>

      <div className={`${avciStyles.page} ${styles.appCanvas}`}>
        <nav aria-label="AI Portföy Uzmanı bölümleri" className={avciStyles.tabs}>
          <button className={avciStyles.activeTab} type="button">
            <Compass aria-hidden="true" /> Keşfe Çık
          </button>
          <button className={avciStyles.tab} type="button">
            <BadgeCheck aria-hidden="true" /> Satış Yetkisi Panosu
          </button>
          <button className={avciStyles.tab} type="button">
            <Layers3 aria-hidden="true" /> Portföylerimiz
          </button>
        </nav>

        <section aria-label="Portföy uzmanı özeti" className={avciStyles.metrics}>
          {[
            { label: 'Tespit edilen portföyler', value: 128, icon: Layers3 },
            { label: 'Aktif ve olumlu görüşmeler', value: 19, icon: Sparkles },
            { label: 'Yetki onayı alınanlar', value: 8, icon: ShieldCheck },
            { label: 'Yetkili portföyler', value: 6, icon: CheckCircle2 },
          ].map(({ label, value, icon: Icon }) => (
            <article className={avciStyles.metricCard} key={label}>
              <Icon aria-hidden="true" />
              <span>
                <small>{label}</small>
                <strong>{value}</strong>
              </span>
            </article>
          ))}
        </section>

        <section className={avciStyles.workspace}>
          <div className={avciStyles.discoveryWorkspace}>
            <section className={styles.huntGrid}>
              <div className={styles.panel}>
                <div className={styles.panelHeading}>
                  <span className={styles.headingIcon}><Search aria-hidden="true" /></span>
                  <span>
                    <h2>Satış yetkisini almak istediğiniz portföyleri belirleyin</h2>
                    <p>İl, ilçe ve gayrimenkul türünü seçip taramayı başlatın.</p>
                  </span>
                </div>

                <div className={styles.formStack} aria-disabled={isRunning}>
                  <fieldset className={styles.locationFieldset} disabled={isRunning}>
                    <legend>1. Nerede arıyorsunuz?</legend>
                    <div className={styles.locationGrid}>
                      <label>
                        <span><MapPin aria-hidden="true" /> İl</span>
                        <select defaultValue="antalya"><option value="antalya">Antalya</option></select>
                      </label>
                      <label>
                        <span>İlçe</span>
                        <select defaultValue="alanya"><option value="alanya">Alanya</option></select>
                      </label>
                    </div>
                    <p className={styles.locationNote}>
                      Mahalle gelen ilanların kendi adresinde gösterilir.
                    </p>
                  </fieldset>

                  <HuntCategoryPicker
                    disabled={isRunning}
                    onSelect={setSelectedType}
                    quotas={MOCK_QUOTAS}
                    selected={selectedType}
                  />
                  <div className={styles.startRail}>
                    <span>
                      <strong><UserRoundCheck aria-hidden="true" /> Kimden: Sahibinden Satıcılar</strong>
                    </span>
                    <button
                      disabled={isRunning}
                      onClick={() => setMode('RUNNING')}
                      type="button"
                    >
                      <Play aria-hidden="true" />
                      {isRunning ? 'Tarama devam ediyor' : `${quota.perRunLimit} ilanı taramaya başla`}
                    </button>
                  </div>

                  {isRunning && (
                    <p className={styles.lockNotice} role="status">
                      Bu tarama bitmeden yeni tarama başlatılamaz; aynı işlem iki kez çalışmaz.
                    </p>
                  )}
                </div>
              </div>

              <aside className={styles.panel}>
                <div className={styles.jobHeader}>
                  <span className={isRunning ? styles.runningIcon : styles.completeIcon}>
                    {isRunning ? <Crosshair aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                  </span>
                  <span>
                    <strong>{isRunning ? 'İşleniyor' : 'Son tarama tamamlandı'}</strong>
                    <small>Örnek iş · {getHuntPropertyLabel(selectedType)}</small>
                  </span>
                </div>
                <div className={styles.progressCopy}>
                  <span>İşlenme ilerlemesi</span><strong>%{progress}</strong>
                </div>
                <div className={styles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <span style={{ width: `${progress}%` }} />
                </div>
                <dl className={styles.jobStats}>
                  <div><dt>Tarama hedefi</dt><dd>{quota.perRunLimit}</dd></div>
                  <div><dt>Bulunan</dt><dd>{foundCount}</dd></div>
                  <div><dt>Tamamlanan</dt><dd>{isRunning ? 23 : foundCount}</dd></div>
                  <div><dt>Hatalı</dt><dd>0</dd></div>
                </dl>
                <p className={styles.mockNote}>Bu karttaki ilerleme ve sayılar görsel kontrol için hazırlanmış örnek veridir.</p>
              </aside>
            </section>

            <section className={styles.resultsPanel}>
              <div className={styles.resultsHeader}>
                <span>
                  <h2>Keşfedilen ve İletişim Sürecine Alınan Portföyler</h2>
                  <p>Tarama sonucunu ve aylık hakkınızı aynı yerde görün.</p>
                </span>
                <label className={styles.searchBox}>
                  <Search aria-hidden="true" />
                  <span className="sr-only">Örnek ilanlarda ara</span>
                  <input
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Başlık veya konum ara"
                    value={query}
                  />
                </label>
              </div>

              <div className={styles.limitGrid} aria-label="Seçilen tarama sınırları">
                <span><Gauge aria-hidden="true" /><span><strong>{getHuntPropertyLabel(selectedType)}</strong>Bu tarama en fazla {quota.perRunLimit} ilan getirir.</span></span>
                <span><span><strong>Aylık kalan hak</strong>{quota.remaining} / {quota.monthlyLimit} ilan</span></span>
                <span><span><strong>Bu işin sonucu</strong>{foundCount} ilan bulundu</span></span>
              </div>

              {filteredListings.length ? (
                <div className={styles.listingGrid}>
                  {filteredListings.map((listing) => (
                    <article className={styles.listingCard} key={listing.id}>
                      <div className={`${styles.listingVisual} ${styles[listing.accent]}`}>
                        <ImageIcon aria-hidden="true" />
                        <span>{listing.status}</span>
                      </div>
                      <div className={styles.listingBody}>
                        <h3>{listing.title}</h3>
                        <p><MapPin aria-hidden="true" /> {listing.location}</p>
                        <div><strong>{listing.price}</strong><span>%{listing.completeness} tam</span></div>
                        <div className={styles.completeness}><span style={{ width: `${listing.completeness}%` }} /></div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyResults}>
                  <FileText aria-hidden="true" />
                  <strong>Bu aramaya uyan örnek ilan yok</strong>
                  <span>Başka bir başlık veya konum deneyin.</span>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
