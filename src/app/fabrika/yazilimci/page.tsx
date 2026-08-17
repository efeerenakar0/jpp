"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Brush,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  Grid2X2,
  Globe2,
  ImagePlus,
  Info,
  LayoutTemplate,
  Link2,
  List,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  MoreVertical,
  Palette,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

import type { DeveloperContentSection } from "@/lib/developer-content-ai";
import {
  DEVELOPER_THEMES,
  getDeveloperTheme,
  getDeveloperThemeBlueprint,
  type DeveloperSiteContent,
  type DeveloperThemeId,
} from "@/lib/developer-site";
import type {
  SocialAccountNote,
  SocialPlatformId,
} from "@/lib/developer-workspace";
import {
  getSocialMediaGuide,
  SOCIAL_MEDIA_GUIDES,
} from "@/lib/social-media-guide";
import styles from "./YazilimciPage.module.css";

type HubTab = "website" | "social";
type WebsiteMode = "NEW" | "EXISTING";
type WebsiteStudioView = "dashboard" | "builder";
type WebsiteCardFilter = "all" | "published" | "templates";
type WebsiteCardView = "grid" | "list";

type WebsiteState = {
  mode: "UNDECIDED" | WebsiteMode;
  status: "DRAFT" | "PUBLISHED";
  brandName: string;
  logoData: string;
  primaryColor: string;
  accentColor: string;
  contactEmail: string;
  contactPhone: string;
  whatsappPhone: string;
  address: string;
  temporarySlug: string;
  temporaryUrl: string;
  customHostname: string;
  cnameTarget: string;
  domainStatus: string;
  sslStatus: string;
  lastDomainCheckAt: string | null;
  publishedAt: string | null;
  activePortfolioCount: number;
  selectedTheme: DeveloperThemeId;
  siteContent: DeveloperSiteContent;
};

type HubData = {
  success: boolean;
  error?: string;
  website: WebsiteState;
  socialAccounts: SocialAccountNote[];
};

const EMPTY_ACCOUNT: SocialAccountNote = {
  platform: "instagram",
  username: "",
  profileUrl: "",
  linkedEmail: "",
  linkedPhone: "",
  twoFactorEnabled: false,
  recoveryReady: false,
  completedStep: 0,
  notes: "",
};

function emptyAccount(platform: SocialPlatformId): SocialAccountNote {
  return { ...EMPTY_ACCOUNT, platform };
}

function domainLabel(status: string) {
  if (status === "VERIFIED") return "Bağlandı";
  if (status === "DNS_VERIFIED") return "DNS bulundu";
  if (status === "WAITING_DNS") return "DNS bekleniyor";
  return "Henüz kurulmadı";
}

function sslLabel(status: string) {
  if (status === "ACTIVE") return "SSL aktif";
  if (status === "PROVISIONING") return "SSL hazırlanıyor";
  if (status === "WAITING_DNS") return "DNS sonrası açılacak";
  return "Henüz kurulmadı";
}

function baseDomainFromHostname(hostname: string) {
  return hostname.replace(/^portfoy(?:ler)?\./, "");
}

const CONTENT_SECTIONS: Array<{
  id: DeveloperContentSection;
  label: string;
  description: string;
}> = [
  { id: "hero", label: "Ana sayfa", description: "İlk başlık ve karşılama" },
  { id: "about", label: "Hakkımızda", description: "Markanızı anlatın" },
  { id: "services", label: "Hizmetler", description: "Sunduğunuz çözümler" },
  { id: "blog", label: "Blog", description: "Rehber yazıları" },
  { id: "faq", label: "Sık sorulanlar", description: "Müşteri soruları" },
  { id: "contact", label: "İletişim", description: "Son çağrı alanı" },
];

type ToggleableContentSection = "about" | "services" | "blog" | "faq";

function isToggleableContentSection(
  section: DeveloperContentSection,
): section is ToggleableContentSection {
  return section === "about" || section === "services" || section === "blog" || section === "faq";
}

export default function YazilimciPage() {
  const [activeTab, setActiveTab] = useState<HubTab>("website");
  const [websiteStudioView, setWebsiteStudioView] =
    useState<WebsiteStudioView>("dashboard");
  const [websiteCardFilter, setWebsiteCardFilter] =
    useState<WebsiteCardFilter>("all");
  const [websiteCardView, setWebsiteCardView] =
    useState<WebsiteCardView>("grid");
  const [websiteCardSearch, setWebsiteCardSearch] = useState("");
  const [data, setData] = useState<HubData | null>(null);
  const [mode, setMode] = useState<WebsiteMode | null>(null);
  const [baseDomain, setBaseDomain] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);
  const [editorSection, setEditorSection] =
    useState<DeveloperContentSection>("hero");
  const [aiInstruction, setAiInstruction] = useState("");
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [themeSearch, setThemeSearch] = useState("");
  const [socialSearch, setSocialSearch] = useState("");
  const [selectedPlatform, setSelectedPlatform] =
    useState<SocialPlatformId>("instagram");
  const [socialDraft, setSocialDraft] = useState<SocialAccountNote>(
    emptyAccount("instagram"),
  );
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/fabrika/yazilimci/workspace", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as HubData;
        if (!response.ok) throw new Error(body.error || "Bilgiler yüklenemedi.");
        setData(body);
        setSocialDraft(
          body.socialAccounts.find((account) => account.platform === "instagram") ??
            emptyAccount("instagram"),
        );
        if (body.website.mode !== "UNDECIDED") {
          setMode(body.website.mode);
        }
        setBaseDomain(baseDomainFromHostname(body.website.customHostname));
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setLoadError(error.message);
          toast.error(error.message);
        }
      })
      .finally(() => setIsLoading(false));
    return () => controller.abort();
  }, []);

  const filteredGuides = useMemo(() => {
    const query = socialSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return SOCIAL_MEDIA_GUIDES;
    return SOCIAL_MEDIA_GUIDES.filter((guide) =>
      `${guide.name} ${guide.purpose}`.toLocaleLowerCase("tr-TR").includes(query),
    );
  }, [socialSearch]);

  const selectedGuide = getSocialMediaGuide(selectedPlatform);
  const selectedTheme = getDeveloperTheme(data?.website.selectedTheme);
  const filteredThemes = useMemo(() => {
    const query = themeSearch.trim().toLocaleLowerCase("tr-TR");
    if (!query) return DEVELOPER_THEMES;
    return DEVELOPER_THEMES.filter((theme) =>
      `${theme.name} ${theme.mood} ${theme.description}`
        .toLocaleLowerCase("tr-TR")
        .includes(query),
    );
  }, [themeSearch]);
  const studioQuery = websiteCardSearch.trim().toLocaleLowerCase("tr-TR");
  const featuredThemes = DEVELOPER_THEMES.slice(0, 15);
  const currentTheme = DEVELOPER_THEMES.find(
    (theme) => theme.id === data?.website.selectedTheme,
  );
  const studioThemePool = currentTheme && !featuredThemes.some(
    (theme) => theme.id === currentTheme.id,
  )
    ? [currentTheme, ...featuredThemes.slice(0, 14)]
    : featuredThemes;
  const studioThemes = studioThemePool.filter((theme) => {
    if (websiteCardFilter === "published") {
      return data?.website.status === "PUBLISHED" &&
        theme.id === data.website.selectedTheme;
    }
    if (websiteCardFilter === "templates" && theme.id === data?.website.selectedTheme) {
      return false;
    }
    return !studioQuery || `${theme.name} ${theme.mood} ${theme.description}`
      .toLocaleLowerCase("tr-TR")
      .includes(studioQuery);
  }).sort((left, right) => {
    const selectedId = data?.website.selectedTheme;
    return Number(right.id === selectedId) - Number(left.id === selectedId);
  });
  const savedSocialCount = data?.socialAccounts.filter(
    (account) => account.username || account.profileUrl,
  ).length ?? 0;

  async function patchWorkspace(payload: object) {
    const response = await fetch("/api/fabrika/yazilimci/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as HubData;
    if (!response.ok) throw new Error(body.error || "İşlem tamamlanamadı.");
    setData(body);
    return body;
  }

  function updateWebsite<K extends keyof WebsiteState>(
    field: K,
    value: WebsiteState[K],
  ) {
    setData((current) =>
      current
        ? { ...current, website: { ...current.website, [field]: value } }
        : current,
    );
  }

  function updateSiteContent<K extends keyof DeveloperSiteContent>(
    section: K,
    value: DeveloperSiteContent[K],
  ) {
    setData((current) =>
      current
        ? {
            ...current,
            website: {
              ...current.website,
              siteContent: { ...current.website.siteContent, [section]: value },
            },
          }
        : current,
    );
  }

  function toggleSectionVisibility(section: ToggleableContentSection) {
    if (!data) return;
    const currentSection = data.website.siteContent[section];
    updateSiteContent(section, {
      ...currentSection,
      enabled: !currentSection.enabled,
    });
  }

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      toast.error("Logo PNG, JPG veya WEBP olmalı.");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("Logo en fazla 2 MB olabilir.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => updateWebsite("logoData", String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function saveAndPublishWebsite() {
    if (!data || !mode) return;
    setIsSaving(true);
    try {
      await patchWorkspace({
        action: "save-website",
        mode,
        brandName: data.website.brandName,
        logoData: data.website.logoData,
        primaryColor: data.website.primaryColor,
        accentColor: data.website.accentColor,
        contactEmail: data.website.contactEmail,
        contactPhone: data.website.contactPhone,
        whatsappPhone: data.website.whatsappPhone,
        address: data.website.address,
        baseDomain,
        selectedTheme: data.website.selectedTheme,
        siteContent: data.website.siteContent,
      });
      const published = await patchWorkspace({ action: "publish-site" });
      setBaseDomain(baseDomainFromHostname(published.website.customHostname));
      toast.success(
        mode === "NEW"
          ? "Siteniz yayına hazır."
          : "Geçici siteniz hazır; şimdi DNS kaydını ekleyin.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Site kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSiteContent() {
    if (!data) return;
    setIsSaving(true);
    try {
      await patchWorkspace({
        action: "save-site-content",
        selectedTheme: data.website.selectedTheme,
        siteContent: data.website.siteContent,
      });
      toast.success("Değişiklikler sitenizde yayınlandı.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Site güncellenemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function generateSectionCopy() {
    if (!data || aiInstruction.trim().length < 3) {
      toast.info("Yapay zekâya ne istediğinizi birkaç kelimeyle anlatın.");
      return;
    }
    setIsGeneratingCopy(true);
    try {
      const response = await fetch("/api/fabrika/yazilimci/content-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: editorSection, instruction: aiInstruction }),
      });
      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
        content?: DeveloperSiteContent[DeveloperContentSection];
        remaining?: number;
      };
      if (!response.ok || !body.content) {
        throw new Error(body.error || "Yapay zekâ metni hazırlayamadı.");
      }
      setData((current) =>
        current
          ? {
              ...current,
              website: {
                ...current.website,
                siteContent: {
                  ...current.website.siteContent,
                  [editorSection]: body.content,
                },
              },
            }
          : current,
      );
      setAiInstruction("");
      toast.success(
        typeof body.remaining === "number"
          ? `Metin hazır. Bugün ${body.remaining} AI hakkınız kaldı.`
          : "Metin hazır; beğenirseniz yayınlayın.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Metin oluşturulamadı.");
    } finally {
      setIsGeneratingCopy(false);
    }
  }

  async function checkDomain() {
    setIsCheckingDomain(true);
    try {
      const result = await patchWorkspace({ action: "check-domain" });
      if (result.website.domainStatus === "VERIFIED") {
        toast.success("Alan adı ve SSL bağlantısı hazır.");
      } else {
        toast.info("DNS henüz tamamlanmadı. Birkaç dakika sonra tekrar deneyin.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Alan adı kontrol edilemedi.");
    } finally {
      setIsCheckingDomain(false);
    }
  }

  async function copyText(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} kopyalandı.`);
  }

  async function saveSocialAccount() {
    setIsSaving(true);
    try {
      await patchWorkspace({ action: "save-social-account", account: socialDraft });
      toast.success(`${selectedGuide.name} notları kaydedildi.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notlar kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  function openSocialGuide(platform: SocialPlatformId) {
    setSelectedPlatform(platform);
    const saved = data?.socialAccounts.find(
      (account) => account.platform === platform,
    );
    setSocialDraft(saved ? { ...saved } : emptyAccount(platform));
  }

  function openWebsiteBuilder(nextMode?: WebsiteMode, themeId?: DeveloperThemeId) {
    if (nextMode) setMode(nextMode);
    if (themeId) updateWebsite("selectedTheme", themeId);
    setWebsiteStudioView("builder");
    setActiveTab("website");
  }

  function openSocialWorkspace() {
    setActiveTab("social");
  }

  if (isLoading) {
    return (
      <div className={styles.loadingState}>
        <Loader2 />
        <span>Çalışma alanınız hazırlanıyor…</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.errorState} role="alert">
        <Info />
        <h1>Çalışma alanı açılamadı</h1>
        <p>{loadError || "Lütfen bağlantınızı kontrol edip yeniden deneyin."}</p>
        <button onClick={() => window.location.reload()} type="button">
          <RefreshCw /> Yeniden dene
        </button>
      </div>
    );
  }

  const website = data.website;
  const brandReady = Boolean(
    website.brandName && (website.contactPhone || website.contactEmail),
  );
  const setupSteps = [
    { label: "Markanı seçtin", done: brandReady },
    { label: "Tasarımını seçtin", done: Boolean(website.selectedTheme) },
    { label: "İçeriklerini ekledin", done: website.status === "PUBLISHED" },
    { label: "Alan adını bağla", done: website.domainStatus === "VERIFIED" },
  ];
  const setupCompleted = setupSteps.filter((step) => step.done).length;

  return (
    <div className={styles.page}>
      {(activeTab === "social" || websiteStudioView === "builder") && (
        <div className={styles.workspaceToolbar}>
          <button
            onClick={() => {
              setActiveTab("website");
              setWebsiteStudioView("dashboard");
            }}
            type="button"
          >
            <ArrowLeft /> Dijital Vitrin Stüdyosu
          </button>
          <div>
            <span><Globe2 /> {website.status === "PUBLISHED" ? "Site yayında" : "Site kurulumu bekliyor"}</span>
            <span><MonitorSmartphone /> {website.activePortfolioCount} aktif portföy</span>
            <span><BookOpen /> {savedSocialCount} sosyal hesap kaydı</span>
          </div>
        </div>
      )}

      {activeTab === "website" ? (
        websiteStudioView === "dashboard" ? (
          <div className={styles.studioDashboard}>
            <section className={styles.setupProgress} aria-label="Site kurulum ilerlemesi">
              <strong><Sparkles /> Kurulum: {setupCompleted}/4 tamamlandı</strong>
              <ol>
                {setupSteps.map((step, index) => (
                  <li data-done={step.done} key={step.label}>
                    <span>{step.done ? <Check /> : index + 1}</span>
                    {step.label}
                  </li>
                ))}
              </ol>
              <button onClick={() => openWebsiteBuilder(mode ?? "NEW")} type="button">
                {website.status === "PUBLISHED" ? "Siteyi yönet" : "Kuruluma devam et"}
                <ArrowRight />
              </button>
            </section>

            <div className={styles.studioLayout}>
              <aside className={styles.creationRail}>
                <div className={styles.studioIntro}>
                  <span><Sparkles /></span>
                  <div>
                    <h1>Dijital Vitrin Stüdyosu</h1>
                    <p>Emlak markanız için profesyonel web siteleri oluşturun, yönetin ve yayınlayın.</p>
                  </div>
                </div>

                <button className={styles.createWebsiteCard} onClick={() => openWebsiteBuilder("NEW")} type="button">
                  <span className={styles.actionIcon}><Brush /></span>
                  <span>
                    <strong>Yeni Web Sitesi Oluştur</strong>
                    <small>Sıfırdan başlayın veya hazır tasarımlardan ilham alın.</small>
                  </span>
                  <span className={styles.deviceArtwork} aria-hidden="true">
                    <i /><i /><b>www.</b>
                  </span>
                  <ArrowRight />
                </button>

                <button className={styles.connectWebsiteCard} onClick={() => openWebsiteBuilder("EXISTING")} type="button">
                  <span className={styles.actionIcon}><Link2 /></span>
                  <span>
                    <strong>Mevcut Sitemi Bağla</strong>
                    <small>Alan adınızı ve portföy sayfanızı Business CEO AI ile yönetin.</small>
                  </span>
                  <ArrowRight />
                </button>

                <button className={styles.socialSetupCard} onClick={openSocialWorkspace} type="button">
                  <span className={styles.actionIcon}><UserRound /></span>
                  <span>
                    <strong>Sosyal Medya Hesaplarını Kur</strong>
                    <small>{savedSocialCount ? `${savedSocialCount} hesap kaydedildi` : "Hesaplarınızı adım adım hazırlayın"}</small>
                  </span>
                  <span className={styles.socialDots} aria-hidden="true"><i /><i /><i /><i /></span>
                  <ArrowRight />
                </button>
              </aside>

              <main className={styles.websiteGallery}>
                <header className={styles.galleryHeader}>
                  <div>
                    <h2>Web Site Çalışmalarım</h2>
                    <p>Mevcut sitenizi yönetin veya birbirinden farklı 15 profesyonel emlak tasarımından birini seçin.</p>
                  </div>
                  {website.status === "PUBLISHED" && (
                    <a href={website.temporaryUrl} target="_blank" rel="noreferrer">
                      Canlı siteyi aç <ExternalLink />
                    </a>
                  )}
                </header>

                <div className={styles.galleryControls}>
                  <div className={styles.galleryTabs} role="group" aria-label="Web sitesi çalışmaları filtresi">
                    <button aria-pressed={websiteCardFilter === "all"} onClick={() => setWebsiteCardFilter("all")} type="button"><Grid2X2 /> Tümü</button>
                    <button aria-pressed={websiteCardFilter === "published"} onClick={() => setWebsiteCardFilter("published")} type="button"><CheckCircle2 /> Yayında <i /></button>
                    <button aria-pressed={websiteCardFilter === "templates"} onClick={() => setWebsiteCardFilter("templates")} type="button"><LayoutTemplate /> Hazır Tasarımlar <i /></button>
                  </div>
                  <label className={styles.gallerySearch}>
                    <Search />
                    <input aria-label="Web sitelerinde ara" value={websiteCardSearch} onChange={(event) => setWebsiteCardSearch(event.target.value)} placeholder="Web sitelerinde ara…" />
                  </label>
                  <button className={styles.filterButton} onClick={() => setWebsiteCardFilter("templates")} type="button"><SlidersHorizontal /> Filtrele</button>
                  <div className={styles.viewToggle} role="group" aria-label="Görünüm">
                    <button aria-pressed={websiteCardView === "grid"} onClick={() => setWebsiteCardView("grid")} type="button"><Grid2X2 /></button>
                    <button aria-pressed={websiteCardView === "list"} onClick={() => setWebsiteCardView("list")} type="button"><List /></button>
                  </div>
                </div>

                {studioThemes.length ? (
                  <div className={styles.websiteCards} data-view={websiteCardView}>
                    {studioThemes.map((theme, index) => {
                      const isCurrent = theme.id === website.selectedTheme;
                      const isPublished = isCurrent && website.status === "PUBLISHED";
                      const blueprint = getDeveloperThemeBlueprint(theme.id);
                      return (
                        <article
                          className={styles.websiteCard}
                          data-current={isCurrent}
                          data-layout={theme.layout}
                          data-theme={theme.id}
                          key={theme.id}
                          style={{
                            "--card-bg": theme.colors.background,
                            "--card-surface": theme.colors.surface,
                            "--card-ink": theme.colors.ink,
                            "--card-muted": theme.colors.muted,
                            "--card-accent": theme.colors.accent,
                            "--card-accent-soft": theme.colors.accentSoft,
                          } as React.CSSProperties}
                        >
                          <button
                            aria-label={`${theme.name} tasarımını düzenle`}
                            className={styles.websiteThumbnail}
                            onClick={() => openWebsiteBuilder(mode ?? "NEW", theme.id)}
                            type="button"
                          >
                            <span className={styles.miniNav}><b>{isCurrent ? website.brandName : theme.name}</b><i /><i /><i /><em>İletişim</em></span>
                            <span className={styles.miniHero}>
                              <small>{theme.mood}</small>
                              <strong>{index % 3 === 0 ? "Doğru gayrimenkulü, doğru danışmanla bulun." : index % 3 === 1 ? "Yeni yaşamınız burada başlıyor." : "Değerli mülkler, doğru yatırımlar."}</strong>
                              <i>{index % 2 === 0 ? "Portföyleri keşfet" : "Projeleri incele"}</i>
                            </span>
                            <span className={styles.miniProperties}><i /><i /><i /></span>
                            {isCurrent && <span className={styles.currentRibbon}>Mevcut siteniz</span>}
                          </button>

                          <div className={styles.websiteCardBody}>
                            <div>
                              <h3>{isCurrent ? website.brandName : theme.name}</h3>
                              <p>{isCurrent ? (website.customHostname || website.temporaryUrl.replace(/^https?:\/\//, "")) : theme.description}</p>
                              <small>{isCurrent && website.publishedAt ? `Güncellendi: ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(website.publishedAt))}` : `${blueprint.architecture} · ${blueprint.portfolioPresentation}`}</small>
                            </div>
                            <span className={isPublished ? styles.publishedBadge : styles.templateBadge}><i /> {isPublished ? "Yayında" : isCurrent ? "Taslak" : "Hazır tasarım"}</span>
                          </div>

                          <footer className={styles.websiteCardFooter}>
                            <button onClick={() => openWebsiteBuilder(mode ?? "NEW", theme.id)} type="button"><Brush /> {isCurrent ? "Düzenlemeye Devam Et" : "Bu Tasarımla Başla"}</button>
                            {isCurrent && website.status === "PUBLISHED" ? (
                              <a aria-label="Siteyi yeni sekmede aç" href={website.temporaryUrl} target="_blank" rel="noreferrer"><ExternalLink /></a>
                            ) : (
                              <button aria-label={`${theme.name} ayrıntıları`} onClick={() => openWebsiteBuilder(mode ?? "NEW", theme.id)} type="button"><MoreVertical /></button>
                            )}
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.emptyGallery}>
                    <Search />
                    <h3>Aramanızla eşleşen tasarım bulunamadı</h3>
                    <p>Farklı bir kelime deneyin veya tüm tasarımları açın.</p>
                    <button onClick={() => { setWebsiteCardSearch(""); setWebsiteCardFilter("all"); }} type="button">Tümünü göster</button>
                  </div>
                )}
              </main>
            </div>
          </div>
        ) : (
        <div className={styles.websiteWorkspace}>
          <section className={styles.flowPanel}>
            <header className={styles.sectionHeader}>
              <div>
                <span className={styles.sectionNumber}>01</span>
                <div><h2>Önce sizi tanıyalım</h2><p>Bir kez doldurun; siteniz markanıza göre hazırlansın.</p></div>
              </div>
              {brandReady && <span className={styles.readyBadge}><CheckCircle2 /> Hazır</span>}
            </header>

            {!mode ? (
              <div className={styles.modeChoice}>
                <button onClick={() => setMode("NEW")} type="button">
                  <span className={styles.choiceIcon}><Sparkles /></span>
                  <span className={styles.choiceCopy}>
                    <small>EN KOLAY SEÇENEK</small>
                    <strong>Web sitem yok</strong>
                    <span>Markanıza özel portföy sitenizi hemen hazırlayalım.</span>
                    <em><Check /> Geçici adres anında hazır</em>
                    <em><Check /> Portföyler otomatik güncel</em>
                  </span>
                  <ArrowRight />
                </button>
                <button onClick={() => setMode("EXISTING")} type="button">
                  <span className={styles.choiceIcon}><Link2 /></span>
                  <span className={styles.choiceCopy}>
                    <small>ALAN ADIM VAR</small>
                    <strong>Web sitem var</strong>
                    <span><b>portfoyler.</b>alanadiniz.com adresini kolayca bağlayın.</span>
                    <em><Check /> Tek CNAME kaydı</em>
                    <em><Check /> SSL otomatik hazırlanır</em>
                  </span>
                  <ArrowRight />
                </button>
              </div>
            ) : (
              <div className={styles.brandForm}>
                <div className={styles.formTopline}>
                  <span className={styles.modePill}>{mode === "NEW" ? "Web sitem yok" : "Web sitem var"}</span>
                  <button onClick={() => setMode(null)} type="button">Seçimi değiştir</button>
                </div>
                <section className={styles.themePicker} aria-labelledby="theme-picker-title">
                  <div className={styles.themePickerHead}>
                    <div>
                      <span className={styles.sectionNumber}>02</span>
                      <span>
                        <strong id="theme-picker-title">Sitenizin görünümünü seçin</strong>
                        <small>25 tasarımdan birini seçin; içerikleriniz tema değişse de korunur.</small>
                      </span>
                    </div>
                    <label>
                      <Search />
                      <input value={themeSearch} onChange={(event) => setThemeSearch(event.target.value)} placeholder="Tema ara" />
                    </label>
                  </div>
                  <div className={styles.themeGrid}>
                    {filteredThemes.map((theme, index) => (
                      <button
                        aria-pressed={website.selectedTheme === theme.id}
                        className={website.selectedTheme === theme.id ? styles.selectedTheme : ""}
                        key={theme.id}
                        onClick={() => updateWebsite("selectedTheme", theme.id)}
                        style={{
                          "--theme-bg": theme.colors.background,
                          "--theme-surface": theme.colors.surface,
                          "--theme-ink": theme.colors.ink,
                          "--theme-accent": theme.colors.accent,
                        } as React.CSSProperties}
                        type="button"
                      >
                        <span className={styles.themeVisual}>
                          <i /><i /><i /><b>{String(index + 1).padStart(2, "0")}</b>
                        </span>
                        <span className={styles.themeCopy}>
                          <small>{theme.mood}</small>
                          <strong>{theme.name}</strong>
                          <em>{theme.description}</em>
                        </span>
                        {website.selectedTheme === theme.id && <CheckCircle2 />}
                      </button>
                    ))}
                  </div>
                </section>
                <div className={styles.brandGrid}>
                  <div className={styles.logoField}>
                    <span>Logo</span>
                    <button onClick={() => logoInputRef.current?.click()} type="button">
                      {website.logoData ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={website.logoData} alt="Yüklenen logo" />
                      ) : <><ImagePlus /><strong>Logo ekle</strong><small>PNG, JPG veya WEBP</small></>}
                    </button>
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => void handleLogo(event.target.files?.[0])}
                      ref={logoInputRef}
                      type="file"
                    />
                  </div>
                  <div className={styles.fields}>
                    <label className={styles.wideField}>
                      <span>Marka / şirket adı</span>
                      <input value={website.brandName} onChange={(event) => updateWebsite("brandName", event.target.value)} placeholder="Örn. Jasmine Gayrimenkul" />
                    </label>
                    <label>
                      <span><Phone /> Telefon</span>
                      <input type="tel" value={website.contactPhone} onChange={(event) => updateWebsite("contactPhone", event.target.value)} placeholder="05xx xxx xx xx" />
                    </label>
                    <label>
                      <span><MessageCircle /> WhatsApp</span>
                      <input type="tel" value={website.whatsappPhone} onChange={(event) => updateWebsite("whatsappPhone", event.target.value)} placeholder="05xx xxx xx xx" />
                    </label>
                    <label>
                      <span>E-posta</span>
                      <input type="email" value={website.contactEmail} onChange={(event) => updateWebsite("contactEmail", event.target.value)} placeholder="info@sirketiniz.com" />
                    </label>
                    <label>
                      <span><MapPin /> Adres</span>
                      <input value={website.address} onChange={(event) => updateWebsite("address", event.target.value)} placeholder="Ofis adresiniz" />
                    </label>
                    <div className={styles.colorFields}>
                      <label><span><Palette /> Ana renk</span><span className={styles.colorInput}><input type="color" value={website.primaryColor} onChange={(event) => updateWebsite("primaryColor", event.target.value)} /><b>{website.primaryColor}</b></span></label>
                      <label><span>Vurgu rengi</span><span className={styles.colorInput}><input type="color" value={website.accentColor} onChange={(event) => updateWebsite("accentColor", event.target.value)} /><b>{website.accentColor}</b></span></label>
                    </div>
                  </div>
                </div>

                {mode && (
                  <label className={styles.domainField}>
                    <span>{mode === "NEW" ? "Kendi alan adınız (isteğe bağlı)" : "Mevcut alan adınız"}</span>
                    <div>{mode === "EXISTING" && <b>portfoyler.</b>}<input value={baseDomain} onChange={(event) => setBaseDomain(event.target.value)} placeholder="alanadiniz.com" /></div>
                    <small>{mode === "NEW" ? "Boş bırakırsanız ücretsiz geçici adresinizle hemen başlayabilirsiniz." : "Başına www veya https yazmanıza gerek yok."}</small>
                  </label>
                )}

                <button className={styles.mainCta} disabled={isSaving} onClick={saveAndPublishWebsite} type="button">
                  {isSaving ? <Loader2 className={styles.spin} /> : <Sparkles />}
                  {website.status === "PUBLISHED" ? "Değişiklikleri kaydet" : "Sitemi hazırla ve yayınla"}
                  <ArrowRight />
                </button>
              </div>
            )}
          </section>

          <aside className={styles.previewPanel} style={{
            "--preview-primary": selectedTheme.colors.background,
            "--preview-surface": selectedTheme.colors.surface,
            "--preview-ink": selectedTheme.colors.ink,
            "--preview-muted": selectedTheme.colors.muted,
            "--preview-accent": selectedTheme.colors.accent,
          } as React.CSSProperties}>
            <div className={styles.previewBrowser}>
              <div className={styles.browserBar}><i /><i /><i /><span>{website.customHostname || website.temporaryUrl.replace(/^https?:\/\//, "")}</span></div>
              <div className={styles.previewHeader}>
                {website.logoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={website.logoData} alt="" />
                ) : <span>{website.brandName.slice(0, 1) || "M"}</span>}
                <b>{website.brandName || "Markanız"}</b>
                <small>Hakkımızda &nbsp; Portföyler &nbsp; Blog</small>
              </div>
              <div className={styles.previewHero}>
                <span>{website.siteContent.hero.eyebrow}</span>
                <strong>{website.siteContent.hero.title}</strong>
                <button type="button">{website.siteContent.hero.buttonLabel}</button>
              </div>
              <div className={styles.previewCards}><i /><i /><i /></div>
            </div>
            <div className={styles.previewMeta}>
              <div><span>Canlı portföy</span><strong>{website.activePortfolioCount}</strong></div>
              <div><span>Güncelleme</span><strong>Otomatik</strong></div>
            </div>
          </aside>

          {website.status === "PUBLISHED" && mode === "NEW" && (
            <section className={styles.contentStudio}>
              <header className={styles.sectionHeader}>
                <div>
                  <span className={styles.sectionNumber}>03</span>
                  <div>
                    <h2>Sitenizin bütün bölümlerini yönetin</h2>
                    <p>Bir bölümü seçin, metinleri değiştirin veya yapay zekâya yazdırın.</p>
                  </div>
                </div>
                <span className={styles.liveBadge}><i /> CANLI EDİTÖR</span>
              </header>

              <div className={styles.editorShell}>
                <nav className={styles.editorRail} aria-label="Site bölümleri">
                  {CONTENT_SECTIONS.map((section, index) => (
                    <button
                      className={editorSection === section.id ? styles.activeEditorSection : ""}
                      key={section.id}
                      onClick={() => {
                        setEditorSection(section.id);
                        setAiInstruction("");
                      }}
                      type="button"
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <span><strong>{section.label}</strong><small>{section.description}</small></span>
                      <ChevronRight />
                    </button>
                  ))}
                  <div className={styles.portfolioSourceNote}>
                    <RefreshCw />
                    <span>
                      <strong>Portföyler otomatik</strong>
                      <small>Portföy Uzmanı’ndaki değişiklikler buraya anında gelir.</small>
                    </span>
                  </div>
                </nav>

                <div className={styles.editorCanvas}>
                  <div className={styles.editorTitle}>
                    <div>
                      <span>DÜZENLENEN BÖLÜM</span>
                      <h3>{CONTENT_SECTIONS.find((section) => section.id === editorSection)?.label}</h3>
                    </div>
                    {isToggleableContentSection(editorSection) && (
                      <button
                        aria-pressed={website.siteContent[editorSection].enabled}
                        className={styles.visibilityToggle}
                        data-active={website.siteContent[editorSection].enabled}
                        onClick={() => toggleSectionVisibility(editorSection)}
                        type="button"
                      >
                        {website.siteContent[editorSection].enabled ? <Check /> : <Circle />}
                        {website.siteContent[editorSection].enabled ? "Sitede görünüyor" : "Sitede gizli"}
                      </button>
                    )}
                  </div>

                  {editorSection === "hero" && (
                    <div className={styles.editorFields}>
                      <label><span>Üst etiket</span><input value={website.siteContent.hero.eyebrow} onChange={(event) => updateSiteContent("hero", { ...website.siteContent.hero, eyebrow: event.target.value })} /></label>
                      <label><span>Ana başlık</span><textarea rows={3} value={website.siteContent.hero.title} onChange={(event) => updateSiteContent("hero", { ...website.siteContent.hero, title: event.target.value })} /></label>
                      <label><span>Açıklama</span><textarea rows={4} value={website.siteContent.hero.description} onChange={(event) => updateSiteContent("hero", { ...website.siteContent.hero, description: event.target.value })} /></label>
                      <label><span>Buton yazısı</span><input value={website.siteContent.hero.buttonLabel} onChange={(event) => updateSiteContent("hero", { ...website.siteContent.hero, buttonLabel: event.target.value })} /></label>
                    </div>
                  )}

                  {editorSection === "about" && (
                    <div className={styles.editorFields}>
                      <label><span>Başlık</span><input value={website.siteContent.about.title} onChange={(event) => updateSiteContent("about", { ...website.siteContent.about, title: event.target.value })} /></label>
                      <label><span>Hakkımızda metni</span><textarea rows={9} value={website.siteContent.about.body} onChange={(event) => updateSiteContent("about", { ...website.siteContent.about, body: event.target.value })} /></label>
                    </div>
                  )}

                  {editorSection === "services" && (
                    <div className={styles.editorFields}>
                      <label><span>Bölüm başlığı</span><input value={website.siteContent.services.title} onChange={(event) => updateSiteContent("services", { ...website.siteContent.services, title: event.target.value })} /></label>
                      <label><span>Kısa açıklama</span><textarea rows={3} value={website.siteContent.services.intro} onChange={(event) => updateSiteContent("services", { ...website.siteContent.services, intro: event.target.value })} /></label>
                      <div className={styles.repeaterGrid}>
                        {website.siteContent.services.items.map((item, index) => (
                          <fieldset key={`${index}-${item.title}`}>
                            <legend>Hizmet {index + 1}</legend>
                            <label><span>Hizmet adı</span><input value={item.title} onChange={(event) => updateSiteContent("services", { ...website.siteContent.services, items: website.siteContent.services.items.map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current) })} /></label>
                            <label><span>Açıklama</span><textarea rows={3} value={item.description} onChange={(event) => updateSiteContent("services", { ...website.siteContent.services, items: website.siteContent.services.items.map((current, itemIndex) => itemIndex === index ? { ...current, description: event.target.value } : current) })} /></label>
                          </fieldset>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "blog" && (
                    <div className={styles.editorFields}>
                      <label><span>Bölüm başlığı</span><input value={website.siteContent.blog.title} onChange={(event) => updateSiteContent("blog", { ...website.siteContent.blog, title: event.target.value })} /></label>
                      <label><span>Kısa açıklama</span><textarea rows={3} value={website.siteContent.blog.intro} onChange={(event) => updateSiteContent("blog", { ...website.siteContent.blog, intro: event.target.value })} /></label>
                      <div className={styles.repeaterGrid}>
                        {website.siteContent.blog.posts.map((post, index) => (
                          <fieldset key={post.id}>
                            <legend>Blog yazısı {index + 1}</legend>
                            <label><span>Yazı başlığı</span><input value={post.title} onChange={(event) => updateSiteContent("blog", { ...website.siteContent.blog, posts: website.siteContent.blog.posts.map((current, postIndex) => postIndex === index ? { ...current, title: event.target.value } : current) })} /></label>
                            <label><span>Özet</span><textarea rows={4} value={post.excerpt} onChange={(event) => updateSiteContent("blog", { ...website.siteContent.blog, posts: website.siteContent.blog.posts.map((current, postIndex) => postIndex === index ? { ...current, excerpt: event.target.value } : current) })} /></label>
                          </fieldset>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "faq" && (
                    <div className={styles.editorFields}>
                      <label><span>Bölüm başlığı</span><input value={website.siteContent.faq.title} onChange={(event) => updateSiteContent("faq", { ...website.siteContent.faq, title: event.target.value })} /></label>
                      <div className={styles.repeaterGrid}>
                        {website.siteContent.faq.items.map((item, index) => (
                          <fieldset key={`${index}-${item.question}`}>
                            <legend>Soru {index + 1}</legend>
                            <label><span>Soru</span><input value={item.question} onChange={(event) => updateSiteContent("faq", { ...website.siteContent.faq, items: website.siteContent.faq.items.map((current, itemIndex) => itemIndex === index ? { ...current, question: event.target.value } : current) })} /></label>
                            <label><span>Cevap</span><textarea rows={4} value={item.answer} onChange={(event) => updateSiteContent("faq", { ...website.siteContent.faq, items: website.siteContent.faq.items.map((current, itemIndex) => itemIndex === index ? { ...current, answer: event.target.value } : current) })} /></label>
                          </fieldset>
                        ))}
                      </div>
                    </div>
                  )}

                  {editorSection === "contact" && (
                    <div className={styles.editorFields}>
                      <label><span>Başlık</span><input value={website.siteContent.contact.title} onChange={(event) => updateSiteContent("contact", { ...website.siteContent.contact, title: event.target.value })} /></label>
                      <label><span>Açıklama</span><textarea rows={6} value={website.siteContent.contact.description} onChange={(event) => updateSiteContent("contact", { ...website.siteContent.contact, description: event.target.value })} /></label>
                    </div>
                  )}

                  <div className={styles.aiWriter}>
                    <div className={styles.aiWriterIcon}><Sparkles /></div>
                    <div className={styles.aiWriterCopy}>
                      <span>BUSINESS CEO AI YAZAR</span>
                      <strong>Ne istediğinizi anlatın, yapay zekâ tamamlasın.</strong>
                      <small>Örn. “Daha samimi, kısa ve Alanya’da uzman olduğumuzu anlatan bir metin yaz.”</small>
                    </div>
                    <textarea
                      aria-label="Yapay zekâya içerik talimatı"
                      value={aiInstruction}
                      onChange={(event) => setAiInstruction(event.target.value)}
                      placeholder="Nasıl bir metin istediğinizi yazın…"
                      rows={3}
                    />
                    <button disabled={isGeneratingCopy} onClick={generateSectionCopy} type="button">
                      {isGeneratingCopy ? <Loader2 className={styles.spin} /> : <Sparkles />}
                      Yapay zekâyla hazırla
                    </button>
                  </div>

                  <div className={styles.editorSaveRow}>
                    <p><Info /> Kaydettiğiniz içerik birkaç saniye içinde sitenizde görünür.</p>
                    <button disabled={isSaving} onClick={saveSiteContent} type="button">
                      {isSaving ? <Loader2 className={styles.spin} /> : <Save />}
                      Kaydet ve sitede yayınla
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {website.status === "PUBLISHED" && (
            <section className={styles.publishPanel}>
              <header className={styles.sectionHeader}>
                <div><span className={styles.sectionNumber}>02</span><div><h2>Siteniz hazır</h2><p>Bu adres şimdi çalışıyor ve portföylerinizle otomatik güncelleniyor.</p></div></div>
                <span className={styles.liveBadge}><i /> YAYINDA</span>
              </header>
              <div className={styles.liveUrl}>
                <div><Globe2 /><span><small>Geçici site adresiniz</small><strong>{website.temporaryUrl}</strong></span></div>
                <button onClick={() => void copyText(website.temporaryUrl, "Site adresi")} type="button"><Copy /> Kopyala</button>
                <a href={website.temporaryUrl} target="_blank" rel="noreferrer">Siteyi aç <ExternalLink /></a>
              </div>
              <div className={styles.syncNotice}><RefreshCw /><span><strong>Bir portföy eklediğinizde veya güncellediğinizde site kendiliğinden yenilenir.</strong><small>Yalnızca aktif ve yayın yetkisi doğrulanmış portföyler ziyaretçilere gösterilir.</small></span></div>
            </section>
          )}

          {mode && website.status === "PUBLISHED" && website.customHostname && (
            <section className={styles.domainPanel}>
              <header className={styles.sectionHeader}>
                <div><span className={styles.sectionNumber}>03</span><div><h2>Kendi alan adınızı bağlayın</h2><p>Aşağıdaki tek satırı alan adı firmanızın DNS ekranına ekleyin.</p></div></div>
                <span className={styles.domainBadge} data-ready={website.domainStatus === "VERIFIED"}><Wifi /> {domainLabel(website.domainStatus)}</span>
              </header>
              <div className={styles.dnsTable}>
                <div><small>Tür</small><strong>{mode === "NEW" ? "A" : "CNAME"}</strong></div>
                <div><small>Ad / Host</small><strong>{mode === "NEW" ? "@" : "portfoyler"}</strong><button onClick={() => void copyText(mode === "NEW" ? "@" : "portfoyler", "Host")} type="button"><Copy /></button></div>
                <div><small>Hedef / Değer</small><strong>{mode === "NEW" ? "76.76.21.21" : website.cnameTarget}</strong><button onClick={() => void copyText(mode === "NEW" ? "76.76.21.21" : website.cnameTarget, "DNS hedefi")} type="button"><Copy /></button></div>
              </div>
              <div className={styles.domainSteps}>
                <span data-done><CheckCircle2 /><b>Site hazır</b><small>{website.temporaryUrl.replace(/^https?:\/\//, "")}</small></span>
                <ChevronRight />
                <span data-done={website.domainStatus !== "WAITING_DNS" && website.domainStatus !== "NOT_CONFIGURED"}><Wifi /><b>DNS bağlantısı</b><small>{domainLabel(website.domainStatus)}</small></span>
                <ChevronRight />
                <span data-done={website.sslStatus === "ACTIVE"}><ShieldCheck /><b>Güvenli bağlantı</b><small>{sslLabel(website.sslStatus)}</small></span>
              </div>
              <div className={styles.domainActions}>
                <p><Info /> DNS değişikliklerinin görünmesi birkaç dakika sürebilir.</p>
                <button disabled={isCheckingDomain} onClick={checkDomain} type="button">{isCheckingDomain ? <Loader2 className={styles.spin} /> : <RefreshCw />} Bağlantıyı kontrol et</button>
                {website.domainStatus === "VERIFIED" && <a href={`https://${website.customHostname}`} target="_blank" rel="noreferrer">{website.customHostname} <ExternalLink /></a>}
              </div>
            </section>
          )}
        </div>
        )
      ) : (
        <div className={styles.socialWorkspace}>
          <aside className={styles.platformRail}>
            <div className={styles.socialIntro}>
              <span className={styles.eyebrow}>10 PLATFORM · TEK REHBER</span>
              <h2>Hesaplarınızı sırayla hazırlayın</h2>
              <p>Bir platform seçin; ne yapmanız gerektiğini basit adımlarla görün.</p>
            </div>
            <label className={styles.socialSearch}><Search /><input value={socialSearch} onChange={(event) => setSocialSearch(event.target.value)} placeholder="Platform ara" /></label>
            <div className={styles.platformList}>
              {filteredGuides.map((guide) => {
                const saved = data.socialAccounts.find((account) => account.platform === guide.id);
                return (
                  <button className={selectedPlatform === guide.id ? styles.selectedPlatform : ""} onClick={() => openSocialGuide(guide.id)} key={guide.id} type="button">
                    <span className={styles.platformMark} style={{ "--platform-color": guide.color } as React.CSSProperties}>{guide.shortName}</span>
                    <span><strong>{guide.name}</strong><small>{saved?.username ? `@${saved.username.replace(/^@/, "")}` : guide.purpose}</small></span>
                    {saved?.username || saved?.profileUrl ? <CheckCircle2 className={styles.savedIcon} /> : <ChevronRight />}
                  </button>
                );
              })}
            </div>
          </aside>

          <main className={styles.guidePanel}>
            <header className={styles.guideHeader}>
              <span className={styles.platformHeroMark} style={{ "--platform-color": selectedGuide.color } as React.CSSProperties}>{selectedGuide.shortName}</span>
              <div><span className={styles.eyebrow}>KURULUM REHBERİ</span><h2>{selectedGuide.name}</h2><p>{selectedGuide.purpose}</p></div>
              <a href={selectedGuide.startUrl} target="_blank" rel="noreferrer">Hesap oluştur <ExternalLink /></a>
            </header>

            <section className={styles.guideStepsSection}>
              <div className={styles.subhead}><div><h3>4 kolay adım</h3><p>Yaptığınız adımlara dokunarak işaretleyin.</p></div><span>{socialDraft.completedStep}/4 tamamlandı</span></div>
              <div className={styles.guideSteps}>
                {selectedGuide.steps.map((step, index) => {
                  const completed = socialDraft.completedStep > index;
                  return (
                    <button data-completed={completed} key={step} onClick={() => setSocialDraft((current) => ({ ...current, completedStep: completed && current.completedStep === index + 1 ? index : Math.max(current.completedStep, index + 1) }))} type="button">
                      {completed ? <CheckCircle2 /> : <Circle />}
                      <span><small>ADIM {index + 1}</small><strong>{step}</strong></span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={styles.notebookSection}>
              <div className={styles.subhead}><div><h3>Hesap not defterim</h3><p>Kullanıcı adınızı, kurtarma bilgilerinizi ve özel notlarınızı saklayın.</p></div><span className={styles.safeNote}><LockKeyhole /> Şifre kaydetmeyiz</span></div>
              <div className={styles.securityNotice}><ShieldCheck /><span><strong>Şifrenizi buraya yazmayın.</strong><small>Şifrelerinizi Google Password Manager, Apple Passwords, 1Password veya Bitwarden gibi bir parola yöneticisinde saklayın.</small></span></div>
              <div className={styles.noteGrid}>
                <label><span><UserRound /> Kullanıcı adı</span><div className={styles.usernameInput}><b>@</b><input value={socialDraft.username.replace(/^@/, "")} onChange={(event) => setSocialDraft((current) => ({ ...current, username: event.target.value.replace(/^@/, "") }))} placeholder="kullaniciadi" /></div></label>
                <label><span>Profil bağlantısı</span><input type="url" value={socialDraft.profileUrl} onChange={(event) => setSocialDraft((current) => ({ ...current, profileUrl: event.target.value }))} placeholder="https://..." /></label>
                <label><span>Bağlı e-posta</span><input type="email" value={socialDraft.linkedEmail} onChange={(event) => setSocialDraft((current) => ({ ...current, linkedEmail: event.target.value }))} placeholder="hesap@sirketiniz.com" /></label>
                <label><span><Phone /> Bağlı telefon</span><input type="tel" value={socialDraft.linkedPhone} onChange={(event) => setSocialDraft((current) => ({ ...current, linkedPhone: event.target.value }))} placeholder="05xx xxx xx xx" /></label>
                <button className={styles.toggleCard} data-active={socialDraft.twoFactorEnabled} onClick={() => setSocialDraft((current) => ({ ...current, twoFactorEnabled: !current.twoFactorEnabled }))} type="button"><span>{socialDraft.twoFactorEnabled ? <Check /> : null}</span><div><strong>İki adımlı doğrulama açık</strong><small>Hesabınızı ele geçirilmeye karşı korur.</small></div></button>
                <button className={styles.toggleCard} data-active={socialDraft.recoveryReady} onClick={() => setSocialDraft((current) => ({ ...current, recoveryReady: !current.recoveryReady }))} type="button"><span>{socialDraft.recoveryReady ? <Check /> : null}</span><div><strong>Kurtarma bilgileri hazır</strong><small>E-posta ve telefonun güncel olduğunu kontrol edin.</small></div></button>
                <label className={styles.notesField}><span>Özel notlar</span><textarea value={socialDraft.notes} onChange={(event) => setSocialDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Örn. Hesabı Ajans ekibi yönetiyor. Yedek kodlar parola yöneticisinde." rows={4} /></label>
              </div>
              <div className={styles.saveRow}>
                <p><Info /> Bu notları yalnızca şirket patronu görebilir.</p>
                <button disabled={isSaving} onClick={saveSocialAccount} type="button">{isSaving ? <Loader2 className={styles.spin} /> : <Save />} Notları kaydet</button>
              </div>
            </section>
          </main>
        </div>
      )}
    </div>
  );
}
