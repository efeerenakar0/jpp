'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Globe2,
  Loader2,
  Rocket,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  INTERNATIONAL_MARKETS,
  isVerifiedPortalLink,
  type InternationalMarketingPlan,
} from '@/lib/international-marketing';
import EmptyState from '@/components/fabrika/EmptyState';
import LoadingSkeleton from '@/components/fabrika/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
  onGenerated: () => Promise<void>;
};

const selectClass =
  'min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20';

function providerLabel(provider: string | null) {
  if (provider) return 'AI destekli';
  return 'Doğrulanmış verilerle hazırlandı';
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} kopyalandı.`);
  } catch {
    toast.error('Metin kopyalanamadı.');
  }
}

export default function InternationalMarketingPanel({
  properties,
  campaigns,
  loading,
  onGenerated,
}: Props) {
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [countryCode, setCountryCode] = useState('DE');
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const selectedMarket =
    INTERNATIONAL_MARKETS.find((market) => market.code === countryCode) ||
    INTERNATIONAL_MARKETS[0];
  const visibleCampaigns = useMemo(
    () =>
      campaigns.filter(
        (campaign) => campaign.internationalPlan?.countryCode === countryCode
      ),
    [campaigns, countryCode]
  );

  async function generatePlan() {
    const selectedPropertyId = propertyId || properties[0]?.id;
    if (!selectedPropertyId) {
      toast.error('Önce aktif bir portföy seçin.');
      return;
    }
    setGenerating(true);
    setGenerationError(null);
    try {
      const response = await fetch('/api/fabrika/marketing/international', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: selectedPropertyId, countryCode }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || 'Yurt dışı ilan planı hazırlanamadı.');
      }
      toast.success(
        `${selectedMarket.country} için ${selectedMarket.portals.length} portala özel ilan planı hazır.`
      );
      await onGenerated();
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
    <div className="space-y-6">
      <section
        className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
        aria-busy={generating}
      >
        <div className="border-b border-slate-800 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
              <Globe2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-semibold text-white">Yurt dışı ilan merkezi</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                Aktif portföyünüzü ülkenin diline ve seçilen portalın yayın
                biçimine göre hazırlar. Business CEO AI sizin yerinize dış platformda
                hesap açmaz veya ödeme yapmaz; son yayın kontrolü sizdedir.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-5 xl:grid-cols-[.8fr_1.2fr]">
          <div className="space-y-5">
            <div>
              <label
                htmlFor="international-property"
                className="mb-2 block text-xs font-semibold text-slate-400"
              >
                Aktif portföy
              </label>
              <select
                id="international-property"
                value={propertyId || properties[0]?.id || ''}
                onChange={(event) => setPropertyId(event.target.value)}
                className={selectClass}
              >
                <option value="">Portföy seçin</option>
                {properties.map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.referenceCode
                      ? `${property.referenceCode} · `
                      : ''}
                    {property.title}
                    {property.location ? ` · ${property.location}` : ''}
                  </option>
                ))}
              </select>
              {!loading && properties.length === 0 && (
                <p className="mt-2 text-xs text-amber-300">
                  Önce Portföyler bölümünde bir kaydı aktif duruma getirin.
                </p>
              )}
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-slate-400">
                Hedef ülke
              </legend>
              <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-2">
                {INTERNATIONAL_MARKETS.map((market) => (
                  <button
                    key={market.code}
                    type="button"
                    onClick={() => setCountryCode(market.code)}
                    aria-pressed={countryCode === market.code}
                    className={`flex min-h-12 items-center gap-2 rounded-lg border px-3 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                      countryCode === market.code
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-lg" aria-hidden="true">
                      {market.flag}
                    </span>
                    <span>{market.country}</span>
                    {countryCode === market.code && (
                      <Check className="ml-auto h-3.5 w-3.5 text-emerald-400" />
                    )}
                  </button>
                ))}
              </div>
            </fieldset>

            <Button
              type="button"
              onClick={generatePlan}
              disabled={
                generating || loading || (!propertyId && properties.length === 0)
              }
              className="min-h-11 w-full bg-emerald-500 font-semibold text-emerald-950 hover:bg-emerald-400"
            >
              {generating ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Rocket />
              )}
              {generating
                ? 'Portal planları hazırlanıyor…'
                : `${selectedMarket.country} planını hazırla`}
            </Button>
            {generationError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200"
              >
                <p>{generationError}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void generatePlan()}
                  className="mt-2 border-rose-400/30 text-rose-100"
                >
                  Yeniden dene
                </Button>
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-white">
                  {selectedMarket.flag} {selectedMarket.country}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  İlan dili: {selectedMarket.language} ·{' '}
                  {selectedMarket.portals.length} portal
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-slate-700 text-slate-400"
              >
                Güncel ücret bağlantıları
              </Badge>
            </div>

            <div className="mt-4 grid gap-3">
              {selectedMarket.portals.map((portal) => (
                <article
                  key={portal.id}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-white">
                          {portal.name}
                        </h4>
                        <Badge className="bg-slate-800 text-slate-300">
                          {portal.accountType === 'professional'
                            ? 'Profesyonel hesap'
                            : portal.accountType === 'individual'
                              ? 'Bireysel hesap'
                              : 'Bireysel / profesyonel'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        {portal.note}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-amber-200/80">
                        {portal.pricingLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {isVerifiedPortalLink(portal, portal.pricingUrl) ? (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
                        >
                          <a
                            href={portal.pricingUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ücreti kontrol et <ExternalLink />
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          Ücret bağlantısı doğrulanamadı
                        </Button>
                      )}
                      {isVerifiedPortalLink(portal, portal.publishUrl) ? (
                        <Button
                          asChild
                          size="sm"
                          className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                        >
                          <a
                            href={portal.publishUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            İlan ver <ExternalLink />
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" disabled>
                          Yayın bağlantısı doğrulanamadı
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">
            {selectedMarket.country} için hazırlanan planlar
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Her portalın metni, yayın adımları ve resmi bağlantısı ayrı saklanır.
          </p>
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : visibleCampaigns.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Bu ülke için henüz plan yok"
            description="Bir portföy seçip ülkeye özel ilk ilan paketini hazırlayın."
          />
        ) : (
          visibleCampaigns.map((campaign) => {
            const plan = campaign.internationalPlan;
            if (!plan) return null;
            return (
              <article
                key={campaign.id}
                className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
              >
                <div className="border-b border-slate-800 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">
                          {campaign.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className="border-slate-700 text-slate-400"
                        >
                          {providerLabel(campaign.generatedBy)}
                        </Badge>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                        {plan.strategy}
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        {new Date(campaign.createdAt).toLocaleString('tr-TR')}
                      </p>
                    </div>
                  </div>
                  {plan.warnings.length > 0 && (
                    <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                        <ShieldAlert className="h-4 w-4" />
                        Yayın öncesi kontrol
                      </p>
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/70">
                        {plan.warnings.map((warning) => (
                          <li key={warning}>• {warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 p-5 xl:grid-cols-2">
                  {plan.portalCopies.map((copy) => (
                    <div
                      key={copy.portalId}
                      className="flex flex-col rounded-xl border border-slate-800 bg-slate-950 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-semibold text-white">
                          {copy.portalName}
                        </h4>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void copyText(copy.title, 'Başlık')
                            }
                            className="text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Copy /> Başlık
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void copyText(copy.body, 'Açıklama')
                            }
                            className="text-slate-400 hover:bg-slate-800 hover:text-white"
                          >
                            <Copy /> Açıklama
                          </Button>
                        </div>
                      </div>
                      <p className="mt-4 text-sm font-medium leading-6 text-slate-200">
                        {copy.title}
                      </p>
                      <p className="mt-3 whitespace-pre-line text-xs leading-6 text-slate-400">
                        {copy.body}
                      </p>
                      <div className="mt-4 border-t border-slate-800 pt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
                          Yayın adımları
                        </p>
                        <ol className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                          {copy.steps.map((step, index) => (
                            <li key={`${copy.portalId}-${index}`} className="flex gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-semibold text-slate-300">
                                {index + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2 pt-5">
                        {(() => {
                          const portal = selectedMarket.portals.find(
                            (item) => item.id === copy.portalId
                          );
                          const pricingReady = Boolean(
                            portal &&
                              isVerifiedPortalLink(portal, copy.pricingUrl)
                          );
                          const publishReady = Boolean(
                            portal &&
                              isVerifiedPortalLink(portal, copy.publishUrl)
                          );
                          return (
                            <>
                              {pricingReady ? (
                                <Button
                                  asChild
                                  size="sm"
                                  variant="outline"
                                  className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
                                >
                                  <a href={copy.pricingUrl} target="_blank" rel="noreferrer">
                                    Güncel fiyat <ExternalLink />
                                  </a>
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" disabled>
                                  Fiyat bağlantısı doğrulanamadı
                                </Button>
                              )}
                              {publishReady ? (
                                <Button
                                  asChild
                                  size="sm"
                                  className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                                >
                                  <a href={copy.publishUrl} target="_blank" rel="noreferrer">
                                    Yayın ekranını aç <ExternalLink />
                                  </a>
                                </Button>
                              ) : (
                                <Button size="sm" disabled>
                                  Yayın bağlantısı doğrulanamadı
                                </Button>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
