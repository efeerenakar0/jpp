'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  Globe2,
  Handshake,
  Languages,
  LayoutDashboard,
  Loader2,
  Mail,
  MapPin,
  Network,
  Plus,
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
  about?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  licenseNumber?: string | null;
  reviewAverage?: number | null;
  reviewCount?: number | null;
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
type View = 'pipeline' | 'mailbox';

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

const workflowColumns = [
  { key: 'new', title: 'Yeni Bulunanlar', stages: ['DISCOVERED'] },
  { key: 'review', title: 'İnceleniyor', stages: ['QUALIFIED', 'REVIEW'] },
  { key: 'contact', title: 'İletişimde', stages: ['CONTACTED', 'ENGAGED', 'MEETING', 'AGREEMENT'] },
  { key: 'active', title: 'Aktif Partner', stages: ['ACTIVE'] },
] as const;

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

function countryFlag(code: string) {
  return code
    .toUpperCase()
    .replace(/[A-Z]/g, (letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)));
}

function partnerAbout(partner: Partner) {
  if (partner.about?.trim()) return partner.about.trim();
  const specialty = partner.specialties.slice(0, 2).join(' ve ').toLocaleLowerCase('tr-TR');
  return `${partner.displayName}, ${partner.city || partner.countryName} merkezli${specialty ? `; ${specialty} alanlarında çalışan` : ''} bir gayrimenkul kuruluşudur. Bu özet, doğrulanabilir açık kaynak profil bilgileriyle sınırlıdır.`;
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
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [partnerQuery, setPartnerQuery] = useState('');
  const [view, setView] = useState<View>('pipeline');
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
    return list.slice(0, 25);
  }, [countries, countryQuery]);

  const selectedCountryPartners = useMemo(
    () => partners.filter((partner) => partner.countryCode === countryCode),
    [partners, countryCode],
  );

  const countryPartners = useMemo(() => {
    const query = partnerQuery.trim().toLocaleLowerCase('tr-TR');
    return selectedCountryPartners
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
  }, [selectedCountryPartners, partnerQuery]);

  const metrics = useMemo(
    () => getPartnerQueueMetrics(selectedCountryPartners),
    [selectedCountryPartners],
  );

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
      <header className={styles.workspaceHeader}>
        <div>
          <span className={styles.workspaceEyebrow}>
            <Network /> Partner Bulucu
          </span>
          <h1>Keşiften anlaşmaya, tek akış.</h1>
          <p>Türkiye’ye yatırımcı gönderen 25 pazardaki doğru emlak ofislerini bulun, doğrulayın ve ilişkiyi yönetin.</p>
        </div>
        <div className={styles.workspaceActions}>
          <button
            className={styles.secondaryButton}
            onClick={() => setView((current) => current === 'mailbox' ? 'pipeline' : 'mailbox')}
            type="button"
          >
            {view === 'mailbox' ? <LayoutDashboard /> : <Mail />}
            {view === 'mailbox' ? 'Partner akışına dön' : 'E-posta bağlantısı'}
          </button>
          <button
            className={styles.primaryButton}
            disabled={!owner || busy === 'discover' || !selectedCountry}
            onClick={() => {
              setView('pipeline');
              void discoverPartners();
            }}
            type="button"
          >
            {busy === 'discover' ? <Loader2 className={styles.spin} /> : <Plus />}
            {busy === 'discover' ? 'Partnerler aranıyor' : 'Yeni tarama'}
          </button>
        </div>
      </header>

      {notice && (
        <div className={styles.notice} data-tone={notice.tone} role="status">
          {notice.tone === 'success' ? <CircleCheck /> : notice.tone === 'error' ? <CircleAlert /> : <CircleDashed />}
          <span>{notice.text}</span>
          <button aria-label="Bildirimi kapat" onClick={() => setNotice(null)} type="button">
            <X />
          </button>
        </div>
      )}

      {view !== 'mailbox' && (
        <ol className={styles.workspaceSteps} aria-label="Partner iş akışı">
          {[
            { number: '1', label: 'Pazar Seç', icon: Globe2 },
            { number: '2', label: 'Partnerleri Bul', icon: Search },
            { number: '3', label: 'E-postayı Hazırla', icon: Mail },
            { number: '4', label: 'Anlaşmayı Takip Et', icon: Handshake },
          ].map(({ number, label, icon: StepIcon }, index) => {
            return (
              <li data-active={index === 0} key={label}>
                <span>{number}</span>
                <StepIcon />
                <strong>{label}</strong>
              </li>
            );
          })}
        </ol>
      )}


      {view === 'pipeline' && (
        <section className={styles.pipelineWorkspace} id="partner-discovery">
          <div className={styles.marketToolbar}>
            <div className={styles.countryPicker}>
              <button
                aria-controls="partner-country-menu"
                aria-expanded={countryPickerOpen}
                className={styles.countryPickerButton}
                onClick={() => setCountryPickerOpen((current) => !current)}
                type="button"
              >
                <span className={styles.flag} aria-hidden="true">{countryFlag(countryCode)}</span>
                <span>
                  <small>Alıcı pazarı</small>
                  <strong>{selectedCountry?.name || 'Ülke seçin'}</strong>
                </span>
                <ChevronDown />
              </button>
              {countryPickerOpen && (
                <div className={styles.countryMenu} id="partner-country-menu">
                  <label className={styles.countrySearch}>
                    <Search />
                    <span className="sr-only">Ülke ara</span>
                    <input
                      autoFocus
                      onChange={(event) => setCountryQuery(event.target.value)}
                      placeholder="25 pazar içinde ara"
                      value={countryQuery}
                    />
                  </label>
                  <div>
                    {visibleCountries.map((country) => (
                      <button
                        data-selected={country.code === countryCode}
                        key={country.code}
                        onClick={() => {
                          setCountryCode(country.code);
                          setCountryQuery('');
                          setPartnerQuery('');
                          setCountryPickerOpen(false);
                        }}
                        type="button"
                      >
                        <span className={styles.flag} aria-hidden="true">{countryFlag(country.code)}</span>
                        <span><strong>{country.name}</strong><small>{country.demandSignal}</small></span>
                        {country.code === countryCode ? <Check /> : <b>{String(country.priority).padStart(2, '0')}</b>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <label className={styles.partnerSearch}>
              <Search />
              <span className="sr-only">Partner ara</span>
              <input
                onChange={(event) => setPartnerQuery(event.target.value)}
                placeholder="Firma, şehir veya uzmanlık ara"
                value={partnerQuery}
              />
            </label>

            <div className={styles.marketSignal}>
              <BadgeCheck />
              <span><small>Pazar sinyali</small><strong>{selectedCountry?.demandSignal || 'Veri yükleniyor'}</strong></span>
            </div>
          </div>

          <div className={styles.pipelineSummary} aria-label="Seçili pazar partner özeti">
            <span><UsersRound /> <strong>{selectedCountryPartners.length}</strong> aday</span>
            <i />
            <span><Search /> <strong>{metrics.approval}</strong> inceleniyor</span>
            <i />
            <span><Mail /> <strong>{metrics.pipeline}</strong> iletişimde</span>
            <i />
            <span data-tone="success"><Handshake /> <strong>{metrics.active}</strong> aktif</span>
            <button
              disabled={!owner || busy === 'discover' || !selectedCountry}
              onClick={() => void discoverPartners()}
              type="button"
            >
              {busy === 'discover' ? <Loader2 className={styles.spin} /> : <Sparkles />}
              {countryPartners.length ? 'Listeyi güncelle' : '30 partneri bul'}
            </button>
          </div>

          <div className={styles.pipelineBoard}>
            {workflowColumns.map((column) => {
              const items = countryPartners.filter((partner) =>
                (column.stages as readonly string[]).includes(partner.stage),
              );
              return (
                <section className={styles.pipelineColumn} data-column={column.key} key={column.key}>
                  <header>
                    <span>{column.title}</span>
                    <strong>{items.length}</strong>
                  </header>
                  <div className={styles.pipelineCards}>
                    {items.map((partner) => (
                      <button
                        className={styles.pipelineCard}
                        data-selected={selected?.id === partner.id}
                        key={partner.id}
                        onClick={() => void openPartner(partner.id)}
                        type="button"
                      >
                        <div className={styles.pipelineCardTop}>
                          <PartnerLogo partner={partner} />
                          <div>
                            <strong>{partner.displayName}</strong>
                            <span><span className={styles.miniFlag} aria-hidden="true">{countryFlag(partner.countryCode)}</span>{partner.countryCode} · {partner.city || partner.countryName}</span>
                          </div>
                          <b>%{Math.round(partner.fitScore)}</b>
                        </div>
                        <div className={styles.verifiedRow} data-verified={partner.contacts.some((contact) => contact.emailMasked)}>
                          <ShieldCheck />
                          {partner.contacts.some((contact) => contact.emailMasked) ? 'Kurumsal iletişim bulundu' : 'İletişim doğrulaması bekliyor'}
                        </div>
                        <p>{partnerAbout(partner)}</p>
                        <div className={styles.pipelineTags}>
                          {(partner.specialties.length ? partner.specialties : ['Gayrimenkul danışmanlığı']).slice(0, 2).map((specialty) => (
                            <span key={specialty}>{specialty}</span>
                          ))}
                        </div>
                        <footer>
                          <span>Son kaynak: {relativeDate(partner.lastVerifiedAt)}</span>
                          <span>Profili aç <ArrowRight /></span>
                        </footer>
                        {busy === `partner:${partner.id}` && <Loader2 className={`${styles.cardLoader} ${styles.spin}`} />}
                      </button>
                    ))}
                    {!items.length && (
                      <div className={styles.columnEmpty}>
                        <Building2 />
                        <span>Bu aşamada partner yok.</span>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <footer className={styles.attribution}>
            <span>Her pazarda en fazla 30 kaynaklı eşleşme gösterilir. “En iyi”, resmî başarı sırası değil; kaynak kalitesi ve iş ortaklığı uygunluk puanıdır.</span>
            <a href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">© OpenStreetMap katkıda bulunanları · ODbL <ExternalLink /></a>
          </footer>
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

function PartnerLogo({ partner, large = false }: { partner: Partner; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const initials = partner.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('tr-TR');

  return (
    <span className={styles.partnerLogo} data-large={large}>
      {partner.logoUrl && !failed ? (
        // Remote organization marks come from the cited source URL and keep fixed dimensions to avoid CLS.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={`${partner.displayName} logosu`}
          height={large ? 64 : 42}
          loading="lazy"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={partner.logoUrl}
          width={large ? 64 : 42}
        />
      ) : (
        <b aria-label={`${partner.displayName} logo yer tutucusu`}>{initials || 'PB'}</b>
      )}
    </span>
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
          <PartnerLogo large partner={partner} />
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
            <div className={styles.aboutSection}>
              <span>HAKKINDA</span>
              <p>{partnerAbout(partner)}</p>
              {partner.address && <small><MapPin /> {partner.address}</small>}
            </div>
            {(partner.registrationNumber || partner.licenseNumber || partner.reviewAverage) && (
              <div className={styles.profileFacts}>
                {partner.registrationNumber && <span><small>Kayıt no</small><strong>{partner.registrationNumber}</strong></span>}
                {partner.licenseNumber && <span><small>Lisans no</small><strong>{partner.licenseNumber}</strong></span>}
                {partner.reviewAverage && <span><small>Kaynak puanı</small><strong>{partner.reviewAverage.toFixed(1)} / 5 {partner.reviewCount ? `(${partner.reviewCount})` : ''}</strong></span>}
              </div>
            )}
            {partner.websiteUrl && <a href={partner.websiteUrl} rel="noreferrer" target="_blank">Kurumsal web sitesini aç <ExternalLink /></a>}
            {partner.sources.length > 0 && (
              <div className={styles.sourceLinks}>
                {partner.sources.slice(0, 3).map((source) => source.sourceUrl && (
                  <a href={source.sourceUrl} key={source.id} rel="noreferrer" target="_blank">
                    {source.title || 'Profil kaynağı'} <ExternalLink />
                  </a>
                ))}
              </div>
            )}
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
