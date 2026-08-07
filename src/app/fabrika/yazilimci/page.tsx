"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Globe2,
  Headphones,
  Info,
  LayoutTemplate,
  Loader2,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Zap,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import ExistingWebsiteIntegration from "@/components/fabrika/ExistingWebsiteIntegration";
import {
  DEVELOPER_SITE_OPTIONS,
  type DeveloperSiteOptionId,
} from "@/lib/developer-site-options";
import styles from "./YazilimciPage.module.css";

type ChatMessage = { role: string; content: string };

export default function YazilimciPage() {
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [themeColor, setThemeColor] = useState("#b98a3d");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      content:
        "Merhaba! Ben Business CEO AI Teknik Danışmanıyım. Alan adı, hosting kurulumu veya web sitenizi yayına alma konusunda size nasıl yardımcı olabilirim?",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const projectAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleGenerateWebsite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyName) return toast.error("Lütfen şirket adını giriniz.");

    setIsGenerating(true);
    try {
      const response = await fetch("/api/fabrika/yazilimci/generate-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, logoUrl, themeColor }),
      });

      if (!response.ok) throw new Error("Site oluşturulamadı.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${companyName.replace(/\s+/g, "_").toLowerCase()}_website.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Web siteniz başarıyla oluşturuldu ve indirildi!", {
        icon: "🎉",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bir hata oluştu.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatInput.trim()) return;

    const newMessage = { role: "user", content: chatInput };
    setChatMessages((previous) => [...previous, newMessage]);
    setChatInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/fabrika/yazilimci/it-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: newMessage.content,
          history: chatMessages.slice(1),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Teknik danışmana ulaşılamadı.");
      }
      if (typeof data.reply === "string" && data.reply.trim()) {
        setChatMessages((previous) => [
          ...previous,
          { role: "model", content: data.reply },
        ]);
      } else {
        throw new Error("Yanıt oluşturulamadı. Lütfen yeniden deneyin.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Bağlantı hatası.",
      );
    } finally {
      setIsTyping(false);
    }
  };

  function openProject(kind: DeveloperSiteOptionId) {
    setHasWebsite(kind === "existing");
    window.setTimeout(
      () =>
        projectAreaRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      0,
    );
  }

  function openSupport(prompt?: string) {
    if (prompt) setChatInput(prompt);
    window.setTimeout(() => chatInputRef.current?.focus(), 0);
  }

  return (
    <div className={styles.page}>
      <Toaster position="top-right" />

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>M1 · Web sitesi ve SEO</p>
          <h1>AI Yazılımcı</h1>
          <p>
            Yapay zeka destekli site oluşturucu ve teknik bakım araçlarıyla
            gayrimenkul markanız için yüksek performanslı web deneyimi
            hazırlayın.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button
            className={styles.primaryButton}
            onClick={() => openProject("new")}
            type="button"
          >
            <Plus /> Yeni ücretsiz site
          </button>
          <button
            className={styles.secondaryButton}
            onClick={() => openSupport()}
            type="button"
          >
            <Headphones /> Teknik destek
          </button>
        </div>
      </header>

      <div className={styles.workspace}>
        <main className={styles.mainColumn}>
          <section
            className={`${styles.panel} ${styles.projectBuilder}`}
            ref={projectAreaRef}
          >
            <header className={styles.builderHeader}>
              <div>
                <span className={styles.builderKicker}>YENİ PROJE</span>
                <h2>Web sitenizi oluşturun veya mevcut sitenizi bağlayın</h2>
                <p>
                  Portföylerinizle aynı veriyi kullanan, güvenli ve sürekli
                  güncellenen bir site akışı kurun.
                </p>
              </div>
              <span className={styles.builderBadge}>
                <CheckCircle2 /> Güvenli teslim akışı
              </span>
            </header>
            {hasWebsite === null ? (
              <div className={styles.onboardingPanel}>
                <div className={styles.choiceGrid}>
                  {DEVELOPER_SITE_OPTIONS.map((option) => {
                    const OptionIcon =
                      option.id === "new" ? LayoutTemplate : Globe2;
                    return (
                      <button
                        className={styles.choiceCard}
                        data-recommended={option.recommended}
                        key={option.id}
                        onClick={() => openProject(option.id)}
                        type="button"
                      >
                        <OptionIcon />
                        <div>
                          <span className={styles.choiceTopline}>
                            <small>{option.kicker}</small>
                            {option.recommended && (
                              <span className={styles.recommendedBadge}>
                                Önerilir
                              </span>
                            )}
                            <Info
                              aria-label={`${option.title} hakkında bilgi`}
                              className={styles.infoIcon}
                            />
                          </span>
                          <strong>{option.title}</strong>
                          <span>{option.description}</span>
                          <ul className={styles.optionBenefits}>
                            {option.benefits.map((benefit) => (
                              <li key={benefit}>{benefit}</li>
                            ))}
                          </ul>
                        </div>
                        <ArrowRight />
                      </button>
                    );
                  })}
                </div>
                <div
                  className={styles.builderSteps}
                  aria-label="Site kurulum adımları"
                >
                  <span>
                    <b>1</b> Site bilgilerini girin
                  </span>
                  <span>
                    <b>2</b> Hazırlık paketini alın
                  </span>
                  <span>
                    <b>3</b> Alan adınızı bağlayın
                  </span>
                  <span>
                    <b>4</b> Aktif portföyleri yayınlayın
                  </span>
                </div>
              </div>
            ) : hasWebsite ? (
              <div className={styles.integrationWrap}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setHasWebsite(null)}
                  type="button"
                >
                  ← Kurulum seçimine dön
                </button>
                <ExistingWebsiteIntegration
                  onBack={() => setHasWebsite(null)}
                />
              </div>
            ) : (
              <div className={styles.generatorPanel}>
                <div className={styles.generatorHead}>
                  <h2>Çalışır site paketini hazırlayın</h2>
                  <button onClick={() => setHasWebsite(null)} type="button">
                    Kurulum seçimine dön
                  </button>
                </div>
                <form
                  className={styles.generatorForm}
                  onSubmit={handleGenerateWebsite}
                >
                  <label>
                    Şirket adı
                    <input
                      onChange={(event) => setCompanyName(event.target.value)}
                      placeholder="Örn. Akar Emlak"
                      required
                      type="text"
                      value={companyName}
                    />
                  </label>
                  <label>
                    Logo URL (opsiyonel)
                    <input
                      onChange={(event) => setLogoUrl(event.target.value)}
                      placeholder="https://..."
                      type="url"
                      value={logoUrl}
                    />
                  </label>
                  <label>
                    Tema rengi
                    <span className={styles.colorControl}>
                      <input
                        onChange={(event) => setThemeColor(event.target.value)}
                        type="color"
                        value={themeColor}
                      />
                      <span>{themeColor}</span>
                    </span>
                  </label>
                  <button
                    className={styles.generateButton}
                    disabled={isGenerating}
                    type="submit"
                  >
                    {isGenerating ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Download />
                    )}{" "}
                    {isGenerating ? "Derleniyor..." : "Oluştur ve indir"}
                  </button>
                </form>
              </div>
            )}
          </section>
        </main>

        <aside className={styles.supportRail} id="developer-support">
          <header className={styles.supportHead}>
            <div className={styles.assistantIdentity}>
              <h2>Yazılımcı Asistanı</h2>
              <span className={styles.aiBadge}>AI</span>
            </div>
            <span>Çevrimiçi</span>
          </header>
          <div className={styles.projectContext}>
            <i /> Proje: Business CEO AI Gayrimenkul
          </div>
          <p className={styles.welcome}>
            Merhaba 👋 Projeniz çalışır durumda. Alan adı, yayınlama,
            entegrasyon veya performans konusunda size adım adım yardımcı
            olabilirim.
          </p>
          <div className={styles.quickActions}>
            <span>Önerilen aksiyonlar</span>
            <div className={styles.quickGrid}>
              <button onClick={() => openProject("new")} type="button">
                <Plus /> Yeni site paketi
              </button>
              <button
                onClick={() =>
                  openSupport(
                    "Web sitem için detaylı bir SEO analiz planı hazırla.",
                  )
                }
                type="button"
              >
                <Search /> SEO analizi
              </button>
              <button
                onClick={() =>
                  openSupport(
                    "Sitem için hız kontrolü ve optimizasyon adımlarını çıkar.",
                  )
                }
                type="button"
              >
                <Zap /> Hız kontrolü
              </button>
              <button
                onClick={() =>
                  openSupport(
                    "İletişim formunu güvenli şekilde nasıl bağlarım?",
                  )
                }
                type="button"
              >
                <MessageSquareText /> İletişim formu
              </button>
            </div>
          </div>
          <div className={styles.conversation}>
            <p className={styles.conversationTitle}>Güncel konuşma</p>
            {chatMessages.map((message, index) => (
              <div
                className={styles.messageRow}
                data-role={message.role}
                key={`${message.role}-${index}`}
              >
                <p className={styles.message}>{message.content}</p>
              </div>
            ))}
            {isTyping && (
              <div className={styles.typing}>
                <i />
                <i />
                <i />
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form className={styles.chatForm} onSubmit={handleSendMessage}>
            <input
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Yazılımcı Asistanı'na sorun..."
              ref={chatInputRef}
              type="text"
              value={chatInput}
            />
            <button
              aria-label="Mesajı gönder"
              disabled={!chatInput.trim() || isTyping}
              type="submit"
            >
              <Send />
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
