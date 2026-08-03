'use client';

import { Player } from '@remotion/player';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  Download,
  Film,
  ImageIcon,
  Loader2,
  MapPin,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LocalRuleCreativeDirector } from '@/lib/portfolio-video/creative-director';
import {
  initialPortfolioVideoRenderState,
  portfolioVideoRenderReducer,
  toPortfolioVideoRenderError,
} from '@/lib/portfolio-video/render-state';
import { buildPortfolioStoryboard } from '@/lib/portfolio-video/storyboard';
import {
  portfolioVideoCatalogSchema,
  type PortfolioVideoCreativeChoice,
  type PortfolioVideoPortfolio,
} from '@/lib/portfolio-video/types';
import { PortfolioPromoVideo } from '@/remotion/portfolio-video/PortfolioPromoVideo';
import {
  PORTFOLIO_PROMO_VIDEO_DURATION,
  PORTFOLIO_PROMO_VIDEO_FPS,
  PORTFOLIO_PROMO_VIDEO_HEIGHT,
  PORTFOLIO_PROMO_VIDEO_ID,
  PORTFOLIO_PROMO_VIDEO_WIDTH,
} from '@/remotion/portfolio-video/constants';
import styles from './PortfolioVideoStudio.module.css';

const STYLE_OPTIONS: Array<{
  id: PortfolioVideoCreativeChoice;
  label: string;
  command: string;
  description: string;
}> = [
  { id: 'BOLD', label: 'Dikkat çekici', command: 'Dikkat çekici ve enerjik yap', description: 'Hızlı ve güçlü' },
  { id: 'CINEMATIC', label: 'Lüks', command: 'Lüks ve sinematik olsun', description: 'Zarif ve yavaş' },
  { id: 'FAMILY', label: 'Aile', command: 'Ailelere hitap etsin', description: 'Sıcak ve yaşam odaklı' },
  { id: 'INVESTMENT', label: 'Yatırım', command: 'Yatırım fırsatını ve getiriyi öne çıkar', description: 'Fiyat ve getiri odaklı' },
  { id: 'MINIMAL', label: 'Minimal', command: 'Sade ve minimal olsun', description: 'Az efektli ve temiz' },
  { id: 'CUSTOM', label: 'Özel', command: '', description: 'Aklınızdaki fikri yazın' },
];

function fileNameFor(portfolio: PortfolioVideoPortfolio) {
  const safe = portfolio.title
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
    .toLowerCase();
  return `${safe || 'portfoy'}-tanitim.mp4`;
}

function formatRemainingTime(value: number | null) {
  if (!value || !Number.isFinite(value)) return null;
  const seconds = Math.max(1, Math.round(value / 1000));
  if (seconds < 60) return `Yaklaşık ${seconds} sn`;
  return `Yaklaşık ${Math.ceil(seconds / 60)} dk`;
}

async function fetchPortfolioVideoCatalog() {
  const response = await fetch('/api/fabrika/studio/video/portfolios', {
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Portföyler yüklenemedi.');
  }
  return portfolioVideoCatalogSchema.parse({ portfolios: data.portfolios });
}

export default function PortfolioVideoStudio() {
  const director = useMemo(() => new LocalRuleCreativeDirector(), []);
  const [portfolios, setPortfolios] = useState<PortfolioVideoPortfolio[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState('');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [command, setCommand] = useState('Dikkat çekici ve enerjik yap');
  const [creativeChoice, setCreativeChoice] = useState<PortfolioVideoCreativeChoice>('BOLD');
  const [showPrice, setShowPrice] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [renderState, dispatchRender] = useReducer(
    portfolioVideoRenderReducer,
    initialPortfolioVideoRenderState
  );
  const abortControllerRef = useRef<AbortController | null>(null);
  const downloadUrlRef = useRef<string | null>(null);
  const commandInputRef = useRef<HTMLTextAreaElement | null>(null);

  const selectedPortfolio = useMemo(
    () => portfolios.find((portfolio) => portfolio.id === selectedPortfolioId) ?? null,
    [portfolios, selectedPortfolioId]
  );

  const direction = useMemo(
    () => director.direct({
      command,
      preferredStyle: creativeChoice === 'CUSTOM' ? undefined : creativeChoice,
    }),
    [command, creativeChoice, director]
  );

  const storyboard = useMemo(() => {
    if (!selectedPortfolio) return null;
    return buildPortfolioStoryboard({
      portfolio: selectedPortfolio,
      direction,
      selectedPhotoIds,
      showPrice: showPrice && direction.showPrice,
      showLocation,
    });
  }, [direction, selectedPhotoIds, selectedPortfolio, showLocation, showPrice]);

  async function retryCatalog() {
    setIsLoading(true);
    setLoadError('');
    try {
      const parsed = await fetchPortfolioVideoCatalog();
      setPortfolios(parsed.portfolios);
      const first = parsed.portfolios[0];
      setSelectedPortfolioId(first?.id ?? '');
      setSelectedPhotoIds(first?.photos.slice(0, 6).map((photo) => photo.id) ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Portföyler yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetchPortfolioVideoCatalog()
      .then((parsed) => {
        if (!active) return;
        setPortfolios(parsed.portfolios);
        const first = parsed.portfolios[0];
        setSelectedPortfolioId(first?.id ?? '');
        setSelectedPhotoIds(first?.photos.slice(0, 6).map((photo) => photo.id) ?? []);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Portföyler yüklenemedi.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
    };
  }, []);

  function chooseStyle(option: (typeof STYLE_OPTIONS)[number]) {
    setCreativeChoice(option.id);
    setCommand(option.command);
    if (option.id === 'CUSTOM') {
      requestAnimationFrame(() => commandInputRef.current?.focus());
    }
  }

  function selectPortfolio(portfolioId: string) {
    const portfolio = portfolios.find((item) => item.id === portfolioId);
    setSelectedPortfolioId(portfolioId);
    setSelectedPhotoIds(portfolio?.photos.slice(0, 6).map((photo) => photo.id) ?? []);
    dispatchRender({ type: 'RESET' });
  }

  function togglePhoto(photoId: string) {
    setSelectedPhotoIds((current) => {
      if (current.includes(photoId)) return current.filter((id) => id !== photoId);
      if (current.length >= 8) return current;
      return [...current, photoId];
    });
  }

  function movePhoto(photoId: string, directionValue: -1 | 1) {
    setSelectedPhotoIds((current) => {
      const index = current.indexOf(photoId);
      const target = index + directionValue;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function renderVideo() {
    if (!storyboard || !selectedPortfolio || selectedPhotoIds.length === 0) return;
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }
    dispatchRender({ type: 'CHECK' });
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import(
        '@remotion/web-renderer'
      );
      const support = await canRenderMediaOnWeb({
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: null,
        width: PORTFOLIO_PROMO_VIDEO_WIDTH,
        height: PORTFOLIO_PROMO_VIDEO_HEIGHT,
        muted: true,
      });
      if (!support.canRender) {
        throw new Error(support.issues.map((issue) => `${issue.type}: ${issue.message}`).join('; '));
      }
      if (controller.signal.aborted) return;
      dispatchRender({ type: 'START' });
      const result = await renderMediaOnWeb({
        composition: {
          id: PORTFOLIO_PROMO_VIDEO_ID,
          component: PortfolioPromoVideo,
          defaultProps: { storyboard },
          durationInFrames: PORTFOLIO_PROMO_VIDEO_DURATION,
          fps: PORTFOLIO_PROMO_VIDEO_FPS,
          width: PORTFOLIO_PROMO_VIDEO_WIDTH,
          height: PORTFOLIO_PROMO_VIDEO_HEIGHT,
        },
        inputProps: { storyboard },
        container: 'mp4',
        videoCodec: 'h264',
        audioCodec: null,
        muted: true,
        pageResponsiveness: 'medium',
        signal: controller.signal,
        onProgress: ({ progress, renderEstimatedTime }) => {
          dispatchRender({
            type: 'PROGRESS',
            progress,
            estimatedTimeMs: renderEstimatedTime,
          });
        },
      });
      let blob: Blob;
      try {
        blob = await result.getBlob();
      } finally {
        result.internalState[Symbol.dispose]();
      }
      if (controller.signal.aborted) return;
      const downloadUrl = URL.createObjectURL(blob);
      downloadUrlRef.current = downloadUrl;
      dispatchRender({ type: 'SUCCESS', downloadUrl });
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        dispatchRender({ type: 'CANCEL' });
      } else {
        dispatchRender({ type: 'ERROR', error: toPortfolioVideoRenderError(error) });
      }
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  }

  function cancelRender() {
    abortControllerRef.current?.abort();
    dispatchRender({ type: 'CANCEL' });
  }

  const isRendering = ['CHECKING', 'RENDERING'].includes(renderState.status);
  const selectedPhotos = selectedPhotoIds
    .map((id) => selectedPortfolio?.photos.find((photo) => photo.id === id))
    .filter(Boolean) as NonNullable<PortfolioVideoPortfolio['photos'][number]>[];

  if (isLoading) {
    return (
      <div className={styles.loadingPanel} role="status">
        <Loader2 aria-hidden="true" /> Portföyler hazırlanıyor…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.errorPanel} role="alert">
        <b>Video stüdyosu açılamadı</b>
        <span>{loadError}</span>
        <button type="button" onClick={() => void retryCatalog()}><RotateCcw /> Yeniden dene</button>
      </div>
    );
  }

  if (!portfolios.length) {
    return (
      <div className={styles.emptyPanel}>
        <Film aria-hidden="true" />
        <h2>Önce bir portföy ekleyin</h2>
        <p>Video oluşturmak için şirket hesabınızda taslak veya aktif bir portföy bulunmalıdır.</p>
        <a href="/fabrika/portfoyler">Portföylere git</a>
      </div>
    );
  }

  return (
    <section className={styles.videoStudio} aria-labelledby="portfolio-video-title">
      <header className={styles.videoHeader}>
        <div>
          <span><Clapperboard /> Tarayıcıda MP4</span>
          <h2 id="portfolio-video-title">Portföy Video Stüdyosu</h2>
          <p>Portföy verilerinizden 15 saniyelik dikey tanıtım videosu hazırlayın.</p>
        </div>
        <div className={styles.specs} aria-label="Video teknik özellikleri">
          <span>9:16</span><span>1080p</span><span>15 sn</span>
        </div>
      </header>

      <div className={styles.workspaceGrid}>
        <div className={styles.controlsColumn}>
          <section className={styles.card}>
            <div className={styles.sectionTitle}><span>1</span><div><h3>Portföyü seçin</h3><p>Yalnızca şirket hesabınızdaki kayıtlar listelenir.</p></div></div>
            <label className={styles.fieldLabel} htmlFor="video-portfolio">Portföy</label>
            <select
              id="video-portfolio"
              className={styles.select}
              value={selectedPortfolioId}
              onChange={(event) => selectPortfolio(event.target.value)}
            >
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>{portfolio.title}</option>
              ))}
            </select>
            {selectedPortfolio && (
              <div className={styles.portfolioSummary}>
                <div><b>{selectedPortfolio.title}</b><span><MapPin /> {selectedPortfolio.location || 'Konum belirtilmedi'}</span></div>
                <small>{selectedPortfolio.photos.length} fotoğraf</small>
              </div>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionTitle}><span>2</span><div><h3>Yaratıcı yönü belirleyin</h3><p>Hazır bir stil seçin veya Türkçe komutunuzu yazın.</p></div></div>
            <div className={styles.styleGrid} role="group" aria-label="Video stili">
              {STYLE_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={creativeChoice === option.id ? styles.styleActive : undefined}
                  aria-pressed={creativeChoice === option.id}
                  onClick={() => chooseStyle(option)}
                >
                  <b>{option.label}</b><span>{option.description}</span>
                </button>
              ))}
            </div>
            <label className={styles.fieldLabel} htmlFor="video-command">
              {creativeChoice === 'CUSTOM' ? 'Özel yaratıcı talimatınız' : 'Video komutu'}
            </label>
            <textarea
              ref={commandInputRef}
              id="video-command"
              className={styles.command}
              value={command}
              maxLength={1000}
              rows={4}
              onChange={(event) => {
                setCommand(event.target.value);
                setCreativeChoice('CUSTOM');
              }}
              placeholder={creativeChoice === 'CUSTOM'
                ? 'Örn. İlk karede havuzu göster, sakin başlayıp son bölümde iletişim bilgilerini öne çıkar; fiyatı gösterme.'
                : 'Örn. Lüks ve sinematik olsun, fiyatı gösterme'}
            />
            <div className={styles.commandMeta}>
              <span><Sparkles /> {direction.style === 'BOLD' ? 'Hızlı ve güçlü' : direction.style === 'CINEMATIC' ? 'Zarif ve yavaş' : direction.style === 'FAMILY' ? 'Sıcak ve yaşam odaklı' : direction.style === 'INVESTMENT' ? 'Yatırım odaklı' : direction.style === 'MINIMAL' ? 'Az efektli' : 'Dengeli'}</span>
              <small>{command.length}/1000</small>
            </div>
            {creativeChoice === 'CUSTOM' && (
              <p className={styles.inlineNote}>
                Portföy fotoğrafları ve kayıtlı bilgiler otomatik kullanılır; buraya yalnızca videonun nasıl görünmesini istediğinizi yazın.
              </p>
            )}
            <div className={styles.toggles}>
              <label>
                <input type="checkbox" checked={showPrice && direction.showPrice} disabled={!direction.showPrice} onChange={(event) => setShowPrice(event.target.checked)} />
                <span>Fiyatı göster</span>
              </label>
              <label>
                <input type="checkbox" checked={showLocation} onChange={(event) => setShowLocation(event.target.checked)} />
                <span>Konumu göster</span>
              </label>
            </div>
            {!direction.showPrice && <p className={styles.inlineNote}>Komutunuzdaki “fiyatı gösterme” talimatı uygulanıyor.</p>}
          </section>

          <section className={styles.card}>
            <div className={styles.sectionTitle}><span>3</span><div><h3>Fotoğrafları seçin ve sıralayın</h3><p>En fazla 8 fotoğraf. İlk fotoğraf açılış sahnesidir.</p></div></div>
            {selectedPortfolio?.photos.length ? (
              <>
                <div className={styles.photoGrid}>
                  {selectedPortfolio.photos.map((photo) => {
                    const selectedIndex = selectedPhotoIds.indexOf(photo.id);
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        aria-pressed={selectedIndex >= 0}
                        aria-label={`${photo.fileName} ${selectedIndex >= 0 ? 'seçimini kaldır' : 'seç'}`}
                        onClick={() => togglePhoto(photo.id)}
                      >
                        {/* Tenant tarafından yetkilendirilmiş medya URL'si. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt="" />
                        {selectedIndex >= 0 && <span>{selectedIndex + 1}<Check /></span>}
                      </button>
                    );
                  })}
                </div>
                <ol className={styles.photoOrder} aria-label="Seçilen fotoğraf sırası">
                  {selectedPhotos.map((photo, index) => (
                    <li key={photo.id}>
                      <span>{index + 1}</span>
                      <div><ImageIcon /><b>{photo.fileName}</b></div>
                      <div>
                        <button type="button" disabled={index === 0} onClick={() => movePhoto(photo.id, -1)} aria-label={`${photo.fileName} yukarı taşı`}><ArrowUp /></button>
                        <button type="button" disabled={index === selectedPhotos.length - 1} onClick={() => movePhoto(photo.id, 1)} aria-label={`${photo.fileName} aşağı taşı`}><ArrowDown /></button>
                        <button type="button" onClick={() => togglePhoto(photo.id)} aria-label={`${photo.fileName} seçimini kaldır`}><X /></button>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <div className={styles.noPhotos}><ImageIcon /><p>Bu portföyde kullanılabilir fotoğraf yok. Portföy medya alanından fotoğraf ekleyin.</p></div>
            )}
          </section>
        </div>

        <aside className={styles.previewColumn}>
          <section className={styles.previewCard}>
            <div className={styles.previewTitle}><div><h3>Canlı önizleme</h3><p>Değişiklikler anında videoya uygulanır.</p></div><span>{direction.style}</span></div>
            <div className={styles.playerFrame}>
              {storyboard && (
                <Player
                  component={PortfolioPromoVideo}
                  inputProps={{ storyboard }}
                  durationInFrames={PORTFOLIO_PROMO_VIDEO_DURATION}
                  fps={PORTFOLIO_PROMO_VIDEO_FPS}
                  compositionWidth={PORTFOLIO_PROMO_VIDEO_WIDTH}
                  compositionHeight={PORTFOLIO_PROMO_VIDEO_HEIGHT}
                  controls
                  loop
                  initiallyMuted
                  acknowledgeRemotionLicense
                  style={{ width: '100%', height: '100%' }}
                />
              )}
            </div>
          </section>

          <section className={styles.renderCard}>
            <div className={styles.renderHeading}><Film /><div><h3>MP4 oluştur</h3><p>Video cihazınızda hazırlanır; fotoğraflar render için başka bir sunucuya yüklenmez.</p></div></div>
            {renderState.status !== 'IDLE' && (
              <div className={styles.renderStatus} aria-live="polite">
                {renderState.status === 'ERROR' ? (
                  <div className={styles.renderError} role="alert"><b>Video oluşturulamadı</b><span>{renderState.error}</span></div>
                ) : renderState.status === 'CANCELLED' ? (
                  <div className={styles.renderCancelled}>İşlem iptal edildi. Ayarlarınız korunuyor.</div>
                ) : renderState.status === 'SUCCESS' ? (
                  <div className={styles.renderSuccess}><Check /> Video hazır. MP4 dosyasını indirebilirsiniz.</div>
                ) : (
                  <>
                    <div className={styles.progressLabels}><span>{renderState.status === 'CHECKING' ? 'Tarayıcı kontrol ediliyor…' : 'Video oluşturuluyor…'}</span><b>{Math.round(renderState.progress * 100)}%</b></div>
                    <div className={styles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(renderState.progress * 100)}><span style={{ width: `${renderState.progress * 100}%` }} /></div>
                    {formatRemainingTime(renderState.estimatedTimeMs) && <small>{formatRemainingTime(renderState.estimatedTimeMs)}</small>}
                  </>
                )}
              </div>
            )}
            <div className={styles.renderActions}>
              {isRendering ? (
                <button type="button" className={styles.cancelButton} onClick={cancelRender}><Square /> İptal et</button>
              ) : (
                <button type="button" className={styles.renderButton} disabled={!storyboard || selectedPhotoIds.length === 0} onClick={() => void renderVideo()}>
                  {renderState.status === 'SUCCESS' ? <RotateCcw /> : <Clapperboard />}
                  {renderState.status === 'SUCCESS' ? 'Yeniden oluştur' : 'MP4 oluştur'}
                </button>
              )}
              {renderState.status === 'SUCCESS' && renderState.downloadUrl && selectedPortfolio && (
                <a className={styles.downloadButton} href={renderState.downloadUrl} download={fileNameFor(selectedPortfolio)}><Download /> MP4 indir</a>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
