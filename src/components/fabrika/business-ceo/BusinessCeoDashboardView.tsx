'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import {
  ArrowRight,
  CalendarCheck2,
  MessageCircle,
  SearchCheck,
  UsersRound,
} from 'lucide-react';

import { PortfolioWorkflowDialog } from '@/components/fabrika/executive-dashboard/PortfolioWorkflowContent';
import { usePortfolioWorkflowController } from '@/components/fabrika/executive-dashboard/usePortfolioWorkflowController';
import type { PortfolioWorkflowLaunchIntent } from '@/lib/portfolio-workflow-intent';

import type {
  AssistantMetrics,
  SalesAppointment,
  SalesConversation,
  SalesMessage,
  WhatsAppStatus,
} from './sales-data';
import styles from './BusinessCeoHomeDashboard.module.css';

export type BusinessCeoDashboardViewProps = {
  appointments: readonly SalesAppointment[];
  conversations: readonly SalesConversation[];
  error: string | null;
  huntedPortfolioCount?: number | null;
  isOwner: boolean;
  loading: boolean;
  metrics: AssistantMetrics | null;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onRefresh: () => void;
  onSendMessage: (
    conversationId: string,
    message: string
  ) => Promise<SalesMessage | undefined | void>;
  whatsappStatus: WhatsAppStatus | null;
  whatsappError?: string | null;
  initialWorkflowIntent?: PortfolioWorkflowLaunchIntent | null;
};

const modules = [
  ['01', 'AI Portföy Uzmanı', 'Portföy toplama, analiz etme ve yönetme uzmanı', '/fabrika/avci', 'portfolio', 'Yapay zekâ destekli emlak portföyü görseli', '#42b7f3'],
  ['02', 'AI Foto Stüdyo', 'Profesyonel emlak fotoğraflarını hazırlayın ve iyileştirin.', '/fabrika/studyo?area=enhancer', 'studio', 'Yapay zekâ fotoğraf stüdyosu kamera görseli', '#b5a0f5'],
  ['03', 'AI Reklam Tasarımı', 'Reklam, tanıtım ve grafik tasarım uzmanı', '/fabrika/reklam-tasarimi', 'advertising', 'Yapay zekâ reklam tasarımı ekranı', '#42b7f3'],
  ['04', 'AI Pazarlama Marketing', 'Dijital pazarlama ve kampanya yönetimi uzmanı', '/fabrika/pazarlamaci', 'marketing', 'Yapay zekâ pazarlama ve sosyal medya görseli', '#7aca8a'],
  ['05', 'AI Satış Asistanı', 'Müşteri iletişimi ve satış destek uzmanı', '/fabrika/asistan', 'sales', 'WhatsApp destekli yapay zekâ satış asistanı', '#f0a350'],
  ['06', 'AI Yazılımcı', 'Web, yazılım ve otomasyon çözümleri uzmanı', '/fabrika/yazilimci', 'developer', 'Yapay zekâ yazılım ve otomasyon görseli', '#76cbe6'],
  ['07', 'AI Yurt İçi Yurt Dışı Partner Bulucu', 'Yurt içi ve yurt dışı güvenilir partner bulma uzmanı', '/fabrika/partnerler', 'partner', 'Uluslararası yapay zekâ partner ağı görseli', '#c1a8f2'],
  ['08', 'AI Yetkili Gayrimenkul Havuzu', 'Yetkili portföy havuzu ve paylaşım ağı yönetimi uzmanı', '/fabrika/yetkili-havuz', 'pool', 'Yetkili gayrimenkul havuzu görseli', '#65c5e7'],
  ['09', 'AI Tapu Takip Uzmanı', 'Tapu süreçleri takip ve yönetim uzmanı', '/fabrika/tapu-takip', 'deed', 'Tapu takip ve gayrimenkul belgesi görseli', '#edbf72'],
  ['10', "AI Şirket CEO'su", 'Strateji, büyüme ve genel yönetim uzmanı', '/fabrika/crm?view=company-ceo', 'ceo', 'Yapay zekâ şirket CEO yönetim görseli', '#c5b6ef'],
] as const;

const references = [
  ['MA', 'AI Portföy Uzmanı sayesinde aradığım evi çok hızlı bulduk. Süreç profesyonel ve sorunsuzdu.', 'M.A. · Alanya · Konut Satışı'],
  ['SK', 'Yatırım analizleri ve yönlendirmeleri sayesinde doğru kararı verdik. Gerçekten güven verici.', 'S.K. · İstanbul · Yatırım'],
  ['ND', 'Kiralama sürecinde her aşamada destek oldular. İletişim hızlı ve çözüm odaklıydı.', 'N.D. · Antalya · Kiralama'],
] as const;

function formatMetric(value: number | null | undefined) {
  return typeof value === 'number'
    ? new Intl.NumberFormat('tr-TR').format(value)
    : '—';
}

export function BusinessCeoDashboardView({
  error,
  huntedPortfolioCount = null,
  loading,
  metrics,
  onRefresh,
  initialWorkflowIntent = null,
}: BusinessCeoDashboardViewProps) {
  const workflow = usePortfolioWorkflowController({ initialIntent: initialWorkflowIntent });
  const metricCards = [
    ['Toplam İletişime Geçen Müşteri', metrics?.totalConversations ?? metrics?.activeConversations, UsersRound, '#176ff2', 'linear-gradient(145deg,#2788ff,#0754dc)', 'Toplam'],
    ['Gelen Mesajlar', metrics?.incomingMessages, MessageCircle, '#0fb8dd', 'linear-gradient(145deg,#20d0e7,#079dc7)', 'Bugün'],
    ['Gelen Randevu Talepleri', metrics?.pendingAppointments, CalendarCheck2, '#7651f5', 'linear-gradient(145deg,#8d68ff,#5c38df)', 'Bekleyen'],
    ['AI Portföy Uzmanının Bulduğu Portföy', huntedPortfolioCount, SearchCheck, '#13af65', 'linear-gradient(145deg,#2acb7b,#079653)', 'Toplam'],
  ] as const;

  return (
    <div className={styles.dashboard}>
      {error ? (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button onClick={onRefresh} type="button">Yeniden dene</button>
        </div>
      ) : null}

      <section aria-label="Şirket özeti" className={styles.metricsGrid}>
        {metricCards.map(([label, value, Icon, accent, surface, period]) => (
          <article className={styles.metricCard} key={label}>
            <span className={styles.metricIcon} style={{ background: surface }}><Icon aria-hidden="true" /></span>
            <div className={styles.metricCopy}>
              <h2>{label}</h2>
              <strong>{loading && value == null ? '…' : formatMetric(value)}</strong>
            </div>
            <div className={styles.metricStatus} style={{ color: accent }}><span>● Canlı</span><small>{period}</small></div>
          </article>
        ))}
      </section>

      <nav aria-label="Yapay zekâ uzmanları" className={styles.moduleGrid}>
        {modules.map(([number, title, description, href, image, imageAlt, border]) => (
          <Link
            aria-label={`${title} panelini aç`}
            className={styles.moduleCard}
            href={href}
            key={number}
            style={{ '--module-border': border } as CSSProperties}
          >
            <span className={styles.moduleNumber}>{number}</span>
            <span className={styles.moduleVisual}>
              <Image alt={imageAlt} className={styles.moduleImage} fill sizes="(min-width: 1440px) 18vw, (min-width: 900px) 30vw, (min-width: 600px) 46vw, 92vw" src={`/business-ceo/homepage-v4/${image}.webp`} />
            </span>
            <span className={styles.moduleCopy}><strong>{title}</strong><small>{description}</small></span>
            <span className={styles.moduleAction}>Paneli Aç <ArrowRight aria-hidden="true" /></span>
          </Link>
        ))}
      </nav>

      <section aria-labelledby="references-title" className={styles.references}>
        <div className={styles.referencesHeader}>
          <div><h2 id="references-title">Referanslar</h2><p>Müşteri deneyimleri ve tamamlanan işlemlerden geri bildirimler.</p></div>
          <Link href="/fabrika/sirket">Tüm Referansları Gör <ArrowRight aria-hidden="true" /></Link>
        </div>
        <div className={styles.referenceGrid}>
          {references.map(([initials, quote, meta]) => (
            <article className={styles.referenceCard} key={initials}>
              <span className={styles.referenceAvatar}>{initials}</span>
              <div><div aria-label="5 üzerinden 5 yıldız" className={styles.stars}>★★★★★</div><blockquote>“{quote}”</blockquote><p>{meta}</p></div>
            </article>
          ))}
          <div aria-hidden="true" className={styles.referenceDots}><span data-active="true" /><span /><span /></div>
        </div>
      </section>

      <PortfolioWorkflowDialog
        draft={workflow.draft}
        entryMode={workflow.entryMode}
        onAction={workflow.onAction}
        onClose={workflow.onClose}
        onContinue={workflow.onContinue}
        onFilesSelected={workflow.onFilesSelected}
        onOpenChange={workflow.onOpenChange}
        onRetryMedia={workflow.onRetryMedia}
        open={workflow.dialogOpen}
      />
    </div>
  );
}
