"use client";

import { useId, useMemo, useState } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileSearch,
  Globe2,
  ImageIcon,
  Languages,
  MapPin,
  Megaphone,
  RotateCcw,
  Search,
  ShieldAlert,
  Target,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import {
  getInternationalMarket,
  getInternationalPortal,
} from "@/lib/international-marketing";
import styles from "./MarketingHistoryPanel.module.css";

export type MarketingHistoryPublicationStatus =
  | "DRAFT"
  | "READY_TO_PUBLISH"
  | "EXPORTED"
  | "MANUALLY_CONFIRMED"
  | string;

export type MarketingHistoryCampaignProperty = {
  id: string;
  title: string;
  location?: string | null;
  price?: number | null;
  imageUrl?: string | null;
  referenceCode?: string | null;
};

export type MarketingHistoryAdCopy = {
  id?: string;
  platform: string;
  headline: string;
  body: string;
  callToAction?: string | null;
  targetUrl?: string | null;
  approved?: boolean;
};

export type MarketingHistoryPortalCopy = {
  portalId: string;
  portalName: string;
  title: string;
  body: string;
  steps?: string[];
  publishUrl?: string;
  pricingUrl?: string;
  pricingLabel?: string;
};

export type MarketingHistoryInternationalPlan = {
  countryCode: string;
  countryName: string;
  language?: string;
  strategy?: string;
  warnings?: string[];
  portalCopies?: MarketingHistoryPortalCopy[];
};

export type MarketingHistoryCampaign = {
  id: string;
  name: string;
  description?: string | null;
  type: "listing" | "brand" | "international" | string;
  objective?: string | null;
  audience?: string | null;
  posterHeadline?: string | null;
  posterSubline?: string | null;
  generatedBy?: string | null;
  publicationStatus?: MarketingHistoryPublicationStatus;
  exportedAt?: string | null;
  externalPublicationUrl?: string | null;
  createdAt: string;
  property?: MarketingHistoryCampaignProperty | null;
  adCopies?: MarketingHistoryAdCopy[];
  internationalPlan?: MarketingHistoryInternationalPlan | null;
};

export type MarketingHistoryCreativeAsset = {
  id: string;
  kind: "POSTER" | "VIDEO";
  propertyId: string;
  title: string;
  detail?: string | null;
  previewUrl: string;
  downloadUrl: string;
  ratio?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
  property: {
    id: string;
    title: string;
    referenceCode?: string | null;
  };
};

export type MarketingHistoryWebsiteAnalysis = {
  id: string;
  websiteUrl: string;
  domain: string;
  summary: string;
  strengths: string;
  opportunities: string;
  channelPlan: string;
  firstActions: string;
  generatedBy?: string | null;
  createdAt: string;
};

export type MarketingHistoryFilter =
  | "all"
  | "domestic"
  | "international"
  | "poster"
  | "video"
  | "website";

export type MarketingHistoryItem =
  | {
      key: string;
      kind: "campaign";
      filter: "domestic" | "international";
      createdAt: string;
      timestamp: number;
      searchText: string;
      campaign: MarketingHistoryCampaign;
    }
  | {
      key: string;
      kind: "asset";
      filter: "poster" | "video";
      createdAt: string;
      timestamp: number;
      searchText: string;
      asset: MarketingHistoryCreativeAsset;
    }
  | {
      key: string;
      kind: "website";
      filter: "website";
      createdAt: string;
      timestamp: number;
      searchText: string;
      analysis: MarketingHistoryWebsiteAnalysis;
    };

export type MarketingHistoryPanelProps = {
  campaigns: readonly MarketingHistoryCampaign[];
  creativeAssets: readonly MarketingHistoryCreativeAsset[];
  websiteAnalyses: readonly MarketingHistoryWebsiteAnalysis[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
};

const FILTERS: Array<{
  id: MarketingHistoryFilter;
  label: string;
}> = [
  { id: "all", label: "Tümü" },
  { id: "domestic", label: "Yurt İçi" },
  { id: "international", label: "Yurt Dışı" },
  { id: "poster", label: "Poster" },
  { id: "video", label: "Video" },
  { id: "website", label: "Site Analizi" },
];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Taslak",
  READY_TO_PUBLISH: "Yayına hazır",
  EXPORTED: "Paket hazır",
  MANUALLY_CONFIRMED: "Yayın doğrulandı",
};

const PLATFORM_LABELS: Record<string, string> = {
  GOOGLE_ADS: "Google Ads",
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  X: "X",
  PINTEREST: "Pinterest",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  EMAIL: "E-posta",
  SMS: "SMS",
  SAHIBINDEN: "Sahibinden",
  HEPSIEMLAK: "Hepsiemlak",
  EMLAKJET: "Emlakjet",
};

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function createMarketingHistoryItems(input: {
  campaigns: readonly MarketingHistoryCampaign[];
  creativeAssets: readonly MarketingHistoryCreativeAsset[];
  websiteAnalyses: readonly MarketingHistoryWebsiteAnalysis[];
}) {
  const campaignItems: MarketingHistoryItem[] = input.campaigns.map(
    (campaign) => {
      const filter =
        campaign.type === "international" ? "international" : "domestic";
      const plan = campaign.internationalPlan;
      return {
        key: `campaign:${campaign.id}`,
        kind: "campaign",
        filter,
        createdAt: campaign.createdAt,
        timestamp: timestamp(campaign.createdAt),
        searchText: normalizeSearch(
          [
            campaign.name,
            campaign.description,
            campaign.property?.title,
            campaign.property?.referenceCode,
            campaign.property?.location,
            plan?.countryName,
            plan?.language,
            ...(campaign.adCopies || []).map((copy) =>
              PLATFORM_LABELS[copy.platform] || copy.platform,
            ),
            ...(plan?.portalCopies || []).map((copy) => copy.portalName),
          ]
            .filter(Boolean)
            .join(" "),
        ),
        campaign,
      };
    },
  );

  const assetItems: MarketingHistoryItem[] = input.creativeAssets.map(
    (asset) => ({
      key: `asset:${asset.kind}:${asset.id}`,
      kind: "asset",
      filter: asset.kind === "VIDEO" ? "video" : "poster",
      createdAt: asset.createdAt,
      timestamp: timestamp(asset.createdAt),
      searchText: normalizeSearch(
        [
          asset.title,
          asset.detail,
          asset.property.title,
          asset.property.referenceCode,
          asset.kind,
        ]
          .filter(Boolean)
          .join(" "),
      ),
      asset,
    }),
  );

  const websiteItems: MarketingHistoryItem[] = input.websiteAnalyses.map(
    (analysis) => ({
      key: `website:${analysis.id}`,
      kind: "website",
      filter: "website",
      createdAt: analysis.createdAt,
      timestamp: timestamp(analysis.createdAt),
      searchText: normalizeSearch(
        [analysis.domain, analysis.summary, analysis.websiteUrl].join(" "),
      ),
      analysis,
    }),
  );

  return [...campaignItems, ...assetItems, ...websiteItems].sort(
    (left, right) => right.timestamp - left.timestamp,
  );
}

export function filterMarketingHistoryItems(
  items: readonly MarketingHistoryItem[],
  filter: MarketingHistoryFilter,
  query: string,
) {
  const normalizedQuery = normalizeSearch(query);
  return items.filter((item) => {
    const matchesFilter = filter === "all" || item.filter === filter;
    const matchesQuery =
      !normalizedQuery || item.searchText.includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tarih bilgisi yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim()),
        )
      : [];
  } catch {
    return value.trim() ? [value.trim()] : [];
  }
}

function parseJsonRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readableCopy(copy: MarketingHistoryAdCopy) {
  const headlineJson = parseJsonRecord(copy.headline);
  const bodyJson = parseJsonRecord(copy.body);
  const headlines = headlineJson
    ? Object.values(headlineJson).filter(
        (value): value is string => typeof value === "string",
      )
    : [copy.headline];
  const bodyParts = bodyJson
    ? Object.values(bodyJson).flatMap((value) =>
        typeof value === "string"
          ? [value]
          : Array.isArray(value)
            ? value.filter((item): item is string => typeof item === "string")
            : [],
      )
    : [copy.body];

  return {
    headline: headlines.join(" · "),
    body: bodyParts.join("\n\n"),
    fullText: [
      headlines.join("\n"),
      bodyParts.join("\n\n"),
      copy.callToAction,
      copy.targetUrl,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

function campaignStatus(campaign: MarketingHistoryCampaign) {
  const status = campaign.publicationStatus || "DRAFT";
  return STATUS_LABELS[status] || status;
}

function campaignCount(campaign: MarketingHistoryCampaign) {
  if (campaign.type === "international") {
    const count = campaign.internationalPlan?.portalCopies?.length || 0;
    return `${count} portal`;
  }
  return `${campaign.adCopies?.length || 0} kanal`;
}

export default function MarketingHistoryPanel({
  campaigns,
  creativeAssets,
  websiteAnalyses,
  loading = false,
  error = null,
  onRetry,
  className,
}: MarketingHistoryPanelProps) {
  const titleId = useId();
  const [filter, setFilter] = useState<MarketingHistoryFilter>("all");
  const [query, setQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(30);

  const items = useMemo(
    () =>
      createMarketingHistoryItems({
        campaigns,
        creativeAssets,
        websiteAnalyses,
      }),
    [campaigns, creativeAssets, websiteAnalyses],
  );
  const visibleItems = useMemo(
    () => filterMarketingHistoryItems(items, filter, query),
    [filter, items, query],
  );
  const pagedItems = visibleItems.slice(0, visibleLimit);

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(
        () => setCopiedKey((current) => (current === key ? null : current)),
        1800,
      );
    } catch {
      setCopiedKey(null);
      toast.error("Metin kopyalanamadı. Tarayıcı iznini kontrol edin.");
    }
  }

  function resetView() {
    setFilter("all");
    setQuery("");
    setVisibleLimit(30);
  }

  return (
    <section
      className={`${styles.library}${className ? ` ${className}` : ""}`}
      aria-labelledby={titleId}
    >
      <header className={styles.header}>
        <div className={styles.titleCluster}>
          <span className={styles.titleIcon} aria-hidden="true">
            <Archive />
          </span>
          <div>
            <p className={styles.eyebrow}>Çalışma kütüphanesi</p>
            <h2 id={titleId}>Eski çalışmalarım</h2>
            <p>
              Kampanyalarınız, görselleriniz ve site analizleriniz tek bir
              kronolojik listede.
            </p>
          </div>
        </div>
        <div className={styles.total} aria-label={`${items.length} çalışma`}>
          <strong>{items.length}</strong>
          <span>çalışma</span>
        </div>
      </header>

      {!loading && !error && items.length > 0 && (
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span className={styles.srOnly}>Çalışmalarda ara</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Çalışma, portföy, ülke veya kanal ara"
            />
          </label>

          <div className={styles.filters} aria-label="Çalışma türü filtreleri">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className={styles.resultCount} aria-live="polite">
        {!loading && !error && items.length > 0
          ? `${visibleItems.length} çalışma gösteriliyor`
          : ""}
      </p>

      {loading ? (
        <div className={styles.skeletonList} role="status">
          {[0, 1, 2].map((item) => (
            <div key={item} className={styles.skeletonCard}>
              <span />
              <div>
                <i />
                <i />
                <i />
              </div>
            </div>
          ))}
          <span className={styles.srOnly}>Çalışmalar yükleniyor</span>
        </div>
      ) : error ? (
        <div className={styles.state} role="alert">
          <span className={styles.stateIcon} data-tone="error">
            <ShieldAlert aria-hidden="true" />
          </span>
          <h3>Çalışmalar yüklenemedi</h3>
          <p>{error}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className={styles.retryButton}>
              <RotateCcw aria-hidden="true" /> Yeniden dene
            </button>
          )}
        </div>
      ) : items.length === 0 ? (
        <div className={styles.state}>
          <span className={styles.stateIcon}>
            <Archive aria-hidden="true" />
          </span>
          <h3>Henüz kayıtlı çalışma yok</h3>
          <p>
            İlk kampanyanızı, posterinizi, videonuzu veya site analizinizi
            hazırladığınızda burada görünecek.
          </p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className={styles.state}>
          <span className={styles.stateIcon}>
            <FileSearch aria-hidden="true" />
          </span>
          <h3>Aramanızla eşleşen çalışma bulunamadı</h3>
          <p>Arama kelimesini değiştirin veya tüm çalışma türlerini gösterin.</p>
          <button type="button" onClick={resetView} className={styles.retryButton}>
            <RotateCcw aria-hidden="true" /> Filtreleri temizle
          </button>
        </div>
      ) : (
        <div className={styles.list}>
          {pagedItems.map((item) => {
            const expanded = expandedKey === item.key;
            const detailId = `${titleId}-${item.key}`.replace(/:/g, "-");
            return (
              <article
                key={item.key}
                className={styles.card}
                data-expanded={expanded}
              >
                <HistoryPreview item={item} />
                <div className={styles.cardBody}>
                  <HistoryCardSummary item={item} />
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.openButton}
                      onClick={() =>
                        setExpandedKey((current) =>
                          current === item.key ? null : item.key,
                        )
                      }
                      aria-expanded={expanded}
                      aria-controls={detailId}
                    >
                      {expanded ? "Çalışmayı kapat" : "Çalışmayı aç"}
                      <ChevronDown aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div id={detailId} className={styles.inlineDetail}>
                    <HistoryItemDetail
                      item={item}
                      copiedKey={copiedKey}
                      onCopy={copyText}
                    />
                  </div>
                )}
              </article>
            );
          })}
          {visibleLimit < visibleItems.length && (
            <button
              type="button"
              className={styles.loadMoreButton}
              onClick={() => setVisibleLimit((current) => current + 30)}
            >
              30 çalışma daha göster
              <ChevronDown aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <p className={styles.copyStatus} aria-live="polite">
        {copiedKey ? "İçerik panoya kopyalandı." : ""}
      </p>
    </section>
  );
}

function HistoryPreview({ item }: { item: MarketingHistoryItem }) {
  if (item.kind === "asset") {
    return (
      <div className={styles.preview} data-kind={item.filter}>
        {item.asset.kind === "VIDEO" ? (
          <video
            src={item.asset.previewUrl}
            muted
            playsInline
            preload="metadata"
            aria-label={`${item.asset.title} video önizlemesi`}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.asset.previewUrl}
            alt={`${item.asset.title} poster önizlemesi`}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        )}
        <span>
          {item.asset.kind === "VIDEO" ? <Video /> : <ImageIcon />}
          {item.asset.kind === "VIDEO" ? "Video" : "Poster"}
        </span>
      </div>
    );
  }

  if (item.kind === "website") {
    return (
      <div className={styles.preview} data-kind="website">
        <Globe2 aria-hidden="true" />
        <strong>{item.analysis.domain.slice(0, 2).toLocaleUpperCase("tr-TR")}</strong>
        <span>
          <FileSearch /> Site analizi
        </span>
      </div>
    );
  }

  const campaign = item.campaign;
  const previewUrl = campaign.posterHeadline
    ? `/api/fabrika/marketing/poster/${campaign.id}?format=square`
    : campaign.property?.imageUrl;
  return (
    <div className={styles.preview} data-kind={item.filter}>
      {item.filter === "international" ? (
        <Globe2 aria-hidden="true" />
      ) : (
        <Megaphone aria-hidden="true" />
      )}
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
      <span>
        {item.filter === "international" ? <Globe2 /> : <Megaphone />}
        {item.filter === "international" ? "Yurt dışı" : "Yurt içi"}
      </span>
    </div>
  );
}

function HistoryCardSummary({ item }: { item: MarketingHistoryItem }) {
  if (item.kind === "asset") {
    const asset = item.asset;
    return (
      <>
        <div className={styles.cardHeading}>
          <div>
            <span className={styles.kindLabel}>
              {asset.kind === "VIDEO" ? "Video çalışması" : "Poster çalışması"}
            </span>
            <h3>{asset.title}</h3>
          </div>
          <span className={styles.status} data-status="ready">
            İndirmeye hazır
          </span>
        </div>
        <div className={styles.metaRow}>
          <span>
            <Target aria-hidden="true" />
            {asset.property.referenceCode
              ? `${asset.property.referenceCode} · `
              : ""}
            {asset.property.title}
          </span>
          <span>
            <CalendarDays aria-hidden="true" /> {formatDate(asset.createdAt)}
          </span>
        </div>
        <p className={styles.cardDescription}>
          {asset.detail ||
            `${asset.kind === "VIDEO" ? "Video" : "Poster"} çalışmasının kayıtlı son sürümü.`}
        </p>
      </>
    );
  }

  if (item.kind === "website") {
    const analysis = item.analysis;
    return (
      <>
        <div className={styles.cardHeading}>
          <div>
            <span className={styles.kindLabel}>Site analizi</span>
            <h3>{analysis.domain}</h3>
          </div>
          <span className={styles.status} data-status="ready">
            Analiz hazır
          </span>
        </div>
        <div className={styles.metaRow}>
          <span>
            <Globe2 aria-hidden="true" /> {analysis.domain}
          </span>
          <span>
            <CalendarDays aria-hidden="true" /> {formatDate(analysis.createdAt)}
          </span>
        </div>
        <p className={styles.cardDescription}>{analysis.summary}</p>
      </>
    );
  }

  const campaign = item.campaign;
  const international = campaign.type === "international";
  const context = international
    ? campaign.internationalPlan?.countryName || "Yurt dışı planı"
    : campaign.property?.title || "Şirket marka kampanyası";
  return (
    <>
      <div className={styles.cardHeading}>
        <div>
          <span className={styles.kindLabel}>
            {international ? "Yurt dışı kampanyası" : "Yurt içi kampanyası"}
          </span>
          <h3>{campaign.name}</h3>
        </div>
        <span
          className={styles.status}
          data-status={campaign.publicationStatus || "DRAFT"}
        >
          {campaignStatus(campaign)}
        </span>
      </div>
      <div className={styles.metaRow}>
        <span>
          {international ? <Languages aria-hidden="true" /> : <MapPin aria-hidden="true" />}
          {context}
        </span>
        <span>{campaignCount(campaign)}</span>
        <span>
          <CalendarDays aria-hidden="true" /> {formatDate(campaign.createdAt)}
        </span>
      </div>
      <p className={styles.cardDescription}>
        {campaign.description ||
          (international
            ? "Ülke ve portallara özel hazırlanmış ilan planı."
            : "Kanal metinleri ve görselleri hazırlanmış kampanya çalışması.")}
      </p>
    </>
  );
}

function HistoryItemDetail({
  item,
  copiedKey,
  onCopy,
}: {
  item: MarketingHistoryItem;
  copiedKey: string | null;
  onCopy: (value: string, key: string) => Promise<void>;
}) {
  if (item.kind === "asset") {
    const asset = item.asset;
    return (
      <div className={styles.assetDetail}>
        <div>
          <span>Bağlı portföy</span>
          <strong>{asset.property.title}</strong>
        </div>
        {asset.ratio && (
          <div>
            <span>Format</span>
            <strong>{asset.ratio}</strong>
          </div>
        )}
        {asset.durationSeconds && (
          <div>
            <span>Süre</span>
            <strong>{asset.durationSeconds} saniye</strong>
          </div>
        )}
        <a href={asset.downloadUrl} download className={styles.secondaryAction}>
          <Download aria-hidden="true" /> Dosyayı indir
        </a>
      </div>
    );
  }

  if (item.kind === "website") {
    const analysis = item.analysis;
    const sections = [
      ["Güçlü taraflar", parseList(analysis.strengths)],
      ["Fırsatlar", parseList(analysis.opportunities)],
      ["Kanal planı", parseList(analysis.channelPlan)],
      ["İlk adımlar", parseList(analysis.firstActions)],
    ] as const;
    return (
      <div className={styles.analysisDetail}>
        <p className={styles.detailLead}>{analysis.summary}</p>
        <div className={styles.analysisGrid}>
          {sections.map(([title, values]) => (
            <section key={title}>
              <h4>{title}</h4>
              {values.length ? (
                <ul>
                  {values.map((value) => (
                    <li key={value}>{value}</li>
                  ))}
                </ul>
              ) : (
                <p>Bu bölüm için kayıtlı öneri yok.</p>
              )}
            </section>
          ))}
        </div>
        <a
          href={analysis.websiteUrl}
          target="_blank"
          rel="noreferrer"
          className={styles.secondaryAction}
        >
          <ExternalLink aria-hidden="true" /> Siteyi aç
        </a>
      </div>
    );
  }

  const campaign = item.campaign;
  if (campaign.type === "international") {
    const plan = campaign.internationalPlan;
    return (
      <div className={styles.campaignDetail}>
        <div className={styles.detailSummary}>
          <div>
            <span>Hedef ülke</span>
            <strong>{plan?.countryName || "Belirtilmedi"}</strong>
          </div>
          <div>
            <span>Yayın dili</span>
            <strong>{plan?.language || "Belirtilmedi"}</strong>
          </div>
          <div>
            <span>Portal</span>
            <strong>{plan?.portalCopies?.length || 0}</strong>
          </div>
        </div>
        {plan?.strategy && <p className={styles.detailLead}>{plan.strategy}</p>}
        {Boolean(plan?.warnings?.length) && (
          <div className={styles.warningBox}>
            <ShieldAlert aria-hidden="true" />
            <div>
              <strong>Yayın öncesi kontrol</strong>
              <ul>
                {plan?.warnings?.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <details className={styles.contentDetails}>
          <summary>
            Portal içeriklerini göster ({plan?.portalCopies?.length || 0})
            <ChevronDown aria-hidden="true" />
          </summary>
          <div className={styles.portalGrid}>
            {(plan?.portalCopies || []).map((copy) => {
              const key = `${campaign.id}:${copy.portalId}`;
              const market = plan?.countryCode
                ? getInternationalMarket(plan.countryCode)
                : undefined;
              const portal = market
                ? getInternationalPortal(market, copy.portalId)
                : undefined;
              const canPublish =
                portal?.eligibility === "direct" ||
                portal?.eligibility === "membership";
              return (
                <article key={copy.portalId} className={styles.copyCard}>
                  <div className={styles.copyHeader}>
                    <h4>{copy.portalName}</h4>
                    <button
                      type="button"
                      onClick={() =>
                        void onCopy(
                          [copy.title, copy.body].join("\n\n"),
                          key,
                        )
                      }
                    >
                      {copiedKey === key ? <Check /> : <Copy />}
                      {copiedKey === key ? "Kopyalandı" : "Kopyala"}
                    </button>
                  </div>
                  <strong>{copy.title}</strong>
                  <p>{copy.body}</p>
                  {Boolean(copy.steps?.length) && (
                    <ol>
                      {copy.steps?.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  )}
                  {copy.publishUrl && canPublish ? (
                    <a
                      href={copy.publishUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Yayın ekranını aç <ExternalLink aria-hidden="true" />
                    </a>
                  ) : portal?.officialSourceUrl ? (
                    <a
                      href={portal.officialSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Uygunluğu resmî siteden doğrula{" "}
                      <ExternalLink aria-hidden="true" />
                    </a>
                  ) : (
                    <p className={styles.warningBox}>
                      Bu kayıt için doğrudan yayın uygunluğu doğrulanmadı.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </details>
      </div>
    );
  }

  const copies = campaign.adCopies || [];
  return (
    <div className={styles.campaignDetail}>
      <div className={styles.detailSummary}>
        <div>
          <span>Amaç</span>
          <strong>{campaign.objective || "Belirtilmedi"}</strong>
        </div>
        <div>
          <span>Hedef kitle</span>
          <strong>{campaign.audience || "Belirtilmedi"}</strong>
        </div>
        <div>
          <span>Onaylı içerik</span>
          <strong>
            {copies.filter((copy) => copy.approved).length}/{copies.length}
          </strong>
        </div>
      </div>
      <details className={styles.contentDetails}>
        <summary>
          Kanal içeriklerini göster ({copies.length})
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className={styles.copyGrid}>
          {copies.map((copy, index) => {
            const content = readableCopy(copy);
            const key = `${campaign.id}:${copy.id || copy.platform}:${index}`;
            return (
              <article key={key} className={styles.copyCard}>
                <div className={styles.copyHeader}>
                  <div>
                    <h4>{PLATFORM_LABELS[copy.platform] || copy.platform}</h4>
                    <span data-approved={Boolean(copy.approved)}>
                      {copy.approved ? "Onaylandı" : "Taslak"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onCopy(content.fullText, key)}
                  >
                    {copiedKey === key ? <Check /> : <Copy />}
                    {copiedKey === key ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>
                <strong>{content.headline}</strong>
                <p>{content.body}</p>
                {copy.callToAction && <b>{copy.callToAction}</b>}
                {copy.targetUrl && (
                  <a href={copy.targetUrl} target="_blank" rel="noreferrer">
                    Hedef bağlantıyı aç <ExternalLink aria-hidden="true" />
                  </a>
                )}
              </article>
            );
          })}
        </div>
      </details>
      <div className={styles.detailActions}>
        {campaign.posterHeadline && (
          <a
            href={`/api/fabrika/marketing/poster/${campaign.id}?format=square&download=1`}
            className={styles.secondaryAction}
          >
            <Download aria-hidden="true" /> Posteri indir
          </a>
        )}
        {["EXPORTED", "MANUALLY_CONFIRMED"].includes(
          campaign.publicationStatus || "",
        ) && (
          <a
            href={`/api/fabrika/marketing/campaigns/${campaign.id}/publication?download=1`}
            className={styles.secondaryAction}
          >
            <Download aria-hidden="true" /> Yayın paketini indir
          </a>
        )}
        {campaign.externalPublicationUrl && (
          <a
            href={campaign.externalPublicationUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.secondaryAction}
          >
            <ExternalLink aria-hidden="true" /> Doğrulanan yayını aç
          </a>
        )}
      </div>
    </div>
  );
}
