'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleGauge,
  Code2,
  Download,
  Eye,
  FileCode2,
  FolderKanban,
  Globe2,
  Headphones,
  LayoutTemplate,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  Plus,
  Rocket,
  Search,
  Send,
  TrendingUp,
  UsersRound,
  Zap,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import ExistingWebsiteIntegration from '@/components/fabrika/ExistingWebsiteIntegration';
import styles from './YazilimciPage.module.css';

type ChatMessage = { role: string; content: string };

const projects = [
  {
    id: 'new-site',
    title: 'Business CEO AI Gayrimenkul',
    domain: 'Yeni site ve ZIP paketi',
    image: '/uploads/studio/shoot_1784830670872_photo_0.jpg',
    badge: 'Ana proje',
    status: 'Yayına hazır',
    release: 'İsteğe bağlı üretim',
    branch: 'site-generator',
    scores: [98, 96, 100],
  },
  {
    id: 'existing-site',
    title: 'Mevcut Web Sitesi',
    domain: 'Kaynak kodu ve canlı site bağlantısı',
    image: '/uploads/studio/shoot_1784829995816_Luks_Sicak_Atmosfer_wm_0.jpg',
    badge: 'API entegrasyonu',
    status: 'Bağlanabilir',
    release: 'ZIP / klasör yükleme',
    branch: 'website-integration',
    scores: [94, 91, 100],
  },
  {
    id: 'support',
    title: 'Teknik Operasyon',
    domain: 'Alan adı, hosting ve yayın desteği',
    image: '/uploads/studio/shoot_1784829995816_HDR_Sinematik_wm_0.jpg',
    badge: 'AI destek',
    status: 'Çevrimiçi',
    release: 'Anlık teknik rehber',
    branch: 'it-support',
    scores: [92, 90, 98],
  },
] as const;

export default function YazilimciPage() {
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [themeColor, setThemeColor] = useState('#b98a3d');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      content:
        'Merhaba! Ben Business CEO AI Teknik Danışmanıyım. Alan adı, hosting kurulumu veya web sitenizi yayına alma konusunda size nasıl yardımcı olabilirim?',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const projectAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleGenerateWebsite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyName) return toast.error('Lütfen şirket adını giriniz.');

    setIsGenerating(true);
    try {
      const response = await fetch('/api/fabrika/yazilimci/generate-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, logoUrl, themeColor }),
      });

      if (!response.ok) throw new Error('Site oluşturulamadı.');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${companyName.replace(/\s+/g, '_').toLowerCase()}_website.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Web siteniz başarıyla oluşturuldu ve indirildi!', { icon: '🎉' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bir hata oluştu.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatInput.trim()) return;

    const newMessage = { role: 'user', content: chatInput };
    setChatMessages((previous) => [...previous, newMessage]);
    setChatInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/fabrika/yazilimci/it-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: newMessage.content,
          history: chatMessages.slice(1),
        }),
      });
      const data = await response.json();
      if (data.reply) {
        setChatMessages((previous) => [
          ...previous,
          { role: 'model', content: data.reply },
        ]);
      }
    } catch {
      toast.error('Bağlantı hatası.');
    } finally {
      setIsTyping(false);
    }
  };

  function openProject(kind: 'new' | 'existing') {
    setHasWebsite(kind === 'existing');
    window.setTimeout(
      () => projectAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      0
    );
  }

  function openSupport(prompt?: string) {
    if (prompt) setChatInput(prompt);
    window.setTimeout(() => chatInputRef.current?.focus(), 0);
  }

  const supportQuestionCount = chatMessages.filter((message) => message.role === 'user').length;

  return (
    <div className={styles.page}>
      <Toaster position="top-right" />

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>M1 · Web sitesi ve SEO</p>
          <h1>Yazılımcı</h1>
          <p>
            Yapay zeka destekli site oluşturucu ve teknik bakım araçlarıyla gayrimenkul markanız için yüksek performanslı web deneyimi hazırlayın.
          </p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.primaryButton} onClick={() => openProject('new')} type="button"><Plus /> Yeni site projesi</button>
          <button className={styles.secondaryButton} onClick={() => openSupport()} type="button"><Headphones /> Teknik destek</button>
        </div>
      </header>

      <section className={styles.metrics} aria-label="Yazılımcı özeti">
        <Metric icon={FolderKanban} label="Aktif proje" value="3" detail="3 çalışma alanı" />
        <Metric icon={FileCode2} label="Yayındaki site" value={hasWebsite === true ? '2' : '1'} detail="Entegrasyon durumuna göre" />
        <Metric icon={CircleGauge} label="SEO altyapısı" value="92" suffix="/100" detail="Şablon ortalaması" />
        <Metric icon={TrendingUp} label="İçerik akışı" value="Canlı" detail="Portföy API hazır" />
        <Metric icon={AlertTriangle} label="Açık teknik görev" value={String(supportQuestionCount)} detail="Destek konuşmanız" tone="warning" />
      </section>

      <div className={styles.workspace}>
        <main className={styles.mainColumn}>
          <section className={styles.panel}>
            <header className={styles.panelHead}><h2>Site projeleri</h2><span>Gerçek kurulum akışları</span></header>
            <div className={styles.projectHeader}><span>Proje &amp; Domain</span><span>Durum</span><span>Son yayın</span><span>Performans</span><span>Repo &amp; Yayın</span><span>İşlemler</span></div>
            {projects.map((project, index) => (
              <article className={styles.projectRow} data-primary={index === 0} key={project.id}>
                <div className={styles.projectIdentity}>
                  <div className={styles.projectThumb}><Image alt="" fill sizes="112px" src={project.image} /></div>
                  <div><strong>{project.title}</strong><span>{project.domain}</span><small>{project.badge}</small></div>
                </div>
                <div className={styles.statusCell} data-status={project.id === 'support' ? 'draft' : 'active'}><strong>● {project.status}</strong>{project.id === 'support' ? 'AI danışman' : 'Kurulum akışı'}</div>
                <div className={styles.releaseCell}><time>Hazır</time><span>{project.release}</span></div>
                <div className={styles.scoreSet}>
                  {project.scores.map((score) => <span className={styles.score} data-tone={score < 90 ? 'warning' : 'good'} key={score}>{score}</span>)}
                </div>
                <div className={styles.repoCell}><strong><Code2 /> Business CEO AI</strong><span>{project.branch}</span><span>● Güvenli sunucu akışı</span></div>
                <div className={styles.rowActions}>
                  {project.id === 'new-site' ? (
                    <><button className={styles.rowButton} onClick={() => openProject('new')} type="button"><Code2 /> Düzenle</button><button className={styles.rowButton} onClick={() => openProject('new')} type="button"><Eye /> Önizle</button><button className={styles.rowButton} data-primary="true" onClick={() => openProject('new')} type="button"><Rocket /> Oluştur</button></>
                  ) : project.id === 'existing-site' ? (
                    <><button className={styles.rowButton} onClick={() => openProject('existing')} type="button"><Code2 /> Bağla</button><button className={styles.rowButton} onClick={() => openProject('existing')} type="button"><Eye /> İncele</button><button className={styles.rowButton} data-primary="true" onClick={() => openProject('existing')} type="button"><Rocket /> Yükle</button></>
                  ) : (
                    <><button className={styles.rowButton} onClick={() => openSupport('Alan adı ve hosting kurulumu için yol haritası hazırla.')} type="button"><MessageSquareText /> Sor</button><button className={styles.rowButton} onClick={() => openSupport('Web sitem için hız ve SEO kontrol listesi hazırla.')} type="button"><Search /> Analiz</button><button className={styles.rowButton} data-primary="true" onClick={() => openSupport()} type="button"><Headphones /> Destek</button></>
                  )}
                </div>
              </article>
            ))}
            <footer className={styles.panelFooter}><span>3 gerçek işlem alanı</span><button onClick={() => projectAreaRef.current?.scrollIntoView({ behavior: 'smooth' })} type="button">Kurulum seçeneklerini görüntüle →</button></footer>
          </section>

          <div className={styles.analyticsGrid}>
            <section className={styles.smallPanel}>
              <header><h2>Site sağlığı</h2><span className={styles.aiBadge}>CANLI</span></header>
              <div className={styles.healthBody}>
                <div className={styles.healthScore}><span>Genel sağlık skoru</span><strong>95<small>/100</small></strong><small>Üretim altyapısı hazır</small>
                  <svg className={styles.sparkline} preserveAspectRatio="none" viewBox="0 0 220 55"><polyline points="0,45 25,35 50,30 75,18 95,32 120,27 145,25 165,10 190,22 220,14 220,55 0,55" /></svg>
                </div>
                <div className={styles.healthChecklist}><span><CheckCircle2 /> ZIP API</span><span><CheckCircle2 /> Güvenlik</span><span><CheckCircle2 /> SEO</span><span><CheckCircle2 /> Erişilebilirlik</span><span><CheckCircle2 /> Portföy API</span></div>
              </div>
            </section>

            <section className={styles.smallPanel}>
              <header><h2>Core Web Vitals</h2><span>Şablon</span></header>
              <div className={styles.vitalTabs}><span>Mobil</span><span>Masaüstü</span></div>
              <div className={styles.vitals}><div className={styles.vital}><span>LCP</span><strong>1.2<small> s</small></strong><small>İyi</small></div><div className={styles.vital}><span>INP</span><strong>68<small> ms</small></strong><small>İyi</small></div><div className={styles.vital}><span>CLS</span><strong>0.04</strong><small>İyi</small></div></div>
            </section>

            <section className={styles.smallPanel}>
              <header><h2>Son yayınlamalar</h2><span>3</span></header>
              <div className={styles.releaseList}><Release label="Site oluşturma API'si" time="Production" /><Release label="Mevcut site entegrasyonu" time="Production" /><Release label="Teknik destek asistanı" time="Canlı" /><Release label="Portföy veri bağlantısı" time="Hazır" /></div>
            </section>
          </div>

          <section className={styles.panel} ref={projectAreaRef}>
            <header className={styles.panelHead}><h2>Yeni site projesi oluştur</h2><span>Web sitesi var / yok akışı</span></header>
            {hasWebsite === null ? (
              <div className={styles.onboardingPanel}>
                <div className={styles.choiceGrid}>
                  <button className={styles.choiceCard} onClick={() => openProject('existing')} type="button"><Globe2 /><div><strong>Evet, mevcut sitem var</strong><span>Kaynak kodunu ZIP veya klasör olarak gönderin; Business CEO AI verilerini mevcut sitenize bağlayın.</span></div><ArrowRight /></button>
                  <button className={styles.choiceCard} onClick={() => openProject('new')} type="button"><LayoutTemplate /><div><strong>Hayır, yeni site oluştur</strong><span>Şirket bilgilerinizi girin; çalışır emlak sitesi paketini ZIP olarak üretip indirin.</span></div><ArrowRight /></button>
                </div>
              </div>
            ) : hasWebsite ? (
              <div className={styles.integrationWrap}>
                <button className={styles.secondaryButton} onClick={() => setHasWebsite(null)} type="button">← Kurulum seçimine dön</button>
                <ExistingWebsiteIntegration onBack={() => setHasWebsite(null)} />
              </div>
            ) : (
              <div className={styles.generatorPanel}>
                <div className={styles.generatorHead}><h2>Çalışır site paketini hazırlayın</h2><button onClick={() => setHasWebsite(null)} type="button">Kurulum seçimine dön</button></div>
                <form className={styles.generatorForm} onSubmit={handleGenerateWebsite}>
                  <label>Şirket adı<input onChange={(event) => setCompanyName(event.target.value)} placeholder="Örn. Akar Emlak" required type="text" value={companyName} /></label>
                  <label>Logo URL (opsiyonel)<input onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://..." type="url" value={logoUrl} /></label>
                  <label>Tema rengi<span className={styles.colorControl}><input onChange={(event) => setThemeColor(event.target.value)} type="color" value={themeColor} /><span>{themeColor}</span></span></label>
                  <button className={styles.generateButton} disabled={isGenerating} type="submit">{isGenerating ? <Loader2 className="animate-spin" /> : <Download />} {isGenerating ? 'Derleniyor...' : 'Oluştur ve indir'}</button>
                </form>
              </div>
            )}
          </section>

          <div className={styles.bottomGrid}>
            <section className={styles.smallPanel}><header><h2>Yeni site proje akışı</h2><span>4 adım</span></header><div className={styles.flow}><FlowStep icon={UsersRound} label="Marka" /><b className={styles.flowArrow}>→</b><FlowStep icon={LayoutTemplate} label="Şablon" /><b className={styles.flowArrow}>→</b><FlowStep icon={FolderKanban} label="Sayfalar" /><b className={styles.flowArrow}>→</b><FlowStep icon={Globe2} label="Domain" /></div></section>
            <section className={styles.smallPanel}><header><h2>Domain &amp; SSL durumu</h2><span>Güvenli</span></header><div className={styles.domainList}><Domain label="Yeni site paketi" state="SSL hazır" /><Domain label="Mevcut site entegrasyonu" state={hasWebsite ? 'Bağlanıyor' : 'Bekliyor'} /><Domain label="Portföy API endpoint'i" state="Aktif" /></div></section>
            <section className={styles.smallPanel}><header><h2>İçerik güncellemeleri</h2><span>Canlı akış</span></header><div className={styles.contentList}><Content label="Portföy senkronizasyonu" detail="API üzerinden hazır" /><Content label="Site ZIP üretimi" detail="Sunucu tarafında güvenli" /><Content label="Teknik danışman" detail="AI destekli yanıt" /></div></section>
          </div>
        </main>

        <aside className={styles.supportRail} id="developer-support">
          <header className={styles.supportHead}><div className={styles.assistantIdentity}><h2>Yazılımcı Asistanı</h2><span className={styles.aiBadge}>AI</span></div><span>Çevrimiçi</span></header>
          <div className={styles.projectContext}><i /> Proje: Business CEO AI Gayrimenkul</div>
          <p className={styles.welcome}>Merhaba 👋 Projeniz çalışır durumda. Alan adı, yayınlama, entegrasyon veya performans konusunda size adım adım yardımcı olabilirim.</p>
          <div className={styles.quickActions}><span>Önerilen aksiyonlar</span><div className={styles.quickGrid}><button onClick={() => openProject('new')} type="button"><Plus /> Yeni site paketi</button><button onClick={() => openSupport('Web sitem için detaylı bir SEO analiz planı hazırla.')} type="button"><Search /> SEO analizi</button><button onClick={() => openSupport('Sitem için hız kontrolü ve optimizasyon adımlarını çıkar.')} type="button"><Zap /> Hız kontrolü</button><button onClick={() => openSupport('İletişim formunu güvenli şekilde nasıl bağlarım?')} type="button"><MessageSquareText /> İletişim formu</button></div></div>
          <div className={styles.conversation}><p className={styles.conversationTitle}>Güncel konuşma</p>{chatMessages.map((message, index) => <div className={styles.messageRow} data-role={message.role} key={`${message.role}-${index}`}><p className={styles.message}>{message.content}</p></div>)}{isTyping && <div className={styles.typing}><i /><i /><i /></div>}<div ref={chatEndRef} /></div>
          <form className={styles.chatForm} onSubmit={handleSendMessage}><input onChange={(event) => setChatInput(event.target.value)} placeholder="Yazılımcı Asistanı'na sorun..." ref={chatInputRef} type="text" value={chatInput} /><button aria-label="Mesajı gönder" disabled={!chatInput.trim() || isTyping} type="submit"><Send /></button></form>
        </aside>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail, suffix, tone = 'default' }: { icon: typeof Activity; label: string; value: string; detail: string; suffix?: string; tone?: 'default' | 'warning' }) {
  return <article className={styles.metric} data-tone={tone}><span className={styles.metricIcon}><Icon /></span><div><span>{label}</span><strong>{value}{suffix && <small>{suffix}</small>}</strong><small>{detail}</small></div></article>;
}

function Release({ label, time }: { label: string; time: string }) {
  return <div className={styles.releaseItem}><span><CheckCircle2 /> {label}</span><time>{time}</time></div>;
}

function FlowStep({ icon: Icon, label }: { icon: typeof Activity; label: string }) {
  return <span className={styles.flowStep}><i><Icon /></i>{label}</span>;
}

function Domain({ label, state }: { label: string; state: string }) {
  return <div className={styles.domainItem}><span><LockKeyhole /> {label}</span><small>{state}</small></div>;
}

function Content({ label, detail }: { label: string; detail: string }) {
  return <div className={styles.contentItem}><span><CheckCircle2 /> {label}</span><small>{detail}</small></div>;
}
