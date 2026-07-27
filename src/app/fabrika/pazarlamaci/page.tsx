'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Globe2,
  ImageIcon,
  KeyRound,
  Loader2,
  Megaphone,
  Plus,
  Rocket,
  Settings2,
  Sparkles,
  Target,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import AdCopyCard from '@/components/fabrika/AdCopyCard';
import EmptyState from '@/components/fabrika/EmptyState';
import LoadingSkeleton from '@/components/fabrika/LoadingSkeleton';
import PageHeader from '@/components/fabrika/PageHeader';
import StatCard from '@/components/fabrika/StatCard';
import WorkspacePulse from '@/components/fabrika/WorkspacePulse';
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
  type: 'listing' | 'brand';
  objective: string | null;
  audience: string | null;
  posterTemplate: string | null;
  posterHeadline: string | null;
  posterSubline: string | null;
  generatedBy: string | null;
  generatedModel: string | null;
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

  const stats = useMemo(() => {
    const campaigns = data?.campaigns || [];
    const copies = campaigns.flatMap((campaign) => campaign.adCopies);
    return {
      approved: copies.filter((copy) => copy.approved).length,
      posterReady: campaigns.filter((campaign) => campaign.posterHeadline).length,
    };
  }, [data]);

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

  const aiLabel = data?.ai.active
    ? `OpenRouter · ${data.ai.model}`
    : data?.ai.fallbackAvailable
      ? 'Groq yedek motor'
      : 'Akıllı kural motoru';

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Büyüme ve kampanya operasyonu"
        title="Profesyonel Pazarlamacı"
        description="Aktif portföylerden çok kanallı reklam metni ve gerçek fotoğraflı poster üretin; web siteniz için ölçülebilir reklam planı hazırlayın."
        icon={Megaphone}
        actions={
          <>
            <Badge className="h-8 border border-emerald-500/20 bg-emerald-500/10 px-3 text-emerald-300">
              <Bot className="mr-1 h-3.5 w-3.5" />
              {aiLabel}
            </Badge>
            {data?.permissions.canManageSecrets && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettingsOpen(true)}
                className="h-9 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
              >
                <Settings2 />
                AI ayarları
              </Button>
            )}
          </>
        }
      />

      <WorkspacePulse />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Kampanya" value={data?.campaigns.length || 0} icon={Megaphone} />
        <StatCard label="Aktif portföy" value={data?.properties.length || 0} icon={Target} />
        <StatCard label="Onaylı kanal metni" value={stats.approved} icon={CheckCircle2} status="success" />
        <StatCard label="İndirilebilir poster" value={stats.posterReady} icon={ImageIcon} />
      </div>

      <Tabs defaultValue="campaigns" className="gap-5">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto border border-slate-800 bg-slate-900 p-1 sm:w-fit">
          <TabsTrigger value="campaigns" className="min-h-9 px-4 text-slate-400 data-active:bg-slate-800 data-active:text-white">
            <WandSparkles /> Kampanya stüdyosu
          </TabsTrigger>
          <TabsTrigger value="website" className="min-h-9 px-4 text-slate-400 data-active:bg-slate-800 data-active:text-white">
            <Globe2 /> Web reklam planı
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-6">
          <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-semibold text-white">Yeni kampanya üret</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Portföy verilerini değiştirmeden Google Ads, Instagram ve WhatsApp için ayrı içerik üretir.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 xl:grid-cols-[1.25fr_.75fr]">
              <div className="space-y-5">
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Kampanya kaynağı</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ['listing', 'Aktif portföy', 'Portföy fotoğrafı, fiyatı ve özellikleri'],
                      ['brand', 'Şirket markası', 'Kurumsal güven ve danışmanlık kampanyası'],
                    ] as const).map(([value, title, text]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setCampaignType(value)}
                        className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          campaignType === value
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                        }`}
                      >
                        <span className="text-sm font-semibold text-white">{title}</span>
                        <span className="mt-1 block text-xs text-slate-500">{text}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {campaignType === 'listing' && (
                  <div>
                    <label htmlFor="property" className="mb-2 block text-xs font-semibold text-slate-400">Aktif portföy</label>
                    <select
                      id="property"
                      value={propertyId}
                      onChange={(event) => setPropertyId(event.target.value)}
                      className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500"
                    >
                      <option value="">Portföy seçin</option>
                      {data?.properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.referenceCode ? `${property.referenceCode} · ` : ''}{property.title} · {money(property.price)}
                        </option>
                      ))}
                    </select>
                    {!loading && data?.properties.length === 0 && (
                      <p className="mt-2 text-xs text-amber-300">Kampanya için önce Portföyler bölümünde bir kaydı aktif duruma getirin.</p>
                    )}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="objective" className="mb-2 block text-xs font-semibold text-slate-400">Kampanya amacı</label>
                    <Input id="objective" value={objective} onChange={(event) => setObjective(event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="audience" className="mb-2 block text-xs font-semibold text-slate-400">Hedef kitle</label>
                    <Input id="audience" value={audience} onChange={(event) => setAudience(event.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="tone" className="mb-2 block text-xs font-semibold text-slate-400">İletişim tonu</label>
                    <select id="tone" value={tone} onChange={(event) => setTone(event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500">
                      <option value="professional">Profesyonel</option>
                      <option value="warm">Samimi</option>
                      <option value="premium">Premium</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="template" className="mb-2 block text-xs font-semibold text-slate-400">Poster şablonu</label>
                    <select id="template" value={posterTemplate} onChange={(event) => setPosterTemplate(event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-emerald-500">
                      <option value="SIGNATURE">Signature · Dengeli</option>
                      <option value="EDITORIAL">Editorial · Premium</option>
                      <option value="BOLD">Bold · Yüksek dikkat</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="target-url" className="mb-2 block text-xs font-semibold text-slate-400">Hedef sayfa (isteğe bağlı)</label>
                  <Input id="target-url" type="url" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} placeholder="https://siteniz.com/portfoy/..." className={inputClass} />
                </div>
              </div>

              <aside className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Tek üretimde hazır</p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-300">
                    {['Google Ads başlık ve açıklamaları', 'Instagram metni ve etiketleri', 'İzinli WhatsApp grup mesajı', 'Kare ve hikâye posterleri'].map((item) => (
                      <li key={item} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  type="button"
                  onClick={generateCampaign}
                  disabled={generating || (campaignType === 'listing' && !propertyId)}
                  className="mt-6 min-h-11 bg-emerald-500 font-semibold text-emerald-950 hover:bg-emerald-400"
                >
                  {generating ? <Loader2 className="animate-spin" /> : <Plus />}
                  {generating ? 'Kampanya hazırlanıyor…' : 'Kampanyayı üret'}
                </Button>
              </aside>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-white">Kampanya arşivi</h2>
              <p className="mt-1 text-xs text-slate-500">Metinleri onaylayın; posterleri kare veya hikâye boyutunda indirin.</p>
            </div>
            {loading ? (
              <LoadingSkeleton rows={3} />
            ) : !data?.campaigns.length ? (
              <EmptyState icon={Megaphone} title="Henüz kampanya yok" description="Yukarıdaki stüdyodan ilk kampanya setinizi oluşturun." />
            ) : (
              data.campaigns.map((campaign) => (
                <article key={campaign.id} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                  <button
                    type="button"
                    onClick={() => setExpanded((current) => ({ ...current, [campaign.id]: !current[campaign.id] }))}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                    aria-expanded={Boolean(expanded[campaign.id])}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={campaign.type === 'listing' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-700 text-slate-200'}>
                          {campaign.type === 'listing' ? 'Portföy' : 'Marka'}
                        </Badge>
                        <Badge variant="outline" className="border-slate-700 text-slate-400">
                          {campaign.generatedBy === 'OPENROUTER' ? 'OpenRouter AI' : campaign.generatedBy === 'GROQ' ? 'Groq AI' : 'Akıllı kural motoru'}
                        </Badge>
                        <h3 className="truncate text-sm font-semibold text-white">{campaign.name}</h3>
                      </div>
                      <p className="mt-2 line-clamp-1 text-xs text-slate-500">
                        {campaign.property?.title || campaign.description} · {new Date(campaign.createdAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400">
                      {expanded[campaign.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>

                  {expanded[campaign.id] && (
                    <div className="space-y-5 border-t border-slate-800 bg-slate-950/30 p-4">
                      {campaign.posterHeadline && (
                        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                          <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/fabrika/marketing/poster/${campaign.id}?format=square`}
                              alt={`${campaign.name} kare poster ön izlemesi`}
                              className="aspect-square w-full object-cover"
                            />
                          </div>
                          <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Poster paketi</p>
                              <h4 className="mt-2 text-lg font-semibold text-white">{campaign.posterHeadline}</h4>
                              <p className="mt-1 text-sm text-slate-400">{campaign.posterSubline}</p>
                              <p className="mt-4 text-xs leading-5 text-slate-500">Portföyün gerçek fotoğrafı kullanılır; yapay görsel üretilmez. Metinler güvenli alan içinde tutulur.</p>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button asChild className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                                <a href={`/api/fabrika/marketing/poster/${campaign.id}?format=square&download=1`}>
                                  <Download /> Kare poster
                                </a>
                              </Button>
                              <Button asChild variant="outline" className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-white">
                                <a href={`/api/fabrika/marketing/poster/${campaign.id}?format=story&download=1`}>
                                  <Download /> Hikâye posteri
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="grid gap-4 xl:grid-cols-3">
                        {campaign.adCopies.map((copy) => (
                          <AdCopyCard key={copy.id} {...copy} onApprove={toggleApprove} />
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        </TabsContent>

        <TabsContent value="website" className="space-y-6">
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"><Globe2 className="h-4 w-4" /></span>
                  <div>
                    <h2 className="font-semibold text-white">Web sitesi reklam rehberi</h2>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Sitenizin herkese açık içeriğini inceler; kanal planı ve ilk uygulanacak işleri hazırlar. Trafik veya dönüşüm verisi uydurmaz.</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Input type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://emlaksiteniz.com" className={`min-h-11 ${inputClass}`} />
                  <Button type="button" onClick={analyzeWebsite} disabled={analyzing} className="min-h-11 bg-emerald-500 px-5 text-emerald-950 hover:bg-emerald-400">
                    {analyzing ? <Loader2 className="animate-spin" /> : <Rocket />}
                    {analyzing ? 'Analiz ediliyor…' : 'Reklam planı hazırla'}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Analiz kapsamı</p>
                <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                  <li>• Dönüşüm ve iletişim fırsatları</li>
                  <li>• Google, Instagram ve WhatsApp kanal rolleri</li>
                  <li>• İlk 14 gün uygulanacak işler</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Hazırlanan büyüme planları</h2>
              <p className="mt-1 text-xs text-slate-500">Her analiz şirket hesabınıza özel saklanır.</p>
            </div>
            {!data?.websiteAnalyses.length ? (
              <EmptyState icon={Globe2} title="Henüz web reklam planı yok" description="Web sitenizi yazarak ilk kanal planını hazırlayın." />
            ) : (
              data.websiteAnalyses.map((analysis) => (
                <article key={analysis.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{analysis.domain}</h3>
                        <Badge variant="outline" className="border-slate-700 text-slate-400">{analysis.generatedBy === 'RULE_ENGINE' ? 'Kural motoru' : 'AI analizi'}</Badge>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{analysis.summary}</p>
                    </div>
                    <Button asChild variant="outline" className="border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white">
                      <a href={analysis.websiteUrl} target="_blank" rel="noreferrer"><ExternalLink /> Siteyi aç</a>
                    </Button>
                  </div>
                  <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Güçlü taraflar', jsonList(analysis.strengths)],
                      ['Fırsatlar', jsonList(analysis.opportunities)],
                      ['Kanal planı', jsonList(analysis.channelPlan)],
                      ['İlk aksiyonlar', jsonList(analysis.firstActions)],
                    ].map(([title, items]) => (
                      <div key={title as string}>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-400">{title as string}</h4>
                        <ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400">
                          {(items as string[]).map((item) => <li key={item} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />{item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
          </section>
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
    </div>
  );
}
