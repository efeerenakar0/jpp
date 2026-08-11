'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  Globe2,
  Handshake,
  Inbox,
  Languages,
  Loader2,
  Mail,
  MapPin,
  Network,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Unplug,
  UsersRound,
  X,
} from 'lucide-react';

import {
  getPartnerMessageStatusLabel,
  getPartnerQueueMetrics,
  getPartnerStageLabel,
} from '@/lib/partner-network-view';

import styles from './PartnerFinderClient.module.css';

type PartnerContact = {
  id?: string;
  name?: string | null;
  emailMasked: string | null;
  emailDomain?: string | null;
  verificationStatus: string;
  active: boolean;
};

type Partner = {
  id: string;
  displayName: string;
  legalName: string;
  countryCode: string;
  countryName: string;
  city: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  languages: string[];
  specialties: string[];
  fitScore: number;
  confidenceScore: number;
  stage: string;
  lastVerifiedAt: string | null;
  contacts: PartnerContact[];
  sources: Array<{
    id: string;
    type: string;
    sourceUrl: string | null;
    title: string | null;
    observedAt: string;
    trusted: boolean;
  }>;
  _count?: { messages: number; activities: number };
};

type PartnerDraft = {
  id: string;
  status: string;
  subject: string;
  body: string;
  language: string;
  turkishTranslation: string;
  warnings: string[];
  updatedAt: string;
};

type PartnerDetail = Partner & {
  drafts: PartnerDraft[];
  messages: Array<{
    id: string;
    status: string;
    recipientEmailMasked: string;
    subjectSnapshot: string;
    createdAt: string;
    sentAt: string | null;
    lastErrorCode: string | null;
  }>;
  activities: Array<{
    id: string;
    type: string;
    summary: string;
    createdAt: string;
  }>;
};

type Country = {
  code: string;
  name: string;
  language: string;
  priority: number;
  demandSignal: string;
  policy: string;
};

type MailboxState = {
  configured: boolean;
  mailbox: {
    email: string;
    status: string;
    lastTestedAt: string | null;
  } | null;
};

type Notice = { tone: 'success' | 'error' | 'info'; text: string };
type View = 'discover' | 'pipeline' | 'mailbox';

const stages = [
  'DISCOVERED',
  'QUALIFIED',
  'CONTACTED',
  'ENGAGED',
  'MEETING',
  'REVIEW',
  'AGREEMENT',
  'ACTIVE',
  'DISQUALIFIED',
  'NOT_INTERESTED',
  'DO_NOT_CONTACT',
  'ARCHIVED',
];

const pipelineStages = [
  'DISCOVERED',
  'QUALIFIED',
  'CONTACTED',
  'ENGAGED',
  'MEETING',
  'AGREEMENT',
  'ACTIVE',
];

const draftStatus: Record<string, string> = {
  DRAFT: 'Taslak',
  READY_FOR_APPROVAL: 'Onayınıza hazır',
  APPROVED: 'Onaylandı',
  INVALIDATED: 'Yeniden onay gerekli',
  QUEUED: 'Gönderim sırasında',
  SENT: 'Gönderildi',
  CANCELLED: 'İptal edildi',
};

const policyLabels: Record<string, string> = {
  ALLOWED: 'Gönderime açık',
  CONSENT_REQUIRED: 'Açık rıza kontrolü gerekli',
  MANUAL_REVIEW: 'Ülke kontrolü gerekli',
  BLOCKED: 'Gönderime kapalı',
  BLOCKED_PENDING_COUNTRY_REVIEW: 'Ülke kontrolü bekliyor',
};

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'İşlem tamamlanamadı.');
  }
  return data;
}

function relativeDate(value: string | null) {
  if (!value) return 'Henüz kontrol edilmedi';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

function mergePartners(current: Partner[], incoming: Partner[]) {
  const byId = new Map(current.map((partner) => [partner.id, partner]));
  incoming.forEach((partner) => byId.set(partner.id, partner));
  return [...byId.values()];
}

export default function PartnerFinderClient({
  initialPartners,
  owner,
  initialPartnerId = null,
  initialError = null,
}: {
  initialPartners: Partner[];
  owner: boolean;
  initialPartnerId?: string | null;
  initialError?: string | null;
}) {
  const [partners, setPartners] = useState(initialPartners);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryCode, setCountryCode] = useState('RU');
  const [countryQuery, setCountryQuery] = useState('');
  const [partnerQuery, setPartnerQuery] = useState('');
  const [view, setView] = useState<View>('discover');
  const [selected, setSelected] = useState<PartnerDetail | null>(null);
  const [mailbox, setMailbox] = useState<MailboxState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(
    initialError ? { tone: 'error', text: initialError } : null,
  );

  const selectedCountry = useMemo(
    () => countries.find((country) => country.code === countryCode) || null,
    [countries, countryCode],
  );

  const visibleCountries = useMemo(() => {
    const query = countryQuery.trim().toLocaleLowerCase('tr-TR');
    const list = query
      ? countries.filter((country) =>
          `${country.name} ${country.code}`.toLocaleLowerCase('tr-TR').includes(query),
        )
      : countries;
    return list.slice(0, 20);
  }, [countries, countryQuery]);

  const countryPartners = useMemo(() => {
    const query = partnerQuery.trim().toLocaleLowerCase('tr-TR');
    return partners
      .filter((partner) => partner.countryCode === countryCode)
      .filter((partner) =>
        query
          ? `${partner.displayName} ${partner.city || ''} ${partner.specialties.join(' ')}`
              .toLocaleLowerCase('tr-TR')
              .includes(query)
          : true,
      )
      .sort(
        (left, right) =>
          right.fitScore - left.fitScore ||
          right.confidenceScore - left.confidenceScore,
      )
      .slice(0, 30);
  }, [partners, countryCode, partnerQuery]);

  const metrics = useMemo(() => getPartnerQueueMetrics(partners), [partners]);

  const loadCountries = useCallback(async () => {
    try {
      const data = await jsonRequest('/api/fabrika/partners/countries');
      setCountries(data.countries);
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Ülkeler yüklenemedi.',
      });
    }
  }, []);

  const loadMailbox = useCallback(async () => {
    if (!owner) return;
    try {
      const data = await jsonRequest('/api/fabrika/partners/mailbox');
      setMailbox({ configured: data.configured, mailbox: data.mailbox });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'E-posta hesabı yüklenemedi.',
      });
    }
  }, [owner]);

  const openPartner = useCallback(async (partnerId: string) => {
    setBusy(`partner:${partnerId}`);
    try {
      const data = await jsonRequest(`/api/fabrika/partners/${partnerId}`);
      setSelected(data.partner);
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Partner açılamadı.',
      });
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCountries();
      void loadMailbox();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCountries, loadMailbox]);

  useEffect(() => {
    if (!initialPartnerId) return;
    const timer = window.setTimeout(() => void openPartner(initialPartnerId), 0);
    return () => window.clearTimeout(timer);
  }, [initialPartnerId, openPartner]);

  async function refreshPartners(filterCountry = countryCode) {
    const query = filterCountry ? `?countryCode=${filterCountry}` : '';
    const data = await jsonRequest(`/api/fabrika/partners${query}`);
    setPartners((current) => mergePartners(current, data.partners));
    return data.partners as Partner[];
  }

  async function discoverPartners() {
    if (!owner || !selectedCountry) return;
    setBusy('discover');
    setNotice({
      tone: 'info',
      text: `${selectedCountry.name} için açık işletme kaynakları taranıyor. Bu işlem yaklaşık 20 saniye sürebilir.`,
    });
    try {
      const result = await jsonRequest('/api/fabrika/partners/discovery-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerKey: 'authorized_directory',
          countryCode: selectedCountry.code,
        }),
      });
      const discovered = await refreshPartners(selectedCountry.code);
      setNotice({
        tone: 'success',
        text: `${result.acceptedCount || discovered.length} kaynaklı partner adayı hazırlandı.`,
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Partnerler bulunamadı.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function createDraft() {
    if (!selected) return;
    setBusy('draft');
    try {
      await jsonRequest(`/api/fabrika/partners/${selected.id}/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      await openPartner(selected.id);
      setNotice({
        tone: 'success',
        text: 'AI, doğrulanmış firma bilgilerine göre e-posta taslağını hazırladı.',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'E-posta hazırlanamadı.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function verifyContact(contactId: string) {
    if (!selected) return;
    if (!window.confirm('Kurumsal e-posta adresini ve kaynağını kontrol ettiğinizi onaylıyor musunuz?')) return;
    setBusy(`contact:${contactId}`);
    try {
      await jsonRequest(
        `/api/fabrika/partners/${selected.id}/contacts/${contactId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'VERIFY',
            note: 'Kurumsal kaynak ve e-posta kullanıcı tarafından kontrol edildi.',
          }),
        },
      );
      await openPartner(selected.id);
      setNotice({ tone: 'success', text: 'Kurumsal e-posta doğrulandı.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'E-posta doğrulanamadı.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function updateStage(stage: string) {
    if (!selected) return;
    setBusy('stage');
    try {
      await jsonRequest(`/api/fabrika/partners/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      await openPartner(selected.id);
      await refreshPartners(selected.countryCode);
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Aşama değiştirilemedi.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft(draft: PartnerDraft, changes: Partial<PartnerDraft>) {
    setBusy(`draft:${draft.id}`);
    try {
      await jsonRequest(`/api/fabrika/partners/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: changes.subject ?? draft.subject,
          body: changes.body ?? draft.body,
          turkishTranslation:
            changes.turkishTranslation ?? draft.turkishTranslation,
        }),
      });
      if (selected) await openPartner(selected.id);
      setNotice({ tone: 'success', text: 'E-posta taslağı kaydedildi.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Taslak kaydedilemedi.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function approveAndSend(draftId: string) {
    if (!selected) return;
    setBusy(`approve:${draftId}`);
    try {
      await jsonRequest(
        `/api/fabrika/partners/drafts/${draftId}/approve-and-send`,
        { method: 'POST' },
      );
      await openPartner(selected.id);
      await refreshPartners(selected.countryCode);
      setNotice({
        tone: 'success',
        text: 'Onayınız kaydedildi; e-posta güvenli gönderim sırasına alındı.',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'E-posta gönderilemedi.',
      });
    } finally {
      setBusy(null);
    }
  }

  async function connectMailbox() {
    setBusy('mailbox');
    try {
      const data = await jsonRequest('/api/fabrika/partners/google/connect', {
        method: 'POST',
      });
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Bağlantı başlatılamadı.',
      });
      setBusy(null);
    }
  }

  async function testMailbox() {
    setBusy('mailbox');
    try {
      const data = await jsonRequest('/api/fabrika/partners/google/test', {
        method: 'POST',
      });
      await loadMailbox();
      setNotice({ tone: 'success', text: data.message });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'E-posta testi başarısız.',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGrid} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            <Network size={16} /> Türkiye Alıcı Pazarları
          </span>
          <h1>Türkiye’ye alıcı gönderen pazarlarda doğru emlak partnerini bulun.</h1>
          <p>
            Türkiye’de konut alan yabancıların öne çıktığı 20 pazardan birini seçin.
            AI o ülkedeki 30 emlak ofisini bulsun, sıralasın ve firmaya özel e-postayı hazırlasın.
          </p>
          <div className={styles.heroActions}>
            <button
              className={styles.primaryButton}
              onClick={() => {
                setView('discover');
                document.getElementById('partner-discovery')?.scrollIntoView({ behavior: 'smooth' });
              }}
              type="button"
            >
              <Globe2 /> Partner bulmaya başla <ArrowRight />
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => setView('mailbox')}
              type="button"
            >
              <Mail /> E-posta hesabım
            </button>
          </div>
        </div>
        <div className={styles.orbitCard} aria-label="Türkiye odaklı alıcı pazarı özeti">
          <span className={styles.orbit} />
          <Globe2 className={styles.globeIcon} />
          <div className={styles.nodeOne} />
          <div className={styles.nodeTwo} />
          <div className={styles.nodeThree} />
          <strong>{countries.length || 20}</strong>
          <span>Türkiye odaklı alıcı pazarı</span>
        </div>
      </section>

      {notice && (
        <div className={styles.notice} data-tone={notice.tone} role="status">
          {notice.tone === 'success' ? <CircleCheck /> : notice.tone === 'error' ? <CircleAlert /> : <CircleDashed />}
          <span>{notice.text}</span>
          <button aria-label="Bildirimi kapat" onClick={() => setNotice(null)} type="button">
            <X />
          </button>
        </div>
      )}

      <section className={styles.flow} aria-label="Partner bulma adımları">
        {[
          ['01', 'Alıcı pazarını seçin', 'Türkiye’de konut talebi yüksek 20 ülkeden birini seçin.'],
          ['02', '30 ofisi inceleyin', 'Firma, şehir, uzmanlık, iletişim ve uygunluk bilgilerini görün.'],
          ['03', 'AI e-postasını gönderin', 'Metni kontrol edin, onaylayın ve gönderin.'],
        ].map(([number, title, description], index) => (
          <article key={number}>
            <span>{number}</span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            {index < 2 && <ChevronRight aria-hidden="true" />}
          </article>
        ))}
      </section>

      <nav className={styles.viewSwitch} aria-label="Partner Bulucu bölümleri">
        <button data-active={view === 'discover'} onClick={() => setView('discover')} type="button">
          <Search /> Partner Keşfi
        </button>
        <button data-active={view === 'pipeline'} onClick={() => setView('pipeline')} type="button">
          <Handshake /> Partner Sürecim
          <span>{metrics.pipeline + metrics.active}</span>
        </button>
        <button data-active={view === 'mailbox'} onClick={() => setView('mailbox')} type="button">
          <Inbox /> E-posta Bağlantısı
          <i data-connected={mailbox?.mailbox?.status === 'CONNECTED'} />
        </button>
      </nav>

      {view === 'discover' && (
        <div className={styles.discoveryLayout} id="partner-discovery">
          <aside className={styles.countryPanel}>
            <div className={styles.sectionHeading}>
              <span>1</span>
              <div>
                <h2>Hangi alıcı pazarında partner arıyorsunuz?</h2>
                <p>Türkiye’ye gayrimenkul talebi güçlü 20 pazardan birini seçin.</p>
              </div>
            </div>
            <label className={styles.searchField}>
              <Search />
              <span className="sr-only">Ülke ara</span>
              <input
                onChange={(event) => setCountryQuery(event.target.value)}
                placeholder="Örn. Rusya, İran, Almanya..."
                value={countryQuery}
              />
            </label>
            <div className={styles.countryList}>
              {visibleCountries.map((country) => (
                <button
                  data-selected={country.code === countryCode}
                  key={country.code}
                  onClick={() => {
                    setCountryCode(country.code);
                    setCountryQuery('');
                    setPartnerQuery('');
                  }}
                  type="button"
                >
                  <span>{String(country.priority).padStart(2, '0')}</span>
                  <div>
                    <strong>{country.name}</strong>
                    <small>{country.demandSignal}</small>
                  </div>
                  {country.code === countryCode ? <Check /> : <ChevronRight />}
                </button>
              ))}
            </div>
            <p className={styles.countryCount}>
              <Globe2 /> TÜİK eğilimine göre {countries.length || 20} odak pazar
            </p>
          </aside>

          <main className={styles.resultsPanel}>
            <header className={styles.resultsHeader}>
              <div>
                <span className={styles.resultsKicker}>2 · AI ÖNERİLERİ</span>
                <h2>{selectedCountry?.name || 'Bu pazar'} için en güçlü 30 emlak ofisi</h2>
                <p>
                  Halka açık işletme kaynakları; web sitesi, iletişim bilgisi, veri
                  bütünlüğü ve Türkiye portföylerine uygunluk sinyallerine göre sıralanır.
                </p>
              </div>
              <button
                className={styles.discoverButton}
                disabled={!owner || busy === 'discover' || !selectedCountry}
                onClick={discoverPartners}
                type="button"
              >
                {busy === 'discover' ? <Loader2 className={styles.spin} /> : <Sparkles />}
                {busy === 'discover' ? '30 ofis aranıyor...' : '30 emlak ofisini bul'}
              </button>
            </header>

            {selectedCountry && (
              <div className={styles.marketContext}>
                <BadgeCheck />
                <div>
                  <strong>{selectedCountry.demandSignal}</strong>
                  <span>TÜİK 2025 yıl sonu ve 2026 ilk yarı yabancı konut alımı eğilimi</span>
                </div>
                <b>Öncelik {String(selectedCountry.priority).padStart(2, '0')}</b>
              </div>
            )}

            <div className={styles.resultTools}>
              <label className={styles.searchField}>
                <Search />
                <span className="sr-only">Partner ara</span>
                <input
                  onChange={(event) => setPartnerQuery(event.target.value)}
                  placeholder="Firma veya şehir ara"
                  value={partnerQuery}
                />
              </label>
              <span>{countryPartners.length} aday gösteriliyor</span>
            </div>

            {countryPartners.length ? (
              <div className={styles.partnerGrid}>
                {countryPartners.map((partner, index) => (
                  <button
                    className={styles.partnerCard}
                    key={partner.id}
                    onClick={() => void openPartner(partner.id)}
                    type="button"
                  >
                    <div className={styles.rank}>#{String(index + 1).padStart(2, '0')}</div>
                    <div className={styles.companyMark}>
                      {partner.displayName.slice(0, 2).toLocaleUpperCase('tr-TR')}
                    </div>
                    <div className={styles.partnerBody}>
                      <div className={styles.partnerTitle}>
                        <h3>{partner.displayName}</h3>
                        {partner.contacts.some((contact) => contact.emailMasked) && (
                          <span><Mail /> E-posta var</span>
                        )}
                      </div>
                      <p><MapPin /> {partner.city || partner.countryName}</p>
                      <div className={styles.tags}>
                        {(partner.specialties.length ? partner.specialties : ['Gayrimenkul']).slice(0, 2).map((item) => (
                          <span key={item}>{item}</span>
                        ))}
                        {partner.languages[0] && <span><Languages /> {partner.languages[0].toUpperCase()}</span>}
                      </div>
                      <div className={styles.cardFooter}>
                        <div>
                          <span>AI uygunluk</span>
                          <strong>%{Math.round(partner.fitScore)}</strong>
                        </div>
                        <div className={styles.scoreTrack}>
                          <i style={{ width: `${Math.max(4, partner.fitScore)}%` }} />
                        </div>
                        <span className={styles.inspect}>İncele <ArrowRight /></span>
                      </div>
                    </div>
                    {busy === `partner:${partner.id}` && <Loader2 className={`${styles.cardLoader} ${styles.spin}`} />}
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <div><UsersRound /></div>
                <h3>{selectedCountry?.name || 'Bu pazar'} için henüz ofis listesi yok</h3>
                <p>Tek tuşla açık işletme verilerinden iletişim ve uygunluk bilgileri bulunan 30 eşleşmeyi hazırlayın.</p>
                <button disabled={!owner || busy === 'discover'} onClick={discoverPartners} type="button">
                  <Sparkles /> İlk partnerleri bul
                </button>
              </div>
            )}

            <footer className={styles.attribution}>
              Kaynaklardan biri: © OpenStreetMap katkıda bulunanları. “Top 30”, resmî bir başarı listesi değil; kaynak kalitesi ve uygunluk sıralamasıdır.
            </footer>
          </main>
        </div>
      )}

      {view === 'pipeline' && (
        <section className={styles.pipelineView}>
          <header className={styles.simpleHeader}>
            <div>
              <span>PARTNER SÜRECİM</span>
              <h2>Her görüşmenin nerede olduğunu tek bakışta görün.</h2>
            </div>
            <button onClick={() => setView('discover')} type="button"><Search /> Yeni partner bul</button>
          </header>
          <div className={styles.metricGrid}>
            {[
              ['Yeni aday', metrics.candidates, Building2],
              ['Kontrol bekliyor', metrics.approval, ShieldCheck],
              ['İletişim sürecinde', metrics.pipeline, Mail],
              ['Aktif partner', metrics.active, Handshake],
            ].map(([label, value, Icon]) => {
              const MetricIcon = Icon as typeof Building2;
              return <article key={String(label)}><MetricIcon /><span>{String(label)}</span><strong>{String(value)}</strong></article>;
            })}
          </div>
          <div className={styles.pipelineColumns}>
            {pipelineStages.map((stage) => {
              const items = partners.filter((partner) => partner.stage === stage);
              return (
                <section key={stage}>
                  <header><span>{getPartnerStageLabel(stage)}</span><strong>{items.length}</strong></header>
                  <div>
                    {items.slice(0, 8).map((partner) => (
                      <button key={partner.id} onClick={() => void openPartner(partner.id)} type="button">
                        <span>{partner.countryCode}</span>
                        <div><strong>{partner.displayName}</strong><small>{partner.city || partner.countryName}</small></div>
                        <ChevronRight />
                      </button>
                    ))}
                    {!items.length && <p>Bu aşamada partner yok.</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      )}

      {view === 'mailbox' && (
        <section className={styles.mailboxView}>
          <div className={styles.mailboxIntro}>
            <span className={styles.eyebrow}><ShieldCheck /> Güvenli gönderim</span>
            <h2>E-postalar kendi Google hesabınızdan gönderilsin.</h2>
            <p>Business CEO AI yalnızca gönderme izni ister. Gelen kutunuzu okumaz, şifrenizi görmez ve e-postayı onayınız olmadan göndermez.</p>
            <ul>
              <li><CheckCircle2 /> Firma bilgilerine göre kişiselleştirilmiş metin</li>
              <li><CheckCircle2 /> Göndermeden önce konu ve içerik kontrolü</li>
              <li><CheckCircle2 /> Günlük limit, vazgeçme ve tekrar gönderim koruması</li>
            </ul>
          </div>
          <div className={styles.mailboxCard}>
            <div className={styles.mailboxIcon} data-connected={mailbox?.mailbox?.status === 'CONNECTED'}>
              {mailbox?.mailbox?.status === 'CONNECTED' ? <BadgeCheck /> : <Unplug />}
            </div>
            <span>GÖNDERİCİ HESABI</span>
            <h3>{mailbox?.mailbox?.email || 'Henüz e-posta hesabı bağlanmadı'}</h3>
            <p>{mailbox?.mailbox?.status === 'CONNECTED' ? 'Hesabınız gönderime hazır.' : 'Google hesabınızı tek adımda güvenle bağlayın.'}</p>
            {!owner ? (
              <div className={styles.ownerOnly}>Bu ayarı yalnızca şirket patronu değiştirebilir.</div>
            ) : mailbox === null ? (
              <Loader2 className={styles.spin} />
            ) : mailbox.mailbox?.status === 'CONNECTED' ? (
              <button className={styles.primaryButton} disabled={busy === 'mailbox'} onClick={testMailbox} type="button">
                <RefreshCw /> Bağlantıyı test et
              </button>
            ) : (
              <button className={styles.primaryButton} disabled={!mailbox.configured || busy === 'mailbox'} onClick={connectMailbox} type="button">
                <Mail /> Google hesabımı bağla
              </button>
            )}
            {mailbox && !mailbox.configured && <small>Sistem yöneticisinin Google gönderim bağlantısını yapılandırması gerekiyor.</small>}
          </div>
        </section>
      )}

      {selected && (
        <PartnerDrawer
          busy={busy}
          countryPolicy={countries.find((country) => country.code === selected.countryCode)?.policy}
          mailboxConnected={mailbox?.mailbox?.status === 'CONNECTED'}
          onApprove={approveAndSend}
          onClose={() => setSelected(null)}
          onCreateDraft={createDraft}
          onSaveDraft={saveDraft}
          onUpdateStage={updateStage}
          onVerifyContact={verifyContact}
          owner={owner}
          partner={selected}
        />
      )}
    </div>
  );
}

function PartnerDrawer({
  partner,
  owner,
  busy,
  countryPolicy,
  mailboxConnected,
  onClose,
  onCreateDraft,
  onVerifyContact,
  onUpdateStage,
  onSaveDraft,
  onApprove,
}: {
  partner: PartnerDetail;
  owner: boolean;
  busy: string | null;
  countryPolicy?: string;
  mailboxConnected: boolean;
  onClose: () => void;
  onCreateDraft: () => void;
  onVerifyContact: (contactId: string) => void;
  onUpdateStage: (stage: string) => void;
  onSaveDraft: (draft: PartnerDraft, changes: Partial<PartnerDraft>) => void;
  onApprove: (draftId: string) => void;
}) {
  const contact = partner.contacts.find((item) => item.active && item.emailMasked);
  const verified = contact?.verificationStatus === 'SOURCE_VERIFIED' || contact?.verificationStatus === 'MANUALLY_VERIFIED';
  const latestDraft = partner.drafts[0];
  const readyToSend = verified && mailboxConnected && countryPolicy === 'ALLOWED';

  return (
    <div className={styles.drawerBackdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className={styles.drawer} aria-label={`${partner.displayName} partner detayları`}>
        <header className={styles.drawerHeader}>
          <div className={styles.companyMark}>{partner.displayName.slice(0, 2).toLocaleUpperCase('tr-TR')}</div>
          <div>
            <span>{partner.countryCode} · {partner.countryName}</span>
            <h2>{partner.displayName}</h2>
            <p><MapPin /> {partner.city || 'Şehir belirtilmedi'} · AI uygunluk %{Math.round(partner.fitScore)}</p>
          </div>
          <button aria-label="Partner detayını kapat" onClick={onClose} type="button"><X /></button>
        </header>

        <div className={styles.drawerSteps}>
          {[
            ['Firma', true],
            ['E-posta', Boolean(contact)],
            ['AI taslak', Boolean(latestDraft)],
            ['Gönderim', partner.messages.some((message) => ['QUEUED', 'SENT', 'DELIVERED'].includes(message.status))],
          ].map(([label, complete], index) => (
            <div data-complete={complete} key={String(label)}><span>{complete ? <Check /> : index + 1}</span><strong>{String(label)}</strong></div>
          ))}
        </div>

        <div className={styles.drawerContent}>
          <section className={styles.partnerSummary}>
            <div className={styles.summaryTop}>
              <div>
                <span>FİRMA BİLGİLERİ</span>
                <h3>İletişim öncesi hızlı kontrol</h3>
              </div>
              {owner ? (
                <select aria-label="Partner aşaması" disabled={busy === 'stage'} onChange={(event) => onUpdateStage(event.target.value)} value={partner.stage}>
                  {stages.map((stage) => <option key={stage} value={stage}>{getPartnerStageLabel(stage)}</option>)}
                </select>
              ) : <span className={styles.stageBadge}>{getPartnerStageLabel(partner.stage)}</span>}
            </div>
            <div className={styles.summaryGrid}>
              <div><span>Uzmanlık</span><strong>{partner.specialties[0] || 'Gayrimenkul'}</strong></div>
              <div><span>Dil</span><strong>{partner.languages.join(', ').toUpperCase() || 'EN'}</strong></div>
              <div><span>Kaynak kontrolü</span><strong>{relativeDate(partner.lastVerifiedAt)}</strong></div>
              <div><span>Kaynak güveni</span><strong>%{Math.round(partner.confidenceScore)}</strong></div>
            </div>
            {partner.websiteUrl && <a href={partner.websiteUrl} rel="noreferrer" target="_blank">Kurumsal web sitesini aç <ExternalLink /></a>}
          </section>

          <section className={styles.contactSection}>
            <div className={styles.sectionTitle}><span>1</span><div><h3>Kurumsal e-postayı kontrol edin</h3><p>Yalnızca firmaya ait iş adresleri kullanılabilir.</p></div></div>
            {contact ? (
              <div className={styles.contactCard} data-verified={verified}>
                <Mail />
                <div><strong>{contact.emailMasked}</strong><span>{verified ? 'Kontrol edildi · gönderime uygun' : 'Kaynak bulundu · sizin kontrolünüz gerekli'}</span></div>
                {verified ? <BadgeCheck /> : owner && contact.id ? <button disabled={busy === `contact:${contact.id}`} onClick={() => onVerifyContact(contact.id!)} type="button">Kontrol ettim</button> : null}
              </div>
            ) : (
              <div className={styles.missingContact}><CircleAlert /><div><strong>Kurumsal e-posta bulunamadı</strong><span>Firmanın web sitesindeki iletişim sayfasını kontrol edin.</span></div></div>
            )}
          </section>

          <section className={styles.draftSection}>
            <div className={styles.sectionTitle}><span>2</span><div><h3>AI e-postasını hazırlayın</h3><p>AI yalnızca yukarıdaki kaynaklı firma bilgilerini kullanır.</p></div></div>
            {!latestDraft ? (
              <button className={styles.aiDraftButton} disabled={!contact || busy === 'draft'} onClick={onCreateDraft} type="button">
                {busy === 'draft' ? <Loader2 className={styles.spin} /> : <Sparkles />}
                <span><strong>Firmaya özel e-posta hazırla</strong><small>Hedef ülkenin dilinde ve Türkçe çevirisiyle</small></span>
                <ArrowRight />
              </button>
            ) : (
              <DraftEditor
                busy={busy === `draft:${latestDraft.id}` || busy === `approve:${latestDraft.id}`}
                canApprove={owner}
                draft={latestDraft}
                onApprove={() => onApprove(latestDraft.id)}
                onSave={(changes) => onSaveDraft(latestDraft, changes)}
                readyToSend={readyToSend}
              />
            )}
          </section>

          <section className={styles.sendReadiness}>
            <div className={styles.sectionTitle}><span>3</span><div><h3>Gönderim kontrolleri</h3><p>E-posta ancak tüm güvenlik adımları tamamlanınca gönderilir.</p></div></div>
            <div className={styles.checkList}>
              <CheckRow complete={Boolean(verified)} label="Kurumsal e-posta kontrol edildi" />
              <CheckRow complete={mailboxConnected} label="Google gönderici hesabı bağlı" />
              <CheckRow complete={countryPolicy === 'ALLOWED'} label={policyLabels[countryPolicy || ''] || 'Ülke gönderim politikası kontrol edilecek'} />
              <CheckRow complete={Boolean(latestDraft)} label="AI e-posta taslağı hazır" />
            </div>
          </section>

          {partner.messages.length > 0 && (
            <section className={styles.historySection}>
              <h3>Gönderim geçmişi</h3>
              {partner.messages.map((message) => (
                <article key={message.id}><Mail /><div><strong>{message.subjectSnapshot}</strong><span>{message.recipientEmailMasked} · {relativeDate(message.sentAt || message.createdAt)}</span></div><b>{getPartnerMessageStatusLabel(message.status)}</b></article>
              ))}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

function CheckRow({ complete, label }: { complete: boolean; label: string }) {
  return <div data-complete={complete}>{complete ? <CircleCheck /> : <CircleDashed />}<span>{label}</span></div>;
}

function DraftEditor({
  draft,
  busy,
  canApprove,
  readyToSend,
  onSave,
  onApprove,
}: {
  draft: PartnerDraft;
  busy: boolean;
  canApprove: boolean;
  readyToSend: boolean;
  onSave: (changes: Partial<PartnerDraft>) => void;
  onApprove: () => void;
}) {
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [translationOpen, setTranslationOpen] = useState(false);

  return (
    <div className={styles.draftEditor}>
      <div className={styles.draftMeta}>
        <span><Sparkles /> AI tarafından hazırlandı</span>
        <b>{draftStatus[draft.status] || draft.status}</b>
      </div>
      <label>Konu<input onChange={(event) => setSubject(event.target.value)} value={subject} /></label>
      <label>E-posta metni<textarea onChange={(event) => setBody(event.target.value)} rows={9} value={body} /></label>
      <button className={styles.translationToggle} onClick={() => setTranslationOpen((value) => !value)} type="button">
        <Languages /> {translationOpen ? 'Türkçe çeviriyi gizle' : 'Türkçe çeviriyi göster'}
      </button>
      {translationOpen && <div className={styles.translation}>{draft.turkishTranslation}</div>}
      {draft.warnings.length > 0 && <div className={styles.draftWarning}><CircleAlert /> {draft.warnings.join(' ')}</div>}
      <div className={styles.draftActions}>
        <button disabled={busy} onClick={() => onSave({ subject, body })} type="button">Değişiklikleri kaydet</button>
        {canApprove && <button className={styles.sendButton} disabled={busy || !readyToSend || draft.status === 'SENT'} onClick={onApprove} type="button"><Send /> Onayla ve gönder</button>}
      </div>
      {!readyToSend && <small className={styles.readyHint}>Gönderme tuşu, aşağıdaki kontroller tamamlandığında açılır.</small>}
    </div>
  );
}
