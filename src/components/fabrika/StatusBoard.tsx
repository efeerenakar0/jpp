'use client';

import React, { useState } from 'react';
import { Trash2, ExternalLink, ShieldCheck, Clock, CheckCircle2, XCircle, Search, Sparkles } from 'lucide-react';

type HuntingStatus = 'YELLOW' | 'RED' | 'GREEN';

interface Listing {
  id: string;
  title: string;
  price?: string | null;
  location?: string | null;
  sourceUrl: string;
  status: HuntingStatus;
  ownerName?: string | null;
  ownerPhone?: string | null;
}

interface StatusBoardProps {
  listings: Listing[];
  onStatusChange: (id: string, newStatus: HuntingStatus) => void;
  onDeleteListing?: (id: string) => void;
}

export default function StatusBoard({ listings, onStatusChange, onDeleteListing }: StatusBoardProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = listings.filter((l) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.title.toLowerCase().includes(term) ||
      (l.location && l.location.toLowerCase().includes(term)) ||
      (l.ownerName && l.ownerName.toLowerCase().includes(term)) ||
      (l.ownerPhone && l.ownerPhone.includes(term))
    );
  });

  const yellowListings = filtered.filter((l) => l.status === 'YELLOW');
  const redListings = filtered.filter((l) => l.status === 'RED');
  const greenListings = filtered.filter((l) => l.status === 'GREEN');

  const Column = ({ 
    title, 
    badgeText,
    badgeBg,
    borderColor,
    items, 
    targetStatuses,
    icon: Icon
  }: { 
    title: string; 
    badgeText: string;
    badgeBg: string;
    borderColor: string;
    items: Listing[];
    targetStatuses: { label: string; status: HuntingStatus; btnClass: string }[];
    icon: any;
  }) => (
    <div className={`bg-slate-950/70 border ${borderColor} rounded-3xl p-5 flex flex-col h-full backdrop-blur-xl shadow-xl`}>
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${badgeBg} flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="font-black text-white text-sm tracking-wide">{title}</h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-black ${badgeBg}`}>
          {items.length} {badgeText}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 custom-scrollbar min-h-[450px] max-h-[600px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-800/60 rounded-2xl p-6">
            <Clock className="w-8 h-8 text-slate-700 mb-2" />
            <p className="text-xs font-bold text-slate-400">Bu sütunda henüz ilan yok</p>
            <p className="text-[11px] text-slate-600 mt-1">Chrome eklentisiyle Sahibinden&apos;den ilan çekin</p>
          </div>
        ) : (
          items.map((listing) => (
            <div 
              key={listing.id} 
              className="relative bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-4 transition-all duration-200 group hover:shadow-xl hover:shadow-amber-500/5 flex flex-col justify-between"
            >
              {onDeleteListing && (
                <button
                  onClick={() => onDeleteListing(listing.id)}
                  className="absolute top-3.5 right-3.5 p-1.5 bg-red-500/10 text-red-400 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20 active:scale-95 cursor-pointer"
                  title="İlanı Sil"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <div>
                <div className="flex items-center justify-between text-[11px] mb-2 pr-6">
                  <span className="font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                    {listing.price || 'Fiyat Yok'}
                  </span>
                  {listing.location && (
                    <span className="text-slate-400 font-medium truncate max-w-[120px]">
                      📍 {listing.location}
                    </span>
                  )}
                </div>

                <h4 className="font-extrabold text-white text-xs leading-snug line-clamp-2 mb-3 pr-4 group-hover:text-amber-300 transition-colors" title={listing.title}>
                  {listing.title}
                </h4>

                {(listing.ownerName || listing.ownerPhone) && (
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 mb-3 space-y-1 text-[11px]">
                    {listing.ownerName && (
                      <p className="text-slate-300 font-bold flex items-center gap-1.5">
                        <span className="text-slate-500">👤 Sahib:</span> {listing.ownerName}
                      </p>
                    )}
                    {listing.ownerPhone && (
                      <p className="text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                        <span className="text-slate-500">📱 Tel:</span> {listing.ownerPhone}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2 mt-2">
                <a 
                  href={listing.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  İlana Git <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex gap-1.5">
                  {targetStatuses.map((ts) => (
                    <button
                      key={ts.status}
                      onClick={() => onStatusChange(listing.id, ts.status)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer border active:scale-95 ${ts.btnClass}`}
                    >
                      {ts.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="İlan başlığı, konum veya telefon ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Sıcak İlanlar</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Portföyümüze Katıldı</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Pasif</span>
        </div>
      </div>

      {/* Grid Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Column 
          title="Sıcak Pazarlıkta" 
          badgeText="Aday"
          badgeBg="bg-amber-500/20 text-amber-300 border border-amber-500/30" 
          borderColor="border-amber-500/20"
          items={yellowListings} 
          icon={Sparkles}
          targetStatuses={[
            { label: 'Elendi', status: 'RED', btnClass: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' },
            { label: ' Portföye Katıldı', status: 'GREEN', btnClass: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30' }
          ]} 
        />
        <Column 
          title="Portföyümüze Katıldı" 
          badgeText="İlan"
          badgeBg="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
          borderColor="border-emerald-500/20"
          items={greenListings} 
          icon={CheckCircle2}
          targetStatuses={[
            { label: 'Pazarlığa Al', status: 'YELLOW', btnClass: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' },
            { label: 'Pasif', status: 'RED', btnClass: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' }
          ]} 
        />
        <Column 
          title="Pasif / Elendi" 
          badgeText="İlan"
          badgeBg="bg-red-500/20 text-red-300 border border-red-500/30" 
          borderColor="border-red-500/20"
          items={redListings} 
          icon={XCircle}
          targetStatuses={[
            { label: 'Yeniden Pazarlığa Al', status: 'YELLOW', btnClass: 'bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30' }
          ]} 
        />
      </div>
    </div>
  );
}
