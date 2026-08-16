"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Globe2,
  History,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import DomesticMarketingFlow, {
  type DomesticMarketingCampaign,
  type DomesticMarketingProperty,
} from "@/components/fabrika/DomesticMarketingFlow";
import InternationalMarketingPanel from "@/components/fabrika/InternationalMarketingPanel";
import MarketingHistoryPanel from "@/components/fabrika/MarketingHistoryPanel";
import type { InternationalMarketingPlan } from "@/lib/international-marketing";
import type { MarketingCreativeAsset } from "@/lib/marketing-creative-assets";
import styles from "@/app/fabrika/pazarlamaci/marketing.module.css";

type AreaId = "domestic" | "international" | "history";

type Campaign = DomesticMarketingCampaign & {
  generatedModel: string | null;
  internationalPlan: InternationalMarketingPlan | null;
  exportedAt: string | null;
  publicationProofUrl: string | null;
  manuallyConfirmedAt: string | null;
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

export type MarketingData = {
  company: { name: string };
  ai: { managedByPlatform: boolean; ready: boolean };
  campaigns: Campaign[];
  properties: DomesticMarketingProperty[];
  websiteAnalyses: WebsiteAnalysis[];
  creativeAssets: MarketingCreativeAsset[];
};

const AREAS: Array<{
  id: AreaId;
  label: string;
  description: string;
  icon: typeof Megaphone;
}> = [
  {
    id: "domestic",
    label: "Yurt İçi",
    description: "Türkiye için kampanya",
    icon: Megaphone,
  },
  {
    id: "international",
    label: "Yurt Dışı",
    description: "Ülkeye özel yayın planı",
    icon: Globe2,
  },
  {
    id: "history",
    label: "Eski Çalışmalarım",
    description: "Tüm içerik ve görseller",
    icon: History,
  },
];

function areaFromQuery(value: string | null): AreaId {
  if (value === "yurt-disi" || value === "international") return "international";
  if (value === "calismalar" || value === "history") return "history";
  return "domestic";
}

function queryValueForArea(area: AreaId) {
  if (area === "international") return "yurt-disi";
  if (area === "history") return "calismalar";
  return "yurt-ici";
}

type MarketingWorkspaceProps = {
  initialData?: MarketingData | null;
  loadRemote?: boolean;
};

export function MarketingWorkspace({
  initialData = null,
  loadRemote = true,
}: MarketingWorkspaceProps = {}) {
  const [data, setData] = useState<MarketingData | null>(initialData);
  const [loading, setLoading] = useState(loadRemote && !initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [activeArea, setActiveArea] = useState<AreaId>("domestic");
  const [initialPropertyId, setInitialPropertyId] = useState("");

  useEffect(() => {
    const syncAreaFromHistory = () => {
      const query = new URLSearchParams(window.location.search);
      setActiveArea(
        areaFromQuery(query.get("alan")),
      );
      setInitialPropertyId(query.get("propertyId") || "");
    };
    syncAreaFromHistory();
    window.addEventListener("popstate", syncAreaFromHistory);
    return () => window.removeEventListener("popstate", syncAreaFromHistory);
  }, []);

  const fetchData = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/fabrika/marketing/campaigns", {
        cache: "no-store",
      });
      const body = (await response.json()) as MarketingData & { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Pazarlama çalışmaları alınamadı.");
      }
      setData(body);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Pazarlama çalışmaları alınamadı.";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadRemote) return;
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData, loadRemote]);

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
    () => data?.campaigns.filter((campaign) => campaign.type !== "international") || [],
    [data?.campaigns],
  );
  const internationalCampaigns = useMemo(
    () => data?.campaigns.filter((campaign) => campaign.type === "international") || [],
    [data?.campaigns],
  );

  function changeArea(nextArea: AreaId) {
    setActiveArea(nextArea);
    const url = new URL(window.location.href);
    url.searchParams.set("alan", queryValueForArea(nextArea));
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    window.requestAnimationFrame(() => {
      document.getElementById("marketing-workspace")?.focus({ preventScroll: true });
    });
  }

  function moveAreaFocus(
    event: React.KeyboardEvent<HTMLButtonElement>,
    areaIndex: number,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? AREAS.length - 1
          : (areaIndex + (event.key === "ArrowRight" ? 1 : -1) + AREAS.length) %
            AREAS.length;
    const nextArea = AREAS[nextIndex];
    changeArea(nextArea.id);
    window.requestAnimationFrame(() => {
      document.getElementById(`marketing-tab-${nextArea.id}`)?.focus();
    });
  }

  const totalWorkCount =
    (data?.campaigns.length || 0) +
    (data?.creativeAssets.length || 0) +
    (data?.websiteAnalyses.length || 0);

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><Sparkles /> AI Pazarlama Uzmanı</span>
          <h1>Pazarlama yapmak artık üç seçim kadar kolay.</h1>
          <p>
            Neyi tanıtacağınızı ve kime ulaşmak istediğinizi seçin. Sistem doğru
            kanalı, metni ve yayın adımlarını sizin için hazırlasın.
          </p>
        </div>
        <div className={styles.heroSteps} aria-label="Pazarlama akışı özeti">
          <span><b>1</b> Portföyü seç</span>
          <span><b>2</b> Hedefi seç</span>
          <span><b>3</b> Hazır paketi al</span>
        </div>
      </header>

      {!isOnline && (
        <div className={styles.offlineNotice} role="status">
          <WifiOff />
          <div>
            <strong>İnternet bağlantısı yok</strong>
            <p>Eski çalışmalarınızı inceleyebilirsiniz; yeni içerik üretimi bağlantı gelince açılır.</p>
          </div>
          <button type="button" onClick={() => changeArea("history")}>Eski çalışmaları aç <ArrowRight /></button>
        </div>
      )}

      <nav className={styles.areaNav} aria-label="Pazarlama çalışma alanları" role="tablist">
        {AREAS.map((area, areaIndex) => {
          const Icon = area.icon;
          const count =
            area.id === "domestic"
              ? domesticCampaigns.length
              : area.id === "international"
                ? internationalCampaigns.length
                : totalWorkCount;
          return (
            <button
              key={area.id}
              id={`marketing-tab-${area.id}`}
              type="button"
              role="tab"
              aria-selected={activeArea === area.id}
              aria-controls={`marketing-panel-${area.id}`}
              tabIndex={activeArea === area.id ? 0 : -1}
              data-active={activeArea === area.id}
              onClick={() => changeArea(area.id)}
              onKeyDown={(event) => moveAreaFocus(event, areaIndex)}
            >
              <span className={styles.areaIcon}><Icon /></span>
              <span className={styles.areaCopy}>
                <strong>{area.label}</strong>
                <small>{area.description}</small>
              </span>
              <span className={styles.areaCount} aria-label={`${count} çalışma`}>
                {loading ? "—" : count}
              </span>
            </button>
          );
        })}
      </nav>

      <section
        id="marketing-workspace"
        className={styles.workspace}
        tabIndex={-1}
      >
        {loadError && !data ? (
          <div className={styles.loadError} role="alert">
            <span><RefreshCw /></span>
            <div>
              <h2>Pazarlama alanı açılamadı</h2>
              <p>{loadError}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void fetchData();
              }}
            >
              Yeniden dene
            </button>
          </div>
        ) : loading && !data ? (
          <div className={styles.loadingState} role="status">
            <Loader2 />
            <div><strong>Çalışma alanınız hazırlanıyor</strong><span>Portföyler ve eski çalışmalar yükleniyor…</span></div>
          </div>
        ) : activeArea === "domestic" ? (
          <div id="marketing-panel-domestic" role="tabpanel">
            <DomesticMarketingFlow
              companyName={data?.company.name || "Şirketiniz"}
              properties={data?.properties || []}
              campaigns={domesticCampaigns}
              creativeAssets={data?.creativeAssets || []}
              initialPropertyId={initialPropertyId}
              loading={loading}
              isOnline={isOnline}
              onRefresh={fetchData}
              onOpenHistory={() => changeArea("history")}
            />
          </div>
        ) : activeArea === "international" ? (
          <div id="marketing-panel-international" role="tabpanel">
            <InternationalMarketingPanel
              properties={data?.properties || []}
              campaigns={internationalCampaigns}
              loading={loading}
              isOnline={isOnline}
              onGenerated={fetchData}
            />
          </div>
        ) : (
          <div id="marketing-panel-history" role="tabpanel">
            <MarketingHistoryPanel
              campaigns={data?.campaigns || []}
              creativeAssets={data?.creativeAssets || []}
              websiteAnalyses={data?.websiteAnalyses || []}
              loading={loading}
              error={loadError}
              onRetry={() => void fetchData()}
            />
          </div>
        )}
      </section>

      <footer className={styles.pageFooter}>
        <span>Business CEO AI içerikleri hazırlar; dış platform hesabı, ödeme ve son yayın onayı sizdedir.</span>
      </footer>
    </main>
  );
}
