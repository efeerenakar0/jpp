'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  ImageIcon,
  KeyRound,
  Loader2,
  MapPin,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Plus,
  Rocket,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Users2,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import AdCopyCard from '@/components/fabrika/AdCopyCard';
import EmptyState from '@/components/fabrika/EmptyState';
import InternationalMarketingPanel from '@/components/fabrika/InternationalMarketingPanel';
import LoadingSkeleton from '@/components/fabrika/LoadingSkeleton';
import type { InternationalMarketingPlan } from '@/lib/international-marketing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import styles from './marketing.module.css';

type Property = {
  id: string;
  title: string;
  location: string | null;
  price: number | null;
  imageUrl: string | null;
  referenceCode: string | null;
  status: string;
};

type AdCopy = {
  id: string;
  platform: 'GOOGLE_ADS' | 'INSTAGRAM' | 'WHATSAPP';
  headline: string;
  body: string;
  callToAction: string | null;
  targetUrl: string | null;
  approved: boolean;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  type: 'listing' | 'brand' | 'international';
  objective: string | null;
  audience: string | null;
  posterTemplate: string | null;
  posterHeadline: string | null;
  posterSubline: string | null;
  generatedBy: string | null;
  generatedModel: string | null;
  internationalPlan: InternationalMarketingPlan | null;
  createdAt: string;
  property: Omit<Property, 'status'> | null;
  adCopies: AdCopy[];
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

type MarketingData = {
  company: { name: string };
  permissions: { canManageSecrets: boolean };
  ai: {
    configured: boolean;
    active: boolean;
    keyHint: string | null;
    model: string;
    fallbackAvailable: boolean;
  };
  campaigns: Campaign[];
  properties: Property[];
  websiteAnalyses: WebsiteAnalysis[];
};

const inputClass =
  'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20';

function jsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function money(value: number | null) {
  if (!value) return 'Fiyat bilgisi yok';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MarketingPage() {
  const [data, setData] = useState<MarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [campaignType, setCampaignType] = useState<'listing' | 'brand'>('listing');
  const [propertyId, setPropertyId] = useState('');
  const [objective, setObjective] = useState('Nitelikli talep toplama');
  const [audience, setAudience] = useState('Bölgedeki alıcı ve yatırımcılar');
  const [tone, setTone] = useState('professional');
  const [posterTemplate, setPosterTemplate] = useState('SIGNATURE');
  const [targetUrl, setTargetUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('openrouter/free');
  const [aiActive, setAiActive] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/fabrika/marketing/campaigns', { cache: 'no-store' });
      const body = (await response.json()) as MarketingData & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Pazarlama verileri alınamadı.');
      setData(body);
      setModel(body.ai.model);
      setAiActive(body.ai.active || !body.ai.configured);
      setPropertyId((current) => current || body.properties[0]?.id || '');
      setExpanded((current) =>
        Object.keys(current).length || !body.campaigns[0]
          ? current
          : { [body.campaigns[0].id]: true }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Pazarlama verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const domesticCampaigns = useMemo(
    () => (data?.campaigns || []).filter((campaign) => campaign.type !== 'international'),
    [data]
  );

  const internationalCampaigns = useMemo(
    () => (data?.campaigns || []).filter((campaign) => campaign.type === 'international'),
    [data]
  );

  const stats = useMemo(() => {
    const copies = domesticCampaigns.flatMap((campaign) => campaign.adCopies);
    return {
      approved: copies.filter((copy) => copy.approved).length,
      posterReady: domesticCampaigns.filter((campaign) => campaign.posterHeadline).length,
    };
  }, [domesticCampaigns]);

  const selectedProperty = useMemo(
    () => data?.properties.find((property) => property.id === propertyId) || data?.properties[0] || null,
    [data?.properties, propertyId]
  );

  const previewCampaign = useMemo(
    () =>
      domesticCampaigns.find((campaign) => campaign.property?.id === selectedProperty?.id) ||
      domesticCampaigns[0] ||
      null,
    [domesticCampaigns, selectedProperty?.id]
  );

  const previewCopy = previewCampaign?.adCopies.find((copy) => copy.platform === 'INSTAGRAM') || null;

  const readiness = useMemo(() => {
    const fields = [objective, audience, tone, posterTemplate, targetUrl || selectedProperty?.title];
    return Math.round((fields.filter(Boolean).length / fields.length) * 100);
  }, [audience, objective, posterTemplate, selectedProperty?.title, targetUrl, tone]);

  async function copyPreview() {
    if (!previewCopy) return;
    await navigator.clipboard.writeText(
      [previewCopy.headline, previewCopy.body, previewCopy.callToAction].filter(Boolean).join('\n\n')
    );
    toast.success('Instagram metni kopyalandı.');
  }

  async function generateCampaign() {
    if (campaignType === 'listing' && !propertyId) {
      toast.error('Önce aktif bir portföy seçin.');
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch('/api/fabrika/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: campaignType,
          propertyId: campaignType === 'listing' ? propertyId : undefined,
          objective,
          audience,
          tone,
          posterTemplate,
          targetUrl,
        }),
      });
      const body = (await response.json()) as Campaign & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Kampanya üretilemedi.');
      toast.success('Kampanya, üç kanal metni ve poster şablonu hazır.');
      await fetchData();
      setExpanded((current) => ({ ...current, [body.id]: true }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Kampanya üretilemedi.');
    } finally {
      setGenerating(false);
    }
  }

  async function toggleApprove(adCopyId: string, approved: boolean) {
    try {
      const response = await fetch('/api/fabrika/marketing/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adCopyId, approved }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || 'Onay durumu değiştirilemedi.');
      }
      setData((current) =>
        current
          ? {
              ...current,
              campaigns: current.campaigns.map((campaign) => ({
                ...campaign,
                adCopies: campaign.adCopies.map((copy) =>
                  copy.id === adCopyId ? { ...copy, approved } : copy
                ),
              })),
            }
          : current
      );
      toast.success(approved ? 'İçerik onaylandı.' : 'İçerik yeniden taslağa alındı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem tamamlanamadı.');
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      const response = await fetch('/api/fabrika/marketing/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey || undefined, model, active: aiActive }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || 'AI ayarı kaydedilemedi.');
      toast.success('Pazarlamacı AI ayarı güvenle kaydedildi.');
      setApiKey('');
      setSettingsOpen(false);
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI ayarı kaydedilemedi.');
    } finally {
      setSavingSettings(false);
    }
  }

  async function analyzeWebsite() {
    if (!websiteUrl.trim()) {
      toast.error('Analiz edilecek web sitesi adresini girin.');
      return;
    }
    setAnalyzing(true);
    try {
      const response = await fetch('/api/fabrika/marketing/website-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Web sitesi analiz edilemedi.');
      toast.success('Web reklam yol haritası hazır.');
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Web sitesi analiz edilemedi.');
    } finally {
      setAnalyzing(false);
    }
  }

  const aiLabel = data?.ai.configured && data.ai.active
    ? `OpenRouter · ${data.ai.model}`
    : data?.ai.fallbackAvailable
      ? 'Business CEO AI Router · Groq + Cloudflare'
      : 'Akıllı kural motoru';

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>M3 · Akıllı pazarlama</p>
          <h1>Pazarlamacı</h1>
          <p>Aktif portföylerinizi doğru kitleye, doğru kanalda ve doğru mesajla ulaştırın.</p>
          <p>AI destekli pazarlama ile erişim ve nitelikli talep operasyonunu tek ekrandan yönetin.</p>
        </div>
        <div className={styles.heroActions}>
          <Button
            type="button"
            onClick={() => document.getElementById('campaign-builder')?.scrollIntoView({ behavior: 'smooth' })}
            className={styles.primaryButton}
          >
            <Plus /> Yeni kampanya oluştur
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('template')?.focus()}
            className={styles.secondaryButton}
          >
            <ImageIcon /> Şablonlar
          </Button>
          {data?.permissions.canManageSecrets && (
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)} className={styles.secondaryButton}>
              <Settings2 /> AI ayarları
            </Button>
          )}
          <Badge className={styles.aiBadge}><Bot /> {aiLabel}</Badge>
        </div>
      </header>

      <Tabs defaultValue="domestic" className={styles.marketTabs}>
        <div className={styles.marketBar}>
          <TabsList className={styles.countryTabs}>
            <TabsTrigger value="domestic">Yurt içi</TabsTrigger>
            <TabsTrigger value="international">Yurt dışı</TabsTrigger>
          </TabsList>
          <div className={styles.countrySelect}><span>🇹🇷</span> Türkiye <ChevronDown /></div>
        </div>

        <TabsContent value="domestic" className={styles.domesticContent}>
          <section className={styles.metrics} aria-label="Pazarlama özeti">
            {[
              { label: 'Aktif kampanya', value: domesticCampaigns.length, icon: Megaphone, note: 'şirket kampanyası' },
              { label: 'Aktif portföy', value: data?.properties.length || 0, icon: Target, note: 'kampanyaya hazır' },
              { label: 'Onaylı içerik', value: stats.approved, icon: Users2, note: 'kanal metni' },
              { label: 'Hazır poster', value: stats.posterReady, icon: MousePointerClick, note: 'indirilebilir' },
            ].map((metric) => {
              const Icon = metric.icon;
              return (
                <article key={metric.label} className={styles.metricCard}>
                  <span className={styles.metricIcon}><Icon /></span>
                  <div><span>{metric.label}</span><strong>{metric.value}</strong></div>
                  <small>{metric.note}</small>
                </article>
              );
            })}
          </section>

          <section className={styles.commandGrid}>
            <article id="campaign-builder" className={`${styles.panel} ${styles.builder}`}>
              <div className={styles.panelTitle}>
                <div><span>Kampanya oluşturucu</span><small>Portföy ve hedeflerinizi belirleyin</small></div>
                <Sparkles />
              </div>

              <div className={styles.sourceSwitch}>
                {([
                  ['listing', 'Aktif portföy'],
                  ['brand', 'Şirket markası'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setCampaignType(value)} data-active={campaignType === value}>
                    {label}
                  </button>
                ))}
              </div>

              {campaignType === 'listing' && (
                <>
                  <label htmlFor="property" className={styles.label}>Kampanya portföyü</label>
                  <select id="property" value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className={styles.select}>
                    <option value="">Portföy seçin</option>
                    {data?.properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.referenceCode ? `${property.referenceCode} · ` : ''}{property.title} · {money(property.price)}
                      </option>
                    ))}
                  </select>
                  {!loading && data?.properties.length === 0 && (
                    <p className={styles.warning}>Kampanya için önce Portföyler bölümünde aktif bir kayıt oluşturun.</p>
                  )}
                </>
              )}

              <div className={styles.propertyCard}>
                <div className={styles.propertyImage}>
                  {selectedProperty?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedProperty.imageUrl} alt={selectedProperty.title} />
                  ) : <ImageIcon />}
                </div>
                <div>
                  <strong>{selectedProperty?.title || data?.company.name || 'Kurumsal marka kampanyası'}</strong>
                  <span><MapPin /> {selectedProperty?.location || 'Konum bilgisi portföyden alınır'}</span>
                  <b>{money(selectedProperty?.price || null)}</b>
                  <small>{selectedProperty?.referenceCode || 'Şirket tanıtımı'} · {selectedProperty?.status || 'Aktif'}</small>
                </div>
              </div>

              <div className={styles.readiness}><span>Veri tamlığı</span><i><b style={{ width: `${readiness}%` }} /></i><strong>{readiness}%</strong></div>

              <fieldset className={styles.objectiveGroup}>
                <legend>Kampanya hedefi</legend>
                {['Farkındalık', 'Lead toplama', 'Ziyaret', 'Satış'].map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    data-active={objective === label || (index === 1 && objective === 'Nitelikli talep toplama')}
                    onClick={() => setObjective(index === 1 ? 'Nitelikli talep toplama' : label)}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>

              <div className={styles.formRows}>
                <label>Hedef kitle<Input value={audience} onChange={(event) => setAudience(event.target.value)} className={inputClass} /></label>
                <label>Mesaj tonu
                  <select value={tone} onChange={(event) => setTone(event.target.value)} className={styles.select}>
                    <option value="professional">Profesyonel &amp; güvenilir</option>
                    <option value="warm">Samimi</option>
                    <option value="premium">Premium</option>
                  </select>
                </label>
                <label>Poster şablonu
                  <select id="template" value={posterTemplate} onChange={(event) => setPosterTemplate(event.target.value)} className={styles.select}>
                    <option value="SIGNATURE">Signature · Dengeli</option>
                    <option value="EDITORIAL">Editorial · Premium</option>
                    <option value="BOLD">Bold · Yüksek dikkat</option>
                  </select>
                </label>
                <label>Hedef sayfa<Input type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://siteniz.com/portfoy/..." className={inputClass} /></label>
              </div>

              <div className={styles.channels}>
                <span>Kanallar</span>
                <b><ImageIcon /> Instagram</b><b><MessageCircle /> WhatsApp</b><b><Globe2 /> Google</b><b><Users2 /> Emlak grubu</b>
              </div>

              <Button
                type="button"
                onClick={generateCampaign}
                disabled={generating || (campaignType === 'listing' && !propertyId)}
                className={styles.generateButton}
              >
                {generating ? <Loader2 className="animate-spin" /> : <WandSparkles />}
                {generating ? 'Kampanya hazırlanıyor…' : 'AI kampanyasını oluştur'}
              </Button>
            </article>

            <article className={`${styles.panel} ${styles.previewPanel}`}>
              <div className={styles.panelTitle}>
                <div><span>Instagram gönderi önizleme</span><small>Gerçek poster ve kanal metni</small></div>
                <ImageIcon />
              </div>
              <div className={styles.instagramPreview}>
                <div className={styles.previewBrand}><span>BUSINESS CEO AI</span><small>EXECUTIVE REAL ESTATE</small></div>
                <div className={styles.previewVisual}>
                  {previewCampaign?.posterHeadline ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/fabrika/marketing/poster/${previewCampaign.id}?format=square`} alt={`${previewCampaign.name} poster ön izlemesi`} />
                  ) : selectedProperty?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selectedProperty.imageUrl} alt={selectedProperty.title} />
                  ) : <div className={styles.noPreview}><ImageIcon /><span>İlk kampanyanızın posteri burada görünecek</span></div>}
                </div>
                <div className={styles.previewMeta}>
                  <strong>{previewCampaign?.posterHeadline || selectedProperty?.title || 'Yeni kampanya'}</strong>
                  <span>{selectedProperty?.location || previewCampaign?.property?.location || 'Business CEO AI'}</span>
                  <b>{money(selectedProperty?.price || previewCampaign?.property?.price || null)}</b>
                </div>
              </div>
              <div className={styles.copyPreview}>
                <span>Gönderi metni</span>
                <h3>{previewCopy?.headline || 'Kampanyanız için platforma özel başlık burada oluşur.'}</h3>
                <p>{previewCopy?.body || 'Portföyünüzü ve hedef kitlenizi seçin; yapay zekâ doğrulanmış bilgilerle paylaşım metnini hazırlasın.'}</p>
                {previewCopy?.callToAction && <strong>{previewCopy.callToAction}</strong>}
                <button type="button" onClick={copyPreview} disabled={!previewCopy}><Copy /> Kopyala</button>
              </div>
            </article>

            <aside className={`${styles.panel} ${styles.suggestion}`}>
              <div className={styles.panelTitle}>
                <div><span>AI kampanya önerisi</span><small>Seçimlerinize göre anlık özet</small></div>
                <Badge>AI</Badge>
              </div>
              <div className={styles.suggestionList}>
                <div><span><Users2 /></span><p><b>Hedef kitle</b>{audience}</p></div>
                <div><span><Clock3 /></span><p><b>Yayın yaklaşımı</b>Instagram görseli, Google araması ve izinli WhatsApp teması birlikte planlanır.</p></div>
                <div><span><TrendingUp /></span><p><b>Değer önerisi</b>{selectedProperty?.title || data?.company.name || 'Şirket markası'} için {objective.toLocaleLowerCase('tr-TR')} odaklı mesaj.</p></div>
                <div><span className={styles.risk}><Target /></span><p><b>Kontrol notu</b>Fiyat, konum ve portföy özellikleri yalnızca kayıtlı veriden alınır.</p></div>
              </div>
              {[
                ['İçerik hazırlığı', readiness],
                ['Kanal kapsamı', 75],
                ['Onay oranı', domesticCampaigns.flatMap((campaign) => campaign.adCopies).length ? Math.round((stats.approved / domesticCampaigns.flatMap((campaign) => campaign.adCopies).length) * 100) : 0],
              ].map(([label, value]) => (
                <div key={label as string} className={styles.scoreRow}>
                  <span>{label as string}</span><i><b style={{ width: `${value}%` }} /></i><strong>{value}/100</strong>
                </div>
              ))}
            </aside>
          </section>

          <section className={styles.bottomGrid}>
            <article className={`${styles.panel} ${styles.archive}`}>
              <div className={styles.archiveHeader}>
                <div><h2>Kampanyalarım</h2><p>Metinleri onaylayın, posterleri indirin ve kampanya detaylarını açın.</p></div>
                <Badge>{domesticCampaigns.length} kampanya</Badge>
              </div>
              {loading ? (
                <LoadingSkeleton rows={3} />
              ) : domesticCampaigns.length === 0 ? (
                <EmptyState icon={Megaphone} title="Henüz kampanya yok" description="Kampanya oluşturucudan ilk setinizi hazırlayın." />
              ) : (
                <div className={styles.campaignTable}>
                  <div className={styles.tableHead}><span>Durum</span><span>Kampanya</span><span>Portföy</span><span>Kanal</span><span>Oluşturma</span><span /></div>
                  {domesticCampaigns.map((campaign) => (
                    <div key={campaign.id} className={styles.campaignItem}>
                      <button
                        type="button"
                        onClick={() => setExpanded((current) => ({ ...current, [campaign.id]: !current[campaign.id] }))}
                        className={styles.campaignRow}
                        aria-expanded={Boolean(expanded[campaign.id])}
                      >
                        <span><b>Aktif</b></span>
                        <strong>{campaign.name}</strong>
                        <span>{campaign.property?.title || 'Şirket markası'}</span>
                        <span className={styles.platformIcons}>{campaign.adCopies.map((copy) => copy.platform === 'INSTAGRAM' ? '◉' : copy.platform === 'WHATSAPP' ? '◍' : 'G').join(' ')}</span>
                        <time>{new Date(campaign.createdAt).toLocaleDateString('tr-TR')}</time>
                        {expanded[campaign.id] ? <ChevronUp /> : <ChevronDown />}
                      </button>
                      {expanded[campaign.id] && (
                        <div className={styles.campaignDetails}>
                          {campaign.posterHeadline && (
                            <div className={styles.posterPack}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/api/fabrika/marketing/poster/${campaign.id}?format=square`} alt={`${campaign.name} kare poster ön izlemesi`} />
                              <div><h3>{campaign.posterHeadline}</h3><p>{campaign.posterSubline}</p>
                                <Button asChild className={styles.primaryButton}><a href={`/api/fabrika/marketing/poster/${campaign.id}?format=square&download=1`}><Download /> Kare poster</a></Button>
                                <Button asChild variant="outline" className={styles.secondaryButton}><a href={`/api/fabrika/marketing/poster/${campaign.id}?format=story&download=1`}><Download /> Hikâye</a></Button>
                              </div>
                            </div>
                          )}
                          <div className={styles.copyGrid}>{campaign.adCopies.map((copy) => <AdCopyCard key={copy.id} {...copy} onApprove={toggleApprove} />)}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </article>

            <aside className={`${styles.panel} ${styles.websitePlan}`}>
              <div className={styles.webTitle}><span><Globe2 /></span><div><b>Web sitesi reklam planı</b><small>{data?.websiteAnalyses[0]?.domain || 'Yeni analiz oluşturun'}</small></div></div>
              <label htmlFor="website-url">Web sitesi adresi</label>
              <Input id="website-url" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://emlaksiteniz.com" className={inputClass} />
              <Button type="button" onClick={analyzeWebsite} disabled={analyzing} className={styles.generateButton}>
                {analyzing ? <Loader2 className="animate-spin" /> : <Rocket />}{analyzing ? 'Analiz ediliyor…' : 'Reklam planı hazırla'}
              </Button>
              {data?.websiteAnalyses[0] ? (
                <div className={styles.webSummary}>
                  <p>{data.websiteAnalyses[0].summary}</p>
                  {[
                    ['Güçlü taraf', jsonList(data.websiteAnalyses[0].strengths).length],
                    ['Fırsat', jsonList(data.websiteAnalyses[0].opportunities).length],
                    ['İlk aksiyon', jsonList(data.websiteAnalyses[0].firstActions).length],
                  ].map(([label, value]) => <div key={label as string}><span>{label as string}</span><b>{value}</b></div>)}
                  <a href={data.websiteAnalyses[0].websiteUrl} target="_blank" rel="noreferrer">Siteyi aç <ExternalLink /></a>
                </div>
              ) : <p className={styles.webEmpty}>Sitenizin açık içeriğini analiz ederek Google, Instagram ve WhatsApp için uygulanabilir ilk adımları çıkarır.</p>}
            </aside>
          </section>

          {data && data.websiteAnalyses.length > 1 && (
            <details className={styles.analysisArchive}>
              <summary>Önceki web reklam planları ({data.websiteAnalyses.length - 1})</summary>
              <div>{data.websiteAnalyses.slice(1).map((analysis) => <a key={analysis.id} href={analysis.websiteUrl} target="_blank" rel="noreferrer"><b>{analysis.domain}</b><span>{analysis.summary}</span><ExternalLink /></a>)}</div>
            </details>
          )}
        </TabsContent>

        <TabsContent value="international" className={styles.internationalPanel}>
          <InternationalMarketingPanel
            properties={data?.properties || []}
            campaigns={internationalCampaigns}
            loading={loading}
            onGenerated={fetchData}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="border border-slate-700 bg-slate-900 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white"><KeyRound className="h-4 w-4 text-emerald-400" /> Pazarlamacı AI ayarları</DialogTitle>
            <DialogDescription className="text-slate-400">OpenRouter anahtarı yalnızca sunucuda şifreli saklanır ve tarayıcıya geri gönderilmez.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {data?.ai.configured && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-200">Kayıtlı anahtar: {data.ai.keyHint} · Değiştirmek istemiyorsanız alanı boş bırakın.</div>
            )}
            <div>
              <label htmlFor="openrouter-key" className="mb-2 block text-xs font-semibold text-slate-300">OpenRouter API anahtarı</label>
              <Input id="openrouter-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-or-v1-..." className={inputClass} />
            </div>
            <div>
              <label htmlFor="openrouter-model" className="mb-2 block text-xs font-semibold text-slate-300">Model yönlendirmesi</label>
              <Input id="openrouter-model" value={model} onChange={(event) => setModel(event.target.value)} className={inputClass} />
              <p className="mt-2 text-xs leading-5 text-slate-500"><code>openrouter/free</code> pilot kullanımda uygun ücretsiz modeli otomatik seçer. Ücretsiz modellerin kapasitesi ve erişilebilirliği değişebilir.</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
              <input type="checkbox" checked={aiActive} onChange={(event) => setAiActive(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
              <span><span className="block text-sm font-medium text-white">AI üretimini etkinleştir</span><span className="mt-1 block text-xs text-slate-500">Kapalıysa doğrulanabilir verilerden profesyonel kural motoru metin üretir.</span></span>
            </label>
            <a href="https://openrouter.ai/settings/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300">OpenRouter’dan anahtar alma sayfası <ExternalLink className="h-3 w-3" /></a>
          </div>
          <DialogFooter className="border-slate-800 bg-slate-950/60">
            <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)} className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white">Vazgeç</Button>
            <Button type="button" onClick={saveSettings} disabled={savingSettings} className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
              {savingSettings ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Ayarları kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
