'use client';

import { useState, useEffect } from 'react';
import { Megaphone, Sparkles, Plus, Loader2, ChevronDown, ChevronUp, CheckCircle2, Clock } from 'lucide-react';
import AdCopyCard from '@/components/fabrika/AdCopyCard';

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [campaignRes, listingsRes] = await Promise.all([
        fetch('/api/fabrika/marketing/campaigns'),
        fetch('/api/fabrika/hunting')
      ]);

      if (campaignRes.ok) {
        const data = await campaignRes.json();
        setCampaigns(data);
        if (data.length > 0) {
          setExpandedCampaigns({ [data[0].id]: true });
        }
      }
      
      if (listingsRes.ok) {
        const data = await listingsRes.json();
        setListings(data.filter((l: Listing) => l.status === 'GREEN'));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCampaign = async () => {
    setGenerating(true);
    try {
      const isBrand = selectedListing === 'brand';
      const body = isBrand 
        ? { type: 'brand', companyName: 'Jasmine Group' }
        : { type: 'listing', listingId: selectedListing };

      const res = await fetch('/api/fabrika/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const newCampaign = await res.json();
        setCampaigns(prev => [newCampaign, ...prev]);
        setExpandedCampaigns(prev => ({ ...prev, [newCampaign.id]: true }));
      }
    } catch (error) {
      console.error('Error generating campaign:', error);
    } finally {
      setGenerating(false);
    }
  };

  const toggleApprove = async (adCopyId: string, approved: boolean) => {
    try {
      const res = await fetch('/api/fabrika/marketing/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adCopyId, approved })
      });

      if (res.ok) {
        setCampaigns(prev => prev.map(camp => ({
          ...camp,
          adCopies: camp.adCopies.map(copy => 
            copy.id === adCopyId ? { ...copy, approved } : copy
          )
        })));
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredCampaigns = campaigns.filter(c => filter === 'all' || c.type === filter);

  const totalCampaigns = campaigns.length;
  const approvedCopies = campaigns.flatMap(c => c.adCopies).filter(c => c.approved).length;
  const pendingCopies = campaigns.flatMap(c => c.adCopies).filter(c => !c.approved).length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 pb-20 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header - Stitch Glass */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-slate-900/80 border border-slate-800 p-6 rounded-3xl backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Megaphone className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                Pazarlamacı Modülü
                <span className="text-xs px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full font-bold">
                  Gemini Reklam Motoru
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Google Ads, Meta Instagram ve WhatsApp için saniyeler içinde viral reklam metinleri üretin.</p>
            </div>
          </div>
          
          <div className="flex gap-4 bg-slate-950 p-2.5 rounded-2xl border border-slate-800">
            <div className="text-center px-4 border-r border-slate-800">
              <div className="text-xl font-black text-white">{totalCampaigns}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Kampanya</div>
            </div>
            <div className="text-center px-4 border-r border-slate-800">
              <div className="text-xl font-black text-emerald-400">{approvedCopies}</div>
              <div className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Onaylı</div>
            </div>
            <div className="text-center px-4">
              <div className="text-xl font-black text-amber-400">{pendingCopies}</div>
              <div className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">Bekleyen</div>
            </div>
          </div>
        </header>

        {/* Generate Box */}
        <section className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl relative overflow-hidden backdrop-blur-xl shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2 relative z-10">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            Yeni Yapay Zeka Kampanyası Üret
          </h2>
          
          <div className="flex flex-col sm:flex-row gap-4 relative z-10">
            <select
              value={selectedListing}
              onChange={(e) => setSelectedListing(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-emerald-500/50 transition-colors font-medium"
            >
              <option value="brand">🌟 Marka Tanıtım Kampanyası (Jasmine Group)</option>
              {listings.length > 0 && <option disabled>──────────</option>}
              {listings.map(l => (
                <option key={l.id} value={l.id}>🏠 İlan: {l.title}</option>
              ))}
            </select>
            
            <button
              onClick={generateCampaign}
              disabled={generating}
              className="bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 px-8 py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-w-[180px] shadow-lg shadow-emerald-500/20 text-xs uppercase tracking-wider cursor-pointer active:scale-95"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Üretiliyor...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  AI ile Üret
                </>
              )}
            </button>
          </div>
        </section>

        {/* Campaigns List */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Aktif Kampanyalarım</h2>
            <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-800">
              {(['all', 'listing', 'brand'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    filter === f 
                      ? 'bg-slate-800 text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'Tümü' : f === 'listing' ? 'İlanlar' : 'Marka'}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800 text-slate-500 text-xs font-semibold">
              Henüz üretilmiş bir kampanya bulunmuyor.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCampaigns.map((campaign) => (
                <div key={campaign.id} className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl">
                  <button 
                    onClick={() => toggleCampaign(campaign.id)}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-800/40 transition-colors text-left cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          campaign.type === 'brand' 
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' 
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {campaign.type === 'brand' ? 'Marka' : 'İlan'}
                        </span>
                        <h3 className="font-bold text-white text-sm">{campaign.name}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(campaign.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          {campaign.adCopies.filter(c => c.approved).length}/3 Onaylı
                        </span>
                      </div>
                    </div>
                    <div className="p-2 bg-slate-800 rounded-2xl text-slate-400">
                      {expandedCampaigns[campaign.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>
                  
                  {expandedCampaigns[campaign.id] && (
                    <div className="p-5 pt-0 border-t border-slate-800 mt-2 bg-slate-950/40">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                        {['GOOGLE_ADS', 'INSTAGRAM', 'WHATSAPP'].map(platform => {
                          const copy = campaign.adCopies.find(c => c.platform === platform);
                          if (!copy) return null;
                          return (
                            <AdCopyCard
                              key={copy.id}
                              id={copy.id}
                              platform={copy.platform as any}
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
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
