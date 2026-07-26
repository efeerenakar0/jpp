'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Megaphone,
  Plus,
  Sparkles,
} from 'lucide-react';
import AdCopyCard from '@/components/fabrika/AdCopyCard';
import EmptyState from '@/components/fabrika/EmptyState';
import FilterBar from '@/components/fabrika/FilterBar';
import LoadingSkeleton from '@/components/fabrika/LoadingSkeleton';
import PageHeader from '@/components/fabrika/PageHeader';
import WorkspacePulse from '@/components/fabrika/WorkspacePulse';
import StatCard from '@/components/fabrika/StatCard';

interface Listing {
  id: string;
  title: string;
  status: string;
}

interface AdCopy {
  id: string;
  platform: 'GOOGLE_ADS' | 'INSTAGRAM' | 'WHATSAPP';
  headline: string;
  body: string;
  targetUrl: string | null;
  approved: boolean;
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  adCopies: AdCopy[];
}

export default function MarketingPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedListing, setSelectedListing] = useState<string>('brand');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'listing' | 'brand'>('all');

  const fetchData = async () => {
    try {
      const [campaignResponse, listingsResponse] = await Promise.all([
        fetch('/api/fabrika/marketing/campaigns'),
        fetch('/api/fabrika/hunting'),
      ]);

      if (campaignResponse.ok) {
        const data = await campaignResponse.json();
        setCampaigns(data);
        if (data.length > 0) {
          setExpandedCampaigns({ [data[0].id]: true });
        }
      }

      if (listingsResponse.ok) {
        const data = await listingsResponse.json();
        setListings(data.filter((listing: Listing) => listing.status === 'GREEN'));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialTimeout = window.setTimeout(fetchData, 0);
    return () => window.clearTimeout(initialTimeout);
  }, []);

  const generateCampaign = async () => {
    setGenerating(true);
    try {
      const isBrand = selectedListing === 'brand';
      const body = isBrand
        ? { type: 'brand', companyName: 'Jasmine Group' }
        : { type: 'listing', listingId: selectedListing };

      const response = await fetch('/api/fabrika/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const newCampaign = await response.json();
        setCampaigns((previous) => [newCampaign, ...previous]);
        setExpandedCampaigns((previous) => ({ ...previous, [newCampaign.id]: true }));
      }
    } catch (error) {
      console.error('Error generating campaign:', error);
    } finally {
      setGenerating(false);
    }
  };

  const toggleApprove = async (adCopyId: string, approved: boolean) => {
    try {
      const response = await fetch('/api/fabrika/marketing/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adCopyId, approved }),
      });

      if (response.ok) {
        setCampaigns((previous) =>
          previous.map((campaign) => ({
            ...campaign,
            adCopies: campaign.adCopies.map((copy) =>
              copy.id === adCopyId ? { ...copy, approved } : copy,
            ),
          })),
        );
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  const filteredCampaigns = campaigns.filter((campaign) => filter === 'all' || campaign.type === filter);
  const approvedCopies = campaigns.flatMap((campaign) => campaign.adCopies).filter((copy) => copy.approved).length;
  const pendingCopies = campaigns.flatMap((campaign) => campaign.adCopies).filter((copy) => !copy.approved).length;

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        eyebrow="Kampanya operasyonu"
        title="Pazarlamacı"
        description="Google Ads, Instagram ve WhatsApp için reklam metinleri üretin, inceleyin ve onaylayın."
        icon={Megaphone}
        actions={
          <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300">
            Gemini reklam motoru
          </span>
        }
      />

      <WorkspacePulse />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Toplam kampanya" value={campaigns.length} icon={Megaphone} />
        <StatCard label="Onaylı içerik" value={approvedCopies} icon={CheckCircle2} status="success" />
        <StatCard label="Onay bekleyen" value={pendingCopies} icon={Clock} status="warning" />
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Yeni kampanya üret</h2>
            <p className="mt-0.5 text-xs text-slate-500">Marka veya portföy seçerek üç kanal için içerik hazırlayın.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="campaign-source" className="sr-only">Kampanya kaynağı</label>
          <select
            id="campaign-source"
            value={selectedListing}
            onChange={(event) => setSelectedListing(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none transition-colors focus:border-emerald-500"
          >
            <option value="brand">Marka tanıtım kampanyası — Jasmine Group</option>
            {listings.length > 0 && <option disabled>──────────</option>}
            {listings.map((listing) => (
              <option key={listing.id} value={listing.id}>İlan — {listing.title}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={generateCampaign}
            disabled={generating}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {generating ? 'Üretiliyor...' : 'AI ile üret'}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Kampanyalar</h2>
            <p className="mt-0.5 text-xs text-slate-500">Üretilen içerikleri kanal bazında inceleyin.</p>
          </div>
          <FilterBar label="Kampanya filtresi">
            {(['all', 'listing', 'brand'] as const).map((filterValue) => (
              <button
                type="button"
                key={filterValue}
                onClick={() => setFilter(filterValue)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                  filter === filterValue
                    ? 'bg-emerald-500 text-emerald-950'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {filterValue === 'all' ? 'Tümü' : filterValue === 'listing' ? 'İlanlar' : 'Marka'}
              </button>
            ))}
          </FilterBar>
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : filteredCampaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Henüz kampanya yok"
            description="İlk reklam kampanyanızı yukarıdaki üretim alanından oluşturabilirsiniz."
          />
        ) : (
          <div className="space-y-3">
            {filteredCampaigns.map((campaign) => (
              <article key={campaign.id} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => toggleCampaign(campaign.id)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-slate-800/50"
                  aria-expanded={Boolean(expandedCampaigns[campaign.id])}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${
                        campaign.type === 'brand'
                          ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                      }`}>
                        {campaign.type === 'brand' ? 'Marka' : 'İlan'}
                      </span>
                      <h3 className="truncate text-sm font-semibold text-white">{campaign.name}</h3>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(campaign.createdAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'long',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        {campaign.adCopies.filter((copy) => copy.approved).length}/3 onaylı
                      </span>
                    </div>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-400">
                    {expandedCampaigns[campaign.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>

                {expandedCampaigns[campaign.id] && (
                  <div className="border-t border-slate-800 bg-slate-950/30 p-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {(['GOOGLE_ADS', 'INSTAGRAM', 'WHATSAPP'] as const).map((platform) => {
                        const copy = campaign.adCopies.find((candidate) => candidate.platform === platform);
                        if (!copy) return null;
                        return (
                          <AdCopyCard
                            key={copy.id}
                            id={copy.id}
                            platform={copy.platform}
                            headline={copy.headline}
                            body={copy.body}
                            targetUrl={copy.targetUrl}
                            approved={copy.approved}
                            onApprove={toggleApprove}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
