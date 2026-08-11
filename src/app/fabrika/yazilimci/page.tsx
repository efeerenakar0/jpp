"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  Globe2,
  ImagePlus,
  Info,
  Link2,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  Palette,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";

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
  return hostname.replace(/^portfoy\./, "");
}

export default function YazilimciPage() {
  const [activeTab, setActiveTab] = useState<HubTab>("website");
  const [data, setData] = useState<HubData | null>(null);
  const [mode, setMode] = useState<WebsiteMode | null>(null);
  const [baseDomain, setBaseDomain] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingDomain, setIsCheckingDomain] = useState(false);
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
        baseDomain: mode === "EXISTING" ? baseDomain : "",
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

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>AI YAZILIMCI</span>
          <h1>Dijital vitrininizi kolayca kurun.</h1>
          <p>
            Web sitenizi yayına alın, alan adınızı bağlayın ve sosyal medya
            hesaplarınızı adım adım hazırlayın. Teknik bilgi gerekmez.
          </p>
        </div>
        <div className={styles.heroStatus}>
          <span><Globe2 /> {website.status === "PUBLISHED" ? "Site yayında" : "Site kurulumu bekliyor"}</span>
          <span><MonitorSmartphone /> {website.activePortfolioCount} aktif portföy</span>
          <span><BookOpen /> {savedSocialCount} sosyal hesap kaydı</span>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="AI Yazılımcı bölümleri">
        <button
          className={activeTab === "website" ? styles.activeTab : ""}
          onClick={() => setActiveTab("website")}
          type="button"
        >
          <Globe2 />
          <span><strong>Web Sitem</strong><small>Kur, bağla ve yayınla</small></span>
        </button>
        <button
          className={activeTab === "social" ? styles.activeTab : ""}
          onClick={() => setActiveTab("social")}
          type="button"
        >
          <BookOpen />
          <span><strong>Sosyal Medya Rehberi</strong><small>Hesaplarını adım adım hazırla</small></span>
        </button>
      </nav>

      {activeTab === "website" ? (
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
                    <span><b>portfoy.</b>alanadiniz.com adresini kolayca bağlayın.</span>
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

                {mode === "EXISTING" && (
                  <label className={styles.domainField}>
                    <span>Mevcut alan adınız</span>
                    <div><b>portfoy.</b><input value={baseDomain} onChange={(event) => setBaseDomain(event.target.value)} placeholder="alanadiniz.com" /></div>
                    <small>Başına www veya https yazmanıza gerek yok.</small>
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

          <aside className={styles.previewPanel} style={{ "--preview-primary": website.primaryColor, "--preview-accent": website.accentColor } as React.CSSProperties}>
            <div className={styles.previewBrowser}>
              <div className={styles.browserBar}><i /><i /><i /><span>{website.customHostname || website.temporaryUrl.replace(/^https?:\/\//, "")}</span></div>
              <div className={styles.previewHeader}>
                {website.logoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={website.logoData} alt="" />
                ) : <span>{website.brandName.slice(0, 1) || "M"}</span>}
                <b>{website.brandName || "Markanız"}</b>
                <small>Portföyler &nbsp; İletişim</small>
              </div>
              <div className={styles.previewHero}>
                <span>GÜNCEL PORTFÖYLER</span>
                <strong>Doğru gayrimenkulü güvenle bulun.</strong>
                <button type="button">Portföyleri keşfedin</button>
              </div>
              <div className={styles.previewCards}><i /><i /><i /></div>
            </div>
            <div className={styles.previewMeta}>
              <div><span>Canlı portföy</span><strong>{website.activePortfolioCount}</strong></div>
              <div><span>Güncelleme</span><strong>Otomatik</strong></div>
            </div>
          </aside>

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

          {mode === "EXISTING" && website.status === "PUBLISHED" && website.customHostname && (
            <section className={styles.domainPanel}>
              <header className={styles.sectionHeader}>
                <div><span className={styles.sectionNumber}>03</span><div><h2>Kendi alan adınızı bağlayın</h2><p>Aşağıdaki tek satırı alan adı firmanızın DNS ekranına ekleyin.</p></div></div>
                <span className={styles.domainBadge} data-ready={website.domainStatus === "VERIFIED"}><Wifi /> {domainLabel(website.domainStatus)}</span>
              </header>
              <div className={styles.dnsTable}>
                <div><small>Tür</small><strong>CNAME</strong></div>
                <div><small>Ad / Host</small><strong>portfoy</strong><button onClick={() => void copyText("portfoy", "Host")} type="button"><Copy /></button></div>
                <div><small>Hedef / Değer</small><strong>{website.cnameTarget}</strong><button onClick={() => void copyText(website.cnameTarget, "CNAME hedefi")} type="button"><Copy /></button></div>
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
