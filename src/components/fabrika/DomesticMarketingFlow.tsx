"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileDown,
  Globe2,
  ImageIcon,
  Loader2,
  Mail,
  Megaphone,
  MessageCircle,
  MonitorPlay,
  PackageCheck,
  Rocket,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  Users2,
  Video,
} from "lucide-react";
import type { AdPlatform } from "@prisma/client";
import { toast } from "sonner";
import type { MarketingCreativeAsset } from "@/lib/marketing-creative-assets";
import {
  MARKETING_CHANNELS,
  marketingChannelLabel,
} from "@/lib/marketing-channels";
import styles from "./DomesticMarketingFlow.module.css";

export type DomesticMarketingProperty = {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  imageUrl: string | null;
  referenceCode: string | null;
  status: string;
  media?: Array<{
    id: string;
    url: string;
    fileName: string;
    isCover: boolean;
  }>;
};

export type DomesticMarketingAdCopy = {
  id: string;
  platform: AdPlatform;
  headline: string;
  body: string;
  callToAction: string | null;
  targetUrl: string | null;
  approved: boolean;
};

export type DomesticMarketingCampaign = {
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
  publicationStatus:
    | "DRAFT"
    | "READY_TO_PUBLISH"
    | "EXPORTED"
    | "MANUALLY_CONFIRMED";
  externalPublicationUrl: string | null;
  createdAt: string;
  property: Omit<DomesticMarketingProperty, "status"> | null;
  adCopies: DomesticMarketingAdCopy[];
};

type DomesticMarketingFlowProps = {
  companyName: string;
  properties: DomesticMarketingProperty[];
  campaigns: DomesticMarketingCampaign[];
  creativeAssets: MarketingCreativeAsset[];
  initialPropertyId?: string;
  loading?: boolean;
  isOnline?: boolean;
  onRefresh: () => Promise<void>;
  onOpenHistory?: () => void;
};

type FlowStep = 1 | 2 | 3 | 4;
type CampaignType = "listing" | "brand" | "website";
type GoalId = "LEADS" | "FAST" | "BRAND";

const DOMESTIC_FLOW_STEPS: Array<{
  id: FlowStep;
  label: string;
  detail: string;
}> = [
  { id: 1, label: "Kaynak", detail: "Neyi tanıtıyoruz?" },
  { id: 2, label: "Hedef", detail: "Ne sonuç istiyoruz?" },
  { id: 3, label: "İçerikler", detail: "Kanal ve görsel" },
  { id: 4, label: "Yayın", detail: "Kontrol ve yayın" },
];

const GOALS: Array<{
  id: GoalId;
  title: string;
  description: string;
  objective: string;
  icon: typeof Target;
  channels: AdPlatform[];
}> = [
  {
    id: "LEADS",
    title: "Daha fazla müşteri talebi",
    description: "İlgilenen kişiyi mesaj, form veya aramaya yönlendirir.",
    objective: "Nitelikli müşteri talebi toplama",
    icon: Users2,
    channels: ["INSTAGRAM", "FACEBOOK", "GOOGLE_ADS", "WHATSAPP", "EMAIL"],
  },
  {
    id: "FAST",
    title: "Portföyü hızlı tanıt",
    description:
      "İlan portalları ve hızlı sosyal paylaşımla görünürlük sağlar.",
    objective: "Portföyü kısa sürede doğru alıcılara tanıtma",
    icon: Rocket,
    channels: [
      "INSTAGRAM",
      "FACEBOOK",
      "TIKTOK",
      "WHATSAPP",
      "SAHIBINDEN",
      "HEPSIEMLAK",
      "EMLAKJET",
    ],
  },
  {
    id: "BRAND",
    title: "Markamı güçlendir",
    description: "Şirketinizi güven ve uzmanlık odağında anlatır.",
    objective: "Marka bilinirliği ve güven oluşturma",
    icon: Sparkles,
    channels: ["INSTAGRAM", "FACEBOOK", "LINKEDIN", "YOUTUBE", "GOOGLE_ADS"],
  },
];

const FORMAT_OPTIONS = [
  {
    id: "square",
    label: "Kare gönderi",
    ratio: "1:1",
    detail: "Instagram · Facebook",
  },
  {
    id: "portrait",
    label: "Dikey gönderi",
    ratio: "4:5",
    detail: "Instagram akışı",
  },
  {
    id: "story",
    label: "Hikâye / Reels",
    ratio: "9:16",
    detail: "Instagram · TikTok",
  },
  {
    id: "landscape",
    label: "Yatay kapak",
    ratio: "16:9",
    detail: "YouTube · LinkedIn",
  },
  { id: "pin", label: "Pinterest", ratio: "2:3", detail: "Pinterest akışı" },
] as const;

const PUBLICATION_LABELS: Record<
  DomesticMarketingCampaign["publicationStatus"],
  string
> = {
  DRAFT: "Taslak",
  READY_TO_PUBLISH: "Yayın paketi hazırlanabilir",
  EXPORTED: "Paket indirilmeye hazır",
  MANUALLY_CONFIRMED: "Dış yayın doğrulandı",
};

function money(value: number | null) {
  if (!value) return "Fiyat bilgisi yok";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

function channelIcon(platform: AdPlatform) {
  if (platform === "INSTAGRAM") return Camera;
  if (platform === "GOOGLE_ADS") return Search;
  if (platform === "WHATSAPP") return MessageCircle;
  if (platform === "EMAIL") return Mail;
  if (["YOUTUBE", "TIKTOK"].includes(platform)) return Video;
  if (["SAHIBINDEN", "HEPSIEMLAK", "EMLAKJET"].includes(platform)) {
    return Building2;
  }
  if (["TELEGRAM", "SMS"].includes(platform)) return Send;
  return Megaphone;
}

function readableAdCopy(copy: DomesticMarketingAdCopy) {
  if (copy.platform === "INSTAGRAM") {
    try {
      const parsed = JSON.parse(copy.body) as {
        caption?: string;
        hashtags?: string[];
      };
      const body = parsed.caption || copy.body;
      const tags = Array.isArray(parsed.hashtags)
        ? parsed.hashtags.join(" ")
        : "";
      return {
        headline: copy.headline,
        sections: [{ label: "Gönderi metni", value: body }],
        tags,
        fullText: [copy.headline, body, tags, copy.callToAction]
          .filter(Boolean)
          .join("\n\n"),
      };
    } catch {
      // The deterministic fallback is JSON, but legacy campaigns can be plain text.
    }
  }

  if (copy.platform === "GOOGLE_ADS") {
    try {
      const headlines = JSON.parse(copy.headline) as Record<string, string>;
      const descriptions = JSON.parse(copy.body) as Record<string, string>;
      const sections = [
        ...Object.values(headlines).map((value, index) => ({
          label: `Başlık ${index + 1}`,
          value,
        })),
        ...Object.values(descriptions).map((value, index) => ({
          label: `Açıklama ${index + 1}`,
          value,
        })),
      ].filter((section) => section.value);
      return {
        headline: "Google arama reklamı",
        sections,
        tags: "",
        fullText: sections.map((section) => section.value).join("\n"),
      };
    } catch {
      // Legacy campaigns can be plain text.
    }
  }

  return {
    headline: copy.headline,
    sections: [{ label: "Yayın metni", value: copy.body }],
    tags: "",
    fullText: [copy.headline, copy.body, copy.callToAction]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export default function DomesticMarketingFlow({
  companyName,
  properties,
  campaigns,
  creativeAssets,
  initialPropertyId = "",
  loading = false,
  isOnline = true,
  onRefresh,
  onOpenHistory,
}: DomesticMarketingFlowProps) {
  const [step, setStep] = useState<FlowStep>(1);
  const [campaignType, setCampaignType] = useState<CampaignType>("listing");
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [goalId, setGoalId] = useState<GoalId>("LEADS");
  const [selectedChannels, setSelectedChannels] = useState<AdPlatform[]>(
    GOALS[0].channels,
  );
  const [audience, setAudience] = useState(
    "Bölgedeki alıcılar ve yatırımcılar",
  );
  const [tone, setTone] = useState("professional");
  const [posterTemplate, setPosterTemplate] = useState("SIGNATURE");
  const [targetUrl, setTargetUrl] = useState("");
  const [creativeKey, setCreativeKey] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [resultCampaignId, setResultCampaignId] = useState<string | null>(null);
  const [resultSnapshot, setResultSnapshot] =
    useState<DomesticMarketingCampaign | null>(null);
  const [activeCopyId, setActiveCopyId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [publicationBusy, setPublicationBusy] = useState<string | null>(null);
  const [publicationUrl, setPublicationUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [analyzingWebsite, setAnalyzingWebsite] = useState(false);
  const [activeGalleryUrl, setActiveGalleryUrl] = useState("");

  const selectedProperty = useMemo(
    () =>
      properties.find((property) => property.id === propertyId) ||
      properties.find((property) => property.id === initialPropertyId) ||
      properties[0] ||
      null,
    [initialPropertyId, properties, propertyId],
  );
  const effectivePropertyId = selectedProperty?.id || "";

  const propertyGallery = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ id: string; url: string; label: string }> = [];
    const addItem = (
      id: string,
      url: string | null | undefined,
      label: string,
    ) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      items.push({ id, url, label });
    };

    addItem(
      "property-cover",
      selectedProperty?.imageUrl,
      "Portföy kapak fotoğrafı",
    );
    for (const media of selectedProperty?.media || []) {
      addItem(media.id, media.url, media.fileName || "Portföy fotoğrafı");
    }
    return items.slice(0, 12);
  }, [selectedProperty]);

  const activeGalleryItem =
    propertyGallery.find((item) => item.url === activeGalleryUrl) ||
    propertyGallery[0] ||
    null;

  const selectedGoal = GOALS.find((goal) => goal.id === goalId) || GOALS[0];
  const availableCreativeAssets = useMemo(
    () =>
      creativeAssets.filter(
        (asset) => asset.propertyId === effectivePropertyId,
      ),
    [creativeAssets, effectivePropertyId],
  );
  const selectedCreative = availableCreativeAssets.find(
    (asset) => `${asset.kind}:${asset.id}` === creativeKey,
  );
  const resultCampaign = useMemo(
    () =>
      campaigns.find((campaign) => campaign.id === resultCampaignId) ||
      (resultSnapshot?.id === resultCampaignId ? resultSnapshot : null),
    [campaigns, resultCampaignId, resultSnapshot],
  );
  const activeCopy =
    resultCampaign?.adCopies.find((copy) => copy.id === activeCopyId) ||
    resultCampaign?.adCopies[0] ||
    null;

  function chooseGoal(nextGoal: (typeof GOALS)[number]) {
    setGoalId(nextGoal.id);
    setSelectedChannels(nextGoal.channels);
  }

  function chooseCampaignType(nextType: CampaignType) {
    setCampaignType(nextType);
    setStep(1);
    setResultCampaignId(null);
    setResultSnapshot(null);
    setGenerationError(null);
  }

  function toggleChannel(platform: AdPlatform) {
    setSelectedChannels((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  function goToPrepare() {
    if (campaignType === "listing" && !effectivePropertyId) {
      toast.error("Devam etmek için bir portföy seçin.");
      return;
    }
    if (campaignType === "brand" && goalId !== "BRAND") {
      chooseGoal(GOALS[2]);
    }
    setStep(2);
  }

  async function analyzeWebsite() {
    if (!isOnline) {
      toast.error("Site planı için internet bağlantısı gerekiyor.");
      return;
    }
    const rawUrl = websiteUrl.trim();
    if (!rawUrl) {
      toast.error("Önce web sitesi adresini yazın.");
      return;
    }
    const normalizedUrl = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;
    setAnalyzingWebsite(true);
    try {
      const response = await fetch("/api/fabrika/marketing/website-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: normalizedUrl }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Web sitesi planı hazırlanamadı.");
      }
      setWebsiteUrl(normalizedUrl);
      toast.success("Web sitesi reklam planınız hazır.");
      try {
        await onRefresh();
      } catch {
        toast.warning("Plan kaydedildi; çalışma listesi şu an yenilenemedi.");
      }
      onOpenHistory?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Web sitesi planı hazırlanamadı.",
      );
    } finally {
      setAnalyzingWebsite(false);
    }
  }

  function goToReview() {
    if (!selectedChannels.length) {
      toast.error("En az bir yayın kanalı seçin.");
      return;
    }
    setStep(4);
  }

  async function generateCampaign() {
    if (!isOnline) {
      toast.error("Yeni çalışma için internet bağlantısı gerekiyor.");
      return;
    }
    if (campaignType === "listing" && !effectivePropertyId) {
      toast.error("Önce aktif bir portföy seçin.");
      return;
    }
    setGenerating(true);
    setGenerationError(null);
    try {
      const response = await fetch("/api/fabrika/marketing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: campaignType,
          propertyId:
            campaignType === "listing" ? effectivePropertyId : undefined,
          objective: selectedGoal.objective,
          audience,
          tone,
          posterTemplate,
          targetUrl,
          channels: selectedChannels,
          creativeAsset: selectedCreative
            ? { id: selectedCreative.id, kind: selectedCreative.kind }
            : undefined,
        }),
      });
      const body = (await response.json()) as DomesticMarketingCampaign & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "Kampanya hazırlanamadı.");
      setResultSnapshot(body);
      setResultCampaignId(body.id);
      setActiveCopyId(body.adCopies[0]?.id || null);
      toast.success("Kampanyanız ve kanal metinleriniz hazır.");
      void onRefresh().catch(() => {
        toast.warning(
          "Kampanya hazır; çalışma listesi şu an yenilenemedi. Sonuç ekranda korunuyor.",
        );
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kampanya hazırlanamadı.";
      setGenerationError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  async function toggleApprove(copy: DomesticMarketingAdCopy) {
    try {
      const response = await fetch("/api/fabrika/marketing/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adCopyId: copy.id, approved: !copy.approved }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || "Onay durumu değiştirilemedi.");
      await onRefresh();
      toast.success(
        copy.approved ? "İçerik taslağa alındı." : "İçerik onaylandı.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "İşlem tamamlanamadı.",
      );
    }
  }

  async function updatePublication(action: "PREPARE" | "EXPORT" | "CONFIRM") {
    if (!resultCampaign) return;
    if (action === "CONFIRM" && !publicationUrl.trim()) {
      toast.error("Dış platformdaki yayın bağlantısını girin.");
      return;
    }
    setPublicationBusy(action);
    try {
      const response = await fetch(
        `/api/fabrika/marketing/campaigns/${resultCampaign.id}/publication`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(action === "CONFIRM"
              ? { externalUrl: publicationUrl.trim() }
              : {}),
          }),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || "Yayın adımı tamamlanamadı.");
      await onRefresh();
      toast.success(
        action === "PREPARE"
          ? "Kampanya yayın paketine hazır."
          : action === "EXPORT"
            ? "Yayın paketi oluşturuldu."
            : "Dış platform yayını doğrulandı.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Yayın adımı tamamlanamadı.",
      );
    } finally {
      setPublicationBusy(null);
    }
  }

  async function copyActiveContent() {
    if (!activeCopy) return;
    const content = readableAdCopy(activeCopy).fullText;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast.success(
        `${marketingChannelLabel(activeCopy.platform)} metni kopyalandı.`,
      );
    } catch {
      toast.error("Metin kopyalanamadı.");
    }
  }

  const allApproved = Boolean(
    resultCampaign?.adCopies.length &&
    resultCampaign.adCopies.every((copy) => copy.approved),
  );

  return (
    <div className={styles.flow} aria-busy={generating}>
      <div className={styles.studioShell}>
        <aside className={styles.studioRail} aria-label="Kampanya kaynakları">
          <div className={styles.railHeading}>
            <span>
              <Megaphone />
            </span>
            <div>
              <p>Yeni çalışma</p>
              <h2>Neyi tanıtacağız?</h2>
            </div>
          </div>
          <div className={styles.sourceChoices}>
            {[
              {
                id: "listing" as const,
                title: "Portföy kampanyası",
                detail: "Bir ilanı öne çıkar",
                icon: Building2,
              },
              {
                id: "brand" as const,
                title: "Şirket tanıtımı",
                detail: "Markanı ve hizmetlerini anlat",
                icon: Megaphone,
              },
              {
                id: "website" as const,
                title: "Web sitesi planı",
                detail: "Siten için reklam yolunu çıkar",
                icon: Globe2,
              },
            ].map((source) => {
              const Icon = source.icon;
              return (
                <button
                  key={source.id}
                  type="button"
                  data-selected={campaignType === source.id}
                  onClick={() => chooseCampaignType(source.id)}
                >
                  <span>
                    <Icon />
                  </span>
                  <span>
                    <strong>{source.title}</strong>
                    <small>{source.detail}</small>
                  </span>
                  {campaignType === source.id ? <Check /> : <ArrowRight />}
                </button>
              );
            })}
          </div>
          <div className={styles.railProgress}>
            <p>Kampanya durumu</p>
            <strong>
              {step === 4 && resultCampaign ? "Hazır" : `${step}. adımdayız`}
            </strong>
            <div>
              <span style={{ width: `${(step / 4) * 100}%` }} />
            </div>
            <small>
              {step === 4
                ? "Son kontrol ve yayın"
                : "Seçimleriniz otomatik kaydedilir."}
            </small>
          </div>
          <div className={styles.recentWorks}>
            <div>
              <strong>Son çalışmalar</strong>
              {onOpenHistory && (
                <button type="button" onClick={onOpenHistory}>
                  Tümünü gör
                </button>
              )}
            </div>
            {campaigns.slice(0, 3).map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => {
                  setResultCampaignId(campaign.id);
                  setActiveCopyId(campaign.adCopies[0]?.id || null);
                  setStep(4);
                }}
              >
                <span>
                  {campaign.type === "listing" ? <Building2 /> : <Megaphone />}
                </span>
                <span>
                  <strong>{campaign.name}</strong>
                  <small>
                    {new Date(campaign.createdAt).toLocaleDateString("tr-TR")}
                  </small>
                </span>
                <ArrowRight />
              </button>
            ))}
            {!campaigns.length && (
              <p className={styles.noRecentWorks}>
                İlk kampanyanız burada görünecek.
              </p>
            )}
          </div>
        </aside>

        <div className={styles.studioCanvas}>
          <nav
            className={styles.stepper}
            aria-label="Yurt içi kampanya adımları"
          >
            {DOMESTIC_FLOW_STEPS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => item.id < step && setStep(item.id)}
                disabled={item.id > step}
                data-active={item.id === step}
                data-complete={item.id < step}
                aria-current={item.id === step ? "step" : undefined}
              >
                <span>{item.id < step ? <Check /> : item.id}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              </button>
            ))}
          </nav>

          {step === 1 && campaignType === "listing" && (
            <section
              className={styles.galleryStage}
              aria-labelledby="domestic-gallery-title"
            >
              <div className={styles.campaignDeskLayout}>
                <div className={styles.galleryMain}>
                  {loading ? (
                    <div className={styles.gallerySkeleton} />
                  ) : selectedProperty ? (
                    <>
                      <div
                        className={styles.galleryHero}
                        style={
                          activeGalleryItem
                            ? {
                                backgroundImage: `url("${activeGalleryItem.url}")`,
                              }
                            : undefined
                        }
                        role="img"
                        aria-label={`${selectedProperty.title} seçili portföy görseli`}
                      >
                        {!activeGalleryItem && <ImageIcon aria-hidden="true" />}
                        <span className={styles.galleryLabel}>
                          <Camera aria-hidden="true" /> Seçilen portföy
                        </span>
                      </div>

                      <div
                        className={styles.galleryStrip}
                        aria-label="Portföy fotoğrafları"
                      >
                        {propertyGallery.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            data-active={activeGalleryItem?.url === item.url}
                            onClick={() => setActiveGalleryUrl(item.url)}
                            aria-label={`${index + 1}. fotoğrafı göster: ${item.label}`}
                            aria-pressed={activeGalleryItem?.url === item.url}
                            style={{ backgroundImage: `url("${item.url}")` }}
                          />
                        ))}
                        {!propertyGallery.length && (
                          <div className={styles.galleryEmptyThumb}>
                            <ImageIcon aria-hidden="true" />
                            Fotoğraf bekleniyor
                          </div>
                        )}
                      </div>

                      <div className={styles.portfolioFacts}>
                        <div>
                          <span>
                            {selectedProperty.referenceCode || "Aktif portföy"}
                          </span>
                          <h2 id="domestic-gallery-title">
                            {selectedProperty.title}
                          </h2>
                          <p>
                            {selectedProperty.location || "Konum bilgisi yok"}
                          </p>
                        </div>
                        <strong>{money(selectedProperty.price)}</strong>
                      </div>

                      <div className={styles.portfolioSelectRow}>
                        <label htmlFor="marketing-property">
                          <span>Tanıtılacak portföy</span>
                          <select
                            id="marketing-property"
                            value={effectivePropertyId}
                            onChange={(event) => {
                              setPropertyId(event.target.value);
                              setCreativeKey("");
                              setActiveGalleryUrl("");
                            }}
                            disabled={loading || !properties.length}
                          >
                            {properties.map((property) => (
                              <option key={property.id} value={property.id}>
                                {property.referenceCode
                                  ? `${property.referenceCode} · `
                                  : ""}
                                {property.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span>
                          <CheckCircle2 aria-hidden="true" /> Aktif portföy
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className={styles.emptyNotice}>
                      <Building2 />
                      <div>
                        <strong>
                          Henüz tanıtabileceğiniz aktif portföy yok.
                        </strong>
                        <p>
                          Portföy ekleyebilir veya şirket tanıtımıyla devam
                          edebilirsiniz.
                        </p>
                      </div>
                      <a href="/fabrika/portfoyler">
                        Portföy ekle <ArrowRight />
                      </a>
                    </div>
                  )}
                </div>

                <div className={styles.strategyColumn}>
                  <article className={styles.strategyCard}>
                    <span>
                      <Target aria-hidden="true" />
                    </span>
                    <div>
                      <small>Kampanya amacı</small>
                      <h3>{selectedGoal.title}</h3>
                      <p>{selectedGoal.description}</p>
                      <em>2. adımda değiştirebilirsiniz</em>
                    </div>
                  </article>

                  <article className={styles.strategyCard}>
                    <span>
                      <Users2 aria-hidden="true" />
                    </span>
                    <div>
                      <small>Hedef kitle</small>
                      <h3>{audience}</h3>
                      <p>
                        Sistem konum, amaç ve seçilen kanallara göre kitleyi
                        netleştirecek.
                      </p>
                      <ul>
                        {selectedGoal.channels.slice(0, 3).map((channel) => (
                          <li key={channel}>
                            <Check aria-hidden="true" />
                            {marketingChannelLabel(channel)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </div>

                <aside
                  className={styles.livePreview}
                  aria-label="Yayın önizlemesi"
                >
                  <div className={styles.livePreviewHeader}>
                    <div>
                      <p>Yayın önizlemesi</p>
                      <span>İçerik üretilmeden önce taslak görünüm</span>
                    </div>
                    <div aria-label="Önerilen kanallar">
                      {selectedGoal.channels.slice(0, 4).map((channel) => {
                        const ChannelIcon = channelIcon(channel);
                        return (
                          <span
                            key={channel}
                            title={marketingChannelLabel(channel)}
                          >
                            <ChannelIcon aria-hidden="true" />
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.phonePreview}>
                    <div className={styles.phoneTop}>
                      <span>
                        {companyName.slice(0, 1).toLocaleUpperCase("tr-TR")}
                      </span>
                      <div>
                        <strong>{companyName}</strong>
                        <small>Taslak gönderi</small>
                      </div>
                      <b>•••</b>
                    </div>
                    <div
                      className={styles.phoneImage}
                      style={
                        activeGalleryItem
                          ? {
                              backgroundImage: `url("${activeGalleryItem.url}")`,
                            }
                          : undefined
                      }
                    >
                      {!activeGalleryItem && <ImageIcon aria-hidden="true" />}
                      {selectedProperty && (
                        <div>
                          <strong>{selectedProperty.title}</strong>
                          <span>
                            {selectedProperty.location || "Konum bilgisi yok"}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className={styles.phoneActions} aria-hidden="true">
                      <span>♡</span>
                      <span>○</span>
                      <span>⌁</span>
                      <span>◇</span>
                    </div>
                    <p>
                      Metin, başlık ve çağrı cümlesi içerikler adımında otomatik
                      hazırlanacak.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={styles.livePreviewAction}
                    onClick={goToPrepare}
                    disabled={!isOnline || !effectivePropertyId}
                  >
                    İleri: Hedefi seç <ArrowRight />
                  </button>
                </aside>
              </div>
            </section>
          )}

          {step === 1 && campaignType !== "listing" && (
            <section
              className={styles.stage}
              aria-labelledby="domestic-step-one"
            >
              <div className={styles.stageHeading}>
                <span>1</span>
                <div>
                  <p>İlk seçim</p>
                  <h2 id="domestic-step-one">Ne tanıtmak istiyorsunuz?</h2>
                  <p>Bir seçim yapın; gerisini sistem sizin için hazırlasın.</p>
                </div>
              </div>

              <div className={styles.sourceNotice}>
                <span>
                  {campaignType === "brand" ? <Megaphone /> : <Globe2 />}
                </span>
                <div>
                  <strong>
                    {campaignType === "brand"
                      ? "Şirket tanıtımı"
                      : "Web sitesi reklam planı"}
                  </strong>
                  <p>
                    Kaynağı değiştirmek isterseniz soldaki seçenekleri
                    kullanabilirsiniz.
                  </p>
                </div>
                <Check />
              </div>

              {campaignType === "brand" && (
                <div className={styles.brandSummary}>
                  <span>
                    <Sparkles />
                  </span>
                  <div>
                    <strong>{companyName}</strong>
                    <p>
                      Portföy seçmeden marka güveni ve müşteri kazanımı odaklı
                      içerik hazırlanır.
                    </p>
                  </div>
                </div>
              )}

              {campaignType === "website" && (
                <div className={styles.websiteSummary}>
                  <span>
                    <Globe2 />
                  </span>
                  <label htmlFor="marketing-website-url">
                    <strong>Web sitesi adresiniz</strong>
                    <small>Başına https:// yazmasanız da olur.</small>
                    <input
                      id="marketing-website-url"
                      type="url"
                      inputMode="url"
                      value={websiteUrl}
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder="orneksite.com"
                      disabled={analyzingWebsite}
                    />
                  </label>
                </div>
              )}

              <div className={styles.stageActions}>
                <span />
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() =>
                    campaignType === "website"
                      ? void analyzeWebsite()
                      : goToPrepare()
                  }
                  disabled={
                    analyzingWebsite ||
                    !isOnline ||
                    (campaignType === "website" && !websiteUrl.trim())
                  }
                >
                  {analyzingWebsite ? (
                    <>
                      <Loader2 className={styles.spin} /> Site inceleniyor…
                    </>
                  ) : campaignType === "website" ? (
                    <>
                      Site planını hazırla <ArrowRight />
                    </>
                  ) : (
                    <>
                      Devam et <ArrowRight />
                    </>
                  )}
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section
              className={styles.stage}
              aria-labelledby="domestic-step-two"
            >
              <div className={styles.stageHeading}>
                <span>2</span>
                <div>
                  <p>Akıllı hazırlık</p>
                  <h2 id="domestic-step-two">Nasıl bir sonuç istiyorsunuz?</h2>
                  <p>Amacı seçtiğinizde uygun kanallar otomatik işaretlenir.</p>
                </div>
              </div>

              <div className={styles.goalGrid}>
                {GOALS.map((goal) => {
                  const Icon = goal.icon;
                  return (
                    <button
                      type="button"
                      key={goal.id}
                      className={styles.goalCard}
                      data-selected={goal.id === goalId}
                      onClick={() => chooseGoal(goal)}
                    >
                      <span>
                        <Icon />
                      </span>
                      <strong>{goal.title}</strong>
                      <small>{goal.description}</small>
                      {goal.id === goalId && (
                        <b>
                          <Check /> Seçildi
                        </b>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className={styles.stageActions}>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft /> Geri
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => setStep(3)}
                >
                  İçerikleri seç <ArrowRight />
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section
              className={styles.stage}
              aria-labelledby="domestic-step-three"
            >
              <div className={styles.stageHeading}>
                <span>3</span>
                <div>
                  <p>İçerik masası</p>
                  <h2 id="domestic-step-three">
                    Kanal ve görsel paketini seçin
                  </h2>
                  <p>
                    Önerilen paket hazır. Dilerseniz kanalları, görseli ve tonu
                    değiştirebilirsiniz.
                  </p>
                </div>
              </div>

              <div className={styles.recommendedPack}>
                <div>
                  <span>
                    <PackageCheck />
                  </span>
                  <div>
                    <strong>Önerilen kanal paketi</strong>
                    <p>
                      {selectedChannels.length} kanal seçili. İsterseniz
                      değiştirebilirsiniz.
                    </p>
                  </div>
                </div>
                <div className={styles.channelSummary}>
                  {selectedChannels.slice(0, 7).map((platform) => {
                    const Icon = channelIcon(platform);
                    return (
                      <span key={platform}>
                        <Icon />
                        {marketingChannelLabel(platform)}
                      </span>
                    );
                  })}
                  {selectedChannels.length > 7 && (
                    <span>+{selectedChannels.length - 7}</span>
                  )}
                </div>
              </div>

              {campaignType === "listing" && (
                <div className={styles.creativeSection}>
                  <div className={styles.sectionLabel}>
                    <Camera />
                    <div>
                      <strong>Hangi görsel kullanılsın?</strong>
                      <small>
                        Bir şey seçmezseniz portföy fotoğrafı kullanılır.
                      </small>
                    </div>
                  </div>
                  <div className={styles.creativeOptions}>
                    <button
                      type="button"
                      data-selected={!creativeKey}
                      onClick={() => setCreativeKey("")}
                    >
                      <ImageIcon />
                      <span>
                        <strong>Portföy fotoğrafı</strong>
                        <small>En kolay seçim</small>
                      </span>
                      {!creativeKey && <Check />}
                    </button>
                    {availableCreativeAssets.map((asset) => {
                      const key = `${asset.kind}:${asset.id}`;
                      return (
                        <button
                          key={key}
                          type="button"
                          data-selected={creativeKey === key}
                          onClick={() => setCreativeKey(key)}
                        >
                          {asset.kind === "VIDEO" ? <Video /> : <ImageIcon />}
                          <span>
                            <strong>{asset.title}</strong>
                            <small>
                              {asset.kind === "VIDEO"
                                ? "Stüdyo videosu"
                                : "Hazır poster"}
                            </small>
                          </span>
                          {creativeKey === key && <Check />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <details className={styles.advanced}>
                <summary>
                  <Settings2 /> Kanalları ve ayrıntıları değiştir{" "}
                  <ChevronDown />
                </summary>
                <div className={styles.advancedBody}>
                  <fieldset>
                    <legend>Yayın kanalları</legend>
                    <div className={styles.channelGrid}>
                      {MARKETING_CHANNELS.map((channel) => {
                        const Icon = channelIcon(channel.id);
                        const checked = selectedChannels.includes(channel.id);
                        return (
                          <label key={channel.id} data-selected={checked}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleChannel(channel.id)}
                            />
                            <Icon />
                            <span>
                              <strong>{channel.label}</strong>
                              <small>{channel.group}</small>
                            </span>
                            <span className={styles.checkBox}>
                              {checked && <Check />}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <div className={styles.formGrid}>
                    <label>
                      <span>Hedef kitle</span>
                      <input
                        value={audience}
                        onChange={(event) => setAudience(event.target.value)}
                        maxLength={160}
                      />
                    </label>
                    <label>
                      <span>İletişim tonu</span>
                      <select
                        value={tone}
                        onChange={(event) => setTone(event.target.value)}
                      >
                        <option value="professional">
                          Profesyonel ve güven veren
                        </option>
                        <option value="warm">Sıcak ve samimi</option>
                        <option value="premium">Seçkin ve premium</option>
                      </select>
                    </label>
                    <label>
                      <span>Görsel stili</span>
                      <select
                        value={posterTemplate}
                        onChange={(event) =>
                          setPosterTemplate(event.target.value)
                        }
                      >
                        <option value="SIGNATURE">
                          İmza — temiz ve kurumsal
                        </option>
                        <option value="EDITORIAL">
                          Editoryal — sakin ve seçkin
                        </option>
                        <option value="BOLD">Güçlü — dikkat çekici</option>
                      </select>
                    </label>
                    <label>
                      <span>Hedef bağlantı (isteğe bağlı)</span>
                      <input
                        type="url"
                        value={targetUrl}
                        onChange={(event) => setTargetUrl(event.target.value)}
                        placeholder="https://..."
                      />
                    </label>
                  </div>
                </div>
              </details>

              <div className={styles.stageActions}>
                <button
                  type="button"
                  className={styles.backButton}
                  onClick={() => setStep(2)}
                >
                  <ArrowLeft /> Geri
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={goToReview}
                >
                  Kontrol et <ArrowRight />
                </button>
              </div>
            </section>
          )}

          {step === 4 && (
            <section
              className={styles.stage}
              aria-labelledby="domestic-step-four"
            >
              <div className={styles.stageHeading}>
                <span>4</span>
                <div>
                  <p>Son kontrol</p>
                  <h2 id="domestic-step-four">
                    {resultCampaign
                      ? "Kampanyanız hazır"
                      : "Hazırlamadan önce kontrol edin"}
                  </h2>
                  <p>
                    {resultCampaign
                      ? "Metinleri tek tek kontrol edin, kopyalayın ve yayın paketini indirin."
                      : "Seçimleriniz doğruysa tek tuşla bütün kanal içeriklerini oluşturun."}
                  </p>
                </div>
              </div>

              {!resultCampaign ? (
                <div className={styles.reviewCard}>
                  <div className={styles.reviewPrimary}>
                    <span>
                      {campaignType === "listing" ? (
                        <Building2 />
                      ) : (
                        <Megaphone />
                      )}
                    </span>
                    <div>
                      <small>Tanıtılacak çalışma</small>
                      <strong>
                        {campaignType === "listing"
                          ? selectedProperty?.title
                          : companyName}
                      </strong>
                      <p>
                        {campaignType === "listing"
                          ? selectedProperty?.location
                          : "Şirket tanıtımı"}
                      </p>
                    </div>
                  </div>
                  <dl>
                    <div>
                      <dt>Amaç</dt>
                      <dd>{selectedGoal.title}</dd>
                    </div>
                    <div>
                      <dt>Hedef kitle</dt>
                      <dd>{audience}</dd>
                    </div>
                    <div>
                      <dt>Kanallar</dt>
                      <dd>{selectedChannels.length} yayın kanalı</dd>
                    </div>
                    <div>
                      <dt>Görsel</dt>
                      <dd>
                        {selectedCreative?.title ||
                          "Portföy fotoğrafı / marka şablonu"}
                      </dd>
                    </div>
                  </dl>
                  <div className={styles.formatPreview}>
                    <strong>Sosyal medya görsel seti</strong>
                    <p>
                      Kampanyadan sonra her platform için doğru ölçüyü ayrı
                      indirebilirsiniz.
                    </p>
                    <div>
                      {FORMAT_OPTIONS.map((format) => (
                        <span key={format.id}>
                          <b>{format.ratio}</b>
                          {format.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {generationError && (
                    <div className={styles.errorBox} role="alert">
                      <strong>Kampanya hazırlanamadı</strong>
                      <p>{generationError}</p>
                      <button
                        type="button"
                        onClick={() => void generateCampaign()}
                      >
                        Yeniden dene
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.generateButton}
                    onClick={() => void generateCampaign()}
                    disabled={generating || !isOnline}
                  >
                    {generating ? (
                      <Loader2 className={styles.spin} />
                    ) : (
                      <Sparkles />
                    )}
                    <span>
                      <strong>
                        {generating
                          ? "Kampanya hazırlanıyor…"
                          : "Kampanyayı oluştur"}
                      </strong>
                      <small>
                        {generating
                          ? "Kanal metinleri ve görsel paket hazırlanıyor"
                          : `${selectedChannels.length} kanala özel içerik üret`}
                      </small>
                    </span>
                    {!generating && <ArrowRight />}
                  </button>
                  <p className={styles.liveStatus} aria-live="polite">
                    {generating
                      ? "İçerikler hazırlanıyor. Lütfen bu pencereyi kapatmayın."
                      : ""}
                  </p>
                </div>
              ) : (
                <div className={styles.resultWorkspace}>
                  <div className={styles.resultHero}>
                    <div>
                      <span className={styles.readyBadge}>
                        <CheckCircle2 /> Hazır
                      </span>
                      <h3>{resultCampaign.name}</h3>
                      <p>{resultCampaign.description}</p>
                    </div>
                    <div className={styles.resultStatus}>
                      <small>Yayın durumu</small>
                      <strong>
                        {PUBLICATION_LABELS[resultCampaign.publicationStatus]}
                      </strong>
                    </div>
                  </div>

                  {resultCampaign.posterHeadline && (
                    <section
                      className={styles.assetPack}
                      aria-labelledby="asset-pack-title"
                    >
                      <div className={styles.assetPreview}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/fabrika/marketing/poster/${resultCampaign.id}?format=portrait`}
                          alt={`${resultCampaign.name} dikey reklam önizlemesi`}
                        />
                      </div>
                      <div className={styles.assetFormats}>
                        <p>Görsel paketi</p>
                        <h3 id="asset-pack-title">
                          Her platform için doğru ölçü
                        </h3>
                        <p>
                          Tek görseli esnetmek yerine platforma uygun yerleşimi
                          ayrı indirin.
                        </p>
                        <div>
                          {FORMAT_OPTIONS.map((format) => (
                            <a
                              key={format.id}
                              href={`/api/fabrika/marketing/poster/${resultCampaign.id}?format=${format.id}&download=1`}
                            >
                              <span>
                                <ImageIcon />
                                <b>{format.ratio}</b>
                              </span>
                              <span>
                                <strong>{format.label}</strong>
                                <small>{format.detail}</small>
                              </span>
                              <Download />
                            </a>
                          ))}
                        </div>
                      </div>
                    </section>
                  )}

                  <section
                    className={styles.copyWorkspace}
                    aria-labelledby="channel-copy-title"
                  >
                    <div className={styles.copyHeading}>
                      <div>
                        <p>Kanal içerikleri</p>
                        <h3 id="channel-copy-title">
                          Bir kanalı seçip kontrol edin
                        </h3>
                      </div>
                      <span>
                        {
                          resultCampaign.adCopies.filter(
                            (copy) => copy.approved,
                          ).length
                        }
                        /{resultCampaign.adCopies.length} onaylı
                      </span>
                    </div>
                    <div
                      className={styles.copyTabs}
                      role="tablist"
                      aria-label="Kanal içerikleri"
                    >
                      {resultCampaign.adCopies.map((copy) => {
                        const Icon = channelIcon(copy.platform);
                        return (
                          <button
                            key={copy.id}
                            type="button"
                            role="tab"
                            aria-selected={activeCopy?.id === copy.id}
                            onClick={() => setActiveCopyId(copy.id)}
                            data-active={activeCopy?.id === copy.id}
                          >
                            <Icon />
                            {marketingChannelLabel(copy.platform)}
                            {copy.approved && <Check />}
                          </button>
                        );
                      })}
                    </div>
                    {activeCopy &&
                      (() => {
                        const readable = readableAdCopy(activeCopy);
                        return (
                          <article className={styles.copyPanel} role="tabpanel">
                            <div className={styles.copyPanelHeader}>
                              <div>
                                <span>
                                  {marketingChannelLabel(activeCopy.platform)}
                                </span>
                                <h4>{readable.headline}</h4>
                              </div>
                              <div>
                                <button
                                  type="button"
                                  onClick={() => void copyActiveContent()}
                                >
                                  {copied ? <Check /> : <Copy />}
                                  {copied ? "Kopyalandı" : "Metni kopyala"}
                                </button>
                                <button
                                  type="button"
                                  data-approved={activeCopy.approved}
                                  onClick={() => void toggleApprove(activeCopy)}
                                >
                                  <CheckCircle2 />
                                  {activeCopy.approved ? "Onaylandı" : "Onayla"}
                                </button>
                              </div>
                            </div>
                            <div className={styles.copySections}>
                              {readable.sections.map((section, index) => (
                                <div key={`${section.label}-${index}`}>
                                  <span>{section.label}</span>
                                  <p>{section.value}</p>
                                </div>
                              ))}
                              {readable.tags && (
                                <p className={styles.tags}>{readable.tags}</p>
                              )}
                              {activeCopy.callToAction && (
                                <div>
                                  <span>Harekete geçirici ifade</span>
                                  <p>{activeCopy.callToAction}</p>
                                </div>
                              )}
                            </div>
                            <p className={styles.channelGuide}>
                              <MonitorPlay /> Bu metin{" "}
                              {marketingChannelLabel(activeCopy.platform)} yayın
                              ekranı için ayrı hazırlandı.
                            </p>
                          </article>
                        );
                      })()}
                  </section>

                  <section className={styles.publication}>
                    <div>
                      <p>Son adım</p>
                      <h3>Yayın paketini hazırlayın</h3>
                      <p>
                        Sistem dış platformlarda kendiliğinden paylaşım yapmaz;
                        paketi indirip yayını siz tamamlarsınız.
                      </p>
                    </div>
                    {resultCampaign.publicationStatus === "DRAFT" && (
                      <div className={styles.publicationAction}>
                        <p>
                          {allApproved
                            ? "Tüm kanal içerikleri onaylandı."
                            : "Önce bütün kanal içeriklerini kontrol edip onaylayın."}
                        </p>
                        <button
                          type="button"
                          disabled={!allApproved || Boolean(publicationBusy)}
                          onClick={() => void updatePublication("PREPARE")}
                        >
                          {publicationBusy === "PREPARE" ? (
                            <Loader2 className={styles.spin} />
                          ) : (
                            <PackageCheck />
                          )}
                          Yayın paketine hazırla
                        </button>
                      </div>
                    )}
                    {resultCampaign.publicationStatus ===
                      "READY_TO_PUBLISH" && (
                      <div className={styles.publicationAction}>
                        <p>
                          Onaylı metinler tek bir yayın paketinde toplanacak.
                        </p>
                        <button
                          type="button"
                          disabled={Boolean(publicationBusy)}
                          onClick={() => void updatePublication("EXPORT")}
                        >
                          {publicationBusy === "EXPORT" ? (
                            <Loader2 className={styles.spin} />
                          ) : (
                            <FileDown />
                          )}
                          Paketi oluştur
                        </button>
                      </div>
                    )}
                    {resultCampaign.publicationStatus === "EXPORTED" && (
                      <div className={styles.exportedActions}>
                        <a
                          href={`/api/fabrika/marketing/campaigns/${resultCampaign.id}/publication?download=1`}
                        >
                          <Download /> Yayın paketini indir
                        </a>
                        <label>
                          <span>
                            Dış platformda yayınladıysanız bağlantıyı ekleyin
                          </span>
                          <input
                            type="url"
                            value={publicationUrl}
                            onChange={(event) =>
                              setPublicationUrl(event.target.value)
                            }
                            placeholder="https://..."
                          />
                        </label>
                        <button
                          type="button"
                          disabled={Boolean(publicationBusy)}
                          onClick={() => void updatePublication("CONFIRM")}
                        >
                          {publicationBusy === "CONFIRM" ? (
                            <Loader2 className={styles.spin} />
                          ) : (
                            <ExternalLink />
                          )}
                          Yayını doğrula
                        </button>
                      </div>
                    )}
                    {resultCampaign.publicationStatus ===
                      "MANUALLY_CONFIRMED" && (
                      <div className={styles.confirmedPublication}>
                        <CheckCircle2 />
                        <div>
                          <strong>Yayın bağlantısı kaydedildi</strong>
                          <p>
                            Bu kampanya artık eski çalışmalarınızdan da
                            açılabilir.
                          </p>
                        </div>
                        {resultCampaign.externalPublicationUrl && (
                          <a
                            href={resultCampaign.externalPublicationUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Yayını aç <ExternalLink />
                          </a>
                        )}
                      </div>
                    )}
                  </section>

                  <div className={styles.stageActions}>
                    <button
                      type="button"
                      className={styles.backButton}
                      onClick={() => {
                        setResultCampaignId(null);
                        setResultSnapshot(null);
                        setStep(1);
                      }}
                    >
                      <ArrowLeft /> Yeni çalışma
                    </button>
                    {onOpenHistory && (
                      <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={onOpenHistory}
                      >
                        Eski çalışmalara git <ArrowRight />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!resultCampaign && (
                <div className={styles.stageActions}>
                  <button
                    type="button"
                    className={styles.backButton}
                    onClick={() => setStep(3)}
                  >
                    <ArrowLeft /> Geri
                  </button>
                  <span />
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
