"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  History,
  ImageIcon,
  Loader2,
  MapPin,
  Megaphone,
  MousePointerClick,
  Plus,
  Rocket,
  Sparkles,
  Target,
  Users2,
  Video,
  WandSparkles,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import AdCopyCard from "@/components/fabrika/AdCopyCard";
import EmptyState from "@/components/fabrika/EmptyState";
import InternationalMarketingPanel from "@/components/fabrika/InternationalMarketingPanel";
import LoadingSkeleton from "@/components/fabrika/LoadingSkeleton";
import type { InternationalMarketingPlan } from "@/lib/international-marketing";
import type { MarketingCreativeAsset } from "@/lib/marketing-creative-assets";
import {
  DEFAULT_MARKETING_CHANNELS,
  MARKETING_CHANNELS,
} from "@/lib/marketing-channels";
import type { AdPlatform } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import styles from "./marketing.module.css";

type Property = {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  imageUrl: string | null;
  referenceCode: string | null;
  status: string;
};

type AdCopy = {
  id: string;
  platform: AdPlatform;
  headline: string;
  body: string;
  callToAction: string | null;
  targetUrl: string | null;
  approved: boolean;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  type: "listing" | "brand" | "international";
  objective: string | null;
  audience: string | null;
  posterTemplate: string | null;
  posterHeadline: string | null;
  posterSubline: string | null;
  generatedBy: string | null;
  generatedModel: string | null;
  internationalPlan: InternationalMarketingPlan | null;
  publicationStatus:
    | "DRAFT"
    | "READY_TO_PUBLISH"
    | "EXPORTED"
    | "MANUALLY_CONFIRMED";
  exportedAt: string | null;
  externalPublicationUrl: string | null;
  publicationProofUrl: string | null;
  manuallyConfirmedAt: string | null;
  createdAt: string;
  property: Omit<Property, "status"> | null;
  adCopies: AdCopy[];
};

const PUBLICATION_LABELS: Record<Campaign["publicationStatus"], string> = {
  DRAFT: "Taslak",
  READY_TO_PUBLISH: "Yayına hazır",
  EXPORTED: "Paket hazır",
  MANUALLY_CONFIRMED: "Manuel yayın doğrulandı",
};

type WebsiteAnalysis = {
  id: string;
  websiteUrl: string;
  domain: string;
  summary: string;
  strengths: string;
  opportunities: string;
  channelPlan: string;
  firstActions: string;
  generatedBy: string;
  createdAt: string;
};

type MarketingData = {
  company: { name: string };
  ai: {
    managedByPlatform: boolean;
    ready: boolean;
  };
  campaigns: Campaign[];
  properties: Property[];
  websiteAnalyses: WebsiteAnalysis[];
  creativeAssets: MarketingCreativeAsset[];
};

const inputClass =
  "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20";

function jsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function money(value: number | null) {
  if (!value) return "Fiyat bilgisi yok";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MarketingPage() {
  const searchParams = useSearchParams();
  const requestedPropertyId = searchParams.get("propertyId") || "";
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState("domestic");
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [campaignType, setCampaignType] = useState<"listing" | "brand">(
    "listing",
  );
  const [propertyId, setPropertyId] = useState("");
  const [audience, setAudience] = useState("Bölgedeki alıcı ve yatırımcılar");
  const [tone, setTone] = useState("professional");
  const [posterTemplate, setPosterTemplate] = useState("SIGNATURE");
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<AdPlatform[]>(
    DEFAULT_MARKETING_CHANNELS,
  );
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [publicationBusy, setPublicationBusy] = useState<string | null>(null);
  const [publicationUrls, setPublicationUrls] = useState<
    Record<string, string>
  >({});
  const [selectedCreativeKey, setSelectedCreativeKey] = useState("");

  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/fabrika/marketing/campaigns", {
        cache: "no-store",
      });
      const body = (await response.json()) as MarketingData & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "Pazarlama verileri alınamadı.");
      setData(body);
      setPropertyId((current) => {
        if (
          requestedPropertyId &&
          body.properties.some(
            (property) => property.id === requestedPropertyId,
          )
        ) {
          return requestedPropertyId;
        }
        return current || body.properties[0]?.id || "";
      });
      setExpanded((current) =>
        Object.keys(current).length || !body.campaigns[0]
          ? current
          : { [body.campaigns[0].id]: true },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Pazarlama verileri alınamadı.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [requestedPropertyId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  useEffect(() => {
    const syncConnection = () => setIsOnline(navigator.onLine);
    syncConnection();
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);
    return () => {
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, []);

  const domesticCampaigns = useMemo(
    () =>
      (data?.campaigns || []).filter(
        (campaign) => campaign.type !== "international",
      ),
    [data],
  );

  const internationalCampaigns = useMemo(
    () =>
      (data?.campaigns || []).filter(
        (campaign) => campaign.type === "international",
      ),
    [data],
  );

  const stats = useMemo(() => {
    const copies = domesticCampaigns.flatMap((campaign) => campaign.adCopies);
    return {
      approved: copies.filter((copy) => copy.approved).length,
      posterReady: domesticCampaigns.filter(
        (campaign) => campaign.posterHeadline,
      ).length,
    };
  }, [domesticCampaigns]);

  const selectedProperty = useMemo(
    () =>
      data?.properties.find((property) => property.id === propertyId) ||
      data?.properties[0] ||
      null,
    [data?.properties, propertyId],
  );

  const availableCreativeAssets = useMemo(
    () =>
      (data?.creativeAssets || []).filter(
        (asset) => asset.propertyId === selectedProperty?.id,
      ),
    [data?.creativeAssets, selectedProperty?.id],
  );

  const selectedCreativeAsset = useMemo(
    () =>
      availableCreativeAssets.find(
        (asset) => `${asset.kind}:${asset.id}` === selectedCreativeKey,
      ) || null,
    [availableCreativeAssets, selectedCreativeKey],
  );

  const previewCampaign = useMemo(
    () =>
      domesticCampaigns.find(
        (campaign) => campaign.property?.id === selectedProperty?.id,
      ) ||
      domesticCampaigns[0] ||
      null,
    [domesticCampaigns, selectedProperty?.id],
  );

  const previewCopy =
    previewCampaign?.adCopies.find((copy) => copy.platform === "INSTAGRAM") ||
    null;

  const readiness = useMemo(() => {
    const fields = [
      audience,
      tone,
      posterTemplate,
      targetUrl || selectedProperty?.title,
      selectedChannels.length ? "channels" : "",
    ];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [
    audience,
    posterTemplate,
    selectedChannels.length,
    selectedProperty?.title,
    targetUrl,
    tone,
  ]);

  function toggleChannel(channel: AdPlatform) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  async function copyPreview() {
    if (!previewCopy) return;
    await navigator.clipboard.writeText(
      [previewCopy.headline, previewCopy.body, previewCopy.callToAction]
        .filter(Boolean)
        .join("\n\n"),
    );
    toast.success("Instagram metni kopyalandı.");
  }

  async function generateCampaign() {
    if (campaignType === "listing" && !propertyId) {
      toast.error("Önce aktif bir portföy seçin.");
      return;
    }
    if (selectedChannels.length === 0) {
      toast.error("En az bir yayın kanalı seçin.");
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch("/api/fabrika/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: campaignType,
          propertyId: campaignType === "listing" ? propertyId : undefined,
          audience,
          tone,
          posterTemplate,
          targetUrl,
          channels: selectedChannels,
          creativeAsset: selectedCreativeAsset
            ? {
                id: selectedCreativeAsset.id,
                kind: selectedCreativeAsset.kind,
              }
            : undefined,
        }),
      });
      const body = (await response.json()) as Campaign & { error?: string };
      if (!response.ok) throw new Error(body.error || "Kampanya üretilemedi.");
      toast.success(
        `Kampanya, ${selectedChannels.length} kanal metni ve poster şablonuyla hazır.`,
      );
      await fetchData();
      setExpanded((current) => ({ ...current, [body.id]: true }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kampanya üretilemedi.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function toggleApprove(adCopyId: string, approved: boolean) {
    try {
      const response = await fetch("/api/fabrika/marketing/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adCopyId, approved }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Onay durumu değiştirilemedi.");
      }
      await fetchData();
      toast.success(
        approved ? "İçerik onaylandı." : "İçerik yeniden taslağa alındı.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "İşlem tamamlanamadı.",
      );
    }
  }

  async function updatePublication(
    campaignId: string,
    action: "PREPARE" | "EXPORT" | "CONFIRM",
  ) {
    const externalUrl = publicationUrls[campaignId]?.trim();
    if (action === "CONFIRM" && !externalUrl) {
      toast.error("Önce dış platformdaki yayın bağlantısını girin.");
      return;
    }

    setPublicationBusy(`${campaignId}:${action}`);
    try {
      const response = await fetch(
        `/api/fabrika/marketing/campaigns/${campaignId}/publication`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(action === "CONFIRM" ? { externalUrl } : {}),
          }),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Yayın adımı tamamlanamadı.");
      }
      await fetchData();
      toast.success(
        action === "PREPARE"
          ? "Kampanya yayın paketine hazır."
          : action === "EXPORT"
            ? "Yayın paketi oluşturuldu."
            : "Dış platform yayını manuel olarak doğrulandı.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Yayın adımı tamamlanamadı.",
      );
    } finally {
      setPublicationBusy(null);
    }
  }

  async function analyzeWebsite() {
    if (!websiteUrl.trim()) {
      toast.error("Analiz edilecek web sitesi adresini girin.");
      return;
    }
    setAnalyzing(true);
    try {
      const response = await fetch("/api/fabrika/marketing/website-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || "Web sitesi analiz edilemedi.");
      toast.success("Web reklam yol haritası hazır.");
      await fetchData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Web sitesi analiz edilemedi.",
      );
    } finally {
      setAnalyzing(false);
    }
  }

  const aiLabel = data?.ai.ready
    ? "Business CEO AI hazır"
    : "Akıllı kural motoru";

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>AI Pazarlama Uzmanı</p>
          <h1>Pazarlama merkezi</h1>
          <p>
            Aktif portföylerinizi doğru kitleye, doğru kanalda ve doğru mesajla
            ulaştırın.
          </p>
          <p>
            AI destekli pazarlama ile erişim ve nitelikli talep operasyonunu tek
            ekrandan yönetin.
          </p>
        </div>
        <div className={styles.heroActions}>
          <Button
            type="button"
            onClick={() =>
              document
                .getElementById("campaign-builder")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className={styles.primaryButton}
          >
            <Plus /> Yeni kampanya oluştur
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setActiveTab("history")}
            className={styles.secondaryButton}
          >
            <History /> Eski çalışmalarım
          </Button>
          <Badge className={styles.aiBadge}>
            <Bot /> {aiLabel}
          </Badge>
        </div>
      </header>

      {!isOnline && (
        <div className={styles.statusBanner} data-tone="warning" role="status">
          <WifiOff aria-hidden="true" />
          <div>
            <strong>İnternet bağlantısı yok</strong>
            <span>Mevcut çalışmalar görünür; yeni üretim bağlantı gelince kullanılabilir.</span>
          </div>
        </div>
      )}
      {loadError && (
        <div className={styles.statusBanner} data-tone="error" role="alert">
          <div>
            <strong>Veriler yüklenemedi</strong>
            <span>{loadError}</span>
          </div>
          <Button type="button" variant="outline" onClick={() => void fetchData()}>
            Yeniden dene
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className={styles.marketTabs}>
        <div className={styles.marketBar}>
          <TabsList className={styles.countryTabs}>
            <TabsTrigger value="domestic">Yurt içi</TabsTrigger>
            <TabsTrigger value="international">Yurt dışı</TabsTrigger>
            <TabsTrigger value="history">Eski çalışmalarım</TabsTrigger>
          </TabsList>
          <div className={styles.countrySelect}>
            <span>🇹🇷</span> Türkiye <ChevronDown />
          </div>
        </div>

        <TabsContent value="domestic" className={styles.domesticContent}>
          <section className={styles.metrics} aria-label="Pazarlama özeti">
            {[
              {
                label: "Kampanya",
                value: domesticCampaigns.length,
                icon: Megaphone,
                note: "şirket kampanyası",
              },
              {
                label: "Aktif portföy",
                value: data?.properties.length || 0,
                icon: Target,
                note: "kampanyaya hazır",
              },
              {
                label: "Onaylı içerik",
                value: stats.approved,
                icon: Users2,
                note: "kanal metni",
              },
              {
                label: "Hazır poster",
                value: stats.posterReady,
                icon: MousePointerClick,
                note: "indirilebilir",
              },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className={styles.metricCard}>
                  <span className={styles.metricIcon}>
                    <Icon />
                  </span>
                  <div>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                  <small>{metric.note}</small>
                </article>
              );
            })}
          </section>

          <section className={styles.commandGrid}>
            <article
              id="campaign-builder"
              className={`${styles.panel} ${styles.builder}`}
              aria-busy={generating}
            >
              <div className={styles.panelTitle}>
                <div>
                  <span>Kampanya oluşturucu</span>
                  <small>1. Kaynak · 2. Kanallar · 3. İçerik</small>
                </div>
                <Sparkles />
              </div>

              <div className={styles.sourceSwitch}>
                {(
                  [
                    ["listing", "Aktif portföy"],
                    ["brand", "Şirket markası"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setCampaignType(value);
                      if (value === "brand") setSelectedCreativeKey("");
                    }}
                    data-active={campaignType === value}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {campaignType === "listing" && (
                <>
                  <label htmlFor="property" className={styles.label}>
                    Kampanya portföyü
                  </label>
                  <select
                    id="property"
                    value={propertyId}
                    onChange={(event) => {
                      setPropertyId(event.target.value);
                      setSelectedCreativeKey("");
                    }}
                    className={styles.select}
                  >
                    <option value="">Portföy seçin</option>
                    {data?.properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.referenceCode
                          ? `${property.referenceCode} · `
                          : ""}
                        {property.title} · {money(property.price)}
                      </option>
                    ))}
                  </select>
                  {!loading && data?.properties.length === 0 && (
                    <p className={styles.warning}>
                      Kampanya için önce Portföyler bölümünde aktif bir kayıt
                      oluşturun.
                    </p>
                  )}
                </>
              )}

              <div className={styles.propertyCard}>
                <div className={styles.propertyImage}>
                  {selectedProperty?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedProperty.imageUrl}
                      alt={selectedProperty.title}
                    />
                  ) : (
                    <ImageIcon />
                  )}
                </div>
                <div>
                  <strong>
                    {selectedProperty?.title ||
                      data?.company.name ||
                      "Kurumsal marka kampanyası"}
                  </strong>
                  <span>
                    <MapPin />{" "}
                    {selectedProperty?.location ||
                      "Konum bilgisi portföyden alınır"}
                  </span>
                  <b>{money(selectedProperty?.price || null)}</b>
                  <small>
                    {selectedProperty?.referenceCode || "Şirket tanıtımı"} ·{" "}
                    {selectedProperty?.status || "Aktif"}
                  </small>
                </div>
              </div>

              {campaignType === "listing" && (
                <fieldset className={styles.assetPicker}>
                  <legend>
                    <span>Hazır görsel veya video</span>
                    <small>İsteğe bağlı</small>
                  </legend>
                  {availableCreativeAssets.length === 0 ? (
                    <div className={styles.assetEmpty}>
                      <ImageIcon aria-hidden="true" />
                      <span>
                        Bu portföy için kayıtlı poster veya video yok. Kampanya
                        portföy fotoğrafıyla hazırlanabilir.
                      </span>
                      <a href="/fabrika/studyo">Reklam tasarımına git</a>
                    </div>
                  ) : (
                    <div className={styles.assetGrid}>
                      <button
                        type="button"
                        onClick={() => setSelectedCreativeKey("")}
                        data-active={!selectedCreativeAsset}
                      >
                        <span className={styles.assetPlaceholder}>
                          <ImageIcon aria-hidden="true" />
                        </span>
                        <b>Portföy kapağı</b>
                        <small>Hazır çalışma kullanma</small>
                      </button>
                      {availableCreativeAssets.map((asset) => {
                        const key = `${asset.kind}:${asset.id}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedCreativeKey(key)}
                            data-active={selectedCreativeKey === key}
                            aria-pressed={selectedCreativeKey === key}
                          >
                            <span className={styles.assetPreview}>
                              {asset.kind === "VIDEO" ? (
                                <video src={asset.previewUrl} muted preload="metadata" />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={asset.previewUrl} alt="" />
                              )}
                              {asset.kind === "VIDEO" ? (
                                <Video aria-hidden="true" />
                              ) : (
                                <ImageIcon aria-hidden="true" />
                              )}
                            </span>
                            <b>{asset.title}</b>
                            <small>{asset.kind === "VIDEO" ? "Video" : "Poster"}</small>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              )}

              <div className={styles.readiness}>
                <span>Veri tamlığı</span>
                <i>
                  <b style={{ width: `${readiness}%` }} />
                </i>
                <strong>{readiness}%</strong>
              </div>

              <div className={styles.formRows}>
                <label>
                  Hedef kitle
                  <Input
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  Mesaj tonu
                  <select
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    className={styles.select}
                  >
                    <option value="professional">
                      Profesyonel &amp; güvenilir
                    </option>
                    <option value="warm">Samimi</option>
                    <option value="premium">Premium</option>
                  </select>
                </label>
                <label>
                  Poster şablonu
                  <select
                    id="template"
                    value={posterTemplate}
                    onChange={(event) => setPosterTemplate(event.target.value)}
                    className={styles.select}
                  >
                    <option value="SIGNATURE">Signature · Dengeli</option>
                    <option value="EDITORIAL">Editorial · Premium</option>
                    <option value="BOLD">Bold · Yüksek dikkat</option>
                  </select>
                </label>
                <label>
                  Hedef sayfa
                  <Input
                    type="url"
                    value={targetUrl}
                    onChange={(event) => setTargetUrl(event.target.value)}
                    placeholder="https://siteniz.com/portfoy/..."
                    className={inputClass}
                  />
                </label>
              </div>

              <fieldset className={styles.channelPicker}>
                <legend>
                  <span>Yayın kanalları</span>
                  <small>{selectedChannels.length} kanal seçili</small>
                </legend>
                {Array.from(
                  new Set(MARKETING_CHANNELS.map((channel) => channel.group)),
                ).map((group) => (
                  <div className={styles.channelGroup} key={group}>
                    <span>{group}</span>
                    <div>
                      {MARKETING_CHANNELS.filter(
                        (channel) => channel.group === group,
                      ).map((channel) => (
                        <label
                          key={channel.id}
                          data-active={selectedChannels.includes(channel.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedChannels.includes(channel.id)}
                            onChange={() => toggleChannel(channel.id)}
                          />
                          <b>{channel.label}</b>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>

              <Button
                type="button"
                onClick={generateCampaign}
                disabled={
                  generating ||
                  selectedChannels.length === 0 ||
                  (campaignType === "listing" && !propertyId)
                }
                className={styles.generateButton}
              >
                {generating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <WandSparkles />
                )}
                {generating
                  ? "Kampanya hazırlanıyor…"
                  : "AI kampanyasını oluştur"}
              </Button>
            </article>

            <article className={`${styles.panel} ${styles.previewPanel}`}>
              <div className={styles.panelTitle}>
                <div>
                  <span>Instagram gönderi önizleme</span>
                  <small>Gerçek poster ve kanal metni</small>
                </div>
                <ImageIcon />
              </div>
              <div className={styles.instagramPreview}>
                <div className={styles.previewBrand}>
                  <span>BUSINESS CEO AI</span>
                  <small>EXECUTIVE REAL ESTATE</small>
                </div>
                <div className={styles.previewVisual}>
                  {previewCampaign?.posterHeadline ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/fabrika/marketing/poster/${previewCampaign.id}?format=square`}
                      alt={`${previewCampaign.name} poster ön izlemesi`}
                    />
                  ) : selectedProperty?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedProperty.imageUrl}
                      alt={selectedProperty.title}
                    />
                  ) : (
                    <div className={styles.noPreview}>
                      <ImageIcon />
                      <span>İlk kampanyanızın posteri burada görünecek</span>
                    </div>
                  )}
                </div>
                <div className={styles.previewMeta}>
                  <strong>
                    {previewCampaign?.posterHeadline ||
                      selectedProperty?.title ||
                      "Yeni kampanya"}
                  </strong>
                  <span>
                    {selectedProperty?.location ||
                      previewCampaign?.property?.location ||
                      "Business CEO AI"}
                  </span>
                  <b>
                    {money(
                      selectedProperty?.price ||
                        previewCampaign?.property?.price ||
                        null,
                    )}
                  </b>
                </div>
              </div>
              <div className={styles.copyPreview}>
                <span>Gönderi metni</span>
                <h3>
                  {previewCopy?.headline ||
                    "Kampanyanız için platforma özel başlık burada oluşur."}
                </h3>
                <p>
                  {previewCopy?.body ||
                    "Portföyünüzü ve hedef kitlenizi seçin; yapay zekâ doğrulanmış bilgilerle paylaşım metnini hazırlasın."}
                </p>
                {previewCopy?.callToAction && (
                  <strong>{previewCopy.callToAction}</strong>
                )}
                <button
                  type="button"
                  onClick={copyPreview}
                  disabled={!previewCopy}
                >
                  <Copy /> Kopyala
                </button>
              </div>
            </article>
          </section>

          <section className={styles.bottomGrid}>
            <article className={`${styles.panel} ${styles.archive}`}>
              <div className={styles.archiveHeader}>
                <div>
                  <h2>Kampanyalarım</h2>
                  <p>
                    Metinleri onaylayın, yayın paketini indirin ve dış platform
                    yayınını bağlantıyla doğrulayın.
                  </p>
                </div>
                <Badge>{domesticCampaigns.length} kampanya</Badge>
              </div>
              {loading ? (
                <LoadingSkeleton rows={3} />
              ) : domesticCampaigns.length === 0 ? (
                <EmptyState
                  icon={Megaphone}
                  title="Henüz kampanya yok"
                  description="Kampanya oluşturucudan ilk setinizi hazırlayın."
                />
              ) : (
                <div className={styles.campaignTable}>
                  <div className={styles.tableHead}>
                    <span>Durum</span>
                    <span>Kampanya</span>
                    <span>Portföy</span>
                    <span>Kanal</span>
                    <span>Oluşturma</span>
                    <span />
                  </div>
                  {domesticCampaigns.map((campaign) => (
                    <div key={campaign.id} className={styles.campaignItem}>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((current) => ({
                            ...current,
                            [campaign.id]: !current[campaign.id],
                          }))
                        }
                        className={styles.campaignRow}
                        aria-expanded={Boolean(expanded[campaign.id])}
                      >
                        <span>
                          <b>{PUBLICATION_LABELS[campaign.publicationStatus]}</b>
                        </span>
                        <strong>{campaign.name}</strong>
                        <span>
                          {campaign.property?.title || "Şirket markası"}
                        </span>
                        <span className={styles.platformIcons}>
                          {campaign.adCopies
                            .map((copy) =>
                              copy.platform === "INSTAGRAM"
                                ? "◉"
                                : copy.platform === "WHATSAPP"
                                  ? "◍"
                                  : "G",
                            )
                            .join(" ")}
                        </span>
                        <time>
                          {new Date(campaign.createdAt).toLocaleDateString(
                            "tr-TR",
                          )}
                        </time>
                        {expanded[campaign.id] ? (
                          <ChevronUp />
                        ) : (
                          <ChevronDown />
                        )}
                      </button>
                      {expanded[campaign.id] && (
                        <div className={styles.campaignDetails}>
                          {campaign.posterHeadline && (
                            <div className={styles.posterPack}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/fabrika/marketing/poster/${campaign.id}?format=square`}
                                alt={`${campaign.name} kare poster ön izlemesi`}
                              />
                              <div>
                                <h3>{campaign.posterHeadline}</h3>
                                <p>{campaign.posterSubline}</p>
                                <Button
                                  asChild
                                  className={styles.primaryButton}
                                >
                                  <a
                                    href={`/api/fabrika/marketing/poster/${campaign.id}?format=square&download=1`}
                                  >
                                    <Download /> Kare poster
                                  </a>
                                </Button>
                                <Button
                                  asChild
                                  variant="outline"
                                  className={styles.secondaryButton}
                                >
                                  <a
                                    href={`/api/fabrika/marketing/poster/${campaign.id}?format=story&download=1`}
                                  >
                                    <Download /> Hikâye
                                  </a>
                                </Button>
                              </div>
                            </div>
                          )}
                          <div className={styles.copyGrid}>
                            {campaign.adCopies.map((copy) => (
                              <AdCopyCard
                                key={copy.id}
                                {...copy}
                                onApprove={toggleApprove}
                              />
                            ))}
                          </div>
                          <section
                            className={styles.publicationFlow}
                            aria-label={`${campaign.name} yayın akışı`}
                          >
                            <div>
                              <h3>Yayın akışı</h3>
                              <p>
                                Business CEO AI reklamı dış platformda otomatik
                                yayınlamaz. Onaylı içerikleri paketler; gerçek
                                yayın, bağlantı girildiğinde doğrulanır.
                              </p>
                            </div>
                            <div className={styles.publicationActions}>
                              {campaign.publicationStatus === "DRAFT" && (
                                <Button
                                  type="button"
                                  onClick={() =>
                                    void updatePublication(
                                      campaign.id,
                                      "PREPARE",
                                    )
                                  }
                                  disabled={
                                    publicationBusy !== null ||
                                    !campaign.posterHeadline ||
                                    campaign.adCopies.length === 0 ||
                                    campaign.adCopies.some(
                                      (copy) => !copy.approved,
                                    )
                                  }
                                  className={styles.primaryButton}
                                >
                                  {publicationBusy ===
                                  `${campaign.id}:PREPARE` ? (
                                    <Loader2 className="animate-spin" />
                                  ) : (
                                    <Rocket />
                                  )}
                                  Yayına hazırla
                                </Button>
                              )}
                              {campaign.publicationStatus ===
                                "READY_TO_PUBLISH" && (
                                <Button
                                  type="button"
                                  onClick={() =>
                                    void updatePublication(campaign.id, "EXPORT")
                                  }
                                  disabled={publicationBusy !== null}
                                  className={styles.primaryButton}
                                >
                                  {publicationBusy ===
                                  `${campaign.id}:EXPORT` ? (
                                    <Loader2 className="animate-spin" />
                                  ) : (
                                    <Download />
                                  )}
                                  Yayın paketini oluştur
                                </Button>
                              )}
                              {[
                                "EXPORTED",
                                "MANUALLY_CONFIRMED",
                              ].includes(campaign.publicationStatus) && (
                                <Button
                                  asChild
                                  variant="outline"
                                  className={styles.secondaryButton}
                                >
                                  <a
                                    href={`/api/fabrika/marketing/campaigns/${campaign.id}/publication?download=1`}
                                  >
                                    <Download /> Yayın paketini indir
                                  </a>
                                </Button>
                              )}
                            </div>
                            {campaign.publicationStatus === "DRAFT" && (
                              <small>
                                Devam etmek için poster ile bütün kanal
                                metinlerinin hazır ve onaylı olması gerekir.
                              </small>
                            )}
                            {campaign.publicationStatus === "EXPORTED" && (
                              <div className={styles.publicationEvidence}>
                                <label htmlFor={`publication-url-${campaign.id}`}>
                                  Dış platformdaki gerçek yayın bağlantısı
                                </label>
                                <div>
                                  <Input
                                    id={`publication-url-${campaign.id}`}
                                    type="url"
                                    value={publicationUrls[campaign.id] || ""}
                                    onChange={(event) =>
                                      setPublicationUrls((current) => ({
                                        ...current,
                                        [campaign.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="https://instagram.com/p/..."
                                    className={inputClass}
                                  />
                                  <Button
                                    type="button"
                                    onClick={() =>
                                      void updatePublication(
                                        campaign.id,
                                        "CONFIRM",
                                      )
                                    }
                                    disabled={publicationBusy !== null}
                                    className={styles.primaryButton}
                                  >
                                    {publicationBusy ===
                                    `${campaign.id}:CONFIRM` ? (
                                      <Loader2 className="animate-spin" />
                                    ) : (
                                      <ExternalLink />
                                    )}
                                    Manuel yayını doğrula
                                  </Button>
                                </div>
                              </div>
                            )}
                            {campaign.publicationStatus ===
                              "MANUALLY_CONFIRMED" && (
                              <div className={styles.publicationConfirmed}>
                                <span>Yayın bağlantıyla doğrulandı.</span>
                                {campaign.externalPublicationUrl && (
                                  <a
                                    href={campaign.externalPublicationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Dış yayını aç <ExternalLink />
                                  </a>
                                )}
                              </div>
                            )}
                          </section>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>

            <aside className={`${styles.panel} ${styles.websitePlan}`}>
              <div className={styles.webTitle}>
                <span>
                  <Globe2 />
                </span>
                <div>
                  <b>Web sitesi reklam planı</b>
                  <small>
                    {data?.websiteAnalyses[0]?.domain ||
                      "Yeni analiz oluşturun"}
                  </small>
                </div>
              </div>
              <label htmlFor="website-url">Web sitesi adresi</label>
              <Input
                id="website-url"
                type="url"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                placeholder="https://emlaksiteniz.com"
                className={inputClass}
              />
              <Button
                type="button"
                onClick={analyzeWebsite}
                disabled={analyzing}
                className={styles.generateButton}
              >
                {analyzing ? <Loader2 className="animate-spin" /> : <Rocket />}
                {analyzing ? "Analiz ediliyor…" : "Reklam planı hazırla"}
              </Button>
              {data?.websiteAnalyses[0] ? (
                <div className={styles.webSummary}>
                  <p>{data.websiteAnalyses[0].summary}</p>
                  {[
                    [
                      "Güçlü taraf",
                      jsonList(data.websiteAnalyses[0].strengths).length,
                    ],
                    [
                      "Fırsat",
                      jsonList(data.websiteAnalyses[0].opportunities).length,
                    ],
                    [
                      "İlk aksiyon",
                      jsonList(data.websiteAnalyses[0].firstActions).length,
                    ],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <span>{label as string}</span>
                      <b>{value}</b>
                    </div>
                  ))}
                  <a
                    href={data.websiteAnalyses[0].websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Siteyi aç <ExternalLink />
                  </a>
                </div>
              ) : (
                <p className={styles.webEmpty}>
                  Sitenizin açık içeriğini analiz ederek Google, Instagram ve
                  WhatsApp için uygulanabilir ilk adımları çıkarır.
                </p>
              )}
            </aside>
          </section>

          {data && data.websiteAnalyses.length > 1 && (
            <details className={styles.analysisArchive}>
              <summary>
                Önceki web reklam planları ({data.websiteAnalyses.length - 1})
              </summary>
              <div>
                {data.websiteAnalyses.slice(1).map((analysis) => (
                  <a
                    key={analysis.id}
                    href={analysis.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <b>{analysis.domain}</b>
                    <span>{analysis.summary}</span>
                    <ExternalLink />
                  </a>
                ))}
              </div>
            </details>
          )}
        </TabsContent>

        <TabsContent
          value="international"
          className={styles.internationalPanel}
        >
          <InternationalMarketingPanel
            properties={data?.properties || []}
            campaigns={internationalCampaigns}
            loading={loading}
            onGenerated={fetchData}
          />
        </TabsContent>

        <TabsContent value="history" className={styles.historyPanel}>
          <section className={styles.historyHeader}>
            <div>
              <p className={styles.eyebrow}>Gerçek kayıtlar</p>
              <h2>Eski çalışmalarım</h2>
              <p>
                Stüdyo/Reklam Tasarımı çıktılarınız ve hazırladığınız kampanya
                paketleri burada birlikte görünür.
              </p>
            </div>
            <Badge>
              {(data?.creativeAssets.length ?? 0) +
                (data?.campaigns.length ?? 0)}{" "}
              çalışma
            </Badge>
          </section>

          {loading ? (
            <LoadingSkeleton rows={4} />
          ) : !data || (data.creativeAssets.length === 0 && data.campaigns.length === 0) ? (
            <EmptyState
              icon={History}
              title="Henüz kayıtlı çalışma yok"
              description="İlk kampanyanızı hazırladığınızda veya Stüdyo'dan bir çalışma kaydettiğinizde burada görünür."
            />
          ) : (
            <div className={styles.historyGrid}>
              {data.creativeAssets.map((asset) => (
                <article key={`${asset.kind}:${asset.id}`} className={styles.historyCard}>
                  <div className={styles.historyVisual}>
                    {asset.kind === "VIDEO" ? (
                      <video src={asset.previewUrl} controls preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.previewUrl} alt={asset.title} />
                    )}
                  </div>
                  <div>
                    <Badge variant="outline">{asset.kind === "VIDEO" ? "Video" : "Poster"}</Badge>
                    <h3>{asset.title}</h3>
                    <p>{asset.property.referenceCode ? `${asset.property.referenceCode} · ` : ""}{asset.property.title}</p>
                    <Button asChild variant="outline" className={styles.secondaryButton}>
                      <a href={asset.downloadUrl} download>
                        <Download /> İndir
                      </a>
                    </Button>
                  </div>
                </article>
              ))}
              {data.campaigns.map((campaign) => (
                <article key={campaign.id} className={styles.historyCard}>
                  <div className={styles.historyCampaignIcon}>
                    <Megaphone aria-hidden="true" />
                  </div>
                  <div>
                    <Badge variant="outline">{PUBLICATION_LABELS[campaign.publicationStatus]}</Badge>
                    <h3>{campaign.name}</h3>
                    <p>{campaign.property?.title || "Şirket kampanyası"} · {campaign.adCopies.length} kanal</p>
                    <Button type="button" variant="outline" className={styles.secondaryButton} onClick={() => {
                      setActiveTab(campaign.type === "international" ? "international" : "domestic");
                      setExpanded((current) => ({ ...current, [campaign.id]: true }));
                    }}>
                      Çalışmayı aç
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

    </main>
  );
}
