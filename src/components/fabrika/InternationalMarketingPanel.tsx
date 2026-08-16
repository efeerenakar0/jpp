'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileText,
  Globe2,
  Languages,
  Loader2,
  MapPin,
  Megaphone,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  INTERNATIONAL_MARKETS,
  isVerifiedPortalLink,
  recommendInternationalPortal,
  type InternationalMarket,
  type InternationalMarketingPlan,
  type InternationalPortal,
} from '@/lib/international-marketing';
import { Button } from '@/components/ui/button';
import styles from './InternationalMarketingPanel.module.css';

type Property = {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  referenceCode: string | null;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  generatedBy: string | null;
  generatedModel: string | null;
  createdAt: string;
  property: Omit<Property, 'id'> & { id: string } | null;
  internationalPlan: InternationalMarketingPlan | null;
};

type Props = {
  properties: Property[];
  campaigns: Campaign[];
  loading: boolean;
  isOnline?: boolean;
  onGenerated: () => Promise<void>;
};

type FlowStep = 1 | 2 | 3;

type MarketWithOptionalMetadata = InternationalMarket & {
  currency?: string | null;
  timezone?: string | null;
  timeZone?: string | null;
  measurementSystem?: string | null;
  buyerFocus?: string | null;
  socialChannels?: string[] | null;
};

type PortalWithOptionalMetadata = InternationalPortal & {
  eligibilityNote?: string | null;
  lastVerifiedAt?: string | null;
  titleLimit?: number | null;
  descriptionLimit?: number | null;
  imageGuidance?: string | null;
  requiredFields?: string[] | null;
};

function portalEligibilityLabel(portal: InternationalPortal) {
  if (portal.eligibility === 'direct') return 'Türkiye ilanına uygun';
  if (portal.eligibility === 'membership') return 'Üyelik veya bağlantı gerekir';
  if (portal.eligibility === 'campaign_only') return 'Yalnız kampanya hazırlanır';
  if (portal.eligibility === 'unsupported') return 'Türkiye ilanına uygun değil';
  return 'Uygunluk doğrulanmalı';
}

function canOpenPublishing(portal: InternationalPortal) {
  return portal.eligibility === 'direct' || portal.eligibility === 'membership';
}

type GeneratedSnapshot = {
  id: string | null;
  name: string;
  generatedBy: string | null;
  createdAt: string;
  propertyTitle: string;
  plan: InternationalMarketingPlan;
};

const FLOW_STEPS: Array<{
  id: FlowStep;
  title: string;
  shortDescription: string;
}> = [
  { id: 1, title: 'Portföy', shortDescription: 'Tanıtılacak kayıt' },
  { id: 2, title: 'Ülke ve portal', shortDescription: 'Hedef pazar' },
  { id: 3, title: 'Hazır plan', shortDescription: 'Kontrol ve yayın' },
];

export function providerLabel(provider: string | null) {
  const normalized = (provider || '').trim().toUpperCase();
  if (
    !normalized ||
    normalized === 'RULE_ENGINE' ||
    normalized === 'DETERMINISTIC' ||
    normalized === 'FALLBACK'
  ) {
    return 'Doğrulanmış kurallarla hazırlandı';
  }
  return 'AI destekli';
}

function accountTypeLabel(accountType: InternationalPortal['accountType']) {
  if (accountType === 'professional') return 'Profesyonel hesap gerekli';
  if (accountType === 'individual') return 'Bireysel hesap';
  return 'Bireysel veya profesyonel hesap';
}

function money(value: number | null) {
  if (!value) return 'Fiyat bilgisi yok';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('tr-TR');
}

function searchable(value: string) {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} kopyalandı.`);
  } catch {
    toast.error('Metin kopyalanamadı. Tarayıcı iznini kontrol edin.');
  }
}

export default function InternationalMarketingPanel({
  properties,
  campaigns,
  loading,
  isOnline = true,
  onGenerated,
}: Props) {
  const [step, setStep] = useState<FlowStep>(1);
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [countryCode, setCountryCode] = useState('DE');
  const [portalId, setPortalId] = useState(
    recommendInternationalPortal(
      INTERNATIONAL_MARKETS.find((market) => market.code === 'DE') ||
        INTERNATIONAL_MARKETS[0],
    )?.id || '',
  );
  const [countryQuery, setCountryQuery] = useState('');
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [resultCampaignId, setResultCampaignId] = useState<string | null>(null);
  const [generatedSnapshot, setGeneratedSnapshot] =
    useState<GeneratedSnapshot | null>(null);

  const effectivePropertyId = propertyId || properties[0]?.id || '';
  const selectedProperty =
    properties.find((property) => property.id === effectivePropertyId) || null;

  const selectedMarket = (
    INTERNATIONAL_MARKETS.find((market) => market.code === countryCode) ||
    INTERNATIONAL_MARKETS[0]
  ) as MarketWithOptionalMetadata;
  const recommendedPortal = recommendInternationalPortal(selectedMarket) as
    | PortalWithOptionalMetadata
    | undefined;
  const selectedPortal = (
    selectedMarket.portals.find((portal) => portal.id === portalId) ||
    recommendedPortal
  ) as PortalWithOptionalMetadata | undefined;
  const alternativePortals = selectedMarket.portals.filter(
    (portal) => portal.id !== recommendedPortal?.id,
  ) as PortalWithOptionalMetadata[];

  const visibleCampaigns = campaigns
    .filter(
      (campaign) =>
        campaign.internationalPlan?.countryCode === selectedMarket.code,
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );

  const previousPortalCampaign =
    visibleCampaigns.find((campaign) =>
      campaign.property?.id === selectedProperty?.id &&
      campaign.internationalPlan?.portalCopies.some(
        (copy) => copy.portalId === selectedPortal?.id,
      ),
    ) || null;

  const storedResultCampaign = (() => {
    if (resultCampaignId) {
      const exact = campaigns.find(
        (campaign) => campaign.id === resultCampaignId,
      );
      if (exact) return exact;
    }
    return resultCampaignId ? null : previousPortalCampaign;
  })();

  const resultPlan =
    storedResultCampaign?.internationalPlan ||
    (generatedSnapshot?.plan.countryCode === selectedMarket.code
      ? generatedSnapshot.plan
      : null);
  const resultCopy =
    resultPlan?.portalCopies.find(
      (copy) => copy.portalId === selectedPortal?.id,
    ) || null;
  const resultProvider =
    storedResultCampaign?.generatedBy || generatedSnapshot?.generatedBy || null;
  const resultName =
    storedResultCampaign?.name ||
    generatedSnapshot?.name ||
    `${selectedMarket.country} ilan planı`;
  const resultDate =
    storedResultCampaign?.createdAt || generatedSnapshot?.createdAt || null;
  const resultPropertyTitle =
    storedResultCampaign?.property?.title ||
    generatedSnapshot?.propertyTitle ||
    selectedProperty?.title ||
    'Portföy';

  const normalizedQuery = searchable(countryQuery.trim());
  const matchingMarkets = INTERNATIONAL_MARKETS.filter((market) => {
    if (!normalizedQuery) return true;
    return (
      searchable(market.country).includes(normalizedQuery) ||
      market.code.toLocaleLowerCase('en-US').includes(normalizedQuery) ||
      searchable(market.language).includes(normalizedQuery)
    );
  });
  const visibleMarkets =
    normalizedQuery || showAllCountries
      ? matchingMarkets
      : matchingMarkets.slice(0, 6);

  const canOpenStepTwo = Boolean(selectedProperty);
  const canOpenStepThree = Boolean(resultPlan && resultCopy);

  function changeProperty(nextPropertyId: string) {
    setPropertyId(nextPropertyId);
    setResultCampaignId(null);
    setGeneratedSnapshot(null);
    setGenerationError(null);
  }

  function chooseMarket(market: InternationalMarket) {
    setCountryCode(market.code);
    setPortalId(recommendInternationalPortal(market)?.id || '');
    setShowAlternatives(false);
    setGenerationError(null);
    setResultCampaignId(null);
    setGeneratedSnapshot(null);
  }

  function choosePortal(nextPortalId: string) {
    setPortalId(nextPortalId);
    setGenerationError(null);
    setResultCampaignId(null);
    setGeneratedSnapshot(null);
  }

  function openExistingPlan(campaign: Campaign) {
    setResultCampaignId(campaign.id);
    setGeneratedSnapshot(null);
    setGenerationError(null);
    setStep(3);
  }

  async function generatePlan() {
    if (!isOnline) {
      setGenerationError(
        'İnternet bağlantısı yok. Bağlantı geldiğinde seçimleriniz kaybolmadan yeniden deneyebilirsiniz.',
      );
      return;
    }
    if (!selectedProperty) {
      setGenerationError('Devam etmek için önce aktif bir portföy seçin.');
      setStep(1);
      return;
    }
    if (!selectedPortal) {
      setGenerationError('Bu ülke için kullanılabilir bir portal bulunamadı.');
      return;
    }

    const requestProperty = selectedProperty;
    const requestMarket = selectedMarket;
    const requestPortal = selectedPortal;

    setGenerating(true);
    setGenerationError(null);
    try {
      const response = await fetch('/api/fabrika/marketing/international', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: requestProperty.id,
          countryCode: requestMarket.code,
          portalId: requestPortal.id,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        id?: string;
        name?: string;
        generatedBy?: string | null;
        createdAt?: string;
        internationalPlan?: InternationalMarketingPlan | null;
      };
      if (!response.ok) {
        throw new Error(
          body.error || 'Yurt dışı ilan planı hazırlanamadı.',
        );
      }

      if (body.internationalPlan) {
        setGeneratedSnapshot({
          id: body.id || null,
          name:
            body.name ||
            `${requestMarket.country} · ${requestProperty.title}`,
          generatedBy: body.generatedBy || null,
          createdAt: body.createdAt || new Date().toISOString(),
          propertyTitle: requestProperty.title,
          plan: body.internationalPlan,
        });
      }
      setResultCampaignId(body.id || null);
      setStep(3);
      toast.success(
        `${requestPortal.name} için ülkeye ve portala özel plan hazır.`,
      );
      void onGenerated().catch(() => {
        toast.warning(
          'Plan hazır; eski çalışmalar listesi şu an yenilenemedi. Sonuç ekranda korunuyor.',
        );
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Yurt dışı ilan planı hazırlanamadı.';
      setGenerationError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.intro}>
        <span className={styles.introIcon} aria-hidden="true">
          <Globe2 />
        </span>
        <div>
          <p className={styles.eyebrow}>Yurt dışı pazarlama</p>
          <h2>Hangi ülkedeki alıcılara ulaşmak istiyorsunuz?</h2>
          <p>
            Portföyünü seç, hedef ülkeyi belirle; sistem yalnız seçtiğin
            portalın biçimine uygun metni ve yayın adımlarını hazırlasın.
          </p>
        </div>
        <div className={styles.trustNote}>
          <ShieldAlert aria-hidden="true" />
          <span>Hesap açma, ödeme ve son yayın kontrolü her zaman sizdedir.</span>
        </div>
      </header>

      <nav className={styles.stepNavigation} aria-label="İlan planı adımları">
        <ol>
          {FLOW_STEPS.map((item) => {
            const isActive = step === item.id;
            const isComplete = step > item.id;
            const isDisabled =
              (item.id === 2 && !canOpenStepTwo) ||
              (item.id === 3 && !canOpenStepThree);
            return (
              <li
                key={item.id}
                data-active={isActive}
                data-complete={isComplete}
              >
                <button
                  type="button"
                  onClick={() => setStep(item.id)}
                  disabled={isDisabled || generating}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className={styles.stepNumber} aria-hidden="true">
                    {isComplete ? <Check /> : item.id}
                  </span>
                  <span>
                    <b>{item.title}</b>
                    <small>{item.shortDescription}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {step === 1 && (
        <section
          className={styles.stepPanel}
          aria-labelledby="international-step-property"
          aria-busy={loading}
        >
          <div className={styles.stepHeading}>
            <span>1</span>
            <div>
              <h3 id="international-step-property">Portföyünü seç</h3>
              <p>Yurt dışında tanıtmak istediğin aktif kaydı seçmen yeterli.</p>
            </div>
          </div>

          {loading ? (
            <div className={styles.loadingState} role="status" aria-live="polite">
              <Loader2 aria-hidden="true" />
              <span>Aktif portföyler yükleniyor…</span>
            </div>
          ) : properties.length === 0 ? (
            <div className={styles.emptyState}>
              <span aria-hidden="true">
                <Building2 />
              </span>
              <div>
                <h4>Henüz aktif portföy yok</h4>
                <p>
                  İlk yurt dışı planını hazırlamak için Portföyler bölümünde
                  bir kaydı aktif duruma getirin.
                </p>
              </div>
              <a href="/fabrika/portfoyler">Portföylere git</a>
            </div>
          ) : (
            <div className={styles.selectionBody}>
              <div className={styles.fieldGroup}>
                <label htmlFor="international-property">Aktif portföy</label>
                <select
                  id="international-property"
                    value={effectivePropertyId}
                    onChange={(event) => changeProperty(event.target.value)}
                    disabled={generating}
                >
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.referenceCode
                        ? `${property.referenceCode} · `
                        : ''}
                      {property.title}
                    </option>
                  ))}
                </select>
                <small>
                  İlan metni yalnız bu kaydın doğrulanmış bilgilerini kullanır.
                </small>
              </div>

              {selectedProperty && (
                <article className={styles.propertySummary}>
                  <span className={styles.propertyIcon} aria-hidden="true">
                    <Building2 />
                  </span>
                  <div>
                    <span>Seçilen portföy</span>
                    <h4>{selectedProperty.title}</h4>
                    <p>
                      <MapPin aria-hidden="true" />
                      {selectedProperty.location || 'Konum bilgisi yok'}
                    </p>
                  </div>
                  <div className={styles.propertyFacts}>
                    <b>{money(selectedProperty.price)}</b>
                    <small>{selectedProperty.referenceCode || 'Referans kodu yok'}</small>
                  </div>
                </article>
              )}

              <div className={styles.actionRow}>
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!selectedProperty}
                  className={styles.primaryAction}
                >
                  Ülke seçimine geç <ArrowRight />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {step === 2 && (
        <section
          className={styles.stepPanel}
          aria-labelledby="international-step-market"
          aria-busy={generating}
        >
          <div className={styles.stepHeading}>
            <span>2</span>
            <div>
              <h3 id="international-step-market">Alıcı ülkesini seç</h3>
              <p>
                Ülkeyi seçin. Sistem Türkiye’deki portföyünüz için en güvenli
                başlangıç yolunu öne çıkarsın.
              </p>
            </div>
          </div>

          <div className={styles.marketLayout}>
            <div className={styles.countryColumn}>
              <div className={styles.fieldGroup}>
                <label htmlFor="international-country-search">Hedef ülke ara</label>
                <div className={styles.searchField}>
                  <Search aria-hidden="true" />
                  <input
                    id="international-country-search"
                    type="search"
                    value={countryQuery}
                    onChange={(event) => setCountryQuery(event.target.value)}
                    placeholder="Ülke, kod veya dil yazın"
                    autoComplete="off"
                    aria-controls="international-country-results"
                    disabled={generating}
                  />
                </div>
              </div>

              <div
                id="international-country-results"
                className={styles.countryGrid}
                aria-label="Desteklenen ülkeler"
              >
                {visibleMarkets.map((market) => (
                  <button
                    key={market.code}
                    type="button"
                    onClick={() => chooseMarket(market)}
                    aria-pressed={selectedMarket.code === market.code}
                    data-active={selectedMarket.code === market.code}
                    disabled={generating}
                  >
                    <span className={styles.isoCode}>{market.code}</span>
                    <span>
                      <b>{market.country}</b>
                      <small>{market.language}</small>
                    </span>
                    {selectedMarket.code === market.code && (
                      <Check aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>

              {matchingMarkets.length === 0 && (
                <div className={styles.noCountryResult} role="status">
                  <Globe2 aria-hidden="true" />
                  <p>
                    “{countryQuery}” için desteklenen ülke bulunamadı. Ülke adı
                    veya iki harfli ülke koduyla yeniden deneyin.
                  </p>
                </div>
              )}

              {!normalizedQuery && matchingMarkets.length > 6 && (
                <button
                  type="button"
                  className={styles.revealButton}
                  onClick={() => setShowAllCountries((current) => !current)}
                  disabled={generating}
                  aria-expanded={showAllCountries}
                  aria-controls="international-country-results"
                >
                  {showAllCountries ? <ChevronUp /> : <ChevronDown />}
                  {showAllCountries
                    ? 'Daha az ülke göster'
                    : `Tüm ${matchingMarkets.length} ülkeyi göster`}
                </button>
              )}
            </div>

            <div className={styles.portalColumn}>
              <div className={styles.marketSummary}>
                <span className={styles.largeIso}>{selectedMarket.code}</span>
                <div>
                  <span>Seçilen pazar</span>
                  <h4>{selectedMarket.country}</h4>
                  <p>
                    <Languages aria-hidden="true" /> İlan dili:{' '}
                    {selectedMarket.language}
                  </p>
                </div>
                <b>{selectedMarket.portals.length} portal</b>
              </div>

              {(selectedMarket.currency ||
                selectedMarket.timezone ||
                selectedMarket.timeZone ||
                selectedMarket.measurementSystem) && (
                <dl className={styles.marketMetadata}>
                  {selectedMarket.currency && (
                    <div>
                      <dt>Para birimi</dt>
                      <dd>
                        Kaynak fiyat TRY olarak korunur. Portal bağlamı:{' '}
                        {selectedMarket.currency}
                      </dd>
                    </div>
                  )}
                  {(selectedMarket.timezone || selectedMarket.timeZone) && (
                    <div>
                      <dt>Saat dilimi</dt>
                      <dd>{selectedMarket.timezone || selectedMarket.timeZone}</dd>
                    </div>
                  )}
                  {selectedMarket.measurementSystem && (
                    <div>
                      <dt>Ölçü biçimi</dt>
                      <dd>{selectedMarket.measurementSystem}</dd>
                    </div>
                  )}
                </dl>
              )}

              {recommendedPortal ? (
                <div className={styles.portalPicker}>
                  <div className={styles.portalSectionLabel}>
                    <span>Önerilen başlangıç yolu</span>
                    <small>Plan yalnız bu site ve akış için hazırlanır</small>
                  </div>

                  <button
                    type="button"
                    className={styles.portalChoice}
                    data-active={selectedPortal?.id === recommendedPortal.id}
                    aria-pressed={selectedPortal?.id === recommendedPortal.id}
                    onClick={() => choosePortal(recommendedPortal.id)}
                    disabled={generating}
                  >
                    <span className={styles.portalMark} aria-hidden="true">
                      <Globe2 />
                    </span>
                    <span>
                      <b>{recommendedPortal.name}</b>
                      <small>
                        {portalEligibilityLabel(recommendedPortal)} ·{' '}
                        {accountTypeLabel(recommendedPortal.accountType)}
                      </small>
                    </span>
                    <span className={styles.recommendedBadge}>Önerilen</span>
                    {selectedPortal?.id === recommendedPortal.id && (
                      <Check aria-hidden="true" />
                    )}
                  </button>

                  {alternativePortals.length > 0 && (
                    <>
                      <button
                        type="button"
                        className={styles.revealButton}
                        onClick={() =>
                          setShowAlternatives((current) => !current)
                        }
                        disabled={generating}
                        aria-expanded={showAlternatives}
                        aria-controls="international-alternative-portals"
                      >
                        {showAlternatives ? <ChevronUp /> : <ChevronDown />}
                        {showAlternatives
                          ? 'Alternatifleri gizle'
                          : `Alternatif portalları gör (${alternativePortals.length})`}
                      </button>

                      {showAlternatives && (
                        <div
                          id="international-alternative-portals"
                          className={styles.alternativeList}
                        >
                          {alternativePortals.map((portal) => (
                            <button
                              key={portal.id}
                              type="button"
                              className={styles.portalChoice}
                              data-active={selectedPortal?.id === portal.id}
                              aria-pressed={selectedPortal?.id === portal.id}
                              onClick={() => choosePortal(portal.id)}
                              disabled={generating}
                            >
                              <span className={styles.portalMark} aria-hidden="true">
                                <Globe2 />
                              </span>
                              <span>
                                <b>{portal.name}</b>
                                <small>
                                  {portalEligibilityLabel(portal)} ·{' '}
                                  {accountTypeLabel(portal.accountType)}
                                </small>
                              </span>
                              {selectedPortal?.id === portal.id && (
                                <Check aria-hidden="true" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {selectedPortal && (
                    <div className={styles.portalDetails}>
                      <div>
                        <strong>{portalEligibilityLabel(selectedPortal)}</strong>
                        <p>
                          {selectedPortal.eligibilityNote || selectedPortal.note}
                        </p>
                        <small>
                          Türkiye’de bulunan bir taşınmazın kabulünü ve hesap
                          koşullarını yayınlamadan önce portalın resmî sayfasından
                          doğrulayın.
                        </small>
                      </div>
                      <div>
                        <strong>Ücret bilgisi</strong>
                        <p>{selectedPortal.pricingLabel}</p>
                        {isVerifiedPortalLink(
                          selectedPortal,
                          selectedPortal.pricingUrl,
                        ) ? (
                          <a
                            href={selectedPortal.pricingUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Güncel ücreti resmî siteden kontrol et <ExternalLink />
                          </a>
                        ) : (
                          <small>Resmî fiyat bağlantısı doğrulanamadı.</small>
                        )}
                      </div>
                      {formatDate(selectedPortal.lastVerifiedAt) && (
                        <small className={styles.verificationDate}>
                          Katalog son kontrolü:{' '}
                          {formatDate(selectedPortal.lastVerifiedAt)}
                        </small>
                      )}
                    </div>
                  )}

                  {previousPortalCampaign && (
                    <button
                      type="button"
                      className={styles.previousPlan}
                      onClick={() => openExistingPlan(previousPortalCampaign)}
                      disabled={generating}
                    >
                      <FileText aria-hidden="true" />
                      <span>
                        <b>Bu portal için önceki plan var</b>
                        <small>
                          {new Date(
                            previousPortalCampaign.createdAt,
                          ).toLocaleDateString('tr-TR')}{' '}
                          tarihli planı aç
                        </small>
                      </span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.noCountryResult} role="alert">
                  <ShieldAlert aria-hidden="true" />
                  <p>Bu ülke için henüz doğrulanmış portal kaydı bulunmuyor.</p>
                </div>
              )}
            </div>
          </div>

          {generationError && (
            <div className={styles.errorState} role="alert">
              <ShieldAlert aria-hidden="true" />
              <div>
                <strong>Plan hazırlanamadı</strong>
                <p>{generationError}</p>
              </div>
              <button type="button" onClick={() => void generatePlan()}>
                Yeniden dene
              </button>
            </div>
          )}

          {generating && (
            <div className={styles.generationStatus} role="status" aria-live="polite">
              <Loader2 aria-hidden="true" />
              <div>
                <strong>Portal planı hazırlanıyor</strong>
                <span>
                  Doğrulanmış portföy bilgileri {selectedPortal?.name} biçimine
                  uyarlanıyor…
                </span>
              </div>
            </div>
          )}

          <div className={styles.actionRow}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              className={styles.secondaryAction}
              disabled={generating}
            >
              <ArrowLeft /> Geri
            </Button>
            <Button
              type="button"
              onClick={() => void generatePlan()}
              disabled={
                generating || !isOnline || !selectedProperty || !selectedPortal
              }
              className={styles.primaryAction}
            >
              {generating ? <Loader2 className={styles.spin} /> : <Sparkles />}
              {generating
                ? 'Plan hazırlanıyor…'
                : `${selectedPortal?.name || 'Portal'} planını hazırla`}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section
          className={styles.stepPanel}
          aria-labelledby="international-step-result"
        >
          <div className={styles.stepHeading}>
            <span>3</span>
            <div>
              <h3 id="international-step-result">Portal planın hazır</h3>
              <p>
                Aşağıdaki içerik yalnız {selectedPortal?.name || 'seçilen portal'}
                için hazırlanmıştır.
              </p>
            </div>
          </div>

          {!resultPlan || !resultCopy || !selectedPortal ? (
            <div className={styles.emptyResult} role="status">
              <span aria-hidden="true">
                <FileText />
              </span>
              <div>
                <h4>Bu portal için açılabilir bir plan yok</h4>
                <p>
                  Ülke ve portal adımına dönüp yeni bir plan hazırlayın veya
                  mevcut planlardan birini açın.
                </p>
              </div>
              <Button
                type="button"
                onClick={() => setStep(2)}
                className={styles.primaryAction}
              >
                Ülke ve portala dön
              </Button>
            </div>
          ) : (
            <div className={styles.resultWorkspace}>
              <header className={styles.resultHeader}>
                <span className={styles.largeIso}>{selectedMarket.code}</span>
                <div>
                  <span>
                    {selectedMarket.country} · {selectedPortal.name}
                  </span>
                  <h4>{resultName}</h4>
                  <p>
                    {resultPropertyTitle}
                  </p>
                </div>
                <div className={styles.resultBadges}>
                  <span>{providerLabel(resultProvider)}</span>
                  {resultDate && <time>{formatDate(resultDate)}</time>}
                </div>
              </header>

              <div className={styles.strategyCard}>
                <span aria-hidden="true">
                  <ClipboardCheck />
                </span>
                <div>
                  <strong>Bu portal için plan</strong>
                  <p>{resultPlan.strategy}</p>
                </div>
              </div>

              {resultPlan.warnings.length > 0 && (
                <div className={styles.warningCard} role="note">
                  <ShieldAlert aria-hidden="true" />
                  <div>
                    <strong>Yayınlamadan önce kontrol edin</strong>
                    <ul>
                      {resultPlan.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {(selectedPortal.titleLimit ||
                selectedPortal.descriptionLimit ||
                selectedPortal.imageGuidance ||
                selectedPortal.requiredFields?.length) && (
                <details className={styles.resultDetails}>
                  <summary>
                    <ClipboardCheck /> Portal kuralları ve görsel kontrolü
                    <ChevronDown />
                  </summary>
                  <section className={styles.requirementCard}>
                  <h5>Portal biçim bilgileri</h5>
                  <dl>
                    {selectedPortal.titleLimit && (
                      <div>
                        <dt>Başlık sınırı</dt>
                        <dd>{selectedPortal.titleLimit} karakter</dd>
                      </div>
                    )}
                    {selectedPortal.descriptionLimit && (
                      <div>
                        <dt>Açıklama sınırı</dt>
                        <dd>{selectedPortal.descriptionLimit} karakter</dd>
                      </div>
                    )}
                    {selectedPortal.imageGuidance && (
                      <div>
                        <dt>Görsel</dt>
                        <dd>{selectedPortal.imageGuidance}</dd>
                      </div>
                    )}
                  </dl>
                  {selectedPortal.listingOrder?.length ? (
                    <div className={styles.portalOrder}>
                      <strong>Bu sitedeki doğru bilgi sırası</strong>
                      <ol>
                        {selectedPortal.listingOrder.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                  {selectedPortal.requiredFields?.length ? (
                    <p>
                      Zorunlu bilgiler: {selectedPortal.requiredFields.join(', ')}
                    </p>
                  ) : null}
                  {selectedPortal.mediaRules?.length ? (
                    <div className={styles.mediaRules}>
                      <strong>Görsel kuralları</strong>
                      <ul>
                        {selectedPortal.mediaRules.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  </section>
                </details>
              )}

              <div className={styles.copyWorkspace}>
                <section className={styles.copyCard}>
                  <div className={styles.copyCardHeader}>
                    <div>
                      <span>Portal başlığı</span>
                      <small>{selectedMarket.language}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText(resultCopy.title, 'Başlık')}
                    >
                      <Copy /> Başlığı kopyala
                    </button>
                  </div>
                  <p className={styles.portalTitle}>{resultCopy.title}</p>
                </section>

                <section className={styles.copyCard}>
                  <div className={styles.copyCardHeader}>
                    <div>
                      <span>Portal açıklaması</span>
                      <small>{selectedMarket.language}</small>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void copyText(resultCopy.body, 'Açıklama')
                      }
                    >
                      <Copy /> Açıklamayı kopyala
                    </button>
                  </div>
                  <p className={styles.portalBody}>{resultCopy.body}</p>
                </section>
                {(resultCopy.titleTr || resultCopy.bodyTr) && (
                  <details className={styles.translationBox}>
                    <summary>
                      <Languages /> Türkçe geri çeviriyi kontrol et
                      <ChevronDown />
                    </summary>
                    <div>
                      {resultCopy.titleTr && (
                        <section>
                          <span>Başlık</span>
                          <p>{resultCopy.titleTr}</p>
                        </section>
                      )}
                      {resultCopy.bodyTr && (
                        <section>
                          <span>Açıklama</span>
                          <p>{resultCopy.bodyTr}</p>
                        </section>
                      )}
                    </div>
                  </details>
                )}
              </div>

              {resultPlan.socialPlan?.channels.length ? (
                <details className={styles.resultDetails}>
                  <summary>
                    <Share2 /> {selectedMarket.country} sosyal medya paketini gör
                    <ChevronDown />
                  </summary>
                  <section className={styles.socialPack}>
                  <div className={styles.sectionTitle}>
                    <span aria-hidden="true"><Share2 /></span>
                    <div>
                      <h5>{selectedMarket.country} sosyal medya paketi</h5>
                      <p>Her kanal için metin açısı, ölçü ve yerel CTA ayrı seçildi.</p>
                    </div>
                  </div>
                  <div className={styles.socialGrid}>
                    {resultPlan.socialPlan.channels.map((channel) => (
                      <article key={channel.channel}>
                        <header><Megaphone /><strong>{channel.channel}</strong></header>
                        <dl>
                          <div><dt>Amaç</dt><dd>{channel.objective}</dd></div>
                          <div><dt>Görsel biçimi</dt><dd>{channel.format}</dd></div>
                          <div><dt>İçerik açısı</dt><dd>{channel.contentAngle}</dd></div>
                          <div><dt>Yerel CTA</dt><dd>{channel.localCta}</dd></div>
                          <div><dt><Clock3 /> Başlangıç testi</dt><dd>{channel.publishingWindow}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                  {resultPlan.socialPlan.complianceNotes.length ? (
                    <div className={styles.socialSafety}>
                      <ShieldAlert />
                      <ul>
                        {resultPlan.socialPlan.complianceNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  </section>
                </details>
              ) : null}

              <details className={styles.resultDetails}>
                <summary>
                  <ClipboardCheck /> Adım adım nasıl yayınlanır?
                  <ChevronDown />
                </summary>
                <section className={styles.publishSteps}>
                <div className={styles.sectionTitle}>
                  <span aria-hidden="true">
                    <ClipboardCheck />
                  </span>
                  <div>
                    <h5>Yayın adımları</h5>
                    <p>Son kontrol ve yayın işlemi sizin hesabınızdan yapılır.</p>
                  </div>
                </div>
                <ol>
                  {resultCopy.steps.map((publishStep, index) => (
                    <li key={`${resultCopy.portalId}-${index}`}>
                      <span>{index + 1}</span>
                      <p>{publishStep}</p>
                    </li>
                  ))}
                </ol>
                </section>
              </details>

              <div className={styles.portalSafety}>
                <div>
                  <strong>Ücret ve uygunluk</strong>
                  <p>{selectedPortal.pricingLabel}</p>
                  <small>
                    Fiyat, üyelik koşulları ve Türkiye’deki taşınmaz kabulü
                    değişebilir. Yalnız portalın resmî sayfasını esas alın.
                  </small>
                </div>
                <div className={styles.externalActions}>
                  {isVerifiedPortalLink(
                    selectedPortal,
                    resultCopy.pricingUrl,
                  ) ? (
                    <a
                      href={resultCopy.pricingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Güncel fiyat <ExternalLink />
                    </a>
                  ) : (
                    <span>Fiyat bağlantısı doğrulanamadı</span>
                  )}
                  {canOpenPublishing(selectedPortal) &&
                  isVerifiedPortalLink(selectedPortal, resultCopy.publishUrl) ? (
                    <a
                      href={resultCopy.publishUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.publishLink}
                    >
                      Yayın ekranını aç <ExternalLink />
                    </a>
                  ) : selectedPortal.officialSourceUrl ? (
                    <a
                      href={selectedPortal.officialSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Uygunluğu resmî siteden doğrula <ExternalLink />
                    </a>
                  ) : (
                    <span>Yayın uygunluğu doğrulanmalı</span>
                  )}
                </div>
              </div>

              <div className={styles.actionRow}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  className={styles.secondaryAction}
                >
                  <ArrowLeft /> Ülke veya portalı değiştir
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setResultCampaignId(null);
                    setGeneratedSnapshot(null);
                    setStep(1);
                  }}
                  className={styles.primaryAction}
                >
                  Yeni plan hazırla <ArrowRight />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
