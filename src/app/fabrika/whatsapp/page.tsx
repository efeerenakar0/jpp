import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  MessageCircle,
  MessagesSquare,
  Network,
  QrCode,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  UserRoundCog,
  Wifi,
} from 'lucide-react';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import WhatsAppConnectionPanel from '@/components/fabrika/WhatsAppConnectionPanel';
import styles from './whatsapp.module.css';

export default async function WhatsAppSettingsPage() {
  await requireFabrikaOwner();
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>TELEFON VE OTOMASYON</p>
          <div className={styles.titleRow}>
            <span className={styles.heroIcon} aria-hidden="true">
              <MessageCircle />
            </span>
            <div>
              <h1>WhatsApp Bağlantısı</h1>
              <p>
                Şirket telefonunuzu güvenli biçimde bağlayın; gelen
                konuşmaları Asistan ve Avcı modüllerine otomatik yönlendirin.
              </p>
            </div>
          </div>
        </div>
        <div className={styles.heroActions}>
          <a className={styles.secondaryAction} href="#otomasyon-ayarlari">
            <Settings2 aria-hidden="true" /> Ayarları düzenle
          </a>
          <a className={styles.primaryAction} href="#telefon-baglantisi">
            <Send aria-hidden="true" /> Bağlantıyı yönet
          </a>
        </div>
      </header>

      <section className={styles.connectionSummary}>
        <span className={styles.whatsappMark} aria-hidden="true">
          <Smartphone />
        </span>
        <div className={styles.connectionCopy}>
          <strong>Şirket WhatsApp oturumu</strong>
          <span>Canlı durum ve bağlı numara aşağıdaki bağlantı kartından izlenir.</span>
        </div>
        <dl className={styles.connectionFacts}>
          <div>
            <dt>Bağlantı altyapısı</dt>
            <dd>WAHA · GOWS</dd>
          </div>
          <div>
            <dt>Durum kontrolü</dt>
            <dd><RefreshCw aria-hidden="true" /> Otomatik</dd>
          </div>
          <div>
            <dt>Yönlendirme</dt>
            <dd><Network aria-hidden="true" /> Asistan + Avcı</dd>
          </div>
        </dl>
        <a className={styles.summaryLink} href="#telefon-baglantisi">
          <Wifi aria-hidden="true" /> Canlı bağlantıyı aç
        </a>
      </section>

      <section className={styles.metrics} aria-label="WhatsApp operasyon özeti">
        {[
          {
            icon: MessagesSquare,
            label: 'Mesaj akışı',
            value: 'Canlı',
            detail: 'Gelen ve giden kayıtlar',
            tone: 'success',
          },
          {
            icon: Clock3,
            label: 'Yanıt işleme',
            value: 'Anlık',
            detail: 'Kuyruk kontrollü',
            tone: 'warning',
          },
          {
            icon: Bot,
            label: 'AI yönlendirme',
            value: 'Asistan',
            detail: 'Şirket verileriyle',
            tone: 'success',
          },
          {
            icon: UserRoundCog,
            label: 'İnsan devri',
            value: 'Hazır',
            detail: 'Manuel kontrol açık',
            tone: 'info',
          },
          {
            icon: ShieldCheck,
            label: 'Güvenli oturum',
            value: 'İzole',
            detail: 'Şirket bazlı bağlantı',
            tone: 'neutral',
          },
        ].map((metric) => (
          <article
            className={styles.metricCard}
            data-tone={metric.tone}
            key={metric.label}
          >
            <span className={styles.metricIcon}>
              <metric.icon aria-hidden="true" />
            </span>
            <span>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
              <em>{metric.detail}</em>
            </span>
          </article>
        ))}
      </section>

      <section
        className={styles.liveConnection}
        id="telefon-baglantisi"
      >
        <WhatsAppConnectionPanel />
      </section>

      <section className={styles.operationsGrid} id="otomasyon-ayarlari">
        <article className={styles.operationCard}>
          <div className={styles.cardHeading}>
            <span><Activity aria-hidden="true" /></span>
            <div>
              <h2>Bağlantı sağlığı</h2>
              <p>Son 24 saatlik servis denetimi</p>
            </div>
          </div>
          <div className={styles.healthChart} aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i /><i />
          </div>
          <div className={styles.chartLegend}>
            <span>00:00</span><span>08:00</span><span>16:00</span><span>Şimdi</span>
          </div>
        </article>

        <article className={styles.operationCard}>
          <div className={styles.cardHeading}>
            <span><Network aria-hidden="true" /></span>
            <div>
              <h2>Servis ve kuyruk durumu</h2>
              <p>Bağlantı bileşenleri</p>
            </div>
          </div>
          <ul className={styles.serviceList}>
            {[
              'WhatsApp Gateway',
              'Mesaj işleme servisi',
              'Yönlendirme motoru',
              'AI Asistan servisi',
            ].map((service) => (
              <li key={service}>
                <span><CheckCircle2 aria-hidden="true" /> {service}</span>
                <em>Denetleniyor</em>
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.operationCard}>
          <div className={styles.cardHeading}>
            <span><QrCode aria-hidden="true" /></span>
            <div>
              <h2>Bağlantı çalışma biçimi</h2>
              <p>Tek QR, ortak operasyon kanalı</p>
            </div>
          </div>
          <ol className={styles.steps}>
            <li><b>1</b><span>Şirket telefonuyla QR kodu taratın.</span></li>
            <li><b>2</b><span>Asistan ve Avcı aynı izole oturumu kullanır.</span></li>
            <li><b>3</b><span>Bağlantı durumu otomatik olarak yenilenir.</span></li>
          </ol>
        </article>

        <article className={styles.operationCard}>
          <div className={styles.cardHeading}>
            <span><ShieldCheck aria-hidden="true" /></span>
            <div>
              <h2>Operasyon güvenliği</h2>
              <p>Şirket bazlı erişim ve sınırlar</p>
            </div>
          </div>
          <div className={styles.securityNote}>
            <ShieldCheck aria-hidden="true" />
            <p>
              QR kodu ve bağlantı bilgileri yalnızca yetkili şirket sahibi
              oturumunda görüntülenir. Gönderim limiti ve ilk temas izni üstteki
              otomasyon kartından yönetilir.
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
